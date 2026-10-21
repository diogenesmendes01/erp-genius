import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { DataCivilSchema } from "./cobertura";

const Entrada = z.object({
  matriculaId: z.string().min(1),
  inicio: z.date(),
  fim: z.date(),
}).strict();

const PeriodoRecomposicaoSchema = z.object({
  cobrancaId: z.string().trim().min(1),
  cobertura: z.object({ inicio: DataCivilSchema, fim: DataCivilSchema }).strict(),
  alterado: z.boolean(),
}).passthrough();

const SnapshotRecomposicaoSchema = z.object({
  proposta: z.object({
    periodos: z.array(PeriodoRecomposicaoSchema.passthrough()),
  }).passthrough(),
}).passthrough();

export type ReferenciaRecomposicaoAplicada = Readonly<{
  aplicacaoId: string;
  decisaoId: string;
  cobrancaId: string;
  aplicadaEm: string;
  dataReferencia: string;
}>;

function conferirDataCivil(data: Date) {
  if (
    !Number.isFinite(data.getTime()) ||
    data.getUTCHours() !== 0 ||
    data.getUTCMinutes() !== 0 ||
    data.getUTCSeconds() !== 0 ||
    data.getUTCMilliseconds() !== 0
  ) {
    throw new ErroRegra("A conferÃªncia de compensaÃ§Ã£o exige datas civis UTC.");
  }
}

const civil = (data: Date) => data.toISOString().slice(0, 10);
const diaSeguinte = (data: string) => {
  const proximo = new Date(`${data}T00:00:00.000Z`);
  proximo.setUTCDate(proximo.getUTCDate() + 1);
  return DataCivilSchema.parse(civil(proximo));
};

/**
 * Q162: a aplicaÃ§Ã£o Q70 Ã© a Ãºnica fonte que desloca a Ã¢ncora mensal. A Ãºltima
 * aplicaÃ§Ã£o da matrÃ­cula precisa continuar coerente com todas as cobranÃ§as que
 * ela alterou; nÃ£o hÃ¡ fallback para uma aplicaÃ§Ã£o mais antiga ou legado.
 */
export async function carregarReferenciaRecomposicaoAplicadaTx(
  tx: Pick<Prisma.TransactionClient, "aplicacaoRecomposicaoCobertura" | "aplicacaoCoberturaAditivo" | "cobranca">,
  matriculaId: string,
): Promise<ReferenciaRecomposicaoAplicada | null> {
  const aplicacao = await tx.aplicacaoRecomposicaoCobertura.findFirst({
    where: { decisao: { aprovada: true, rascunho: { matriculaId } } },
    orderBy: [{ aplicadaEm: "desc" }, { id: "desc" }],
    select: {
      id: true,
      decisaoId: true,
      aplicadaEm: true,
      decisao: { select: { rascunho: { select: { snapshot: true } } } },
    },
  });
  if (!aplicacao) return null;

  const snapshot = SnapshotRecomposicaoSchema.safeParse(aplicacao.decisao.rascunho.snapshot);
  if (!snapshot.success) {
    throw new ErroRegra("A memÃ³ria da Ãºltima recomposiÃ§Ã£o aplicada Ã© invÃ¡lida; confira a continuidade.");
  }
  const alterados = snapshot.data.proposta.periodos.filter((periodo) => periodo.alterado === true);
  if (alterados.length === 0 || new Set(alterados.map((periodo) => periodo.cobrancaId)).size !== alterados.length) {
    throw new ErroRegra("A memÃ³ria da Ãºltima recomposiÃ§Ã£o nÃ£o identifica os perÃ­odos deslocados.");
  }

  const atuais = await tx.cobranca.findMany({
    where: {
      matriculaId,
      tipo: "MENSALIDADE",
      status: { not: "CANCELADA" },
      id: { in: alterados.map((periodo) => periodo.cobrancaId) },
    },
    select: { id: true, coberturaInicio: true, coberturaFim: true, versao: true },
  });
  if (atuais.length !== alterados.length) {
    throw new ErroRegra("A Ãºltima recomposiÃ§Ã£o nÃ£o corresponde mais Ã s cobranÃ§as desta matrÃ­cula.");
  }
  const porId = new Map(atuais.map((cobranca) => [cobranca.id, cobranca]));
  for (const periodo of alterados) {
    const atual = porId.get(periodo.cobrancaId);
    if (!atual || !atual.coberturaInicio || !atual.coberturaFim ||
      civil(atual.coberturaInicio) !== periodo.cobertura.inicio || civil(atual.coberturaFim) !== periodo.cobertura.fim) {
      const coberturaInicioAtual = atual?.coberturaInicio;
      const coberturaFimAtual = atual?.coberturaFim;
      const versaoAtual = atual?.versao;
      if (!coberturaInicioAtual || !coberturaFimAtual || versaoAtual === undefined) {
        throw new ErroRegra("A Ãºltima recomposiÃ§Ã£o foi alterada por outra origem; confira a continuidade antes de prosseguir.");
      }
      // A sucessão Q168 pode conter mais de uma aplicação válida. Cada elo
      // precisa partir do intervalo e da versão deixados pelo anterior; uma
      // aplicação isolada não pode encobrir lacuna ou alteração manual.
      const posteriores = await tx.aplicacaoCoberturaAditivo.findMany({
        where: {
          cobrancaId: periodo.cobrancaId,
          aplicadaEm: { gt: aplicacao.aplicadaEm },
          impacto: { conjunto: { matriculaId, status: "COMPLETO" } },
        },
        orderBy: [{ aplicadaEm: "asc" }, { id: "asc" }],
        select: {
          coberturaInicioAnterior: true, coberturaFimAnterior: true,
          coberturaInicioNova: true, coberturaFimNova: true,
          versaoCobrancaAntes: true, versaoCobrancaDepois: true,
        },
      });
      let inicioEsperado = new Date(`${periodo.cobertura.inicio}T00:00:00.000Z`);
      let fimEsperado = new Date(`${periodo.cobertura.fim}T00:00:00.000Z`);
      let versaoEsperada: number | null = null;
      for (const posterior of posteriores) {
        if (
          posterior.coberturaInicioAnterior.getTime() !== inicioEsperado.getTime() ||
          posterior.coberturaFimAnterior.getTime() !== fimEsperado.getTime() ||
          posterior.versaoCobrancaDepois !== posterior.versaoCobrancaAntes + 1 ||
          (versaoEsperada !== null && posterior.versaoCobrancaAntes !== versaoEsperada)
        ) throw new ErroRegra("A Ãºltima recomposiÃ§Ã£o foi alterada por outra origem; confira a continuidade antes de prosseguir.");
        inicioEsperado = posterior.coberturaInicioNova;
        fimEsperado = posterior.coberturaFimNova;
        versaoEsperada = posterior.versaoCobrancaDepois;
      }
      if (
        !posteriores.length ||
        inicioEsperado.getTime() !== coberturaInicioAtual.getTime() ||
        fimEsperado.getTime() !== coberturaFimAtual.getTime() ||
        versaoEsperada !== versaoAtual
      ) throw new ErroRegra("A Ãºltima recomposiÃ§Ã£o foi alterada por outra origem; confira a continuidade antes de prosseguir.");
    }
  }

  const final = [...alterados].sort((a, b) =>
    a.cobertura.fim.localeCompare(b.cobertura.fim) || a.cobrancaId.localeCompare(b.cobrancaId),
  ).at(-1)!;
  return Object.freeze({
    aplicacaoId: aplicacao.id,
    decisaoId: aplicacao.decisaoId,
    cobrancaId: final.cobrancaId,
    aplicadaEm: aplicacao.aplicadaEm.toISOString(),
    dataReferencia: diaSeguinte(final.cobertura.fim),
  });
}

/**
 * Q70: dias jÃ¡ destinados a compensaÃ§Ã£o nÃ£o podem integrar uma nova mensalidade.
 * A consulta Ã© isolada para que o emissor e a prÃ©via usem a mesma barreira.
 */
export async function conferirCompensacaoProgramadaContinuidadeTx(
  tx: Pick<Prisma.TransactionClient, "diaProgramadoRecomposicao">,
  input: z.input<typeof Entrada>,
) {
  const dados = Entrada.parse(input);
  conferirDataCivil(dados.inicio);
  conferirDataCivil(dados.fim);
  if (dados.fim < dados.inicio) {
    throw new ErroRegra("Intervalo de cobertura invÃ¡lido para conferir compensaÃ§Ã£o.");
  }

  const programacao = await tx.diaProgramadoRecomposicao.findFirst({
    where: {
      dataCobertura: { gte: dados.inicio, lte: dados.fim },
      aplicacao: { decisao: { rascunho: { matriculaId: dados.matriculaId } } },
    },
    orderBy: [{ dataCobertura: "asc" }, { id: "asc" }],
    select: { id: true, direitoId: true, dataCobertura: true },
  });
  if (programacao) {
    throw new ErroRegra(
      `A prÃ³xima cobertura alcanÃ§a o dia compensado ${programacao.dataCobertura.toISOString().slice(0, 10)}; revise a cobertura sem cobrar esse dia.`,
    );
  }
}



/** Q162 não escolhe precedência entre a recomposição e aplicações posteriores da mesma matrícula. */
export async function conferirOrigensConcorrentesAposRecomposicaoTx(
  tx: Pick<Prisma.TransactionClient, "aplicacaoPeriodoIntegral" | "itemPropostaRetomadaMatriculas">,
  input: { matriculaId: string; aplicadaEm: string },
) {
  const aplicadaEm = new Date(input.aplicadaEm);
  if (!Number.isFinite(aplicadaEm.getTime())) throw new ErroRegra("A data da recomposição aplicada é inválida.");
  const [periodoIntegral, retomada] = await Promise.all([
    tx.aplicacaoPeriodoIntegral.findFirst({ where: { matriculaId: input.matriculaId, aplicadaEm: { gt: aplicadaEm } }, select: { id: true } }),
    tx.itemPropostaRetomadaMatriculas.findFirst({ where: { matriculaId: input.matriculaId, proposta: { status: "APLICADA", aplicadaEm: { gt: aplicadaEm } } }, select: { id: true } }),
  ]);
  if (periodoIntegral || retomada) throw new ErroRegra("Há origem de cobertura aplicada depois da recomposição; confira a cadeia antes de planejar.");
}
