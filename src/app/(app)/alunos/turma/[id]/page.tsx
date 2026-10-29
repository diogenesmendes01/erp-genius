import { notFound } from "next/navigation";
import Link from "next/link";
import { Papel } from "@prisma/client";
import { obterTurma } from "@/server/alunos/consultas";
import { exigirSessaoPagina } from "@/server/_shared";
import { STATUS_ALUNO_LABEL } from "@/lib/labels";
import { nomeCompleto } from "@/lib/nome";
import { diarioDaTurma, progressaoDaTurma } from "@/server/academico/consultas-legado";
import { temPapel } from "@/server/_shared";
import { TurmaAcademico } from "./TurmaAcademico";
import { EstadoVazioLinha } from "@/components/EstadoVazio";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export default async function FichaTurmaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await exigirSessaoPagina(
    Papel.SECRETARIA_ACADEMICA,
    Papel.GERENTE_PEDAGOGICO,
    Papel.FINANCEIRO,
    Papel.PROFESSOR,
  );
  const turma = await obterTurma(id, usuario);
  if (!turma) notFound();
  const vagas = turma.capacidade - turma.alocacoes.length;

  const podeVerAcademico = temPapel(usuario, Papel.GERENTE_PEDAGOGICO, Papel.PROFESSOR);
  const [diario, progressao] = podeVerAcademico
    ? await Promise.all([diarioDaTurma(id), progressaoDaTurma(id)])
    : [null, null];
  const podeEditar = false;
  const podeAprovar = false;

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

      <section className="overflow-x-auto rounded-lg border border-gray-200">
        <Table className="w-full text-sm">
          <TableHeader className="bg-surface-muted text-left text-xs text-gray-500">
            <TableRow>
              <TableHead className="px-4 py-2 font-medium">Aluno</TableHead>
              <TableHead className="px-4 py-2 font-medium">Código</TableHead>
              <TableHead className="px-4 py-2 font-medium">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-gray-100">
            {turma.alocacoes.length === 0 ? (
              <EstadoVazioLinha colSpan={3}>
                  Nenhum aluno alocado.
                </EstadoVazioLinha>
            ) : (
              turma.alocacoes.map((a) => (
                <TableRow key={a.id} className="hover:bg-surface-muted">
                  <TableCell className="px-4 py-3">
                    <Link href={`/alunos/${a.aluno.id}`} className="font-medium text-brand-700 hover:underline">
                      {nomeCompleto(a.aluno)}
                    </Link>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-500">{a.aluno.codigo}</TableCell>
                  <TableCell className="px-4 py-3 text-gray-600">{STATUS_ALUNO_LABEL[a.aluno.status]}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      {diario && progressao && (
        <TurmaAcademico
          turmaId={id}
          diario={diario}
          progressao={progressao}
          podeEditar={podeEditar}
          podeAprovar={podeAprovar}
        />
      )}
    </div>
  );
}
