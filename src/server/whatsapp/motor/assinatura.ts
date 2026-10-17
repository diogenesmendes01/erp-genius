import { createHmac, timingSafeEqual } from "node:crypto";

export type VereditoAssinatura = "ok" | "sem_cabecalho" | "fora_da_janela" | "assinatura_invalida";

export const JANELA_ASSINATURA_MS = 300_000;

export function verificarAssinaturaMotor(e: {
  corpo: string;
  timestamp: string | null;
  assinatura: string | null;
  segredo: string;
  agoraMs: number;
}): VereditoAssinatura {
  if (!e.timestamp || !e.assinatura) return "sem_cabecalho";
  if (!/^\d+$/.test(e.timestamp)) return "fora_da_janela";
  const tsMs = Number(e.timestamp) * 1000;
  if (!Number.isFinite(tsMs) || Math.abs(e.agoraMs - tsMs) > JANELA_ASSINATURA_MS) return "fora_da_janela";
  const esperado = createHmac("sha256", e.segredo).update(`${e.timestamp}.${e.corpo}`).digest();
  const recebido = /^[0-9a-fA-F]+$/.test(e.assinatura) ? Buffer.from(e.assinatura, "hex") : Buffer.alloc(0);
  if (recebido.length !== esperado.length) return "assinatura_invalida";
  return timingSafeEqual(esperado, recebido) ? "ok" : "assinatura_invalida";
}
