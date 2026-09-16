"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { hashPrevia } from "@/server/contratos/previa-estado";
import { conferirRemarcacaoParticularTx, RemarcacaoEntrada } from "./remarcacao-particular-estado";

async function bloquear(tx: Prisma.TransactionClient, encontroId: string, autorId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  const e = await tx.encontroAgenda.findUnique({ where: { id: encontroId }, select: { matriculaId: true } });
  if (!e?.matriculaId) throw new ErroRegra("Particular não encontrada.");
  await bloquearMatriculas(tx, [e.matriculaId]);
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autorId} FOR SHARE`;
  const u = await tx.usuario.findUnique({ where: { id: autorId }, select: { ativo: true, papeis: true } });
  if (!u?.ativo || !u.papeis.some(p => ["ADMINISTRADOR", "GERENTE_PEDAGOGICO", "SECRETARIA_ACADEMICA"].includes(p))) throw new ErroPermissao();
  await tx.$queryRaw`SELECT id FROM "EncontroAgenda" WHERE id = ${encontroId} FOR UPDATE`;
  return { matriculaId: e.matriculaId, gestao: u.papeis.some(p => p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR) };
}

export async function proporRemarcacaoParticular(input: z.input<typeof RemarcacaoEntrada>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO), d = RemarcacaoEntrada.parse(input);
    return prisma.$transaction(async tx => {
      const { matriculaId } = await bloquear(tx, d.encontroOriginalId, u.id);
      const anterior = await tx.propostaRemarcacaoParticular.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: u.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (anterior) {
        if (anterior.entradaHash !== hashPrevia(d)) throw new ErroRegra("Chave usada para outra proposta.");
        return { id: anterior.id };
      }
      if (await tx.decisaoRemarcacaoParticular.count({ where: { encontroOriginalId: d.encontroOriginalId, aprovada: true } })) throw new ErroRegra("O encontro já foi remarcado; consulte seu sucessor.");
      if (await tx.propostaRemarcacaoParticular.count({ where: { encontroOriginalId: d.encontroOriginalId, decisao: null } })) throw new ErroRegra("Já existe proposta aguardando decisão.");
      const estado = await conferirRemarcacaoParticularTx(tx, d);
      if (estado.pendencias.length) throw new ErroRegra(estado.pendencias.join(" "));
      const p = await tx.propostaRemarcacaoParticular.create({ data: { encontroOriginalId: d.encontroOriginalId, preparadorId: u.id, chaveIdempotencia: d.chaveIdempotencia, entrada: d, entradaHash: hashPrevia(d), estado: hashPrevia(estado) } });
      await registrarEvento(tx, { tipo: "RemarcacaoParticularProposta", agregadoTipo: "Matricula", agregadoId: matriculaId, autorId: u.id, payload: { propostaId: p.id, encontroOriginalId: d.encontroOriginalId, inicio: estado.inicio, fim: estado.fim, professorId: d.professorId } });
      return { id: p.id };
    });
  });
}

export async function decidirRemarcacaoParticular(input: { propostaId: string; aprovar: boolean; motivo: string }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ propostaId: z.string().min(1), aprovar: z.boolean(), motivo: z.string().trim().min(5).max(2000) }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const inicial = await tx.propostaRemarcacaoParticular.findUnique({ where: { id: d.propostaId } });
      if (!inicial) throw new ErroRegra("Proposta não encontrada.");
      const { matriculaId, gestao } = await bloquear(tx, inicial.encontroOriginalId, u.id);
      if (!gestao) throw new ErroPermissao();
      const p = await tx.propostaRemarcacaoParticular.findUniqueOrThrow({ where: { id: d.propostaId }, include: { decisao: true } });
      if (p.preparadorId === u.id) throw new ErroRegra("Outra pessoa deve aprovar a remarcação.");
      if (p.decisao) {
        if (p.decisao.decisorId !== u.id || p.decisao.aprovada !== d.aprovar || p.decisao.motivo !== d.motivo) throw new ErroRegra("Proposta já decidida.");
        return { id: p.decisao.id, encontroNovoId: p.decisao.encontroNovoId };
      }
      let encontroNovoId: string | null = null;
      if (d.aprovar) {
        if (await tx.decisaoRemarcacaoParticular.count({ where: { encontroOriginalId: p.encontroOriginalId, aprovada: true } })) throw new ErroRegra("O encontro já possui remarcação aprovada.");
        const entrada = RemarcacaoEntrada.parse(p.entrada);
        if (entrada.encontroOriginalId !== p.encontroOriginalId) throw new ErroRegra("Origem incompatível.");
        const estado = await conferirRemarcacaoParticularTx(tx, entrada);
        if (estado.pendencias.length) throw new ErroRegra(estado.pendencias.join(" "));
        if (p.estado !== hashPrevia(estado)) throw new ErroRegra("Os dados ou calendário mudaram. Rejeite e prepare nova proposta.");
        const novo = await tx.encontroAgenda.create({ data: { matriculaId, professorId: entrada.professorId, preparadorId: p.preparadorId, inicio: new Date(estado.inicio), fim: new Date(estado.fim), fusoOrigem: entrada.fuso, status: "PREVISTO", motivo: entrada.motivo, chaveIdempotencia: `remarcacao:${p.id}`, entradaHash: p.entradaHash } });
        encontroNovoId = novo.id;
      }
      const decisao = await tx.decisaoRemarcacaoParticular.create({ data: { propostaId: p.id, encontroOriginalId: p.encontroOriginalId, encontroNovoId, decisorId: u.id, aprovada: d.aprovar, motivo: d.motivo } });
      await registrarEvento(tx, { tipo: "RemarcacaoParticularDecidida", agregadoTipo: "Matricula", agregadoId: matriculaId, autorId: u.id, payload: { propostaId: p.id, decisaoId: decisao.id, encontroOriginalId: p.encontroOriginalId, encontroNovoId, aprovada: d.aprovar, motivo: d.motivo } });
      return { id: decisao.id, encontroNovoId };
    });
  });
}

export async function consultarRemarcacoesParticular(input: { encontroOriginalId: string }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ encontroOriginalId: z.string().min(1) }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const { gestao } = await bloquear(tx, d.encontroOriginalId, u.id);
      const propostas = await tx.propostaRemarcacaoParticular.findMany({ where: { encontroOriginalId: d.encontroOriginalId }, include: { decisao: true }, orderBy: { criadoEm: "desc" } });
      const e = await tx.encontroAgenda.findUniqueOrThrow({ where: { id: d.encontroOriginalId }, select: { fusoOrigem: true, status: true, inicio: true, fim: true } });
      const professores = await tx.usuario.findMany({ where: { ativo: true, papeis: { has: Papel.PROFESSOR } }, select: { id: true, nome: true }, orderBy: { nome: "asc" } });
      const itens = [];
      for (const p of propostas) {
        const entrada = RemarcacaoEntrada.parse(p.entrada);
        let conferencia: { inicio: string; fim: string; periodos: string[]; pendencias: string[] } | null = null;
        let erroConferencia: string | null = null;
        if (!p.decisao) {
          try {
            const atual = await conferirRemarcacaoParticularTx(tx, entrada);
            conferencia = { inicio: atual.inicio, fim: atual.fim, periodos: atual.periodosNaoLetivos, pendencias: [...atual.pendencias, ...(p.estado !== hashPrevia(atual) ? ["Dados alterados; prepare nova proposta."] : [])] };
          } catch (erro) { erroConferencia = erro instanceof Error ? erro.message : "Não foi possível conferir a proposta."; }
        }
        itens.push({ id: p.id, entrada, conferencia, erroConferencia, podeDecidir: gestao && p.preparadorId !== u.id && !p.decisao,
          decisao: p.decisao ? { aprovada: p.decisao.aprovada, motivo: p.decisao.motivo, encontroNovoId: p.decisao.encontroNovoId } : null });
      }
      return { fuso: e.fusoOrigem, duracaoMinutos: (e.fim.getTime() - e.inicio.getTime()) / 60000, professores,
        podePropor: e.status === "CANCELADO" && !propostas.some(p => !p.decisao || p.decisao.aprovada), propostas: itens };
    });
  });
}
