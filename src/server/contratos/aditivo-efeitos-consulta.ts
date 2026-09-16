"use server";

import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { conferirAutor } from "./modelos-tx";
import { hashSubstituicao } from "./substituicao-estado";
import { PrepararAditivoContratualSchema } from "./aditivo-schema";
import { planejarEfeitosAditivo } from "./aditivo-efeitos";

const id = z.string().trim().min(1).max(100);
const Alvo = z.object({ matriculaId: id, propostaId: id }).strict();

/** Revisão de valores preservados; não constitui autorização ou aplicação. */
export async function consultarEfeitosAditivo(input: z.input<typeof Alvo>) {
  return executarAcao(async () => {
    const ator = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const d = Alvo.parse(input);
    return prisma.$transaction(async tx => {
      await conferirAutor(tx, ator.id);
      const p = await tx.propostaAditivoContratual.findFirst({
        where: { id: d.propostaId, matriculaId: d.matriculaId },
        select: { snapshot: true, entradaHash: true, vigenciaInicio: true },
      });
      if (!p) throw new ErroRegra("Proposta indisponível nesta matrícula.");
      if (hashSubstituicao(p.snapshot) !== p.entradaHash) throw new ErroRegra("A proposta preservada exige conferência de integridade.");
      const entrada = z.object({ entrada: PrepararAditivoContratualSchema }).parse(p.snapshot).entrada;
      if (entrada.matriculaId !== d.matriculaId) throw new ErroRegra("A proposta não corresponde à matrícula.");
      const cobrancasExistentes = await tx.cobranca.count({ where: { matriculaId: d.matriculaId } });
      return { ...planejarEfeitosAditivo(entrada.alteracoes, { cobrancaEmitida: cobrancasExistentes > 0 }), vigenciaInicio: p.vigenciaInicio, aplicado: false as const };
    }, { isolationLevel: "RepeatableRead" });
  });
}
