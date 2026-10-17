"use server";

import { z } from "zod";
import { executarAcao } from "@/server/_shared";
import { instanteAvaliacaoLocal } from "@/server/avaliacoes/tempo";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";
import { concederCobertura } from "./coberturas";

const schema = z.object({
  titularId: z.string().min(1),
  substitutoId: z.string().min(1),
  inicioLocal: z.string().min(1).max(30),
  fimLocal: z.string().min(1).max(30),
  fuso: FusoInstitucionalSchema,
  motivo: z.string().max(1000),
}).strict();

/** Concede a cobertura com início e fim digitados no fuso informado (nunca no do navegador). */
export async function concederCoberturaLocal(input: z.input<typeof schema>) {
  const r = await executarAcao(async () => {
    const { inicioLocal, fimLocal, fuso, ...resto } = schema.parse(input);
    return { ...resto, inicio: instanteAvaliacaoLocal(inicioLocal, fuso).toISOString(), fim: instanteAvaliacaoLocal(fimLocal, fuso).toISOString() };
  });
  if (!r.ok) return r;
  return concederCobertura(r.dado!);
}
