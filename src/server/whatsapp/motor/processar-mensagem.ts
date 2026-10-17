import { unlink } from "fs/promises";
import type { TipoMensagem } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolverCaminhoUpload } from "@/lib/uploads";
import { acharNumero, processarMensagemNormalizada, type InboundNormalizado } from "../inbound";
import { baixarMidiaMotor, salvarMidiaInbound } from "../midia";
import { DadosMensagemSchema, type DadosMensagem, type EnvelopeMotor } from "./eventos";
import { PROCESSADORES, type ResultadoProcessamento } from "./receber";

/** Tipos do motor (`tipoMotor`) que não cabem no `tipo` genérico do evento. */
export const TIPO_POR_TIPO_MOTOR: Record<string, TipoMensagem> = {
  sticker: "FIGURINHA",
  location: "LOCALIZACAO",
  contact: "CONTATO",
  poll: "ENQUETE",
};

const TIPOS_GENERICOS = new Set<string>(["TEXTO", "IMAGEM", "AUDIO", "VIDEO", "DOCUMENTO", "OUTRO"]);

function tipoDaMensagem(d: DadosMensagem): TipoMensagem {
  if (d.tipoMotor && Object.hasOwn(TIPO_POR_TIPO_MOTOR, d.tipoMotor)) return TIPO_POR_TIPO_MOTOR[d.tipoMotor];
  return TIPOS_GENERICOS.has(d.tipo) ? (d.tipo as TipoMensagem) : "OUTRO";
}

export function inboundDeEventoMotor(
  env: EnvelopeMotor,
  dados: DadosMensagem,
): InboundNormalizado | { descarte: "lid_sem_telefone" | "grupo" } {
  if (dados.ehGrupo) return { descarte: "grupo" };
  const digitos = (dados.contato?.telefoneE164 ?? "").replace(/\D/g, "");
  if (!digitos) {
    // Sem conteúdo no log: só número e motivo.
    console.warn("motor: mensagem descartada", { numeroRef: env.numeroId, motivo: "lid_sem_telefone" });
    return { descarte: "lid_sem_telefone" };
  }
  return {
    numeroProviderRef: env.numeroId,
    contatoWaId: digitos,
    nomeExibicao: dados.contato?.nomePerfil ?? null,
    providerMessageId: dados.providerMessageId,
    mensagemIdMotor: dados.mensagemId,
    corpo: dados.texto ?? null,
    tipo: tipoDaMensagem(dados),
    driver: "MOTOR",
    fromMe: false,
    quando: new Date(dados.quando),
  };
}

async function apagarArquivo(midiaPath: string): Promise<void> {
  const segmentos = midiaPath.slice("/api/files/".length).split("/").filter(Boolean);
  const caminho = resolverCaminhoUpload(segmentos);
  if (caminho) await unlink(caminho).catch(() => undefined);
}

export async function processarMensagemRecebida(env: EnvelopeMotor): Promise<ResultadoProcessamento> {
  const parsed = DadosMensagemSchema.safeParse(env.dados);
  if (!parsed.success) return { ignorado: "dados_invalidos" };
  const dados = parsed.data;
  const inbound = inboundDeEventoMotor(env, dados);
  if ("descarte" in inbound) return { ignorado: inbound.descarte }; // grupo: Task 16

  const numero = await acharNumero(inbound);
  if (!numero) return { ignorado: "numero_desconhecido" };

  const existente = await prisma.mensagemWhatsApp.findUnique({
    where: { numeroId_providerMessageId: { numeroId: numero.id, providerMessageId: inbound.providerMessageId } },
    select: { id: true },
  });
  if (existente) return { ignorado: "duplicada" };

  if (dados.midia) {
    const baixada = await baixarMidiaMotor(env.numeroId, dados.mensagemId);
    if (baixada) inbound.midiaPath = await salvarMidiaInbound(baixada.bytes, baixada.mime);
  }

  let resultado: Awaited<ReturnType<typeof processarMensagemNormalizada>>;
  try {
    resultado = await processarMensagemNormalizada(inbound);
  } catch (e) {
    if (inbound.midiaPath) await apagarArquivo(inbound.midiaPath);
    throw e;
  }
  if (resultado !== "gravada" && inbound.midiaPath) await apagarArquivo(inbound.midiaPath);
  if (resultado === "duplicada") return { ignorado: "duplicada" };
  if (resultado === "numero_desconhecido") return { ignorado: "numero_desconhecido" };
  return "ok";
}

PROCESSADORES["mensagem.recebida"] = processarMensagemRecebida;
