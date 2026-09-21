import { createHash } from "node:crypto";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { conferirAutor } from "./modelos-tx";

/** Devolve os bytes preservados. Consulta não regenera nem atualiza um original. */
export async function carregarOriginalAditivo(input: { matriculaId: string; propostaId: string; artefatoId: string }) {
  const ator = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), id = z.string().trim().min(1).max(100);
  const d = z.object({ matriculaId: id, propostaId: id, artefatoId: id }).strict().parse(input);
  const arquivo = await prisma.$transaction(async tx => {
    await conferirAutor(tx, ator.id);
    return tx.artefatoAditivoContratual.findFirst({ where: { id: d.artefatoId, propostaId: d.propostaId, proposta: { matriculaId: d.matriculaId } }, select: { id: true, pdf: true, pdfHash: true } });
  });
  if (!arquivo) return null;
  if (createHash("sha256").update(arquivo.pdf).digest("hex") !== arquivo.pdfHash) throw new ErroRegra("Integridade do original do aditivo divergente. Solicite conferência; o arquivo não será regenerado.");
  return arquivo;
}
