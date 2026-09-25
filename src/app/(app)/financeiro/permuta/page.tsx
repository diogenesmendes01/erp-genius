import { Papel } from "@prisma/client";
import { exigirSessaoComPapel } from "@/server/_shared";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PermutaOperacional } from "./PermutaOperacional";
import { consultarPermutas, listarCobrancasParaPermuta } from "@/server/financeiro/permuta-servico";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { VoltarPara } from "@/components/VoltarPara";

export default async function PermutaPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const pagina = Number((await searchParams).pagina ?? 1);
  const usuario = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.GERENTE_PEDAGOGICO);
  const [capacidades, preferencia] = await Promise.all([
    prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id }, select: { permissoes: true } }),
    consultarPreferenciaFusoEquipe(),
  ]);
  const admin = usuario.papeis.includes(Papel.ADMINISTRADOR);
  const retorno = admin || usuario.papeis.includes(Papel.FINANCEIRO) ? "/financeiro" : "/home";
  const opcoes = admin || usuario.papeis.includes(Papel.FINANCEIRO) ? await listarCobrancasParaPermuta() : null;
  const resultado = await consultarPermutas(pagina);
  if (!resultado.ok) {
    return <section><VoltarPara href={retorno} /><p role="alert">{resultado.erro}</p></section>;
  }
  if (!resultado.dado) return null;
  return <section className="mx-auto max-w-4xl space-y-4">
    <VoltarPara href={retorno} />
    <h1 className="text-2xl font-medium">Permutas por serviço comprovado</h1>
    <p>Página {pagina} · até 50 acordos por página</p>
    {resultado.dado.length === 0 && <p>Nenhum acordo nesta página.</p>}
    <nav aria-label="Páginas de permutas" className="flex gap-4">
      {pagina > 1 && <Link href={`/financeiro/permuta?pagina=${pagina - 1}`} className="underline">Anterior</Link>}
      {resultado.dado.length === 50 && <Link href={`/financeiro/permuta?pagina=${pagina + 1}`} className="underline">Próxima</Link>}
    </nav>
    <PermutaOperacional opcoes={opcoes?.ok ? opcoes.dado ?? [] : []} acordos={resultado.dado} podeFinanceiro={admin || usuario.papeis.includes(Papel.FINANCEIRO)} podePedagogico={admin || usuario.papeis.includes(Papel.GERENTE_PEDAGOGICO)} podeAprovar={admin || (usuario.papeis.includes(Papel.FINANCEIRO) && capacidades.permissoes.includes("financeiro.aprovar_acertos"))} preferenciaFusoExibicao={(preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null} />
  </section>;
}
