"use server";

import type { z } from "zod";
import { executarAcao } from "@/server/_shared";
import { exigirInstanteDoCampoLocal } from "@/server/_shared/campo-local";
import { prepararAditivoContratual } from "./aditivos";
import type { PrepararAditivoContratualSchema } from "./aditivo-schema";

/**
 * Preparação do aditivo com o início da vigência DIGITADO (lote 3 do fuso pessoal nas telas): `vigenciaLocal` é o
 * texto do `datetime-local`, lido no `fusoVigencia` que a tela escreveu ao lado do campo (pessoal; sem preferência,
 * o da escola) e convertido aqui. Antes, o navegador fazia `new Date(valor)` no fuso do dispositivo.
 */
export async function prepararAditivoContratualLocal(input: Omit<z.input<typeof PrepararAditivoContratualSchema>, "vigenciaInicio"> & { vigenciaLocal: string; fusoVigencia: string }) {
  const r = await executarAcao(async () => {
    const { vigenciaLocal, fusoVigencia, ...resto } = input;
    return { ...resto, vigenciaInicio: exigirInstanteDoCampoLocal(vigenciaLocal, fusoVigencia).toISOString() };
  });
  if (!r.ok) return r;
  return prepararAditivoContratual(r.dado!);
}
