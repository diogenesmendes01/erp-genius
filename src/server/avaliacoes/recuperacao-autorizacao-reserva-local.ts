"use server";
import { z } from "zod";
import { executarAcao } from "@/server/_shared";
import { HABILIDADES } from "./calculo";
import { instanteAvaliacaoLocal } from "./tempo";
import { autorizarReservaEspecialRecuperacao } from "./recuperacao-autorizacao-reserva-especial";

export async function autorizarReservaEspecialLocal(input: { propostaId: string; habilidade: typeof HABILIDADES[number]; motivo: string; prazoLocal: string; fuso: string; chaveIdempotencia: string }) {
  const preparado = await executarAcao(async () => {
    const d = z.object({ propostaId: z.string(), habilidade: z.enum(HABILIDADES), motivo: z.string(), prazoLocal: z.string(), fuso: z.string(), chaveIdempotencia: z.string() }).strict().parse(input);
    return { propostaId: d.propostaId, habilidade: d.habilidade, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia,
      prazoAte: instanteAvaliacaoLocal(d.prazoLocal, d.fuso).toISOString() };
  });
  if (!preparado.ok) return preparado;
  return autorizarReservaEspecialRecuperacao(preparado.dado!);
}
