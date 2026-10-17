"use server";

import { estornarComissao, type MotivoEstorno } from "./comissoes-estorno";

/** Ação de servidor do painel de comissões: `comissoes-estorno.ts` exporta constantes, então não pode ser "use server". */
export async function estornarComissaoDoPainel(input: { id: string; motivo: MotivoEstorno; detalhe?: string }) {
  return estornarComissao(input);
}
