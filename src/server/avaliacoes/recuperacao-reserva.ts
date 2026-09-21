"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { reservarTentativaRecuperacaoTx, ReservarTentativaRecuperacaoSchema } from "./recuperacao-reserva-tx";

export async function reservarTentativaRecuperacao(input: z.input<typeof ReservarTentativaRecuperacaoSchema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    return prisma.$transaction(tx => reservarTentativaRecuperacaoTx(tx, u.id, input));
  });
}
