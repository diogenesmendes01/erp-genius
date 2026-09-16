"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { conferirSubstituicaoRecuperacaoTx } from "./recuperacao-substituicao-tx";
import { hashAgendaRecuperacao } from "./recuperacao-agenda-estado";
export async function preverSubstituicaoAvaliadorRecuperacao(input: { itemReservaId: string; substitutoId: string }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), id = z.string().min(1).max(100);
    const d = z.object({ itemReservaId: id, substitutoId: id }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const conferencia = await conferirSubstituicaoRecuperacaoTx(tx, u.id, d);
      const ultima = await tx.propostaSubstituicaoRecuperacao.findFirst({ where: { encontroId: conferencia.encontroId }, orderBy: { versao: "desc" }, select: { versao: true } });
      return { ...conferencia, estadoConferido: hashAgendaRecuperacao(conferencia), versaoEsperada: ultima?.versao ?? 0 };
    });
  });
}
