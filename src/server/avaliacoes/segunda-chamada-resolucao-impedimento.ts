"use server";

import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { ConfirmarResolucaoImpedimentoSchema, confirmarResolucaoImpedimentoSegundaChamadaTx } from "./segunda-chamada-resolucao-impedimento-tx";

export async function confirmarResolucaoImpedimentoSegundaChamada(input: z.input<typeof ConfirmarResolucaoImpedimentoSchema>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    return prisma.$transaction(tx => confirmarResolucaoImpedimentoSegundaChamadaTx(tx, usuario.id, input));
  });
}
