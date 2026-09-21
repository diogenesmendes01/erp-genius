"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { exigirFechamentoProgressaoTx } from "@/server/avaliacoes/progressao-fechamento-tx";
import { Papel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ErroPermissao,
  ErroRegra,
  executarAcao,
  exigirPapel,
  exigirSessao,
  registrarEvento,
  temPapel,
  type Resultado,
} from "@/server/_shared";
import {
  TesteNivelSchema,
  type AvaliacaoInput,
  type CriarAcessoPortalInput,
  type LancarNotasInput,
  type RegistrarAulaInput,
  type TesteNivelInput,
} from "./schema-legado";

// ACADÊMICO — Fase 3 (doc 03): diário de classe, avaliações/notas, teste de nível,
// PROGRESSÃO (o sistema calcula e sugere; um humano aprova — mesma filosofia híbrida do
// C4) e certificados. Toda mutação grava Evento (doc 13).

const PAPEIS_ACADEMICO: Papel[] = [Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.PROFESSOR];
const PAPEIS_PROGRESSAO: Papel[] = [Papel.GERENTE_PEDAGOGICO];

function revalidar(turmaId?: string, alunoId?: string) {
  if (turmaId) revalidatePath(`/alunos/turma/${turmaId}`);
  if (alunoId) revalidatePath(`/alunos/${alunoId}`);
  revalidatePath("/portal");
}

/** Diário de classe: registra (ou re-registra) a aula do dia com a frequência da turma. */
export async function registrarAula(_input: RegistrarAulaInput): Promise<Resultado<{ aulaId: string }>> {
  return executarAcao(async () => {
    await exigirSessao();
    void _input;
    throw new ErroRegra("Use o diário por encontro em /diario; a chamada exige vínculo histórico e conclusão conferida.");
  });
}

export async function salvarAvaliacao(_input: AvaliacaoInput): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    await exigirSessao();
    void _input;
    throw new ErroRegra("Use /academico/avaliacoes para preparar avaliações conforme a regra institucional aprovada.");
  });
}

export async function lancarNotas(_input: LancarNotasInput): Promise<Resultado> {
  return executarAcao(async () => {
    await exigirSessao();
    void _input;
    throw new ErroRegra("Use /avaliacoes para lançar e submeter notas à oficialização independente.");
  });
}

export async function registrarTesteNivel(input: TesteNivelInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_ACADEMICO);
    const dados = TesteNivelSchema.parse(input);
    const nivel = await prisma.nivel.findUnique({ where: { id: dados.nivelId } });
    if (!nivel) throw new ErroRegra("Nível inexistente.");

    await prisma.$transaction(async (tx) => {
      const aluno = await tx.aluno.findUnique({ where: { id: dados.alunoId }, select: { id: true } });
      if (!aluno) throw new ErroRegra("Aluno não encontrado.");
      // Escopo do PROFESSOR (review PR #60 rodada 2): sem esta checagem, qualquer alunoId
      // colado deixava inserir teste no histórico/portal de aluno de fora das suas turmas.
      // Secretaria/gerência pedagógica (e admin) seguem sem restrição.
      if (!temPapel(autor, Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO)) {
        const naMinhaTurma = await tx.alocacaoTurma.findFirst({
          where: { alunoId: dados.alunoId, ativa: true, turma: { professorId: autor.id } },
          select: { id: true },
        });
        if (!naMinhaTurma) throw new ErroPermissao("Este aluno não está nas suas turmas.");
      }
      await tx.testeNivel.create({
        data: {
          alunoId: dados.alunoId,
          nivelId: dados.nivelId,
          pontuacao: dados.pontuacao ?? null,
          observacao: dados.observacao,
        },
      });
      await registrarEvento(tx, {
        tipo: "TesteNivelRegistrado",
        agregadoTipo: "Aluno",
        agregadoId: dados.alunoId,
        autorId: autor.id,
        payload: { nivelId: dados.nivelId, nivel: nivel.codigo, pontuacao: dados.pontuacao ?? null },
      });
    });
    revalidar(undefined, dados.alunoId);
  });
}

/**
 * PROGRESSÃO (aprovação humana sobre o cálculo do sistema): marca o nível da turma como
 * CONCLUÍDO pelo aluno + emite o CERTIFICADO com código público de validação. A alocação
 * na próxima turma segue pelo fluxo existente de troca de turma (decisão humana).
 */
export async function aprovarNivelAluno(turmaId: string, alunoId: string): Promise<Resultado<{ codigoValidacao: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_PROGRESSAO);
    const turma = await prisma.turma.findUnique({ where: { id: turmaId }, include: { nivel: true } });
    if (!turma) throw new ErroRegra("Turma não encontrada.");
    const alocado = await prisma.alocacaoTurma.findFirst({ where: { turmaId, alunoId, ativa: true } });
    if (!alocado) throw new ErroRegra("O aluno não está (mais) nesta turma.");

    // Idempotência: um certificado por aluno×nível.
    const ja = await prisma.certificado.findFirst({ where: { alunoId, nivelId: turma.nivelId } });
    if (ja) throw new ErroRegra(`Este aluno já tem certificado do nível ${turma.nivel.codigo}.`);

    const codigoValidacao = randomBytes(6).toString("hex").toUpperCase();
    try {
      await prisma.$transaction(async (tx) => {
        await exigirFechamentoProgressaoTx(tx, { matriculaId: alocado.matriculaId, alocacaoId: alocado.id, gestorResponsavelId: autor.id });
        await tx.certificado.create({
          data: { alunoId, nivelId: turma.nivelId, turmaId, codigoValidacao },
        });
        await registrarEvento(tx, {
          tipo: "NivelConcluido",
          agregadoTipo: "Aluno",
          agregadoId: alunoId,
          autorId: autor.id,
          payload: { nivelId: turma.nivelId, nivel: turma.nivel.codigo, turmaId, codigoValidacao },
        });
      });
    } catch (e) {
      // @@unique(alunoId, nivelId) — review PR #60 rodada 2: o pré-check acima não segura
      // duas aprovações CONCORRENTES; o banco garante e o conflito é idempotência.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ErroRegra(`Este aluno já tem certificado do nível ${turma.nivel.codigo}.`);
      }
      throw e;
    }
    revalidar(turmaId, alunoId);
    return { codigoValidacao };
  });
}

/** Cria (uma vez) o acesso do PORTAL para um aluno: Usuario papel ALUNO vinculado 1:1. */
export async function criarAcessoPortal(_input: CriarAcessoPortalInput): Promise<Resultado> {
  return executarAcao(async () => {
    await exigirSessao();
    void _input;
    throw new ErroRegra("Use o convite individual em /secretaria. Somente o aluno define sua senha pelo link autorizado.");
  });
}
