"use server";

import { isDeepStrictEqual } from "node:util";
import { conferirCancelamentoFinanceiroDesistenciaTx } from "./desistencia-financeira-tx";
import { createHash } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento, type Resultado } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { carregarConferenciaDesistenciaTx } from "./desistencia-conferencia-tx";

const id = z.string().trim().min(1).max(100);
const entradaSchema = z.object({
  matriculaId: id,
  estadoHash: z.string().regex(/^[a-f0-9]{64}$/),
  motivo: z.string().trim().min(5).max(3000),
  evidenciaPedido: z.string().trim().min(10).max(3000),
  chaveIdempotencia: z.string().trim().min(8).max(100),
}).strict();
const consultaSchema = z.object({ matriculaId: id }).strict();

function hashEntrada(entrada: z.infer<typeof entradaSchema>) {
  return createHash("sha256").update(JSON.stringify(entrada)).digest("hex");
}
async function exigirAutorAtualTx(tx: Prisma.TransactionClient, usuarioId: string) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuarioId} FOR SHARE`;
  const atual = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { ativo: true, papeis: true } });
  if (!atual?.ativo || !atual.papeis.some((papel) => papel === Papel.SECRETARIA_ACADEMICA || papel === Papel.ADMINISTRADOR)) throw new ErroPermissao();
  return atual;
}

export type PedidoDesistenciaPreparacaoView = {
  id: string;
  versao: number;
  motivo: string;
  evidenciaPedido: string;
  registradorNome: string;
  criadaEmISO: string;
  estadoHash: string;
  atual: boolean;
};
export type ConsultaDesistenciaPreparacao = {
  conferencia: Awaited<ReturnType<typeof carregarConferenciaDesistenciaTx>>["resumo"];
  estadoHash: string;
  pedidos: PedidoDesistenciaPreparacaoView[];
  proximaVersao: number;
  podeEfetivar: boolean;
  decisaoFinanceiraId: string | null;
  efetivacao: { pedidoId: string; motivo: string; executorNome: string; aplicadaEmISO: string; tratamentoFinanceiro: boolean } | null;
};

/** Mostra apenas a conferência atual e os vinte pedidos mais recentes. O
 * histórico completo/paginado e qualquer decisão pertencem a etapas futuras. */
export async function consultarDesistenciaPreparacao(input: { matriculaId: string }): Promise<Resultado<ConsultaDesistenciaPreparacao>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const dados = consultaSchema.parse(input);
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await bloquearMatriculas(tx, [dados.matriculaId]);
      await exigirAutorAtualTx(tx, autor.id);
      const conferencia = await carregarConferenciaDesistenciaTx(tx, dados.matriculaId);
      const pedidos = await tx.pedidoDesistenciaPreparacao.findMany({ where: { matriculaId: dados.matriculaId },
        orderBy: [{ versao: "desc" }, { id: "desc" }], take: 20,
        select: { id: true, versao: true, motivo: true, evidenciaPedido: true, criadaEm: true, estadoHash: true, registrador: { select: { nome: true } } },
      });
      const ultima = await tx.pedidoDesistenciaPreparacao.findFirst({ where: { matriculaId: dados.matriculaId }, orderBy: { versao: "desc" }, select: { versao: true } });
      const efetivacao = await tx.efetivacaoPedidoDesistenciaPreparacao.findUnique({ where: { matriculaId: dados.matriculaId },
        select: { pedidoId: true, motivo: true, aplicadaEm: true, decisaoFinanceiraId: true, executor: { select: { nome: true } } } });
      const r = conferencia.resumo;
      let decisaoFinanceiraId: string | null = null;
      if (!efetivacao && pedidos[0] && r.financeiro.quantidadeCobrancas > 0) {
        const proposta = await tx.propostaFinanceiraDesistencia.findFirst({ where: { pedidoId: pedidos[0].id }, orderBy: { versao: "desc" },
          include: { preparador: { select: { ativo: true, papeis: true } }, decisao: { include: { decisor: { select: { ativo: true, papeis: true, permissoes: true } } } } } });
        const d = proposta?.decisao;
        if (proposta && d?.aprovada && proposta.preparadorId !== d.decisorId && proposta.preparador.ativo
          && proposta.preparador.papeis.some(p => p === Papel.FINANCEIRO || p === Papel.ADMINISTRADOR)
          && d.decisor.ativo && (d.decisor.papeis.includes(Papel.ADMINISTRADOR) || (d.decisor.papeis.includes(Papel.FINANCEIRO) && d.decisor.permissoes.includes("financeiro.aprovar_acertos")))) {
          try {
            const atual = await conferirCancelamentoFinanceiroDesistenciaTx(tx, pedidos[0].id, conferencia.estadoHash);
            if (isDeepStrictEqual(proposta.snapshot, { fotografia: atual.fotografia, fotografiaHash: atual.fotografiaHash })) decisaoFinanceiraId = d.id;
          } catch (erro) { if (!(erro instanceof ErroRegra)) throw erro; }
        }
      }
      const podeEfetivar = !efetivacao && r.podeRegistrar && !r.exigeAprovacaoAdministrativa && !r.exigeConferenciaDocumental
        && (!r.financeiro.exigeConferenciaFinanceira || !!decisaoFinanceiraId) && r.quantidadeAlocacoes === 0 && r.quantidadeDocumentos === 0
        && !r.reservas.some(reserva => reserva.status === "UTILIZADA")
        && pedidos.length > 0 && pedidos[0].estadoHash === conferencia.estadoHash;
      return {
        podeEfetivar, decisaoFinanceiraId,
        efetivacao: efetivacao ? { tratamentoFinanceiro: !!efetivacao.decisaoFinanceiraId, pedidoId: efetivacao.pedidoId, motivo: efetivacao.motivo,
          executorNome: efetivacao.executor.nome, aplicadaEmISO: efetivacao.aplicadaEm.toISOString() } : null,
        conferencia: conferencia.resumo,
        estadoHash: conferencia.estadoHash,
        pedidos: pedidos.map((pedido) => ({ id: pedido.id, versao: pedido.versao, motivo: pedido.motivo, evidenciaPedido: pedido.evidenciaPedido,
          registradorNome: pedido.registrador.nome, criadaEmISO: pedido.criadaEm.toISOString(), estadoHash: pedido.estadoHash,
          atual: pedido.estadoHash === conferencia.estadoHash })),
        proximaVersao: (ultima?.versao ?? 0) + 1,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  });
}

/** Registra a intenção conferida. Não executa desistência, não libera reserva e
 * não altera matrícula, cobrança, contrato, documento ou alocação. */
export async function registrarPedidoDesistenciaPreparacao(input: z.input<typeof entradaSchema>): Promise<Resultado<{ id: string; versao: number }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const dados = entradaSchema.parse(input);
    const entradaHash = hashEntrada(dados);
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await bloquearMatriculas(tx, [dados.matriculaId]);
      await exigirAutorAtualTx(tx, autor.id);
      const existente = await tx.pedidoDesistenciaPreparacao.findUnique({ where: {
        registradorId_chaveIdempotencia: { registradorId: autor.id, chaveIdempotencia: dados.chaveIdempotencia },
      } });
      if (existente) {
        if (existente.entradaHash !== entradaHash) throw new ErroRegra("Chave de idempotência já identifica outro pedido de desistência.");
        return { id: existente.id, versao: existente.versao };
      }
      const conferencia = await carregarConferenciaDesistenciaTx(tx, dados.matriculaId);
      if (!conferencia.resumo.podeRegistrar) throw new ErroRegra("Esta matrícula não está em preparação para registrar desistência.");
      if (conferencia.estadoHash !== dados.estadoHash) throw new ErroRegra("A preparação mudou. Atualize a conferência antes de registrar o pedido.");
      const ultima = await tx.pedidoDesistenciaPreparacao.findFirst({ where: { matriculaId: dados.matriculaId }, orderBy: { versao: "desc" }, select: { versao: true } });
      const pedido = await tx.pedidoDesistenciaPreparacao.create({ data: {
        matriculaId: dados.matriculaId, registradorId: autor.id, versao: (ultima?.versao ?? 0) + 1,
        motivo: dados.motivo, evidenciaPedido: dados.evidenciaPedido, chaveIdempotencia: dados.chaveIdempotencia,
        entradaHash, estadoHash: conferencia.estadoHash, snapshotJson: conferencia.snapshot as Prisma.InputJsonObject,
      } });
      await registrarEvento(tx, { tipo: "PedidoDesistenciaPreparacaoRegistrado", agregadoTipo: "Matricula", agregadoId: dados.matriculaId, autorId: autor.id,
        payload: { pedidoId: pedido.id, versao: pedido.versao, estadoHash: pedido.estadoHash } });
      return { id: pedido.id, versao: pedido.versao };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  });
}

