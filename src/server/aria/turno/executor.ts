import { EtapaLead, Prisma, type AcaoAgenteIA } from "@prisma/client";
import { exigirAgendamentoNaJanela, recusaForaDaJanela } from "@/server/whatsapp/janela-agendamento";
import { registrarEvento } from "@/server/_shared/evento";
import { transicaoManualPermitida } from "@/server/_shared/regras";
import { ErroRegra } from "@/server/_shared/sessao";
import { validarValorCampo } from "@/server/crm/campos";
import { respostasParaAria } from "@/server/crm-config/respostas-rapidas";
import { carregarFusoInstitucionalTx } from "@/server/operacao/relogio";
import { payloadDaAria } from "../ator";
import { configPadrao, type ConfigAria, type ModoAcao } from "../config-schema";
import { versaoPublicada } from "../versoes";
import { APRESENTACAO, montarContextoTurno, type ContextoTurno } from "./contexto";
import { avaliarDesconto, solicitarAprovacaoDesconto } from "./desconto";
import { precosDaOportunidade } from "./precos";
import type { AcaoProposta, SaidaModelo } from "./tipos";
import { valoresCitados, valoresNaoAutorizados, type ValoresPermitidos } from "./valores";

type Tx = Prisma.TransactionClient;

export type BloqueioResposta = "VALOR_NAO_AUTORIZADO" | "PAUSADA_DURANTE_TURNO" | "DOCUMENTO_NAO_ENVIAVEL";

export interface EntradaResposta {
  turnoId: string;
  ctx: ContextoTurno;
  texto: string;
  documentoId: string | null;
  destino: "EXECUTAR" | "SUGERIR";
  simulado: boolean;
  confianca: number;
  fontes: SaidaModelo["fontes"];
  nomeAria: string;
  /** Política publicada; sem ela vale o padrão da configuração. */
  politicas?: ConfigAria["politicas"];
}

export const POLITICAS_PADRAO: ConfigAria["politicas"] = {
  MATRICULA: { descontoSemAprovacaoPct: 10, descontoComAprovacaoPct: 20 },
  MENSALIDADE: { descontoSemAprovacaoPct: 10, descontoComAprovacaoPct: 20 },
  parcelasMax: 10,
  validadePropostaDias: 7,
};

/**
 * O que as respostas rápidas liberadas autorizam na guarda de valores. Decisão provisória (C1 da R1 do
 * #238): só os valores monetários. A guarda compara só o número, sem contexto ("multa de 2%" liberaria
 * "2% de desconto"), e quem salva resposta inclui o Gerente Comercial, que passaria de `parcelasMax`.
 * Percentuais e parcelas vêm só da política da Aria. Para liberar também essas categorias, acrescente
 * "percentuais" e/ou "parcelas" aqui.
 */
export const CATEGORIAS_DAS_RESPOSTAS: readonly (keyof ValoresPermitidos)[] = ["valores"];

/**
 * Lista da guarda de valores: preços do país, faixas de desconto e parcelas da política e, além deles,
 * as categorias de `CATEGORIAS_DAS_RESPOSTAS` citadas nas respostas rápidas liberadas para o setor
 * (texto aprovado pela equipe; ver contexto.ts).
 */
export function permitidos(ctx: Pick<ContextoTurno, "precos" | "respostasRapidas">, politicas: ConfigAria["politicas"]): ValoresPermitidos {
  const citados = ctx.respostasRapidas.map((r) => valoresCitados(r.corpo));
  const dasRespostas = (c: keyof ValoresPermitidos) => (CATEGORIAS_DAS_RESPOSTAS.includes(c) ? citados.flatMap((v) => v[c]) : []);
  return {
    valores: [...ctx.precos.map((p) => p.valor), ...dasRespostas("valores")],
    percentuais: [
      politicas.MATRICULA.descontoSemAprovacaoPct,
      politicas.MATRICULA.descontoComAprovacaoPct,
      politicas.MENSALIDADE.descontoSemAprovacaoPct,
      politicas.MENSALIDADE.descontoComAprovacaoPct,
      ...dasRespostas("percentuais"),
    ],
    parcelas: [...Array.from({ length: politicas.parcelasMax }, (_, i) => i + 1), ...dasRespostas("parcelas")],
  };
}

/** URL interna do documento da base se ele ainda pode ser enviado ao lead; senão null. */
async function urlDocumentoEnviavel(tx: Tx, documentoId: string): Promise<string | null> {
  const fonte = await tx.fonteConhecimento.findUnique({
    where: { id: documentoId },
    select: {
      tipo: true,
      status: true,
      enviavelAoLead: true,
      arquivadaEm: true,
      validoAte: true,
      registroUpload: { select: { url: true } },
    },
  });
  const url = fonte?.registroUpload?.url ?? null;
  const enviavel =
    !!fonte &&
    fonte.tipo === "ARQUIVO" &&
    fonte.status === "PRONTA" &&
    fonte.enviavelAoLead &&
    !fonte.arquivadaEm &&
    (!fonte.validoAte || fonte.validoAte.getTime() > Date.now()) &&
    !!url &&
    url.startsWith("/api/files/");
  return enviavel ? url : null;
}

/** Responde (ou sugere resposta) como IntencaoMensagem reativa de origem IA, dentro da transação recebida. */
export async function executarResposta(tx: Tx, i: EntradaResposta): Promise<{ acao: AcaoAgenteIA } | { bloqueada: BloqueioResposta }> {
  // Corrida com humano: trava o atendimento e relê a pausa já com o bloqueio.
  await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id = ${i.ctx.atendimentoId} FOR UPDATE`;
  const at = await tx.atendimentoWhatsApp.findUniqueOrThrow({
    where: { id: i.ctx.atendimentoId },
    select: { iaPausadaEm: true },
  });
  if (at.iaPausadaEm) return { bloqueada: "PAUSADA_DURANTE_TURNO" };

  if (valoresNaoAutorizados(i.texto, permitidos(i.ctx, i.politicas ?? POLITICAS_PADRAO)).length > 0) {
    return { bloqueada: "VALOR_NAO_AUTORIZADO" };
  }

  let midiaPath: string | null = null;
  if (i.documentoId) {
    midiaPath = await urlDocumentoEnviavel(tx, i.documentoId);
    if (!midiaPath) return { bloqueada: "DOCUMENTO_NAO_ENVIAVEL" };
  }

  const corpo = i.ctx.primeiraDaAria ? `${APRESENTACAO(i.nomeAria)} ${i.texto}` : i.texto;
  const executa = i.destino === "EXECUTAR";
  const status = i.simulado ? "SIMULADA" : !executa ? "SUGERIDA" : "EXECUTADA";

  const acao = await tx.acaoAgenteIA.create({
    data: {
      turnoId: i.turnoId,
      atendimentoId: i.ctx.atendimentoId,
      oportunidadeId: i.ctx.oportunidade?.id ?? null,
      acao: i.documentoId ? "ENVIAR_DOCUMENTO" : "RESPONDER",
      etapaNoMomento: i.ctx.oportunidade?.etapa ?? null,
      modoConfigurado: i.simulado ? "SHADOW" : i.destino,
      status,
      confianca: i.confianca,
      payload: { texto: corpo, documentoId: i.documentoId },
      fontes: i.fontes,
      reversivel: false,
      motivoIrreversivel: "Mensagem enviada não pode ser desfeita",
    },
  });
  if (!executa) return { acao };

  const intencao = await tx.intencaoMensagem.create({
    data: {
      numeroId: i.ctx.numeroId,
      contatoId: i.ctx.contatoId,
      atendimentoId: i.ctx.atendimentoId,
      leadId: i.ctx.oportunidade?.id ?? null,
      origem: "IA",
      reativa: true,
      status: i.simulado ? "SIMULADA" : "PENDENTE",
      tipo: i.documentoId ? "DOCUMENTO" : "TEXTO",
      midiaPath,
      corpoRenderizado: corpo,
      acaoAgenteIAId: acao.id,
    },
  });
  const ligada = await tx.acaoAgenteIA.update({ where: { id: acao.id }, data: { intencaoId: intencao.id } });
  if (!i.simulado) {
    await registrarEvento(tx, {
      tipo: "AriaRespondeu",
      agregadoTipo: "AtendimentoWhatsApp",
      agregadoId: i.ctx.atendimentoId,
      autorId: null,
      payload: payloadDaAria(acao.id, { intencaoId: intencao.id, documento: !!i.documentoId }),
    });
  }
  return { acao: ligada };
}

/**
 * Aprovação de uma resposta SUGERIDA (Task 24): revalida pausa, valores e documento no momento da
 * decisão e cria a IntencaoMensagem reativa de origem IA ligada à ação já gravada.
 */
export async function efetivarRespostaSugerida(tx: Tx, acao: AcaoAgenteIA, politicas?: ConfigAria["politicas"]): Promise<{ eventoId: string }> {
  if (!acao.atendimentoId) throw new ErroRegra("A ação não tem atendimento.");
  const atendimentoId = acao.atendimentoId;
  await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id = ${atendimentoId} FOR UPDATE`;
  const at = await tx.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: atendimentoId }, select: { iaPausadaEm: true, encerradoEm: true } });
  if (at.iaPausadaEm) throw new ErroRegra("A Aria está pausada neste atendimento: uma pessoa já assumiu a conversa.");
  if (at.encerradoEm) throw new ErroRegra("O atendimento já foi encerrado.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload gravado por executarResposta
  const payload = (acao.payload ?? {}) as Record<string, any>;
  const texto = String(payload.texto ?? "");
  const documentoId: string | null = payload.documentoId ?? null;
  const ctx = await montarContextoTurno(atendimentoId, tx);
  const pol = politicas ?? (await versaoPublicada(tx))?.config.politicas ?? POLITICAS_PADRAO;
  if (valoresNaoAutorizados(texto, permitidos(ctx, pol)).length > 0) throw new ErroRegra("O texto cita um valor que não está mais autorizado.");
  let midiaPath: string | null = null;
  if (documentoId) {
    midiaPath = await urlDocumentoEnviavel(tx, documentoId);
    if (!midiaPath) throw new ErroRegra("O documento não pode mais ser enviado ao lead.");
  }
  const intencao = await tx.intencaoMensagem.create({
    data: {
      numeroId: ctx.numeroId,
      contatoId: ctx.contatoId,
      atendimentoId,
      leadId: ctx.oportunidade?.id ?? null,
      origem: "IA",
      reativa: true,
      status: "PENDENTE",
      tipo: documentoId ? "DOCUMENTO" : "TEXTO",
      midiaPath,
      corpoRenderizado: texto,
      acaoAgenteIAId: acao.id,
    },
  });
  await tx.acaoAgenteIA.update({ where: { id: acao.id }, data: { intencaoId: intencao.id } });
  const evento = await registrarEvento(tx, {
    tipo: "AriaRespondeu",
    agregadoTipo: "AtendimentoWhatsApp",
    agregadoId: atendimentoId,
    autorId: null,
    payload: payloadDaAria(acao.id, { intencaoId: intencao.id, documento: !!documentoId, aprovada: true }),
  });
  return { eventoId: evento.id };
}

// ---------------------------------------------------------------------------------------------
// Ações no CRM (Task 20)
// ---------------------------------------------------------------------------------------------

type Json = Prisma.InputJsonValue;
type Payload = Record<string, Json | null>;

export type BloqueioAcaoCrm =
  | "NEGADA_PELA_MATRIZ"
  | "SEM_OPORTUNIDADE"
  | "SEM_PESSOA"
  | "SEM_MUDANCA"
  | "TRANSICAO_PROIBIDA"
  | "CAMPO_INEXISTENTE"
  | "CAMPO_ARQUIVADO"
  | "VALOR_INVALIDO"
  | "TAG_INEXISTENTE"
  | "DATA_INVALIDA"
  | "CONTATO_INDISPONIVEL"
  | "VALOR_NAO_AUTORIZADO"
  | "FORA_POLITICA"
  | "FORA_DA_JANELA"
  | "SEM_DONO";

export interface EntradaAcaoCrm {
  turnoId: string;
  ctx: ContextoTurno;
  proposta: AcaoProposta;
  destino: "EXECUTAR" | "SUGERIR" | "NEGAR";
  modo: ModoAcao | "SEMPRE";
  simulado: boolean;
  confianca: number;
  /** Configuração publicada; sem ela vale a versão publicada e, na falta dela, o padrão. */
  config?: ConfigAria;
}

type Plano = { ok: true; payload: Payload; reversivel: boolean; motivoIrreversivel: string | null } | { ok: false; motivo: BloqueioAcaoCrm; extra?: Payload };
const bloqueio = (motivo: BloqueioAcaoCrm, extra?: Payload): Plano => ({ ok: false, motivo, extra });
const reversivel = (payload: Payload): Plano => ({ ok: true, payload, reversivel: true, motivoIrreversivel: null });

async function lerLead(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${id} FOR UPDATE`;
  return tx.oportunidade.findUnique({ where: { id }, select: { id: true, etapa: true, pessoaId: true, vendedorDonoId: true, motivoPerda: true } });
}

async function planejar(tx: Tx, ctx: ContextoTurno, p: AcaoProposta, config: ConfigAria): Promise<Plano> {
  const opId = ctx.oportunidade?.id ?? null;
  switch (p.acao) {
    case "NOTA_INTERNA":
      return reversivel({ texto: p.texto });
    case "AGENDAR_MENSAGEM": {
      const quando = new Date(p.enviarEmISO);
      if (Number.isNaN(quando.getTime()) || quando.getTime() <= Date.now()) return bloqueio("DATA_INVALIDA");
      // D12 (#202 C4): a mesma recusa do agendamento humano, no fuso da escola.
      const foraDaJanela = await recusaForaDaJanela(quando);
      if (foraDaJanela) return bloqueio("FORA_DA_JANELA", { mensagem: foraDaJanela });
      const contato = await tx.contatoWhatsApp.findUnique({ where: { id: ctx.contatoId }, select: { optOutEm: true } });
      const at = await tx.atendimentoWhatsApp.findUnique({ where: { id: ctx.atendimentoId }, select: { encerradoEm: true } });
      if (!contato || contato.optOutEm || !at || at.encerradoEm) return bloqueio("CONTATO_INDISPONIVEL");
      if (valoresNaoAutorizados(p.texto, permitidos(ctx, config.politicas)).length > 0) return bloqueio("VALOR_NAO_AUTORIZADO");
      return reversivel({ texto: p.texto, agendadaPara: quando.toISOString() });
    }
    case "CRIAR_TAREFA": {
      if (Number.isNaN(new Date(p.venceEmISO).getTime())) return bloqueio("DATA_INVALIDA");
      return reversivel({ titulo: p.titulo, venceEmISO: new Date(p.venceEmISO).toISOString() });
    }
    default:
      break;
  }

  if (!opId) return bloqueio("SEM_OPORTUNIDADE");
  const lead = await lerLead(tx, opId);
  if (!lead) return bloqueio("SEM_OPORTUNIDADE");

  switch (p.acao) {
    case "MOVER_ETAPA": {
      if (p.para === lead.etapa) return bloqueio("SEM_MUDANCA");
      if (!transicaoManualPermitida(lead.etapa, p.para)) return bloqueio("TRANSICAO_PROIBIDA", { de: lead.etapa, para: p.para });
      return reversivel({ de: lead.etapa, para: p.para });
    }
    case "MARCAR_PERDIDO": {
      if (lead.etapa === EtapaLead.PERDIDO || lead.etapa === EtapaLead.MATRICULADO) return bloqueio("TRANSICAO_PROIBIDA", { de: lead.etapa, para: "PERDIDO" });
      return reversivel({ de: lead.etapa, para: "PERDIDO", motivoPerda: p.motivo, motivoPerdaAnterior: lead.motivoPerda });
    }
    case "TAG": {
      if (!lead.pessoaId) return bloqueio("SEM_PESSOA");
      const tag = await tx.tag.findUnique({ where: { id: p.tagId }, select: { id: true, nome: true, ativo: true } });
      if (!tag || !tag.ativo) return bloqueio("TAG_INEXISTENTE");
      const ja = await tx.pessoaTag.findUnique({ where: { pessoaId_tagId: { pessoaId: lead.pessoaId, tagId: tag.id } } });
      if (ja) return bloqueio("SEM_MUDANCA");
      return reversivel({ tagId: tag.id, nome: tag.nome, pessoaId: lead.pessoaId });
    }
    case "ATUALIZAR_CAMPO": {
      if (!lead.pessoaId) return bloqueio("SEM_PESSOA");
      const campo =
        (await tx.campoPersonalizado.findUnique({ where: { id: p.campo } })) ??
        (await tx.campoPersonalizado.findUnique({ where: { alvo_nome: { alvo: "PESSOA", nome: p.campo } } }));
      if (!campo || campo.alvo !== "PESSOA") return bloqueio("CAMPO_INEXISTENTE");
      if (campo.arquivadoEm) return bloqueio("CAMPO_ARQUIVADO");
      const v = validarValorCampo(campo, p.valor);
      if (!v.ok) return bloqueio("VALOR_INVALIDO");
      const atual = await tx.valorCampoPersonalizado.findFirst({ where: { campoId: campo.id, pessoaId: lead.pessoaId } });
      const de = (atual?.valor ?? null) as Json | null;
      if (de === v.valor) return bloqueio("SEM_MUDANCA");
      return reversivel({ campo: p.campo, campoId: campo.id, nomeCampo: campo.nome, pessoaId: lead.pessoaId, de, para: v.valor });
    }
    case "CONDICAO_COMERCIAL": {
      const faixa = avaliarDesconto(p.descontoPct, p.parcelas, p.tipoCobranca, config.politicas);
      if (faixa === "HANDOFF") return bloqueio("FORA_POLITICA", { motivoHandoff: "FORA_POLITICA", descontoPct: p.descontoPct, parcelas: p.parcelas });
      if (faixa === "COM_APROVACAO" && !lead.vendedorDonoId) return bloqueio("SEM_DONO");
      return {
        ok: true,
        payload: { tipoCobranca: p.tipoCobranca, descontoPct: p.descontoPct, parcelas: p.parcelas, faixa },
        reversivel: false,
        motivoIrreversivel: "Condição comercial comunicada ao cliente",
      };
    }
  }
}

function dataCivilNoFuso(instante: Date, fuso: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" }).format(instante);
  } catch {
    return instante.toISOString().slice(0, 10);
  }
}

/**
 * Aplica a ação gravada (payload já validado no momento do planejamento). Revalida o estado atual,
 * grava a mutação e o Evento da Aria na transação recebida, e devolve o id do Evento. Reusada na
 * aprovação de uma ação SUGERIDA. Lança ErroRegra se o estado mudou e a ação não vale mais.
 */
export async function aplicarAcao(tx: Tx, acao: AcaoAgenteIA, politicas?: ConfigAria["politicas"]): Promise<{ eventoId: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload gravado pelo próprio planejar
  const payload = (acao.payload ?? {}) as Record<string, any>;
  // Só a CLASSIFICAR_SETOR SIMULADA (triagem em SHADOW) não tem atendimento, e nunca é aplicada.
  const atendimentoId = acao.atendimentoId;
  if (!atendimentoId) throw new ErroRegra("A ação não tem atendimento.");
  const opId = acao.oportunidadeId;
  const resultado: Payload = {};
  let aprovacaoId: string | null = null;
  let intencaoId: string | null = null;
  let evento: { id: string };

  const eventoLead = (tipo: string, dados: Payload) =>
    registrarEvento(tx, { tipo, agregadoTipo: "Lead", agregadoId: opId!, autorId: null, payload: payloadDaAria(acao.id, dados) });

  switch (acao.acao) {
    case "MOVER_ETAPA": {
      const lead = opId ? await lerLead(tx, opId) : null;
      if (!lead) throw new ErroRegra("Oportunidade não encontrada.");
      const para = payload.para as EtapaLead;
      if (lead.etapa === para || !transicaoManualPermitida(lead.etapa, para)) throw new ErroRegra("A etapa mudou e a transição não vale mais.");
      await tx.oportunidade.update({ where: { id: lead.id }, data: { etapa: para } });
      resultado.de = lead.etapa;
      evento = await eventoLead("EtapaAlterada", { de: lead.etapa, para, origem: "aria" });
      break;
    }
    case "MARCAR_PERDIDO": {
      const lead = opId ? await lerLead(tx, opId) : null;
      if (!lead) throw new ErroRegra("Oportunidade não encontrada.");
      if (lead.etapa === EtapaLead.PERDIDO || lead.etapa === EtapaLead.MATRICULADO) throw new ErroRegra("A etapa mudou e a oportunidade não pode mais ser marcada como perdida.");
      await tx.oportunidade.update({ where: { id: lead.id }, data: { etapa: EtapaLead.PERDIDO, motivoPerda: payload.motivoPerda } });
      resultado.de = lead.etapa;
      resultado.motivoPerdaAnterior = lead.motivoPerda;
      evento = await eventoLead("LeadPerdido", { motivoPerda: payload.motivoPerda, de: lead.etapa, observacao: null });
      break;
    }
    case "TAG": {
      const chave = { pessoaId_tagId: { pessoaId: payload.pessoaId, tagId: payload.tagId } };
      if (await tx.pessoaTag.findUnique({ where: chave })) throw new ErroRegra("A pessoa já tem essa tag.");
      await tx.pessoaTag.create({ data: { pessoaId: payload.pessoaId, tagId: payload.tagId, criadoPorId: null } });
      evento = await registrarEvento(tx, {
        tipo: "TagAtribuida",
        agregadoTipo: "Pessoa",
        agregadoId: payload.pessoaId,
        autorId: null,
        payload: payloadDaAria(acao.id, { tagId: payload.tagId, nome: payload.nome ?? null }),
      });
      break;
    }
    case "ATUALIZAR_CAMPO": {
      const campo = await tx.campoPersonalizado.findUnique({ where: { id: payload.campoId } });
      if (!campo || campo.arquivadoEm) throw new ErroRegra("O campo não está mais disponível.");
      const atual = await tx.valorCampoPersonalizado.findFirst({ where: { campoId: campo.id, pessoaId: payload.pessoaId } });
      const de = (atual?.valor ?? null) as Json | null;
      const v = validarValorCampo(campo, payload.para);
      if (!v.ok) throw new ErroRegra("O valor não é mais válido para o campo.");
      const json = v.valor === null ? Prisma.JsonNull : v.valor;
      if (atual) await tx.valorCampoPersonalizado.update({ where: { id: atual.id }, data: { valor: json } });
      else await tx.valorCampoPersonalizado.create({ data: { campoId: campo.id, pessoaId: payload.pessoaId, valor: json } });
      resultado.de = de;
      evento = await registrarEvento(tx, {
        tipo: "CampoPersonalizadoAlterado",
        agregadoTipo: "Pessoa",
        agregadoId: payload.pessoaId,
        autorId: null,
        payload: payloadDaAria(acao.id, { campoId: campo.id, nome: campo.nome, de, para: v.valor }),
      });
      break;
    }
    case "CRIAR_TAREFA": {
      const lead = opId ? await tx.oportunidade.findUnique({ where: { id: opId }, select: { id: true, pessoaId: true, vendedorDonoId: true } }) : null;
      const fuso = (await carregarFusoInstitucionalTx(tx)) ?? "UTC";
      const vence = new Date(payload.venceEmISO);
      const t = await tx.tarefa.create({
        data: {
          titulo: payload.titulo,
          tipo: "OUTRO",
          setor: "COMERCIAL",
          dataCivil: dataCivilNoFuso(vence, fuso),
          inicioEm: vence,
          fusoOrigem: fuso,
          responsavelId: lead?.vendedorDonoId ?? null,
          criadorId: null,
          leadId: lead?.id ?? null,
          pessoaId: lead?.pessoaId ?? null,
          origem: "IA",
        },
      });
      resultado.tarefaId = t.id;
      const dados = { tarefaId: t.id, titulo: t.titulo, setor: t.setor, responsavelId: t.responsavelId, dataCivil: t.dataCivil };
      evento = await registrarEvento(tx, { tipo: "TarefaCriada", agregadoTipo: "Tarefa", agregadoId: t.id, autorId: null, payload: payloadDaAria(acao.id, { ...dados, origem: "IA" }) });
      if (lead) await eventoLead("TarefaCriada", dados);
      break;
    }
    case "AGENDAR_MENSAGEM": {
      // Fala da Aria: como em efetivarRespostaSugerida, trava o atendimento e revalida pausa e valores.
      await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id = ${atendimentoId} FOR UPDATE`;
      const at = await tx.atendimentoWhatsApp.findUniqueOrThrow({
        where: { id: atendimentoId },
        select: { id: true, finalidade: true, encerradoEm: true, iaPausadaEm: true, conversa: { select: { numeroId: true, contatoId: true } } },
      });
      if (at.iaPausadaEm) throw new ErroRegra("A Aria está pausada neste atendimento: uma pessoa já assumiu a conversa.");
      const contatoId = at.conversa.contatoId;
      const contato = contatoId ? await tx.contatoWhatsApp.findUnique({ where: { id: contatoId }, select: { optOutEm: true } }) : null;
      if (!contatoId || !contato || contato.optOutEm || at.encerradoEm) throw new ErroRegra("O contato não pode receber mensagens.");
      const quando = new Date(payload.agendadaPara);
      if (quando.getTime() <= Date.now()) throw new ErroRegra("O horário agendado já passou.");
      // Sugestão aprovada depois: a janela pode ter mudado desde o planejamento (D12).
      await exigirAgendamentoNaJanela(quando);
      const pol = politicas ?? (await versaoPublicada(tx))?.config.politicas ?? POLITICAS_PADRAO;
      const precos = opId ? await precosDaOportunidade(opId, tx) : [];
      const respostasRapidas = await respostasParaAria(at.finalidade, tx);
      if (valoresNaoAutorizados(String(payload.texto ?? ""), permitidos({ precos, respostasRapidas }, pol)).length > 0) {
        throw new ErroRegra("O texto cita um valor que não está mais autorizado.");
      }
      const m = await tx.intencaoMensagem.create({
        data: {
          numeroId: at.conversa.numeroId,
          atendimentoId: at.id,
          contatoId,
          leadId: opId,
          origem: "IA",
          tipo: "TEXTO",
          corpoRenderizado: payload.texto,
          agendadaPara: quando,
          acaoAgenteIAId: acao.id,
        },
      });
      intencaoId = m.id;
      evento = await registrarEvento(tx, {
        tipo: "MensagemAgendada",
        agregadoTipo: "AtendimentoWhatsApp",
        agregadoId: at.id,
        autorId: null,
        payload: payloadDaAria(acao.id, { intencaoId: m.id, agendadaPara: quando.toISOString(), numeroId: at.conversa.numeroId }),
      });
      break;
    }
    case "NOTA_INTERNA": {
      evento = await registrarEvento(tx, {
        tipo: "NotaInterna",
        agregadoTipo: "AtendimentoWhatsApp",
        agregadoId: atendimentoId,
        autorId: null,
        payload: payloadDaAria(acao.id, { nota: payload.texto }),
      });
      break;
    }
    case "CONDICAO_COMERCIAL": {
      if (payload.faixa === "COM_APROVACAO") {
        const r = await solicitarAprovacaoDesconto(tx, {
          oportunidadeId: opId!,
          tipo: payload.tipoCobranca,
          pct: payload.descontoPct,
          parcelas: payload.parcelas,
          acaoAgenteIAId: acao.id,
        });
        if ("semDono" in r) throw new ErroRegra("A oportunidade não tem responsável para aprovar o desconto.");
        aprovacaoId = r.aprovacaoId;
      }
      evento = await eventoLead("CondicaoComercialProposta", {
        tipoCobranca: payload.tipoCobranca,
        percentual: payload.descontoPct,
        parcelas: payload.parcelas,
        aprovacaoId,
      });
      break;
    }
    default:
      throw new ErroRegra(`Ação ${acao.acao} não é aplicável ao CRM.`);
  }

  await tx.acaoAgenteIA.update({
    where: { id: acao.id },
    data: {
      eventoId: evento.id,
      ...(aprovacaoId ? { aprovacaoId } : {}),
      ...(intencaoId ? { intencaoId } : {}),
      payload: { ...payload, ...resultado } as Prisma.InputJsonObject,
    },
  });
  return { eventoId: evento.id };
}

/**
 * Decide e (quando permitido) executa uma ação proposta no CRM, tudo na transação recebida.
 * NEGAR/inválida -> BLOQUEADA; simulado (SHADOW, vale mesmo com SUGERIR) -> SIMULADA; SUGERIR -> SUGERIDA com expiração; senão EXECUTADA.
 */
export async function executarAcaoCrm(tx: Tx, i: EntradaAcaoCrm): Promise<AcaoAgenteIA> {
  const config = i.config ?? (await versaoPublicada(tx))?.config ?? configPadrao();
  const base = {
    turnoId: i.turnoId,
    atendimentoId: i.ctx.atendimentoId,
    oportunidadeId: i.ctx.oportunidade?.id ?? null,
    acao: i.proposta.acao,
    etapaNoMomento: i.ctx.oportunidade?.etapa ?? null,
    modoConfigurado: i.simulado ? "SHADOW" : i.modo,
    confianca: i.confianca,
    justificativa: i.proposta.justificativa,
  };
  const bloqueada = (motivo: BloqueioAcaoCrm, extra?: Payload) =>
    tx.acaoAgenteIA.create({
      data: {
        ...base,
        status: "BLOQUEADA",
        payload: { proposta: i.proposta as unknown as Json, motivoBloqueio: motivo, ...(extra ?? {}) } as Prisma.InputJsonObject,
        reversivel: false,
        motivoIrreversivel: "Ação bloqueada: nada foi alterado",
      },
    });

  if (i.destino === "NEGAR") return bloqueada("NEGADA_PELA_MATRIZ");

  const plano = await planejar(tx, i.ctx, i.proposta, config);
  if (!plano.ok) return bloqueada(plano.motivo, plano.extra);

  const dados = {
    ...base,
    payload: plano.payload as Prisma.InputJsonObject,
    reversivel: plano.reversivel,
    motivoIrreversivel: plano.motivoIrreversivel,
  };
  // SHADOW vence a matriz: nada sai e nada muda, nem como sugestão aprovável depois.
  if (i.simulado) return tx.acaoAgenteIA.create({ data: { ...dados, status: "SIMULADA" } });
  if (i.destino === "SUGERIR") {
    const expiraEm = new Date(Date.now() + config.confianca.expiracaoSugestaoMin * 60_000);
    return tx.acaoAgenteIA.create({ data: { ...dados, status: "SUGERIDA", expiraEm } });
  }

  const criada = await tx.acaoAgenteIA.create({ data: { ...dados, status: "EXECUTADA" } });
  await aplicarAcao(tx, criada, config.politicas);
  return tx.acaoAgenteIA.findUniqueOrThrow({ where: { id: criada.id } });
}
