"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessao, registrarEvento, type Resultado } from "@/server/_shared";
import { atendimentoVisivel } from "../atendimentos";
import { despacharFila, despacharMensagemGrupo } from "../despachante";
import { escopoGrupos } from "../escopo";
import { randomUUID } from "node:crypto";
import { contentTypePorExtensao } from "@/lib/uploads";
import { midiaSaidaDoAutor } from "../midia";
import type { ConteudoEspecial } from "../canal";
import type { EnvioInboxResultado } from "../acoes";
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

const ConteudoSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("FIGURINHA") }),
  z.object({ tipo: z.literal("GIF") }),
  z.object({
    tipo: z.literal("ENQUETE"),
    nome: z.string().trim().min(1, "Informe a pergunta da enquete.").max(255, "A pergunta pode ter no máximo 255 caracteres."),
    opcoes: z.array(z.string().trim().min(1, "Opção vazia.").max(100, "Cada opção pode ter no máximo 100 caracteres.")).min(2, "A enquete precisa de ao menos 2 opções.").max(12, "A enquete pode ter no máximo 12 opções."),
    maxEscolhas: z.number().int().min(1, "Escolhas por pessoa: no mínimo 1."),
  }),
  z.object({
    tipo: z.literal("LOCALIZACAO"),
    latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180),
    nome: z.string().trim().min(1).max(255).optional(),
  }),
  z.object({ tipo: z.literal("CONTATO"), contatoJid: z.string().regex(/^\d{8,20}@s\.whatsapp\.net$/, "Contato inválido.") }),
]);
const EnviarConteudoSchema = z.object({ atendimentoId: z.string().min(1), conteudo: ConteudoSchema, midiaUrl: z.string().min(1).optional() });

const TIPO_INTENCAO = { FIGURINHA: "FIGURINHA", GIF: "VIDEO", ENQUETE: "ENQUETE", LOCALIZACAO: "LOCALIZACAO", CONTATO: "CONTATO" } as const;

function resumo(c: ConteudoEspecial): string {
  if (c.tipo === "ENQUETE") return c.nome;
  if (c.tipo === "LOCALIZACAO") return `📍 ${c.nome ?? "Localização"}`;
  return "";
}

/**
 * Enquete, figurinha, GIF, localização ou contato pela inbox. Vira intenção HUMANO e passa pelo despachante
 * (opt-out, kill switch, claim). Figurinha exige webp e GIF exige mp4, ambos subidos pelo próprio autor.
 */
export async function enviarConteudoInbox(input: { atendimentoId: string; conteudo: ConteudoEspecial; midiaUrl?: string }): Promise<Resultado<EnvioInboxResultado>> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const dados = EnviarConteudoSchema.parse(input);
    const c = dados.conteudo as ConteudoEspecial;
    if (c.tipo === "ENQUETE" && c.maxEscolhas > c.opcoes.length) throw new ErroRegra("Escolhas por pessoa não pode passar do número de opções.");
    const a = await atendimentoVisivel(u, dados.atendimentoId, true);
    if (!a || a.encerradoEm) throw new ErroRegra("Conversa não encontrada ou fora do seu escopo.");
    if (!a.numero.ativo) throw new ErroRegra("Este número está inativo.");
    if (a.numero.driver !== "MOTOR") throw new ErroRegra("Este canal não envia esse tipo de conteúdo.");
    if (a.contato.optOutEm) throw new ErroRegra("O contato pediu para não receber mensagens (opt-out). Reative-o antes de enviar.");

    let midiaPath: string | null = null;
    if (c.tipo === "FIGURINHA" || c.tipo === "GIF") {
      const esperado = c.tipo === "FIGURINHA" ? "image/webp" : "video/mp4";
      if (!dados.midiaUrl || !midiaSaidaDoAutor(dados.midiaUrl, u.id)) throw new ErroRegra("Anexo inválido: envie o arquivo pelo uploader da inbox.");
      if (contentTypePorExtensao(dados.midiaUrl) !== esperado) {
        throw new ErroRegra(c.tipo === "FIGURINHA" ? "A figurinha precisa ser uma imagem WebP." : "O GIF precisa ser um vídeo MP4.");
      }
      midiaPath = dados.midiaUrl;
    }

    const intencao = await prisma.intencaoMensagem.create({
      data: {
        numeroId: a.numeroId, atendimentoId: a.id, contatoId: a.contatoId, origem: "HUMANO", tipo: TIPO_INTENCAO[c.tipo],
        conteudo: c as unknown as object, midiaPath, corpoRenderizado: resumo(c), autorId: u.id,
      },
    });
    await despacharFila(new Date(), { intencaoId: intencao.id });
    const final = await prisma.intencaoMensagem.findUnique({ where: { id: intencao.id }, select: { status: true, motivoFalha: true } });
    revalidatePath("/inbox");
    return { status: final?.status ?? "PENDENTE", motivo: final?.motivoFalha ?? null };
  });
}

const INTERVALO_DIGITANDO_MS = 10_000;
const digitandoEm = new Map<string, number>();

/** "Digitando…" no WhatsApp: no máximo uma vez a cada 10 s por usuário e atendimento. Tabela operacional, sem Evento. */
export async function avisarDigitando(atendimentoId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const a = await atendimentoVisivel(u, atendimentoId, true);
    if (!a) throw new ErroRegra("Conversa não encontrada ou fora do seu escopo.");
    if (a.numero.driver !== "MOTOR") return undefined;
    const chave = `${u.id}:${atendimentoId}`;
    const agora = Date.now();
    const ultimo = digitandoEm.get(chave);
    if (ultimo !== undefined && agora - ultimo < INTERVALO_DIGITANDO_MS) return undefined;
    digitandoEm.set(chave, agora);
    if (digitandoEm.size > 5000) for (const [k, t] of digitandoEm) if (agora - t >= INTERVALO_DIGITANDO_MS) digitandoEm.delete(k);
    const digitos = (a.contato.waId ?? a.contato.telefoneE164).replace(/\D/g, "");
    try {
      await executarAcaoMotor(a.numero.providerRef ?? a.numero.id, "presence", { chatId: `${digitos}@s.whatsapp.net`, state: "composing" }, { origem: "HUMANO" });
    } catch (e) { digitandoEm.delete(chave); traduzir(e); }
    return undefined;
  });
}

const EnviarGrupoSchema = z.object({ conversaId: z.string().min(1), texto: z.string().trim().min(1, "Escreva o texto.").max(4096, "O texto pode ter no máximo 4096 caracteres.") });

/**
 * Texto humano para um grupo do WhatsApp (E3.5), dentro do `escopoGrupos` da Fase 3. Grupo não tem atendimento nem
 * automação: cria a `MensagemWhatsApp` SAIDA `NA_FILA` (origem HUMANO, `clientMessageId` novo) e o despachante envia.
 */
export async function enviarMensagemGrupo(input: { conversaId: string; texto: string }): Promise<Resultado<{ status: string }>> {
  return executarAcao(async () => {
    const dados = EnviarGrupoSchema.parse(input);
    const u = await exigirSessao();
    const conversa = await prisma.conversaWhatsApp.findFirst({
      where: { id: dados.conversaId, grupoId: { not: null }, grupo: { is: await escopoGrupos(u) } },
      include: { numero: true, grupo: true },
    });
    if (!conversa?.grupo) throw new ErroRegra("Grupo fora do seu escopo de envio.");
    if (!conversa.numero.ativo) throw new ErroRegra("Este número está inativo.");
    if (conversa.numero.driver !== "MOTOR") throw new ErroRegra("Este canal não envia para grupos.");

    const mensagem = await prisma.mensagemWhatsApp.create({
      data: {
        conversaId: conversa.id, numeroId: conversa.numeroId, direcao: "SAIDA", tipo: "TEXTO", corpo: dados.texto, status: "NA_FILA",
        driver: "MOTOR", origem: "HUMANO", autorId: u.id, clientMessageId: randomUUID(),
      },
    });
    const status = await despacharMensagemGrupo(mensagem.id);
    await prisma.conversaWhatsApp.updateMany({
      where: { id: conversa.id, OR: [{ ultimaMensagemEm: null }, { ultimaMensagemEm: { lt: mensagem.criadoEm } }] },
      data: { ultimaMensagemEm: mensagem.criadoEm },
    });
    revalidatePath("/inbox");
    return { status };
  });
}
