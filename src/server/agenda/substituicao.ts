"use server";
import { createHash } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";

const Entrada = z.object({ encontrosIds: z.array(z.string().min(1)).min(1).max(1000).refine((ids) => new Set(ids).size === ids.length, "Encontro repetido."),
  substitutoId: z.string().min(1), motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100),
}).strict();

export async function prepararSubstituicaoDocente(input: z.input<typeof Entrada>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
    const original = Entrada.parse(input), d = { ...original, encontrosIds: [...original.encontrosIds].sort() };
    const hash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.some((p) => ["SECRETARIA_ACADEMICA", "GERENTE_PEDAGOGICO", "ADMINISTRADOR"].includes(p))) throw new ErroPermissao();
      const repetida = await tx.propostaSubstituicaoDocente.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } }, include: { decisao: true } });
      if (repetida) {
        if (repetida.entradaHash !== hash) throw new ErroRegra("Chave utilizada para outra proposta de substituição.");
        return { id: repetida.id, aplicada: repetida.decisao?.aprovada === true };
      }
      if (!await tx.usuario.count({ where: { id: d.substitutoId, ativo: true, papeis: { has: "PROFESSOR" } } })) throw new ErroRegra("Escolha um professor substituto ativo.");
      await tx.$queryRaw`SELECT id FROM "EncontroAgenda" WHERE id IN (${Prisma.join(d.encontrosIds)}) ORDER BY id FOR UPDATE`;
      const encontros = await tx.encontroAgenda.findMany({ where: { id: { in: d.encontrosIds } }, orderBy: { id: "asc" } });
      if (encontros.length !== d.encontrosIds.length) throw new ErroRegra("Um dos encontros não existe. Atualize a seleção.");
      if (encontros.some(e => e.finalidade !== "AULA")) throw new ErroRegra("Avaliador de recuperação exige designação no fluxo da avaliação.");
      const agora = new Date();
      if (encontros.some((e) => e.status !== "PREVISTO" || e.inicio <= agora)) throw new ErroRegra("A substituição exige encontros previstos ainda não iniciados; registros passados seguem regularização própria.");
      if (encontros.some((e) => e.professorId === d.substitutoId)) throw new ErroRegra("O substituto já está designado em um dos encontros.");
      const p = await tx.propostaSubstituicaoDocente.create({ data: { preparadorId: autor.id, substitutoId: d.substitutoId,
        motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, entradaHash: hash,
        itens: { create: encontros.map((e) => ({ encontroId: e.id, snapshot: { professorId: e.professorId, turmaId: e.turmaId, matriculaId: e.matriculaId,
          inicio: e.inicio.toISOString(), fim: e.fim.toISOString(), fusoOrigem: e.fusoOrigem, status: e.status } })) },
      } });
      await registrarEvento(tx, { tipo: "SubstituicaoDocenteProposta", agregadoTipo: "ConfiguracaoOperacional", agregadoId: "escola", autorId: autor.id,
        payload: { propostaId: p.id, substitutoId: d.substitutoId, encontrosIds: d.encontrosIds } });
      return { id: p.id, aplicada: false as const };
    });
  });
}
