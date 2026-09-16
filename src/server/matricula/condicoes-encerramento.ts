"use server";
import { z } from "zod";
import { Papel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { RegrasEncerramentoSchema } from "./condicoes-encerramento-schema";

async function exigirFonte(tx: Prisma.TransactionClient, matriculaId: string, documentoId: string) {
  const m = await tx.matricula.findUnique({ where: { id: matriculaId } });
  if (!m?.contratoOk || !m.confirmacaoContratoEm || m.contratoDocumentoId !== documentoId) throw new ErroRegra("Use o contrato confirmado da matrícula.");
  await tx.$queryRaw`SELECT id FROM "Documento" WHERE id = ${documentoId} FOR SHARE`;
  const doc = await tx.documento.findFirst({ where: { id: documentoId, categoria: "CONTRATO", arquivado: false, OR: [{ matriculaId }, ...(m.leadId ? [{ leadId: m.leadId }] : [])] } });
  if (!doc) throw new ErroRegra("Documento contratual indisponível.");
}
async function exigirAutor(tx: Prisma.TransactionClient, id: string, papeis: Papel[]) {
  const u = await tx.usuario.findUnique({ where: { id }, select: { ativo: true, papeis: true } });
  if (!u?.ativo || !u.papeis.some((p) => papeis.includes(p))) throw new ErroPermissao();
}
const Preparar = z.object({ matriculaId: z.string().min(1), documentoId: z.string().min(1), regras: RegrasEncerramentoSchema, motivo: z.string().trim().min(5).max(2000) }).strict();
export async function prepararCondicoesEncerramento(input: z.input<typeof Preparar>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const d = Preparar.parse(input);
    return prisma.$transaction(async (tx) => {
      await bloquearMatriculas(tx, [d.matriculaId]);
      await exigirAutor(tx, autor.id, [Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR]);
      await exigirFonte(tx, d.matriculaId, d.documentoId);
      if (await tx.condicoesEncerramentoMatricula.count({ where: { matriculaId: d.matriculaId, status: "PENDENTE" } })) throw new ErroRegra("Já existe versão aguardando decisão.");
      const ultima = await tx.condicoesEncerramentoMatricula.findFirst({ where: { matriculaId: d.matriculaId }, orderBy: { versao: "desc" }, select: { versao: true } });
      const c = await tx.condicoesEncerramentoMatricula.create({ data: { ...d, versao: (ultima?.versao ?? 0) + 1, preparadorId: autor.id } });
      await registrarEvento(tx, { tipo: "CondicoesEncerramentoPreparadas", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId: autor.id, payload: { condicoesId: c.id, versao: c.versao, documentoId: d.documentoId } });
      return { id: c.id, versao: c.versao };
    });
  });
}
export async function decidirCondicoesEncerramento(input: { id: string; aprovar: boolean; motivo: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const d = z.object({ id: z.string().min(1), aprovar: z.boolean(), motivo: z.string().trim().min(5).max(2000) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const ref = await tx.condicoesEncerramentoMatricula.findUnique({ where: { id: d.id }, select: { matriculaId: true } });
      if (!ref) throw new ErroRegra("Versão não encontrada.");
      await bloquearMatriculas(tx, [ref.matriculaId]);
      await exigirAutor(tx, autor.id, [Papel.ADMINISTRADOR]);
      const c = await tx.condicoesEncerramentoMatricula.findUniqueOrThrow({ where: { id: d.id } });
      if (c.preparadorId === autor.id) throw new ErroRegra("Outra pessoa deve decidir a proposta.");
      if (c.status !== "PENDENTE") throw new ErroRegra("Esta versão já recebeu decisão.");
      if (d.aprovar) { await exigirFonte(tx, c.matriculaId, c.documentoId); RegrasEncerramentoSchema.parse(c.regras); }
      await tx.condicoesEncerramentoMatricula.update({ where: { id: c.id }, data: { status: d.aprovar ? "APROVADA" : "REJEITADA", decisorId: autor.id, decididaEm: new Date(), motivoDecisao: d.motivo } });
      await registrarEvento(tx, { tipo: "CondicoesEncerramentoDecididas", agregadoTipo: "Matricula", agregadoId: c.matriculaId, autorId: autor.id, payload: { condicoesId: c.id, aprovada: d.aprovar, motivo: d.motivo } });
    });
  });
}
