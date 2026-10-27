"use server";

import { executarAcao } from "@/server/_shared";
import { exigirInstanteDoCampoLocal } from "@/server/_shared/campo-local";
import { listarAlunosParaChamada } from "./chamada";
import { salvarAulaDiario } from "./acoes";
import type { DiarioInput } from "./schema";

export async function listarAlunosParaChamadaLocal(input: { turmaId: string; ocorridaLocal: string; fuso: string }) {
  const r = await executarAcao(async () => exigirInstanteDoCampoLocal(input.ocorridaLocal, input.fuso).toISOString());
  if (!r.ok) return { ok: false as const, erro: r.erro };
  return listarAlunosParaChamada({ turmaId: input.turmaId, ocorridaEm: r.dado! });
}

export async function salvarAulaDiarioLocal(input: Omit<DiarioInput, "ocorridaEm"> & { ocorridaLocal: string; fuso: string }) {
  const r = await executarAcao(async () => {
    const { ocorridaLocal, fuso, ...resto } = input;
    return { ...resto, ocorridaEm: exigirInstanteDoCampoLocal(ocorridaLocal, fuso).toISOString() };
  });
  if (!r.ok) return { ok: false as const, erro: r.erro };
  return salvarAulaDiario(r.dado!);
}
