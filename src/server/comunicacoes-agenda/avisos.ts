import { createHash, randomUUID } from "crypto";
import { MotivoPendenciaAvisoAgenda, Prisma, SituacaoAvisoAlteracaoAgenda } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enviarEmailResend } from "@/server/email/resend";
import { enfileirarAvisosAgendaWhatsApp } from "./whatsapp";
import { despacharFila } from "@/server/whatsapp/despachante";
import { renderizarHorariosReplanejamento, validarFonteReplanejamentoConjuntoTx } from "./fonte-replanejamento";
import { registrarPendenciaAvisoAgendaTx } from "./pendencias";
import { alocacaoCobreAula } from "@/server/diario/alocacoes";
import { validarFonteQuantidadeAulasTx } from "@/server/agenda/quantidade-fonte";
import { envioQuantidadeAulasHabilitado } from "./quantidade-gate";
import { PropostaAgendaAditivoSchema, hashPropostaAgendaAditivo } from "@/server/contratos/agenda-aditivo-schema";
import { formatarIntervaloAvisoAgenda } from "./formato-horario";

const hashContato = (valor: string) => createHash("sha256").update(valor).digest("hex");
type Canal = "EMAIL" | "WHATSAPP";
type AlocacaoAviso = { turmaId: string; criadoEm: Date; encerradaEm: Date | null; ativa: boolean; provenienciaVinculo: "MIGRACAO" | null; inicioVigencia: Date | null; fimVigencia: Date | null };
export const alocacaoDaMatriculaCobreEncontro = (alocacao: AlocacaoAviso, turmaId: string | null, inicio: Date) => turmaId !== null && alocacao.turmaId === turmaId && alocacaoCobreAula(alocacao, inicio);

const FonteAditivoAgendaSchema = z.object({ propostaId: z.string().min(1), aplicacaoId: z.string().min(1), propostaAgendaId: z.string().min(1), aplicacaoAgendaId: z.string().min(1), versao: z.number().int().positive(), condicoesHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export async function validarFonteAditivoAgendaTx(tx: Prisma.TransactionClient | typeof prisma, entrada: { eventoId: string; matriculaId: string; encontrosIds: string[] }) {
  const evento = await tx.evento.findFirst({ where: { id: entrada.eventoId, tipo: "CondicoesAditivoAplicadas", agregadoTipo: "Matricula", agregadoId: entrada.matriculaId }, select: { autorId: true, payload: true } });
  if (!evento?.autorId) return null;
  const payload = FonteAditivoAgendaSchema.safeParse(evento.payload); if (!payload.success) return null;
  const aplicacao = await tx.aplicacaoAgendaAditivoParticular.findFirst({ where: { id: payload.data.aplicacaoAgendaId, eventoId: entrada.eventoId, matriculaId: entrada.matriculaId, aplicadorId: evento.autorId, aplicacaoCondicoesId: payload.data.aplicacaoId, propostaId: payload.data.propostaAgendaId }, include: { proposta: { select: { fotografia: true, fotografiaHash: true } }, aplicacaoCondicoes: { select: { propostaId: true, matriculaId: true, condicoesHash: true, versaoCondicoes: { select: { versao: true, condicoesHash: true } } } } } });
  if (!aplicacao || aplicacao.aplicacaoCondicoes.matriculaId !== entrada.matriculaId || aplicacao.aplicacaoCondicoes.propostaId !== payload.data.propostaId || aplicacao.aplicacaoCondicoes.condicoesHash !== payload.data.condicoesHash || aplicacao.aplicacaoCondicoes.versaoCondicoes.condicoesHash !== payload.data.condicoesHash || aplicacao.aplicacaoCondicoes.versaoCondicoes.versao !== payload.data.versao) return null;
  const fotografia = PropostaAgendaAditivoSchema.safeParse(aplicacao.proposta.fotografia);
  if (!fotografia.success || hashPropostaAgendaAditivo(fotografia.data) !== aplicacao.proposta.fotografiaHash || aplicacao.fotografiaHash !== aplicacao.proposta.fotografiaHash) return null;
  const ids = [...new Set(entrada.encontrosIds)].sort(), fotografados = fotografia.data.encontros.slice().sort((a, b) => a.encontroId.localeCompare(b.encontroId));
  if (ids.length !== entrada.encontrosIds.length || ids.length !== fotografados.length || ids.some((id, i) => id !== fotografados[i]?.encontroId)) return null;
  const atuais = await tx.encontroAgenda.findMany({ where: { id: { in: ids }, matriculaId: entrada.matriculaId }, select: { id: true, professorId: true, inicio: true, fim: true, fusoOrigem: true } });
  if (atuais.length !== fotografados.length) return null;
  return atuais.every(atual => { const esperado = fotografados.find(f => f.encontroId === atual.id); return !!esperado && atual.professorId === esperado.professorNovoId && atual.inicio.getTime() === new Date(esperado.inicioNovo).getTime() && atual.fim.getTime() === new Date(esperado.fimNovo).getTime() && atual.fusoOrigem === esperado.fusoNovo; }) ? { id: aplicacao.id } : null;
}

/** Cria avisos para a matrícula afetada, na transação da alteração aplicada. */
export async function criarAvisosAlteracaoAgendaTx(tx: Prisma.TransactionClient, entrada: { eventoId: string; matriculaId: string; encontrosIds: string[] }) {
  const evento = await tx.evento.findUnique({ where: { id: entrada.eventoId }, select: { agregadoTipo: true, agregadoId: true, tipo: true, payload: true } });
  const remarcacao = evento?.agregadoTipo === "Matricula" && evento.agregadoId === entrada.matriculaId && ["RemarcacaoParticularDecidida", "RemarcacaoAgendaReposicaoDecidida"].includes(evento.tipo);
  const substituicao = evento?.agregadoTipo === "ConfiguracaoOperacional" && evento.agregadoId === "escola" && evento.tipo === "SubstituicaoDocenteDecidida" && (evento.payload as { aprovada?: unknown }).aprovada === true;
  const aditivoAgenda = evento?.agregadoTipo === "Matricula" && evento.agregadoId === entrada.matriculaId && evento.tipo === "CondicoesAditivoAplicadas" ? await validarFonteAditivoAgendaTx(tx, entrada) : null;
  const quantidade = evento?.agregadoTipo === "Modalidade" && evento.tipo === "QuantidadeAulasModalidadeAplicada";
  const fonteQuantidade = quantidade ? await validarFonteQuantidadeAulasTx(tx, { eventoId: entrada.eventoId, encontrosIds: entrada.encontrosIds }) : null;
  const replanejamento = evento?.agregadoTipo === "ConfiguracaoOperacional" && evento.agregadoId === "escola" && evento.tipo === "ReplanejamentoConjuntoAplicado"
    ? await validarFonteReplanejamentoConjuntoTx(tx, entrada)
    : null;
  if (!remarcacao && !substituicao && !aditivoAgenda && !replanejamento && !fonteQuantidade) throw new Error("Evento aplicado incompatível com o aviso.");
  const matricula = await tx.matricula.findUnique({ where: { id: entrada.matriculaId }, select: { id: true, alunoId: true, autorizacoesComunicacaoAcademica: { where: { vigenteEm: { lte: new Date() }, revogadaEm: null }, select: { id: true, responsavelId: true, responsavel: { select: { telefoneE164: true, alunos: { where: { papel: "PEDAGOGICO" }, select: { alunoId: true } } } } } }, aluno: { select: { email: true, telefoneE164: true, whatsapp: true, aceitaComunicacoes: true } } } });
  if (!matricula) return [];
  const encontrosIds = [...new Set(entrada.encontrosIds)];
  const encontros = await tx.encontroAgenda.findMany({ where: { id: { in: encontrosIds } }, select: { id: true, matriculaId: true, turmaId: true, inicio: true } });
  const turmasIds = encontros.flatMap((encontro) => encontro.turmaId ? [encontro.turmaId] : []);
  const alocacoes = (substituicao || fonteQuantidade) && turmasIds.length ? await tx.alocacaoTurma.findMany({
    where: { matriculaId: matricula.id, turmaId: { in: turmasIds } },
    select: { turmaId: true, criadoEm: true, encerradaEm: true, ativa: true, provenienciaVinculo: true, inicioVigencia: true, fimVigencia: true },
  }) : [];
  const pertenceAMatricula = (encontro: typeof encontros[number]) => fonteQuantidade ? !!encontro.turmaId && fonteQuantidade.porTurma.get(encontro.turmaId)?.has(encontro.id) && alocacoes.some((alocacao) => [...(fonteQuantidade.instantes.get(encontro.id) ?? []), encontro.inicio].some((inicio) => alocacaoDaMatriculaCobreEncontro(alocacao, encontro.turmaId, inicio))) : !!replanejamento?.horarios.some((horario) => horario.encontroId === encontro.id) || encontro.matriculaId === matricula.id || (substituicao && !!encontro.turmaId && alocacoes.some((alocacao) =>
    alocacaoDaMatriculaCobreEncontro(alocacao, encontro.turmaId, encontro.inicio),
  ));
  if (!encontrosIds.length || encontros.length !== encontrosIds.length || encontros.some((encontro) => !pertenceAMatricula(encontro))) throw new Error("Encontros da alteração não pertencem à matrícula.");
  const canais: { canal: Canal; contato: string; destinatarioAlunoId?: string; destinatarioResponsavelId?: string; autorizacaoComunicacaoAcademicaId?: string }[] = [];
  const haIdentidadeAcademica = !!matricula.aluno.email || (matricula.aluno.whatsapp && !!matricula.aluno.telefoneE164) || matricula.autorizacoesComunicacaoAcademica.some((autorizacao) =>
    !!autorizacao.responsavel.telefoneE164 && autorizacao.responsavel.alunos.some((vinculo) => vinculo.alunoId === matricula.alunoId),
  );
  if (!matricula.aluno.aceitaComunicacoes) {
    await registrarPendenciaAvisoAgendaTx(tx, {
      eventoId: entrada.eventoId, matriculaId: matricula.id,
      motivo: haIdentidadeAcademica ? MotivoPendenciaAvisoAgenda.CONTATO_SEM_OPT_IN : MotivoPendenciaAvisoAgenda.SEM_DESTINATARIO_AUTORIZADO,
    });
    return [];
  }
  if (matricula.aluno.email) canais.push({ canal: "EMAIL", contato: matricula.aluno.email.trim().toLowerCase(), destinatarioAlunoId: matricula.alunoId });
  // Responsável financeiro não é destinatário acadêmico. O aluno opt-in e cada
  // responsável pedagógico com autorização vigente podem coexistir como destinos.
  if (matricula.aluno.whatsapp && matricula.aluno.telefoneE164) canais.push({ canal: "WHATSAPP", contato: matricula.aluno.telefoneE164, destinatarioAlunoId: matricula.alunoId });
  for (const autorizacao of matricula.autorizacoesComunicacaoAcademica) if (autorizacao.responsavel.telefoneE164 && autorizacao.responsavel.alunos.some((vinculo) => vinculo.alunoId === matricula.alunoId)) canais.push({ canal: "WHATSAPP", contato: autorizacao.responsavel.telefoneE164, destinatarioResponsavelId: autorizacao.responsavelId, autorizacaoComunicacaoAcademicaId: autorizacao.id });
  if (!canais.length) {
    await registrarPendenciaAvisoAgendaTx(tx, { eventoId: entrada.eventoId, matriculaId: matricula.id, motivo: MotivoPendenciaAvisoAgenda.SEM_DESTINATARIO_AUTORIZADO });
    return [];
  }
  if (fonteQuantidade && !envioQuantidadeAulasHabilitado()) await registrarPendenciaAvisoAgendaTx(tx, { eventoId: entrada.eventoId, matriculaId: matricula.id, motivo: MotivoPendenciaAvisoAgenda.CONFIGURACAO_INDISPONIVEL });
  const avisos = [];
  for (const { canal, contato, destinatarioAlunoId, destinatarioResponsavelId, autorizacaoComunicacaoAcademicaId } of canais) {
    // Email preserva a chave histórica, inclusive se o endereço atual mudou;
    // WhatsApp pode ter vários destinatários autorizados e inclui o hash.
    const chave = canal === "EMAIL"
      ? `agenda:${entrada.eventoId}:${matricula.id}:${canal}`
      : `agenda:${entrada.eventoId}:${matricula.id}:${canal}:${hashContato(contato)}`;
    const existente = canal === "EMAIL"
      ? await tx.avisoAlteracaoAgenda.findFirst({ where: { eventoId: entrada.eventoId, matriculaId: matricula.id, canal } })
      : await tx.avisoAlteracaoAgenda.findUnique({ where: { chave } });
    if (existente) {
      await tx.itemAvisoAlteracaoAgenda.createMany({ data: encontros.map(({ id }) => ({ id: randomUUID(), avisoId: existente.id, encontroId: id })), skipDuplicates: true });
      avisos.push(existente); continue;
    }
    avisos.push(await tx.avisoAlteracaoAgenda.create({ data: { id: randomUUID(), mudancaId: entrada.eventoId, eventoId: entrada.eventoId, matriculaId: matricula.id, alunoId: matricula.alunoId, canal, contatoHash: hashContato(contato), chave, destinatarioAlunoId, destinatarioResponsavelId, autorizacaoComunicacaoAcademicaId, itens: { createMany: { data: encontros.map(({ id }) => ({ id: randomUUID(), encontroId: id })) } } } }));
  }
  return avisos;
}

export type EntregarAvisoAgenda = (entrada: { canal: Canal; destinatario: string; avisoId: string; encontrosIds: string[] }) => Promise<{ situacao: "ACEITO"; provedorId: string } | { situacao: "RECUSADO" | "INCERTO" }>;

/** Executa apenas o transporte injetado; o processamento automático fica desligado por padrão. */
export async function despacharAvisoAlteracaoAgendaInterna(id: string, entregar: EntregarAvisoAgenda) {
  const preparado = await prisma.$transaction(async tx => {
    const aviso = await tx.avisoAlteracaoAgenda.findUnique({ where: { id }, include: { aluno: true, matricula: true, evento: true, itens: { include: { encontro: true } } } });
    if (!aviso || aviso.situacao !== SituacaoAvisoAlteracaoAgenda.PREPARADO) return null;
    const contato = aviso.canal === "EMAIL" ? aviso.aluno.email?.trim().toLowerCase() : (aviso.aluno.whatsapp ? aviso.aluno.telefoneE164 : null);
    const fonteRemarcacao = aviso.evento?.agregadoTipo === "Matricula" && aviso.evento.agregadoId === aviso.matriculaId && ["RemarcacaoParticularDecidida", "RemarcacaoAgendaReposicaoDecidida"].includes(aviso.evento?.tipo ?? "");
    const fonteSubstituicao = aviso.evento?.agregadoTipo === "ConfiguracaoOperacional" && aviso.evento.agregadoId === "escola" && aviso.evento.tipo === "SubstituicaoDocenteDecidida" && (aviso.evento.payload as { aprovada?: unknown }).aprovada === true;
    const fonteAditivoAgenda = aviso.evento?.agregadoTipo === "Matricula" && aviso.evento.agregadoId === aviso.matriculaId && aviso.evento.tipo === "CondicoesAditivoAplicadas" && aviso.matriculaId
      ? await validarFonteAditivoAgendaTx(tx, { eventoId: aviso.eventoId!, matriculaId: aviso.matriculaId, encontrosIds: aviso.itens.map(item => item.encontroId) })
      : null;
    const fonteReplanejamento = aviso.evento?.agregadoTipo === "ConfiguracaoOperacional" && aviso.evento.agregadoId === "escola" && aviso.evento.tipo === "ReplanejamentoConjuntoAplicado" && aviso.matriculaId
      ? await validarFonteReplanejamentoConjuntoTx(tx, { eventoId: aviso.eventoId!, matriculaId: aviso.matriculaId, encontrosIds: aviso.itens.map((item) => item.encontroId) })
      : null;
    const fonteQuantidade = aviso.evento?.agregadoTipo === "Modalidade" && aviso.evento.tipo === "QuantidadeAulasModalidadeAplicada" ? await validarFonteQuantidadeAulasTx(tx, { eventoId: aviso.eventoId!, encontrosIds: aviso.itens.map((item) => item.encontroId) }) : null;
    const turmasIds = aviso.itens.flatMap((item) => item.encontro.turmaId ? [item.encontro.turmaId] : []);
    const alocacoes = (fonteSubstituicao || fonteQuantidade) && aviso.matriculaId && turmasIds.length ? await tx.alocacaoTurma.findMany({
      where: { matriculaId: aviso.matriculaId, turmaId: { in: turmasIds } },
      select: { turmaId: true, criadoEm: true, encerradaEm: true, ativa: true, provenienciaVinculo: true, inicioVigencia: true, fimVigencia: true },
    }) : [];
    const pertenceAMatricula = (item: typeof aviso.itens[number]) => item.encontro.matriculaId === aviso.matriculaId || (fonteSubstituicao && !!item.encontro.turmaId && alocacoes.some((alocacao) =>
      alocacaoDaMatriculaCobreEncontro(alocacao, item.encontro.turmaId, item.encontro.inicio),
    ));
    const fonteValida = (fonteRemarcacao || fonteSubstituicao || !!fonteAditivoAgenda || fonteReplanejamento || fonteQuantidade) && aviso.matricula?.status === "ATIVA" && aviso.itens.length > 0 && (fonteReplanejamento ? true : aviso.itens.every((item) => fonteQuantidade ? !!item.encontro.turmaId && fonteQuantidade.porTurma.get(item.encontro.turmaId)?.has(item.encontroId) && alocacoes.some((alocacao) => [...(fonteQuantidade.instantes.get(item.encontroId) ?? []), item.encontro.inicio].some((inicio) => alocacaoDaMatriculaCobreEncontro(alocacao, item.encontro.turmaId, inicio))) : pertenceAMatricula(item)));
    if (fonteQuantidade && !envioQuantidadeAulasHabilitado()) { await registrarPendenciaAvisoAgendaTx(tx, { eventoId: aviso.eventoId!, matriculaId: aviso.matriculaId!, motivo: MotivoPendenciaAvisoAgenda.CONFIGURACAO_INDISPONIVEL }); return null; }
    if (!fonteValida || !aviso.aluno.aceitaComunicacoes || !contato || hashContato(contato) !== aviso.contatoHash) {
      await tx.avisoAlteracaoAgenda.update({ where: { id }, data: { situacao: "FALHOU", tentativas: { create: { id: randomUUID(), situacao: "FALHOU" } } } }); return null;
    }
    const claim = await tx.avisoAlteracaoAgenda.updateMany({ where: { id, situacao: "PREPARADO" }, data: { situacao: "INCERTO" } });
    if (claim.count !== 1) return null;
    await tx.tentativaAvisoAlteracaoAgenda.create({ data: { id: randomUUID(), avisoId: aviso.id, situacao: "INCERTO" } });
    return { canal: aviso.canal as Canal, destinatario: contato, avisoId: aviso.id, encontrosIds: aviso.itens.map(item => item.encontroId) };
  });
  if (!preparado) return { enviado: false as const };
  try {
    const recibo = await entregar(preparado);
    if (recibo.situacao === "RECUSADO") {
      await prisma.$transaction(tx => tx.avisoAlteracaoAgenda.update({ where: { id }, data: { situacao: "FALHOU", tentativas: { create: { id: randomUUID(), situacao: "FALHOU" } } } }));
      return { enviado: false as const, recusado: true as const };
    }
    if (recibo.situacao !== "ACEITO") return { enviado: false as const, incerto: true as const };
    await prisma.$transaction(tx => tx.avisoAlteracaoAgenda.update({ where: { id }, data: { situacao: "ENVIADO", tentativas: { create: { id: randomUUID(), situacao: "ENVIADO", provedorId: recibo.provedorId } } } }));
    return { enviado: true as const };
  } catch { return { enviado: false as const, incerto: true as const }; }
}

export async function processarAvisosAlteracaoAgenda(entregar: EntregarAvisoAgenda) {
  if (process.env.COMUNICACOES_AGENDA_ENVIO_ENABLED !== "true") return 0;
  // Configuração ausente é pendência anterior ao envio: não faz claim, tentativa
  // nem transforma o aviso em INCERTO.
  let processados = 0;
  // WhatsApp só entra no worker quando houver finalidade institucional explícita
  // para avisos de agenda; não reutiliza números de vendas ou cobrança.
  if (process.env.RESEND_API_KEY?.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.EMAIL_INSTITUCIONAL_REMETENTE?.trim() ?? "")) {
    const avisos = await prisma.avisoAlteracaoAgenda.findMany({ where: { situacao: "PREPARADO", canal: "EMAIL" }, take: 20, select: { id: true } });
    for (const aviso of avisos) await despacharAvisoAlteracaoAgendaInterna(aviso.id, entregar);
    processados += avisos.length;
  }
  const enfileirados = await enfileirarAvisosAgendaWhatsApp();
  // Também escoa itens já enfileirados, sem tocar as filas financeira/comercial.
  await despacharFila(new Date(), { somenteAvisosAgenda: true });
  return processados + enfileirados;
}

export async function entregarAvisoAlteracaoAgenda(entrada: { canal: Canal; destinatario: string; avisoId: string; encontrosIds: string[] }) {
  const aviso = await prisma.avisoAlteracaoAgenda.findUnique({ where: { id: entrada.avisoId }, include: { evento: true, aluno: true, matricula: { select: { codigo: true, status: true } }, itens: { include: { encontro: true } } } });
  const destinatarioAtual = aviso?.canal === "EMAIL" ? aviso.aluno.email?.trim().toLowerCase() : (aviso?.aluno.whatsapp ? aviso.aluno.telefoneE164 : null);
  if (!aviso?.evento || aviso.canal !== entrada.canal || !aviso.matriculaId || !aviso.matricula || !aviso.aluno.aceitaComunicacoes || !destinatarioAtual || entrada.destinatario !== destinatarioAtual || hashContato(destinatarioAtual) !== aviso.contatoHash) return { situacao: "RECUSADO" as const };
  const payload = aviso.evento.payload as { aprovada?: unknown; encontroOriginalId?: string; encontroNovoId?: string; encontrosIds?: string[] };
  const fonteQuantidade = aviso.evento.agregadoTipo === "Modalidade" && aviso.evento.tipo === "QuantidadeAulasModalidadeAplicada" ? await prisma.$transaction(tx => validarFonteQuantidadeAulasTx(tx, { eventoId: aviso.eventoId!, encontrosIds: aviso.itens.map((item) => item.encontroId) })) : null;
  const fonteAditivoAgenda = aviso.evento.agregadoTipo === "Matricula" && aviso.evento.agregadoId === aviso.matriculaId && aviso.evento.tipo === "CondicoesAditivoAplicadas"
    ? await prisma.$transaction(tx => validarFonteAditivoAgendaTx(tx, { eventoId: aviso.eventoId!, matriculaId: aviso.matriculaId!, encontrosIds: aviso.itens.map(item => item.encontroId) })) : null;
  if (fonteQuantidade && !envioQuantidadeAulasHabilitado()) return { situacao: "RECUSADO" as const };
  const fonteRemarcacao = aviso.evento.agregadoTipo === "Matricula" && aviso.evento.agregadoId === aviso.matriculaId && ["RemarcacaoParticularDecidida", "RemarcacaoAgendaReposicaoDecidida"].includes(aviso.evento.tipo) && payload.aprovada === true;
  const fonteSubstituicao = aviso.evento.agregadoTipo === "ConfiguracaoOperacional" && aviso.evento.agregadoId === "escola" && aviso.evento.tipo === "SubstituicaoDocenteDecidida" && payload.aprovada === true;
  const fonteReplanejamento = aviso.evento.agregadoTipo === "ConfiguracaoOperacional" && aviso.evento.agregadoId === "escola" && aviso.evento.tipo === "ReplanejamentoConjuntoAplicado"
    ? await prisma.$transaction(tx => validarFonteReplanejamentoConjuntoTx(tx, { eventoId: aviso.eventoId!, matriculaId: aviso.matriculaId!, encontrosIds: aviso.itens.map((item) => item.encontroId) }))
    : null;
  const itensIds = new Set(aviso.itens.map((item) => item.encontroId));
  if (!entrada.encontrosIds.every((id) => itensIds.has(id)) || aviso.matricula.status !== "ATIVA" || !aviso.itens.length) return { situacao: "RECUSADO" as const };
  const turmasIds = aviso.itens.flatMap((item) => item.encontro.turmaId ? [item.encontro.turmaId] : []);
  const alocacoes = (fonteSubstituicao || fonteQuantidade) && turmasIds.length ? await prisma.alocacaoTurma.findMany({
    where: { matriculaId: aviso.matriculaId, turmaId: { in: turmasIds } }, select: { turmaId: true, criadoEm: true, encerradaEm: true, ativa: true, provenienciaVinculo: true, inicioVigencia: true, fimVigencia: true },
  }) : [];
  const itemValido = (item: typeof aviso.itens[number]) => {
    const noEvento = fonteAditivoAgenda ? true : fonteSubstituicao ? payload.encontrosIds?.includes(item.encontroId) : [payload.encontroOriginalId, payload.encontroNovoId].includes(item.encontroId);
    const pertenceAMatricula = item.encontro.matriculaId === aviso.matriculaId || (fonteSubstituicao && !!item.encontro.turmaId && alocacoes.some((alocacao) =>
      alocacaoDaMatriculaCobreEncontro(alocacao, item.encontro.turmaId, item.encontro.inicio),
    ));
    return !!noEvento && pertenceAMatricula;
  };
  if (!(fonteRemarcacao || fonteSubstituicao || fonteAditivoAgenda || fonteReplanejamento || fonteQuantidade) || (!fonteReplanejamento && !aviso.itens.every((item) => fonteQuantidade ? !!item.encontro.turmaId && fonteQuantidade.porTurma.get(item.encontro.turmaId)?.has(item.encontroId) && alocacoes.some((alocacao) => [...(fonteQuantidade.instantes.get(item.encontroId) ?? []), item.encontro.inicio].some((inicio) => alocacaoDaMatriculaCobreEncontro(alocacao, item.encontro.turmaId, inicio))) : itemValido(item)))) return { situacao: "RECUSADO" as const };
  const encontrosDoAviso = aviso.itens.map((item) => item.encontro);
  if (fonteReplanejamento) {
    const horarios = renderizarHorariosReplanejamento(fonteReplanejamento.horarios);
    if (!horarios || entrada.canal !== "EMAIL") return { situacao: "RECUSADO" as const };
    const resultado = await enviarEmailResend({ destinatario: entrada.destinatario, assunto: "Alteração na agenda", texto: `A agenda da matrícula ${aviso.matricula.codigo} foi alterada: ${horarios}. Consulte a Secretaria em caso de dúvida.`, chaveIdempotencia: `agenda:${entrada.avisoId}` });
    return resultado.situacao === "ACEITO" ? { situacao: "ACEITO" as const, provedorId: resultado.provedorId } : { situacao: resultado.situacao };
  }
  if (aviso.evento.tipo === "SubstituicaoDocenteDecidida") {
    const horarios = encontrosDoAviso.map(e => `${e.inicio.toLocaleString("pt-BR", { timeZone: e.fusoOrigem })}–${e.fim.toLocaleTimeString("pt-BR", { timeZone: e.fusoOrigem })} (${e.fusoOrigem})`).join("; ");
    const texto = `O docente da sua aula foi alterado. Horários afetados: ${horarios}. Consulte a Secretaria em caso de dúvida.`;
    if (entrada.canal !== "EMAIL") return { situacao: "RECUSADO" as const };
    const resultado = await enviarEmailResend({ destinatario: entrada.destinatario, assunto: "Alteração de docente", texto, chaveIdempotencia: `agenda:${entrada.avisoId}` });
    return resultado.situacao === "ACEITO" ? { situacao: "ACEITO" as const, provedorId: resultado.provedorId } : { situacao: resultado.situacao };
  }
  if (fonteQuantidade) {
    const horarios = encontrosDoAviso.map(e => formatarIntervaloAvisoAgenda(e.inicio, e.fim, e.fusoOrigem)).join("; ");
    const acao = (aviso.evento.payload as { quantidadeAnterior?: number; quantidadeNova?: number }).quantidadeNova! > (aviso.evento.payload as { quantidadeAnterior?: number; quantidadeNova?: number }).quantidadeAnterior! ? "incluídas ou alteradas" : "removidas ou alteradas";
    const resultado = await enviarEmailResend({ destinatario: entrada.destinatario, assunto: "Alteração na quantidade de aulas", texto: `A quantidade de aulas da sua turma foi alterada. Aulas ${acao}: ${horarios}. Consulte a Secretaria em caso de dúvida.`, chaveIdempotencia: `agenda:${entrada.avisoId}` });
    return resultado.situacao === "ACEITO" ? { situacao: "ACEITO" as const, provedorId: resultado.provedorId } : { situacao: resultado.situacao };
  }
  if (fonteAditivoAgenda) {
    const horarios = encontrosDoAviso.map(e => `${e.inicio.toLocaleString("pt-BR", { timeZone: e.fusoOrigem })}–${e.fim.toLocaleTimeString("pt-BR", { timeZone: e.fusoOrigem })} (${e.fusoOrigem})`).join("; ");
    if (entrada.canal !== "EMAIL") return { situacao: "RECUSADO" as const };
    const resultado = await enviarEmailResend({ destinatario: entrada.destinatario, assunto: "Alteração na agenda", texto: `A agenda da matrícula ${aviso.matricula.codigo} foi alterada: ${horarios}. Consulte a Secretaria em caso de dúvida.`, chaveIdempotencia: `agenda:${entrada.avisoId}` });
    return resultado.situacao === "ACEITO" ? { situacao: "ACEITO" as const, provedorId: resultado.provedorId } : { situacao: resultado.situacao };
  }
  const linhas = encontrosDoAviso;
  const horario = (id?: string) => { const e = linhas.find(x => x.id === id); return e ? `${e.inicio.toLocaleString("pt-BR", { timeZone: e.fusoOrigem })}–${e.fim.toLocaleTimeString("pt-BR", { timeZone: e.fusoOrigem })} (${e.fusoOrigem})` : null; };
  const anterior = horario(payload.encontroOriginalId), novo = horario(payload.encontroNovoId);
  if (!anterior || !novo) return { situacao: "RECUSADO" as const };
  const texto = `A agenda da matrícula ${aviso.matricula?.codigo ?? ""} foi alterada: ${anterior} para ${novo}. Consulte a Secretaria em caso de dúvida.`;
  if (entrada.canal === "EMAIL") {
    const resultado = await enviarEmailResend({ destinatario: entrada.destinatario, assunto: "Alteração na agenda", texto, chaveIdempotencia: `agenda:${entrada.avisoId}` });
    return resultado.situacao === "ACEITO" ? { situacao: "ACEITO" as const, provedorId: resultado.provedorId } : { situacao: resultado.situacao };
  }
  return { situacao: "RECUSADO" as const };
}
