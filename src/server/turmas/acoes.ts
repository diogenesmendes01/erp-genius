"use server";

import { revalidatePath } from "next/cache";
import { Papel, StatusTurma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { gerarCodigo } from "@/lib/codigo";
import {
  exigirSessaoComPapel,
  registrarEvento,
  executarAcao,
  ErroRegra,
  type Resultado,
} from "@/server/_shared";
import { TurmaSchema, type TurmaInput } from "./schema";

const PATH = "/configuracao/turmas";

// Dono = Gerente Pedagógico (Admin passa automaticamente em exigirPapel).
async function exigirGestorTurma() {
  return exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
}

/** Vendedor solicita abertura de turma ao Gerente Pedagógico (doc 09 §Matrícula). */
export async function solicitarAberturaTurma(input: {
  produtoId: string;
  nivelId?: string;
  observacao?: string;
}): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL);
    if (!input.produtoId) throw new ErroRegra("Selecione o produto.");
    await registrarEvento(prisma, {
      tipo: "AberturaTurmaSolicitada",
      agregadoTipo: "Produto",
      agregadoId: input.produtoId,
      autorId: autor.id,
      payload: { nivelId: input.nivelId ?? null, observacao: input.observacao ?? null },
    });
    revalidatePath(PATH);
  });
}

export async function criarTurma(input: TurmaInput): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirGestorTurma();
    const dados = TurmaSchema.parse(input);

    const id = await prisma.$transaction(async (tx) => {
      const codigo = await gerarCodigo("turma");
      const turma = await tx.turma.create({
        data: {
          codigo,
          modalidadeId: dados.modalidadeId,
          nivelId: dados.nivelId,
          professorId: dados.professorId || null,
          diasHorario: dados.diasHorario ?? null,
          dataInicio: dados.dataInicio ?? null,
          capacidade: dados.capacidade,
          rolling: dados.rolling,
          status: StatusTurma.PLANEJADA,
        },
      });
      await registrarEvento(tx, {
        tipo: "TurmaCriada",
        agregadoTipo: "Turma",
        agregadoId: turma.id,
        autorId: autor.id,
        payload: { codigo, modalidadeId: dados.modalidadeId, nivelId: dados.nivelId },
      });
      return turma.id;
    });

    revalidatePath(PATH);
    return { id };
  });
}

export async function editarTurma(id: string, input: TurmaInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirGestorTurma();
    const dados = TurmaSchema.parse(input);
    const atual = await prisma.turma.findUnique({ where: { id } });
    if (!atual) throw new ErroRegra("Turma não encontrada.");

    await prisma.$transaction(async (tx) => {
      await tx.turma.update({
        where: { id },
        data: {
          modalidadeId: dados.modalidadeId,
          nivelId: dados.nivelId,
          professorId: dados.professorId || null,
          diasHorario: dados.diasHorario ?? null,
          dataInicio: dados.dataInicio ?? null,
          capacidade: dados.capacidade,
          rolling: dados.rolling,
        },
      });
      await registrarEvento(tx, {
        tipo: "TurmaEditada",
        agregadoTipo: "Turma",
        agregadoId: id,
        autorId: autor.id,
        payload: { diasHorario: dados.diasHorario ?? null, capacidade: dados.capacidade },
      });
    });

    revalidatePath(PATH);
  });
}

const EVENTO_STATUS: Record<StatusTurma, string> = {
  PLANEJADA: "TurmaPlanejada",
  ABERTA: "TurmaAberta",
  EM_ANDAMENTO: "TurmaEmAndamento",
  CONCLUIDA: "TurmaConcluida",
};

export async function alterarStatusTurma(id: string, novoStatus: StatusTurma): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirGestorTurma();
    const turma = await prisma.turma.findUnique({ where: { id } });
    if (!turma) throw new ErroRegra("Turma não encontrada.");
    if (turma.status === novoStatus) return;

    await prisma.$transaction(async (tx) => {
      await tx.turma.update({ where: { id }, data: { status: novoStatus } });
      await registrarEvento(tx, {
        tipo: EVENTO_STATUS[novoStatus],
        agregadoTipo: "Turma",
        agregadoId: id,
        autorId: autor.id,
        payload: { de: turma.status, para: novoStatus },
      });
    });

    revalidatePath(PATH);
  });
}
