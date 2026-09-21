import Link from "next/link";
import { Papel } from "@prisma/client";
import { notFound } from "next/navigation";
import { exigirSessaoPagina } from "@/server/_shared";
import { prisma } from "@/lib/prisma";
import { listarContextoMudancaAcademica } from "@/server/academico/consultas";
import { PrepararEquivalenciaTransferencia } from "./PrepararEquivalenciaTransferencia";

export default async function EquivalenciaTransferenciaPage({ params }: { params: Promise<{ alocacaoId: string }> }) {
  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);
  const { alocacaoId } = await params;
  const alocacao = await prisma.alocacaoTurma.findUnique({
    where: { id: alocacaoId },
    select: { alunoId: true, matriculaId: true },
  });
  if (!alocacao?.matriculaId) notFound();

  const contexto = await listarContextoMudancaAcademica(alocacao.alunoId, alocacao.matriculaId);
  if (!contexto.ok || !contexto.dado) return <section className="space-y-3"><Link className="underline" href={`/academico/avaliacoes/${encodeURIComponent(alocacaoId)}`}>Voltar às avaliações</Link><p role="alert">{contexto.ok ? "Consulta indisponível." : contexto.erro}</p></section>;
  if (contexto.dado.origem?.alocacaoId !== alocacaoId) return <section className="space-y-3"><Link className="underline" href={`/academico/avaliacoes/${encodeURIComponent(alocacaoId)}`}>Voltar às avaliações</Link><p role="alert">O vínculo de origem mudou. Atualize a matrícula antes de preparar o aproveitamento.</p></section>;

  const destinos = contexto.dado.destinos.filter((destino) => destino.tipo === "EQUIVALENTE");
  return <section className="space-y-5">
    <header className="space-y-2">
      <Link className="underline" href={`/academico/avaliacoes/${encodeURIComponent(alocacaoId)}`}>Voltar às avaliações</Link>
      <h1 className="text-2xl font-medium">Preparar aproveitamento para transferência equivalente</h1>
      <p>Selecione fontes oficializadas da turma atual para cada requisito da turma de destino. A preparação ainda depende de decisão independente e de execução pela equipe autorizada.</p>
    </header>
    {(!contexto.dado.podeTransferirEquivalente || !destinos.length) ? <p role="status">{contexto.dado.impedimento ?? (contexto.dado.pedidoAbertoId ? "Há uma mudança acadêmica em andamento nesta matrícula. Conclua ou regularize esse fluxo antes de preparar outra." : "Não há turma equivalente disponível para esta preparação.")}</p> : <PrepararEquivalenciaTransferencia matriculaId={alocacao.matriculaId} alocacaoOrigemId={alocacaoId} destinos={destinos} />}
  </section>;
}
