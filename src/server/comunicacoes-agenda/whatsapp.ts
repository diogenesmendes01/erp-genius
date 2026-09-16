import { createHash, randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { confirmarTransacao } from "@/lib/transacao-confirmada";
import { garantirAtendimento } from "@/server/whatsapp/atendimentos";
import { destinatarioAtualDoAtendimento } from "@/server/whatsapp/destinatario-atual";
import { garantirContato } from "@/server/whatsapp/identidade";
import { renderizarHorariosReplanejamento, validarFonteReplanejamentoConjuntoTx } from "./fonte-replanejamento";

const VARIAVEIS_AGENDA = /\{(nome|horarios)\}/g;
const hashContato = (valor: string) => createHash("sha256").update(valor).digest("hex");

type ConfiguracaoAgenda = {
  numeroAvisosAgendaId: string | null;
  templateAvisosAgendaId: string | null;
  numeroAvisosAgenda: { id: string; ativo: boolean; finalidade: string; driver: string; providerRef: string | null } | null;
  templateAvisosAgenda: { id: string; corpo: string; idioma: string; categoria: string; statusMeta: string; metaTemplateId: string | null } | null;
};

function destinosAgenda(aluno: { whatsapp: boolean; telefoneE164: string | null; responsaveis: { responsavelId: string; responsavel: { telefoneE164: string | null } }[] }) {
  return [
    ...(aluno.whatsapp && aluno.telefoneE164 ? [{ telefone: aluno.telefoneE164, responsavelId: null }] : []),
    ...aluno.responsaveis.flatMap((r) => r.responsavel.telefoneE164 ? [{ telefone: r.responsavel.telefoneE164, responsavelId: r.responsavelId }] : []),
  ];
}

export function renderizarTemplateAgenda(corpo: string, dados: { nome: string; horarios: string }) {
  const variaveis: string[] = [];
  let encontrouHorario = false;
  const texto = corpo.replace(VARIAVEIS_AGENDA, (_todo, chave: "nome" | "horarios") => {
    if (chave === "horarios") encontrouHorario = true;
    const valor = dados[chave];
    variaveis.push(valor);
    return valor;
  });
  // Tokens desconhecidos tornam os parâmetros posicionais divergentes da Meta.
  if (/\{[^}]+\}/.test(texto) || !encontrouHorario) return null;
  return { texto, variaveis };
}

function horariosDoAviso(aviso: { evento: { tipo: string; payload: unknown } | null; itens: { encontroId: string; encontro: { inicio: Date; fim: Date; fusoOrigem: string } }[] }, fonte: Awaited<ReturnType<typeof validarFonteReplanejamentoConjuntoTx>> | boolean = false) {
  const horario = (id?: string) => {
    const e = aviso.itens.find((item) => item.encontroId === id)?.encontro;
    return e && `${e.inicio.toLocaleString("pt-BR", { timeZone: e.fusoOrigem })}–${e.fim.toLocaleTimeString("pt-BR", { timeZone: e.fusoOrigem })} (${e.fusoOrigem})`;
  };
  const payload = (aviso.evento?.payload ?? {}) as { encontroOriginalId?: string; encontroNovoId?: string };
  if (aviso.evento?.tipo === "ReplanejamentoConjuntoAplicado") {
    if (!fonte || fonte === true) return null;
    return renderizarHorariosReplanejamento(fonte.horarios);
  }
  if (aviso.evento?.tipo === "SubstituicaoDocenteDecidida") return aviso.itens.map(({ encontro }) => `${encontro.inicio.toLocaleString("pt-BR", { timeZone: encontro.fusoOrigem })}–${encontro.fim.toLocaleTimeString("pt-BR", { timeZone: encontro.fusoOrigem })} (${encontro.fusoOrigem})`).join("; ");
  const anterior = horario(payload.encontroOriginalId), novo = horario(payload.encontroNovoId);
  return anterior && novo ? `de ${anterior} para ${novo}` : null;
}

async function fonteAvisoValida(db: Prisma.TransactionClient | typeof prisma, aviso: { eventoId: string | null; matriculaId: string | null; evento: { agregadoTipo: string; agregadoId: string; tipo: string; payload: unknown } | null; itens: { encontroId: string; encontro: { matriculaId: string | null; turmaId: string | null; inicio: Date } }[] }) {
  const evento = aviso.evento;
  const payload = (evento?.payload ?? {}) as { aprovada?: unknown; encontroOriginalId?: string; encontroNovoId?: string; encontrosIds?: string[] };
  const remarcacao = !!evento && evento.agregadoTipo === "Matricula" && evento.agregadoId === aviso.matriculaId && ["RemarcacaoParticularDecidida", "RemarcacaoAgendaReposicaoDecidida"].includes(evento.tipo) && payload.aprovada === true;
  const substituicao = !!evento && evento.agregadoTipo === "ConfiguracaoOperacional" && evento.agregadoId === "escola" && evento.tipo === "SubstituicaoDocenteDecidida" && payload.aprovada === true;
  const replanejamento = !!evento && evento.agregadoTipo === "ConfiguracaoOperacional" && evento.agregadoId === "escola" && evento.tipo === "ReplanejamentoConjuntoAplicado" && aviso.matriculaId
    ? await validarFonteReplanejamentoConjuntoTx(db, { eventoId: aviso.eventoId!, matriculaId: aviso.matriculaId, encontrosIds: aviso.itens.map((item) => item.encontroId) })
    : null;
  if (!(remarcacao || substituicao || replanejamento) || !aviso.matriculaId || !aviso.itens.length) return false;
  if (replanejamento) return replanejamento;
  const turmas = aviso.itens.flatMap((i) => i.encontro.turmaId ? [i.encontro.turmaId] : []);
  const alocacoes = substituicao && turmas.length ? await db.alocacaoTurma.findMany({ where: { matriculaId: aviso.matriculaId, turmaId: { in: turmas } }, select: { turmaId: true, criadoEm: true, encerradaEm: true } }) : [];
  return aviso.itens.every((item) => {
    const noEvento = substituicao ? payload.encontrosIds?.includes(item.encontroId) : [payload.encontroOriginalId, payload.encontroNovoId].includes(item.encontroId);
    const pertence = item.encontro.matriculaId === aviso.matriculaId || (substituicao && !!item.encontro.turmaId && alocacoes.some((a) => a.turmaId === item.encontro.turmaId && a.criadoEm <= item.encontro.inicio && (!a.encerradaEm || a.encerradaEm > item.encontro.inicio)));
    return !!noEvento && pertence;
  });
}

export function motivoConfiguracaoAgendaInvalida(config: ConfiguracaoAgenda | null, idioma: string) {
  const numero = config?.numeroAvisosAgenda;
  const template = config?.templateAvisosAgenda;
  if (!config?.numeroAvisosAgendaId || !config.templateAvisosAgendaId || !numero || !template) return "configuracao_agenda_ausente";
  if (!numero.ativo || numero.finalidade !== "AGENDA" || numero.driver !== "META_CLOUD" || !numero.providerRef?.trim()) return "numero_agenda_invalido";
  if (template.statusMeta !== "APROVADO" || !template.metaTemplateId || template.categoria !== "utility") return "template_agenda_incompativel";
  if (template.idioma !== idioma || !renderizarTemplateAgenda(template.corpo, { nome: "x", horarios: "x" })) return "template_agenda_incompativel";
  return null;
}

async function configuracaoAgenda(db: Prisma.TransactionClient | typeof prisma = prisma) {
  return db.configuracaoOperacional.findUnique({
    where: { id: "escola" },
    include: { numeroAvisosAgenda: true, templateAvisosAgenda: true },
  });
}

/** Cria/reabre a intenção sem enviar. Configuração ausente deixa o aviso PREPARADO. */
export async function enfileirarAvisoAgendaWhatsAppTx(tx: Prisma.TransactionClient, avisoId: string) {
  const aviso = await tx.avisoAlteracaoAgenda.findUnique({
    where: { id: avisoId },
    include: {
      aluno: { include: { pais: { select: { idioma: true } }, responsaveis: { where: { papel: "PEDAGOGICO" }, select: { responsavelId: true, responsavel: { select: { telefoneE164: true } } } } } }, evento: true,
      matricula: { select: { id: true, alunoId: true, status: true } },
      itens: { include: { encontro: true } },
      intencaoWhatsApp: true,
    },
  });
  const fonte = aviso && await fonteAvisoValida(tx, aviso);
  if (!aviso || aviso.canal !== "WHATSAPP" || aviso.situacao !== "PREPARADO" || !aviso.matricula || aviso.matricula.status !== "ATIVA" || !fonte) return "ignorado" as const;
  const destino = aviso.destinatarioResponsavelId
    ? await tx.autorizacaoComunicacaoAcademica.findFirst({ where: { id: aviso.autorizacaoComunicacaoAcademicaId ?? "", matriculaId: aviso.matriculaId!, responsavelId: aviso.destinatarioResponsavelId, vigenteEm: { lte: new Date() }, revogadaEm: null }, include: { responsavel: { select: { telefoneE164: true } } } }).then((a) => a?.responsavel.telefoneE164 ? { telefone: a.responsavel.telefoneE164, responsavelId: a.responsavelId } : null)
    : aviso.destinatarioAlunoId === aviso.alunoId && aviso.aluno.whatsapp && aviso.aluno.telefoneE164 ? { telefone: aviso.aluno.telefoneE164, responsavelId: null } : null;
  const telefone = destino?.telefone ?? null;
  const idioma = aviso.aluno.pais?.idioma ?? "es";
  const config = await configuracaoAgenda(tx);
  const motivoConfig = motivoConfiguracaoAgendaInvalida(config, idioma);
  if (motivoConfig || !aviso.aluno.aceitaComunicacoes || !telefone || !aviso.itens.length) return "pendente" as const;
  if (hashContato(telefone) !== aviso.contatoHash) return "pendente" as const;
  const horarios = horariosDoAviso(aviso, fonte);
  if (!horarios) return "pendente" as const;
  const renderizado = renderizarTemplateAgenda(config!.templateAvisosAgenda!.corpo, { nome: aviso.aluno.primeiroNome, horarios });
  if (!renderizado) return "pendente" as const;
  const contato = await garantirContato(tx, { telefoneE164: telefone, alunoId: destino!.responsavelId ? null : aviso.alunoId, responsavelId: destino!.responsavelId, nomeExibicao: aviso.aluno.primeiroNome });
  const atendimento = await garantirAtendimento(tx, {
    numeroId: config!.numeroAvisosAgendaId!, contatoId: contato.id, finalidade: "PEDAGOGICO", alunoId: aviso.alunoId, matriculaId: aviso.matriculaId,
  });
  const atual = await tx.atendimentoWhatsApp.findUnique({ where: { id: atendimento.id }, include: { conversa: { include: { contato: true } } } });
  if (!atual || atual.conversa.contato.telefoneE164 !== telefone || (destino!.responsavelId ? !await destinatarioAtualDoAtendimento(atual, tx) : atual.conversa.contato.alunoId !== aviso.alunoId)) return "pendente" as const;
  const existente = aviso.intencaoWhatsApp;
  if (existente?.status && existente.status !== "SIMULADA") return "ja_existente" as const;
  const dados = {
    numeroId: config!.numeroAvisosAgendaId!, contatoId: contato.id, atendimentoId: atendimento.id, origem: "CRON" as const,
    corpoRenderizado: renderizado.texto, variaveis: renderizado.variaveis, templateId: config!.templateAvisosAgendaId!,
    criadaEm: new Date(), despacharAposEm: null, motivoFalha: null,
  };
  if (existente) {
    await tx.intencaoMensagem.update({ where: { id: existente.id }, data: { ...dados, status: "PENDENTE" } });
    return "reaberta" as const;
  }
  await tx.intencaoMensagem.create({ data: { ...dados, avisoAlteracaoAgendaId: aviso.id } });
  return "criada" as const;
}

export async function enfileirarAvisosAgendaWhatsApp(limite = 20) {
  const avisos = await prisma.avisoAlteracaoAgenda.findMany({ where: { canal: "WHATSAPP", situacao: "PREPARADO" }, orderBy: { criadoEm: "asc" }, take: limite, select: { id: true } });
  let enfileirados = 0;
  for (const aviso of avisos) {
    const r = await prisma.$transaction(confirmarTransacao((tx) => enfileirarAvisoAgendaWhatsAppTx(tx, aviso.id)));
    if (r === "criada" || r === "reaberta") enfileirados += 1;
  }
  return enfileirados;
}

/** Releitura do estado atual após o claim, antes de tocar o driver. */
export async function motivoAvisoAgendaInvalido(it: { avisoAlteracaoAgendaId: string | null; numeroId: string; contatoId: string; templateId: string | null; atendimentoId: string | null; corpoRenderizado?: string; variaveis?: unknown }) {
  if (!it.avisoAlteracaoAgendaId) return null;
  const aviso = await prisma.avisoAlteracaoAgenda.findUnique({ where: { id: it.avisoAlteracaoAgendaId }, include: { evento: true, itens: { include: { encontro: true } }, aluno: { include: { pais: { select: { idioma: true } }, responsaveis: { where: { papel: "PEDAGOGICO" }, select: { responsavelId: true, responsavel: { select: { telefoneE164: true } } } } } }, matricula: true } });
  const fonte = aviso && await fonteAvisoValida(prisma, aviso);
  if (!aviso || aviso.canal !== "WHATSAPP" || !["PREPARADO", "INCERTO"].includes(aviso.situacao) || !aviso.matricula || aviso.matricula.status !== "ATIVA" || !aviso.aluno.aceitaComunicacoes || !fonte) return "aviso_agenda_alterado";
  const horarios = horariosDoAviso(aviso, fonte);
  const destino = aviso.destinatarioResponsavelId
    ? await prisma.autorizacaoComunicacaoAcademica.findFirst({ where: { id: aviso.autorizacaoComunicacaoAcademicaId ?? "", matriculaId: aviso.matriculaId!, responsavelId: aviso.destinatarioResponsavelId, vigenteEm: { lte: new Date() }, revogadaEm: null }, include: { responsavel: { select: { telefoneE164: true } } } }).then((a) => a?.responsavel.telefoneE164 ? { telefone: a.responsavel.telefoneE164, responsavelId: a.responsavelId } : null)
    : aviso.destinatarioAlunoId === aviso.alunoId && aviso.aluno.whatsapp && aviso.aluno.telefoneE164 ? { telefone: aviso.aluno.telefoneE164, responsavelId: null } : null;
  if (!destino || hashContato(destino.telefone) !== aviso.contatoHash || !horarios) return "aviso_agenda_alterado";
  if (aviso.destinatarioResponsavelId) {
    const autorizacao = aviso.autorizacaoComunicacaoAcademicaId
      ? await prisma.autorizacaoComunicacaoAcademica.findFirst({ where: { id: aviso.autorizacaoComunicacaoAcademicaId, matriculaId: aviso.matriculaId!, responsavelId: aviso.destinatarioResponsavelId, vigenteEm: { lte: new Date() }, revogadaEm: null }, include: { responsavel: { select: { telefoneE164: true } } } })
      : null;
    const vinculoAtual = await prisma.alunoResponsavel.findFirst({ where: { alunoId: aviso.alunoId, responsavelId: aviso.destinatarioResponsavelId, papel: "PEDAGOGICO" }, select: { id: true } });
    if (!autorizacao || !vinculoAtual || !autorizacao.responsavel.telefoneE164 || hashContato(autorizacao.responsavel.telefoneE164) !== aviso.contatoHash) return "autorizacao_academica_revogada";
  } else if (aviso.destinatarioAlunoId !== aviso.alunoId) return "destinatario_alterado";
  const config = await configuracaoAgenda();
  const motivo = motivoConfiguracaoAgendaInvalida(config, aviso.aluno.pais?.idioma ?? "es");
  if (motivo || config!.numeroAvisosAgendaId !== it.numeroId || config!.templateAvisosAgendaId !== it.templateId) return motivo ?? "configuracao_agenda_alterada";
  const renderizado = renderizarTemplateAgenda(config!.templateAvisosAgenda!.corpo, { nome: aviso.aluno.primeiroNome, horarios });
  if (!renderizado || renderizado.texto !== it.corpoRenderizado || JSON.stringify(renderizado.variaveis) !== JSON.stringify(it.variaveis ?? [])) return "template_agenda_alterado";
  const atendimento = it.atendimentoId ? await prisma.atendimentoWhatsApp.findUnique({ where: { id: it.atendimentoId }, include: { conversa: { include: { contato: true } } } }) : null;
  if (!atendimento || atendimento.conversa.contato.telefoneE164 !== destino.telefone || (aviso.destinatarioResponsavelId ? !await destinatarioAtualDoAtendimento(atendimento) : destino.responsavelId !== null)) return "destinatario_alterado";
  return null;
}

/** A evidência do resultado fica no aviso apenas quando o driver aceitou ou falhou após claim. */
export async function registrarResultadoAvisoAgendaTx(tx: Prisma.TransactionClient, avisoId: string, situacao: "ENVIADO" | "FALHOU", provedorId?: string | null) {
  const aviso = await tx.avisoAlteracaoAgenda.findUnique({ where: { id: avisoId }, select: { situacao: true } });
  if (!aviso || aviso.situacao !== "INCERTO") return;
  await tx.avisoAlteracaoAgenda.update({ where: { id: avisoId }, data: { situacao, tentativas: { create: { id: randomUUID(), situacao, provedorId: provedorId ?? null } } } });
}

/** Claim persistente antes do driver: a intenção e o aviso entram em voo juntos. */
export async function claimAvisoAgendaTx(tx: Prisma.TransactionClient, avisoId: string) {
  const claim = await tx.avisoAlteracaoAgenda.updateMany({ where: { id: avisoId, situacao: "PREPARADO" }, data: { situacao: "INCERTO" } });
  if (claim.count === 1) await tx.tentativaAvisoAlteracaoAgenda.create({ data: { id: randomUUID(), avisoId, situacao: "INCERTO" } });
  return claim.count === 1;
}
