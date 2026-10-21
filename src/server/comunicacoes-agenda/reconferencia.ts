"use server";

import { reconferirPendenciaAvisoAgendaInterna } from "./pendencias";

export async function reconferirPendenciaAvisoAgenda(input: unknown) {
  return reconferirPendenciaAvisoAgendaInterna(input);
}
