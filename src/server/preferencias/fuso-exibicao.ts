"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { executarAcao, ErroAutenticacao, exigirSessao } from "@/server/_shared";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";

const Entrada = z.object({ fusoExibicao: z.union([FusoInstitucionalSchema, z.literal(""), z.null()]) }).strict().transform((d) => ({ fusoExibicao: d.fusoExibicao || null }));

export async function consultarPreferenciaFusoEquipe() {
  return executarAcao(async () => {
    const sessao = await exigirSessao();
    const usuario = await prisma.usuario.findUnique({ where: { id: sessao.id }, select: { ativo: true, fusoExibicao: true } });
    if (!usuario?.ativo) throw new ErroAutenticacao();
    return { fusoExibicao: usuario.fusoExibicao };
  });
}

export async function salvarPreferenciaFusoEquipe(input: unknown) {
  return executarAcao(async () => {
    const dados = Entrada.parse(input), sessao = await exigirSessao();
    return prisma.$transaction(async (tx) => {
      const [usuario] = await tx.$queryRaw<Array<{ ativo: boolean }>>(Prisma.sql`SELECT ativo FROM "Usuario" WHERE id=${sessao.id} FOR UPDATE`);
      if (!usuario?.ativo) throw new ErroAutenticacao();
      await tx.usuario.update({ where: { id: sessao.id }, data: { fusoExibicao: dados.fusoExibicao } });
      return { fusoExibicao: dados.fusoExibicao };
    });
  });
}
