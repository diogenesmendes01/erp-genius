"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { conferirAutor } from "./modelos-tx";

const entrada = z.object({ matriculaId: z.string().trim().min(1).max(100), propostaId: z.string().trim().min(1).max(100) }).strict();
/** Metadados privados; os bytes preservados só saem pela rota de arquivo. */
export async function consultarConclusaoAssinaturaAditivo(input: z.input<typeof entrada>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR), d = entrada.parse(input);
    return prisma.$transaction(async tx => {
      await conferirAutor(tx, autor.id);
      if (!await tx.propostaAditivoContratual.count({ where: { id: d.propostaId, matriculaId: d.matriculaId } })) throw new ErroRegra("Proposta indisponível nesta matrícula.");
      const processo = await tx.processoAssinaturaAditivo.findFirst({ where: { propostaId: d.propostaId, proposta: { matriculaId: d.matriculaId } }, include: { conclusao: { select: { id: true, referenciaExterna: true, concluidaEm: true, pdfHash: true, evidenciasHash: true, assinaturas: true, registradaEm: true } } } });
      if (!processo) return null;
      const c = processo.conclusao;
      return c ? { id: c.id, processoId: processo.id, fornecedor: processo.fornecedor, ambiente: processo.ambiente, referenciaExterna: c.referenciaExterna, concluidaEm: c.concluidaEm, registradaEm: c.registradaEm, pdfHash: c.pdfHash, evidenciasHash: c.evidenciasHash, assinaturas: c.assinaturas } : null;
    });
  });
}
