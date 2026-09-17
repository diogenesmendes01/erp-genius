"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { PrepararAgendaAditivoSchema } from "./agenda-aditivo-schema";
import { carregarConferenciaAgendaAditivoTx } from "./agenda-aditivo-tx";

/** Consulta de conferência: não persiste proposta, não reserva e não aplica agenda. */
export async function consultarConferenciaAgendaAditivo(input: z.input<typeof PrepararAgendaAditivoSchema>) {
  return executarAcao(async () => {
    const ator = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR, Papel.GERENTE_PEDAGOGICO);
    return prisma.$transaction(tx => carregarConferenciaAgendaAditivoTx(tx, ator.id, input), { timeout: 30000 });
  });
}
