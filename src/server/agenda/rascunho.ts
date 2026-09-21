"use server";
import { createHash } from "node:crypto";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { RascunhoEncontroSchema } from "./schema";

/** Planejamento não publica agenda, reserva vaga/horas nem confere disponibilidade docente. */
export async function prepararEncontroAgenda(input: z.input<typeof RascunhoEncontroSchema>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
    const original = RascunhoEncontroSchema.parse(input);
    const d = { ...original, inicio: new Date(original.inicio).toISOString(), fim: new Date(original.fim).toISOString() };
    const hash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`encontro:${autor.id}:${d.chaveIdempotencia}`}, 0))`;
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.some((p) => ["SECRETARIA_ACADEMICA", "GERENTE_PEDAGOGICO", "ADMINISTRADOR"].includes(p))) throw new ErroPermissao();
      const existente = await tx.encontroAgenda.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (existente) {
        if (existente.entradaHash !== hash) throw new ErroRegra("Chave utilizada para outro encontro.");
        return { id: existente.id, status: existente.status };
      }
      if (d.turmaId && !await tx.turma.count({ where: { id: d.turmaId } })) throw new ErroRegra("Turma não encontrada.");
      if (d.matriculaId && !await tx.matricula.count({ where: { id: d.matriculaId } })) throw new ErroRegra("Matrícula não encontrada.");
      if (d.professorId && !await tx.usuario.count({ where: { id: d.professorId, ativo: true, papeis: { has: "PROFESSOR" } } })) throw new ErroRegra("Professor ativo não encontrado.");
      const e = await tx.encontroAgenda.create({ data: { turmaId: d.turmaId, matriculaId: d.matriculaId, professorId: d.professorId, preparadorId: autor.id,
        inicio: new Date(d.inicio), fim: new Date(d.fim), fusoOrigem: d.fusoOrigem, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, entradaHash: hash } });
      await registrarEvento(tx, { tipo: "EncontroAgendaRascunhado", agregadoTipo: "EncontroAgenda", agregadoId: e.id, autorId: autor.id, payload: { turmaId: e.turmaId, matriculaId: e.matriculaId } });
      return { id: e.id, status: e.status };
    });
  });
}
