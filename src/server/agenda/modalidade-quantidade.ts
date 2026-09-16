"use server";

import { createHash } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { confirmarTransacao } from "@/lib/transacao-confirmada";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { carregarPreviaQuantidadeAulasTx } from "./modalidade-quantidade-tx";
import { carregarGradeInicialTx } from "./grade-turma-tx";

const texto = z.string().trim().min(5).max(2000);
const chave = z.string().trim().min(8).max(100);
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const Preparar = z.object({ modalidadeId: z.string().min(1), quantidadeNova: z.number().int().positive(), versaoAnterior: z.number().int().nonnegative(), motivo: texto, chaveIdempotencia: chave }).strict();
const Decidir = z.object({ propostaId: z.string().min(1), aprovar: z.boolean(), motivo: texto }).strict();

async function usuarioAtualTx(tx: Prisma.TransactionClient, id: string, decisor = false) {
  const usuario = await tx.usuario.findUnique({ where: { id }, select: { ativo: true, papeis: true } });
  const papeis = decisor ? ["GERENTE_PEDAGOGICO", "ADMINISTRADOR"] : ["SECRETARIA_ACADEMICA", "GERENTE_PEDAGOGICO", "ADMINISTRADOR"];
  if (!usuario?.ativo || !usuario.papeis.some((p) => papeis.includes(p))) throw new ErroPermissao();
  return usuario;
}

/** Registra uma revisão completa. Não publica a modalidade, agenda ou grade. */
export async function prepararAlteracaoQuantidadeAulasModalidade(input: z.input<typeof Preparar>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
    const d = Preparar.parse(input), entradaHash = hash(d);
    return prisma.$transaction(confirmarTransacao(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'modalidade-quantidade:' + d.modalidadeId}, 0))`;
      await usuarioAtualTx(tx, autor.id);
      const repetida = await tx.propostaQuantidadeAulasModalidade.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (repetida) {
        if (repetida.entradaHash !== entradaHash) throw new ErroRegra("Chave usada para outra proposta de quantidade.");
        return { id: repetida.id, versao: repetida.versao };
      }
      await tx.$queryRaw`SELECT id FROM "Modalidade" WHERE id=${d.modalidadeId} FOR UPDATE`;
      const ultima = await tx.propostaQuantidadeAulasModalidade.findFirst({ where: { modalidadeId: d.modalidadeId }, orderBy: { versao: "desc" }, select: { versao: true } });
      if ((ultima?.versao ?? 0) !== d.versaoAnterior) throw new ErroRegra("A modalidade possui outra revisão; atualize a prévia.");
      const previa = await carregarPreviaQuantidadeAulasTx(tx, { modalidadeId: d.modalidadeId, quantidadeNova: d.quantidadeNova });
      const p = await tx.propostaQuantidadeAulasModalidade.create({ data: {
        modalidadeId: d.modalidadeId, preparadorId: autor.id, versao: d.versaoAnterior + 1,
        quantidadeAnterior: previa.quantidadeAnterior, quantidadeNova: d.quantidadeNova, motivo: d.motivo,
        chaveIdempotencia: d.chaveIdempotencia, entradaHash, estadoHash: previa.estadoHash,
        snapshot: JSON.parse(JSON.stringify({ ...previa, impactos: previa.impactos.map(({ previsao, ...i }) => ({ ...i, quantidadeAnterior: i.quantidadeVigente })) }) as string) as Prisma.InputJsonValue,
        impactos: { create: previa.impactos.map((i) => ({ turmaId: i.turmaId, alcance: i.alcance, quantidadeAnterior: i.quantidadeVigente,
          quantidadeNova: i.quantidadeNova, iniciadaEm: i.iniciadaEm ? new Date(i.iniciadaEm) : null, publicada: i.publicada,
          excecoesQ37: i.excecoesQ37, snapshot: JSON.parse(JSON.stringify({ agendaAntes: i.agendaAntes, agendaDepois: i.agendaDepois, causa: i.causa, pendencias: i.pendencias, parametrosGradeAprovada: i.parametrosGradeAprovada })) as Prisma.InputJsonValue })) },
      } });
      await registrarEvento(tx, { tipo: "QuantidadeAulasModalidadePreparada", agregadoTipo: "Modalidade", agregadoId: p.modalidadeId, autorId: autor.id,
        payload: { propostaId: p.id, versao: p.versao, quantidadeAnterior: p.quantidadeAnterior, quantidadeNova: p.quantidadeNova } });
      return { id: p.id, versao: p.versao };
    }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
  });
}

/** Aprovação independente já materializa o conjunto; não existe etapa pública posterior. */
export async function decidirAlteracaoQuantidadeAulasModalidade(input: z.input<typeof Decidir>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = Decidir.parse(input);
    return prisma.$transaction(confirmarTransacao(async (tx) => {
      const p = await tx.propostaQuantidadeAulasModalidade.findUnique({ where: { id: d.propostaId }, include: { decisao: true, aplicacao: true } });
      if (!p) throw new ErroRegra("Proposta de quantidade não encontrada.");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'modalidade-quantidade:' + p.modalidadeId}, 0))`;
      await usuarioAtualTx(tx, autor.id, true);
      if (p.preparadorId === autor.id) throw new ErroRegra("Outra pessoa deve decidir a alteração de quantidade.");
      if (p.decisao) {
        if (p.decisao.decisorId === autor.id && p.decisao.aprovada === d.aprovar && p.decisao.motivo === d.motivo) return { id: p.decisao.id, aprovada: p.decisao.aprovada, aplicada: !!p.aplicacao };
        throw new ErroRegra("A proposta já possui decisão.");
      }
      if (!d.aprovar) {
        const decisao = await tx.decisaoQuantidadeAulasModalidade.create({ data: { propostaId: p.id, decisorId: autor.id, aprovada: false, motivo: d.motivo, estadoHash: p.estadoHash } });
        await tx.propostaQuantidadeAulasModalidade.update({ where: { id: p.id }, data: { situacao: "REJEITADA" } });
        await registrarEvento(tx, { tipo: "QuantidadeAulasModalidadeDecidida", agregadoTipo: "Modalidade", agregadoId: p.modalidadeId, autorId: autor.id, payload: { propostaId: p.id, aprovada: false } });
        return { id: decisao.id, aprovada: false, aplicada: false };
      }
      const ultima = await tx.propostaQuantidadeAulasModalidade.findFirst({ where: { modalidadeId: p.modalidadeId }, orderBy: { versao: "desc" }, select: { id: true } });
      if (ultima?.id !== p.id) throw new ErroRegra("Existe versão mais recente da revisão.");
      const atual = await carregarPreviaQuantidadeAulasTx(tx, { modalidadeId: p.modalidadeId, quantidadeNova: p.quantidadeNova });
      if (atual.estadoHash !== p.estadoHash || !atual.podeAplicar) throw new ErroRegra("O conjunto material mudou ou ainda possui conflitos; prepare nova revisão.");
      await tx.$queryRaw`SELECT id FROM "Turma" WHERE "modalidadeId"=${p.modalidadeId} ORDER BY id FOR UPDATE`;
      const decisao = await tx.decisaoQuantidadeAulasModalidade.create({ data: { propostaId: p.id, decisorId: autor.id, aprovada: true, motivo: d.motivo, estadoHash: p.estadoHash } });
      await tx.propostaQuantidadeAulasModalidade.update({ where: { id: p.id }, data: { situacao: "APROVADA" } });
      await tx.modalidade.update({ where: { id: p.modalidadeId }, data: { aulasPorNivel: p.quantidadeNova } });
      for (const impacto of atual.impactos.filter((i) => !i.preservada && i.previsao)) {
        // Rascunho recebe uma nova versão de grade, sem criar encontro de
        // agenda. A publicação normal continuará a consumir essa versão.
        if (!impacto.publicada) {
          const origem = impacto.propostaGradeId ? await tx.propostaGradeTurma.findUnique({ where: { id: impacto.propostaGradeId } }) : null;
          if (!origem) throw new ErroRegra("Rascunho sem proposta de grade de origem; confira antes de aplicar.");
          const ultimo = await tx.propostaGradeTurma.findFirst({ where: { turmaId: impacto.turmaId }, orderBy: { versao: "desc" }, select: { versao: true } });
          const snapshot = await carregarGradeInicialTx(tx, { turmaId: impacto.turmaId, fusoOrigem: origem.fusoOrigem });
          await tx.propostaGradeTurma.create({ data: { turmaId: impacto.turmaId, calendarioId: origem.calendarioId, preparadorId: p.preparadorId, versao: (ultimo?.versao ?? 0) + 1, fusoOrigem: origem.fusoOrigem, motivo: p.motivo, chaveIdempotencia: `quantidade-rascunho:${p.id}:${impacto.turmaId}`, entradaHash: hash({ propostaId: p.id, turmaId: impacto.turmaId, quantidade: impacto.quantidadeNova }), snapshot: snapshot as Prisma.InputJsonValue } });
          continue;
        }
        for (const encontro of impacto.previsao!.propostas) {
          const existente = impacto.agendaAntes.find((e) => e.id === encontro.encontroId)!;
          const r = await tx.encontroAgenda.updateMany({ where: { id: encontro.encontroId, status: existente.status, inicio: new Date(encontro.inicioAnterior), fim: new Date(encontro.fimAnterior), professorId: existente.professorId ?? undefined }, data: { inicio: new Date(encontro.inicioProposto), fim: new Date(encontro.fimProposto), motivo: p.motivo } });
          if (r.count !== 1) throw new ErroRegra("Um encontro mudou durante a aplicação; prepare nova revisão.");
        }
        for (const encontro of impacto.previsao!.removidos ?? []) await tx.encontroAgenda.update({ where: { id: encontro.encontroId }, data: { status: "CANCELADO", motivo: p.motivo } });
        for (const [indice, encontro] of (impacto.previsao!.adicionados ?? []).entries()) await tx.encontroAgenda.create({ data: { turmaId: impacto.turmaId, professorId: impacto.professorId, propostaGradeId: impacto.propostaGradeId, preparadorId: p.preparadorId, inicio: new Date(encontro.inicioProposto), fim: new Date(encontro.fimProposto), fusoOrigem: impacto.fusoOrigem!, status: impacto.publicada ? "PREVISTO" : "RASCUNHO", motivo: p.motivo, chaveIdempotencia: `quantidade:${p.id}:${impacto.turmaId}:${indice}`, entradaHash: hash({ propostaId: p.id, turmaId: impacto.turmaId, indice, encontro }) } });
      }
      const aplicacao = await tx.aplicacaoQuantidadeAulasModalidade.create({ data: { propostaId: p.id, aplicadorId: autor.id, estadoHash: p.estadoHash } });
      await tx.propostaQuantidadeAulasModalidade.update({ where: { id: p.id }, data: { situacao: "APLICADA" } });
      await registrarEvento(tx, { tipo: "QuantidadeAulasModalidadeAplicada", agregadoTipo: "Modalidade", agregadoId: p.modalidadeId, autorId: autor.id, payload: { propostaId: p.id, decisaoId: decisao.id, aplicacaoId: aplicacao.id, quantidadeAnterior: p.quantidadeAnterior, quantidadeNova: p.quantidadeNova, motivo: d.motivo } });
      return { id: decisao.id, aprovada: true, aplicada: true };
    }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
  });
}
