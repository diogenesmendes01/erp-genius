import { carregarConfigFinanceiro, listarComissoes } from "@/server/financeiro/consultas";
import { ComissoesAba } from "../../FinanceiroPainel";
import { AcessoNegado } from "@/components/AcessoNegado";
import { contextoDaAba } from "../../contexto";

// Aba "comissoes" do /financeiro (E8: uma rota por aba). Guard da própria aba ANTES das consultas — o
// layout só decide a barra; uma rota pedida direto por quem não enxerga a aba não consulta nada.
export default async function ComissoesFinanceiroPage() {
  const ctx = await contextoDaAba("comissoes");
  if (!ctx) return <AcessoNegado recurso="esta seção do financeiro" />;
  const [comissoes, config] = await Promise.all([listarComissoes(), carregarConfigFinanceiro()]);
  return <ComissoesAba comissoes={comissoes} podePagar={ctx.permissoes.podeOperarCobranca} fechamentoAutomatico={config.fechamentoComissaoAutomatico} />;
}
