"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { carregarPreviaOcorrenciaFinanceiraTx } from "./ocorrencia-financeira-previa-tx";
import { createHash } from "node:crypto";

export async function preverConferenciaOcorrenciaHoras(input: { alunoId: string; matriculaId: string; ocorrenciaId: string; condicoesId: string }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = z.object({ alunoId: z.string().min(1), matriculaId: z.string().min(1), ocorrenciaId: z.string().min(1), condicoesId: z.string().min(1) }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await bloquearMatriculas(tx, [d.matriculaId]);
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${u.id} FOR SHARE`;
      const atual = await tx.usuario.findUnique({ where: { id: u.id }, select: { ativo: true, papeis: true } });
      if (!atual?.ativo || !atual.papeis.some(p => p === Papel.FINANCEIRO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
      const previa = await carregarPreviaOcorrenciaFinanceiraTx(tx, d);
      return { ...previa, estadoPrevia: createHash("sha256").update(JSON.stringify(previa)).digest("hex") };
    });
  });
}
