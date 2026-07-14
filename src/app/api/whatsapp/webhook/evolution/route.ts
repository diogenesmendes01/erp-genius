import { NextResponse } from "next/server";
import type { StatusMensagem, TipoMensagem } from "@prisma/client";
import { processarMensagemNormalizada, processarStatusNormalizado } from "@/server/whatsapp/inbound";
import { baixarMidiaEvolution, salvarMidiaInbound } from "@/server/whatsapp/midia";
import { aplicarEstadoSessaoPorInstancia } from "@/server/whatsapp/sessao";
import { prisma } from "@/lib/prisma";

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

interface MidiaEvolution {
  mimetype?: string;
  caption?: string;
  fileName?: string;
}

interface EventoEvolution {
  event?: string;
  instance?: string;
  data?: {
    key?: { remoteJid?: string; fromMe?: boolean; id?: string };
    pushName?: string;
    status?: string;
    state?: string; // connection.update
    message?: Record<string, unknown> & {
      conversation?: string;
      extendedTextMessage?: { text?: string };
      base64?: string; // instância configurada com base64:true manda o binário junto
    };
    messageTimestamp?: number | string;
    ack?: number;
  };
}

function corpoDe(msg: EventoEvolution["data"]): {
  corpo: string | null;
  tipo: TipoMensagem;
  midia: MidiaEvolution | null;
} {
  const m = msg?.message;
  if (!m) return { corpo: null, tipo: "OUTRO", midia: null };
  if (typeof m.conversation === "string") return { corpo: m.conversation, tipo: "TEXTO", midia: null };
  if (m.extendedTextMessage?.text) return { corpo: m.extendedTextMessage.text, tipo: "TEXTO", midia: null };
  const chave = Object.keys(m).find((k) => TIPO_POR_EVOLUTION[k]);
  if (!chave) return { corpo: null, tipo: "OUTRO", midia: null };
  const midia = (m[chave] ?? null) as MidiaEvolution | null;
  return {
    corpo: midia?.caption ?? midia?.fileName ?? null,
    tipo: TIPO_POR_EVOLUTION[chave],
    midia,
  };
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

    // Estado da sessão (doc 26 §Camada 0/E3): conexão abre/cai → atualiza o número e
    // grava os eventos de domínio (NumeroWhatsAppConectado / SessaoBaileysCaiu).
    if (evento.event === "connection.update" && evento.instance) {
      await aplicarEstadoSessaoPorInstancia(evento.instance, dados?.state ?? null);
      return NextResponse.json({ ok: true });
    }
    if (evento.event === "qrcode.updated" && evento.instance) {
      await prisma.numeroWhatsApp.updateMany({
        where: { providerRef: evento.instance, driver: "BAILEYS", sessao: { not: "CONECTADO" } },
        data: { sessao: "AGUARDANDO_QR" },
      });
      return NextResponse.json({ ok: true });
    }

    const jid = dados?.key?.remoteJid ?? "";
    // Filtro de tráfego não-conversacional (gap 18): grupos (@g.us), broadcast e status
    // NUNCA entram no log — só conversa 1:1 (@s.whatsapp.net).
    if (!jid.endsWith("@s.whatsapp.net")) return NextResponse.json({ ok: true });
    const waId = jid.replace("@s.whatsapp.net", "");

    if (evento.event === "messages.upsert" && dados?.key?.id) {
      const { corpo, tipo, midia } = corpoDe(dados);
      const ts = dados.messageTimestamp;

      // Mídia inbound: usa o base64 do próprio webhook (instância com base64:true) ou
      // busca na API; falha não perde a mensagem (entra sem binário — gap A3/D28).
      let midiaPath: string | null = null;
      if (midia && evento.instance) {
        const baixada = await baixarMidiaEvolution(
          evento.instance,
          dados.key.id,
          dados.message?.base64 ?? null,
          midia.mimetype ?? null,
        );
        if (baixada) midiaPath = await salvarMidiaInbound(baixada.bytes, baixada.mime || midia.mimetype);
      }

      await processarMensagemNormalizada({
        numeroProviderRef: evento.instance ?? null,
        contatoWaId: waId,
        nomeExibicao: dados.pushName ?? null,
        providerMessageId: dados.key.id,
        corpo,
        tipo,
        midiaPath,
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
          driver: "BAILEYS",
          quando: new Date(),
        });
      }
    }
  } catch (e) {
    console.error("[webhook evolution] erro ao processar:", e);
  }
  return NextResponse.json({ ok: true });
}
