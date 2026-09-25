import Link from "next/link";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoPagina } from "@/server/_shared";
import { VoltarPara } from "@/components/VoltarPara";

export default async function AdmissoesPage({ searchParams }: { searchParams: Promise<{ busca?: string; pagina?: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
  const filtros = await searchParams, busca = (filtros.busca ?? "").trim().slice(0, 100);
  const numero = Number(filtros.pagina ?? 1), pagina = Number.isInteger(numero) && numero >= 1 && numero <= 100000 ? numero : 1;
  const turmas = await prisma.turma.findMany({ where: busca ? { OR: [{ codigo: { contains: busca, mode: "insensitive" } }, { nome: { contains: busca, mode: "insensitive" } }] } : {},
    orderBy: { id: "desc" }, skip: (pagina - 1) * 30, take: 31, select: { id: true, codigo: true, nome: true, status: true } });
  return <div className="space-y-4"><VoltarPara href="/academico" />
    <h1 className="text-2xl font-medium">Janelas de admissão</h1>
    <Link className="underline" href="/academico/admissoes/excecoes">Exceções de ingresso por reserva</Link>
    <form><label>Buscar turma<input name="busca" defaultValue={busca} maxLength={100} className="mx-2 rounded border bg-[var(--surface)] p-2" /></label><button className="rounded border p-2">Buscar</button></form>
    {!turmas.length && <p>Nenhuma turma encontrada.</p>}
    <ul className="space-y-2">{turmas.slice(0, 30).map((t) => <li key={t.id} className="rounded border p-3"><Link className="underline" href={`/academico/admissoes/${t.id}`}>{t.codigo ?? t.nome ?? "Turma sem código"}</Link> · {({ PLANEJADA: "Planejada", ABERTA: "Aberta", EM_ANDAMENTO: "Em andamento", CONCLUIDA: "Concluída" })[t.status]}</li>)}</ul>
    <nav aria-label="Páginas de turmas" className="flex gap-4">{pagina > 1 && <Link href={`?busca=${encodeURIComponent(busca)}&pagina=${pagina - 1}`}>Anterior</Link>}{turmas.length > 30 && <Link href={`?busca=${encodeURIComponent(busca)}&pagina=${pagina + 1}`}>Próxima</Link>}</nav>
  </div>;
}
