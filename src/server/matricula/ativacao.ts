import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared/sessao";
import { exigirPrecoPreparacaoAutorizado } from "./preco-autorizado";
import { exigirAceiteIntegrado } from "@/server/contratos/aceite-estado";

/** O aceite deve apontar para um contrato vigente, com autor e data da conferência. */
export async function exigirContratoAceito(tx: Prisma.TransactionClient, matricula: {
  id: string; leadId: string | null; contratoOk: boolean; contratoDocumentoId: string | null;
  confirmacaoContratoEm: Date | null; confirmacaoContratoPorId: string | null;
}) {
  await exigirPrecoPreparacaoAutorizado(tx, matricula.id);
  if (!matricula.contratoOk || !matricula.contratoDocumentoId || !matricula.confirmacaoContratoEm || !matricula.confirmacaoContratoPorId) {
    throw new ErroRegra("O contrato precisa estar aceito e confirmado pela secretaria antes da ativação.");
  }
  const integrado = await exigirAceiteIntegrado(tx, matricula);
  if (integrado) return integrado;
  await tx.$queryRaw`SELECT id FROM "Documento" WHERE id = ${matricula.contratoDocumentoId} FOR UPDATE`;
  const documento = await tx.documento.findFirst({
    where: {
      id: matricula.contratoDocumentoId, categoria: "CONTRATO", arquivado: false,
      OR: [{ matriculaId: matricula.id }, ...(matricula.leadId ? [{ leadId: matricula.leadId }] : [])],
    },
    select: { id: true, url: true },
  });
  if (!documento?.url.trim()) throw new ErroRegra("O contrato confirmado não está mais disponível nesta matrícula. Solicite revisão à secretaria.");
  return documento.id;
}
