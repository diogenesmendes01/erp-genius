"use server";

import { reatribuirEmLote } from "./carteira";

/** Ação de servidor da tela /carteira: `carteira.ts` exporta constantes e tipos, então não pode ser "use server". */
export async function reatribuirCarteiraEmLote(input: { ids: string[]; vendedorId: string; motivo: string }) {
  return reatribuirEmLote(input);
}
