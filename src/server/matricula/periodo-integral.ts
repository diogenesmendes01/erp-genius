"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ErroPermissao,
  ErroRegra,
  executarAcao,
  exigirSessaoComPapel,
  registrarEvento,
} from "@/server/_shared";
import { hashSubstituicao } from "@/server/contratos/substituicao-estado";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { DataCivilSchema } from "./cobertura";
import { conferirIndisponibilidadeOfertaTx } from "./indisponibilidade-oferta-estado";
import { carregarPeriodoIntegralTx } from "./periodo-integral-estado";

const DataCivilPersistivelSchema = DataCivilSchema.refine(
  (data) => data >= "0001-01-01",
  "Data fora do intervalo persistível.",
);
const TextoSchema = z.string().trim().min(5).max(2_000);
const DecimalSchema = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/);
const MemoriaBaseSchema = z
  .object({
    moeda: z.string().regex(/^[A-Z]{3}$/),
    cobertura: z
      .object({ inicio: DataCivilPersistivelSchema, fim: DataCivilPersistivelSchema })
      .strict(),
    valores: z
      .object({
        valorOriginal: DecimalSchema,
        valorNegociado: DecimalSchema,
        valorRecebido: DecimalSchema,
        valorLiquidadoCredito: DecimalSchema,
        saldoReconciliado: DecimalSchema,
      })
      .strict(),
  })
  .passthrough();
const MemoriaCreditoSchema = MemoriaBaseSchema.extend({
  escolha: z.literal("CREDITO"),
  saldoADesobrigar: DecimalSchema,
  creditoPorRecebimentos: DecimalSchema,
  creditoPorLiquidacaoPrevia: DecimalSchema,
  creditoAConstituir: DecimalSchema,
});
const MemoriaCoberturaFuturaSchema = MemoriaBaseSchema.extend({
  escolha: z.literal("COBERTURA_FUTURA"),
  saldoAConservar: DecimalSchema,
  transferenciaCoberturaPendente: z.literal(true),
});
const SnapshotMemoriaSchema = z
  .object({
    memoria: z.discriminatedUnion("escolha", [MemoriaCreditoSchema, MemoriaCoberturaFuturaSchema]),
  })
  .passthrough();

const ProporSchema = z
  .object({
    matriculaId: z.string().min(1),
    cobrancaId: z.string().min(1),
    escolha: z.enum(["CREDITO", "COBERTURA_FUTURA"]),
    coberturaFutura: z
      .object({ inicio: DataCivilPersistivelSchema, fim: DataCivilPersistivelSchema })
      .strict()
      .optional(),
    clausula: TextoSchema,
    evidenciaEscolha: TextoSchema,
    motivo: TextoSchema,
    chaveIdempotencia: z.string().trim().min(8).max(100),
  })
  .strict()
  .superRefine((dados, contexto) => {
    if (dados.escolha === "CREDITO" && dados.coberturaFutura) {
      contexto.addIssue({ code: z.ZodIssueCode.custom, path: ["coberturaFutura"], message: "Crédito não aceita cobertura futura." });
    }
    if (dados.escolha === "COBERTURA_FUTURA" && !dados.coberturaFutura) {
      contexto.addIssue({ code: z.ZodIssueCode.custom, path: ["coberturaFutura"], message: "Informe a cobertura futura escolhida." });
    }
    if (dados.coberturaFutura && dados.coberturaFutura.inicio > dados.coberturaFutura.fim) {
      contexto.addIssue({ code: z.ZodIssueCode.custom, path: ["coberturaFutura", "fim"], message: "Cobertura futura invertida." });
    }
  });

const DecidirSchema = z
  .object({
    propostaId: z.string().min(1),
    aprovada: z.boolean(),
    motivo: TextoSchema,
  })
  .strict();

const ConsultarSchema = z
  .object({ matriculaId: z.string().min(1), cobrancaId: z.string().min(1) })
  .strict();

function dataUtc(data: string): Date {
  return new Date(`${data}T00:00:00.000Z`);
}

function dataCivil(data: Date | null): string | null {
  return data?.toISOString().slice(0, 10) ?? null;
}

function podePreparar(papeis: Papel[]): boolean {
  return papeis.includes(Papel.ADMINISTRADOR) || papeis.includes(Papel.FINANCEIRO);
}

function podeDecidir(papeis: Papel[], permissoes: string[]): boolean {
  return (
    papeis.includes(Papel.ADMINISTRADOR) ||
    (papeis.includes(Papel.FINANCEIRO) && permissoes.includes("financeiro.aprovar_acertos"))
  );
}

async function conferirAtorAtual(
  tx: Prisma.TransactionClient,
  atorId: string,
  finalidade: "PREPARAR" | "DECIDIR",
) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${atorId} FOR SHARE`;
  const ator = await tx.usuario.findUnique({
    where: { id: atorId },
    select: { ativo: true, papeis: true, permissoes: true },
  });
  if (
    !ator?.ativo ||
    !(finalidade === "PREPARAR"
      ? podePreparar(ator.papeis)
      : podeDecidir(ator.papeis, ator.permissoes))
  ) {
    throw new ErroPermissao();
  }
  return ator;
}

async function bloquearContexto(
  tx: Prisma.TransactionClient,
  matriculaId: string,
  cobrancaId: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await bloquearMatriculas(tx, [matriculaId]);
  await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE id = ${cobrancaId} FOR UPDATE`;
}

async function conferirCoberturaFutura(
  tx: Prisma.TransactionClient,
  dados: {
    matriculaId: string;
    cobrancaId: string;
    escolha: "CREDITO" | "COBERTURA_FUTURA";
    coberturaFutura?: { inicio: string; fim: string };
  },
  fimOriginal: Date,
) {
  if (dados.escolha === "CREDITO") {
    if (dados.coberturaFutura) throw new ErroRegra("Crédito não aceita cobertura futura.");
    return;
  }
  if (!dados.coberturaFutura) throw new ErroRegra("Informe a cobertura futura escolhida.");
  const inicio = dataUtc(dados.coberturaFutura.inicio);
  const fim = dataUtc(dados.coberturaFutura.fim);
  const totalDias = (fim.getTime() - inicio.getTime()) / 86_400_000 + 1;
  if (inicio <= fimOriginal || !Number.isInteger(totalDias) || totalDias < 1 || totalDias > 366) {
    throw new ErroRegra("A cobertura futura deve começar após a original e ter no máximo 366 dias civis.");
  }
  const sobreposta = await tx.cobranca.findFirst({
    where: {
      matriculaId: dados.matriculaId,
      id: { not: dados.cobrancaId },
      tipo: "MENSALIDADE",
      status: { not: "CANCELADA" },
      coberturaInicio: { not: null, lte: fim },
      coberturaFim: { not: null, gte: inicio },
    },
    select: { id: true },
  });
  if (sobreposta) throw new ErroRegra("A cobertura futura sobrepõe outra mensalidade não cancelada.");
  const recomposicao = await tx.diaProgramadoRecomposicao.findFirst({
    where: {
      dataCobertura: { gte: inicio, lte: fim },
      aplicacao: { decisao: { rascunho: { matriculaId: dados.matriculaId } } },
    },
    select: { id: true },
  });
  if (recomposicao) throw new ErroRegra("A cobertura futura sobrepõe dia já programado para recomposição.");
  const oferta = await conferirIndisponibilidadeOfertaTx(tx, {
    matriculaId: dados.matriculaId,
    inicio,
    fim,
  });
  if (oferta.estado !== "SEM_RELATO") {
    throw new ErroRegra("A cobertura futura possui relato de indisponibilidade que precisa de conferência.");
  }
}

function projetarDecisao(decisao: {
  id: string;
  aprovada: boolean;
  motivo: string;
  decididaEm: Date;
  aplicacao?: {
    id: string;
    aplicadaEm: Date;
    credito: { id: string; valorInicial: Prisma.Decimal; moeda: string } | null;
  } | null;
}) {
  return {
    id: decisao.id,
    aprovada: decisao.aprovada,
    motivo: decisao.motivo,
    decididaEm: decisao.decididaEm.toISOString(),
    aplicacao: decisao.aplicacao
      ? {
          id: decisao.aplicacao.id,
          aplicadaEm: decisao.aplicacao.aplicadaEm.toISOString(),
          credito: decisao.aplicacao.credito
            ? {
                id: decisao.aplicacao.credito.id,
                valor: decisao.aplicacao.credito.valorInicial.toFixed(2),
                moeda: decisao.aplicacao.credito.moeda,
              }
            : null,
        }
      : null,
  };
}

function projetarMemoria(snapshot: unknown, escolhaEsperada: string) {
  const validado = SnapshotMemoriaSchema.safeParse(snapshot);
  if (!validado.success || validado.data.memoria.escolha !== escolhaEsperada) {
    throw new ErroRegra("A memória financeira preservada da regularização é inválida.");
  }
  const memoria = validado.data.memoria;
  const base = {
    escolha: memoria.escolha,
    moeda: memoria.moeda,
    coberturaOriginal: memoria.cobertura,
    valores: memoria.valores,
  };
  return memoria.escolha === "CREDITO"
    ? {
        ...base,
        escolha: "CREDITO" as const,
        saldoADesobrigar: memoria.saldoADesobrigar,
        creditoPorRecebimentos: memoria.creditoPorRecebimentos,
        creditoPorLiquidacaoPrevia: memoria.creditoPorLiquidacaoPrevia,
        creditoAConstituir: memoria.creditoAConstituir,
      }
    : {
        ...base,
        escolha: "COBERTURA_FUTURA" as const,
        saldoAConservar: memoria.saldoAConservar,
        transferenciaCoberturaPendente: memoria.transferenciaCoberturaPendente,
      };
}

function projetarProposta(proposta: {
  id: string;
  versao: number;
  matriculaId: string;
  cobrancaId: string;
  escolha: string;
  coberturaFuturaInicio: Date | null;
  coberturaFuturaFim: Date | null;
  clausula: string;
  evidenciaEscolha: string;
  motivo: string;
  criadaEm: Date;
  sucessora?: { id: string } | null;
  snapshot?: unknown;
  decisao?: {
    id: string;
    aprovada: boolean;
    motivo: string;
    decididaEm: Date;
    aplicacao?: {
      id: string;
      aplicadaEm: Date;
      credito: { id: string; valorInicial: Prisma.Decimal; moeda: string } | null;
    } | null;
  } | null;
}) {
  return {
    id: proposta.id,
    versao: proposta.versao,
    matriculaId: proposta.matriculaId,
    cobrancaId: proposta.cobrancaId,
    escolha: proposta.escolha,
    coberturaFutura: proposta.coberturaFuturaInicio && proposta.coberturaFuturaFim
      ? { inicio: dataCivil(proposta.coberturaFuturaInicio), fim: dataCivil(proposta.coberturaFuturaFim) }
      : null,
    clausula: proposta.clausula,
    evidenciaEscolha: proposta.evidenciaEscolha,
    motivo: proposta.motivo,
    criadaEm: proposta.criadaEm.toISOString(),
    decisao: proposta.decisao ? projetarDecisao(proposta.decisao) : null,
    aplicacaoPendente: proposta.decisao?.aprovada === true && !proposta.decisao.aplicacao && !proposta.sucessora,
    superada: proposta.sucessora !== undefined ? proposta.sucessora !== null : false,
    memoria: proposta.snapshot ? projetarMemoria(proposta.snapshot, proposta.escolha) : null,
  };
}

async function exigeReconferenciaDaAntecessora(
  tx: Prisma.TransactionClient,
  proposta: {
    matriculaId: string;
    cobrancaId: string;
    escolha: string;
    coberturaFuturaInicio: Date | null;
    coberturaFuturaFim: Date | null;
    snapshot: Prisma.JsonValue;
    snapshotHash: string;
  },
): Promise<boolean> {
  const escolha = z.enum(["CREDITO", "COBERTURA_FUTURA"]).safeParse(proposta.escolha);
  if (!escolha.success || hashSubstituicao(proposta.snapshot) !== proposta.snapshotHash) return true;
  try {
    const estado = await carregarPeriodoIntegralTx(tx, {
      matriculaId: proposta.matriculaId,
      cobrancaId: proposta.cobrancaId,
      escolha: escolha.data,
    });
    if (estado.hash !== proposta.snapshotHash) return true;
    await conferirCoberturaFutura(
      tx,
      {
        matriculaId: proposta.matriculaId,
        cobrancaId: proposta.cobrancaId,
        escolha: escolha.data,
        coberturaFutura:
          proposta.coberturaFuturaInicio && proposta.coberturaFuturaFim
            ? {
                inicio: dataCivil(proposta.coberturaFuturaInicio)!,
                fim: dataCivil(proposta.coberturaFuturaFim)!,
              }
            : undefined,
      },
      dataUtc(estado.snapshot.memoria.cobertura.fim),
    );
    return false;
  } catch (erro) {
    if (erro instanceof ErroRegra || erro instanceof z.ZodError) return true;
    throw erro;
  }
}

function projetarAplicacao(aplicacao: {
  id: string;
  decisaoId: string;
  cobrancaId: string;
  matriculaId: string;
  aplicadaEm: Date;
  credito: { id: string; valorInicial: Prisma.Decimal; moeda: string } | null;
}) {
  return {
    id: aplicacao.id,
    decisaoId: aplicacao.decisaoId,
    cobrancaId: aplicacao.cobrancaId,
    matriculaId: aplicacao.matriculaId,
    aplicadaEm: aplicacao.aplicadaEm.toISOString(),
    credito: aplicacao.credito
      ? {
          id: aplicacao.credito.id,
          valor: aplicacao.credito.valorInicial.toFixed(2),
          moeda: aplicacao.credito.moeda,
        }
      : null,
  };
}

export async function proporRegularizacaoPeriodoIntegral(input: z.input<typeof ProporSchema>) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    const dados = ProporSchema.parse(input);
    const entradaHash = hashSubstituicao(dados);
    const referencia = await prisma.cobranca.findFirst({
      where: { id: dados.cobrancaId, matriculaId: dados.matriculaId },
      select: { id: true },
    });
    if (!referencia) throw new ErroRegra("Mensalidade não encontrada nesta matrícula.");

    return prisma.$transaction(async (tx) => {
      await bloquearContexto(tx, dados.matriculaId, dados.cobrancaId);
      await conferirAtorAtual(tx, sessao.id, "PREPARAR");
      const repetida = await tx.propostaPeriodoIntegral.findUnique({
        where: { autorId_chaveIdempotencia: { autorId: sessao.id, chaveIdempotencia: dados.chaveIdempotencia } },
        include: {
          decisao: { include: { aplicacao: { include: { credito: true } } } },
          sucessora: { select: { id: true } },
        },
      });
      if (repetida) {
        if (repetida.entradaHash !== entradaHash) throw new ErroRegra("Chave de idempotência já usada para outra regularização.");
        return projetarProposta(repetida);
      }
      const ultima = await tx.propostaPeriodoIntegral.findFirst({
        where: { matriculaId: dados.matriculaId, cobrancaId: dados.cobrancaId },
        orderBy: [{ versao: "desc" }, { id: "desc" }],
        include: { decisao: { include: { aplicacao: { include: { credito: true } } } }, sucessora: { select: { id: true } } },
      });
      if (ultima?.decisao === null) {
        throw new ErroRegra("A última regularização desta mensalidade ainda está pendente.");
      }
      if (ultima?.decisao?.aprovada && ultima.decisao.aplicacao) {
        if (ultima.escolha === "CREDITO") {
          throw new ErroRegra("A regularização por crédito já aplicada encerrou esta mensalidade para novas propostas.");
        }
      } else if (ultima?.decisao?.aprovada) {
        if (!(await exigeReconferenciaDaAntecessora(tx, ultima))) {
          throw new ErroRegra("A última regularização aprovada continua válida e deve ser aplicada antes de nova proposta.");
        }
      }
      const estado = await carregarPeriodoIntegralTx(tx, {
        matriculaId: dados.matriculaId,
        cobrancaId: dados.cobrancaId,
        escolha: dados.escolha,
      });
      const memoria = estado.snapshot.memoria;
      await conferirCoberturaFutura(tx, dados, dataUtc(memoria.cobertura.fim));
      const proposta = await tx.propostaPeriodoIntegral.create({
        data: {
          versao: (ultima?.versao ?? 0) + 1,
          anteriorId: ultima?.id ?? null,
          matriculaId: dados.matriculaId,
          cobrancaId: dados.cobrancaId,
          documentoId: estado.snapshot.documentoId,
          escolha: dados.escolha,
          coberturaFuturaInicio: dados.coberturaFutura ? dataUtc(dados.coberturaFutura.inicio) : null,
          coberturaFuturaFim: dados.coberturaFutura ? dataUtc(dados.coberturaFutura.fim) : null,
          clausula: dados.clausula,
          evidenciaEscolha: dados.evidenciaEscolha,
          motivo: dados.motivo,
          snapshot: estado.snapshot,
          snapshotHash: estado.hash,
          autorId: sessao.id,
          chaveIdempotencia: dados.chaveIdempotencia,
          entradaHash,
        },
      });
      await registrarEvento(tx, {
        tipo: "RegularizacaoPeriodoIntegralProposta",
        agregadoTipo: "Matricula",
        agregadoId: dados.matriculaId,
        autorId: sessao.id,
        payload: { propostaId: proposta.id, cobrancaId: dados.cobrancaId, escolha: dados.escolha },
      });
      return projetarProposta(proposta);
    }, { timeout: 20_000 });
  });
}

export async function decidirRegularizacaoPeriodoIntegral(input: z.input<typeof DecidirSchema>) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    const dados = DecidirSchema.parse(input);
    const entradaHash = hashSubstituicao(dados);
    const referencia = await prisma.propostaPeriodoIntegral.findUnique({
      where: { id: dados.propostaId },
      select: { matriculaId: true, cobrancaId: true },
    });
    if (!referencia) throw new ErroRegra("Proposta de regularização não encontrada.");

    return prisma.$transaction(async (tx) => {
      await bloquearContexto(tx, referencia.matriculaId, referencia.cobrancaId);
      await tx.$queryRaw`SELECT id FROM "PropostaPeriodoIntegral" WHERE id = ${dados.propostaId} FOR UPDATE`;
      const proposta = await tx.propostaPeriodoIntegral.findFirst({
        where: { id: dados.propostaId, matriculaId: referencia.matriculaId, cobrancaId: referencia.cobrancaId },
        include: { decisao: { include: { aplicacao: { include: { credito: true } } } }, sucessora: { select: { id: true } } },
      });
      if (!proposta) throw new ErroRegra("Proposta de regularização não encontrada nesta matrícula.");
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id IN (${sessao.id}, ${proposta.autorId}) FOR SHARE`;
      await conferirAtorAtual(tx, sessao.id, "DECIDIR");
      if (proposta.autorId === sessao.id) throw new ErroRegra("Outra pessoa deve decidir a regularização.");
      if (proposta.decisao) {
        if (proposta.decisao.decisorId === sessao.id && proposta.decisao.entradaHash === entradaHash && proposta.decisao.aprovada === dados.aprovada && proposta.decisao.motivo === dados.motivo) {
          return projetarDecisao(proposta.decisao);
        }
        throw new ErroRegra("A proposta já possui decisão imutável divergente.");
      }
      if (proposta.sucessora) {
        throw new ErroRegra("Esta proposta foi superada por uma reconferência mais recente.");
      }
      if (dados.aprovada) {
        if (hashSubstituicao(proposta.snapshot) !== proposta.snapshotHash) {
          throw new ErroRegra("O snapshot preservado da regularização é inconsistente.");
        }
        const estado = await carregarPeriodoIntegralTx(tx, {
          matriculaId: proposta.matriculaId,
          cobrancaId: proposta.cobrancaId,
          escolha: proposta.escolha as "CREDITO" | "COBERTURA_FUTURA",
        });
        if (estado.hash !== proposta.snapshotHash) throw new ErroRegra("A fonte da regularização mudou; prepare nova proposta.");
        const memoria = estado.snapshot.memoria;
        await conferirCoberturaFutura(
          tx,
          {
            matriculaId: proposta.matriculaId,
            cobrancaId: proposta.cobrancaId,
            escolha: proposta.escolha as "CREDITO" | "COBERTURA_FUTURA",
            coberturaFutura: proposta.coberturaFuturaInicio && proposta.coberturaFuturaFim
              ? { inicio: dataCivil(proposta.coberturaFuturaInicio)!, fim: dataCivil(proposta.coberturaFuturaFim)! }
              : undefined,
          },
          dataUtc(memoria.cobertura.fim),
        );
      }
      const decisao = await tx.decisaoPeriodoIntegral.create({
        data: { propostaId: proposta.id, decisorId: sessao.id, aprovada: dados.aprovada, motivo: dados.motivo, entradaHash },
      });
      await registrarEvento(tx, {
        tipo: "RegularizacaoPeriodoIntegralDecidida",
        agregadoTipo: "Matricula",
        agregadoId: proposta.matriculaId,
        autorId: sessao.id,
        payload: { propostaId: proposta.id, decisaoId: decisao.id, aprovada: decisao.aprovada },
      });
      return projetarDecisao(decisao);
    }, { timeout: 20_000 });
  });
}

/**
 * Materializa uma decisão já aprovada. Os efeitos na cobrança são guardados no
 * banco; esta ação não cria uso de crédito, estorno ou devolução financeira.
 */
export async function aplicarRegularizacaoPeriodoIntegral(input: { decisaoId: string }) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    const dados = z.object({ decisaoId: z.string().min(1) }).strict().parse(input);
    const referencia = await prisma.decisaoPeriodoIntegral.findUnique({
      where: { id: dados.decisaoId },
      select: { proposta: { select: { matriculaId: true, cobrancaId: true } } },
    });
    if (!referencia) throw new ErroRegra("Decisão de regularização não encontrada.");

    return prisma.$transaction(async (tx) => {
      await bloquearContexto(tx, referencia.proposta.matriculaId, referencia.proposta.cobrancaId);
      await tx.$queryRaw`SELECT id FROM "PropostaPeriodoIntegral" WHERE "cobrancaId" = ${referencia.proposta.cobrancaId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "DecisaoPeriodoIntegral" WHERE id = ${dados.decisaoId} FOR UPDATE`;
      await conferirAtorAtual(tx, sessao.id, "PREPARAR");
      const decisao = await tx.decisaoPeriodoIntegral.findFirst({
        where: {
          id: dados.decisaoId,
          proposta: {
            matriculaId: referencia.proposta.matriculaId,
            cobrancaId: referencia.proposta.cobrancaId,
          },
        },
        include: { proposta: { include: { sucessora: { select: { id: true } } } } },
      });
      if (!decisao) throw new ErroRegra("Decisão de regularização não encontrada nesta matrícula.");
      if (!decisao.aprovada) throw new ErroRegra("Somente uma decisão aprovada pode ser aplicada.");

      const existente = await tx.aplicacaoPeriodoIntegral.findUnique({
        where: { decisaoId: decisao.id },
        include: { credito: true },
      });
      if (existente) return projetarAplicacao(existente);
      if (decisao.proposta.sucessora) {
        throw new ErroRegra("Esta decisão foi superada por uma reconferência mais recente.");
      }

      if (hashSubstituicao(decisao.proposta.snapshot) !== decisao.proposta.snapshotHash) {
        throw new ErroRegra("O snapshot preservado da regularização é inconsistente.");
      }
      const escolha = z.enum(["CREDITO", "COBERTURA_FUTURA"]).safeParse(decisao.proposta.escolha);
      if (!escolha.success) throw new ErroRegra("A escolha preservada da regularização é inválida.");
      const estado = await carregarPeriodoIntegralTx(tx, {
        matriculaId: decisao.proposta.matriculaId,
        cobrancaId: decisao.proposta.cobrancaId,
        escolha: escolha.data,
      });
      if (estado.hash !== decisao.proposta.snapshotHash) {
        throw new ErroRegra("Aplicação bloqueada: a fonte mudou após aprovação e exige reconferência.");
      }
      const memoria = projetarMemoria(decisao.proposta.snapshot, escolha.data);
      await conferirCoberturaFutura(
        tx,
        {
          matriculaId: decisao.proposta.matriculaId,
          cobrancaId: decisao.proposta.cobrancaId,
          escolha: escolha.data,
          coberturaFutura:
            decisao.proposta.coberturaFuturaInicio && decisao.proposta.coberturaFuturaFim
              ? {
                  inicio: dataCivil(decisao.proposta.coberturaFuturaInicio)!,
                  fim: dataCivil(decisao.proposta.coberturaFuturaFim)!,
                }
              : undefined,
        },
        dataUtc(memoria.coberturaOriginal.fim),
      );
      const aplicacao = await tx.aplicacaoPeriodoIntegral.create({
        data: {
          decisaoId: decisao.id,
          cobrancaId: decisao.proposta.cobrancaId,
          matriculaId: decisao.proposta.matriculaId,
          executorId: sessao.id,
          snapshot: estado.snapshot,
          snapshotHash: decisao.proposta.snapshotHash,
          entradaHash: decisao.proposta.entradaHash,
        },
        include: { credito: true },
      });
      if (memoria.escolha === "CREDITO" && new Prisma.Decimal(memoria.creditoAConstituir).gt(0)) {
        await tx.creditoMatricula.create({
          data: {
            matriculaId: aplicacao.matriculaId,
            origemPeriodoIntegralId: aplicacao.id,
            valorInicial: new Prisma.Decimal(memoria.creditoAConstituir),
            moeda: memoria.moeda,
          },
        });
      }
      const aplicada = await tx.aplicacaoPeriodoIntegral.findUniqueOrThrow({
        where: { id: aplicacao.id },
        include: { credito: true },
      });
      await registrarEvento(tx, {
        tipo: "RegularizacaoPeriodoIntegralAplicada",
        agregadoTipo: "Matricula",
        agregadoId: decisao.proposta.matriculaId,
        autorId: sessao.id,
        payload: { aplicacaoId: aplicada.id, decisaoId: decisao.id, escolha: escolha.data },
      });
      return projetarAplicacao(aplicada);
    }, { timeout: 20_000 });
  });
}

export async function consultarRegularizacoesPeriodoIntegral(input: z.input<typeof ConsultarSchema>) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    const dados = ConsultarSchema.parse(input);
    return prisma.$transaction(async (tx) => {
      const usuario = await conferirAtorAtual(tx, sessao.id, "PREPARAR");
      const cobranca = await tx.cobranca.findFirst({
        where: { id: dados.cobrancaId, matriculaId: dados.matriculaId },
        select: {
          id: true,
          tipo: true,
          coberturaInicio: true,
          coberturaFim: true,
          ajusteAcerto: { select: { id: true } },
        },
      });
      if (!cobranca) throw new ErroRegra("Mensalidade não encontrada nesta matrícula.");
      let motivoFonteIndisponivel: string | null = null;
      let previaCredito: ReturnType<typeof projetarMemoria> | null = null;
      if (
        cobranca.tipo !== "MENSALIDADE" ||
        !cobranca.coberturaInicio ||
        !cobranca.coberturaFim ||
        cobranca.coberturaFim < cobranca.coberturaInicio ||
        cobranca.ajusteAcerto
      ) {
        motivoFonteIndisponivel = "A mensalidade não possui cobertura integral apta para regularização.";
      } else {
        try {
          const estado = await carregarPeriodoIntegralTx(tx, {
            matriculaId: dados.matriculaId,
            cobrancaId: cobranca.id,
            escolha: "CREDITO",
          });
          previaCredito = projetarMemoria(estado.snapshot, "CREDITO");
        } catch (erro) {
          if (erro instanceof ErroRegra || erro instanceof z.ZodError) {
            motivoFonteIndisponivel = erro.message;
          } else {
            throw erro;
          }
        }
      }
      const ultima = await tx.propostaPeriodoIntegral.findFirst({
        where: { matriculaId: dados.matriculaId, cobrancaId: cobranca.id },
        orderBy: [{ versao: "desc" }, { id: "desc" }],
        include: { decisao: { include: { aplicacao: { include: { credito: true } } } } },
      });
      let podeReconferir = false;
      if (ultima?.decisao?.aprovada === true && ultima.decisao.aplicacao === null) {
        podeReconferir = await exigeReconferenciaDaAntecessora(tx, ultima);
      }
      const ultimaAplicacaoCredito =
        ultima?.decisao?.aplicacao !== null &&
        ultima?.decisao?.aplicacao !== undefined &&
        ultima.escolha === "CREDITO";
      if (ultimaAplicacaoCredito) {
        previaCredito = null;
        motivoFonteIndisponivel = "A regularização por crédito já foi aplicada a esta mensalidade.";
      }
      const cadeiaPermiteNovaProposta =
        !ultima ||
        ultima.decisao?.aprovada === false ||
        (ultima.decisao?.aprovada === true && ultima.decisao.aplicacao !== null && ultima.escolha === "COBERTURA_FUTURA") ||
        podeReconferir;
      const propostas = await tx.propostaPeriodoIntegral.findMany({
        where: { matriculaId: dados.matriculaId, cobrancaId: cobranca.id },
        orderBy: [{ versao: "desc" }, { id: "desc" }],
        take: 20,
        include: { decisao: { include: { aplicacao: { include: { credito: true } } } }, sucessora: { select: { id: true } } },
      });
      return {
        podePropor: podePreparar(usuario.papeis) && cadeiaPermiteNovaProposta && motivoFonteIndisponivel === null,
        podeReconferir,
        motivoFonteIndisponivel,
        previaCredito,
        aplicacaoPendente: "Uma decisão aprovada ainda exige executor financeiro próprio.",
        propostas: propostas.map((proposta) => ({
          ...projetarProposta(proposta),
          podeDecidir:
            proposta.id === ultima?.id &&
            proposta.decisao === null &&
            proposta.autorId !== sessao.id &&
            podeDecidir(usuario.papeis, usuario.permissoes),
          podeAplicar:
            proposta.id === ultima?.id &&
            proposta.decisao?.aprovada === true &&
            proposta.decisao.aplicacao === null &&
            !podeReconferir &&
            podePreparar(usuario.papeis),
        })),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
