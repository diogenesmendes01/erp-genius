"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";
import { DataHoraAvaliacaoSchema, instanteAvaliacaoLocal } from "./tempo";
import { conferirAgendaRecuperacaoTx } from "./recuperacao-agenda-tx";

const schema = z.object({ itemReservaId: z.string().min(1).max(100), inicioLocal: DataHoraAvaliacaoSchema, fimLocal: DataHoraAvaliacaoSchema, fuso: FusoInstitucionalSchema }).strict();
export async function preverAgendaRecuperacao(input: z.input<typeof schema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = schema.parse(input);
    const inicio = instanteAvaliacaoLocal(d.inicioLocal, d.fuso), fim = instanteAvaliacaoLocal(d.fimLocal, d.fuso);
    return prisma.$transaction(tx => conferirAgendaRecuperacaoTx(tx, u.id, { itemReservaId: d.itemReservaId, inicio, fim, fuso: d.fuso }));
  });
}
