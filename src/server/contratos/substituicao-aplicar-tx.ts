import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra, registrarEvento } from "@/server/_shared";
import { conferirAutor } from "./modelos-tx";
import { carregarContextoSubstituicaoTx, hashSubstituicao } from "./substituicao-estado";

export const ConsumoSubstituicaoSchema = z.object({ intencaoId: z.string().min(1), observacaoId: z.string().min(1), propostaHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const Entrada = ConsumoSubstituicaoSchema.extend({ matriculaId: z.string().min(1), artefatoId: z.string().min(1), conferenciaId: z.string().min(1), fornecedor: z.string().min(1), ambiente: z.enum(["SANDBOX", "PRODUCAO"]) }).strict();

/** Consome a confirmação e prepara o substituto, sem realizar envio remoto.
 * Aplicação, estado da fonte e novo processo precisam COMMITAR juntos. */
export async function aplicarSubstituicaoContratualTx(tx: Prisma.TransactionClient, executorId: string, entrada: unknown) {
  const d = Entrada.parse(entrada);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola',0))`;
  const i = await tx.intencaoCancelamentoAssinatura.findUnique({ where: { id: d.intencaoId }, include: { proposta: { include: { decisao: true } }, processo: true, aplicacao: true } });
  if (!i) throw new ErroRegra("Intenção de cancelamento não encontrada.");
  await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id=${i.processo.matriculaId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "ProcessoAssinaturaContratual" WHERE id=${i.processoId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${executorId} FOR SHARE`;
  await conferirAutor(tx, executorId);
  const p = i.proposta;
  if (d.matriculaId !== p.matriculaId || d.artefatoId !== p.artefatoSubstitutoId || d.conferenciaId !== p.conferenciaSubstitutoId || d.fornecedor !== i.processo.fornecedor || d.ambiente !== i.processo.ambiente
    || d.propostaHash !== i.propostaHash || d.propostaHash !== p.entradaHash || hashSubstituicao(p.snapshot) !== p.entradaHash) throw new ErroRegra("O substituto não corresponde à aprovação e ao destino conferidos.");
  if (i.aplicacao) {
    if (i.aplicacao.observacaoId !== d.observacaoId || i.aplicacao.propostaHash !== d.propostaHash) throw new ErroRegra("A substituição já foi aplicada com outra evidência.");
    return { id: i.aplicacao.processoSubstitutoId };
  }
  const o = await tx.observacaoCancelamentoAssinatura.findUnique({ where: { id: d.observacaoId } });
  if (!o || o.intencaoId !== i.id || o.resultado !== "CONFIRMADO" || o.referenciaExterna !== i.referenciaExterna) throw new ErroRegra("O cancelamento desta intenção ainda não foi confirmado.");
  if (!p.decisao?.aprovada || p.decisao.id !== i.decisaoId || p.decisao.decisorId === p.preparadaPorId || p.decisao.propostaHash !== p.entradaHash) throw new ErroRegra("Aprovação independente incompatível.");
  if (await tx.propostaSubstituicaoContratual.count({ where: { processoFonteId: i.processoId, versao: { gt: p.versao } } })) throw new ErroRegra("Existe proposta mais recente.");
  const snapshot = p.snapshot as Prisma.JsonObject;
  const contexto = await carregarContextoSubstituicaoTx(tx, snapshot.entrada);
  const atual = JSON.parse(JSON.stringify({ ...contexto, versao: p.versao, preparadaPorId: p.preparadaPorId, motivo: p.motivo, entrada: snapshot.entrada })) as Prisma.JsonValue;
  if (hashSubstituicao(atual) !== p.entradaHash) throw new ErroRegra("Condições alteradas após a aprovação; confira a substituição.");
  const id = randomUUID();
  const aplicacao = await tx.aplicacaoSubstituicaoContratual.create({ data: { intencaoId: i.id, observacaoId: o.id, processoSubstitutoId: id, executorId, propostaHash: p.entradaHash } });
  await tx.processoAssinaturaContratual.update({ where: { id: i.processoId }, data: { estado: "CANCELADO" } });
  await tx.processoAssinaturaContratual.create({ data: { id, matriculaId: p.matriculaId, artefatoId: p.artefatoSubstitutoId, conferenciaId: p.conferenciaSubstitutoId, preparadorId: executorId, fornecedor: i.processo.fornecedor, ambiente: i.processo.ambiente } });
  await registrarEvento(tx, { tipo: "SubstituicaoContratualAplicada", agregadoTipo: "Matricula", agregadoId: p.matriculaId, autorId: executorId,
    payload: { aplicacaoId: aplicacao.id, intencaoId: i.id, observacaoId: o.id, processoFonteId: i.processoId, processoSubstitutoId: id, propostaId: p.id } });
  return { id };
}
