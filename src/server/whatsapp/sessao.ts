import type { SessaoNumero } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/server/_shared/evento";

// SESSÃO BAILEYS (doc 26 §Camada 0/E3): estado por número + fluxo "conectar via QR" na
// tela do número. A Evolution API gerencia a instância (1 por número, nome =
// NumeroWhatsApp.providerRef); desconexão degrada para "acumula na fila + alerta" — a
// fila já segura sozinha (despachante marca FALHOU e o item volta à fila humana).
// Este módulo NÃO é a porta de mensagens (canal.ts): é gestão de instância — só as
// ações de config e os webhooks usam.

interface RespostaEvolution {
  ok: boolean;
  status: number;
  json: Record<string, unknown>;
}

async function chamarEvolutionApi(
  rota: string,
  metodo: "GET" | "POST" | "DELETE",
  body?: unknown,
): Promise<RespostaEvolution> {
  const base = process.env.EVOLUTION_URL;
  const apikey = process.env.EVOLUTION_APIKEY;
  if (!base || !apikey) {
    return { ok: false, status: 0, json: { message: "EVOLUTION_URL/EVOLUTION_APIKEY não configurados." } };
  }
  try {
    const resposta = await fetch(`${base.replace(/\/$/, "")}/${rota}`, {
      method: metodo,
      headers: { apikey, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = (await resposta.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: resposta.ok, status: resposta.status, json };
  } catch (e) {
    return { ok: false, status: 0, json: { message: e instanceof Error ? e.message : "Falha de rede." } };
  }
}

/** connection.update da Evolution → enum SessaoNumero. */
export function sessaoDeEstadoEvolution(state: string | null | undefined): SessaoNumero | null {
  switch (state) {
    case "open":
      return "CONECTADO";
    case "connecting":
      return "AGUARDANDO_QR";
    case "close":
      return "CAIU";
    default:
      return null;
  }
}

/**
 * Aplica um estado de sessão ao número e grava os EVENTOS de domínio nas transições
 * (doc 30 §eventos): NumeroWhatsAppConectado ao abrir; SessaoBaileysCaiu quando um número
 * que estava CONECTADO cai. Idempotente: mesmo estado não gera nada.
 */
export async function aplicarEstadoSessao(
  numeroId: string,
  nova: SessaoNumero,
  via: "webhook" | "poll" | "conectar",
): Promise<void> {
  const numero = await prisma.numeroWhatsApp.findUnique({
    where: { id: numeroId },
    select: { id: true, sessao: true },
  });
  if (!numero || numero.sessao === nova) return;

  await prisma.$transaction(async (tx) => {
    await tx.numeroWhatsApp.update({ where: { id: numeroId }, data: { sessao: nova } });
    if (nova === "CONECTADO") {
      await registrarEvento(tx, {
        tipo: "NumeroWhatsAppConectado",
        agregadoTipo: "NumeroWhatsApp",
        agregadoId: numeroId,
        autorId: null,
        payload: { via, de: numero.sessao },
      });
    } else if (nova === "CAIU" && numero.sessao === "CONECTADO") {
      await registrarEvento(tx, {
        tipo: "SessaoBaileysCaiu",
        agregadoTipo: "NumeroWhatsApp",
        agregadoId: numeroId,
        autorId: null,
        payload: { via },
      });
    }
  });
}

/** Idem, mas resolvendo o número pela instância (webhooks da Evolution). */
export async function aplicarEstadoSessaoPorInstancia(
  instancia: string,
  state: string | null | undefined,
): Promise<void> {
  const nova = sessaoDeEstadoEvolution(state);
  if (!nova) return;
  const numero = await prisma.numeroWhatsApp.findFirst({
    where: { providerRef: instancia, driver: "BAILEYS" },
    select: { id: true },
  });
  if (!numero) return;
  await aplicarEstadoSessao(numero.id, nova, "webhook");
}

export interface ResultadoConexao {
  qrBase64: string | null;
  estado: SessaoNumero;
  erro: string | null;
}

// Eventos que a instância manda para o nosso webhook (base64: true poupa a chamada de
// download de mídia — ver midia.ts).
const EVENTOS_WEBHOOK = ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE", "QRCODE_UPDATED"];

function urlWebhookEvolution(): string | null {
  const base = process.env.EVOLUTION_WEBHOOK_PUBLIC_URL ?? process.env.NEXTAUTH_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/api/whatsapp/webhook/evolution`;
}

/**
 * Fluxo "conectar via QR" (doc 26 §Camada 0): garante a instância na Evolution, aponta o
 * webhook para cá e devolve o QR atual. O estado local vira AGUARDANDO_QR; a confirmação
 * de conexão chega pelo webhook (connection.update) ou pelo poll da tela.
 */
export async function conectarInstanciaEvolution(numero: {
  id: string;
  providerRef: string;
}): Promise<ResultadoConexao> {
  // 1. Cria a instância se ainda não existe (409/403 = já existe — segue o jogo).
  const criacao = await chamarEvolutionApi("instance/create", "POST", {
    instanceName: numero.providerRef,
    integration: "WHATSAPP-BAILEYS",
    qrcode: true,
  });
  if (!criacao.ok && criacao.status !== 403 && criacao.status !== 409) {
    const msg = typeof criacao.json.message === "string" ? criacao.json.message : `Evolution HTTP ${criacao.status}`;
    // Instância já existente devolve mensagens variadas por versão — só falha de verdade
    // quando nem o connect abaixo responde.
    if (criacao.status === 0) return { qrBase64: null, estado: "DESCONECTADO", erro: msg };
  }

  // 2. Webhook da instância → nossa rota (token compartilhado no header apikey).
  const url = urlWebhookEvolution();
  const token = process.env.EVOLUTION_WEBHOOK_TOKEN;
  if (url && token) {
    await chamarEvolutionApi(`webhook/set/${numero.providerRef}`, "POST", {
      webhook: {
        enabled: true,
        url,
        byEvents: false,
        base64: true,
        headers: { apikey: token },
        events: EVENTOS_WEBHOOK,
      },
    });
  }

  // 3. QR atual (a Evolution renova o QR sozinha; a tela re-chama para atualizar).
  const conexao = await chamarEvolutionApi(`instance/connect/${numero.providerRef}`, "GET");
  if (!conexao.ok) {
    const msg = typeof conexao.json.message === "string" ? conexao.json.message : `Evolution HTTP ${conexao.status}`;
    return { qrBase64: null, estado: "DESCONECTADO", erro: msg };
  }

  // Já conectado? o connect devolve a instância sem QR.
  const instancia = conexao.json.instance as { state?: string } | undefined;
  if (instancia?.state === "open") {
    await aplicarEstadoSessao(numero.id, "CONECTADO", "conectar");
    return { qrBase64: null, estado: "CONECTADO", erro: null };
  }

  const qr =
    (typeof conexao.json.base64 === "string" && conexao.json.base64) ||
    (typeof (conexao.json.qrcode as { base64?: string } | undefined)?.base64 === "string" &&
      (conexao.json.qrcode as { base64: string }).base64) ||
    null;

  await aplicarEstadoSessao(numero.id, "AGUARDANDO_QR", "conectar");
  return { qrBase64: qr, estado: "AGUARDANDO_QR", erro: qr ? null : "A Evolution não devolveu um QR — tente de novo." };
}

/** Poll do estado real na Evolution (botão/intervalo da tela do número). */
export async function consultarEstadoInstancia(numero: {
  id: string;
  providerRef: string;
}): Promise<SessaoNumero> {
  const r = await chamarEvolutionApi(`instance/connectionState/${numero.providerRef}`, "GET");
  const state = (r.json.instance as { state?: string } | undefined)?.state;
  const nova = sessaoDeEstadoEvolution(state ?? null);
  if (nova) await aplicarEstadoSessao(numero.id, nova, "poll");
  const atual = await prisma.numeroWhatsApp.findUnique({ where: { id: numero.id }, select: { sessao: true } });
  return atual?.sessao ?? "DESCONECTADO";
}
