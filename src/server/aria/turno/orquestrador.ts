import type { AcaoAgenteIATipo, EtapaLead, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { configPadrao, modoDaAcao, type ConfigAria } from "../config-schema";
import { chaveConfigurada, escolherProvedor, ErroProvedorIA, type ProvedorIA, type RespostaIA } from "../provedor";
import { registrarChamadaIA, estadoOrcamento } from "../uso";
import { situacaoAria } from "../estado";
import { montarContextoTurno, montarSistema, ocultarDadosPessoais, type ContextoTurno } from "./contexto";
import { destinoDaAcao } from "./decisao";
import { executarAcaoCrm, executarResposta } from "./executor";
import { gatilhoDeHandoff } from "./gatilhos";
import { forcarSoSugerir, motivoParaNaoAtuar, TIPOS_COM_TEXTO, type MotivoBloqueio, type SituacaoGuarda } from "./guardas";
import { executarHandoff } from "./handoff";
import { ESQUEMA_SAIDA_CONVERSA, normalizarSaida, type MotivoHandoff, type SaidaModelo } from "./tipos";

type Tx = Prisma.TransactionClient;

export type ResultadoTurno =
  | {
      /** null quando não há atendimento para ancorar o turno (grupo, ou ainda sem setor: Task 23). */
      turnoId: string | null;
      resultado: "RESPONDEU" | "SUGERIU" | "HANDOFF" | `IGNORADO:${MotivoBloqueio}` | "FALHOU";
    }
  | { duplicado: true };

export interface DepsTurno {
  provedor?: ProvedorIA;
  agora?: Date;
}

const MAX_TOKENS_CONVERSA = 1024;
const JANELA_REPROCESSO_MS = 30 * 60_000;
const ATRASO_REPROCESSO_MS = 2 * 60_000;
const LOTE_REPROCESSO = 50;
/** Turno ainda EM_ANDAMENTO depois disto: o processo caiu no meio; vira handoff. */
export const LIMITE_TURNO_PRESO_MS = 10 * 60_000;

const simplificar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const RE_PERGUNTA_PRECO = /\b(preco|precos|quanto custa|quanto e|quanto fica|quanto sai|valor|valores|mensalidade|investimento)\b/;
const perguntaDePreco = (fala: string) => RE_PERGUNTA_PRECO.test(simplificar(fala));

async function encerrar(
  turnoId: string,
  resultado: string,
  extra: { confianca?: number | null; chamadaId?: string | null; versaoId?: string | null } = {},
): Promise<void> {
  await prisma.turnoAgenteIA.update({ where: { id: turnoId }, data: { resultado, ...extra } });
}

/** Papéis alternados e terminando em "usuario"; texto sem dados pessoais. */
function mensagensDoPrompt(ctx: ContextoTurno): { papel: "usuario" | "assistente"; texto: string }[] {
  const lista = ctx.mensagens
    .map((m) => ({ papel: m.direcao === "ENTRADA" ? ("usuario" as const) : ("assistente" as const), texto: ocultarDadosPessoais(m.texto).trim() }))
    .filter((m) => m.texto);
  while (lista.length && lista[lista.length - 1].papel !== "usuario") lista.pop();
  return lista;
}

/** Um turno por mensagem âncora: insere o turno de forma idempotente e decide, chama o provedor e age. */
export async function processarTurnoAria(mensagemId: string, deps: DepsTurno = {}): Promise<ResultadoTurno> {
  const agora = deps.agora ?? new Date();
  const msg = await prisma.mensagemWhatsApp.findUniqueOrThrow({
    where: { id: mensagemId },
    select: {
      id: true,
      tipo: true,
      corpo: true,
      criadoEm: true,
      atendimentoId: true,
      conversa: { select: { grupoId: true, contatoId: true, contato: { select: { optOutEm: true } }, numero: { select: { donoId: true } } } },
      atendimento: { select: { finalidade: true, iaPausadaEm: true, encerradoEm: true } },
    },
  });

  // Grupo nunca abre atendimento, então não há onde ancorar um turno.
  if (msg.conversa.grupoId || !msg.conversa.contatoId) return { turnoId: null, resultado: "IGNORADO:GRUPO" };
  // Ainda sem atendimento (sem setor): a triagem (Task 23) assume; aqui a Aria não atua.
  if (!msg.atendimentoId || !msg.atendimento) return { turnoId: null, resultado: "IGNORADO:OUTRO_SETOR" };

  const criado = await prisma.turnoAgenteIA.createMany({
    data: [{ ancoraMensagemId: msg.id, atendimentoId: msg.atendimentoId, tipo: "ATENDIMENTO", resultado: "EM_ANDAMENTO" }],
    skipDuplicates: true,
  });
  if (criado.count === 0) return { duplicado: true };
  const turno = await prisma.turnoAgenteIA.findUniqueOrThrow({ where: { ancoraMensagemId: msg.id }, select: { id: true } });
  const turnoId = turno.id;

  // Rajada (vários inbounds seguidos): só a fala mais nova do atendimento é respondida, com as
  // anteriores no contexto. Mesma regra do reprocesso; vale também ao fim da chamada ao provedor.
  const atendimentoId = msg.atendimentoId;
  const superada = () => falaSuperada(atendimentoId, msg.criadoEm, msg.id);
  if (await superada()) {
    await encerrar(turnoId, "IGNORADO:FALA_SUPERADA");
    return { turnoId, resultado: "IGNORADO:FALA_SUPERADA" };
  }

  try {
    return await executarTurno(turnoId, atendimentoId, msg, agora, deps.provedor, superada);
  } catch (e) {
    console.error("[aria] turno falhou:", e);
    await encerrar(turnoId, "FALHOU").catch(() => undefined);
    return { turnoId, resultado: "FALHOU" };
  }
}

/** Tipos que a Aria pode responder (o corpo ainda precisa ter texto: ver `haFalaQueSupera`). */
const tiposQueSuperam = () => ({ in: [...TIPOS_COM_TEXTO] });

/**
 * Só supera outra fala o inbound que a Aria responderia: tipo de TIPOS_COM_TEXTO e corpo não vazio
 * após trim. Áudio/figurinha e foto/vídeo/documento sem legenda param em SEM_TEXTO; se superassem,
 * ninguém responderia a pergunta anterior (B4 e B2 da R2 do #234).
 */
async function haFalaQueSupera(where: Prisma.MensagemWhatsAppWhereInput): Promise<boolean> {
  const posteriores = await prisma.mensagemWhatsApp.findMany({
    where: { ...where, direcao: "ENTRADA", apagadaEm: null, tipo: tiposQueSuperam(), corpo: { not: null } },
    select: { corpo: true },
  });
  return posteriores.some((m) => !!m.corpo?.trim());
}

/** Há fala mais nova (não apagada, que a Aria responderia) no mesmo atendimento depois desta âncora. */
function falaSuperada(atendimentoId: string, criadoEm: Date, ancoraId: string): Promise<boolean> {
  return haFalaQueSupera({ atendimentoId, id: { not: ancoraId }, OR: [{ criadoEm: { gt: criadoEm } }, { criadoEm, id: { gt: ancoraId } }] });
}

interface MsgTurno {
  tipo: SituacaoGuarda["mensagemTipo"];
  corpo: string | null;
  conversa: { contato: { optOutEm: Date | null } | null; numero: { donoId: string | null } };
  atendimento: { finalidade: SituacaoGuarda["finalidade"]; iaPausadaEm: Date | null; encerradoEm: Date | null } | null;
}

async function executarTurno(
  turnoId: string,
  atendimentoId: string,
  msg: MsgTurno,
  agora: Date,
  provedorInjetado?: ProvedorIA,
  superada: () => Promise<boolean> = async () => false,
): Promise<ResultadoTurno> {
  const situacao = await situacaoAria(agora);
  const orcamento = await estadoOrcamento(agora);
  const versao = situacao.versao;
  const guarda: SituacaoGuarda = {
    estado: versao ? situacao.estado : "DESLIGADA",
    pausadaGlobal: situacao.pausada,
    orcamento: orcamento.situacao,
    acaoOrcamento: orcamento.acao,
    conversaDeGrupo: false,
    finalidade: msg.atendimento?.finalidade ?? null,
    iaPausadaEm: msg.atendimento?.iaPausadaEm ?? null,
    atendimentoEncerrado: !!msg.atendimento?.encerradoEm,
    contatoOptOut: !!msg.conversa.contato?.optOutEm,
    numeroComDono: !!msg.conversa.numero.donoId,
    mensagemTipo: msg.tipo,
  };
  const bloqueio = motivoParaNaoAtuar(guarda);
  if (bloqueio) {
    await encerrar(turnoId, `IGNORADO:${bloqueio}`, { versaoId: versao?.id ?? null });
    return { turnoId, resultado: `IGNORADO:${bloqueio}` };
  }
  const config: ConfigAria = versao?.config ?? configPadrao();
  const versaoId = versao?.id ?? null;
  // Âncora sem texto (foto, vídeo ou documento sem legenda): o prompt terminaria na fala anterior do
  // cliente, já respondida, e a Aria responderia de novo à pergunta antiga. Nada a responder aqui.
  if (!msg.corpo?.trim()) {
    await encerrar(turnoId, "IGNORADO:SEM_TEXTO", { versaoId });
    return { turnoId, resultado: "IGNORADO:SEM_TEXTO" };
  }
  const simulado = situacao.estado === "SHADOW";
  const soSugerir = forcarSoSugerir(guarda);

  const ctx = await montarContextoTurno(atendimentoId);
  const prompt = mensagensDoPrompt(ctx);
  if (prompt.length === 0) {
    await encerrar(turnoId, "IGNORADO:SEM_TEXTO", { versaoId });
    return { turnoId, resultado: "IGNORADO:SEM_TEXTO" };
  }
  const ultimaFala = prompt[prompt.length - 1].texto;
  const etapa: EtapaLead = ctx.oportunidade?.etapa ?? "NOVO";

  // Chamada ao provedor fora de transação.
  const cfgIA = await prisma.configIA.upsert({ where: { id: "ia" }, create: { id: "ia" }, update: {} });
  // ATIVA sem chave: o simulado nunca fala com cliente real; vira erro de provedor (handoff ERRO_PROVEDOR).
  const semChaveEmAtiva = !provedorInjetado && situacao.estado === "ATIVA" && !chaveConfigurada();
  const provedor: ProvedorIA = semChaveEmAtiva
    ? {
        nome: "anthropic",
        async gerar() {
          throw new ErroProvedorIA("SEM_CHAVE");
        },
      }
    : (provedorInjetado ?? escolherProvedor({ conversa: cfgIA.modeloConversa, classificacao: cfgIA.modeloClassificacao }));
  let resposta: RespostaIA | null = null;
  let chamadaId: string | null = null;
  const inicio = Date.now();
  try {
    resposta = await provedor.gerar({
      tarefa: "conversa",
      sistema: montarSistema(config, ctx),
      mensagens: prompt,
      maxTokens: MAX_TOKENS_CONVERSA,
      esquemaSaida: ESQUEMA_SAIDA_CONVERSA,
    });
  } catch (e) {
    const codigo = e instanceof ErroProvedorIA ? e.codigo : "DESCONHECIDO";
    chamadaId = (
      await registrarChamadaIA("ATENDIMENTO", {
        erro: codigo,
        modelo: provedor.nome === "simulado" ? "simulado" : cfgIA.modeloConversa,
        latenciaMs: Date.now() - inicio,
      })
    ).id;
  }

  if (resposta) chamadaId = (await registrarChamadaIA("ATENDIMENTO", resposta)).id;
  const recusa = resposta?.recusa ?? false;
  const saida: SaidaModelo | null = resposta && !recusa ? normalizarSaida(resposta.texto) : null;
  const confianca = saida?.confianca ?? null;
  const fechar = (resultado: string) => encerrar(turnoId, resultado, { confianca, chamadaId, versaoId });
  // O cliente mandou mais durante a chamada: o turno da fala nova responde; este não age.
  if (await superada()) {
    await fechar("IGNORADO:FALA_SUPERADA");
    return { turnoId, resultado: "IGNORADO:FALA_SUPERADA" };
  }

  const fazerHandoff = async (motivo: MotivoHandoff, tx: Tx, c: ContextoTurno) =>
    executarHandoff(tx, { turnoId, ctx: c, motivo, config, simulado, resumo: null });
  const pausadaNoAtendimento = async (): Promise<ResultadoTurno> => {
    await fechar("IGNORADO:PAUSADA_NO_ATENDIMENTO");
    return { turnoId, resultado: "IGNORADO:PAUSADA_NO_ATENDIMENTO" };
  };
  const soHandoff = async (motivo: MotivoHandoff): Promise<ResultadoTurno> => {
    const acao = await prisma.$transaction((tx) => fazerHandoff(motivo, tx, ctx));
    // Uma pessoa assumiu durante a chamada ao provedor: o handoff não mexeu no atendimento.
    if (acao.status === "BLOQUEADA") return pausadaNoAtendimento();
    await fechar("HANDOFF");
    return { turnoId, resultado: "HANDOFF" };
  };

  const gatilho = gatilhoDeHandoff({
    saida,
    recusa,
    ultimaFala,
    etapa: ctx.oportunidade?.etapa ?? null,
    valorPrevisto: ctx.oportunidade?.valorPrevisto ?? null,
    trocasSemAvanco: ctx.trocasSemAvanco,
    config,
  });
  if (gatilho || !saida) return soHandoff(gatilho ?? "ERRO_PROVEDOR");

  const confiancaSaida = saida.confianca;
  const destinoDe = (acao: AcaoAgenteIATipo) => {
    const modo = modoDaAcao(config, etapa, acao);
    return { modo, destino: destinoDaAcao({ modo, confianca: confiancaSaida, config, supervisao: situacao.supervisao, soSugerir }) };
  };

  // Resposta (ou documento) exigida por permissão e por preço, antes de abrir a transação.
  const textoResposta = saida.resposta?.trim() || null;
  const acaoResposta: AcaoAgenteIATipo = saida.documentoId ? "ENVIAR_DOCUMENTO" : "RESPONDER";
  const dResposta = textoResposta ? destinoDe(acaoResposta) : null;
  if (dResposta?.destino === "NEGAR") return soHandoff("SEM_PERMISSAO");
  if (textoResposta && ctx.precos.length === 0 && perguntaDePreco(ultimaFala)) return soHandoff("SEM_PRECO");
  if (!textoResposta && saida.acoes.length === 0) return soHandoff("CONFIANCA");

  const r = await prisma.$transaction(async (tx) => {
    // Corrida com humano: trava o atendimento e relê a pausa antes de qualquer resposta ou ação no
    // CRM (o turno pode trazer só ações). Quem assumiu durante a chamada ao provedor fica com a conversa.
    await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id = ${atendimentoId} FOR UPDATE`;
    const atual = await tx.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: atendimentoId }, select: { iaPausadaEm: true } });
    if (atual.iaPausadaEm) return "PAUSADA" as const;
    let resultado: "RESPONDEU" | "SUGERIU" | null = null;
    let ctxSeguinte = ctx;
    if (textoResposta && dResposta && dResposta.destino !== "NEGAR") {
      const env = (documentoId: string | null) =>
        executarResposta(tx, {
          turnoId, ctx, texto: textoResposta, documentoId, destino: dResposta.destino as "EXECUTAR" | "SUGERIR",
          simulado, confianca: confiancaSaida, fontes: saida.fontes, nomeAria: config.nome, politicas: config.politicas,
        });
      let out = await env(saida.documentoId);
      if ("bloqueada" in out && out.bloqueada === "DOCUMENTO_NAO_ENVIAVEL") out = await env(null);
      if ("bloqueada" in out) {
        if (out.bloqueada === "PAUSADA_DURANTE_TURNO") return "PAUSADA" as const;
        const h = await fazerHandoff(out.bloqueada === "VALOR_NAO_AUTORIZADO" ? out.bloqueada : "FORA_POLITICA", tx, ctx);
        return h.status === "BLOQUEADA" ? ("PAUSADA" as const) : ("HANDOFF" as const);
      }
      resultado = dResposta.destino === "EXECUTAR" ? "RESPONDEU" : "SUGERIU";
      ctxSeguinte = { ...ctx, primeiraDaAria: false };
    }

    let sugeriu = false;
    let executou = false;
    let foraPolitica = false;
    for (const proposta of saida.acoes) {
      const { modo, destino } = destinoDe(proposta.acao);
      const acao = await executarAcaoCrm(tx, { turnoId, ctx, proposta, destino, modo, simulado, confianca: confiancaSaida, config });
      if (acao.status === "SUGERIDA" || (acao.status === "SIMULADA" && destino === "SUGERIR")) sugeriu = true;
      if (acao.status === "EXECUTADA" || (acao.status === "SIMULADA" && destino === "EXECUTAR")) executou = true;
      const motivo = (acao.payload as { motivoBloqueio?: string } | null)?.motivoBloqueio;
      if (acao.status === "BLOQUEADA" && motivo === "FORA_POLITICA") foraPolitica = true;
    }
    if (foraPolitica && config.handoff.gatilhos.foraPolitica) {
      const h = await fazerHandoff("FORA_POLITICA", tx, ctxSeguinte);
      return h.status === "BLOQUEADA" ? ("PAUSADA" as const) : ("HANDOFF" as const);
    }
    return resultado ?? (sugeriu ? "SUGERIU" : executou ? "RESPONDEU" : "SUGERIU");
  });

  if (r === "PAUSADA") return pausadaNoAtendimento();
  await fechar(r);
  return { turnoId, resultado: r };
}

/** Dispara o turno sem aguardar; qualquer erro é registrado e nunca sobe ao chamador (o inbound). */
export function agendarTurnoAria(mensagemId: string): void {
  void (async () => {
    // Aria desligada: nem cria turno (o cron também a ignora).
    const { estado } = await situacaoAria();
    if (estado === "DESLIGADA") return;
    await processarTurnoAria(mensagemId);
  })().catch((e) => console.error("[aria] falha ao agendar turno:", e));
}

/**
 * Turnos de atendimento presos em EM_ANDAMENTO há mais de LIMITE_TURNO_PRESO_MS (processo caiu
 * depois de criar o turno): o cliente ficou sem resposta, então passa a uma pessoa
 * (handoff TURNO_INTERROMPIDO). O claim (EM_ANDAMENTO -> HANDOFF) evita dois handoffs.
 */
async function recuperarTurnosPresos(agora: Date): Promise<number> {
  const presos = await prisma.turnoAgenteIA.findMany({
    where: { tipo: "ATENDIMENTO", resultado: "EM_ANDAMENTO", atendimentoId: { not: null }, criadoEm: { lt: new Date(agora.getTime() - LIMITE_TURNO_PRESO_MS) } },
    orderBy: { criadoEm: "asc" },
    take: LOTE_REPROCESSO,
    select: { id: true, atendimentoId: true },
  });
  if (presos.length === 0) return 0;
  const situacao = await situacaoAria(agora);
  const config: ConfigAria = situacao.versao?.config ?? configPadrao();
  const simulado = situacao.estado === "SHADOW";
  let recuperados = 0;
  for (const t of presos) {
    try {
      const resultado = await prisma.$transaction(async (tx) => {
        const claim = await tx.turnoAgenteIA.updateMany({ where: { id: t.id, resultado: "EM_ANDAMENTO" }, data: { resultado: "HANDOFF" } });
        if (claim.count !== 1) return null;
        const at = await tx.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: t.atendimentoId! }, select: { iaPausadaEm: true, encerradoEm: true } });
        if (at.encerradoEm) return "IGNORADO:ENCERRADO";
        if (at.iaPausadaEm) return "IGNORADO:PAUSADA_NO_ATENDIMENTO";
        const ctx = await montarContextoTurno(t.atendimentoId!, tx);
        const acao = await executarHandoff(tx, { turnoId: t.id, ctx, motivo: "TURNO_INTERROMPIDO", config, simulado, resumo: null });
        return acao.status === "BLOQUEADA" ? "IGNORADO:PAUSADA_NO_ATENDIMENTO" : "HANDOFF";
      });
      if (!resultado) continue;
      if (resultado !== "HANDOFF") await encerrar(t.id, resultado);
      recuperados++;
    } catch (e) {
      console.error("[aria] recuperação de turno preso falhou:", e);
    }
  }
  return recuperados;
}

/**
 * Âncoras recentes sem turno há mais de 2 min (inbound perdido ou processo caído) e turnos presos
 * em EM_ANDAMENTO (viram handoff); devolve quantos tratou.
 */
export async function reprocessarTurnosPendentes(agora: Date = new Date()): Promise<number> {
  const { estado } = await situacaoAria(agora);
  if (estado === "DESLIGADA") return 0;
  const recuperados = await recuperarTurnosPresos(agora);
  const candidatas = await prisma.mensagemWhatsApp.findMany({
    where: {
      direcao: "ENTRADA",
      apagadaEm: null,
      tipo: tiposQueSuperam(),
      atendimentoId: { not: null },
      criadoEm: { gte: new Date(agora.getTime() - JANELA_REPROCESSO_MS), lte: new Date(agora.getTime() - ATRASO_REPROCESSO_MS) },
      atendimento: { finalidade: "COMERCIAL", encerradoEm: null, iaPausadaEm: null },
      conversa: { grupoId: null },
    },
    orderBy: { criadoEm: "asc" },
    take: LOTE_REPROCESSO,
    select: { id: true, atendimentoId: true, criadoEm: true },
  });
  if (candidatas.length === 0) return recuperados;
  const comTurno = new Set(
    (await prisma.turnoAgenteIA.findMany({ where: { ancoraMensagemId: { in: candidatas.map((m) => m.id) } }, select: { ancoraMensagemId: true } })).map(
      (t) => t.ancoraMensagemId,
    ),
  );
  let processadas = 0;
  for (const m of candidatas) {
    if (comTurno.has(m.id)) continue;
    // Só a última fala do cliente: uma pergunta antiga não deve ser respondida fora de hora.
    if (await haFalaQueSupera({ atendimentoId: m.atendimentoId, criadoEm: { gt: m.criadoEm } })) continue;
    try {
      const r = await processarTurnoAria(m.id, { agora });
      if (!("duplicado" in r)) processadas++;
    } catch (e) {
      console.error("[aria] reprocesso falhou:", e);
    }
  }
  return recuperados + processadas;
}
