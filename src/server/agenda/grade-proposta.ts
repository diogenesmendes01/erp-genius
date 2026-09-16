"use server";
import { createHash } from "node:crypto";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";
import { carregarGradeInicialTx } from "./grade-turma-tx";

const Entrada = z.object({ turmaId: z.string().min(1), fusoOrigem: FusoInstitucionalSchema, versaoAnterior: z.number().int().nonnegative(),
  motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100) }).strict();
export async function prepararGradeInicialTurma(input: z.input<typeof Entrada>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
    const d = Entrada.parse(input), hash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.some((p) => ["SECRETARIA_ACADEMICA", "GERENTE_PEDAGOGICO", "ADMINISTRADOR"].includes(p))) throw new ErroPermissao();
      const repetida = await tx.propostaGradeTurma.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (repetida) {
        if (repetida.entradaHash !== hash) throw new ErroRegra("Chave utilizada para outra proposta de grade.");
        return { id: repetida.id, versao: repetida.versao };
      }
      await tx.$queryRaw`SELECT id FROM "Turma" WHERE id = ${d.turmaId} FOR UPDATE`;
      const ultima = await tx.propostaGradeTurma.findFirst({ where: { turmaId: d.turmaId }, orderBy: { versao: "desc" } });
      if ((ultima?.versao ?? 0) !== d.versaoAnterior) throw new ErroRegra("A grade possui outra versão. Atualize a proposta.");
      await tx.$queryRaw`SELECT m.id FROM "Modalidade" m JOIN "Turma" t ON t."modalidadeId" = m.id WHERE t.id = ${d.turmaId} FOR SHARE OF m`;
      const snapshot = await carregarGradeInicialTx(tx, d);
      const p = await tx.propostaGradeTurma.create({ data: { turmaId: d.turmaId, calendarioId: snapshot.calendarioId, preparadorId: autor.id, versao: d.versaoAnterior + 1,
        fusoOrigem: d.fusoOrigem, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, entradaHash: hash, snapshot } });
      await registrarEvento(tx, { tipo: "GradeInicialTurmaPreparada", agregadoTipo: "Turma", agregadoId: d.turmaId, autorId: autor.id, payload: { propostaId: p.id, versao: p.versao, calendarioId: p.calendarioId } });
      return { id: p.id, versao: p.versao };
    });
  });
}
