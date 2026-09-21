"use server";
import { z } from "zod";
import { executarAcao } from "@/server/_shared";
import { instanteAvaliacaoLocal } from "./tempo";
import { proporCancelamentoAgendaSegundaChamada } from "./segunda-chamada-cancelamento";
const schema = z.object({ reservaId: z.string().min(1).max(100), estadoConferido: z.string().regex(/^[a-f0-9]{64}$/), dataHoraLocal: z.string().min(1), fuso: z.string().min(1).max(100), motivo: z.string().trim().min(5).max(2000), evidencia: z.string().trim().min(5).max(4000), origem: z.enum(["ESCOLA", "ALUNO"]).optional(), chaveIdempotencia: z.string().min(8).max(100) }).strict();
export async function proporCancelamentoAgendaSegundaChamadaLocal(input: z.input<typeof schema>) {
  const r = await executarAcao(async () => {
    const { dataHoraLocal, fuso, ...d } = schema.parse(input);
    return { ...d, ocorridaEm: instanteAvaliacaoLocal(dataHoraLocal, fuso).toISOString() };
  });
  if (!r.ok) return r;
  return proporCancelamentoAgendaSegundaChamada(r.dado!);
}
