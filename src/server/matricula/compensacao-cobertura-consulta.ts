"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, ErroRegra, executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { apurarDiasIndisponibilidadeCoberturaTx } from "./apuracao-indisponibilidade-cobertura";
import { DataCivilSchema } from "./cobertura";

const ConsultaSchema = z.object({
  matriculaId: z.string().min(1),
  cobrancaId: z.string().min(1),
}).strict();

const DiasSchema = z.array(DataCivilSchema).min(1).max(366).refine((dias) => new Set(dias).size === dias.length, "Dias de compensação inválidos.");

function dataCivil(data: Date) {
  return data.toISOString().slice(0, 10);
}

/** Consulta os direitos de compensação sem preparar, aprovar ou recompor qualquer cobertura. */
export async function consultarCompensacoesCobertura(input: z.input<typeof ConsultaSchema>) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    const dados = ConsultaSchema.parse(input);

    return prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.findUnique({
        where: { id: sessao.id },
        select: { ativo: true, papeis: true, permissoes: true },
      });
      if (!usuario?.ativo || (!usuario.papeis.includes(Papel.ADMINISTRADOR) && !usuario.papeis.includes(Papel.FINANCEIRO))) {
        throw new ErroPermissao();
      }

      const cobranca = await tx.cobranca.findFirst({
        where: { id: dados.cobrancaId, matriculaId: dados.matriculaId },
        select: { id: true, tipo: true, versao: true, coberturaInicio: true, coberturaFim: true },
      });
      if (!cobranca || cobranca.tipo !== "MENSALIDADE" || !cobranca.coberturaInicio || !cobranca.coberturaFim || cobranca.coberturaFim < cobranca.coberturaInicio) {
        throw new ErroRegra("A compensação exige uma mensalidade desta matrícula com cobertura válida.");
      }

      const [apuracao, direitos, propostas] = await Promise.all([
        apurarDiasIndisponibilidadeCoberturaTx(tx, {
          matriculaId: dados.matriculaId,
          inicio: cobranca.coberturaInicio,
          fim: cobranca.coberturaFim,
        }),
        tx.diaCompensacaoCobertura.findMany({
          where: {
            matriculaId: dados.matriculaId,
            diaOrigem: { gte: cobranca.coberturaInicio, lte: cobranca.coberturaFim },
          },
          select: { diaOrigem: true },
        }),
        tx.compensacaoCoberturaMatricula.findMany({
          where: { matriculaId: dados.matriculaId, cobrancaOrigemId: cobranca.id },
          orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
          take: 20,
          select: {
            id: true,
            preparadorId: true,
            status: true,
            motivo: true,
            evidenciaCondicoes: true,
            diasPropostos: true,
            motivoDecisao: true,
            criadoEm: true,
            decididaEm: true,
          },
        }),
      ]);
      const podeDecidir = usuario.papeis.includes(Papel.ADMINISTRADOR) || usuario.permissoes.includes("financeiro.aprovar_acertos");

      return {
        cobranca: {
          id: cobranca.id,
          versao: cobranca.versao,
          coberturaInicio: dataCivil(cobranca.coberturaInicio),
          coberturaFim: dataCivil(cobranca.coberturaFim),
        },
        apuracao,
        diasComDireito: direitos.map((direito) => dataCivil(direito.diaOrigem)).sort(),
        propostas: propostas.map((proposta) => ({
          id: proposta.id,
          status: proposta.status,
          motivo: proposta.motivo,
          evidenciaCondicoes: proposta.evidenciaCondicoes,
          dias: DiasSchema.parse(proposta.diasPropostos),
          motivoDecisao: proposta.motivoDecisao,
          criadaEm: proposta.criadoEm.toISOString(),
          decididaEm: proposta.decididaEm?.toISOString() ?? null,
          podeDecidir: proposta.status === "PENDENTE" && proposta.preparadorId !== sessao.id && podeDecidir,
        })),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
