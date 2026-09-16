"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { EntradaCorrecaoNotaSchema, proporCorrecaoNotaTx } from "./correcao-tx";
import { DecisaoCorrecaoSchema, decidirCorrecaoNotaTx, revisarCorrecaoNotaTx } from "./correcao-decisao-tx";
import { NotasLancamentoSchema } from "./lancamento-schema";
import { identificarMatriculaAvaliacao } from "./identificacao";
export async function proporCorrecaoNota(input: z.input<typeof EntradaCorrecaoNotaSchema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    return prisma.$transaction(tx => proporCorrecaoNotaTx(tx, u.id, input));
  });
}
export async function revisarCorrecaoNota(propostaId: string) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    return prisma.$transaction(async tx => {
      const r = await revisarCorrecaoNotaTx(tx, u.id, z.string().min(1).max(100).parse(propostaId));
      return { propostaId: r.p.id, propostaHash: r.p.entradaHash, versao: r.p.versao, motivo: r.p.motivo,
        notasPropostas: NotasLancamentoSchema.parse(r.p.notas), notasVigentes: r.vigente.notas, origemHash: r.vigente.origemHash,
        impactos: r.impactos, impactosHash: r.impactosHash, podeAprovar: r.podeAprovar, podeDecidir: !r.p.decisao && r.p.autorId !== u.id,
        identificacao: await identificarMatriculaAvaliacao(tx, r.a.matriculaId, r.a.turmaId), lancamentoId: r.p.lancamentoId };
    });
  });
}
export async function decidirCorrecaoNota(input: z.input<typeof DecisaoCorrecaoSchema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    return prisma.$transaction(tx => decidirCorrecaoNotaTx(tx, u.id, input));
  });
}
