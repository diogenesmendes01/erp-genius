import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroRegra } from "@/server/_shared/sessao";
import { carregarPoliticaRegua } from "@/server/cobrancas/politica";
import { fusoDaEscola } from "@/server/relatorios/atendimento";
import { dentroDaJanelaEnvio, mensagemForaDaJanela } from "./janela-envio";

/**
 * D12 (#202 C4): mensagem agendada (pela pessoa ou pela Aria) não pode cair no horário de silêncio. A janela é a
 * que o despachante aplica a uma intenção sem política própria (`politicaPadrao` de `despacharFila`, a política
 * carregada por `carregarPoliticaRegua`), lida no fuso da escola. Devolve a recusa pronta para a tela, ou null.
 */
export async function recusaForaDaJanela(quando: Date, db: Pick<Prisma.TransactionClient, "politicaRegua" | "configuracaoOperacional"> = prisma): Promise<string | null> {
  const [politica, fuso] = await Promise.all([carregarPoliticaRegua(db), fusoDaEscola(db)]);
  return dentroDaJanelaEnvio(quando, fuso, politica) ? null : mensagemForaDaJanela(politica, fuso);
}

export async function exigirAgendamentoNaJanela(quando: Date, db: Pick<Prisma.TransactionClient, "politicaRegua" | "configuracaoOperacional"> = prisma): Promise<void> {
  const recusa = await recusaForaDaJanela(quando, db);
  if (recusa) throw new ErroRegra(recusa);
}
