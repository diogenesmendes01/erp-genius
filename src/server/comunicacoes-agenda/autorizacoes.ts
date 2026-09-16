"use server";

import { Papel, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { confirmarTransacao } from "@/lib/transacao-confirmada";
import { ErroRegra, exigirSessaoComPapel, executarAcao, type Resultado } from "@/server/_shared";

const papeisPermitidos = [Papel.ADMINISTRADOR, Papel.SECRETARIA_ACADEMICA] as const;
const id = z.string().trim().min(1).max(100);
const texto = z.string().trim().min(5).max(2_000);
const RegistrarSchema = z.object({ matriculaId: id, responsavelId: id, evidencia: texto }).strict();
const RevogarSchema = z.object({ id, motivoRevogacao: texto }).strict();
const ListarSchema = z.object({ matriculaId: id, cursor: id.optional() }).strict();

async function bloquearAutorAtual(tx: Prisma.TransactionClient, autorId: string) {
  const autores = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Usuario"
    WHERE id = ${autorId}
      AND ativo
      AND papeis && ARRAY['ADMINISTRADOR'::"Papel", 'SECRETARIA_ACADEMICA'::"Papel"]
    FOR UPDATE
  `;
  if (!autores.length) throw new ErroRegra("Seu papel atual não permite gerir autorizações acadêmicas.");
}

export async function registrarAutorizacaoComunicacaoAcademica(input: unknown): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...papeisPermitidos);
    const dados = RegistrarSchema.parse(input);
    return prisma.$transaction(confirmarTransacao(async (tx) => {
      await bloquearAutorAtual(tx, autor.id);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${dados.matriculaId}:${dados.responsavelId}`}, 0))`;
      const vinculos = await tx.$queryRaw<{ id: string }[]>`
        SELECT ar.id
        FROM "Matricula" m
        JOIN "AlunoResponsavel" ar ON ar."alunoId" = m."alunoId"
        WHERE m.id = ${dados.matriculaId}
          AND ar."responsavelId" = ${dados.responsavelId}
          AND ar.papel = 'PEDAGOGICO'::"PapelResponsavel"
        FOR SHARE OF m, ar
      `;
      if (!vinculos.length) throw new ErroRegra("Responsável não possui vínculo pedagógico com esta matrícula.");
      const existente = await tx.autorizacaoComunicacaoAcademica.findFirst({
        where: { matriculaId: dados.matriculaId, responsavelId: dados.responsavelId, revogadaEm: null },
        orderBy: { vigenteEm: "desc" },
        select: { id: true, evidencia: true },
      });
      if (existente) {
        if (existente.evidencia === dados.evidencia) return { id: existente.id };
        throw new ErroRegra("Já existe autorização vigente para este responsável; revogue-a antes de registrar outra evidência.");
      }
      return tx.autorizacaoComunicacaoAcademica.create({
        data: { matriculaId: dados.matriculaId, responsavelId: dados.responsavelId, autorizadaPorId: autor.id, evidencia: dados.evidencia },
        select: { id: true, evidencia: true },
      });
    }));
  });
}

export async function revogarAutorizacaoComunicacaoAcademica(input: unknown): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...papeisPermitidos);
    const dados = RevogarSchema.parse(input);
    await prisma.$transaction(confirmarTransacao(async (tx) => {
      await bloquearAutorAtual(tx, autor.id);
      const registros = await tx.$queryRaw<{ id: string; revogadaPorId: string | null; motivoRevogacao: string | null; revogadaEm: Date | null }[]>`
        SELECT id, "revogadaPorId", "motivoRevogacao", "revogadaEm"
        FROM "AutorizacaoComunicacaoAcademica"
        WHERE id = ${dados.id}
        FOR UPDATE
      `;
      const registro = registros[0];
      if (!registro) throw new ErroRegra("Autorização não encontrada.");
      if (registro.revogadaEm) {
        if (registro.revogadaPorId === autor.id && registro.motivoRevogacao === dados.motivoRevogacao) return;
        throw new ErroRegra("Autorização já foi revogada e seu histórico não pode ser alterado.");
      }
      await tx.autorizacaoComunicacaoAcademica.update({
        where: { id: dados.id },
        data: { revogadaEm: new Date(), revogadaPorId: autor.id, motivoRevogacao: dados.motivoRevogacao },
      });
    }));
    return undefined;
  });
}

export async function listarAutorizacoesComunicacaoAcademica(input: unknown) {
  const sessao = await exigirSessaoComPapel(...papeisPermitidos);
  const dados = ListarSchema.parse(input);
  await prisma.usuario.findFirstOrThrow({
    where: { id: sessao.id, ativo: true, papeis: { hasSome: [...papeisPermitidos] } },
    select: { id: true },
  });
  const registros = await prisma.autorizacaoComunicacaoAcademica.findMany({
    where: { matriculaId: dados.matriculaId },
    orderBy: [{ vigenteEm: "desc" }, { id: "desc" }],
    cursor: dados.cursor ? { id: dados.cursor } : undefined,
    skip: dados.cursor ? 1 : undefined,
    take: 26,
    select: {
      id: true,
      responsavelId: true,
      evidencia: true,
      vigenteEm: true,
      revogadaEm: true,
      motivoRevogacao: true,
      responsavel: { select: { nome: true } },
      autorizadaPor: { select: { nome: true } },
      revogadaPor: { select: { nome: true } },
    },
  });
  const itens = registros.slice(0, 25);
  return { itens, proximoCursor: registros.length > itens.length ? itens.at(-1)?.id ?? null : null };
}
export async function consultarTelaAutorizacoesComunicacaoAcademica(input: unknown) {
  const sessao = await exigirSessaoComPapel(...papeisPermitidos);
  const dados = ListarSchema.parse(input);
  const usuario = await prisma.usuario.findFirst({ where: { id: sessao.id, ativo: true, papeis: { hasSome: [...papeisPermitidos] } }, select: { id: true } });
  if (!usuario) throw new ErroRegra("Seu papel atual não permite gerir autorizações acadêmicas.");
  const matricula = await prisma.matricula.findUnique({
    where: { id: dados.matriculaId },
    select: {
      id: true,
      codigo: true,
      aluno: {
        select: {
          primeiroNome: true,
          sobrenome: true,
          responsaveis: { where: { papel: "PEDAGOGICO" }, select: { responsavel: { select: { id: true, nome: true } } } },
        },
      },
    },
  });
  if (!matricula) throw new ErroRegra("Matrícula não encontrada.");
  const historico = await listarAutorizacoesComunicacaoAcademica(dados);
  return {
    matricula: { id: matricula.id, codigo: matricula.codigo, alunoNome: `${matricula.aluno.primeiroNome} ${matricula.aluno.sobrenome ?? ""}`.trim() },
    responsaveis: matricula.aluno.responsaveis.map((v) => v.responsavel),
    historico,
  };
}