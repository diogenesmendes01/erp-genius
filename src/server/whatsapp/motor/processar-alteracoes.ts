import { z } from "zod";
import { registrarEvento } from "@/server/_shared/evento";
import { prisma } from "@/lib/prisma";
import { garantirContato, telefoneDeWaId } from "../identidade";
import { atendimentoDoInbound } from "../atendimentos";
import { acharNumero } from "../inbound";
import type { EnvelopeMotor } from "./eventos";
import { PROCESSADORES, type ResultadoProcessamento } from "./receber";

const DadosEdicaoSchema = z.object({
  mensagemId: z.string().optional(),
  providerMessageId: z.string().min(1),
  texto: z.string().nullish(),
});

const DadosApagadaSchema = z.object({
  mensagemId: z.string().optional(),
  providerMessageId: z.string().min(1),
});

const DadosReacaoSchema = z.object({
  mensagemId: z.string().optional(),
  providerMessageId: z.string().min(1),
  autorJid: z.string().min(1),
  deMim: z.boolean(),
  emoji: z.string().nullish(),
});

const DadosChamadaSchema = z.object({
  chamadaId: z.string().min(1),
  deJid: z.string().nullish(),
  telefoneE164: z.string().nullish(),
  status: z.string().min(1),
  video: z.boolean().nullish(),
  quando: z.number().nullish(),
});

/** A busca é sempre por (numeroId, providerMessageId). */
async function acharMensagem(env: EnvelopeMotor, providerMessageId: string) {
  const numero = await acharNumero({ numeroProviderRef: env.numeroId, driver: "MOTOR" });
  if (!numero) return { erro: { ignorado: "numero_desconhecido" } as ResultadoProcessamento };
  const mensagem = await prisma.mensagemWhatsApp.findUnique({
    where: { numeroId_providerMessageId: { numeroId: numero.id, providerMessageId } },
    select: { id: true, corpo: true, editadaEm: true, apagadaEm: true },
  });
  if (!mensagem) return { erro: { adiar: "mensagem_inexistente" } as ResultadoProcessamento };
  return { mensagem, numeroId: numero.id };
}

export async function processarMensagemEditada(env: EnvelopeMotor): Promise<ResultadoProcessamento> {
  const parsed = DadosEdicaoSchema.safeParse(env.dados);
  if (!parsed.success) return { ignorado: "dados_invalidos" };
  const d = parsed.data;
  // Sem texto não há o que gravar: nunca apagar o corpo original.
  if (d.texto == null) return { ignorado: "dados_invalidos" };
  const texto = d.texto;
  const r = await acharMensagem(env, d.providerMessageId);
  if (r.erro) return r.erro;
  const quando = new Date(env.ocorridoEm);
  await prisma.$transaction(async (tx) => {
    await tx.mensagemWhatsApp.update({ where: { id: r.mensagem.id }, data: { corpo: texto, editadaEm: quando } });
    await registrarEvento(tx, {
      tipo: "MensagemWhatsAppEditada",
      agregadoTipo: "NumeroWhatsApp",
      agregadoId: r.numeroId,
      autorId: null,
      payload: { mensagemId: r.mensagem.id, providerMessageId: d.providerMessageId },
    });
  });
  return "ok";
}

export async function processarMensagemApagada(env: EnvelopeMotor): Promise<ResultadoProcessamento> {
  const parsed = DadosApagadaSchema.safeParse(env.dados);
  if (!parsed.success) return { ignorado: "dados_invalidos" };
  const r = await acharMensagem(env, parsed.data.providerMessageId);
  if (r.erro) return r.erro;
  if (r.mensagem.apagadaEm) return { ignorado: "ja_apagada" };
  const quando = new Date(env.ocorridoEm);
  await prisma.$transaction(async (tx) => {
    // O corpo fica para auditoria; a interface decide como esconder.
    await tx.mensagemWhatsApp.update({ where: { id: r.mensagem.id }, data: { apagadaEm: quando } });
    await registrarEvento(tx, {
      tipo: "MensagemWhatsAppApagada",
      agregadoTipo: "NumeroWhatsApp",
      agregadoId: r.numeroId,
      autorId: null,
      payload: { mensagemId: r.mensagem.id, providerMessageId: parsed.data.providerMessageId },
    });
  });
  return "ok";
}

export async function processarMensagemReacao(env: EnvelopeMotor): Promise<ResultadoProcessamento> {
  const parsed = DadosReacaoSchema.safeParse(env.dados);
  if (!parsed.success) return { ignorado: "dados_invalidos" };
  const d = parsed.data;
  const r = await acharMensagem(env, d.providerMessageId);
  if (r.erro) return r.erro;
  const chave = { mensagemId_autorJid: { mensagemId: r.mensagem.id, autorJid: d.autorJid } };
  if (!d.emoji) {
    await prisma.reacaoMensagemWhatsApp.deleteMany({ where: { mensagemId: r.mensagem.id, autorJid: d.autorJid } });
    return "ok";
  }
  await prisma.reacaoMensagemWhatsApp.upsert({
    where: chave,
    create: { mensagemId: r.mensagem.id, autorJid: d.autorJid, deMim: d.deMim, emoji: d.emoji },
    update: { emoji: d.emoji, deMim: d.deMim },
  });
  return "ok";
}

export async function processarChamadaRecebida(env: EnvelopeMotor): Promise<ResultadoProcessamento> {
  const parsed = DadosChamadaSchema.safeParse(env.dados);
  if (!parsed.success) return { ignorado: "dados_invalidos" };
  const d = parsed.data;
  if (d.status !== "offer" && d.status !== "accept") return { ignorado: "chamada_status" };
  const numero = await acharNumero({ numeroProviderRef: env.numeroId, driver: "MOTOR" });
  if (!numero) return { ignorado: "numero_desconhecido" };
  const digitos = (d.telefoneE164 ?? "").replace(/\D/g, "");
  if (!digitos) {
    console.warn("motor: chamada descartada", { numeroRef: env.numeroId, motivo: "lid_sem_telefone" });
    return { ignorado: "lid_sem_telefone" };
  }

  const providerMessageId = `chamada:${d.chamadaId}`;
  const quando = new Date(d.quando ?? env.ocorridoEm);
  const corpo = d.status === "accept" ? "Atendida no celular" : null;

  return prisma.$transaction(async (tx): Promise<ResultadoProcessamento> => {
    const existente = await tx.mensagemWhatsApp.findUnique({
      where: { numeroId_providerMessageId: { numeroId: numero.id, providerMessageId } },
      select: { id: true, corpo: true },
    });
    if (existente) {
      // Atendida depois do toque: completa a mesma linha, sem duplicar.
      if (d.status === "accept" && existente.corpo !== corpo) {
        await tx.mensagemWhatsApp.update({ where: { id: existente.id }, data: { corpo } });
        return "ok";
      }
      return { ignorado: "duplicada" };
    }

    const contato = await garantirContato(tx, { telefoneE164: telefoneDeWaId(digitos), waId: digitos, nomePerfil: null });
    const conversa = await tx.conversaWhatsApp.upsert({
      where: { numeroId_contatoId: { numeroId: numero.id, contatoId: contato.id } },
      create: { numeroId: numero.id, contatoId: contato.id },
      update: {},
    });
    const mensagem = await tx.mensagemWhatsApp.create({
      data: {
        conversaId: conversa.id,
        numeroId: numero.id,
        direcao: "ENTRADA",
        tipo: "CHAMADA",
        corpo,
        status: "ENTREGUE",
        statusEm: quando,
        driver: "MOTOR",
        providerMessageId,
        criadoEm: quando,
      },
    });
    // Aparece na conversa, mas não soma não lidas nem cancela automação.
    await tx.conversaWhatsApp.update({ where: { id: conversa.id }, data: { ultimaMensagemEm: quando } });
    const atendimentoId = await atendimentoDoInbound(tx, conversa.id, { atribuir: false });
    if (atendimentoId) {
      await tx.mensagemWhatsApp.update({ where: { id: mensagem.id }, data: { atendimentoId } });
      await tx.atendimentoWhatsApp.update({ where: { id: atendimentoId }, data: { ultimaMensagemEm: quando } });
    }
    await registrarEvento(tx, {
      tipo: "ChamadaWhatsAppRecebida",
      agregadoTipo: "NumeroWhatsApp",
      agregadoId: numero.id,
      autorId: null,
      payload: { mensagemId: mensagem.id, chamadaId: d.chamadaId, status: d.status, video: d.video ?? false },
    });
    return "ok";
  });
}

PROCESSADORES["mensagem.editada"] = processarMensagemEditada;
PROCESSADORES["mensagem.apagada"] = processarMensagemApagada;
PROCESSADORES["mensagem.reacao"] = processarMensagemReacao;
PROCESSADORES["chamada.recebida"] = processarChamadaRecebida;
