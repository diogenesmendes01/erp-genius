import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { conferirAutor } from "./modelos-tx";
import { consultarEstadoAssinaturaAditivoTx } from "./aditivo-assinatura-estado";
import { exigirAlcadasAditivoTx } from "./aditivo-alcadas-tx";
import { hashSubstituicao } from "./substituicao-estado";

const Destino = z.object({ fornecedor: z.enum(["ZAPSIGN", "CLICKSIGN", "DOCUSIGN"]), ambiente: z.enum(["SANDBOX", "PRODUCAO"]) });
const Preparar = Destino.extend({ matriculaId: z.string().min(1), propostaId: z.string().min(1), artefatoId: z.string().min(1), conferenciaId: z.string().min(1) }).strict();
const Resultado = z.object({ processoId: z.string().min(1), tentativaId: z.string().min(1), chave: z.string().min(8).max(200), resultado: z.enum(["INCERTO", "REGISTRADO", "NAO_CRIADO"]), referenciaExterna: z.string().trim().min(1).max(200).nullable(), evidenciaHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();

async function estado(tx: Prisma.TransactionClient, p: { matriculaId: string; propostaId: string; artefatoId: string; conferenciaId: string }) {
  const e = await consultarEstadoAssinaturaAditivoTx(tx, p);
  const proposta = await tx.propostaAditivoContratual.findUniqueOrThrow({ where: { id: p.propostaId }, select: { id: true, entradaHash: true, snapshot: true } });
  await exigirAlcadasAditivoTx(tx, proposta);
  const c = await tx.conferenciaAssinaturaAditivo.findUnique({ where: { id: p.conferenciaId } });
  if (!c || c.artefatoId !== p.artefatoId || hashSubstituicao(c.snapshot) !== c.revisaoHash || c.revisaoHash !== e.revisaoHash) throw new ErroRegra("A conferência interna não corresponde ao original atual.");
  return e;
}
export async function prepararProcessoAditivoTx(tx: Prisma.TransactionClient, autorId: string, entrada: unknown) {
  const d = Preparar.parse(entrada); await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`; await bloquearMatriculas(tx, [d.matriculaId]);
  const e = await estado(tx, d);
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autorId} FOR SHARE`; await conferirAutor(tx, autorId);
  if (e.dados.ambiente !== d.ambiente) throw new ErroRegra("O ambiente do envio precisa corresponder ao original preservado.");
  const existente = await tx.processoAssinaturaAditivo.findFirst({ where: { propostaId: d.propostaId } });
  if (existente) {
    if (existente.artefatoId === d.artefatoId && existente.conferenciaId === d.conferenciaId && existente.fornecedor === d.fornecedor && existente.ambiente === d.ambiente) return { id: existente.id };
    throw new ErroRegra("Já existe processo de assinatura para esta proposta.");
  }
  const p = await tx.processoAssinaturaAditivo.create({ data: { propostaId: d.propostaId, artefatoId: d.artefatoId, conferenciaId: d.conferenciaId, preparadorId: autorId, fornecedor: d.fornecedor, ambiente: d.ambiente } });
  await registrarEvento(tx, { tipo: "ProcessoAssinaturaAditivoPreparado", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId, payload: { processoId: p.id, propostaId: d.propostaId, fornecedor: d.fornecedor, ambiente: d.ambiente } }); return { id: p.id };
}
export async function iniciarTentativaAditivoTx(tx: Prisma.TransactionClient, autorId: string, entrada: unknown) {
  const d = z.object({ processoId: z.string().min(1) }).strict().parse(entrada); await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  let p = await tx.processoAssinaturaAditivo.findUnique({ where: { id: d.processoId } }); if (!p) throw new ErroRegra("Processo não encontrado.");
  const proposta = await tx.propostaAditivoContratual.findUniqueOrThrow({ where: { id: p.propostaId } }); await bloquearMatriculas(tx, [proposta.matriculaId]);
  await tx.$queryRaw`SELECT id FROM "ProcessoAssinaturaAditivo" WHERE id = ${p.id} FOR UPDATE`;
  p = await tx.processoAssinaturaAditivo.findUniqueOrThrow({ where: { id: p.id } });
  if (p.estado !== "PREPARADO" || p.referenciaExterna) throw new ErroRegra("O envio já foi iniciado ou exige conciliação.");
  const e = await estado(tx, { matriculaId: proposta.matriculaId, propostaId: p.propostaId, artefatoId: p.artefatoId, conferenciaId: p.conferenciaId });
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autorId} FOR SHARE`; await conferirAutor(tx, autorId);
  const t = await tx.tentativaEnvioAditivo.create({ data: { processoId: p.id, numero: p.tentativaAtual + 1, revisaoHash: e.revisaoHash } }); await tx.processoAssinaturaAditivo.update({ where: { id: p.id }, data: { estado: "ENVIANDO", tentativaAtual: t.numero } }); return { processoId: p.id, tentativaId: t.id, numero: t.numero };
}
export async function registrarResultadoEnvioAditivoTx(tx: Prisma.TransactionClient, entrada: unknown) {
  const d = Resultado.parse(entrada); if ((d.resultado === "REGISTRADO") !== (d.referenciaExterna !== null)) throw new ErroRegra("Resultado incompatível com a referência externa.");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  const referencia = await tx.processoAssinaturaAditivo.findUnique({ where: { id: d.processoId }, include: { proposta: { select: { matriculaId: true } } } }); if (!referencia) throw new ErroRegra("Processo não encontrado.");
  await bloquearMatriculas(tx, [referencia.proposta.matriculaId]); await tx.$queryRaw`SELECT id FROM "ProcessoAssinaturaAditivo" WHERE id = ${d.processoId} FOR UPDATE`;
  const p = await tx.processoAssinaturaAditivo.findUnique({ where: { id: d.processoId } }); const t = await tx.tentativaEnvioAditivo.findUnique({ where: { id: d.tentativaId } });
  if (!p || !t || t.processoId !== p.id) throw new ErroRegra("Tentativa não pertence ao processo."); const anterior = await tx.observacaoEnvioAditivo.findUnique({ where: { tentativaId_chave: { tentativaId: t.id, chave: d.chave } } }); if (anterior) { if (anterior.resultado !== d.resultado || anterior.referenciaExterna !== d.referenciaExterna || anterior.evidenciaHash !== d.evidenciaHash) throw new ErroRegra("Chave reutilizada com outro resultado."); return { id: anterior.id, estado: p.estado }; }
  if (p.tentativaAtual !== t.numero || p.estado === "CANCELADO" || p.estado === "PREPARADO") throw new ErroRegra("Resultado exige conciliação."); if (p.estado === "ENVIADO" && (d.resultado !== "REGISTRADO" || p.referenciaExterna !== d.referenciaExterna)) throw new ErroRegra("O processo já tem envio confirmado.");
  if (p.estado !== "ENVIANDO" && p.estado !== "ENVIO_INCERTO" && p.estado !== "ENVIADO") throw new ErroRegra("Resultado exige conciliação."); const estadoNovo = d.resultado === "REGISTRADO" ? "ENVIADO" : d.resultado === "NAO_CRIADO" ? "PREPARADO" : "ENVIO_INCERTO";
  const o = await tx.observacaoEnvioAditivo.create({ data: { tentativaId: t.id, chave: d.chave, resultado: d.resultado, referenciaExterna: d.referenciaExterna, evidenciaHash: d.evidenciaHash } }); await tx.processoAssinaturaAditivo.update({ where: { id: p.id }, data: { estado: estadoNovo, ...(d.referenciaExterna ? { referenciaExterna: d.referenciaExterna } : {}) } }); return { id: o.id, estado: estadoNovo };
}
