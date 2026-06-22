import { notFound } from "next/navigation";
import { obterAluno, listarTurmasAbertasComVaga } from "@/server/alunos/consultas";
import { listarPaisesSimples } from "@/server/paises/consultas";
import { FichaAluno, type AlunoFicha } from "./FichaAluno";

export default async function AlunoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [dados, turmas, paises] = await Promise.all([
    obterAluno(id),
    listarTurmasAbertasComVaga(),
    listarPaisesSimples(),
  ]);
  if (!dados) notFound();
  const { aluno, financeiro } = dados;
  const turma = aluno.alocacoes[0]?.turma ?? null;

  const ficha: AlunoFicha = {
    id: aluno.id,
    codigo: aluno.codigo,
    nome: aluno.nome,
    status: aluno.status,
    pais: aluno.pais.nome,
    paisId: aluno.paisId,
    nascimento: aluno.nascimento ? aluno.nascimento.toISOString() : null,
    documento: aluno.documento,
    documentoValido: aluno.documentoValido,
    telefone: aluno.telefoneE164,
    email: aluno.email,
    genero: aluno.genero,
    turmaAtual: turma
      ? {
          id: turma.id,
          label: `${turma.modalidade.nome} · ${turma.nivel.idioma.nome} ${turma.nivel.codigo}`,
          professor: turma.professor?.nome ?? null,
          diasHorario: turma.diasHorario ?? null,
        }
      : null,
    financeiro: {
      atrasado: financeiro.atrasado,
      emAberto: financeiro.emAberto,
      proximoVencimento: financeiro.proximoVencimento ? financeiro.proximoVencimento.toISOString() : null,
    },
    movimentacoes: aluno.movimentacoes.map((m) => ({
      id: m.id,
      tipo: m.tipo,
      motivo: m.motivo,
      observacao: m.observacao,
      criadoEm: m.criadoEm.toISOString(),
      usuario: m.usuario?.nome ?? null,
    })),
  };

  return <FichaAluno aluno={ficha} turmas={turmas} paises={paises} />;
}
