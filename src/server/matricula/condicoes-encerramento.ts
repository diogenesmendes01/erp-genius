"use server";
import { z } from "zod";
import { Papel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { RegrasEncerramentoSchema } from "./condicoes-encerramento-schema";

const id = z.string().min(1).max(100);
const Preparar = z.object({ matriculaId: id, documentoId: id.optional(), artefatoContratualId: id.optional(), processoAssinaturaId: id.optional(), regras: RegrasEncerramentoSchema, motivo: z.string().trim().min(5).max(2000) }).strict().superRefine((d, ctx) => {
  const documento = !!d.documentoId;
  const artefato = !!d.artefatoContratualId || !!d.processoAssinaturaId;
  if (documento === artefato || (!!d.artefatoContratualId !== !!d.processoAssinaturaId)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe o contrato aceito ou o original enviado e seu processo de assinatura." });
});
type Fonte = z.infer<typeof Preparar>;

async function exigirFonte(tx: Prisma.TransactionClient, d: Fonte) {
  const m = await tx.matricula.findUnique({ where: { id: d.matriculaId }, select: { id: true, leadId: true, status: true, ativadaEm: true, contratoOk: true, confirmacaoContratoEm: true, contratoDocumentoId: true } });
  if (!m) throw new ErroRegra("Matrícula não encontrada.");
  if (d.documentoId) {
    if (!m.contratoOk || !m.confirmacaoContratoEm || m.contratoDocumentoId !== d.documentoId) throw new ErroRegra("Use o contrato confirmado da matrícula.");
    await tx.$queryRaw`SELECT id FROM "Documento" WHERE id = ${d.documentoId} FOR SHARE`;
    const doc = await tx.documento.findFirst({ where: { id: d.documentoId, categoria: "CONTRATO", arquivado: false, OR: [{ matriculaId: m.id }, ...(m.leadId ? [{ leadId: m.leadId }] : [])] } });
    if (!doc) throw new ErroRegra("Documento contratual indisponível.");
    return;
  }
  if (m.ativadaEm || !["RASCUNHO", "AGUARDANDO"].includes(m.status) || !d.regras.acertoDesistenciaPreparacao) throw new ErroRegra("Original enviado só pode fundamentar acerto de desistência antes da ativação.");
  await tx.$queryRaw`SELECT id FROM "ArtefatoContratual" WHERE id = ${d.artefatoContratualId!} FOR SHARE`;
  await tx.$queryRaw`SELECT id FROM "ProcessoAssinaturaContratual" WHERE id = ${d.processoAssinaturaId!} FOR SHARE`;
  const processo = await tx.processoAssinaturaContratual.findUnique({ where: { id: d.processoAssinaturaId! }, select: { matriculaId: true, artefatoId: true, conferenciaId: true, estado: true, referenciaExterna: true, conclusao: { select: { id: true } }, artefato: { select: { previa: { select: { matriculaId: true } } } } } });
  if (!processo || processo.matriculaId !== m.id || processo.artefatoId !== d.artefatoContratualId || processo.artefato.previa.matriculaId !== m.id || processo.estado !== "ENVIADO" || !processo.referenciaExterna || processo.conclusao) throw new ErroRegra("Use o original conferido com envio externo confirmado e ainda sem conclusão.");
}
async function exigirAutor(tx: Prisma.TransactionClient, id: string, papeis: Papel[]) {
  const u = await tx.usuario.findUnique({ where: { id }, select: { ativo: true, papeis: true } });
  if (!u?.ativo || !u.papeis.some((p) => papeis.includes(p))) throw new ErroPermissao();
}
export async function prepararCondicoesEncerramento(input: z.input<typeof Preparar>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const d = Preparar.parse(input);
    return prisma.$transaction(async (tx) => {
      await bloquearMatriculas(tx, [d.matriculaId]); await exigirAutor(tx, autor.id, [Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR]); await exigirFonte(tx, d);
      if (await tx.condicoesEncerramentoMatricula.count({ where: { matriculaId: d.matriculaId, status: "PENDENTE" } })) throw new ErroRegra("Já existe versão aguardando decisão.");
      const ultima = await tx.condicoesEncerramentoMatricula.findFirst({ where: { matriculaId: d.matriculaId }, orderBy: { versao: "desc" }, select: { versao: true } });
      const c = await tx.condicoesEncerramentoMatricula.create({ data: { ...d, versao: (ultima?.versao ?? 0) + 1, preparadorId: autor.id } });
      await registrarEvento(tx, { tipo: "CondicoesEncerramentoPreparadas", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId: autor.id, payload: { condicoesId: c.id, versao: c.versao, documentoId: d.documentoId ?? null, artefatoContratualId: d.artefatoContratualId ?? null, processoAssinaturaId: d.processoAssinaturaId ?? null } });
      return { id: c.id, versao: c.versao };
    });
  });
}
export async function decidirCondicoesEncerramento(input: { id: string; aprovar: boolean; motivo: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const d = z.object({ id, aprovar: z.boolean(), motivo: z.string().trim().min(5).max(2000) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const ref = await tx.condicoesEncerramentoMatricula.findUnique({ where: { id: d.id }, select: { matriculaId: true } }); if (!ref) throw new ErroRegra("Versão não encontrada.");
      await bloquearMatriculas(tx, [ref.matriculaId]); await exigirAutor(tx, autor.id, [Papel.ADMINISTRADOR]);
      const c = await tx.condicoesEncerramentoMatricula.findUniqueOrThrow({ where: { id: d.id } });
      if (c.preparadorId === autor.id) throw new ErroRegra("Outra pessoa deve decidir a proposta."); if (c.status !== "PENDENTE") throw new ErroRegra("Esta versão já recebeu decisão.");
      if (d.aprovar) { const regras = RegrasEncerramentoSchema.parse(c.regras); await exigirFonte(tx, { matriculaId: c.matriculaId, documentoId: c.documentoId ?? undefined, artefatoContratualId: c.artefatoContratualId ?? undefined, processoAssinaturaId: c.processoAssinaturaId ?? undefined, regras, motivo: c.motivo }); }
      await tx.condicoesEncerramentoMatricula.update({ where: { id: c.id }, data: { status: d.aprovar ? "APROVADA" : "REJEITADA", decisorId: autor.id, decididaEm: new Date(), motivoDecisao: d.motivo } });
      await registrarEvento(tx, { tipo: "CondicoesEncerramentoDecididas", agregadoTipo: "Matricula", agregadoId: c.matriculaId, autorId: autor.id, payload: { condicoesId: c.id, aprovada: d.aprovar, motivo: d.motivo } });
    });
  });
}
