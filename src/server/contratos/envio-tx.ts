import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { conferirAutor } from "./modelos-tx";
import { carregarRevisaoAssinatura } from "./assinatura-estado";
import { aplicarSubstituicaoContratualTx, ConsumoSubstituicaoSchema } from "./substituicao-aplicar-tx";

const Destino = z.object({ fornecedor: z.enum(["ZAPSIGN", "CLICKSIGN", "DOCUSIGN"]), ambiente: z.enum(["SANDBOX", "PRODUCAO"]) });
const Criar = Destino.extend({ matriculaId: z.string().min(1), artefatoId: z.string().min(1), conferenciaId: z.string().min(1), executorId: z.string().min(1), substituicao: ConsumoSubstituicaoSchema.optional() }).strict();

/** Primitivas internas: nenhuma é Server Action ou faz chamada externa.
 * A integração escolhida deve fornecer configuração validada, confirmar permissão
 * de envio e persistir a tentativa antes de chamar o fornecedor fora da transação. */
export async function prepararProcessoEnvioTx(tx: Prisma.TransactionClient, input: z.input<typeof Criar>) {
  const d = Criar.parse(input);
  if (d.substituicao) return aplicarSubstituicaoContratualTx(tx, d.executorId, { ...d.substituicao, matriculaId: d.matriculaId, artefatoId: d.artefatoId, conferenciaId: d.conferenciaId, fornecedor: d.fornecedor, ambiente: d.ambiente });
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await bloquearMatriculas(tx, [d.matriculaId]); await conferirAutor(tx, d.executorId);
  const existente = await tx.processoAssinaturaContratual.findFirst({ where: { matriculaId: d.matriculaId }, orderBy: { criadoEm: "desc" } });
  if (existente) {
    if (existente.artefatoId === d.artefatoId && existente.conferenciaId === d.conferenciaId && existente.fornecedor === d.fornecedor && existente.ambiente === d.ambiente && existente.estado !== "CANCELADO") return { id: existente.id };
    throw new ErroRegra("Há processo anterior nesta matrícula. Substituição exige seu fluxo próprio, sem abrir envio paralelo.");
  }
  const c = await tx.conferenciaAssinaturaContratual.findUnique({ where: { id: d.conferenciaId } });
  if (!c || c.artefatoId !== d.artefatoId) throw new ErroRegra("Conferência incompatível com o original.");
  const r = await carregarRevisaoAssinatura(tx, d.matriculaId, d.artefatoId);
  if (r.revisaoHash !== c.revisaoHash) throw new ErroRegra("Atualize a conferência antes de preparar o envio.");
  const p = await tx.processoAssinaturaContratual.create({ data: { matriculaId: d.matriculaId, artefatoId: d.artefatoId, conferenciaId: c.id, preparadorId: d.executorId, fornecedor: d.fornecedor, ambiente: d.ambiente } });
  await registrarEvento(tx, { tipo: "ProcessoAssinaturaPreparado", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId: d.executorId,
    payload: { processoId: p.id, artefatoId: p.artefatoId, fornecedor: p.fornecedor, ambiente: p.ambiente } });
  return { id: p.id };
}

export async function iniciarTentativaAssinaturaTx(tx: Prisma.TransactionClient, input: { processoId: string; executorId: string }) {
  const d = z.object({ processoId: z.string().min(1), executorId: z.string().min(1) }).strict().parse(input);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  const referencia = await tx.processoAssinaturaContratual.findUnique({ where: { id: d.processoId }, select: { matriculaId: true } });
  if (!referencia) throw new ErroRegra("Processo não encontrado.");
  await bloquearMatriculas(tx, [referencia.matriculaId]); await conferirAutor(tx, d.executorId);
  await tx.$queryRaw`SELECT id FROM "ProcessoAssinaturaContratual" WHERE id = ${d.processoId} FOR UPDATE`;
  const p = await tx.processoAssinaturaContratual.findUniqueOrThrow({ where: { id: d.processoId }, include: { conferencia: true } });
  const [conflito] = await tx.$queryRaw<{ existe: boolean }[]>`SELECT fonte_assinada_substituicao_218(${p.id}) AS existe`;
  if (conflito.existe) throw new ErroRegra("Contrato anterior assinado exige conferência Q117 antes de novo envio.");
  if (p.estado !== "PREPARADO" || p.referenciaExterna !== null) throw new ErroRegra("O envio já foi iniciado ou exige conciliação. Não repetir a criação no fornecedor.");
  const r = await carregarRevisaoAssinatura(tx, p.matriculaId, p.artefatoId);
  if (r.revisaoHash !== p.conferencia.revisaoHash) throw new ErroRegra("As condições mudaram antes do envio. Revise o processo.");
  const t = await tx.tentativaEnvioAssinatura.create({ data: { processoId: p.id, numero: p.tentativaAtual + 1, revisaoHash: r.revisaoHash } });
  await tx.processoAssinaturaContratual.update({ where: { id: p.id }, data: { estado: "ENVIANDO", tentativaAtual: t.numero } });
  await registrarEvento(tx, { tipo: "TentativaAssinaturaIniciada", agregadoTipo: "Matricula", agregadoId: p.matriculaId, autorId: d.executorId, payload: { processoId: p.id, tentativaId: t.id, numero: t.numero } });
  return { processoId: p.id, tentativaId: t.id, numero: t.numero };
}

const Resultado = z.object({ processoId: z.string().min(1), tentativaId: z.string().min(1), chave: z.string().min(8).max(200),
  resultado: z.enum(["INCERTO", "REGISTRADO", "NAO_CRIADO"]), referenciaExterna: z.string().trim().min(1).max(200).nullable(), evidenciaHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();

/** Somente o adaptador autenticado/conciliador deve chamar. NAO_CRIADO exige prova
 * positiva do fornecedor: timeout/erro de rede por si só sempre é INCERTO. */
export async function registrarResultadoEnvioTx(tx: Prisma.TransactionClient, input: z.input<typeof Resultado>) {
  const d = Resultado.parse(input);
  if ((d.resultado === "REGISTRADO") !== (d.referenciaExterna !== null)) throw new ErroRegra("Resultado incompatível com a referência externa.");
  await tx.$queryRaw`SELECT id FROM "ProcessoAssinaturaContratual" WHERE id = ${d.processoId} FOR UPDATE`;
  const p = await tx.processoAssinaturaContratual.findUnique({ where: { id: d.processoId } });
  const t = await tx.tentativaEnvioAssinatura.findUnique({ where: { id: d.tentativaId } });
  if (!p || !t || t.processoId !== p.id) throw new ErroRegra("Tentativa não pertence ao processo.");
  const anterior = await tx.observacaoEnvioAssinatura.findUnique({ where: { tentativaId_chave: { tentativaId: t.id, chave: d.chave } } });
  if (anterior) {
    if (anterior.resultado !== d.resultado || anterior.referenciaExterna !== d.referenciaExterna || anterior.evidenciaHash !== d.evidenciaHash) throw new ErroRegra("Chave reutilizada com outro resultado.");
    return { id: anterior.id, estado: p.estado };
  }
  if (p.tentativaAtual !== t.numero || p.estado === "CANCELADO") throw new ErroRegra("Resultado de tentativa anterior exige conferência; não alterar o processo atual.");
  if (p.estado === "ENVIADO" && (d.resultado !== "REGISTRADO" || p.referenciaExterna !== d.referenciaExterna)) throw new ErroRegra("O processo já tem envio confirmado. Resultado divergente exige conciliação.");
  if (p.estado === "PREPARADO") throw new ErroRegra("A tentativa já terminou sem criação. Confira qualquer informação posterior antes de prosseguir.");
  const estado = d.resultado === "REGISTRADO" ? "ENVIADO" : d.resultado === "NAO_CRIADO" ? "PREPARADO" : "ENVIO_INCERTO";
  const o = await tx.observacaoEnvioAssinatura.create({ data: { tentativaId: t.id, chave: d.chave, resultado: d.resultado, referenciaExterna: d.referenciaExterna, evidenciaHash: d.evidenciaHash } });
  await tx.processoAssinaturaContratual.update({ where: { id: p.id }, data: { estado, ...(d.referenciaExterna ? { referenciaExterna: d.referenciaExterna } : {}) } });
  await registrarEvento(tx, { tipo: "ResultadoEnvioAssinaturaRegistrado", agregadoTipo: "Matricula", agregadoId: p.matriculaId,
    payload: { processoId: p.id, tentativaId: t.id, observacaoId: o.id, resultado: d.resultado, estado } });
  return { id: o.id, estado };
}
