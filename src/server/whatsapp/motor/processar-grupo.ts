import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { acharNumero } from "../inbound";
import { baixarMidiaMotor, salvarMidiaInbound } from "../midia";
import { executarAcaoMotor } from "./acoes";
import type { DadosMensagem, EnvelopeMotor } from "./eventos";
import { apagarArquivo, tipoDaMensagem } from "./processar-mensagem";
import { PROCESSADORES, type ResultadoProcessamento } from "./receber";

/**
 * Mensagem de grupo (E3.5): grava grupo, conversa e mensagem com o remetente (`participante*`).
 * Sem atendimento, sem cancelar automação do participante e sem opt-out por palavra: o grupo é
 * um canal coletivo e a palavra de um participante não fala pelo contato individual.
 */
export async function processarMensagemGrupo(env: EnvelopeMotor, dados: DadosMensagem, fromMe: boolean): Promise<ResultadoProcessamento> {
  const numero = await acharNumero({ numeroProviderRef: env.numeroId, driver: "MOTOR" });
  if (!numero) return { ignorado: "numero_desconhecido" };

  const existente = await prisma.mensagemWhatsApp.findUnique({
    where: { numeroId_providerMessageId: { numeroId: numero.id, providerMessageId: dados.providerMessageId } },
    select: { id: true },
  });
  if (existente) return { ignorado: "duplicada" };
  if (fromMe && dados.clientMessageId) {
    const doErp = await prisma.mensagemWhatsApp.findFirst({ where: { numeroId: numero.id, clientMessageId: dados.clientMessageId }, select: { id: true } });
    if (doErp) return { ignorado: "duplicada" };
  }

  let midiaPath: string | undefined;
  if (dados.midia) {
    const baixada = await baixarMidiaMotor(env.numeroId, dados.mensagemId);
    if (baixada) midiaPath = (await salvarMidiaInbound(baixada.bytes, baixada.mime)) ?? undefined;
  }

  const quando = new Date(dados.quando);
  const participante = dados.participante ?? null;
  try {
    await prisma.$transaction(async (tx) => {
      // Nome provisório = JID; `grupo.atualizado` troca pelo assunto real.
      const grupo = await tx.grupoWhatsApp.upsert({
        where: { numeroId_grupoJid: { numeroId: numero.id, grupoJid: dados.chatJid } },
        create: { numeroId: numero.id, grupoJid: dados.chatJid, nome: dados.chatJid },
        update: {},
      });
      const conversa = await tx.conversaWhatsApp.upsert({
        where: { numeroId_grupoId: { numeroId: numero.id, grupoId: grupo.id } },
        create: { numeroId: numero.id, grupoId: grupo.id },
        update: {},
      });
      await tx.mensagemWhatsApp.create({
        data: {
          conversaId: conversa.id,
          numeroId: numero.id,
          direcao: fromMe ? "SAIDA" : "ENTRADA",
          tipo: tipoDaMensagem(dados),
          corpo: dados.texto ?? null,
          midiaPath: midiaPath ?? null,
          status: fromMe ? "ENVIADA" : "ENTREGUE",
          statusEm: quando,
          driver: "MOTOR",
          origem: fromMe ? "CELULAR" : null,
          providerMessageId: dados.providerMessageId,
          mensagemIdMotor: dados.mensagemId,
          participanteJid: participante?.jid ?? null,
          participanteE164: participante?.telefoneE164 ?? null,
          participanteNome: participante?.nomePerfil ?? null,
          criadoEm: quando,
        },
      });
      await tx.conversaWhatsApp.update({
        where: { id: conversa.id },
        data: { ultimaMensagemEm: quando, ...(fromMe ? {} : { ultimoInboundEm: quando, naoLidas: { increment: 1 } }) },
      });
    });
  } catch (e) {
    if (midiaPath) await apagarArquivo(midiaPath);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ignorado: "duplicada" };
    throw e;
  }
  return "ok";
}

const DadosGrupoAtualizadoSchema = z.object({ grupoJid: z.string().min(1) });

/** `grupo.atualizado`: busca o assunto no motor e atualiza `GrupoWhatsApp.nome`. */
export async function processarGrupoAtualizado(env: EnvelopeMotor): Promise<ResultadoProcessamento> {
  const parsed = DadosGrupoAtualizadoSchema.safeParse(env.dados);
  if (!parsed.success) return { ignorado: "dados_invalidos" };
  const numero = await acharNumero({ numeroProviderRef: env.numeroId, driver: "MOTOR" });
  if (!numero) return { ignorado: "numero_desconhecido" };
  const grupo = await prisma.grupoWhatsApp.findUnique({
    where: { numeroId_grupoJid: { numeroId: numero.id, grupoJid: parsed.data.grupoJid } },
    select: { id: true },
  });
  if (!grupo) return { ignorado: "grupo_desconhecido" };

  const detalhes = await executarAcaoMotor<{ subject?: string | null }>(numero.id, "group.details", { id: parsed.data.grupoJid });
  const nome = detalhes?.subject?.trim();
  if (!nome) return { ignorado: "grupo_sem_nome" };
  await prisma.grupoWhatsApp.update({ where: { id: grupo.id }, data: { nome } });
  return "ok";
}

PROCESSADORES["grupo.atualizado"] = processarGrupoAtualizado;
