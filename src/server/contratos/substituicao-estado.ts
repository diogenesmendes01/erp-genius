import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { carregarRevisaoAssinatura } from "./assinatura-estado";
import { PrepararSubstituicaoContratualSchema } from "./substituicao-schema";

/** Ordem determinística para snapshots que atravessam JSONB. Preserva a ordem
 * de arrays, pois participantes/etapas não são conjuntos intercambiáveis. */
export function hashSubstituicao(valor: Prisma.JsonValue): string {
  const ordenar = (item: Prisma.JsonValue): Prisma.JsonValue => {
    if (Array.isArray(item)) return item.map(ordenar);
    if (item !== null && typeof item === "object") {
      return Object.fromEntries(Object.keys(item).sort().map(chave => [chave, ordenar(item[chave]!)]));
    }
    return item;
  };
  return createHash("sha256").update(JSON.stringify(ordenar(valor))).digest("hex");
}

/** Primitiva interna; o chamador confere a identidade/permissão na mesma
 * transação. Não cancela a fonte nem autoriza envio ao fornecedor. */
export async function carregarContextoSubstituicaoTx(tx: Prisma.TransactionClient, entrada: unknown) {
  const d = PrepararSubstituicaoContratualSchema.parse(entrada);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  const referencia = await tx.processoAssinaturaContratual.findUnique({ where: { id: d.processoFonteId }, select: { matriculaId: true } });
  if (!referencia) throw new ErroRegra("Processo fonte não encontrado.");
  await bloquearMatriculas(tx, [referencia.matriculaId]);
  await tx.$queryRaw`SELECT id FROM "ProcessoAssinaturaContratual" WHERE id = ${d.processoFonteId} FOR UPDATE`;
  const fonte = await tx.processoAssinaturaContratual.findUniqueOrThrow({ where: { id: d.processoFonteId }, include: { conferencia: true, artefato: { include: { previa: true } }, conclusao: true } });
  if (fonte.conclusao) throw new ErroRegra("Contrato totalmente assinado exige aditivo Q117.");
  if (fonte.estado !== "ENVIADO" || !fonte.referenciaExterna) throw new ErroRegra("Substituição exige envio confirmado, sem resultado incerto.");
  if (fonte.conferencia.artefatoId !== fonte.artefatoId || fonte.artefato.previa.matriculaId !== fonte.matriculaId) throw new ErroRegra("A identidade preservada da fonte está incompatível.");
  if (fonte.conferencia.revisaoHash !== d.revisaoFonteEsperada) throw new ErroRegra("A revisão preservada da fonte não corresponde à proposta.");
  if (createHash("sha256").update(fonte.artefato.pdf).digest("hex") !== fonte.artefato.pdfHash) throw new ErroRegra("Integridade do original fonte divergente.");

  const conferencia = await tx.conferenciaAssinaturaContratual.findUnique({ where: { id: d.conferenciaSubstitutoId }, include: { artefato: { include: { previa: true } } } });
  if (!conferencia || conferencia.artefato.previa.matriculaId !== fonte.matriculaId) throw new ErroRegra("O substituto deve pertencer à mesma matrícula da fonte.");
  if (conferencia.artefatoId === fonte.artefatoId) throw new ErroRegra("O substituto exige original diferente da fonte.");
  if (conferencia.revisaoHash !== d.revisaoSubstitutoEsperada) throw new ErroRegra("A conferência do substituto não corresponde à revisão esperada.");
  // Não recalcular a prévia antiga contra dados atuais: Q116 existe justamente
  // para corrigir essa divergência. O substituto, por outro lado, deve ser atual.
  const atual = await carregarRevisaoAssinatura(tx, fonte.matriculaId, conferencia.artefatoId);
  if (atual.revisaoHash !== conferencia.revisaoHash) throw new ErroRegra("As condições do substituto mudaram. Confira novamente antes de prosseguir.");
  const diferencas = {
    fonte: { artefatoId: fonte.artefatoId, pdfHash: fonte.artefato.pdfHash, revisao: fonte.conferencia.snapshot },
    substituto: { artefatoId: conferencia.artefatoId, pdfHash: conferencia.artefato.pdfHash, revisao: atual.snapshot },
  };
  return {
    matriculaId: fonte.matriculaId, processoFonteId: fonte.id, referenciaExternaFonte: fonte.referenciaExterna,
    artefatoFonteId: fonte.artefatoId, artefatoSubstitutoId: conferencia.artefatoId,
    conferenciaSubstitutoId: conferencia.id, revisaoFonteHash: fonte.conferencia.revisaoHash,
    revisaoSubstitutoHash: conferencia.revisaoHash, diferencas,
  };
}
