"use server";

import { estornarComissao, type MotivoEstorno } from "./comissoes-estorno";

export async function estornarComissaoDoPainel(input: { id: string; motivo: MotivoEstorno; detalhe?: string }) {
  return estornarComissao(input);
}
