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

export function montarNotaResumo(resumo: ResumoHandoff | null, campos: string[]): string | null {
  if (!resumo) return null;
  const linhas = (Object.keys(ROTULOS_RESUMO) as (keyof ResumoHandoff)[])
    .filter((k) => campos.includes(k) && resumo[k]?.trim())
    .map((k) => `${ROTULOS_RESUMO[k]}: ${resumo[k].trim()}`);
  return linhas.length ? linhas.join("\n") : null;
}

export function lerNotaResumo(nota: string): Partial<ResumoHandoff> {
  const chaves = Object.keys(ROTULOS_RESUMO) as (keyof ResumoHandoff)[];
  const partes = new Map<keyof ResumoHandoff, string[]>();
  let atual: keyof ResumoHandoff | null = null, anterior = -1;
  for (const linha of nota.replace(/\r\n?/g, "\n").split("\n")) {
    const indice = chaves.findIndex(k => linha.startsWith(ROTULOS_RESUMO[k] + ":"));
    if (indice >= 0) {
      if (indice <= anterior) return {};
      anterior = indice; atual = chaves[indice];
      partes.set(atual, [linha.slice(ROTULOS_RESUMO[atual].length + 1).trimStart()]);
    } else if (atual) partes.get(atual)!.push(linha);
    else return {};
  }
  const resumo: Partial<ResumoHandoff> = {};
  for (const [chave, linhas] of partes) {
    const valor = linhas.join("\n").trim();
    if (valor) resumo[chave] = valor;
  }
  return resumo;
}

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
  if ("bloqueada" in msg && msg.bloqueada === "PAUSADA_DURANTE_TURNO") {
    return tx.acaoAgenteIA.create({
      data: {
        turnoId: i.turnoId,
        atendimentoId: i.ctx.atendimentoId,
        oportunidadeId: i.ctx.oportunidade?.id ?? null,
        acao: "HANDOFF",
        etapaNoMomento: i.ctx.oportunidade?.etapa ?? null,
        modoConfigurado: i.simulado ? "SHADOW" : "SEMPRE",
        status: "BLOQUEADA",
        confianca: 100,
        payload: { motivo: i.motivo, motivoBloqueio: "PAUSADA_DURANTE_TURNO" },
        reversivel: false,
        motivoIrreversivel: "Ação bloqueada: nada foi alterado",
      },
    });
  }
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
  await pausarAriaNoAtendimento(tx, i.ctx.atendimentoId, "HANDOFF", null, { preservarIntencaoId: intencaoId });
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
