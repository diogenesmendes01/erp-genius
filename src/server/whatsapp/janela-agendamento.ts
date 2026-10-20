import { ErroRegra } from "@/server/_shared/sessao";
import { carregarPoliticaRegua } from "@/server/cobrancas/politica";
import { fusoDaEscola } from "@/server/relatorios/atendimento";
import { dentroDaJanelaEnvio, mensagemForaDaJanela } from "./janela-envio";

/**
 * D12 (#202 C4): mensagem agendada (pela pessoa ou pela Aria) não pode cair no horário de silêncio. A janela é a
 * que o despachante aplica a uma intenção sem política própria (`politicaPadrao` de `despacharFila`, a política
 * carregada por `carregarPoliticaRegua`), lida no fuso da escola. Devolve a recusa pronta para a tela, ou null.
 */
export async function recusaForaDaJanela(quando: Date): Promise<string | null> {
  const [politica, fuso] = await Promise.all([carregarPoliticaRegua(), fusoDaEscola()]);
  return dentroDaJanelaEnvio(quando, fuso, politica) ? null : mensagemForaDaJanela(politica, fuso);
}

export async function exigirAgendamentoNaJanela(quando: Date): Promise<void> {
  const recusa = await recusaForaDaJanela(quando);
  if (recusa) throw new ErroRegra(recusa);
}
