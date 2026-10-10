import Link from "next/link";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoPagina } from "@/server/_shared";
import { botaoClasses } from "@/components/Botao";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Paginacao } from "@/components/Paginacao";
import { hrefLista, janelaDaPagina, lerPagina, recorteDaPagina, type ParametrosUrl } from "@/lib/pagina-url";

export default async function GradesPage({ searchParams }: { searchParams: Promise<ParametrosUrl> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
  const q = await searchParams, todas = q.historico === "todos", pagina = lerPagina(q);
  // Página numerada (E4): criação e id dão a ordem estável — a volta à página traz as mesmas propostas.
  const lidas = await prisma.propostaGradeTurma.findMany({ where: todas ? {} : { decisao: null },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }], ...janelaDaPagina(pagina, 30),
    select: { id: true, versao: true, fusoOrigem: true, turma: { select: { codigo: true } },
      decisao: { select: { aprovada: true } }, preparador: { select: { nome: true } } } });
  const { registros: itens, temProxima } = recorteDaPagina(lidas, 30);
  return <div className="space-y-4">
    <VoltarPara href="/academico" />
    <h1 className="text-2xl font-medium">Grades das turmas</h1>
    <p>Confira os encontros e a disponibilidade antes da aprovação independente.</p>
    <Link href="/academico/grades/nova" className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Preparar nova grade</Link>
    <nav aria-label="Situação das grades" className="flex gap-4"><Link href="/academico/grades">Pendentes</Link><Link href="/academico/grades?historico=todos">Incluir histórico</Link></nav>
    {!itens.length && <EstadoVazio bloco>Nenhuma proposta encontrada.</EstadoVazio>}
    {itens.map((p) => <article key={p.id} className="space-y-2 rounded border bg-[var(--surface)] p-4">
      <h2 className="font-medium">{p.turma.codigo} · Versão {p.versao}</h2>
      <p>{p.decisao ? p.decisao.aprovada ? "Publicada" : "Rejeitada" : "Aguardando decisão"} · {p.fusoOrigem}</p>
      <p>Preparada por {p.preparador.nome}</p>
      <Link className="underline text-brand-700" href={`/academico/grades/${p.id}`}>Revisar grade</Link>
    </article>)}
    <Paginacao pagina={pagina} temProxima={temProxima} href={(p) => hrefLista("/academico/grades", { historico: todas ? "todos" : null, pagina: p })} rotulo="Páginas de propostas de grade" />
  </div>;
}
