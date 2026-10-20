import type { Prisma } from "@prisma/client";
import { registrarEvento } from "@/server/_shared/evento";
import type { PassoRegua } from "./regua";

// Helper ÚNICO de gravação do evento de domínio `CobrancaEnviadaWhatsApp` (doc 29 regra 2):
// o braço humano (financeiro/acoes.ts, canal "manual") e o despachante do canal (canal
// "api", autorId null) gravam o MESMO tipo de evento — é isso que faz humano e cron
// "continuarem um do outro" (doc 24/26). O evento NÃO carrega driver (meta/baileys):
// driver é detalhe técnico e mora só no log MensagemWhatsApp.

export type CanalEnvioCobranca = "manual" | "api";

/** Eventos anteriores ao versionamento do calendário pertencem ao ciclo inicial. */
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
    /** Ciclo do texto enviado; não reler a cobrança após a resposta do provedor. */
    cicloRegua: number;
    canal: CanalEnvioCobranca;
    /** null = sistema/cron (despachante). */
    autorId: string | null;
  },
): Promise<void> {
  await registrarEvento(tx, {
    tipo: "CobrancaEnviadaWhatsApp",
    agregadoTipo: "Cobranca",
    agregadoId: entrada.cobrancaId,
    autorId: entrada.autorId,
    // v3 vincula o envio ao calendário; eventos v1/v2 sem campo continuam no ciclo 0.
    versao: 3,
    payload: { modelo: entrada.modelo, passo: entrada.passo, canal: entrada.canal, cicloRegua: entrada.cicloRegua },
  });
}
