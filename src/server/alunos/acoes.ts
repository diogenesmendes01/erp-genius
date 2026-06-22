"use server";

import { revalidatePath } from "next/cache";
import {
  Papel,
  Prisma,
  StatusAluno,
  StatusCobranca,
  TipoMovimentacao,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { vagasTurma } from "./consultas";
import {
  exigirSessaoComPapel,
  registrarEvento,
  executarAcao,
  ErroRegra,
  normalizarTelefoneE164,
  type Resultado,
} from "@/server/_shared";
import {
  PausarSchema,
  EncerrarSchema,
  TrocarTurmaSchema,
  EditarAlunoSchema,
  type PausarInput,
  type EncerrarInput,
  type TrocarTurmaInput,
  type EditarAlunoInput,
} from "./schema";

const PAPEIS: Papel[] = [Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO];

function revalidar(id: string) {
  revalidatePath("/alunos");
  revalidatePath(`/alunos/${id}`);
  revalidatePath("/financeiro");
}

/**
 * Edita os dados cadastrais do aluno. Toda edição EXIGE motivo e registra autor + antes→depois
 * no Evento `AlunoEditado` (auditoria). Telefone normalizado pelo DDI do país escolhido.
 */
export async function editarAluno(id: string, input: EditarAlunoInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS);
    const dados = EditarAlunoSchema.parse(input);
    const aluno = await prisma.aluno.findUnique({ where: { id }, include: { pais: true } });
    if (!aluno) throw new ErroRegra("Aluno não encontrado.");

    const paisDestino =
      dados.paisId === aluno.paisId
        ? aluno.pais
        : await prisma.pais.findUnique({ where: { id: dados.paisId } });
    if (!paisDestino) throw new ErroRegra("País não encontrado.");

    const novo = {
      nome: dados.nome,
      paisId: dados.paisId,
      documento: dados.documento || null,
      telefoneE164: normalizarTelefoneE164(dados.telefone, paisDestino.ddi),
      email: dados.email || null,
      genero: dados.genero ?? null,
      nascimento: dados.nascimento ?? null,
    };
    // antes→depois só dos campos que realmente mudaram (auditoria enxuta, JSON serializável)
    const atual: Record<string, string | null> = {
      nome: aluno.nome,
      paisId: aluno.paisId,
      documento: aluno.documento,
      telefoneE164: aluno.telefoneE164,
      email: aluno.email,
      genero: aluno.genero,
      nascimento: aluno.nascimento ? aluno.nascimento.toISOString() : null,
    };
    const depoisDisplay: Record<string, string | null> = {
      nome: novo.nome,
      paisId: novo.paisId,
      documento: novo.documento,
      telefoneE164: novo.telefoneE164,
      email: novo.email,
      genero: novo.genero,
      nascimento: novo.nascimento ? novo.nascimento.toISOString() : null,
    };
    const antes: Record<string, string | null> = {};
    const depois: Record<string, string | null> = {};
    for (const k of Object.keys(atual)) {
      if (atual[k] !== depoisDisplay[k]) {
        antes[k] = atual[k];
        depois[k] = depoisDisplay[k];
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.aluno.update({ where: { id }, data: novo });
      await registrarEvento(tx, {
        tipo: "AlunoEditado",
        agregadoTipo: "Aluno",
        agregadoId: id,
        autorId: autor.id,
        payload: { de: antes, para: depois, motivo: dados.motivo },
      });
    });
    revalidar(id);
  });
}

/** Cancela mensalidades futuras (PENDENTE com vencimento > agora). Dívidas passadas permanecem. */
async function cancelarMensalidadesFuturas(tx: Prisma.TransactionClient, alunoId: string) {
  const matriculas = await tx.matricula.findMany({ where: { alunoId }, select: { id: true } });
  const ids = matriculas.map((m) => m.id);
  if (ids.length === 0) return;
  await tx.cobranca.updateMany({
    where: { matriculaId: { in: ids }, status: StatusCobranca.PENDENTE, vencimento: { gt: new Date() } },
    data: { status: StatusCobranca.CANCELADA },
  });
}

export async function pausarAluno(id: string, input: PausarInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS);
    const dados = PausarSchema.parse(input);
    const aluno = await prisma.aluno.findUnique({ where: { id } });
    if (!aluno) throw new ErroRegra("Aluno não encontrado.");
    if (aluno.status !== StatusAluno.ATIVO) throw new ErroRegra("Só é possível pausar um aluno Ativo.");

    await prisma.$transaction(async (tx) => {
      await tx.aluno.update({ where: { id }, data: { status: StatusAluno.PAUSADO } });
      await cancelarMensalidadesFuturas(tx, id);
      await tx.movimentacaoAluno.create({
        data: {
          alunoId: id,
          tipo: TipoMovimentacao.PAUSA,
          statusOrigem: StatusAluno.ATIVO,
          statusDestino: StatusAluno.PAUSADO,
          motivo: dados.motivo,
          observacao: dados.dataRetornoPrevista ? `Retorno previsto: ${dados.dataRetornoPrevista.toISOString().slice(0, 10)}` : null,
          usuarioId: autor.id,
        },
      });
      await registrarEvento(tx, {
        tipo: "AlunoPausado",
        agregadoTipo: "Aluno",
        agregadoId: id,
        autorId: autor.id,
        payload: { motivo: dados.motivo },
      });
    });
    revalidar(id);
  });
}

export async function reativarAluno(id: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS);
    const aluno = await prisma.aluno.findUnique({ where: { id } });
    if (!aluno) throw new ErroRegra("Aluno não encontrado.");
    if (aluno.status !== StatusAluno.PAUSADO) throw new ErroRegra("Só é possível reativar um aluno Pausado.");

    await prisma.$transaction(async (tx) => {
      await tx.aluno.update({ where: { id }, data: { status: StatusAluno.ATIVO } });
      await tx.movimentacaoAluno.create({
        data: {
          alunoId: id,
          tipo: TipoMovimentacao.REATIVACAO,
          statusOrigem: StatusAluno.PAUSADO,
          statusDestino: StatusAluno.ATIVO,
          usuarioId: autor.id,
        },
      });
      await registrarEvento(tx, {
        tipo: "AlunoReativado",
        agregadoTipo: "Aluno",
        agregadoId: id,
        autorId: autor.id,
      });
    });
    revalidar(id);
  });
}

export async function encerrarAluno(id: string, input: EncerrarInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS);
    const dados = EncerrarSchema.parse(input);
    const aluno = await prisma.aluno.findUnique({ where: { id } });
    if (!aluno) throw new ErroRegra("Aluno não encontrado.");
    if (aluno.status === StatusAluno.ENCERRADO) throw new ErroRegra("Aluno já está encerrado.");

    await prisma.$transaction(async (tx) => {
      await tx.aluno.update({ where: { id }, data: { status: StatusAluno.ENCERRADO } });
      await cancelarMensalidadesFuturas(tx, id);
      await tx.movimentacaoAluno.create({
        data: {
          alunoId: id,
          tipo: TipoMovimentacao.ENCERRAMENTO,
          statusOrigem: aluno.status,
          statusDestino: StatusAluno.ENCERRADO,
          motivo: dados.motivo,
          observacao: dados.observacao || null,
          usuarioId: autor.id,
        },
      });
      await registrarEvento(tx, {
        tipo: "AlunoEncerrado",
        agregadoTipo: "Aluno",
        agregadoId: id,
        autorId: autor.id,
        payload: { motivo: dados.motivo, observacao: dados.observacao || null },
      });
    });
    revalidar(id);
  });
}

export async function trocarTurma(id: string, input: TrocarTurmaInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS);
    const dados = TrocarTurmaSchema.parse(input);
    const aluno = await prisma.aluno.findUnique({
      where: { id },
      include: { alocacoes: { where: { ativa: true } } },
    });
    if (!aluno) throw new ErroRegra("Aluno não encontrado.");

    const destino = await prisma.turma.findUnique({
      where: { id: dados.turmaDestinoId },
      include: { _count: { select: { alocacoes: { where: { ativa: true } } } } },
    });
    if (!destino) throw new ErroRegra("Turma de destino não encontrada.");
    if (vagasTurma(destino.capacidade, destino._count.alocacoes) <= 0)
      throw new ErroRegra("Turma de destino sem vaga.");

    const atual = aluno.alocacoes[0] ?? null;

    await prisma.$transaction(async (tx) => {
      if (atual) await tx.alocacaoTurma.update({ where: { id: atual.id }, data: { ativa: false } });
      await tx.alocacaoTurma.create({ data: { alunoId: id, turmaId: dados.turmaDestinoId } });
      await tx.movimentacaoAluno.create({
        data: {
          alunoId: id,
          tipo: TipoMovimentacao.TROCA_TURMA,
          turmaOrigemId: atual?.turmaId ?? null,
          turmaDestinoId: dados.turmaDestinoId,
          motivo: dados.justificativa || null,
          usuarioId: autor.id,
        },
      });
      await registrarEvento(tx, {
        tipo: "TrocaTurma",
        agregadoTipo: "Aluno",
        agregadoId: id,
        autorId: autor.id,
        payload: { de: atual?.turmaId ?? null, para: dados.turmaDestinoId, motivo: dados.justificativa || null },
      });
    });
    revalidar(id);
  });
}
