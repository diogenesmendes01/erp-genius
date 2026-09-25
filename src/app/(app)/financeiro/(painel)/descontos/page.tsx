import { relatorioDescontosComissoes } from "@/server/financeiro/consultas";
import { Descontos } from "../../FinanceiroPainel";
import { AcessoNegado } from "@/components/AcessoNegado";
import { contextoDaAba } from "../../contexto";

// Aba "descontos" do /financeiro (E8: uma rota por aba). Guard da própria aba ANTES das consultas — o
// layout só decide a barra; uma rota pedida direto por quem não enxerga a aba não consulta nada.
export default async function DescontosFinanceiroPage() {
  const ctx = await contextoDaAba("descontos");
  if (!ctx) return <AcessoNegado recurso="esta seção do financeiro" />;
  return <Descontos relatorio={await relatorioDescontosComissoes()} />;
}
