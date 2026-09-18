import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { carregarAplicacoesCamposTx } from "@/server/contratos/aditivo-aplicacao-campos-tx";
import { CicloCoberturaFuturoAditivoSchema } from "@/server/contratos/aditivo-schema";
import { RegraCoberturaContinuidadeSchema, ReferenciaAditivoCoberturaContinuidadeSchema } from "./continuidade-mensal-schema";

const cobertura = new Set(["COBERTURA_INICIO", "COBERTURA_FIM"]);
const civil = (data: Date) => data.toISOString().slice(0, 10);

export type ReferenciaAditivoCoberturaAplicada = Readonly<{
  referencia: ReturnType<typeof ReferenciaAditivoCoberturaContinuidadeSchema.parse>;
  aplicadaEm: string;
  politica: ReturnType<typeof CicloCoberturaFuturoAditivoSchema.parse>;
  historico: ReadonlyArray<{ referencia: ReturnType<typeof ReferenciaAditivoCoberturaContinuidadeSchema.parse>; aplicadaEm: string; politica: ReturnType<typeof CicloCoberturaFuturoAditivoSchema.parse> }>;
}>;

/**
 * Deriva a política da cadeia formalizada e da prova completa Q168. Uma política
 * PRESERVAR mantém a referência que já estava em vigor; não reconstitui o ciclo
 * original depois de uma mudança anterior.
 */
export async function carregarReferenciaAditivoCoberturaAplicadaTx(
  tx: Prisma.TransactionClient,
  input: { matriculaId: string; inicioCobertura: Date; regraContratada: unknown },
): Promise<ReferenciaAditivoCoberturaAplicada | null> {
  if (!Number.isFinite(input.inicioCobertura.getTime()) || input.inicioCobertura.toISOString().slice(11) !== "00:00:00.000Z") {
    throw new ErroRegra("O início da continuidade deve ser uma data civil UTC.");
  }
  const regraInicial = RegraCoberturaContinuidadeSchema.parse(input.regraContratada);
  const fimExclusivo = new Date(input.inicioCobertura);
  fimExclusivo.setUTCDate(fimExclusivo.getUTCDate() + 1);
  const versoes = await carregarAplicacoesCamposTx(tx, input.matriculaId, fimExclusivo);
  let regraAplicada = regraInicial;
  let ultima: ReferenciaAditivoCoberturaAplicada | null = null;
  const historico: Array<{ referencia: ReturnType<typeof ReferenciaAditivoCoberturaContinuidadeSchema.parse>; aplicadaEm: string; politica: ReturnType<typeof CicloCoberturaFuturoAditivoSchema.parse> }> = [];
  for (const versao of versoes
    .filter(v => v.vigenciaInicio <= input.inicioCobertura && v.alteracoes.some(a => cobertura.has(a.origem)))
    .sort((a, b) => a.vigenciaInicio.getTime() - b.vigenciaInicio.getTime() || a.versao - b.versao)) {
    const origens = new Set(versao.alteracoes.filter(a => cobertura.has(a.origem)).map(a => a.origem));
    if (origens.size !== 2) throw new ErroRegra("A versão vigente altera cobertura de forma incompleta.");
    if (!versao.conjuntoCoberturaCompleto) throw new ErroRegra("A política de cobertura vigente aguarda aplicação integral comprovada.");
    const politica = CicloCoberturaFuturoAditivoSchema.parse(versao.conjuntoCoberturaCompleto.politica);
    if (politica.escolha === "MUDAR_REFERENCIA") regraAplicada = politica.referencia === "MES_CIVIL"
      ? { referencia: "MES_CIVIL" }
      : { referencia: "CICLO_MATRICULA", dataReferencia: politica.dataReferencia };
    const referencia = ReferenciaAditivoCoberturaContinuidadeSchema.parse({
        conjuntoId: versao.conjuntoCoberturaCompleto.id,
        versaoCondicoesId: versao.id,
        decisaoId: versao.conjuntoCoberturaCompleto.decisaoId,
        regraAplicada,
      });
    historico.push({ referencia, aplicadaEm: versao.conjuntoCoberturaCompleto.aplicadaEm, politica });
    ultima = { referencia, aplicadaEm: versao.conjuntoCoberturaCompleto.aplicadaEm, politica, historico };
  }
  return ultima;
}
