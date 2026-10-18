import type { AcaoAgenteIA, Prisma } from "@prisma/client";
import { registrarEvento } from "@/server/_shared/evento";
import { proximoStatus } from "@/server/whatsapp/status-atendimento";
import { payloadDaAria } from "../ator";
import type { ConfigAria } from "../config-schema";
import type { ContextoTurno } from "./contexto";
import { pausarAriaNoAtendimento } from "../pausa";
import { executarResposta } from "./executor";
import type { MotivoHandoff } from "./tipos";

type Tx = Prisma.TransactionClient;

export interface ResumoHandoff {
  motivo: string;
  resumo: string;
  proximoPasso: string;
}

export interface EntradaHandoff {
  turnoId: string;
  ctx: ContextoTurno;
  motivo: MotivoHandoff;
  config: ConfigAria;
  simulado: boolean;
  resumo: ResumoHandoff | null;
}

export const MENSAGEM_HANDOFF_PADRAO = "{nome}, vou te passar para {responsavel}, que continua daqui.";

const ROTULOS_RESUMO: Record<keyof ResumoHandoff, string> = {
  motivo: "Motivo",
  resumo: "Resumo",
  proximoPasso: "Próximo passo",
};

const primeiroNome = (n: string | null | undefined) => n?.trim().split(/\s+/)[0] || null;

/** Texto da nota interna: só os campos escolhidos em `camposResumo` (motivo, resumo, proximoPasso). */
export function montarNotaResumo(resumo: ResumoHandoff | null, campos: string[]): string | null {
  if (!resumo) return null;
  const linhas = (Object.keys(ROTULOS_RESUMO) as (keyof ResumoHandoff)[])
    .filter((k) => campos.includes(k) && resumo[k]?.trim())
    .map((k) => `${ROTULOS_RESUMO[k]}: ${resumo[k].trim()}`);
  return linhas.length ? linhas.join("\n") : null;
}

/**
 * Passa o atendimento a uma pessoa: define o destino (responsável da oportunidade, usuário fixo ou fila),
 * avisa o lead, anota o resumo, pausa a Aria e grava o Evento, tudo na transação recebida.
 * Em SHADOW (simulado) nada muda no atendimento: só a ação SIMULADA (e a intenção SIMULADA).
 */
export async function executarHandoff(tx: Tx, i: EntradaHandoff): Promise<AcaoAgenteIA> {
  const h = i.config.handoff;
  const destinoCfg = h.destino;
  const donoId = i.ctx.oportunidade?.vendedorDonoId ?? null;
  const responsavelId = destinoCfg === "RESPONSAVEL" ? donoId : destinoCfg === "USUARIO" ? (h.destinoUsuarioId ?? null) : null;
  const responsavel = responsavelId
    ? await tx.usuario.findUnique({ where: { id: responsavelId }, select: { id: true, nome: true } })
    : null;
  const destinoId = responsavel?.id ?? null;
  const destino = destinoId ? destinoCfg : "FILA_SETOR";

  const contato = await tx.contatoWhatsApp.findUnique({
    where: { id: i.ctx.contatoId },
    select: { nomeExibicao: true, nomePerfil: true },
  });
  const nome = primeiroNome(contato?.nomeExibicao) ?? primeiroNome(contato?.nomePerfil) ?? primeiroNome(i.ctx.oportunidade?.nome) ?? "";
  const texto = (h.mensagem.trim() || MENSAGEM_HANDOFF_PADRAO)
    .replaceAll("{nome}", nome)
    .replaceAll("{responsavel}", primeiroNome(responsavel?.nome) ?? "nossa equipe")
    .replace(/^[\s,]+/, "")
    .trim();

  // A mensagem ao lead sai antes da pausa (o executor recusa atendimento já pausado).
  const msg = await executarResposta(tx, {
    turnoId: i.turnoId,
    ctx: i.ctx,
    texto,
    documentoId: null,
    destino: "EXECUTAR",
    simulado: i.simulado,
    confianca: 100,
    fontes: [],
    nomeAria: i.config.nome,
    politicas: i.config.politicas,
  });
  const intencaoId = "acao" in msg ? (msg.acao.intencaoId ?? null) : null;

  const nota = montarNotaResumo(i.resumo, h.camposResumo);
  const acao = await tx.acaoAgenteIA.create({
    data: {
      turnoId: i.turnoId,
      atendimentoId: i.ctx.atendimentoId,
      oportunidadeId: i.ctx.oportunidade?.id ?? null,
      acao: "HANDOFF",
      etapaNoMomento: i.ctx.oportunidade?.etapa ?? null,
      modoConfigurado: i.simulado ? "SHADOW" : "SEMPRE",
      status: i.simulado ? "SIMULADA" : "EXECUTADA",
      confianca: 100,
      payload: { motivo: i.motivo, destino, responsavelId: destinoId, nota, mensagem: texto, mensagemBloqueada: "bloqueada" in msg ? msg.bloqueada : null },
      reversivel: false,
      motivoIrreversivel: "Handoff já comunicado ao contato",
    },
  });
  if (i.simulado) return acao;

  const at = await tx.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: i.ctx.atendimentoId }, select: { status: true } });
  await tx.atendimentoWhatsApp.update({
    where: { id: i.ctx.atendimentoId },
    data: { responsavelId: destinoId, status: proximoStatus(at.status, destinoId ? "ASSUMIDO" : "DEVOLVIDO", !!destinoId) },
  });
  await pausarAriaNoAtendimento(tx, i.ctx.atendimentoId, "HANDOFF", null);
  if (nota) {
    await registrarEvento(tx, {
      tipo: "NotaInterna",
      agregadoTipo: "AtendimentoWhatsApp",
      agregadoId: i.ctx.atendimentoId,
      autorId: null,
      payload: payloadDaAria(acao.id, { nota }),
    });
  }
  const evento = await registrarEvento(tx, {
    tipo: "AriaHandoff",
    agregadoTipo: "AtendimentoWhatsApp",
    agregadoId: i.ctx.atendimentoId,
    autorId: null,
    payload: payloadDaAria(acao.id, { motivo: i.motivo, destino, responsavelId: destinoId, intencaoId }),
  });
  return tx.acaoAgenteIA.update({ where: { id: acao.id }, data: { eventoId: evento.id } });
}
