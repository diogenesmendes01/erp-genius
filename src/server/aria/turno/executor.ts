import type { AcaoAgenteIA, Prisma } from "@prisma/client";
import { registrarEvento } from "@/server/_shared/evento";
import { payloadDaAria } from "../ator";
import type { ConfigAria } from "../config-schema";
import { APRESENTACAO, type ContextoTurno } from "./contexto";
import type { SaidaModelo } from "./tipos";
import { valoresNaoAutorizados, type ValoresPermitidos } from "./valores";

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

const POLITICAS_PADRAO: ConfigAria["politicas"] = {
  MATRICULA: { descontoSemAprovacaoPct: 10, descontoComAprovacaoPct: 20 },
  MENSALIDADE: { descontoSemAprovacaoPct: 10, descontoComAprovacaoPct: 20 },
  parcelasMax: 10,
  validadePropostaDias: 7,
};

function permitidos(ctx: ContextoTurno, politicas: ConfigAria["politicas"]): ValoresPermitidos {
  return {
    valores: ctx.precos.map((p) => p.valor),
    percentuais: [
      politicas.MATRICULA.descontoSemAprovacaoPct,
      politicas.MATRICULA.descontoComAprovacaoPct,
      politicas.MENSALIDADE.descontoSemAprovacaoPct,
      politicas.MENSALIDADE.descontoComAprovacaoPct,
    ],
    parcelas: Array.from({ length: politicas.parcelasMax }, (_, i) => i + 1),
  };
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
    const fonte = await tx.fonteConhecimento.findUnique({
      where: { id: i.documentoId },
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
    if (!enviavel) return { bloqueada: "DOCUMENTO_NAO_ENVIAVEL" };
    midiaPath = url;
  }

  const corpo = i.ctx.primeiraDaAria ? `${APRESENTACAO(i.nomeAria)} ${i.texto}` : i.texto;
  const executa = i.destino === "EXECUTAR";
  const status = !executa ? "SUGERIDA" : i.simulado ? "SIMULADA" : "EXECUTADA";

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
