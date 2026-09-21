import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { ConclusaoAssinaturaSchema, validarConclusaoAssinatura } from "./conclusao-assinatura-schema";
import { hashSubstituicao } from "./substituicao-estado";

/** Primitiva do adaptador autenticado futuro. Não é Server Action e não ativa condições. */
export async function preservarConclusaoAssinaturaAditivoTx(tx: Prisma.TransactionClient, input: z.input<typeof ConclusaoAssinaturaSchema>) {
  const d = ConclusaoAssinaturaSchema.parse(input);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  const referencia = await tx.processoAssinaturaAditivo.findUnique({ where: { id: d.processoId }, include: { proposta: { select: { matriculaId: true } } } });
  if (!referencia) throw new ErroRegra("Processo de aditivo não encontrado.");
  await bloquearMatriculas(tx, [referencia.proposta.matriculaId]);
  await tx.$queryRaw`SELECT id FROM "ProcessoAssinaturaAditivo" WHERE id = ${d.processoId} FOR UPDATE`;
  const p = await tx.processoAssinaturaAditivo.findUniqueOrThrow({ where: { id: d.processoId }, include: { proposta: { select: { matriculaId: true } }, conclusao: true,
    artefato: { include: { conferencia: true } }, tentativas: { orderBy: { numero: "desc" }, take: 1 } } });
  const envio = p.tentativas[0];
  if (p.estado !== "ENVIADO" || !envio || envio.numero !== p.tentativaAtual || p.referenciaExterna !== d.referenciaExterna || p.artefato.pdfHash !== d.originalHash)
    throw new ErroRegra("Conclusão incompatível com o envio confirmado e seu original de aditivo.");
  if (createHash("sha256").update(p.artefato.pdf).digest("hex") !== p.artefato.pdfHash) throw new ErroRegra("Integridade do original de aditivo divergente.");
  if (hashSubstituicao(p.artefato.conferencia.snapshot) !== p.artefato.conferencia.revisaoHash) throw new ErroRegra("A conferência preservada do aditivo perdeu integridade.");
  // Não recarrega contexto atual: assinaturas validam a conferência preservada do artefato.
  const v = validarConclusaoAssinatura(d, p.artefato.conferencia.snapshot, envio.iniciadaEm);
  if (p.conclusao) {
    if (p.conclusao.entradaHash !== v.entradaHash) throw new ErroRegra("Conclusão de aditivo já preservada com outro conteúdo.");
    return { id: p.conclusao.id };
  }
  const c = await tx.conclusaoAssinaturaAditivo.create({ data: { processoId: p.id, referenciaExterna: v.referenciaExterna, originalHash: v.originalHash,
    pdfAssinado: v.pdfAssinado, pdfHash: v.pdfHash, evidencias: v.evidencias, evidenciasHash: v.evidenciasHash, assinaturas: v.assinaturas,
    concluidaEm: v.concluidaEm, entradaHash: v.entradaHash } });
  await registrarEvento(tx, { tipo: "ConclusaoAssinaturaAditivoPreservada", agregadoTipo: "Matricula", agregadoId: p.proposta.matriculaId,
    payload: { processoId: p.id, conclusaoId: c.id, artefatoId: p.artefatoId, ambiente: p.ambiente, pdfHash: c.pdfHash, evidenciasHash: c.evidenciasHash } });
  return { id: c.id };
}
