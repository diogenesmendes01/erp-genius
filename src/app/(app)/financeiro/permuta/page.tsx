import { Papel } from "@prisma/client";
import { exigirSessaoComPapel } from "@/server/_shared";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PermutaOperacional } from "./PermutaOperacional";
import { consultarPermutas, listarCobrancasParaPermuta } from "@/server/financeiro/permuta-servico";

export default async function PermutaPage() {
  const usuario = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.GERENTE_PEDAGOGICO);
  const capacidades = await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id }, select: { permissoes: true } });
  const admin = usuario.papeis.includes(Papel.ADMINISTRADOR);
  const opcoes = admin || usuario.papeis.includes(Papel.FINANCEIRO) ? await listarCobrancasParaPermuta() : null;
  const resultado = await consultarPermutas();
  if (!resultado.ok) {
    return <section><Link href="/financeiro">Voltar ao financeiro</Link><p role="alert">{resultado.erro}</p></section>;
  }
  if (!resultado.dado) return null;
  return <section className="mx-auto max-w-4xl space-y-4">
    <Link href="/financeiro" className="underline">Voltar ao financeiro</Link>
    <h1 className="text-2xl font-medium">Permutas por serviço comprovado</h1>
    <PermutaOperacional opcoes={opcoes?.ok ? opcoes.dado ?? [] : []} acordos={resultado.dado} podeFinanceiro={admin || usuario.papeis.includes(Papel.FINANCEIRO)} podePedagogico={admin || usuario.papeis.includes(Papel.GERENTE_PEDAGOGICO)} podeAprovar={admin || (usuario.papeis.includes(Papel.FINANCEIRO) && capacidades.permissoes.includes("financeiro.aprovar_acertos"))} />
  </section>;
}
