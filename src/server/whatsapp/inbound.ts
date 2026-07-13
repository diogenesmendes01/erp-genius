import type { DriverWhatsApp, StatusMensagem, TipoMensagem } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { garantirContato, telefoneDeWaId } from "./identidade";

// INGESTÃO NORMALIZADA (doc 26 §Camada 0): webhook Meta e eventos Evolution são traduzidos
// pelos handlers para este formato ÚNICO antes de tocar o banco. Regras aqui:
// - dedupe por (numeroId, providerMessageId) — retries de webhook não duplicam (S7);
// - fromMe TAMBÉM entra no log (gap 16: mensagem do app do celular vira SAIDA sem origem);
// - inbound cancela intenções automáticas anteriores (lei do despachante, no ingresso).

export interface InboundNormalizado {
  /** Identifica o número da escola: providerRef (phone_number_id/instância) ou telefone E.164. */
  numeroProviderRef?: string | null;
  numeroTelefoneE164?: string | null;
  /** wa_id/remoteJid do contato (sem "+" — normalizado aqui). */
  contatoWaId: string;
  nomeExibicao?: string | null;
  providerMessageId: string;
  corpo: string | null;
  tipo: TipoMensagem;
  driver: DriverWhatsApp;
  /** true = mensagem enviada pela escola FORA do ERP (app do celular / outro aparelho). */
  fromMe: boolean;
  quando: Date;
}

export type ResultadoInbound = "gravada" | "duplicada" | "numero_desconhecido";

export async function processarMensagemNormalizada(m: InboundNormalizado): Promise<ResultadoInbound> {
  const numero = await acharNumero(m);
  if (!numero) return "numero_desconhecido";

  const telefoneContato = telefoneDeWaId(m.contatoWaId);

  try {
    await prisma.$transaction(async (tx) => {
      const contato = await garantirContato(tx, {
        telefoneE164: telefoneContato,
        waId: m.contatoWaId.replace(/\D/g, ""),
        nomeExibicao: m.nomeExibicao ?? null,
      });

      const conversa = await tx.conversaWhatsApp.upsert({
        where: { numeroId_contatoId: { numeroId: numero.id, contatoId: contato.id } },
        create: { numeroId: numero.id, contatoId: contato.id },
        update: {},
      });

      // Dedupe S7: o @@unique(numeroId, providerMessageId) faz o retry do webhook explodir
      // aqui dentro — capturado fora como "duplicada", sem efeito colateral.
      await tx.mensagemWhatsApp.create({
        data: {
          conversaId: conversa.id,
          numeroId: numero.id,
          direcao: m.fromMe ? "SAIDA" : "ENTRADA",
          tipo: m.tipo,
          corpo: m.corpo,
          status: m.fromMe ? "ENVIADA" : "ENTREGUE",
          statusEm: m.quando,
          driver: m.driver,
          origem: null, // fromMe fora do ERP não tem origem HUMANO/CRON/LOTE (gap 16)
          providerMessageId: m.providerMessageId,
          criadoEm: m.quando,
        },
      });

      await tx.conversaWhatsApp.update({
        where: { id: conversa.id },
        data: {
          ultimaMensagemEm: m.quando,
          ...(m.fromMe ? {} : { ultimoInboundEm: m.quando, naoLidas: { increment: 1 } }),
        },
      });

      // LEI DO DESPACHANTE no ingresso: inbound real cancela intenções automáticas
      // pendentes/adiadas criadas ANTES da mensagem (o despachante re-checa no despacho).
      if (!m.fromMe) {
        await tx.intencaoMensagem.updateMany({
          where: {
            contatoId: contato.id,
            status: { in: ["PENDENTE", "ADIADA"] },
            origem: { in: ["CRON", "LOTE"] },
            criadaEm: { lt: m.quando },
          },
          data: { status: "CANCELADA", motivoFalha: "conversa_viva" },
        });
      }
    });
    return "gravada";
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "duplicada";
    throw e;
  }
}

export interface StatusNormalizado {
  numeroProviderRef?: string | null;
  numeroTelefoneE164?: string | null;
  providerMessageId: string;
  status: StatusMensagem;
  quando: Date;
}

/** Progressão só para frente: ENVIADA < ENTREGUE < LIDA (FALHOU sobrescreve qualquer uma). */
const ORDEM_STATUS: Record<StatusMensagem, number> = {
  NA_FILA: 0,
  ENVIADA: 1,
  ENTREGUE: 2,
  LIDA: 3,
  FALHOU: 9,
};

export async function processarStatusNormalizado(s: StatusNormalizado): Promise<"atualizado" | "ignorado"> {
  const numero = await acharNumero(s);
  if (!numero) return "ignorado";

  const msg = await prisma.mensagemWhatsApp.findUnique({
    where: { numeroId_providerMessageId: { numeroId: numero.id, providerMessageId: s.providerMessageId } },
    select: { id: true, status: true },
  });
  if (!msg) return "ignorado"; // status fora de ordem antes da mensagem existir: retry da Meta resolve
  if (ORDEM_STATUS[s.status] <= ORDEM_STATUS[msg.status]) return "ignorado";

  await prisma.mensagemWhatsApp.update({
    where: { id: msg.id },
    data: { status: s.status, statusEm: s.quando },
  });
  return "atualizado";
}

async function acharNumero(ref: { numeroProviderRef?: string | null; numeroTelefoneE164?: string | null }) {
  if (ref.numeroProviderRef) {
    const porRef = await prisma.numeroWhatsApp.findFirst({ where: { providerRef: ref.numeroProviderRef } });
    if (porRef) return porRef;
  }
  if (ref.numeroTelefoneE164) {
    return prisma.numeroWhatsApp.findUnique({ where: { telefoneE164: ref.numeroTelefoneE164 } });
  }
  return null;
}
