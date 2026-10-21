import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { z } from "zod";
import { ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { ConclusaoAssinaturaSchema, validarConclusaoAssinatura } from "./conclusao-assinatura-schema";

/** Primitiva interna, sem Server Action: somente adaptador autenticado que conferiu
 * o documento e a auditoria no fornecedor. Não aceita webhook público diretamente.
 * Preservar conclusão não confere o aceite pela Secretaria nem ativa matrícula. */
export async function preservarConclusaoAssinaturaTx(tx: Prisma.TransactionClient, input: z.input<typeof ConclusaoAssinaturaSchema>) {
  const d = ConclusaoAssinaturaSchema.parse(input);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola',0))`;
  const ref = await tx.processoAssinaturaContratual.findUnique({ where: { id: d.processoId }, select: { matriculaId: true } });
  if (!ref) throw new ErroRegra("Processo não encontrado.");
  await bloquearMatriculas(tx, [ref.matriculaId]);
  await tx.$queryRaw`SELECT id FROM "ProcessoAssinaturaContratual" WHERE id = ${d.processoId} FOR UPDATE`;
  const p = await tx.processoAssinaturaContratual.findUniqueOrThrow({ where: { id: d.processoId }, include: { conclusao: true, artefato: { include: { conferencia: true } }, tentativas: { orderBy: { numero: "desc" }, take: 1 } } });
  const envio = p.tentativas[0];
  const fonteSubstituida = p.estado === "CANCELADO" && await tx.aplicacaoSubstituicaoContratual.count({ where: { intencao: { processoId: p.id } } }) > 0;
  if ((p.estado !== "ENVIADO" && !fonteSubstituida) || !envio || p.referenciaExterna !== d.referenciaExterna || p.artefato.pdfHash !== d.originalHash) throw new ErroRegra("Conclusão incompatível com o envio confirmado e seu original.");
  if (createHash("sha256").update(p.artefato.pdf).digest("hex") !== p.artefato.pdfHash) throw new ErroRegra("Integridade do original divergente.");
  const v = validarConclusaoAssinatura(d, p.artefato.conferencia.snapshot, envio.iniciadaEm);
  if (p.conclusao) {
    if (p.conclusao.entradaHash !== v.entradaHash) throw new ErroRegra("Conclusão já preservada com outro conteúdo. Confira a divergência.");
    return { id: p.conclusao.id };
  }
  const c = await tx.conclusaoAssinaturaContratual.create({ data: { processoId: p.id, referenciaExterna: v.referenciaExterna, originalHash: v.originalHash, pdfAssinado: v.pdfAssinado, pdfHash: v.pdfHash,
    evidencias: v.evidencias, evidenciasHash: v.evidenciasHash, assinaturas: v.assinaturas, concluidaEm: v.concluidaEm, entradaHash: v.entradaHash } });
  await registrarEvento(tx, { tipo: "ConclusaoAssinaturaPreservada", agregadoTipo: "Matricula", agregadoId: p.matriculaId,
    payload: { processoId: p.id, conclusaoId: c.id, artefatoId: p.artefatoId, ambiente: p.ambiente, pdfHash: c.pdfHash, evidenciasHash: c.evidenciasHash } });
  return { id: c.id };
}
