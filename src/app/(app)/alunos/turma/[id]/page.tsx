import { notFound } from "next/navigation";
import Link from "next/link";
import { Papel } from "@prisma/client";
import { obterTurma } from "@/server/alunos/consultas";
import { exigirSessaoPagina } from "@/server/_shared";
import { STATUS_ALUNO_LABEL } from "@/lib/labels";

export default async function FichaTurmaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Ficha da turma (doc 07 / nav). Professor só vê turmas que leciona:
  // obterTurma devolve null fora do seu escopo → notFound.
  const usuario = await exigirSessaoPagina(
    Papel.SECRETARIA_ACADEMICA,
    Papel.GERENTE_PEDAGOGICO,
    Papel.FINANCEIRO,
    Papel.PROFESSOR,
  );
  const turma = await obterTurma(id, usuario);
  if (!turma) notFound();
  const vagas = turma.capacidade - turma.alocacoes.length;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-medium">
          {turma.modalidade.nome} · {turma.nivel.idioma.nome} {turma.nivel.codigo}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {turma.codigo} · {turma.diasHorario ?? "—"} · Professor: {turma.professor?.nome ?? "—"}
        </p>
        <p className="mt-1 text-sm text-gray-600">
          Ocupação: {turma.alocacoes.length} matriculados · {vagas} vagas
        </p>
      </header>

      <section className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Aluno</th>
              <th className="px-4 py-2 font-medium">Código</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {turma.alocacoes.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-400">
                  Nenhum aluno alocado.
                </td>
              </tr>
            ) : (
              turma.alocacoes.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/alunos/${a.aluno.id}`} className="font-medium text-brand-700 hover:underline">
                      {a.aluno.nome}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{a.aluno.codigo}</td>
                  <td className="px-4 py-3 text-gray-600">{STATUS_ALUNO_LABEL[a.aluno.status]}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
