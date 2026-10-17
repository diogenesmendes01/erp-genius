import { unlink } from "fs/promises";
import { Prisma, type TipoMensagem } from "@prisma/client";
import { registrarEvento } from "@/server/_shared/evento";
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
  fromMe = false,
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
    fromMe,
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
  return gravarMensagemMotor(env, parsed.data, false);
}

/**
 * Eco de mensagem `fromMe`. `origem: "erp"` é o envio do próprio ERP (reconcilia, não grava de novo);
 * qualquer outra coisa veio do celular e entra como SAIDA/CELULAR.
 */
export async function processarMensagemEnviada(env: EnvelopeMotor): Promise<ResultadoProcessamento> {
  const parsed = DadosMensagemSchema.safeParse(env.dados);
  if (!parsed.success) return { ignorado: "dados_invalidos" };
  if (parsed.data.origem === "erp") return reconciliarEcoErp(env.numeroId, parsed.data);
  return gravarMensagemMotor(env, parsed.data, true);
}

/**
 * Eco com `origem: "erp"`: o envio já nasceu no ERP (mensagem gravada pelo despachante ou intenção
 * em voo). Nunca cria mensagem; só completa `mensagemIdMotor` ou registra a confirmação de um envio
 * que o ERP deu por incerto. A decisão sobre a intenção continua humana.
 */
export async function reconciliarEcoErp(numeroId: string, dados: DadosMensagem): Promise<ResultadoProcessamento> {
  const numero = await acharNumero({ numeroProviderRef: numeroId, driver: "MOTOR" });
  if (!numero) return { ignorado: "numero_desconhecido" };

  const cid = dados.clientMessageId ?? null;
  const ou: Prisma.MensagemWhatsAppWhereInput[] = [{ providerMessageId: dados.providerMessageId }];
  if (cid) ou.push({ clientMessageId: cid });
  const msg = await prisma.mensagemWhatsApp.findFirst({ where: { numeroId: numero.id, OR: ou }, select: { id: true, mensagemIdMotor: true } });
  if (msg) {
    if (!msg.mensagemIdMotor) {
      await prisma.mensagemWhatsApp.updateMany({ where: { id: msg.id, mensagemIdMotor: null }, data: { mensagemIdMotor: dados.mensagemId } });
    }
    return "ok";
  }

  if (!cid) return { ignorado: "eco_sem_origem" };
  const intencao = await prisma.intencaoMensagem.findFirst({
    where: { clientMessageId: cid, numeroId: numero.id },
    select: { id: true, status: true, motivoFalha: true },
  });
  if (!intencao) return { ignorado: "eco_sem_origem" };
  if (intencao.status === "ENVIANDO") return { adiar: "intencao_enviando" };
  if (intencao.status === "FALHOU" && intencao.motivoFalha === "resultado_incerto") {
    await prisma.$transaction(async (tx) => {
      const jaRegistrado = await tx.evento.findFirst({
        where: { tipo: "EnvioIncertoConfirmadoPeloMotor", agregadoTipo: "IntencaoMensagem", agregadoId: intencao.id },
        select: { id: true },
      });
      if (jaRegistrado) return;
      await registrarEvento(tx, {
        tipo: "EnvioIncertoConfirmadoPeloMotor",
        agregadoTipo: "IntencaoMensagem",
        agregadoId: intencao.id,
        autorId: null,
        payload: { clientMessageId: cid, providerMessageId: dados.providerMessageId, mensagemIdMotor: dados.mensagemId },
      });
    });
    return "ok";
  }
  return { ignorado: "eco_sem_origem" };
}

async function gravarMensagemMotor(env: EnvelopeMotor, dados: DadosMensagem, fromMe: boolean): Promise<ResultadoProcessamento> {
  const inbound = inboundDeEventoMotor(env, dados, fromMe);
  if ("descarte" in inbound) return { ignorado: inbound.descarte }; // grupo: Task 16

  const numero = await acharNumero(inbound);
  if (!numero) return { ignorado: "numero_desconhecido" };

  const existente = await prisma.mensagemWhatsApp.findUnique({
    where: { numeroId_providerMessageId: { numeroId: numero.id, providerMessageId: inbound.providerMessageId } },
    select: { id: true },
  });
  if (existente) return { ignorado: "duplicada" };
  if (fromMe && dados.clientMessageId) {
    // Eco rotulado "celular" de um envio que o ERP já conhece: não duplica.
    const doErp = await prisma.mensagemWhatsApp.findFirst({ where: { numeroId: numero.id, clientMessageId: dados.clientMessageId }, select: { id: true } });
    if (doErp) return { ignorado: "duplicada" };
  }

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
PROCESSADORES["mensagem.enviada"] = processarMensagemEnviada;
