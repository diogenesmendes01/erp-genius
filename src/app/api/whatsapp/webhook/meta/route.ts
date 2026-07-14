import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { StatusMensagem, TipoMensagem } from "@prisma/client";
import { processarMensagemNormalizada, processarStatusNormalizado } from "@/server/whatsapp/inbound";
import { processarStatusTemplateWebhook, type StatusTemplateWebhook } from "@/server/whatsapp/meta-templates";
import { baixarMidiaMeta, salvarMidiaInbound } from "@/server/whatsapp/midia";

// WEBHOOK OFICIAL (Meta Cloud API) — doc 26 §Camada 0 · gap A4/A8 do doc 28.
// GET  = handshake de verificação (hub.challenge).
// POST = eventos. AUTENTICIDADE OBRIGATÓRIA: X-Hub-Signature-256 (HMAC-SHA256 do corpo cru
// com o app secret) — sem assinatura válida, 401. Sem isso, um POST forjado cancelaria
// réguas (lei do despachante) e criaria leads via curl (doc 28 gap 4).
// Disciplina: valida → traduz → grava → 200. Nada de regra de negócio aqui (doc 29).

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const modo = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const esperado = process.env.META_WA_VERIFY_TOKEN;
  if (modo === "subscribe" && esperado && token === esperado && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

function assinaturaValida(corpoCru: string, header: string | null): boolean {
  const secret = process.env.META_WA_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const recebida = header.slice("sha256=".length);
  // Hex malformado geraria buffer curto e RangeError no timingSafeEqual (review PR #49):
  // valida o formato ANTES e responde 401, nunca 500 (5xx repetido suspende o webhook).
  if (!/^[0-9a-f]{64}$/i.test(recebida)) return false;
  const esperada = createHmac("sha256", secret).update(corpoCru, "utf8").digest("hex");
  try {
    return timingSafeEqual(Buffer.from(esperada, "hex"), Buffer.from(recebida, "hex"));
  } catch {
    return false;
  }
}

const TIPO_POR_META: Record<string, TipoMensagem> = {
  text: "TEXTO",
  image: "IMAGEM",
  audio: "AUDIO",
  video: "VIDEO",
  document: "DOCUMENTO",
};

const STATUS_POR_META: Record<string, StatusMensagem> = {
  sent: "ENVIADA",
  delivered: "ENTREGUE",
  read: "LIDA",
  failed: "FALHOU",
};

interface MidiaMeta {
  id?: string;
  mime_type?: string;
  caption?: string;
  filename?: string;
}

interface PayloadMeta {
  entry?: {
    changes?: {
      field?: string;
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: { wa_id?: string; profile?: { name?: string } }[];
        messages?: {
          id?: string;
          from?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
          image?: MidiaMeta;
          audio?: MidiaMeta;
          video?: MidiaMeta;
          document?: MidiaMeta;
        }[];
        statuses?: { id?: string; status?: string; timestamp?: string }[];
      };
    }[];
  }[];
}

export async function POST(req: Request): Promise<NextResponse> {
  const corpoCru = await req.text();
  if (!assinaturaValida(corpoCru, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ erro: "Assinatura inválida." }, { status: 401 });
  }

  let payload: PayloadMeta;
  try {
    payload = JSON.parse(corpoCru) as PayloadMeta;
  } catch {
    return NextResponse.json({ ok: true }); // corpo estranho: 200 para não entrar em loop de retry
  }

  // Processa inline (volume atual é baixo) mas nunca deixa erro virar 5xx — 5xx repetido
  // faz a Meta SUSPENDER a entrega do webhook (doc 28 gap A7).
  try {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        // Ciclo de template (doc 26 §Camada 2): rascunho → em revisão → aprovado/rejeitado.
        if (change.field === "message_template_status_update" && change.value) {
          await processarStatusTemplateWebhook(change.value as StatusTemplateWebhook);
          continue;
        }
        const valor = change.value;
        if (!valor) continue;
        const providerRef = valor.metadata?.phone_number_id ?? null;
        const nomePorWaId = new Map(
          (valor.contacts ?? [])
            .filter((c) => c.wa_id)
            .map((c) => [c.wa_id as string, c.profile?.name ?? null]),
        );

        for (const m of valor.messages ?? []) {
          if (!m.id || !m.from) continue;

          // Mídia inbound (gap A3): a URL da Meta EXPIRA em minutos — baixa AGORA, antes
          // de gravar o log. Falha de download não perde a mensagem (entra sem binário).
          const midia = m.image ?? m.audio ?? m.video ?? m.document ?? null;
          let midiaPath: string | null = null;
          if (midia?.id) {
            const baixada = await baixarMidiaMeta(midia.id);
            if (baixada) midiaPath = await salvarMidiaInbound(baixada.bytes, baixada.mime || midia.mime_type);
          }

          await processarMensagemNormalizada({
            numeroProviderRef: providerRef,
            contatoWaId: m.from,
            nomeExibicao: nomePorWaId.get(m.from) ?? null,
            providerMessageId: m.id,
            corpo: m.text?.body ?? midia?.caption ?? m.document?.filename ?? null,
            tipo: TIPO_POR_META[m.type ?? ""] ?? "OUTRO",
            midiaPath,
            driver: "META_CLOUD",
            fromMe: false, // Cloud API só entrega inbound aqui; echo de saída chega em statuses
            quando: m.timestamp ? new Date(Number(m.timestamp) * 1000) : new Date(),
          });
        }

        for (const s of valor.statuses ?? []) {
          if (!s.id || !s.status) continue;
          const status = STATUS_POR_META[s.status];
          if (!status) continue;
          await processarStatusNormalizado({
            numeroProviderRef: providerRef,
            providerMessageId: s.id,
            status,
            driver: "META_CLOUD",
            quando: s.timestamp ? new Date(Number(s.timestamp) * 1000) : new Date(),
          });
        }
      }
    }
  } catch (e) {
    console.error("[webhook meta] erro ao processar:", e);
  }
  return NextResponse.json({ ok: true });
}
