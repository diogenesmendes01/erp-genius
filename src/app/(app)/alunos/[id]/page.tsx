import { notFound } from "next/navigation";
import { Papel } from "@prisma/client";
import {
  obterAluno,
  listarTurmasAbertasComVaga,
  podeMovimentarAluno,
} from "@/server/alunos/consultas";
import { listarPaises } from "@/server/paises/consultas";
import { exigirSessaoPagina } from "@/server/_shared";
import { nomeCompleto } from "@/lib/nome";
import { FichaAluno, type AlunoFicha } from "./FichaAluno";

export default async function AlunoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Ficha do aluno (doc 07 / nav). Professor recebe escopo: obterAluno devolve
  // null se o aluno não estiver em uma das suas turmas → notFound.
  const usuario = await exigirSessaoPagina(
    Papel.SECRETARIA_ACADEMICA,
    Papel.GERENTE_PEDAGOGICO,
    Papel.FINANCEIRO,
    Papel.PROFESSOR,
  );
  const [dados, turmas, paises] = await Promise.all([
    obterAluno(id, usuario),
    listarTurmasAbertasComVaga(),
    listarPaises(),
  ]);
  if (!dados) notFound();
  const { aluno, financeiro } = dados;
  const turma = aluno.alocacoes[0]?.turma ?? null;

  const ficha: AlunoFicha = {
    id: aluno.id,
    codigo: aluno.codigo,
    nome: nomeCompleto(aluno),
    primeiroNome: aluno.primeiroNome,
    sobrenome: aluno.sobrenome,
    nomePreferido: aluno.nomePreferido,
    status: aluno.status,
    pais: aluno.pais.nome,
    paisId: aluno.paisId,
    nascimento: aluno.nascimento ? aluno.nascimento.toISOString() : null,
    genero: aluno.genero,
    tipoDocumentoId: aluno.tipoDocumentoId,
    documento: aluno.documento,
    documentoValido: aluno.documentoValido,
    documentoPaisEmissor: aluno.documentoPaisEmissor,
    nacionalidade: aluno.nacionalidade,
    segundaNacionalidade: aluno.segundaNacionalidade,
    telefone: aluno.telefoneE164,
    email: aluno.email,
    whatsapp: aluno.whatsapp,
    aceitaComunicacoes: aluno.aceitaComunicacoes,
    paisResidencia: aluno.paisResidencia,
    cep: aluno.cep,
    rua: aluno.rua,
    numero: aluno.numero,
    complemento: aluno.complemento,
    bairro: aluno.bairro,
    cidade: aluno.cidade,
    regiao: aluno.regiao,
    escolaridade: aluno.escolaridade,
    idiomaNativo: aluno.idiomaNativo,
    fuso: aluno.fuso,
    observacoes: aluno.observacoes,
    turmaAtual: turma
      ? {
          id: turma.id,
          label: `${turma.modalidade.nome} · ${turma.nivel.idioma.nome} ${turma.nivel.codigo}`,
          professor: turma.professor?.nome ?? null,
          diasHorario: turma.diasHorario ?? null,
        }
      : null,
    // Projeção pedagógica (doc 10): professor não recebe financeiro (já vem null da consulta).
    financeiro: financeiro
      ? {
          atrasado: financeiro.atrasado,
          emAberto: financeiro.emAberto,
          proximoVencimento: financeiro.proximoVencimento ? financeiro.proximoVencimento.toISOString() : null,
        }
      : null,
    movimentacoes: aluno.movimentacoes.map((m) => ({
      id: m.id,
      tipo: m.tipo,
      motivo: m.motivo,
      observacao: m.observacao,
      criadoEm: m.criadoEm.toISOString(),
      usuario: m.usuario?.nome ?? null,
    })),
  };

  return (
    <FichaAluno
      aluno={ficha}
      turmas={turmas}
      paises={paises.map((p) => ({
        id: p.id,
        nome: p.nome,
        tiposDocumento: p.tiposDocumento.map((t) => ({ id: t.id, nome: t.nome })),
      }))}
      podeMovimentar={podeMovimentarAluno(usuario)}
    />
  );
}
