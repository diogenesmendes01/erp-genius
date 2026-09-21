"use server";

import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { RegistrarOcorrenciaSegundaChamadaSchema, registrarOcorrenciaSegundaChamadaTx } from "./segunda-chamada-ocorrencia-tx";

/** Q148: a action só autentica e delega o fluxo transacional compartilhado. */
export async function registrarOcorrenciaSegundaChamada(input: z.input<typeof RegistrarOcorrenciaSegundaChamadaSchema>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    return prisma.$transaction(tx => registrarOcorrenciaSegundaChamadaTx(tx, usuario.id, input));
  });
}
