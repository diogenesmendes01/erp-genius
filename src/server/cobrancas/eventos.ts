import type { Prisma } from "@prisma/client";
import { registrarEvento } from "@/server/_shared/evento";
import type { PassoRegua } from "./regua";

export type CanalEnvioCobranca = "manual" | "api";

export function cicloDoEventoCobranca(payload: unknown): number | null {
  const valor = payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>).cicloRegua : undefined;
  if (valor === undefined) return 0;
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 0 ? valor : null;
}

export async function registrarEventoCobrancaEnviada(
  tx: Prisma.TransactionClient,
  entrada: {
    cobrancaId: string;
    modelo: string;
    passo: PassoRegua | null;
    cicloRegua: number;
    canal: CanalEnvioCobranca;
    autorId: string | null;
  },
): Promise<void> {
  await registrarEvento(tx, {
    tipo: "CobrancaEnviadaWhatsApp",
    agregadoTipo: "Cobranca",
    agregadoId: entrada.cobrancaId,
    autorId: entrada.autorId,
    versao: 3,
    payload: { modelo: entrada.modelo, passo: entrada.passo, canal: entrada.canal, cicloRegua: entrada.cicloRegua },
  });
}
