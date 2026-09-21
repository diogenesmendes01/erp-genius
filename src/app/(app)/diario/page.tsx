import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarAulasDiario, listarTurmasParaDiario } from "@/server/diario/consultas";
import { DiarioAulas } from "./DiarioAulas";

export default async function DiarioPage({ searchParams }: { searchParams: Promise<{ antes?: string }> }) {
  const usuario = await exigirSessaoPagina(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
  const { antes } = await searchParams;
  const [historico, turmas] = await Promise.all([listarAulasDiario(usuario, antes), listarTurmasParaDiario(usuario)]);
  return <div className="space-y-6">
    <Link className="text-sm text-brand-700 underline" href="/academico/avaliacoes">Avaliações e histórico por matrícula</Link>
    <Link className="text-sm text-brand-700 underline" href="/diario/encontros">Encontros atribuídos</Link>
    <Link className="ml-4 text-sm text-brand-700 underline" href="/diario/regularizacoes">Regularizações de aula</Link>
    <Link className="ml-4 text-sm text-brand-700 underline" href="/diario/pendencias">Pendências do diário</Link>
    {usuario.papeis.includes(Papel.PROFESSOR) && <Link className="ml-4 text-sm text-brand-700 underline" href="/diario/reposicoes">Fila de reposições individuais</Link>}
    <Link className="ml-4 text-sm text-brand-700 underline" href="/diario/excecoes-gravacao">Exceções de gravação</Link>
    {usuario.papeis.some((papel) => papel === Papel.GERENTE_PEDAGOGICO || papel === Papel.ADMINISTRADOR) && <Link className="ml-4 text-sm text-brand-700 underline" href="/diario/regularizacoes-gravacao">Regularizações de gravação</Link>}
    <DiarioAulas aulas={historico.aulas} turmas={turmas} />
    <div className="flex gap-4 text-sm text-brand-700">
      {antes && <Link href="/diario">Aulas recentes</Link>}
      {historico.proximo && <Link href={`/diario?antes=${encodeURIComponent(historico.proximo)}`}>Aulas anteriores →</Link>}
    </div>
  </div>;
}
