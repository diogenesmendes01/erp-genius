"use server";

import { z } from "zod";
import { executarAcao } from "@/server/_shared";
import { instanteAvaliacaoLocal } from "./tempo";
import { ProporRemarcacaoSegundaChamadaSchema } from "./segunda-chamada-remarcacao-schema";
import { proporRemarcacaoAgendaSegundaChamada } from "./segunda-chamada-remarcacao";

const schema = ProporRemarcacaoSegundaChamadaSchema.omit({ inicio: true, fim: true }).extend({
  inicioLocal: z.string().min(1).max(30),
  fimLocal: z.string().min(1).max(30),
}).strict();

export async function proporRemarcacaoAgendaSegundaChamadaLocal(input: z.input<typeof schema>) {
  const r = await executarAcao(async () => {
    const { inicioLocal, fimLocal, ...d } = schema.parse(input);
    return { ...d,
      inicio: instanteAvaliacaoLocal(inicioLocal, d.fusoOrigem).toISOString(),
      fim: instanteAvaliacaoLocal(fimLocal, d.fusoOrigem).toISOString(),
    };
  });
  if (!r.ok) return r;
  return proporRemarcacaoAgendaSegundaChamada(r.dado!);
}
