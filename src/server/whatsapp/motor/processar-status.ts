import { z } from "zod";
import { registrarEvento } from "@/server/_shared/evento";
import { acharNumero, processarStatusNormalizado } from "../inbound";
import type { EnvelopeMotor } from "./eventos";
import { PROCESSADORES, type ResultadoProcessamento } from "./receber";

/** `dados` de `mensagem.status`. */
export const DadosStatusSchema = z.object({
  providerMessageId: z.string().min(1),
  clientMessageId: z.string().nullish(),
  status: z.enum(["ENVIADA", "ENTREGUE", "LIDA", "FALHOU"]),
  quando: z.number().nullish(),
  motivo: z.string().nullish(),
});

export async function processarStatusMotor(env: EnvelopeMotor): Promise<ResultadoProcessamento> {
  const parsed = DadosStatusSchema.safeParse(env.dados);
  if (!parsed.success) return { ignorado: "dados_invalidos" };
  const d = parsed.data;

  const r = await processarStatusNormalizado(
    {
      numeroProviderRef: env.numeroId,
      providerMessageId: d.providerMessageId,
      clientMessageId: d.clientMessageId ?? null,
      status: d.status,
      driver: "MOTOR",
      quando: new Date(d.quando ?? env.ocorridoEm),
    },
    d.status !== "FALHOU"
      ? undefined
      : async (tx, msg) => {
          const completa = await tx.mensagemWhatsApp.findUniqueOrThrow({
            where: { id: msg.id },
            select: { numeroId: true, intencao: { select: { id: true } } },
          });
          await registrarEvento(tx, {
            tipo: "EntregaWhatsAppFalhou",
            agregadoTipo: completa.intencao ? "IntencaoMensagem" : "NumeroWhatsApp",
            agregadoId: completa.intencao?.id ?? completa.numeroId,
            autorId: null,
            payload: { mensagemId: msg.id, providerMessageId: d.providerMessageId, motivo: d.motivo ?? null },
          });
        },
  );
  if (r === "sem_mensagem") {
    // Número desconhecido não adia (nunca existirá); só falta a mensagem.
    return { adiar: "status_sem_mensagem" };
  }
  if (r === "ignorado") return { ignorado: (await acharNumero({ numeroProviderRef: env.numeroId, driver: "MOTOR" })) ? "sem_progresso" : "numero_desconhecido" };
  return "ok";
}

PROCESSADORES["mensagem.status"] = processarStatusMotor;
