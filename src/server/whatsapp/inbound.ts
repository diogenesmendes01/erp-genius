import type { DriverWhatsApp, StatusMensagem, TipoMensagem } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/server/_shared/evento";
import {
  capturarComercial,
  capturarRespostaExperimental,
  type ReferralInbound,
} from "@/server/comercial/captura";
import { despacharFila } from "./despachante";
import { garantirContato, telefoneDeWaId } from "./identidade";

// INGESTÃO NORMALIZADA (doc 26 §Camada 0): webhook Meta e eventos Evolution são traduzidos
// pelos handlers para este formato ÚNICO antes de tocar o banco. Regras aqui:
// - dedupe por (numeroId, providerMessageId) — retries de webhook não duplicam (S7);
// - fromMe TAMBÉM entra no log (gap 16: mensagem do app do celular vira SAIDA sem origem);
// - inbound cancela intenções automáticas anteriores (lei do despachante, no ingresso);
// - keyword de opt-out marca o contato no ingresso (S10 — a LEI já vive no despachante).

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
  /** URL canônica /api/files/... do binário já baixado pelo webhook (E3 — gap A3). */
  midiaPath?: string | null;
  driver: DriverWhatsApp;
  /** true = mensagem enviada pela escola FORA do ERP (app do celular / outro aparelho). */
  fromMe: boolean;
  /** Bloco referral do click-to-WhatsApp (Meta) → origem do lead na auto-captura (C1). */
  referral?: ReferralInbound | null;
  quando: Date;
}

// Captura de opt-out por keyword (doc 30 S10, UI/captura na E3): match EXATO e
// conservador — frase solta que contenha a palavra não conta (falso positivo mataria a
// régua de um contato que disse "vou parar de atrasar").
const KEYWORDS_OPT_OUT = new Set(["sair", "parar", "stop", "baja", "no enviar", "unsubscribe"]);

export function ehPedidoOptOut(corpo: string | null): boolean {
  if (!corpo) return false;
  return KEYWORDS_OPT_OUT.has(corpo.trim().toLowerCase());
}

export type ResultadoInbound = "gravada" | "duplicada" | "numero_desconhecido";

export async function processarMensagemNormalizada(m: InboundNormalizado): Promise<ResultadoInbound> {
  const numero = await acharNumero(m);
  if (!numero) return "numero_desconhecido";

  const telefoneContato = telefoneDeWaId(m.contatoWaId);
  let saudacaoIntencaoId: string | null = null;

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

      // 1º inbound da conversa? CLAIM ATÔMICO (review PR #53 P1): o updateMany condicional
      // (capturadaEm IS NULL) toma o lock da linha — dois inbounds concorrentes do mesmo
      // contato não passam ambos, então nasce no máximo um lead/saudação por conversa.
      let primeiroInbound = false;
      if (!m.fromMe) {
        const claim = await tx.conversaWhatsApp.updateMany({
          where: { id: conversa.id, capturadaEm: null },
          data: { capturadaEm: m.quando },
        });
        primeiroInbound = claim.count === 1;
      }

      // Dedupe S7: o @@unique(numeroId, providerMessageId) faz o retry do webhook explodir
      // aqui dentro — capturado fora como "duplicada", sem efeito colateral.
      await tx.mensagemWhatsApp.create({
        data: {
          conversaId: conversa.id,
          numeroId: numero.id,
          direcao: m.fromMe ? "SAIDA" : "ENTRADA",
          tipo: m.tipo,
          corpo: m.corpo,
          midiaPath: m.midiaPath ?? null,
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

        // Opt-out por keyword (S10): marca o contato + evento auditável (autor = sistema).
        // A LEI que respeita o opt-out já mora no despachante; aqui é só a captura.
        const optOutAgora = !contato.optOutEm && ehPedidoOptOut(m.corpo);
        if (optOutAgora) {
          await tx.contatoWhatsApp.update({
            where: { id: contato.id },
            data: { optOutEm: m.quando },
          });
          await registrarEvento(tx, {
            tipo: "OptOutRegistrado",
            agregadoTipo: "ContatoWhatsApp",
            agregadoId: contato.id,
            autorId: null,
            payload: { via: "keyword", palavra: (m.corpo ?? "").trim().toLowerCase() },
          });
        }

        // C1 (doc 27): auto-captura de lead + saudação no 1º inbound de um número de vendas.
        // Só dispara se a ConfigComercial estiver ligada (nasce desligada); nunca sobre um
        // opt-out imediato. O contato de garantirContato traz os vínculos preservados.
        const captura = await capturarComercial(tx, {
          numero: { id: numero.id, finalidade: numero.finalidade, donoId: numero.donoId },
          contato: {
            id: contato.id,
            telefoneE164: contato.telefoneE164,
            nomeExibicao: contato.nomeExibicao,
            alunoId: contato.alunoId,
            responsavelId: contato.responsavelId,
            leadId: contato.leadId,
            optOut: !!contato.optOutEm || optOutAgora,
          },
          primeiroInbound,
          quando: m.quando,
          referral: m.referral ?? null,
        });
        saudacaoIntencaoId = captura.saudacaoIntencaoId;

        // C2 (doc 27): resposta à confirmação da experimental ("SIM"/"REAGENDAR" — fallback
        // textual do Baileys). Só vale com experimental AGENDADA; o vínculo do contato pode
        // ter acabado de ser criado pela captura acima.
        const leadDoContato = captura.leadCriadoId ?? contato.leadId;
        if (!optOutAgora) {
          await capturarRespostaExperimental(tx, {
            leadId: leadDoContato,
            corpo: m.corpo,
            quando: m.quando,
          });
        }
      }
    });
    // Saudação "em segundos" (reativa): despacha JÁ, fora da transação. ESCOPADO à intenção
    // recém-criada (review PR #53 P2) — nunca drena a fila global (cobranças/lotes sem
    // relação) a partir de um inbound. Sem WHATSAPP_LIVE=1 vira SIMULADA; falha não derruba
    // o webhook.
    if (saudacaoIntencaoId) {
      try {
        await despacharFila(new Date(), { intencaoId: saudacaoIntencaoId });
      } catch (e) {
        console.error("[inbound] falha ao despachar saudação reativa:", e);
      }
    }
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
  driver: DriverWhatsApp;
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

// providerRef só identifica DENTRO do driver (phone_number_id da Meta × instância da
// Evolution são namespaces distintos) — o lookup filtra por driver e o schema garante
// @@unique([driver, providerRef]) (review PR #51 P2-6: sem isso, dois números com a mesma
// referência roteariam mensagens para a conversa/dono errados).
async function acharNumero(ref: {
  numeroProviderRef?: string | null;
  numeroTelefoneE164?: string | null;
  driver: DriverWhatsApp;
}) {
  if (ref.numeroProviderRef) {
    const porRef = await prisma.numeroWhatsApp.findFirst({
      where: { providerRef: ref.numeroProviderRef, driver: ref.driver },
    });
    if (porRef) return porRef;
  }
  if (ref.numeroTelefoneE164) {
    return prisma.numeroWhatsApp.findUnique({ where: { telefoneE164: ref.numeroTelefoneE164 } });
  }
  return null;
}
