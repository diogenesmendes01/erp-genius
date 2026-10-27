"use server";

import type { z } from "zod";
import { executarAcao } from "@/server/_shared";
import { exigirInstanteDoCampoLocal } from "@/server/_shared/campo-local";
import { prepararAditivoContratual } from "./aditivos";
import type { PrepararAditivoContratualSchema } from "./aditivo-schema";

export async function prepararAditivoContratualLocal(input: Omit<z.input<typeof PrepararAditivoContratualSchema>, "vigenciaInicio"> & { vigenciaLocal: string; fusoVigencia: string }) {
  const r = await executarAcao(async () => {
    const { vigenciaLocal, fusoVigencia, ...resto } = input;
    return { ...resto, vigenciaInicio: exigirInstanteDoCampoLocal(vigenciaLocal, fusoVigencia).toISOString() };
  });
  if (!r.ok) return r;
  return prepararAditivoContratual(r.dado!);
}
