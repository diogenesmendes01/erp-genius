"use server";

import { reatribuirEmLote } from "./carteira";

export async function reatribuirCarteiraEmLote(input: { ids: string[]; vendedorId: string; motivo: string }) {
  return reatribuirEmLote(input);
}
