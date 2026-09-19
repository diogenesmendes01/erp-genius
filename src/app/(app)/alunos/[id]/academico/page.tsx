import Link from "next/link";
import { notFound } from "next/navigation";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina, temPapel } from "@/server/_shared";
import { obterAluno } from "@/server/alunos/consultas";
import { nomeCompleto } from "@/lib/nome";
import { listarContextoMudancaAcademica, listarSolicitacoesAcademicas } from "@/server/academico/consultas";
import { MudancasAcademicasPainel } from "@/app/(app)/academico/MudancasAcademicasPainel";
import { prisma } from "@/lib/prisma";
import { SOLICITANTES_ACADEMICOS } from "@/server/academico/estado";
import { escopoTurmasDocente } from "@/server/diario/permissoes";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";

export default async function AcademicoAlunoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ antesDe?: string; matriculaId?: string }> }) {
  const usuario = await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.PROFESSOR);
  const { id } = await params;
  const { antesDe, matriculaId } = await searchParams;
  const ficha = await obterAluno(id, usuario);
  if (!ficha) notFound();
  const amplo = usuario.papeis.some((p) => SOLICITANTES_ACADEMICOS.includes(p));
  const [contexto, lista, vinculos, preferencia] = await Promise.all([listarContextoMudancaAcademica(id, matriculaId), listarSolicitacoesAcademicas({ alunoId: id, matriculaId, antesDe }),
    prisma.alocacaoTurma.findMany({ where: { alunoId: id, ativa: true, matriculaId: { not: null }, ...(!amplo ? { turma: escopoTurmasDocente(usuario.id) } : {}) }, orderBy: { id: "asc" },
      select: { id: true, matriculaId: true, matricula: { select: { codigo: true } }, turma: { select: { codigo: true, nome: true, nivel: { select: { codigo: true, idioma: { select: { nome: true } } } } } } },
    }),
    consultarPreferenciaFusoEquipe(),
  ]);
  const dados = lista.ok ? lista.dado : null;
  const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "America/Sao_Paulo");
  return <div className="space-y-5">
    <header><Link href={`/alunos/${id}`} className="text-sm text-gray-500 hover:text-gray-900">← Ficha do aluno</Link><h1 className="mt-2 text-2xl font-medium">{nomeCompleto(ficha.aluno)} · mudanças acadêmicas</h1></header>
    {vinculos.length > 0 && <nav aria-label="Matrícula para mudança acadêmica" className="space-y-2 rounded border p-4">
      <h2 className="font-medium">Escolha o contrato para preparar a mudança</h2>
      {vinculos.map((v) => <Link key={v.id} aria-current={matriculaId === v.matriculaId ? "page" : undefined} className="block text-sm text-brand-700 underline" href={`/alunos/${id}/academico?matriculaId=${encodeURIComponent(v.matriculaId!)}`}>{v.matricula?.codigo ?? "Contrato sem código"} · {v.turma.nivel.idioma.nome} {v.turma.nivel.codigo} · {v.turma.codigo ?? v.turma.nome ?? "Turma sem código"}</Link>)}
    </nav>}
    {usuario.papeis.some(p => p === Papel.PROFESSOR || p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR) && vinculos.length > 0 && <nav aria-label="Avaliações por matrícula" className="space-y-2 rounded border p-4">
      <h2 className="font-medium">Avaliações por matrícula</h2>
      {vinculos.map(v => <Link key={v.id} className="block underline" href={`/academico/avaliacoes/${encodeURIComponent(v.id)}`}>{v.matricula?.codigo ?? "Contrato sem código"} · {v.turma.nivel.idioma.nome} {v.turma.nivel.codigo} · {v.turma.codigo ?? v.turma.nome ?? "Turma"}</Link>)}
    </nav>}
    {amplo && vinculos.length > 0 && <nav aria-label="Reposições individuais por matrícula" className="space-y-2 rounded border p-4">
      <h2 className="font-medium">Reposições individuais de frequência</h2>
      {vinculos.map(v => <Link key={v.id} className="block underline" href={`/academico/reposicoes?matriculaId=${encodeURIComponent(v.matriculaId!)}`}>{v.matricula?.codigo ?? "Contrato sem código"} · consultar ausências e reposições</Link>)}
    </nav>}
    <MudancasAcademicasPainel key={matriculaId ?? "legado"} contexto={contexto.ok ? contexto.dado : null} solicitacoes={dados?.solicitacoes ?? []} erroConsulta={!contexto.ok ? contexto.erro : !lista.ok ? lista.erro : null} podeExecutarEquivalencia={temPapel(usuario, Papel.SECRETARIA_ACADEMICA)} fusoExibicao={fusoExibicao} />
    {dados?.proximo && <Link className="inline-block text-sm text-brand-700 underline" href={`/alunos/${id}/academico?antesDe=${encodeURIComponent(dados.proximo)}${matriculaId ? `&matriculaId=${encodeURIComponent(matriculaId)}` : ""}`}>Solicitações anteriores</Link>}
  </div>;
}
