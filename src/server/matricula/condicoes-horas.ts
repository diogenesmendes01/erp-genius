"use server";
import { z } from "zod";
import { Papel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { RegrasHorasSchema } from "./condicoes-horas-schema";
import { carregarFusoInstitucionalTx } from "@/server/operacao/relogio";

export async function consultarCondicoesHoras(matriculaId: string) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO);
    const id = z.string().min(1).parse(matriculaId);
    return prisma.$transaction(async tx => {
      await exigirAutor(tx, autor.id, [Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO, Papel.ADMINISTRADOR]);
      const u = await tx.usuario.findUniqueOrThrow({ where: { id: autor.id }, select: { papeis: true } });
      const m = await tx.matricula.findUnique({ where: { id }, select: { codigo: true, moeda: true, contratoOk: true, confirmacaoContratoEm: true, contratoDocumentoId: true,
        preparacaoComercial: { select: { regime: true } } } });
      if (!m) throw new ErroRegra("Matrícula não encontrada.");
      const versoes = await tx.condicoesHorasMatricula.findMany({ where: { matriculaId: id }, orderBy: { versao: "desc" },
        select: { id: true, versao: true, regras: true, documentoId: true, status: true, motivo: true, motivoDecisao: true, criadaEm: true, decididaEm: true,
          preparador: { select: { id: true, nome: true } }, decisor: { select: { nome: true } } } });
      const fuso = await carregarFusoInstitucionalTx(tx);
      const impedimento = !m.contratoOk || !m.confirmacaoContratoEm || !m.contratoDocumentoId ? "Confirme o contrato da matrícula antes de preparar as condições."
        : m.preparacaoComercial && m.preparacaoComercial.regime !== "HORA_PARTICULAR" ? "Esta contratação não é por hora."
        : !fuso ? "Configure o fuso institucional antes de registrar a vigência." : null;
      return { matriculaId: id, codigo: m.codigo, moeda: m.moeda, documentoId: m.contratoDocumentoId, fuso, impedimento,
        podePreparar: !impedimento && !versoes.some(v => v.status === "PENDENTE") && u.papeis.some(p => p === Papel.SECRETARIA_ACADEMICA || p === Papel.ADMINISTRADOR),
        versoes: versoes.map(v => ({ ...v, regras: RegrasHorasSchema.safeParse(v.regras).success ? RegrasHorasSchema.parse(v.regras) : null,
          podeDecidir: v.status === "PENDENTE" && v.preparador.id !== autor.id && u.papeis.includes(Papel.ADMINISTRADOR),
          criadaEm: v.criadaEm.toISOString(), decididaEm: v.decididaEm?.toISOString() ?? null })) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}

async function exigirFonte(tx: Prisma.TransactionClient, matriculaId: string, documentoId: string, regras: unknown) {
  const m = await tx.matricula.findUnique({ where: { id: matriculaId } });
  if (!m?.contratoOk || !m.confirmacaoContratoEm || m.contratoDocumentoId !== documentoId) throw new ErroRegra("Use o contrato confirmado da matrícula.");
  await tx.$queryRaw`SELECT id FROM "Documento" WHERE id = ${documentoId} FOR SHARE`;
  const doc = await tx.documento.findFirst({ where: { id: documentoId, categoria: "CONTRATO", arquivado: false, OR: [{ matriculaId }, ...(m.leadId ? [{ leadId: m.leadId }] : [])] } });
  if (!doc) throw new ErroRegra("Documento contratual indisponível.");
  const r = RegrasHorasSchema.parse(regras);
  if (r.moeda !== m.moeda) throw new ErroRegra("A moeda precisa corresponder à matrícula.");
  const p = await tx.preparacaoComercialMatricula.findUnique({ where: { matriculaId }, select: { regime: true } });
  if (p && p.regime !== "HORA_PARTICULAR") throw new ErroRegra("Condições exigem contratação por hora.");
}
async function exigirAutor(tx: Prisma.TransactionClient, id: string, papeis: Papel[]) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${id} FOR SHARE`;
  const u = await tx.usuario.findUnique({ where: { id }, select: { ativo: true, papeis: true } });
  if (!u?.ativo || !u.papeis.some((p) => papeis.includes(p))) throw new ErroPermissao();
}
const Preparar = z.object({ matriculaId: z.string().min(1), documentoId: z.string().min(1), regras: RegrasHorasSchema, motivo: z.string().trim().min(5).max(2000) }).strict();
export async function prepararCondicoesHoras(input: z.input<typeof Preparar>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const d = Preparar.parse(input);
    return prisma.$transaction(async (tx) => {
      await bloquearMatriculas(tx, [d.matriculaId]);
      await exigirAutor(tx, autor.id, [Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR]);
      await exigirFonte(tx, d.matriculaId, d.documentoId, d.regras);
      if (await tx.condicoesHorasMatricula.count({ where: { matriculaId: d.matriculaId, status: "PENDENTE" } })) throw new ErroRegra("Já existe versão aguardando decisão.");
      const ultima = await tx.condicoesHorasMatricula.findFirst({ where: { matriculaId: d.matriculaId }, orderBy: { versao: "desc" }, select: { versao: true } });
      const c = await tx.condicoesHorasMatricula.create({ data: { ...d, versao: (ultima?.versao ?? 0) + 1, preparadorId: autor.id } });
      await registrarEvento(tx, { tipo: "CondicoesHorasPreparadas", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId: autor.id, payload: { condicoesId: c.id, versao: c.versao, documentoId: d.documentoId } });
      return { id: c.id, versao: c.versao };
    });
  });
}
export async function decidirCondicoesHoras(input: { id: string; aprovar: boolean; motivo: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const d = z.object({ id: z.string().min(1), aprovar: z.boolean(), motivo: z.string().trim().min(5).max(2000) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const ref = await tx.condicoesHorasMatricula.findUnique({ where: { id: d.id }, select: { matriculaId: true } });
      if (!ref) throw new ErroRegra("Versão não encontrada.");
      await bloquearMatriculas(tx, [ref.matriculaId]);
      await exigirAutor(tx, autor.id, [Papel.ADMINISTRADOR]);
      const c = await tx.condicoesHorasMatricula.findUniqueOrThrow({ where: { id: d.id } });
      if (c.preparadorId === autor.id) throw new ErroRegra("Outra pessoa deve decidir a proposta.");
      if (c.status !== "PENDENTE") throw new ErroRegra("Esta versão já recebeu decisão.");
      if (d.aprovar) await exigirFonte(tx, c.matriculaId, c.documentoId, c.regras);
      await tx.condicoesHorasMatricula.update({ where: { id: c.id }, data: { status: d.aprovar ? "APROVADA" : "REJEITADA", decisorId: autor.id, decididaEm: new Date(), motivoDecisao: d.motivo } });
      await registrarEvento(tx, { tipo: "CondicoesHorasDecididas", agregadoTipo: "Matricula", agregadoId: c.matriculaId, autorId: autor.id, payload: { condicoesId: c.id, aprovada: d.aprovar, motivo: d.motivo } });
    });
  });
}

