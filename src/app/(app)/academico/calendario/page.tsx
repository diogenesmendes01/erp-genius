import Link from "next/link";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoPagina } from "@/server/_shared";

export default async function CalendarioPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
  const { cursor } = await searchParams;
  const [versoes, vigente] = await Promise.all([
    prisma.versaoCalendarioEscolar.findMany({ orderBy: { versao: "desc" }, take: 31, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, versao: true, fusoInstitucional: true, motivo: true, decisao: { select: { aprovada: true } } } }),
    prisma.versaoCalendarioEscolar.findFirst({ where: { decisao: { aprovada: true } }, orderBy: { versao: "desc" }, select: { id: true, versao: true } }),
  ]);
  return <div className="space-y-4">
    <Link className="underline" href="/academico">Voltar ao acadêmico</Link>
    <h1 className="text-2xl font-medium">Calendário da escola</h1>
    <p>Feriados, recessos e férias seguem um calendário único. As datas são interpretadas no fuso institucional de cada versão.</p>
    <p>{vigente ? `Calendário vigente: versão ${vigente.versao}` : "Ainda não há calendário publicado."}</p>
    <Link href="/academico/calendario/novo" className="inline-block rounded border px-3 py-2">Preparar nova versão</Link>
    {!versoes.length && <p>Nenhuma proposta encontrada.</p>}
    {versoes.slice(0, 30).map((v) => <article key={v.id} className="space-y-2 rounded border bg-[var(--surface)] p-4">
      <h2 className="font-medium">Versão {v.versao} · {v.id === vigente?.id ? "Vigente" : v.decisao ? v.decisao.aprovada ? "Publicada anteriormente" : "Rejeitada" : "Aguardando decisão"}</h2>
      <p>{v.fusoInstitucional}</p><p className="whitespace-pre-wrap">{v.motivo}</p>
      <Link className="text-brand-700 underline" href={`/academico/calendario/${v.id}`}>Conferir calendário</Link>
    </article>)}
    {versoes.length > 30 && <Link href={`/academico/calendario?cursor=${encodeURIComponent(versoes[29].id)}`}>Versões anteriores</Link>}
  </div>;
}
