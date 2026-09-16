"use server";
import { createHash } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { carregarReplanejamentoTx } from "./replanejamento-tx";
import { AjustesReplanejamentoSchema } from "./replanejamento-ajustes";
import { estadoReplanejamento } from "./replanejamento-estado";
const Entrada = z.object({ ajustes: AjustesReplanejamentoSchema.optional(), calendarioId: z.string().min(1), estadoHash: z.string().regex(/^[a-f0-9]{64}$/),
 versaoAnterior: z.number().int().nonnegative(), motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100) }).strict();
export async function registrarRascunhoReplanejamento(input: z.input<typeof Entrada>) {
 return executarAcao(async () => {
  const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
  const d = Entrada.parse(input), entradaHash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
  return prisma.$transaction(async (tx) => {
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
   const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
   if (!u?.ativo || !u.papeis.some((p) => ["SECRETARIA_ACADEMICA", "GERENTE_PEDAGOGICO", "ADMINISTRADOR"].includes(p))) throw new ErroPermissao();
   const existente = await tx.rascunhoReplanejamento.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
   if (existente) {
    if (existente.entradaHash !== entradaHash) throw new ErroRegra("Chave utilizada para outra revisão.");
    return { id: existente.id, versao: existente.versao, aplicada: false as const };
   }
   const ultima = await tx.rascunhoReplanejamento.findFirst({ where: { calendarioId: d.calendarioId }, orderBy: { versao: "desc" } });
   if ((ultima?.versao ?? 0) !== d.versaoAnterior) throw new ErroRegra("Outra revisão foi registrada. Atualize a consulta.");
   const revisao = await carregarReplanejamentoTx(tx, d.calendarioId, d.ajustes);
   if (estadoReplanejamento(revisao) !== d.estadoHash) throw new ErroRegra("A agenda mudou desde a consulta. Confira novamente a revisão.");
   const r = await tx.rascunhoReplanejamento.create({ data: { calendarioId: d.calendarioId, preparadorId: autor.id, versao: d.versaoAnterior + 1,
    motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, entradaHash, estadoHash: d.estadoHash, snapshot: JSON.parse(JSON.stringify(revisao)) as Prisma.InputJsonValue } });
   await registrarEvento(tx, { tipo: "ReplanejamentoCalendarioRegistrado", agregadoTipo: "ConfiguracaoOperacional", agregadoId: "escola", autorId: autor.id,
    payload: { rascunhoId: r.id, calendarioId: d.calendarioId, versao: r.versao, estadoHash: d.estadoHash } });
   return { id: r.id, versao: r.versao, aplicada: false as const };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 20000 });
 });
}

