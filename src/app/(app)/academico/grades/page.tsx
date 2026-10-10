import Link from "next/link";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoPagina } from "@/server/_shared";
import { botaoClasses } from "@/components/Botao";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";
import { PaginacaoFila } from "@/components/PaginacaoFila";
import { hrefLista, type ParametrosUrl } from "@/lib/pagina-url";
import { alemDoCursor, cursorDaLeitura, direcaoDeLeitura, lerNavegacao, lerPaginaDaFila, validarNavegacao, type NavegacaoFila } from "@/lib/cursor-fila";

export default async function GradesPage({ searchParams }: { searchParams: Promise<ParametrosUrl> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
  const q = await searchParams, todas = q.historico === "todos", leitura = validarNavegacao(lerNavegacao(q));
  const filtro = { historico: todas ? "todos" : null };
  const cabecalho = <>
    <VoltarPara href="/academico" />
    <h1 className="text-2xl font-medium">Grades das turmas</h1>
  </>;
  if (!leitura.ok) return <div className="space-y-4">{cabecalho}<p role="alert">{leitura.erro}</p></div>;
  const nav = leitura.nav;
  // Fila de trabalho (E4, decisão de 10/10/2026): as propostas pendentes saem da lista quando alguém decide. Cursor nos dois
  // sentidos em ordem estável (criadoEm desc, id desc); a âncora é lida sem o filtro de pendentes, então decidir a proposta
  // âncora não a perde e a próxima continua de onde a pessoa parou sem pular ninguém.
  const where = todas ? {} : { decisao: null };
  const ler = async (l: NavegacaoFila, take: number) => {
    const cursor = cursorDaLeitura(l);
    const ancora = cursor === null ? null : await prisma.propostaGradeTurma.findUnique({ where: { id: cursor }, select: { id: true, criadoEm: true } });
    if (cursor !== null && !ancora) return [];
    const sentido = direcaoDeLeitura(l);
    return prisma.propostaGradeTurma.findMany({ where: ancora ? { AND: [where, { OR: [{ criadoEm: alemDoCursor(l, "desc", ancora.criadoEm) }, { criadoEm: ancora.criadoEm, id: alemDoCursor(l, "desc", ancora.id) }] }] } : where,
      orderBy: [{ criadoEm: sentido("desc") }, { id: sentido("desc") }], take,
      select: { id: true, versao: true, fusoOrigem: true, turma: { select: { codigo: true } },
        decisao: { select: { aprovada: true } }, preparador: { select: { nome: true } } } });
  };
  const { registros: itens, anterior, proxima } = await lerPaginaDaFila(nav, 30, ler, (p) => p.id);
  return <div className="space-y-4">
    {cabecalho}
    <p>Confira os encontros e a disponibilidade antes da aprovação independente.</p>
    <Link href="/academico/grades/nova" className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Preparar nova grade</Link>
    <nav aria-label="Situação das grades" className="flex gap-4"><Link href="/academico/grades">Pendentes</Link><Link href="/academico/grades?historico=todos">Incluir histórico</Link></nav>
    {!itens.length && (cursorDaLeitura(nav) !== null
      ? <EstadoVazio bloco acao={<Link className="underline" href={hrefLista("/academico/grades", filtro)}>Ir para o início da fila</Link>}>Nenhuma proposta a partir deste ponto da fila: o link ficou antigo ou a fila terminou.</EstadoVazio>
      : <EstadoVazio bloco>Nenhuma proposta encontrada.</EstadoVazio>)}
    {itens.map((p) => <article key={p.id} className="space-y-2 rounded border bg-[var(--surface)] p-4">
      <h2 className="font-medium">{p.turma.codigo} · Versão {p.versao}</h2>
      <p>{p.decisao ? p.decisao.aprovada ? "Publicada" : "Rejeitada" : "Aguardando decisão"} · {p.fusoOrigem}</p>
      <p>Preparada por {p.preparador.nome}</p>
      <Link className="underline text-brand-700" href={`/academico/grades/${p.id}`}>Revisar grade</Link>
    </article>)}
    <PaginacaoFila anterior={anterior} proxima={proxima} href={(cursor) => hrefLista("/academico/grades", { ...filtro, ...cursor })} rotulo="Navegação da fila de propostas de grade" />
  </div>;
}
