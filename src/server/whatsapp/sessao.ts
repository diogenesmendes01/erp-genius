import type { SessaoNumero } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/server/_shared/evento";

import { chamarMotor, ErroMotor } from "./motor/cliente";

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

export interface ResultadoConexao {
  qrBase64: string | null;
  codigoPareamento: string | null;
  estado: SessaoNumero;
  erro: string | null;
}

export interface NumeroMotor {
  id: string;
  providerRef: string;
  rotulo: string;
}

interface SessaoMotor {
  status?: string;
  erro?: string;
  qr?: string;
  codigoPareamento?: string;
}

export function sessaoDeStatusMotor(status: string | null | undefined): SessaoNumero | null {
  switch (status) {
    case "qr":
    case "connecting":
      return "AGUARDANDO_QR";
    case "connected":
      return "CONECTADO";
    case "reconnecting":
    case "error":
      return "CAIU";
    case "logged_out":
    case "disconnected":
      return "DESCONECTADO";
    default:
      return null;
  }
}

function mensagemErroMotor(e: unknown): string {
  if (e instanceof ErroMotor) {
    switch (e.codigo) {
      case "SEM_CONFIG":
        return "Motor WhatsApp não configurado.";
      case "INDISPONIVEL":
      case "TIMEOUT":
        return "Motor WhatsApp indisponível no momento. Tente de novo em instantes.";
      case "NAO_AUTORIZADO":
        return "Motor WhatsApp recusou a chave de acesso.";
      case "NUMERO_INEXISTENTE":
        return "O motor não conhece este número.";
      default:
        return `Motor WhatsApp recusou a operação (${e.codigo}).`;
    }
  }
  return e instanceof Error ? e.message : "Falha ao falar com o motor.";
}

const rotaNumero = (ref: string) => `/v1/numeros/${encodeURIComponent(ref)}`;

export async function garantirNumeroNoMotor(n: { providerRef: string; rotulo: string }): Promise<void> {
  await chamarMotor(rotaNumero(n.providerRef), { metodo: "PUT", json: { rotulo: n.rotulo } });
}

async function lerSessao(ref: string): Promise<SessaoMotor> {
  const r = await chamarMotor<{ sessao?: SessaoMotor }>(rotaNumero(ref), { metodo: "GET" });
  return r?.sessao ?? {};
}

async function resultadoDe(n: NumeroMotor, sessao: SessaoMotor, via: "conectar" | "poll"): Promise<ResultadoConexao> {
  const qrBase64 = sessao.qr ?? null;
  const codigoPareamento = sessao.codigoPareamento ?? null;
  let estado = sessaoDeStatusMotor(sessao.status);
  if (!estado) estado = qrBase64 || codigoPareamento ? "AGUARDANDO_QR" : "DESCONECTADO";
  if (estado === "DESCONECTADO" && via === "conectar") estado = "AGUARDANDO_QR";
  await aplicarEstadoSessao(n.id, estado, via);
  return { qrBase64, codigoPareamento, estado, erro: estado === "CONECTADO" ? null : sessao.erro ?? null };
}

export async function conectarNumeroMotor(n: NumeroMotor): Promise<ResultadoConexao> {
  try {
    await garantirNumeroNoMotor(n);
    await chamarMotor(`${rotaNumero(n.providerRef)}/conectar`, { metodo: "POST" });
    const sessao = await lerSessao(n.providerRef);
    const r = await resultadoDe(n, sessao, "conectar");
    if (r.estado === "AGUARDANDO_QR" && !r.qrBase64 && !r.erro) {
      return { ...r, erro: "O motor ainda não gerou o QR — tente de novo." };
    }
    return r;
  } catch (e) {
    return { qrBase64: null, codigoPareamento: null, estado: "DESCONECTADO", erro: mensagemErroMotor(e) };
  }
}

export async function parearNumeroMotor(n: NumeroMotor, telefoneE164: string): Promise<ResultadoConexao> {
  try {
    await garantirNumeroNoMotor(n);
    const r = await chamarMotor<{ codigoPareamento?: string }>(`${rotaNumero(n.providerRef)}/pareamento`, {
      metodo: "POST",
      json: { telefone: telefoneE164 },
    });
    const codigo = r?.codigoPareamento ?? null;
    await aplicarEstadoSessao(n.id, "AGUARDANDO_QR", "conectar");
    return {
      qrBase64: null,
      codigoPareamento: codigo,
      estado: "AGUARDANDO_QR",
      erro: codigo ? null : "O motor não devolveu o código — tente de novo.",
    };
  } catch (e) {
    return { qrBase64: null, codigoPareamento: null, estado: "DESCONECTADO", erro: mensagemErroMotor(e) };
  }
}

export async function consultarSessaoMotor(
  n: NumeroMotor | { id: string; providerRef: string; rotulo?: string },
): Promise<{ sessao: SessaoNumero; qrBase64: string | null; codigoPareamento: string | null }> {
  const s = await lerSessao(n.providerRef);
  const nova = sessaoDeStatusMotor(s.status);
  if (nova) await aplicarEstadoSessao(n.id, nova, "poll");
  const atual = await prisma.numeroWhatsApp.findUnique({ where: { id: n.id }, select: { sessao: true } });
  return {
    sessao: atual?.sessao ?? "DESCONECTADO",
    qrBase64: s.qr ?? null,
    codigoPareamento: s.codigoPareamento ?? null,
  };
}

export async function solicitarLogoutMotor(n: { providerRef: string }): Promise<void> {
  await chamarMotor(`${rotaNumero(n.providerRef)}/desconectar`, { metodo: "POST" });
}

export async function desconectarNumeroMotor(n: { id: string; providerRef: string }): Promise<void> {
  await solicitarLogoutMotor(n);
  await aplicarEstadoSessao(n.id, "DESCONECTADO", "conectar");
}
