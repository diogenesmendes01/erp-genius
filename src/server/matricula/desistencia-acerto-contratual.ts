"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { calcularObrigacaoDesistenciaContratual } from "./desistencia-acerto-contratual-calculo";
import { carregarFinanceiroDesistenciaTx } from "./desistencia-financeiro-tx";
import { hashSubstituicao } from "@/server/contratos/substituicao-estado";
import { conferirPedidoReplayAcertoDesistencia } from "./desistencia-acerto-replay";

const id = z.string().min(1).max(100);
const motivo = z.string().trim().min(5).max(3000);
const Entrada = z.object({
  pedidoId: id,
  condicoesId: id,
  motivo,
  anteriorId: id.optional(),
  motivoReapresentacao: motivo.optional(),
  chaveIdempotencia: z.string().trim().min(8).max(100),
}).strict().superRefine((entrada, contexto) => {
  if (Boolean(entrada.anteriorId) !== Boolean(entrada.motivoReapresentacao)) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: "A reapresentação exige proposta rejeitada e motivo." });
  }
});

export async function fotografiaQ165(tx: Prisma.TransactionClient, matriculaId: string) {
  const [taxa, desist] = await Promise.all([
    tx.origemCreditoAcertoTaxaAditivo.findMany({ where: { cobranca: { matriculaId } }, select: { cobrancaId: true, valor: true } }),
    tx.origemCreditoAcertoDesistenciaContratual.findMany({ where: { matriculaId }, select: { cobrancaId: true, valor: true } }),
  ]);
  const credito = new Map<string, Prisma.Decimal>();
  for (const origem of [...taxa, ...desist]) {
    credito.set(origem.cobrancaId, (credito.get(origem.cobrancaId) ?? new Prisma.Decimal(0)).plus(origem.valor));
  }
  const financeiro = await carregarFinanceiroDesistenciaTx(tx, matriculaId);
  return {
    fotografia: {
      financeiro: financeiro.snapshot,
      creditoJaApurado: Object.fromEntries([...credito].map(([cobrancaId, valor]) => [cobrancaId, valor.toFixed(2)])),
    },
    credito,
  };
}

async function autor(tx: Prisma.TransactionClient, usuarioId: string) {
  const usuario = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { ativo: true, papeis: true } });
  if (!usuario?.ativo || !usuario.papeis.some(papel => papel === Papel.FINANCEIRO || papel === Papel.ADMINISTRADOR)) throw new ErroPermissao();
}

export async function prepararAcertoDesistenciaContratual(input: unknown) {
  return executarAcao(async () => {
    const ator = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    const entrada = Entrada.parse(input);
    return prisma.$transaction(async tx => {
      await autor(tx, ator.id);
      const pedido = await tx.pedidoDesistenciaPreparacao.findUnique({ where: { id: entrada.pedidoId } });
      if (!pedido) throw new ErroRegra("Pedido de desistência indisponível.");
      await bloquearMatriculas(tx, [pedido.matriculaId]);

      const replay = await tx.propostaAcertoDesistenciaContratual.findUnique({
        where: { preparadorId_chaveIdempotencia: { preparadorId: ator.id, chaveIdempotencia: entrada.chaveIdempotencia } },
      });
      if (replay) {
        conferirPedidoReplayAcertoDesistencia(replay, entrada);
        return { id: replay.id };
      }

      const matricula = await tx.matricula.findUniqueOrThrow({
        where: { id: pedido.matriculaId },
        select: { status: true, ativadaEm: true, contratoOk: true, contratoDocumentoId: true, confirmacaoContratoEm: true, confirmacaoContratoPorId: true },
      });
      if (matricula.ativadaEm || !["RASCUNHO", "AGUARDANDO"].includes(matricula.status)) throw new ErroRegra("O acerto contratual exige matrícula em preparação.");
      const atualPedido = await tx.pedidoDesistenciaPreparacao.findFirst({ where: { matriculaId: pedido.matriculaId }, orderBy: { versao: "desc" } });
      if (!atualPedido || atualPedido.id !== pedido.id || await tx.efetivacaoPedidoDesistenciaPreparacao.findFirst({ where: { matriculaId: pedido.matriculaId } })) {
        throw new ErroRegra("Use o pedido atual ainda não efetivado.");
      }

      const condicoes = await tx.condicoesEncerramentoMatricula.findFirst({
        where: { id: entrada.condicoesId, matriculaId: pedido.matriculaId, status: "APROVADA" },
        include: { documento: true, artefatoContratual: { include: { previa: true } }, processoAssinatura: { include: { conclusao: true } } },
      });
      const fonteDocumento = !!condicoes?.documento && !!matricula.contratoOk && !!matricula.confirmacaoContratoEm
        && !!matricula.confirmacaoContratoPorId && condicoes.documentoId === matricula.contratoDocumentoId
        && !condicoes.documento.arquivado && condicoes.documento.matriculaId === pedido.matriculaId;
      const fonteEnviada = !!condicoes?.artefatoContratual && !!condicoes.processoAssinatura && !condicoes.documentoId
        && condicoes.artefatoContratual.previa.matriculaId === pedido.matriculaId
        && condicoes.processoAssinatura.matriculaId === pedido.matriculaId
        && condicoes.processoAssinatura.artefatoId === condicoes.artefatoContratualId
        && condicoes.processoAssinatura.estado === "ENVIADO" && !!condicoes.processoAssinatura.referenciaExterna
        && !condicoes.processoAssinatura.conclusao && !!(condicoes.regras as { acertoDesistenciaPreparacao?: unknown }).acertoDesistenciaPreparacao;
      if (!condicoes || (!fonteDocumento && !fonteEnviada)
        || await tx.condicoesEncerramentoMatricula.count({ where: { matriculaId: pedido.matriculaId, versao: { gt: condicoes.versao } } })) {
        throw new ErroRegra("Use a versão contratual estruturada vigente e aprovada.");
      }
      if (await tx.aplicacaoAcertoDesistenciaContratual.findFirst({ where: { decisao: { proposta: { pedidoId: pedido.id } } }, select: { id: true } })) {
        throw new ErroRegra("Este pedido já possui aplicação Q165 pendente de efetivação.");
      }

      const ultima = await tx.propostaAcertoDesistenciaContratual.findFirst({
        where: { pedidoId: pedido.id }, orderBy: { versao: "desc" }, include: { decisao: true },
      });
      if (!ultima && entrada.anteriorId) throw new ErroRegra("A proposta anterior não pertence a uma cadeia Q165 existente.");
      if (ultima && !entrada.anteriorId) throw new ErroRegra("Informe a proposta rejeitada e o motivo da reapresentação.");
      if (ultima && (ultima.id !== entrada.anteriorId || !ultima.decisao)) {
        throw new ErroRegra("Somente a última proposta já decidida deste pedido pode ser reapresentada.");
      }

      const { fotografia, credito: creditoJaApurado } = await fotografiaQ165(tx, pedido.matriculaId);
      const condicoesHash = hashSubstituicao(condicoes.regras);
      if (ultima?.decisao?.aprovada && ultima.fotografiaHash === hashSubstituicao(fotografia) && ultima.condicoesHash === condicoesHash) {
        throw new ErroRegra("A proposta aprovada ainda corresponde à fotografia e à condição contratual atuais.");
      }
      const cobrancas = await tx.cobranca.findMany({ where: { matriculaId: pedido.matriculaId }, orderBy: { id: "asc" } });
      const itens = cobrancas.map(cobranca => {
        const resultado = calcularObrigacaoDesistenciaContratual(condicoes.regras, { ...cobranca, valorCreditoJaApurado: creditoJaApurado.get(cobranca.id) ?? new Prisma.Decimal(0) }, cobrancas);
        return {
          cobrancaId: cobranca.id, moeda: cobranca.moeda, devido: resultado.devido.toFixed(2), saldoDevido: resultado.saldoDevido.toFixed(2),
          creditoApurado: resultado.creditoApurado.toFixed(2), creditoJaApurado: (creditoJaApurado.get(cobranca.id) ?? new Prisma.Decimal(0)).toFixed(2),
        };
      });
      const fotografiaHash = hashSubstituicao(fotografia);
      const memoria = {
        pedidoId: pedido.id, matriculaId: pedido.matriculaId, condicoesId: condicoes.id, estadoHash: pedido.estadoHash,
        condicoesHash, fotografiaHash, fotografia, regras: condicoes.regras, itens,
        motivo: entrada.motivo, anteriorId: entrada.anteriorId ?? null, motivoReapresentacao: entrada.motivoReapresentacao ?? null,
      };
      const proposta = await tx.propostaAcertoDesistenciaContratual.create({ data: {
        pedidoId: pedido.id, condicoesId: condicoes.id, preparadorId: ator.id, estadoHash: pedido.estadoHash,
        condicoesHash, fotografiaHash, memoria, chaveIdempotencia: entrada.chaveIdempotencia,
        anteriorId: entrada.anteriorId, versao: ultima ? ultima.versao + 1 : 1, motivoReapresentacao: entrada.motivoReapresentacao,
      } });
      await registrarEvento(tx, {
        tipo: "AcertoDesistenciaContratualPreparado", agregadoTipo: "Matricula", agregadoId: pedido.matriculaId, autorId: ator.id,
        payload: { propostaId: proposta.id, pedidoId: pedido.id, fotografiaHash, anteriorId: entrada.anteriorId ?? null, versao: proposta.versao },
      });
      return { id: proposta.id };
    });
  });
}

export { decidirAcertoDesistenciaContratual } from "./desistencia-acerto-decisao";
