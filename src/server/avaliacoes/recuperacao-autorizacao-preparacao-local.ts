"use server";
import { z } from "zod";
import { executarAcao } from "@/server/_shared";
import { instanteAvaliacaoLocal } from "./tempo";
import { autorizarPreparacaoEspecialRecuperacao } from "./recuperacao-autorizacao-preparacao";

export async function autorizarPreparacaoEspecialLocal(input: { alocacaoId: string; motivo: string; prazoLocal: string; fuso: string; chaveIdempotencia: string }) {
  const preparado = await executarAcao(async () => {
    const d = z.object({ alocacaoId: z.string(), motivo: z.string(), prazoLocal: z.string(), fuso: z.string(), chaveIdempotencia: z.string() }).strict().parse(input);
    return { alocacaoId: d.alocacaoId, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, prazoAte: instanteAvaliacaoLocal(d.prazoLocal, d.fuso).toISOString() };
  });
  if (!preparado.ok) return preparado;
  return autorizarPreparacaoEspecialRecuperacao(preparado.dado!);
}
