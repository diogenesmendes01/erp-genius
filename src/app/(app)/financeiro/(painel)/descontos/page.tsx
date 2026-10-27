import { relatorioDescontosComissoes } from "@/server/financeiro/consultas";
import { Descontos } from "../../FinanceiroPainel";
import { AcessoNegado } from "@/components/AcessoNegado";
import { contextoDaAba } from "../../contexto";

export default async function DescontosFinanceiroPage() {
  const ctx = await contextoDaAba("descontos");
  if (!ctx) return <AcessoNegado recurso="esta seção do financeiro" />;
  return <Descontos relatorio={await relatorioDescontosComissoes()} />;
}
