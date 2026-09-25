import { AprovacoesAba } from "../../FinanceiroPainel";
import { AcessoNegado } from "@/components/AcessoNegado";
import { carregarFilasPendentes, contextoDaAba } from "../../contexto";

// Aba "aprovacoes" do /financeiro (E8: uma rota por aba). Guard da própria aba ANTES das consultas — o
// layout só decide a barra; uma rota pedida direto por quem não enxerga a aba não consulta nada.
export default async function AprovacoesFinanceiroPage() {
  const ctx = await contextoDaAba("aprovacoes");
  if (!ctx) return <AcessoNegado recurso="esta seção do financeiro" />;
  const filas = await carregarFilasPendentes(ctx.permissoes);
  return <AprovacoesAba aprovacoes={filas.aprovacoes} />;
}
