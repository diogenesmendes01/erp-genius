import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { conferirAutor } from "./modelos-tx";
import { hashSubstituicao } from "./substituicao-estado";
import { ProjecaoAditivoSchema } from "./aditivo-projecao";
import { gerarPdfPreviaAditivo } from "./pdf-previa";

/** Bytes privados de revisão. Não cria artefato de assinatura nem altera a proposta. */
export async function carregarPdfPreviaAditivo(input: { matriculaId: string; propostaId: string }) {
  const ator = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
  const id = z.string().trim().min(1).max(100);
  const d = z.object({ matriculaId: id, propostaId: id }).strict().parse(input);
  const p = await prisma.$transaction(async tx => {
    await conferirAutor(tx, ator.id);
    return tx.propostaAditivoContratual.findFirst({ where: { id: d.propostaId, matriculaId: d.matriculaId },
      select: { id: true, versao: true, criadaEm: true, entradaHash: true, snapshot: true } });
  });
  if (!p) return null;
  if (hashSubstituicao(p.snapshot) !== p.entradaHash) throw new ErroRegra("A proposta preservada exige conferência de integridade.");
  const s = ProjecaoAditivoSchema.parse(p.snapshot);
  // Renderização fora da transação; somente fatos imutáveis foram carregados.
  const pdf = await gerarPdfPreviaAditivo({ propostaId: p.id, criadaEm: p.criadaEm, propostaHash: p.entradaHash,
    modeloCodigo: s.base.modeloCodigo, modeloVersao: s.base.modeloVersao, versaoProposta: p.versao, ambiente: s.base.ambiente, documento: s.documento });
  return { id: p.id, ...pdf };
}
