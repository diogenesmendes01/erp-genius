"use server";

import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento } from "@/server/_shared";
import { hashCorrecaoAula } from "./correcao-aula-schema";

const motivoSchema = z.string().trim().min(5).max(2000);
const designacaoSchema = z.object({ encontroId: z.string().min(1), responsavelId: z.string().min(1),
  motivo: motivoSchema, chaveIdempotencia: z.string().trim().min(8).max(200) }).strict();

/** Q24: atribui a pendência, preservando o docente original e o vínculo da turma. */
export async function designarRegularizacaoAula(input: z.input<typeof designacaoSchema>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = designacaoSchema.parse(input);
    const entradaHash = hashCorrecaoAula(d);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id IN (${usuario.id}, ${d.responsavelId}) ORDER BY id FOR SHARE`;
      const gestor = await tx.usuario.findUnique({ where: { id: usuario.id }, select: { ativo: true, papeis: true } });
      if (!gestor?.ativo || !gestor.papeis.some(p => p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
      const anterior = await tx.designacaoRegularizacaoAula.findUnique({ where: { designadorId_chaveIdempotencia: {
        designadorId: usuario.id, chaveIdempotencia: d.chaveIdempotencia,
      } }, include: { revogacao: true } });
      if (anterior) {
        if (anterior.entradaHash !== entradaHash) throw new ErroRegra("A chave já identifica outra designação.");
        return { id: anterior.id, revogada: !!anterior.revogacao };
      }
      const responsavel = await tx.usuario.findUnique({ where: { id: d.responsavelId }, select: { ativo: true, papeis: true } });
      if (!responsavel?.ativo || !responsavel.papeis.some(p => p === Papel.PROFESSOR || p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR))
        throw new ErroRegra("Escolha um professor ou integrante ativo da gestão pedagógica.");
      const encontro = await tx.encontroAgenda.findUnique({ where: { id: d.encontroId }, select: { finalidade: true, status: true, fim: true } });
      if (!encontro || encontro.finalidade !== "AULA" || encontro.status !== "PREVISTO" || encontro.fim > new Date())
        throw new ErroRegra("A designação exige uma aula prevista já terminada, com pendência de regularização.");
      if (await tx.designacaoRegularizacaoAula.findFirst({ where: { encontroId: d.encontroId, revogacao: null }, select: { id: true } }))
        throw new ErroRegra("A aula já tem uma designação vigente. Revogue-a antes de atribuir outro responsável.");
      const criada = await tx.designacaoRegularizacaoAula.create({ data: { ...d, designadorId: usuario.id, entradaHash } });
      await registrarEvento(tx, { tipo: "RegularizacaoAulaDesignada", agregadoTipo: "EncontroAgenda", agregadoId: d.encontroId,
        autorId: usuario.id, payload: { designacaoId: criada.id, responsavelId: d.responsavelId, motivo: d.motivo } });
      return { id: criada.id, revogada: false };
    });
  });
}

export async function revogarRegularizacaoAula(input: { designacaoId: string; motivo: string }) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ designacaoId: z.string().min(1), motivo: motivoSchema }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuario.id} FOR SHARE`;
      const gestor = await tx.usuario.findUnique({ where: { id: usuario.id }, select: { ativo: true, papeis: true } });
      if (!gestor?.ativo || !gestor.papeis.some(p => p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
      const fonte = await tx.designacaoRegularizacaoAula.findUnique({ where: { id: d.designacaoId }, include: { revogacao: true } });
      if (!fonte) throw new ErroRegra("Designação não encontrada.");
      if (fonte.revogacao) {
        if (fonte.revogacao.revogadorId !== usuario.id || fonte.revogacao.motivo !== d.motivo) throw new ErroRegra("A revogação já foi registrada.");
        return { id: fonte.revogacao.id };
      }
      const revogacao = await tx.revogacaoDesignacaoRegularizacaoAula.create({ data: { ...d, revogadorId: usuario.id } });
      await registrarEvento(tx, { tipo: "RegularizacaoAulaRevogada", agregadoTipo: "EncontroAgenda", agregadoId: fonte.encontroId,
        autorId: usuario.id, payload: { designacaoId: fonte.id, revogacaoId: revogacao.id, motivo: d.motivo } });
      return { id: revogacao.id };
    });
  });
}
