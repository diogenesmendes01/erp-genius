"use server";

import { Papel } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearEstadoAcademico, exigirUsuarioAcademicoAtual } from "@/server/academico/estado";

const papeis = [Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR];
const schema = z.object({
  alocacaoId: z.string().min(1), matriculaId: z.string().min(1),
  motivo: z.string().trim().min(5).max(2000),
}).strict();

export async function consultarVinculosLegados(alunoId: string) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...papeis);
    z.string().min(1).parse(alunoId);
    return prisma.$transaction(async (tx) => {
      await exigirUsuarioAcademicoAtual(tx, autor.id, papeis);
      const alocacoes = await tx.alocacaoTurma.findMany({
        where: { alunoId, ativa: true, encerradaEm: null, matriculaId: null }, orderBy: { id: "asc" },
        select: { id: true, turma: { select: { codigo: true, nome: true, modalidadeId: true, nivel: { select: { idiomaId: true, codigo: true } } } } },
      });
      const contratos = await tx.matricula.findMany({ where: { alunoId, status: "ATIVA" }, orderBy: { criadoEm: "asc" },
        select: { id: true, codigo: true, produto: { select: { idiomaId: true, modalidadeId: true, idioma: { select: { nome: true } }, modalidade: { select: { nome: true } } } } },
      });
      return alocacoes.map((a) => ({ alocacaoId: a.id,
        turma: [a.turma.codigo, a.turma.nome, a.turma.nivel.codigo].filter(Boolean).join(" · "),
        contratos: contratos.filter((m) => m.produto.idiomaId === a.turma.nivel.idiomaId && m.produto.modalidadeId === a.turma.modalidadeId)
          .map((m) => ({ id: m.id, codigo: m.codigo, nome: `${m.produto.idioma.nome} · ${m.produto.modalidade.nome}` })),
      }));
    });
  });
}

/** Conferência explícita do legado: não escolhe contrato pelo primeiro resultado. */
export async function vincularAlocacaoLegada(input: z.input<typeof schema>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...papeis);
    const dados = schema.parse(input);
    const alunoId = await prisma.$transaction(async (tx) => {
      const inicial = await tx.alocacaoTurma.findUnique({ where: { id: dados.alocacaoId }, select: { alunoId: true } });
      if (!inicial) throw new ErroRegra("Alocação não encontrada.");
      await bloquearEstadoAcademico(tx, inicial.alunoId);
      await exigirUsuarioAcademicoAtual(tx, autor.id, papeis);
      const alocacao = await tx.alocacaoTurma.findUnique({ where: { id: dados.alocacaoId }, include: { turma: { select: { modalidadeId: true, nivel: { select: { idiomaId: true } } } } } });
      if (!alocacao || alocacao.alunoId !== inicial.alunoId) throw new ErroRegra("O vínculo mudou durante a conferência.");
      if (alocacao.matriculaId === dados.matriculaId) return inicial.alunoId;
      if (alocacao.matriculaId) throw new ErroRegra("A alocação já possui matrícula. Esta conferência não substitui vínculos existentes.");
      if (!alocacao.ativa || alocacao.encerradaEm) throw new ErroRegra("Vínculo histórico encerrado exige conferência histórica própria.");
      const matricula = await tx.matricula.findFirst({ where: { id: dados.matriculaId, alunoId: inicial.alunoId }, select: { status: true, produto: { select: { idiomaId: true, modalidadeId: true } } } });
      if (!matricula || matricula.status !== "ATIVA" || matricula.produto.idiomaId !== alocacao.turma.nivel.idiomaId || matricula.produto.modalidadeId !== alocacao.turma.modalidadeId) {
        throw new ErroRegra("Selecione uma matrícula ativa do mesmo aluno e compatível com idioma e modalidade da turma.");
      }
      await tx.alocacaoTurma.update({ where: { id: alocacao.id }, data: { matriculaId: dados.matriculaId } });
      await registrarEvento(tx, { tipo: "AlocacaoLegadaVinculada", agregadoTipo: "Matricula", agregadoId: dados.matriculaId, autorId: autor.id,
        payload: { alunoId: inicial.alunoId, alocacaoId: alocacao.id, turmaId: alocacao.turmaId, matriculaAnteriorId: null, motivo: dados.motivo },
      });
      return inicial.alunoId;
    });
    revalidatePath(`/alunos/${alunoId}`);
    revalidatePath("/academico");
    revalidatePath("/diario");
    return { alunoId, alocacaoId: dados.alocacaoId, matriculaId: dados.matriculaId };
  });
}
