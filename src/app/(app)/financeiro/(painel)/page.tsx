import { redirect } from "next/navigation";
import { AcessoNegado } from "@/components/AcessoNegado";
import { hrefAba, resolverAba } from "../abas";
import { carregarContextoFinanceiro } from "../contexto";

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const ctx = await carregarContextoFinanceiro();
  if (!ctx) return <AcessoNegado recurso="o financeiro" />;
  redirect(hrefAba(resolverAba((await searchParams).aba, ctx.permissoes)));
}
