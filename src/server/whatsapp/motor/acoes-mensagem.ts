"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessao, registrarEvento, type Resultado } from "@/server/_shared";
import { atendimentoVisivel } from "../atendimentos";
import { executarAcaoMotor } from "./acoes";
import { ErroMotor, MENSAGEM_LIMITE_RITMO } from "./cliente";

const JANELA_EDICAO_MS = 15 * 60_000;

const EditarSchema = z.object({ mensagemId: z.string().min(1), texto: z.string().trim().min(1, "Escreva o texto.").max(4096, "O texto pode ter no máximo 4096 caracteres.") });
const ApagarSchema = z.object({ mensagemId: z.string().min(1) });

/** Carrega a mensagem própria, de saída pelo motor, dentro do escopo de envio; qualquer falha é ErroRegra sem tocar o motor. */
async function mensagemPropria(mensagemId: string, verbo: "editar" | "apagar") {
  const u = await exigirSessao();
  const m = await prisma.mensagemWhatsApp.findUnique({
    where: { id: mensagemId },
    include: { numero: { select: { id: true, driver: true, providerRef: true } } },
  });
  if (!m?.atendimentoId || !(await atendimentoVisivel(u, m.atendimentoId, true))) throw new ErroRegra("Mensagem fora do seu escopo de envio.");
  if (m.direcao !== "SAIDA" || m.autorId !== u.id) throw new ErroRegra(`Só é possível ${verbo} as próprias mensagens.`);
  if (m.numero.driver !== "MOTOR" || !m.mensagemIdMotor) throw new ErroRegra(`Esta mensagem não pode ser ${verbo === "editar" ? "editada" : "apagada"} neste canal.`);
  if (m.apagadaEm) throw new ErroRegra("Esta mensagem já foi apagada.");
  return { u, m, numeroRef: m.numero.providerRef ?? m.numero.id, mensagemIdMotor: m.mensagemIdMotor };
}

function traduzir(e: unknown): never {
  if (e instanceof ErroMotor) {
    if (e.codigo === "LIMITE_RITMO") throw new ErroRegra(MENSAGEM_LIMITE_RITMO);
    throw new ErroRegra("O motor do WhatsApp não executou a ação. Tente de novo em instantes.");
  }
  throw e;
}

/** Edita a própria mensagem de texto até 15 min depois do envio (message.edit no motor). */
export async function editarMensagemWhatsApp(input: { mensagemId: string; texto: string }): Promise<Resultado> {
  return executarAcao(async () => {
    const dados = EditarSchema.parse(input);
    const { u, m, numeroRef, mensagemIdMotor } = await mensagemPropria(dados.mensagemId, "editar");
    if (m.tipo !== "TEXTO") throw new ErroRegra("Só é possível editar mensagens de texto.");
    if (Date.now() - m.criadoEm.getTime() > JANELA_EDICAO_MS) throw new ErroRegra("Só é possível editar até 15 minutos após o envio.");
    try {
      await executarAcaoMotor(numeroRef, "message.edit", { messageId: mensagemIdMotor, text: dados.texto }, { origem: "HUMANO" });
    } catch (e) { traduzir(e); }
    await prisma.$transaction(async (tx) => {
      await tx.mensagemWhatsApp.update({ where: { id: m.id }, data: { corpo: dados.texto, editadaEm: new Date() } });
      await registrarEvento(tx, {
        tipo: "MensagemWhatsAppEditada", agregadoTipo: "AtendimentoWhatsApp", agregadoId: m.atendimentoId!, autorId: u.id,
        payload: { mensagemId: m.id, antes: m.corpo, depois: dados.texto },
      });
    });
    revalidatePath("/inbox");
    return undefined;
  });
}

/** Apaga para todos a própria mensagem (message.delete no motor); o corpo fica guardado, só `apagadaEm` marca. */
export async function apagarMensagemWhatsApp(input: { mensagemId: string }): Promise<Resultado> {
  return executarAcao(async () => {
    const dados = ApagarSchema.parse(input);
    const { u, m, numeroRef, mensagemIdMotor } = await mensagemPropria(dados.mensagemId, "apagar");
    try {
      await executarAcaoMotor(numeroRef, "message.delete", { messageId: mensagemIdMotor, forEveryone: true }, { origem: "HUMANO" });
    } catch (e) { traduzir(e); }
    await prisma.$transaction(async (tx) => {
      await tx.mensagemWhatsApp.update({ where: { id: m.id }, data: { apagadaEm: new Date() } });
      await registrarEvento(tx, {
        tipo: "MensagemWhatsAppApagada", agregadoTipo: "AtendimentoWhatsApp", agregadoId: m.atendimentoId!, autorId: u.id,
        payload: { mensagemId: m.id, mensagemIdMotor },
      });
    });
    revalidatePath("/inbox");
    return undefined;
  });
}

const ReagirSchema = z.object({ mensagemId: z.string().min(1), emoji: z.string().max(32, "A reação pode ter no máximo 32 caracteres.") });
const EncaminharSchema = z.object({ mensagemId: z.string().min(1), atendimentoDestinoId: z.string().min(1) });

/** Reação do atendente: `autorJid` provisório até o eco do motor (que reaproveita a linha `deMim`). `""` remove. */
export async function reagirMensagemWhatsApp(input: { mensagemId: string; emoji: string }): Promise<Resultado> {
  return executarAcao(async () => {
    const dados = ReagirSchema.parse(input);
    const u = await exigirSessao();
    const m = await prisma.mensagemWhatsApp.findUnique({
      where: { id: dados.mensagemId },
      include: { numero: { select: { id: true, driver: true, providerRef: true } } },
    });
    if (!m?.atendimentoId || !(await atendimentoVisivel(u, m.atendimentoId, true))) throw new ErroRegra("Mensagem fora do seu escopo de envio.");
    if (m.numero.driver !== "MOTOR" || !m.mensagemIdMotor) throw new ErroRegra("Esta mensagem não pode receber reação neste canal.");
    if (m.apagadaEm) throw new ErroRegra("Esta mensagem já foi apagada.");
    try {
      await executarAcaoMotor(m.numero.providerRef ?? m.numero.id, "message.react", { messageId: m.mensagemIdMotor, emoji: dados.emoji }, { origem: "HUMANO" });
    } catch (e) { traduzir(e); }
    const minha = await prisma.reacaoMensagemWhatsApp.findFirst({ where: { mensagemId: m.id, deMim: true } });
    if (!dados.emoji) {
      await prisma.reacaoMensagemWhatsApp.deleteMany({ where: { mensagemId: m.id, deMim: true } });
    } else if (minha) {
      await prisma.reacaoMensagemWhatsApp.update({ where: { id: minha.id }, data: { emoji: dados.emoji, usuarioId: u.id } });
    } else {
      await prisma.reacaoMensagemWhatsApp.create({ data: { mensagemId: m.id, autorJid: `erp:${m.numero.id}`, deMim: true, emoji: dados.emoji, usuarioId: u.id } });
    }
    revalidatePath("/inbox");
    return undefined;
  });
}

/** Encaminha pelo motor (message.forward) para outra conversa do MESMO número e registra a mensagem como HUMANO. */
export async function encaminharMensagemWhatsApp(input: { mensagemId: string; atendimentoDestinoId: string }): Promise<Resultado> {
  return executarAcao(async () => {
    const dados = EncaminharSchema.parse(input);
    const u = await exigirSessao();
    const m = await prisma.mensagemWhatsApp.findUnique({
      where: { id: dados.mensagemId },
      include: { numero: { select: { id: true, driver: true, providerRef: true } } },
    });
    if (!m?.atendimentoId || !(await atendimentoVisivel(u, m.atendimentoId))) throw new ErroRegra("Mensagem de origem fora do seu escopo.");
    if (m.numero.driver !== "MOTOR" || !m.mensagemIdMotor) throw new ErroRegra("Esta mensagem não pode ser encaminhada neste canal.");
    if (m.apagadaEm) throw new ErroRegra("Esta mensagem já foi apagada.");
    const d = await atendimentoVisivel(u, dados.atendimentoDestinoId, true);
    if (!d || d.encerradoEm) throw new ErroRegra("Destino fora do seu escopo.");
    if (!d.numero.ativo) throw new ErroRegra("O destino está em número inativo.");
    if (d.contato.optOutEm) throw new ErroRegra("O destino pediu para não receber mensagens (opt-out).");
    if (d.numeroId !== m.numeroId) throw new ErroRegra("Encaminhe só entre conversas do mesmo número.");

    const digitos = (d.contato.waId ?? d.contato.telefoneE164).replace(/\D/g, "");
    const chatId = `${digitos}@s.whatsapp.net`;
    let resp: { key?: { id?: string; remoteJid?: string } } | undefined;
    try {
      resp = await executarAcaoMotor(m.numero.providerRef ?? m.numero.id, "message.forward", { messageId: m.mensagemIdMotor, chatId }, { origem: "HUMANO" });
    } catch (e) { traduzir(e); }
    const providerMessageId = resp?.key?.id ?? null;
    const mensagemIdMotor = providerMessageId ? `${resp?.key?.remoteJid ?? chatId}:${providerMessageId}` : null;

    await prisma.$transaction(async (tx) => {
      let destinoMensagemId: string | null = null;
      if (providerMessageId) {
        // O eco do celular pode ter chegado antes desta resposta: o upsert corrige para HUMANO sem duplicar.
        const agora = new Date();
        const gravada = await tx.mensagemWhatsApp.upsert({
          where: { numeroId_providerMessageId: { numeroId: m.numeroId, providerMessageId } },
          create: {
            conversaId: d.transporteId, numeroId: m.numeroId, atendimentoId: d.id, direcao: "SAIDA", tipo: m.tipo, corpo: m.corpo, midiaPath: m.midiaPath,
            status: "ENVIADA", statusEm: agora, driver: "MOTOR", origem: "HUMANO", providerMessageId, mensagemIdMotor, autorId: u.id, criadoEm: agora,
          },
          update: { origem: "HUMANO", autorId: u.id, atendimentoId: d.id, conversaId: d.transporteId, ...(mensagemIdMotor ? { mensagemIdMotor } : {}) },
        });
        destinoMensagemId = gravada.id;
        await tx.conversaWhatsApp.updateMany({ where: { id: d.transporteId, OR: [{ ultimaMensagemEm: null }, { ultimaMensagemEm: { lt: gravada.criadoEm } }] }, data: { ultimaMensagemEm: gravada.criadoEm } });
      }
      await registrarEvento(tx, {
        tipo: "MensagemWhatsAppEncaminhada", agregadoTipo: "AtendimentoWhatsApp", agregadoId: m.atendimentoId!, autorId: u.id,
        payload: { mensagemId: m.id, atendimentoDestinoId: d.id, destinoMensagemId, providerMessageId },
      });
    });
    revalidatePath("/inbox");
    return undefined;
  });
}
