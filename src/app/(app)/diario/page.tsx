import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarAulasDiario, listarTurmasParaDiario } from "@/server/diario/consultas";
import { DiarioAulas } from "./DiarioAulas";
import { hrefDiario, lerBuscaDiario } from "@/server/diario/busca-diario";

export default async function DiarioPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const usuario = await exigirSessaoPagina(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
  const parametros = await searchParams;
  const antes = typeof parametros.antes === "string" ? parametros.antes : undefined;
  // Busca no servidor (E4): por turma, assunto da aula ou professor; mantida ao paginar.
  const busca = lerBuscaDiario(parametros);
  const [historico, turmas] = await Promise.all([listarAulasDiario(usuario, antes, busca), listarTurmasParaDiario(usuario)]);
  return <div className="space-y-6">
    <Link className="text-sm text-brand-700 underline" href="/academico/avaliacoes">Avaliações e histórico por matrícula</Link>
    <Link className="text-sm text-brand-700 underline" href="/diario/encontros">Encontros atribuídos</Link>
    <Link className="ml-4 text-sm text-brand-700 underline" href="/diario/regularizacoes">Regularizações de aula</Link>
    <Link className="ml-4 text-sm text-brand-700 underline" href="/diario/pendencias">Pendências do diário</Link>
    {usuario.papeis.includes(Papel.PROFESSOR) && <Link className="ml-4 text-sm text-brand-700 underline" href="/diario/reposicoes">Fila de reposições individuais</Link>}
    <Link className="ml-4 text-sm text-brand-700 underline" href="/diario/excecoes-gravacao">Exceções de gravação</Link>
    {usuario.papeis.some((papel) => papel === Papel.GERENTE_PEDAGOGICO || papel === Papel.ADMINISTRADOR) && <Link className="ml-4 text-sm text-brand-700 underline" href="/diario/regularizacoes-gravacao">Regularizações de gravação</Link>}
    <form method="get" action="/diario" role="search" aria-label="Buscar no histórico do diário" className="flex flex-wrap items-center gap-2">
      <input name="busca" defaultValue={busca} maxLength={100} aria-label="Buscar aula por turma, assunto ou professor" placeholder="Buscar por turma, assunto ou professor…" className="w-72 rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500" />
      <button type="submit" className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Buscar</button>
      {busca && <Link href="/diario" className="text-sm text-brand-700 hover:underline">Limpar busca</Link>}
    </form>
    <DiarioAulas aulas={historico.aulas} turmas={turmas} mensagemVazio={busca ? `Nenhuma aula para “${busca}”${antes ? " nesta página" : ""}.` : undefined} />
    <nav aria-label="Páginas do histórico do diário" className="flex gap-4 text-sm text-brand-700">
      {antes && <Link href={hrefDiario({ busca })}>Aulas recentes</Link>}
      {historico.proximo && <Link href={hrefDiario({ busca, antes: historico.proximo })}>Aulas anteriores →</Link>}
    </nav>
  </div>;
}
