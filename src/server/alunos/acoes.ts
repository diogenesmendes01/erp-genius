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
  calcularDocumentoValido,
  validarDocumento,
  diffCampos,
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
    const aluno = await prisma.aluno.findUnique({
      where: { id },
      include: { pais: { include: { tiposDocumento: true } } },
    });
    if (!aluno) throw new ErroRegra("Aluno não encontrado.");

    const paisDestino =
      dados.paisId === aluno.paisId
        ? aluno.pais
        : await prisma.pais.findUnique({
            where: { id: dados.paisId },
            include: { tiposDocumento: true },
          });
    if (!paisDestino) throw new ErroRegra("País não encontrado.");

    // Documento (doc 04: avisa, não bloqueia). Valida pelo TIPO escolhido quando houver;
    // senão tenta os validadores do país (compatível com registros legados sem tipo).
    const documento = dados.documento?.trim() || null;
    const tipoDoc = dados.tipoDocumentoId
      ? paisDestino.tiposDocumento.find((t) => t.id === dados.tipoDocumentoId)
      : null;
    if (dados.tipoDocumentoId && !tipoDoc)
      throw new ErroRegra("Tipo de documento não pertence ao país selecionado.");
    const documentoValido = !documento
      ? false
      : tipoDoc
        ? validarDocumento(tipoDoc.validador, documento)
        : calcularDocumentoValido(paisDestino.tiposDocumento, documento);

    const novo = {
      primeiroNome: dados.primeiroNome,
      sobrenome: dados.sobrenome,
      nomePreferido: dados.nomePreferido || null,
      nascimento: dados.nascimento ?? null,
      genero: dados.genero ?? null,
      paisId: dados.paisId,
      tipoDocumentoId: dados.tipoDocumentoId || null,
      documento,
      documentoValido,
      documentoPaisEmissor: dados.documentoPaisEmissor || null,
      nacionalidade: dados.nacionalidade || null,
      segundaNacionalidade: dados.segundaNacionalidade || null,
      email: dados.email || null,
      telefoneE164: normalizarTelefoneE164(dados.telefone, paisDestino.ddi),
      whatsapp: dados.whatsapp ?? aluno.whatsapp,
      aceitaComunicacoes: dados.aceitaComunicacoes ?? aluno.aceitaComunicacoes,
      paisResidencia: dados.paisResidencia || null,
      cep: dados.cep || null,
      rua: dados.rua || null,
      numero: dados.numero || null,
      complemento: dados.complemento || null,
      bairro: dados.bairro || null,
      cidade: dados.cidade || null,
      regiao: dados.regiao || null,
      escolaridade: dados.escolaridade ?? null,
      idiomaNativo: dados.idiomaNativo || null,
      fuso: dados.fuso || null,
      observacoes: dados.observacoes || null,
    };

    // antes→depois só dos campos que mudaram (auditoria enxuta, JSON serializável).
    const fmt = (o: typeof novo | typeof aluno): Record<string, string | null> => ({
      primeiroNome: o.primeiroNome,
      sobrenome: o.sobrenome,
      nomePreferido: o.nomePreferido,
      nascimento: o.nascimento ? new Date(o.nascimento).toISOString() : null,
      genero: o.genero,
      paisId: o.paisId,
      tipoDocumentoId: o.tipoDocumentoId,
      documento: o.documento,
      documentoPaisEmissor: o.documentoPaisEmissor,
      nacionalidade: o.nacionalidade,
      segundaNacionalidade: o.segundaNacionalidade,
      email: o.email,
      telefoneE164: o.telefoneE164,
      whatsapp: String(o.whatsapp),
      aceitaComunicacoes: String(o.aceitaComunicacoes),
      paisResidencia: o.paisResidencia,
      cep: o.cep,
      rua: o.rua,
      numero: o.numero,
      complemento: o.complemento,
      bairro: o.bairro,
      cidade: o.cidade,
      regiao: o.regiao,
      escolaridade: o.escolaridade,
      idiomaNativo: o.idiomaNativo,
      fuso: o.fuso,
      observacoes: o.observacoes,
    });
    const { antes, depois } = diffCampos(fmt(aluno), fmt(novo));

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
      // Conta SOMENTE alocações ativas (issues #1/#19) — vaga real da turma de destino.
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
