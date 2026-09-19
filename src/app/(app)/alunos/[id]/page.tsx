import { notFound } from "next/navigation";
import Link from "next/link";
import { Papel } from "@prisma/client";
import {
  obterAluno,
  podeMovimentarAluno,
  podeEditarCadastroAluno,
} from "@/server/alunos/consultas";
import { listarPaisesOperacionais } from "@/server/paises/consultas";
import { exigirSessaoPagina } from "@/server/_shared";
import { nomeCompleto } from "@/lib/nome";
import { prisma } from "@/lib/prisma";
import { impedimentoFluxoGlobal } from "@/server/matricula/limite-legado";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
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
  const [dados, paises] = await Promise.all([
    obterAluno(id, usuario),
    podeEditarCadastroAluno(usuario) ? listarPaisesOperacionais() : Promise.resolve([]),
  ]);
  if (!dados) notFound();
  const preferencia = await consultarPreferenciaFusoEquipe();
  const podeMovimentarGlobal = podeMovimentarAluno(usuario) && !await impedimentoFluxoGlobal(prisma, id);
  const { aluno, financeiro } = dados;

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
    turmasAtuais: aluno.alocacoes.map((a) => ({
      id: a.id, matriculaCodigo: a.matricula?.codigo ?? null,
      label: `${a.turma.modalidade.nome} · ${a.turma.nivel.idioma.nome} ${a.turma.nivel.codigo}`,
      professor: a.turma.professor?.nome ?? null, diasHorario: a.turma.diasHorario ?? null,
    })),
    // Projeção pedagógica (doc 10): professor não recebe financeiro (já vem null da consulta).
    financeiro: financeiro
      ? {
          atrasado: financeiro.atrasado,
          emAberto: financeiro.emAberto,
          proximoVencimento: financeiro.proximoVencimento,
        }
      : null,
    movimentacoes: aluno.movimentacoes.map((m) => ({
      id: m.id,
      tipo: m.tipo,
      matriculaId: m.matriculaId,
      matriculaCodigo: m.matriculaCodigo,
      motivo: m.motivo,
      observacao: m.observacao,
      criadoEm: m.criadoEm.toISOString(),
      usuario: m.usuario?.nome ?? null,
    })),
  };

  return (
    <div className="space-y-4">
    {usuario.papeis.some((p) => ([Papel.ADMINISTRADOR, Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO] as Papel[]).includes(p)) &&
      <Link className="inline-block text-sm text-brand-700 hover:underline" href={`/alunos/${id}/movimentacoes`}>Pausa, retomada e encerramento por matrícula</Link>}
    {usuario.papeis.some((p) => ([Papel.ADMINISTRADOR, Papel.SECRETARIA_ACADEMICA] as Papel[]).includes(p)) &&
      <Link className="ml-4 inline-block text-sm text-brand-700 hover:underline" href={`/alunos/${id}/portal`}>Acesso ao portal de reposições</Link>}
    {usuario.papeis.some((p) => ([Papel.ADMINISTRADOR, Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO] as Papel[]).includes(p)) &&
      <Link className="ml-4 inline-block text-sm text-brand-700 hover:underline" href={`/alunos/${id}/agenda-aditivo`}>Conferir agenda para aditivo</Link>}
    <FichaAluno
      aluno={ficha}
      paises={paises.map((p) => ({
        id: p.id,
        nome: p.nome,
        tiposDocumento: p.tiposDocumento.map((t) => ({ id: t.id, nome: t.nome })),
      }))}
      podeMovimentar={podeMovimentarAluno(usuario)}
      podeMovimentarGlobal={podeMovimentarGlobal}
      podeEditarCadastro={podeEditarCadastroAluno(usuario)}
      podeConsultarAcademico={usuario.papeis.some((p) => ([Papel.ADMINISTRADOR, Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.PROFESSOR] as Papel[]).includes(p))}
      preferenciaFusoExibicao={(preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null}
    />
    </div>
  );
}
