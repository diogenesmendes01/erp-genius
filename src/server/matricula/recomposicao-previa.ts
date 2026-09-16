"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { EntradaRecomposicao } from "./recomposicao-schema";
import { carregarRecomposicaoTx } from "./recomposicao-tx";
export async function preverRecomposicaoCobertura(input: z.input<typeof EntradaRecomposicao>) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = EntradaRecomposicao.parse(input);
    return prisma.$transaction((tx) => carregarRecomposicaoTx(tx, d), { isolationLevel: "RepeatableRead" });
  });
}
