"use server";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { conferirCancelamentoFinanceiroDesistenciaTx } from "./desistencia-financeira-tx";

const identificador = z.string().trim().min(1).max(100);
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const motivoSchema = z.string().trim().min(10).max(3000);
const propostaSchema = z.object({ pedidoId: identificador, estadoHash: hashSchema, motivo: motivoSchema,
  evidenciaCondicoes: motivoSchema, chaveIdempotencia: z.string().trim().min(8).max(100) }).strict();
const decisaoSchema = z.object({ propostaId: identificador, propostaHash: hashSchema, aprovada: z.boolean(), motivo: motivoSchema }).strict();
const hash = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex");

async function travarContexto(tx: Prisma.TransactionClient, pedidoId: string, autorId: string, decidir: boolean) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  const pedido = await tx.pedidoDesistenciaPreparacao.findUnique({ where: { id: pedidoId }, select: { matriculaId: true } });
  if (!pedido) throw new ErroRegra("Pedido de desistência não encontrado.");
  await bloquearMatriculas(tx, [pedido.matriculaId]);
  await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE "matriculaId"=${pedido.matriculaId} ORDER BY id FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${autorId} FOR SHARE`;
  const usuario = await tx.usuario.findUnique({ where: { id: autorId }, select: { ativo: true, papeis: true, permissoes: true } });
  if (!usuario?.ativo || !(usuario.papeis.includes(Papel.ADMINISTRADOR) ||
      (usuario.papeis.includes(Papel.FINANCEIRO) && (!decidir || usuario.permissoes.includes("financeiro.aprovar_acertos"))))) throw new ErroPermissao();
  return pedido.matriculaId;
}

export async function proporCancelamentoFinanceiroDesistenciaPreparacao(input: z.input<typeof propostaSchema>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const dados = propostaSchema.parse(input), entradaHash = hash(dados);
    return prisma.$transaction(async tx => {
      const matriculaId = await travarContexto(tx, dados.pedidoId, autor.id, false);
      const existente = await tx.propostaFinanceiraDesistencia.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: dados.chaveIdempotencia } } });
      if (existente) {
        if (existente.entradaHash !== entradaHash) throw new ErroRegra("Chave já usada para outra proposta financeira.");
        return { id: existente.id, entradaHash: existente.entradaHash };
      }
      if (await tx.efetivacaoPedidoDesistenciaPreparacao.findUnique({ where: { matriculaId }, select: { id: true } })) throw new ErroRegra("A desistência já foi efetivada.");
      const estado = await conferirCancelamentoFinanceiroDesistenciaTx(tx, dados.pedidoId, dados.estadoHash);
      const ultima = await tx.propostaFinanceiraDesistencia.findFirst({ where: { pedidoId: dados.pedidoId }, orderBy: { versao: "desc" }, select: { versao: true } });
      const proposta = await tx.propostaFinanceiraDesistencia.create({ data: {
        pedidoId: dados.pedidoId, preparadorId: autor.id, versao: (ultima?.versao ?? 0) + 1,
        motivo: dados.motivo, evidenciaCondicoes: dados.evidenciaCondicoes, chaveIdempotencia: dados.chaveIdempotencia,
        entradaHash, estadoHash: dados.estadoHash, snapshot: { fotografia: estado.fotografia, fotografiaHash: estado.fotografiaHash },
      } });
      await registrarEvento(tx, { tipo: "CancelamentoFinanceiroDesistenciaProposto", agregadoTipo: "Matricula", agregadoId: matriculaId, autorId: autor.id,
        payload: { pedidoId: dados.pedidoId, propostaId: proposta.id, versao: proposta.versao } });
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
      return { id: proposta.id, entradaHash: proposta.entradaHash };
    });
  });
}

export async function decidirCancelamentoFinanceiroDesistenciaPreparacao(input: z.input<typeof decisaoSchema>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO), dados = decisaoSchema.parse(input);
    return prisma.$transaction(async tx => {
      const referencia = await tx.propostaFinanceiraDesistencia.findUnique({ where: { id: dados.propostaId }, select: { pedidoId: true } });
      if (!referencia) throw new ErroRegra("Proposta financeira não encontrada.");
      const matriculaId = await travarContexto(tx, referencia.pedidoId, autor.id, true);
      const proposta = await tx.propostaFinanceiraDesistencia.findUniqueOrThrow({ where: { id: dados.propostaId } });
      if (proposta.preparadorId === autor.id) throw new ErroRegra("Outra pessoa autorizada deve decidir a proposta.");
      if (proposta.entradaHash !== dados.propostaHash) throw new ErroRegra("A proposta diverge da versão conferida.");
      const existente = await tx.decisaoFinanceiraDesistencia.findUnique({ where: { propostaId: proposta.id } });
      if (existente) {
        if (existente.decisorId !== autor.id || existente.aprovada !== dados.aprovada || existente.motivo !== dados.motivo) throw new ErroRegra("A proposta já possui outra decisão.");
        return { id: existente.id, aprovada: existente.aprovada };
      }
      if (await tx.efetivacaoPedidoDesistenciaPreparacao.findUnique({ where: { matriculaId }, select: { id: true } })) throw new ErroRegra("A desistência já foi efetivada.");
      if (dados.aprovada) {
        const ultima = await tx.propostaFinanceiraDesistencia.findFirst({ where: { pedidoId: proposta.pedidoId }, orderBy: { versao: "desc" }, select: { id: true } });
        if (ultima?.id !== proposta.id) throw new ErroRegra("Confira a proposta financeira mais recente.");
        const atual = await conferirCancelamentoFinanceiroDesistenciaTx(tx, proposta.pedidoId, proposta.estadoHash);
        if (!isDeepStrictEqual(proposta.snapshot, { fotografia: atual.fotografia, fotografiaHash: atual.fotografiaHash })) throw new ErroRegra("As cobranças mudaram; prepare nova conferência financeira.");
      }
      const decisao = await tx.decisaoFinanceiraDesistencia.create({ data: { propostaId: proposta.id, decisorId: autor.id, aprovada: dados.aprovada, motivo: dados.motivo } });
      await registrarEvento(tx, { tipo: "CancelamentoFinanceiroDesistenciaDecidido", agregadoTipo: "Matricula", agregadoId: matriculaId, autorId: autor.id,
        payload: { pedidoId: proposta.pedidoId, propostaId: proposta.id, decisaoId: decisao.id, aprovada: decisao.aprovada } });
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
      return { id: decisao.id, aprovada: decisao.aprovada };
    });
  });
}
