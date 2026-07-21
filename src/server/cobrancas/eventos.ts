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

// Evento de domínio da cadência COMERCIAL (doc 27). Agregado Lead; `{ passo }` é o fato que
// o motor conta como cumprido (passosFeitos) — a projeção da timeline do lead o exibe grátis.
export async function registrarEventoReguaComercialEnviada(
  tx: Prisma.TransactionClient,
  // `ocorrencia` é a identidade do CICLO da cadência (review PR #56): o instante da âncora
  // em ISO. Sem ela, o histórico do lead é eterno — os `-24h/-2h` de uma experimental
  // reagendada marcariam os passos da experimental NOVA como já cumpridos, e um segundo
  // no-show do mesmo lead nasceria com a cadência inteira "feita".
  entrada: { leadId: string; chave: string; passo: string; ocorrencia: string },
): Promise<void> {
  await registrarEvento(tx, {
    tipo: "ReguaComercialEnviada",
    agregadoTipo: "Lead",
    agregadoId: entrada.leadId,
    autorId: null, // sistema/cron
    payload: { chave: entrada.chave, passo: entrada.passo, ocorrencia: entrada.ocorrencia, canal: "api" },
  });
}
