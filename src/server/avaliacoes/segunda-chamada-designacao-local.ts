"use server";
import { z } from "zod";
import { executarAcao } from "@/server/_shared";
import { instanteAvaliacaoLocal } from "./tempo";
import { designarProfessorSegundaChamada } from "./segunda-chamada-designacao";

export async function designarProfessorSegundaChamadaLocal(input: { propostaId: string; professorId: string; inicioLocal: string; fimLocal?: string; fuso: string; motivo: string; chaveIdempotencia: string }) {
  const preparado = await executarAcao(async () => {
    const d = z.object({ propostaId: z.string(), professorId: z.string(), inicioLocal: z.string(), fimLocal: z.string().optional(), fuso: z.string(), motivo: z.string(), chaveIdempotencia: z.string() }).strict().parse(input);
    return { propostaId: d.propostaId, professorId: d.professorId, inicio: instanteAvaliacaoLocal(d.inicioLocal, d.fuso).toISOString(), ...(d.fimLocal ? { fim: instanteAvaliacaoLocal(d.fimLocal, d.fuso).toISOString() } : {}), motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia };
  });
  if (!preparado.ok) return preparado;
  return designarProfessorSegundaChamada(preparado.dado!);
}
