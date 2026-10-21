import { redirect } from "next/navigation";
import { AcessoNegado } from "@/components/AcessoNegado";
import { hrefAba, resolverAba } from "../abas";
import { carregarContextoFinanceiro } from "../contexto";

// /financeiro leva à aba padrão do papel (E8: cada aba é uma rota). Links antigos com ?aba= continuam
// valendo: a aba pedida é aceita só se o papel a enxerga (resolverAba); senão, a padrão. Sem consultas.
export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const ctx = await carregarContextoFinanceiro();
  if (!ctx) return <AcessoNegado recurso="o financeiro" />;
  redirect(hrefAba(resolverAba((await searchParams).aba, ctx.permissoes)));
}
