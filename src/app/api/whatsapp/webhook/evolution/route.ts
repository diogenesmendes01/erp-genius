import { NextResponse } from "next/server";
import type { StatusMensagem, TipoMensagem } from "@prisma/client";
import { processarMensagemNormalizada, processarStatusNormalizado } from "@/server/whatsapp/inbound";

// WEBHOOK EVOLUTION (Baileys) — doc 26 §Camada 0. Autenticação por token compartilhado
// (header `apikey`, configurado no webhook da instância Evolution → EVOLUTION_WEBHOOK_TOKEN).
// Ingestão inclui fromMe=true (gap 16 do doc 28): mensagem que o vendedor manda pelo APP DO
// CELULAR entra no log como SAIDA sem origem — thread completa, régua não cobra lead já
// atendido, IA (E6) lê a conversa inteira.

export const runtime = "nodejs";

const TIPO_POR_EVOLUTION: Record<string, TipoMensagem> = {
  conversation: "TEXTO",
  extendedTextMessage: "TEXTO",
  imageMessage: "IMAGEM",
  audioMessage: "AUDIO",
  videoMessage: "VIDEO",
  documentMessage: "DOCUMENTO",
};

// Ack do Baileys: 1=enviada ao servidor · 2=entregue · 3/4=lida/tocada.
const STATUS_POR_ACK: Record<number, StatusMensagem> = {
  1: "ENVIADA",
  2: "ENTREGUE",
  3: "LIDA",
  4: "LIDA",
};

interface EventoEvolution {
  event?: string;
  instance?: string;
  data?: {
    key?: { remoteJid?: string; fromMe?: boolean; id?: string };
    pushName?: string;
    status?: string;
    message?: Record<string, unknown> & { conversation?: string; extendedTextMessage?: { text?: string } };
    messageTimestamp?: number | string;
    ack?: number;
  };
}

function corpoDe(msg: EventoEvolution["data"]): { corpo: string | null; tipo: TipoMensagem } {
  const m = msg?.message;
  if (!m) return { corpo: null, tipo: "OUTRO" };
  if (typeof m.conversation === "string") return { corpo: m.conversation, tipo: "TEXTO" };
  if (m.extendedTextMessage?.text) return { corpo: m.extendedTextMessage.text, tipo: "TEXTO" };
  const chave = Object.keys(m).find((k) => TIPO_POR_EVOLUTION[k]);
  return { corpo: null, tipo: chave ? TIPO_POR_EVOLUTION[chave] : "OUTRO" };
}

export async function POST(req: Request): Promise<NextResponse> {
  const esperado = process.env.EVOLUTION_WEBHOOK_TOKEN;
  if (!esperado || req.headers.get("apikey") !== esperado) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  let evento: EventoEvolution;
  try {
    evento = (await req.json()) as EventoEvolution;
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    const dados = evento.data;
    const jid = dados?.key?.remoteJid ?? "";
    // Filtro de tráfego não-conversacional (gap 18): grupos (@g.us), broadcast e status
    // NUNCA entram no log — só conversa 1:1 (@s.whatsapp.net).
    if (!jid.endsWith("@s.whatsapp.net")) return NextResponse.json({ ok: true });
    const waId = jid.replace("@s.whatsapp.net", "");

    if (evento.event === "messages.upsert" && dados?.key?.id) {
      const { corpo, tipo } = corpoDe(dados);
      const ts = dados.messageTimestamp;
      await processarMensagemNormalizada({
        numeroProviderRef: evento.instance ?? null,
        contatoWaId: waId,
        nomeExibicao: dados.pushName ?? null,
        providerMessageId: dados.key.id,
        corpo,
        tipo,
        driver: "BAILEYS",
        fromMe: dados.key.fromMe === true,
        quando: ts ? new Date(Number(ts) * 1000) : new Date(),
      });
    } else if (evento.event === "messages.update" && dados?.key?.id) {
      const status =
        typeof dados.ack === "number"
          ? STATUS_POR_ACK[dados.ack]
          : dados.status === "READ"
            ? "LIDA"
            : dados.status === "DELIVERY_ACK"
              ? "ENTREGUE"
              : dados.status === "SERVER_ACK"
                ? "ENVIADA"
                : undefined;
      if (status) {
        await processarStatusNormalizado({
          numeroProviderRef: evento.instance ?? null,
          providerMessageId: dados.key.id,
          status,
          quando: new Date(),
        });
      }
    }
  } catch (e) {
    console.error("[webhook evolution] erro ao processar:", e);
  }
  return NextResponse.json({ ok: true });
}
