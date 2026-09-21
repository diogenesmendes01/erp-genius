"use server";

import { z } from "zod";
import { executarAcao } from "@/server/_shared";
import { instanteAvaliacaoLocal } from "./tempo";
import { ProporAgendaInicialSegundaChamadaSchema } from "./segunda-chamada-agenda-inicial-schema";
import {
  consultarPreviaAgendaInicialSegundaChamada,
  proporAgendaInicialSegundaChamada,
} from "./segunda-chamada-agenda-inicial";

const horarioLocal = z.object({
  inicioLocal: z.string().min(1).max(30),
  fimLocal: z.string().min(1).max(30),
  fusoOrigem: z.string().trim().min(1).max(100),
}).strict();

const previaSchema = horarioLocal.extend({
  propostaSegundaChamadaId: z.string().trim().min(1).max(100),
  professorId: z.string().trim().min(1).max(100),
}).strict();

const propostaSchema = ProporAgendaInicialSegundaChamadaSchema.omit({ inicio: true, fim: true })
  .extend(horarioLocal.shape)
  .strict();

function converterHorario<T extends z.infer<typeof horarioLocal>>(entrada: T) {
  const { inicioLocal, fimLocal, ...resto } = entrada;
  return {
    ...resto,
    inicio: instanteAvaliacaoLocal(inicioLocal, entrada.fusoOrigem).toISOString(),
    fim: instanteAvaliacaoLocal(fimLocal, entrada.fusoOrigem).toISOString(),
  };
}

/** Converte horários declarados no formulário antes da prévia sem depender do fuso do navegador. */
export async function consultarPreviaAgendaInicialSegundaChamadaLocal(input: z.input<typeof previaSchema>) {
  const r = await executarAcao(async () => converterHorario(previaSchema.parse(input)));
  if (!r.ok) return r;
  return consultarPreviaAgendaInicialSegundaChamada(r.dado!);
}

/** A proposta recebe exatamente os instantes revisados na prévia. */
export async function proporAgendaInicialSegundaChamadaLocal(input: z.input<typeof propostaSchema>) {
  const r = await executarAcao(async () => converterHorario(propostaSchema.parse(input)));
  if (!r.ok) return r;
  return proporAgendaInicialSegundaChamada(r.dado!);
}