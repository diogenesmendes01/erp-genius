import { dadosCambio, kpisFinanceiro } from "@/server/financeiro/consultas";
import { GeralAba } from "../../FinanceiroPainel";
import { AcessoNegado } from "@/components/AcessoNegado";
import { contextoDaAba } from "../../contexto";

export default async function GeralFinanceiroPage() {
  const ctx = await contextoDaAba("geral");
  if (!ctx) return <AcessoNegado recurso="esta seção do financeiro" />;
  const [kpis, cotacoes] = await Promise.all([kpisFinanceiro(), dadosCambio()]);
  return <GeralAba kpis={kpis} cotacoes={cotacoes} />;
}
