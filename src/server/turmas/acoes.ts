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
import { TurmaSchema, type TurmaInput, diasPorSemanaDaFrequencia, rotuloDiasHorario } from "./schema";

// Valida a agenda contra a frequência da modalidade e devolve o rótulo derivado.
// Lança ErroRegra se o nº de dias não casar (ex.: Intensiva 3x exige 3 dias).
async function validarAgenda(
  modalidadeId: string,
  diasSemana: number[],
  horarioInicio: string,
  horarioFim: string,
): Promise<string> {
  const modalidade = await prisma.modalidade.findUnique({ where: { id: modalidadeId } });
  if (!modalidade) throw new ErroRegra("Modalidade não encontrada.");
  const req = diasPorSemanaDaFrequencia(modalidade.frequencia);
  const dias = Array.from(new Set(diasSemana)); // sem duplicados
  if (req !== null && dias.length !== req) {
    throw new ErroRegra(
      `A modalidade ${modalidade.nome} é ${modalidade.frequencia}: selecione exatamente ${req} dia(s) — você marcou ${dias.length}.`,
    );
  }
  return rotuloDiasHorario(dias, horarioInicio, horarioFim);
}

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
    // Evento gravado em transação (issue #1): consistente com o restante do domínio.
    await prisma.$transaction(async (tx) => {
      await registrarEvento(tx, {
        tipo: "AberturaTurmaSolicitada",
        agregadoTipo: "Produto",
        agregadoId: input.produtoId,
        autorId: autor.id,
        payload: { nivelId: input.nivelId ?? null, observacao: input.observacao ?? null },
      });
    });
    revalidatePath(PATH);
  });
}

export async function criarTurma(input: TurmaInput): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirGestorTurma();
    const dados = TurmaSchema.parse(input);

    const diasHorario = await validarAgenda(dados.modalidadeId, dados.diasSemana, dados.horarioInicio, dados.horarioFim);

    const id = await prisma.$transaction(async (tx) => {
      const codigo = await gerarCodigo("turma");
      const turma = await tx.turma.create({
        data: {
          codigo,
          nome: dados.nome ?? null,
          modalidadeId: dados.modalidadeId,
          nivelId: dados.nivelId,
          professorId: dados.professorId || null,
          diasSemana: dados.diasSemana,
          horarioInicio: dados.horarioInicio,
          horarioFim: dados.horarioFim,
          diasHorario,
          dataInicio: dados.dataInicio,
          dataFim: dados.dataFim,
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

    const diasHorario = await validarAgenda(dados.modalidadeId, dados.diasSemana, dados.horarioInicio, dados.horarioFim);

    await prisma.$transaction(async (tx) => {
      await tx.turma.update({
        where: { id },
        data: {
          nome: dados.nome ?? null,
          modalidadeId: dados.modalidadeId,
          nivelId: dados.nivelId,
          professorId: dados.professorId || null,
          diasSemana: dados.diasSemana,
          horarioInicio: dados.horarioInicio,
          horarioFim: dados.horarioFim,
          diasHorario,
          dataInicio: dados.dataInicio,
          dataFim: dados.dataFim,
          capacidade: dados.capacidade,
          rolling: dados.rolling,
        },
      });
      await registrarEvento(tx, {
        tipo: "TurmaEditada",
        agregadoTipo: "Turma",
        agregadoId: id,
        autorId: autor.id,
        payload: { diasHorario, capacidade: dados.capacidade },
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
