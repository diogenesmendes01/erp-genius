import { dadosCambio, kpisFinanceiro } from "@/server/financeiro/consultas";
import { GeralAba } from "../../FinanceiroPainel";
import { AcessoNegado } from "@/components/AcessoNegado";
import { contextoDaAba } from "../../contexto";

// Aba "geral" do /financeiro (E8: uma rota por aba). Guard da própria aba ANTES das consultas — o
// layout só decide a barra; uma rota pedida direto por quem não enxerga a aba não consulta nada.
export default async function GeralFinanceiroPage() {
  const ctx = await contextoDaAba("geral");
  if (!ctx) return <AcessoNegado recurso="esta seção do financeiro" />;
  const [kpis, cotacoes] = await Promise.all([kpisFinanceiro(), dadosCambio()]);
  return <GeralAba kpis={kpis} cotacoes={cotacoes} />;
}
