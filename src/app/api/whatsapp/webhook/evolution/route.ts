import { NextResponse } from "next/server";
import type { StatusMensagem, TipoMensagem } from "@prisma/client";
import { processarMensagemNormalizada, processarStatusNormalizado } from "@/server/whatsapp/inbound";
import { baixarMidiaEvolution, salvarMidiaInbound } from "@/server/whatsapp/midia";
import { aplicarEstadoSessaoPorInstancia } from "@/server/whatsapp/sessao";
import { descarteInesperado, resolverContatoEvolution, type ChaveMensagemEvolution, type MotivoDescarte } from "@/server/whatsapp/evolution-jid";
import { importarHistoricoLinha, type MensagemHistorica } from "@/server/whatsapp/historico";
import { prisma } from "@/lib/prisma";

// WEBHOOK EVOLUTION (Baileys) — doc 26 §Camada 0. Autenticação por token compartilhado
// (header `apikey`, configurado no webhook da instância Evolution → EVOLUTION_WEBHOOK_TOKEN).
// Ingestão inclui fromMe=true (gap 16 do doc 28): mensagem que o vendedor manda pelo APP DO
// CELULAR entra no log como SAIDA sem origem — thread completa, régua não cobra lead já
// atendido, IA (E6) lê a conversa inteira.
// SPEC-ERP-005: contato por LID resolvido pelo telefone alternativo (Fase 0) e histórico do
// aparelho (`messages.set`) importado sem efeitos colaterais nas linhas comerciais (Fase 3).

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

interface MensagemEvolution {
  key?: ChaveMensagemEvolution;
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
}

interface EventoEvolution {
  event?: string;
  instance?: string;
  /** messages.set traz uma lista (ou `{ messages: [...] }`, conforme a versão). */
  data?: MensagemEvolution & { messages?: MensagemEvolution[] } | MensagemEvolution[];
}

/** Eventos de histórico (sincronização ao vincular o aparelho). */
const EVENTOS_HISTORICO = new Set(["messages.set", "messaging-history.set"]);

function corpoDe(msg: MensagemEvolution | undefined): {
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

function instanteDe(ts: number | string | undefined): Date {
  return ts ? new Date(Number(ts) * 1000) : new Date();
}

/** Log de descarte sem telefone nem conteúdo (LGPD) — só o suficiente para diagnosticar o payload. */
function registrarDescarte(evento: string | undefined, instancia: string | undefined, motivo: MotivoDescarte) {
  if (descarteInesperado(motivo)) console.warn("[webhook evolution] mensagem descartada", { evento, instancia, motivo });
}

function mensagensDoHistorico(data: EventoEvolution["data"]): MensagemEvolution[] {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.messages) ? data.messages : [];
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
    // Histórico do aparelho (SPEC-ERP-005 §5.4): lista de mensagens, sem mídia binária e sem efeitos.
    if (evento.event && EVENTOS_HISTORICO.has(evento.event)) {
      if (!evento.instance) return NextResponse.json({ ok: true });
      const historicas: MensagemHistorica[] = [];
      for (const dados of mensagensDoHistorico(evento.data)) {
        const contato = resolverContatoEvolution(dados.key);
        if ("descarte" in contato) {
          registrarDescarte(evento.event, evento.instance, contato.descarte);
          continue;
        }
        if (!dados.key?.id) continue;
        const { corpo, tipo } = corpoDe(dados);
        historicas.push({
          contatoWaId: contato.waId,
          nomeExibicao: dados.pushName ?? null,
          providerMessageId: dados.key.id,
          corpo,
          tipo,
          fromMe: dados.key.fromMe === true,
          quando: instanteDe(dados.messageTimestamp),
        });
      }
      const resultado = await importarHistoricoLinha({ numeroProviderRef: evento.instance }, historicas);
      return NextResponse.json({ ok: true, historico: resultado });
    }

    const dados = Array.isArray(evento.data) ? undefined : evento.data;

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

    // Filtro de tráfego não-conversacional (gap 18): grupos (@g.us), broadcast e status
    // NUNCA entram no log — só conversa 1:1 (telefone, ou LID com telefone alternativo).
    const contato = resolverContatoEvolution(dados?.key);
    if ("descarte" in contato) {
      if (evento.event === "messages.upsert") registrarDescarte(evento.event, evento.instance, contato.descarte);
      // Status (ack) de mensagem 1:1 endereçada por LID ainda vale: a mensagem é achada pelo id.
      if (!(evento.event === "messages.update" && contato.descarte === "lid_sem_telefone")) {
        return NextResponse.json({ ok: true });
      }
    }

    if (evento.event === "messages.upsert" && dados?.key?.id && "waId" in contato) {
      const { corpo, tipo, midia } = corpoDe(dados);

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
        contatoWaId: contato.waId,
        nomeExibicao: dados.pushName ?? null,
        providerMessageId: dados.key.id,
        corpo,
        tipo,
        midiaPath,
        driver: "BAILEYS",
        fromMe: dados.key.fromMe === true,
        quando: instanteDe(dados.messageTimestamp),
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
