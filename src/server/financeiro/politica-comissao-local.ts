"use server";

import { executarAcao } from "@/server/_shared";
import { exigirInstanteDoCampoLocal } from "@/server/_shared/campo-local";
import { publicarPoliticaComissao } from "./acoes";
import type { PoliticaComissaoInput } from "./schema";

export async function publicarPoliticaComissaoLocal(input: Omit<PoliticaComissaoInput, "vigenteEm"> & { vigenciaLocal: string; fuso: string }) {
  const r = await executarAcao(async () => {
    const { vigenciaLocal, fuso, ...resto } = input;
    return { ...resto, vigenteEm: vigenciaLocal.trim() ? exigirInstanteDoCampoLocal(vigenciaLocal, fuso) : new Date() };
  });
  if (!r.ok) return r;
  return publicarPoliticaComissao(r.dado!);
}
