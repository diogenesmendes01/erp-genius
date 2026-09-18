import type { Prisma } from "@prisma/client";
import { validarValorAlteracaoAditivo } from "./aditivo-valores";
import { ErroRegra } from "@/server/_shared";

/** Identifica a cobrança pela emissão original, nunca pela ordem dos vencimentos. */
export async function consultarAlvoPrimeiraMensalidadeTx(tx: Prisma.TransactionClient, matriculaId: string, valor: unknown) {
  const alteracao = validarValorAlteracaoAditivo("PRIMEIRA_MENSALIDADE_VENCIMENTO", valor);
  if (alteracao.tipo !== "DATA") throw new ErroRegra("Vencimento contratual inválido.");
  const itens = await tx.itemEmissaoEntrada.findMany({
    where: { matriculaId, cobranca: { tipo: "MENSALIDADE" } }, take: 2,
    select: { cobranca: { select: { id: true, matriculaId: true, versao: true, status: true, vencimento: true } } },
  });
  const base = { vencimentoProposto: alteracao.data };
  if (itens.length !== 1) return { ...base, cobranca: null, pendencia: itens.length
    ? "A emissão identifica mais de uma primeira mensalidade. Confira a origem antes do acerto."
    : "A primeira mensalidade ainda não possui origem de emissão identificada. Confira a emissão ou a migração antes do acerto." };
  const c = itens[0].cobranca;
  if (c.matriculaId !== matriculaId) throw new ErroRegra("A primeira mensalidade pertence a outro contrato.");
  return { ...base, cobranca: { id: c.id, versao: c.versao, vencimentoAtual: c.vencimento },
    pendencia: c.status === "CANCELADA" ? "A primeira mensalidade está cancelada e exige conferência financeira."
      : "O vencimento exige proposta de acerto e aprovação financeira independente antes da aplicação." };
}
