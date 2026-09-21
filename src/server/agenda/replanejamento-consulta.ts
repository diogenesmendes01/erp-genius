"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao } from "@/server/_shared";
import { carregarReplanejamentoTx } from "./replanejamento-tx";
import { AjustesReplanejamentoSchema, type AjusteReplanejamento } from "./replanejamento-ajustes";
import { estadoReplanejamento } from "./replanejamento-estado";

export async function preverReplanejamentoCalendario(input: { calendarioId: string; ajustes?: AjusteReplanejamento[] }) {
 return executarAcao(async () => {
  const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
  const d = z.object({ calendarioId: z.string().min(1), ajustes: AjustesReplanejamentoSchema.optional() }).strict().parse(input);
  return prisma.$transaction(async (tx) => {
   const usuario = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
   if (!usuario?.ativo || !usuario.papeis.some((p) => ["SECRETARIA_ACADEMICA", "GERENTE_PEDAGOGICO", "ADMINISTRADOR"].includes(p))) throw new ErroPermissao();
   const revisao = await carregarReplanejamentoTx(tx, d.calendarioId, d.ajustes);
   const ultima = await tx.rascunhoReplanejamento.findFirst({ where: { calendarioId: d.calendarioId }, orderBy: { versao: "desc" }, select: { versao: true } });
   return { ...revisao, estadoHash: estadoReplanejamento(revisao), versaoRascunho: ultima?.versao ?? 0 };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 20000 });
 });
}
