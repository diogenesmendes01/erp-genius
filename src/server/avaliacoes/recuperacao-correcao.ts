"use server";
import { createHash } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { bloquearLancamento } from "./lancamento-tx";
import { docenteAtual } from "@/server/diario/permissoes";
import { ConteudoRegraAvaliacaoSchema } from "./regra-schema";
import { conferirGestorAvaliacao } from "./regras-tx";
import { identificarMatriculaAvaliacao } from "./identificacao";
import { carregarImpactosProgressaoPorAproveitamentoTx } from "./impactos-progressao-tx";
import { registrarCasosRevisaoProgressaoTx } from "./casos-revisao-progressao-tx";

const id = z.string().min(1).max(100), motivo = z.string().trim().min(5).max(2000);
const propostaSchema = z.object({ notaId: id, origemId: id, nota: z.string().max(100).regex(/^-?\d+(\.\d+)?$/), comentarioAluno: z.string().trim().max(2000), motivo,
  versaoEsperada: z.number().int().min(0).max(2147483646), chaveIdempotencia: z.string().min(8).max(100) }).strict();
const decisaoSchema = z.object({ propostaId: id, propostaHash: z.string().regex(/^[a-f0-9]{64}$/), impactosHash: z.string().regex(/^[a-f0-9]{64}$/), aprovada: z.boolean(), motivo }).strict();
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");

async function carregar(tx: Prisma.TransactionClient, usuarioId: string, notaId: string) {
  const ref = await tx.notaRecuperacao.findUnique({ where: { id: notaId }, select: { realizacao: { select: { itemReserva: { select: { reserva: { select: { proposta: { select: { alocacaoId: true } } } } } } } } } });
  if (!ref) throw new ErroRegra("Nota não encontrada.");
  const a = await bloquearLancamento(tx, ref.realizacao.itemReserva.reserva.proposta.alocacaoId);
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuarioId} FOR SHARE`;
  const u = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { ativo: true, papeis: true } });
  const t = await tx.turma.findUniqueOrThrow({ where: { id: a.turmaId }, include: { vinculosDocentes: true } });
  if (!u?.ativo || !(u.papeis.some(p => p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR) || (u.papeis.includes(Papel.PROFESSOR) && docenteAtual(usuarioId, t)))) throw new ErroPermissao();
  const n = await tx.notaRecuperacao.findUniqueOrThrow({ where: { id: notaId }, include: { decisao: true, realizacao: { include: { itemReserva: { include: { reserva: { include: { proposta: { include: { regra: true } } } } } } } } } });
  if (!n.decisao?.aprovada || n.nota === null) throw new ErroRegra("A correção exige uma nota oficializada.");
  const aplicada = await tx.propostaCorrecaoRecuperacao.findFirst({ where: { notaId, decisao: { aprovada: true } }, orderBy: { versao: "desc" } });
  const ultima = await tx.propostaCorrecaoRecuperacao.findFirst({ where: { notaId }, orderBy: { versao: "desc" } });
  return { a, n, vigente: { origemId: aplicada?.id ?? n.id, nota: aplicada?.nota ?? n.nota, comentarioAluno: aplicada?.comentarioAluno ?? n.comentarioAluno }, versao: ultima?.versao ?? 0, ultimaId: ultima?.id };
}

export async function consultarBaseCorrecaoRecuperacao(notaId: string) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    return prisma.$transaction(async tx => {
      const r = await carregar(tx, u.id, id.parse(notaId));
      return { notaId: r.n.id, ...r.vigente, versaoEsperada: r.versao, escala: ConteudoRegraAvaliacaoSchema.parse(r.n.realizacao.itemReserva.reserva.proposta.regra.conteudo).escala };
    });
  });
}

export async function consultarCorrecoesRecuperacao(input: { notaId: string; antesVersao?: number }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ notaId: id, antesVersao: z.number().int().positive().optional() }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const r = await carregar(tx, u.id, d.notaId);
      const usuario = await tx.usuario.findUniqueOrThrow({ where: { id: u.id }, select: { papeis: true } });
      const gestao = usuario.papeis.some(p => p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR);
      const propostas = await tx.propostaCorrecaoRecuperacao.findMany({ where: { notaId: d.notaId, ...(d.antesVersao ? { versao: { lt: d.antesVersao } } : {}) }, orderBy: { versao: "desc" }, take: 21,
        select: { id: true, versao: true, origemId: true, nota: true, comentarioAluno: true, motivo: true, criadaEm: true, autorId: true, autor: { select: { nome: true } }, decisao: { select: { aprovada: true, motivo: true, criadaEm: true, decisor: { select: { nome: true } } } } } });
      return { identificacao: await identificarMatriculaAvaliacao(tx, r.a.matriculaId, r.a.turmaId), habilidade: r.n.realizacao.itemReserva.habilidade,
        realizacaoId: r.n.realizacaoId, notaId: r.n.id, original: { nota: r.n.nota, comentarioAluno: r.n.comentarioAluno }, vigente: r.vigente, versaoEsperada: r.versao,
        escala: ConteudoRegraAvaliacaoSchema.parse(r.n.realizacao.itemReserva.reserva.proposta.regra.conteudo).escala,
        proximaAntesVersao: propostas.length > 20 ? propostas[19].versao : null,
        propostas: propostas.slice(0,20).map(p => ({ id: p.id, versao: p.versao, nota: p.nota, comentarioAluno: p.comentarioAluno, motivo: p.motivo, criadaEm: p.criadaEm.toISOString(), autor: p.autor.nome,
          podeRevisar: gestao && p.autorId !== u.id && !p.decisao,
          decisao: p.decisao ? { ...p.decisao, criadaEm: p.decisao.criadaEm.toISOString() } : null })) };
    });
  });
}

export async function proporCorrecaoRecuperacao(input: z.input<typeof propostaSchema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO), d = propostaSchema.parse(input);
    return prisma.$transaction(async tx => {
      const r = await carregar(tx, u.id, d.notaId), entradaHash = hash(d);
      const repetida = await tx.propostaCorrecaoRecuperacao.findUnique({ where: { autorId_chaveIdempotencia: { autorId: u.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (repetida) {
        if (repetida.entradaHash !== entradaHash) throw new ErroRegra("Chave utilizada com outra proposta.");
        return { id: repetida.id, versao: repetida.versao };
      }
      if (d.origemId !== r.vigente.origemId || d.versaoEsperada !== r.versao) throw new ErroRegra("Confira novamente a nota vigente e a versão da proposta.");
      const regra = ConteudoRegraAvaliacaoSchema.parse(r.n.realizacao.itemReserva.reserva.proposta.regra.conteudo), nota = new Prisma.Decimal(d.nota);
      if (nota.lt(regra.escala.minimo) || nota.gt(regra.escala.maximo)) throw new ErroRegra("Nota fora da escala aplicada.");
      if (nota.eq(r.vigente.nota) && d.comentarioAluno === r.vigente.comentarioAluno) throw new ErroRegra("Informe uma alteração de nota ou comentário.");
      const p = await tx.propostaCorrecaoRecuperacao.create({ data: { notaId: d.notaId, origemId: d.origemId, nota: d.nota, comentarioAluno: d.comentarioAluno, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, versao: d.versaoEsperada + 1, autorId: u.id, entradaHash } });
      await registrarEvento(tx, { tipo: "CorrecaoRecuperacaoProposta", agregadoTipo: "Matricula", agregadoId: r.a.matriculaId, autorId: u.id, payload: { propostaId: p.id, notaId: p.notaId, versao: p.versao } });
      return { id: p.id, versao: p.versao };
    });
  });
}

async function revisar(tx: Prisma.TransactionClient, usuarioId: string, propostaId: string) {
  const ref = await tx.propostaCorrecaoRecuperacao.findUnique({ where: { id: propostaId }, select: { notaId: true } });
  if (!ref) throw new ErroRegra("Proposta não encontrada.");
  const r = await carregar(tx, usuarioId, ref.notaId);
  await conferirGestorAvaliacao(tx, usuarioId);
  const p = await tx.propostaCorrecaoRecuperacao.findUniqueOrThrow({ where: { id: propostaId }, include: { decisao: true } });
  const mudancas = await carregarImpactosProgressaoPorAproveitamentoTx(tx, {
    matriculaId: r.a.matriculaId,
    alocacaoOrigemId: r.a.id,
  });
  const planos = await tx.propostaPlanoRecuperacao.findMany({ where: { alocacaoId: r.a.id, decisao: { aprovada: true } }, orderBy: { id: "asc" }, select: { id: true, entradaHash: true } });
  const impactos = { mudancas, planos };
  return { r, p, impactos, impactosHash: hash(impactos), podeAprovar: !p.decisao && p.autorId !== usuarioId && p.id === r.ultimaId && p.origemId === r.vigente.origemId };
}

export async function revisarCorrecaoRecuperacao(propostaId: string) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    return prisma.$transaction(async tx => {
      const v = await revisar(tx, u.id, id.parse(propostaId));
      return { propostaId: v.p.id, propostaHash: v.p.entradaHash, anterior: v.r.vigente, proposta: { nota: v.p.nota, comentarioAluno: v.p.comentarioAluno, motivo: v.p.motivo }, impactos: v.impactos, impactosHash: v.impactosHash, podeAprovar: v.podeAprovar };
    });
  });
}

export async function decidirCorrecaoRecuperacao(input: z.input<typeof decisaoSchema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = decisaoSchema.parse(input);
    return prisma.$transaction(async tx => {
      const v = await revisar(tx, u.id, d.propostaId), p = v.p;
      if (p.autorId === u.id) throw new ErroRegra("Outra pessoa deve decidir a correção.");
      if (p.entradaHash !== d.propostaHash) throw new ErroRegra("Confira o conteúdo exato da proposta.");
      if (p.decisao) {
        if (p.decisao.decisorId === u.id && p.decisao.aprovada === d.aprovada && p.decisao.motivo === d.motivo) return { id: p.decisao.id, aplicada: p.decisao.aprovada };
        throw new ErroRegra("Proposta já decidida.");
      }
      if (d.aprovada && (!v.podeAprovar || v.impactosHash !== d.impactosHash)) throw new ErroRegra("Proposta ou impactos desatualizados. Confira novamente.");
      const decisao = await tx.decisaoCorrecaoRecuperacao.create({ data: { propostaId: p.id, decisorId: u.id, aprovada: d.aprovada, motivo: d.motivo, impactos: v.impactos } });
      if (d.aprovada) await registrarCasosRevisaoProgressaoTx(tx, {
        matriculaId: v.r.a.matriculaId, alocacaoFonteId: v.r.a.id,
        origem: { tipo: "RECUPERACAO", decisaoId: decisao.id }, impactos: v.impactos.mudancas,
      });
      await registrarEvento(tx, { tipo: d.aprovada ? "CorrecaoRecuperacaoAplicada" : "CorrecaoRecuperacaoRejeitada", agregadoTipo: "Matricula", agregadoId: v.r.a.matriculaId, autorId: u.id, payload: { propostaId: p.id, decisaoId: decisao.id, notaId: p.notaId } });
      if (d.aprovada && v.impactos.mudancas.length) await registrarEvento(tx, { tipo: "CorrecaoRecuperacaoRevisaoNecessaria", agregadoTipo: "Matricula", agregadoId: v.r.a.matriculaId, autorId: u.id, payload: { decisaoId: decisao.id, solicitacoes: v.impactos.mudancas.map(m => m.id) } });
      return { id: decisao.id, aplicada: d.aprovada };
    });
  });
}
