import Link from "next/link";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoPagina } from "@/server/_shared";
import { PrepararGrade } from "./PrepararGrade";
import { VoltarPara } from "@/components/VoltarPara";
import { botaoClasses } from "@/components/Botao";

export default async function NovaGradePage({ searchParams }: { searchParams: Promise<{ busca?: string; cursor?: string; turmaId?: string | string[] }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
  const q = await searchParams;
  const busca = (q.busca ?? "").trim().slice(0, 100);
  if (Array.isArray(q.turmaId)) return <div className="space-y-4"><VoltarPara href="/academico/grades/nova" /><p role="alert">Seleção de turma inválida.</p></div>;
  const turmaId = (q.turmaId ?? "").trim().slice(0, 100);
  const turmas = await prisma.turma.findMany({
    where: { status: "PLANEJADA", ...(turmaId ? { id: turmaId } : busca ? { codigo: { contains: busca, mode: "insensitive" as const } } : {}), aulasDiario: { none: {} }, encontrosAgenda: { none: { status: { not: "RASCUNHO" } } } },
    orderBy: [{ codigo: "asc" }, { id: "asc" }], take: 31, ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    select: { id: true, codigo: true, dataInicio: true, horarioInicio: true, diasSemana: true,
      professor: { select: { nome: true } }, modalidade: { select: { aulasPorNivel: true, horasAula: true, frequencia: true } },
      propostasGrade: { orderBy: { versao: "desc" }, take: 1, select: { versao: true } } },
  });
  return <div className="space-y-5">
    <VoltarPara href="/academico/grades" />
    <h1 className="text-2xl font-medium">Preparar grade inicial</h1>
    <p>Selecione uma turma planejada. O calendário institucional precisa estar aprovado e os parâmetros da modalidade completos.</p>
    <Link href="/academico/calendario" className="text-brand-700 underline">Conferir calendário institucional</Link>
    <form className="flex flex-wrap items-end gap-3"><label>Buscar pelo código<input name="busca" defaultValue={busca} maxLength={100} className="ml-2 rounded border bg-[var(--surface)] p-2" /></label><button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Buscar turmas</button></form>
    {!turmas.length ? <p>Nenhuma turma planejada sem histórico ou agenda publicada foi encontrada.</p> : <PrepararGrade key={turmaId || busca + (q.cursor ?? "")} turmaInicialId={turmaId || null} turmas={turmas.slice(0, 30).map((t) => ({ id: t.id, codigo: t.codigo ?? `Turma sem código (${t.id})`, versao: t.propostasGrade[0]?.versao ?? 0,
      dataInicio: t.dataInicio?.toISOString().slice(0, 10) ?? null, horario: t.horarioInicio, dias: t.diasSemana,
      quantidade: t.modalidade.aulasPorNivel, duracao: t.modalidade.horasAula * 60, frequencia: t.modalidade.frequencia, professor: t.professor?.nome ?? null }))} />}
    {turmas.length > 30 && <Link href={`/academico/grades/nova?busca=${encodeURIComponent(busca)}&cursor=${encodeURIComponent(turmas[29].id)}`}>Próximas turmas</Link>}
  </div>;
}
