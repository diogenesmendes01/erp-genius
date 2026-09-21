import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { conferirAutor } from "./modelos-tx";
import { carregarRevisaoAceite } from "./aceite-estado";
import { hashPrevia } from "./previa-estado";
import { Confirmar } from "./aceite-schema";

/** Primitiva interna, não é Server Action; revalida autor dentro da transação. */
export async function confirmarAceiteOriginalTx(tx: Prisma.TransactionClient, autorId: string, input: z.input<typeof Confirmar>) {
  const d = Confirmar.parse(input);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`aceite-original:${autorId}`}, 0))`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await bloquearMatriculas(tx, [d.matriculaId]);
  await conferirAutor(tx, autorId);
  const anterior = await tx.aceiteOriginalContratual.findUnique({ where: { autorId_chaveIdempotencia: { autorId, chaveIdempotencia: d.chaveIdempotencia } } });
  if (anterior) {
    if (anterior.entradaHash !== hashPrevia(d)) throw new ErroRegra("Chave já utilizada para outro aceite.");
    return { id: anterior.id, documentoId: anterior.documentoId, matriculaAtivada: false as const };
  }
  if (await tx.aceiteOriginalContratual.count({ where: { matriculaId: d.matriculaId } })) throw new ErroRegra("O aceite inicial já foi registrado. Alterações exigem o fluxo contratual correspondente.");
  const r = await carregarRevisaoAceite(tx, d.matriculaId, d.conclusaoId);
  if (r.revisaoHash !== d.revisaoHash) throw new ErroRegra("As condições mudaram desde a consulta. Atualize e confira novamente o aceite.");
  const documento = await tx.documento.create({ data: { matriculaId: d.matriculaId, categoria: "CONTRATO", nome: "Original assinado — aceite conferido", url: `/api/matriculas/${d.matriculaId}/assinaturas/${d.conclusaoId}/pdf` } });
  const aceite = await tx.aceiteOriginalContratual.create({ data: { matriculaId: d.matriculaId, conclusaoId: d.conclusaoId, documentoId: documento.id, autorId,
    revisaoHash: r.revisaoHash, snapshot: r.snapshot, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, entradaHash: hashPrevia(d) } });
  await tx.matricula.update({ where: { id: d.matriculaId }, data: { contratoOk: true, contratoDocumentoId: documento.id, confirmacaoContratoEm: aceite.criadaEm, confirmacaoContratoPorId: autorId } });
  await registrarEvento(tx, { tipo: "ContratoConfirmado", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId,
    payload: { documentoId: documento.id, aceiteOriginalId: aceite.id, conclusaoId: d.conclusaoId, artefatoId: r.snapshot.artefatoId, condicoesMensais: r.snapshot.condicoesMensais } });
  return { id: aceite.id, documentoId: documento.id, matriculaAtivada: false as const };
}
