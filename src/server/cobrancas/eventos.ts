import type { Prisma } from "@prisma/client";
import { registrarEvento } from "@/server/_shared/evento";
import type { PassoRegua } from "./regua";

// Helper ÚNICO de gravação do evento de domínio `CobrancaEnviadaWhatsApp` (doc 29 regra 2):
// o braço humano (financeiro/acoes.ts, canal "manual") e o despachante do canal (canal
// "api", autorId null) gravam o MESMO tipo de evento — é isso que faz humano e cron
// "continuarem um do outro" (doc 24/26). O evento NÃO carrega driver (meta/baileys):
// driver é detalhe técnico e mora só no log MensagemWhatsApp.

export type CanalEnvioCobranca = "manual" | "api";

export async function registrarEventoCobrancaEnviada(
  tx: Prisma.TransactionClient,
  entrada: {
    cobrancaId: string;
    modelo: string;
    passo: PassoRegua | null;
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
    // versao 2 = payload ganhou `canal` (leitores v1 só extraem `passo` — retrocompatível).
    versao: 2,
    payload: { modelo: entrada.modelo, passo: entrada.passo, canal: entrada.canal },
  });
}
