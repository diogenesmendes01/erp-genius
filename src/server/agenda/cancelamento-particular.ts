"use server";
import { createHash } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";

const papeis = [Papel.PROFESSOR, Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO];
const motivo = z.string().trim().min(5).max(2000);
const hash = (valor: unknown) => createHash("sha256").update(JSON.stringify(valor)).digest("hex");

async function contexto(tx: Prisma.TransactionClient, encontroId: string, autorId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  const inicial = await tx.encontroAgenda.findUnique({ where: { id: encontroId }, select: { matriculaId: true } });
  if (!inicial?.matriculaId) throw new ErroRegra("Escolha um encontro particular contratado.");
  await bloquearMatriculas(tx, [inicial.matriculaId]);
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autorId} FOR SHARE`;
  const u = await tx.usuario.findUnique({ where: { id: autorId }, select: { ativo: true, papeis: true } });
  if (!u?.ativo) throw new ErroPermissao();
  const gestao = u.papeis.some(p => p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR);
  await tx.$queryRaw`SELECT id FROM "EncontroAgenda" WHERE id = ${encontroId} FOR UPDATE`;
  const e = await tx.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId }, include: { diario: { select: { id: true } }, reservasHoras: { include: { consumo: true } } } });
  if (e.finalidade !== "AULA") throw new ErroRegra("Recuperação exige seu próprio fluxo de cancelamento.");
  if (e.matriculaId !== inicial.matriculaId || e.turmaId) throw new ErroRegra("O vínculo do encontro mudou.");
  if (!gestao && !u.papeis.includes(Papel.SECRETARIA_ACADEMICA) && !(u.papeis.includes(Papel.PROFESSOR) && e.professorId === autorId)) throw new ErroPermissao();
  return { e, gestao };
}

function estado(e: Awaited<ReturnType<typeof contexto>>["e"]) {
  return hash({ matriculaId: e.matriculaId, professorId: e.professorId, inicio: e.inicio, fim: e.fim, fuso: e.fusoOrigem, status: e.status,
    diarioId: e.diario?.id ?? null, reservas: e.reservasHoras.map(r => ({ id: r.id, consumoId: r.consumo?.id ?? null })).sort((a, b) => a.id.localeCompare(b.id)) });
}

function conferir(e: Awaited<ReturnType<typeof contexto>>["e"]) {
  if (e.status !== "PREVISTO") throw new ErroRegra("O cancelamento exige encontro previsto.");
  if (e.diario || e.reservasHoras.some(r => r.consumo)) throw new ErroRegra("Há diário ou consumo registrado. Regularize esses registros pelo fluxo de correção antes do cancelamento.");
}

export async function proporCancelamentoParticular(input: { encontroId: string; motivo: string; chaveIdempotencia: string; origem?: "ESCOLA" | "ALUNO" }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(...papeis);
    const d = z.object({ encontroId: z.string().min(1), motivo, chaveIdempotencia: z.string().min(8).max(100), origem: z.enum(["ESCOLA", "ALUNO"]).optional() }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const { e } = await contexto(tx, d.encontroId, u.id);
      const anterior = await tx.propostaCancelamentoParticular.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: u.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (anterior) {
        if (anterior.entradaHash !== hash(d)) throw new ErroRegra("Chave utilizada para outra solicitação.");
        return { id: anterior.id };
      }
      conferir(e);
      if (await tx.propostaCancelamentoParticular.count({ where: { encontroId: e.id, decisao: null } })) throw new ErroRegra("Já existe uma solicitação aguardando decisão para este encontro.");
      const p = await tx.propostaCancelamentoParticular.create({ data: { ...d, preparadorId: u.id, entradaHash: hash(d), estado: estado(e) } });
      await registrarEvento(tx, { tipo: "CancelamentoParticularProposto", agregadoTipo: "Matricula", agregadoId: e.matriculaId!, autorId: u.id, payload: { propostaId: p.id, encontroId: e.id, motivo: d.motivo } });
      return { id: p.id };
    });
  });
}

export async function decidirCancelamentoParticular(input: { propostaId: string; aprovar: boolean; motivo: string }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ propostaId: z.string().min(1), aprovar: z.boolean(), motivo }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const inicial = await tx.propostaCancelamentoParticular.findUnique({ where: { id: d.propostaId } });
      if (!inicial) throw new ErroRegra("Solicitação não encontrada.");
      const { e, gestao } = await contexto(tx, inicial.encontroId, u.id);
      if (!gestao) throw new ErroPermissao();
      const p = await tx.propostaCancelamentoParticular.findUniqueOrThrow({ where: { id: d.propostaId }, include: { decisao: true } });
      if (p.preparadorId === u.id) throw new ErroRegra("Outra pessoa deve decidir a solicitação, mesmo acumulando papéis.");
      if (p.decisao) {
        if (p.decisao.decisorId !== u.id || p.decisao.aprovada !== d.aprovar || p.decisao.motivo !== d.motivo) throw new ErroRegra("A solicitação já foi decidida.");
        return { id: p.decisao.id, aplicada: p.decisao.aprovada };
      }
      if (d.aprovar) {
        conferir(e);
        if (p.estado !== estado(e)) throw new ErroRegra("A agenda ou a reserva de horas mudou. Rejeite e prepare nova solicitação.");
      }
      const decisao = await tx.decisaoCancelamentoParticular.create({ data: { propostaId: p.id, decisorId: u.id, aprovada: d.aprovar, motivo: d.motivo } });
      if (d.aprovar) await tx.encontroAgenda.update({ where: { id: e.id }, data: { status: "CANCELADO" } });
      await registrarEvento(tx, { tipo: "CancelamentoParticularDecidido", agregadoTipo: "Matricula", agregadoId: e.matriculaId!, autorId: u.id,
        payload: { propostaId: p.id, decisaoId: decisao.id, encontroId: e.id, aprovada: d.aprovar, motivo: d.motivo, reservasHorasIds: e.reservasHoras.map(r => r.id), acertoFinanceiroAutomatico: false } });
      return { id: decisao.id, aplicada: d.aprovar };
    });
  });
}

export async function consultarCancelamentoParticular(input: { encontroId: string }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(...papeis);
    const d = z.object({ encontroId: z.string().min(1) }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const { e, gestao } = await contexto(tx, d.encontroId, u.id);
      const propostas = await tx.propostaCancelamentoParticular.findMany({ where: { encontroId: e.id }, orderBy: { criadoEm: "desc" },
        select: { id: true, origem: true, preparadorId: true, motivo: true, criadoEm: true, decisao: { select: { aprovada: true, motivo: true, decididaEm: true } } } });
      return { status: e.status, inicio: e.inicio.toISOString(), fuso: e.fusoOrigem,
        podePropor: e.status === "PREVISTO" && !e.diario && !e.reservasHoras.some(r => r.consumo) && !propostas.some(p => !p.decisao),
        propostas: propostas.map(p => ({ id: p.id, origem: p.origem, motivo: p.motivo, criadoEm: p.criadoEm.toISOString(), podeDecidir: gestao && p.preparadorId !== u.id && !p.decisao,
          decisao: p.decisao ? { ...p.decisao, decididaEm: p.decisao.decididaEm.toISOString() } : null })) };
    });
  });
}

