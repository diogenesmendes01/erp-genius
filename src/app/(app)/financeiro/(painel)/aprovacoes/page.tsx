import { AprovacoesAba } from "../../FinanceiroPainel";
import { AcessoNegado } from "@/components/AcessoNegado";
import { carregarFilasPendentes, contextoDaAba } from "../../contexto";

export default async function AprovacoesFinanceiroPage() {
  const ctx = await contextoDaAba("aprovacoes");
  if (!ctx) return <AcessoNegado recurso="esta seção do financeiro" />;
  const filas = await carregarFilasPendentes(ctx.permissoes);
  return <AprovacoesAba aprovacoes={filas.aprovacoes} />;
}
