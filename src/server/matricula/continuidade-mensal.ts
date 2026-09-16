import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { periodoMensalNaData, type RegraCobertura } from "./cobertura";
import { ajustarVencimentoDiaUtil, ErroConferenciaVencimento } from "@/server/financeiro/vencimento-dia-util";
import {
  DataCivilContinuidadeSchema,
  PlanejarContinuidadeMensalSchema,
  ReferenciaRecomposicaoContinuidadeSchema,
  type EntradaPlanejarContinuidadeMensal,
} from "./continuidade-mensal-schema";

const DIA = 86_400_000;

function dataUtc(data: string): Date { return new Date(`${data}T00:00:00.000Z`); }
function criarDataCivilUtc(ano: number, mes: number, dia: number): Date {
  const resultado = new Date(0); resultado.setUTCHours(0, 0, 0, 0); resultado.setUTCFullYear(ano, mes, dia); return resultado;
}
function dataCivil(data: Date): string {
  if (!Number.isFinite(data.getTime())) throw new ErroRegra("A data calculada está fora do intervalo civil suportado.");
  try { return DataCivilContinuidadeSchema.parse(data.toISOString().slice(0, 10)); }
  catch { throw new ErroRegra("A data calculada está fora do intervalo civil suportado."); }
}
function proximoDiaCivil(data: string): string { return dataCivil(new Date(dataUtc(data).getTime() + DIA)); }
function vencimentoDaCobertura(inicioCobertura: string, referenciaVencimento: "MES_COBERTURA" | "MES_ANTERIOR" | "MES_SEGUINTE", diaVencimento: number): string {
  const offset = referenciaVencimento === "MES_ANTERIOR" ? -1 : referenciaVencimento === "MES_SEGUINTE" ? 1 : 0;
  const inicio = dataUtc(inicioCobertura);
  const primeiroDoMes = criarDataCivilUtc(inicio.getUTCFullYear(), inicio.getUTCMonth() + offset, 1);
  const primeiroDoMesSeguinte = criarDataCivilUtc(primeiroDoMes.getUTCFullYear(), primeiroDoMes.getUTCMonth() + 1, 1);
  const ultimoDia = new Date(primeiroDoMesSeguinte.getTime() - DIA).getUTCDate();
  return dataCivil(criarDataCivilUtc(primeiroDoMes.getUTCFullYear(), primeiroDoMes.getUTCMonth(), Math.min(diaVencimento, ultimoDia)));
}
function subtrairDias(data: string, dias: number): string {
  if (!Number.isSafeInteger(dias)) throw new ErroRegra("A antecedência em dias excede o limite técnico suportado.");
  const resultado = dataUtc(data); resultado.setUTCDate(resultado.getUTCDate() - dias); return dataCivil(resultado);
}

/** Q30/Q64: prepara exclusivamente a próxima cobertura contratada. */
export function planejarContinuidadeMensal(input: EntradaPlanejarContinuidadeMensal) {
  return calcularContinuidadeMensal(input, { retomadaAplicada: false });
}
/** Q66: aceita somente o trecho final do período contratado após retomada aplicada. */
export function planejarContinuidadeMensalAposRetomada(input: EntradaPlanejarContinuidadeMensal) {
  return calcularContinuidadeMensal(input, { retomadaAplicada: true });
}
/** Q162: uma Q70 aplicada desloca o ciclo, sem reescrever a regra contratual. */
export function planejarContinuidadeMensalAposRecomposicao(input: EntradaPlanejarContinuidadeMensal, referencia: unknown) {
  const memoria = ReferenciaRecomposicaoContinuidadeSchema.parse(referencia);
  return calcularContinuidadeMensal(input, {
    retomadaAplicada: false,
    regraRecomposicao: { referencia: "CICLO_MATRICULA", dataReferencia: memoria.dataReferencia },
    memoriaRecomposicao: memoria,
  });
}

function calcularContinuidadeMensal(input: EntradaPlanejarContinuidadeMensal, opcoes: {
  retomadaAplicada: boolean;
  regraRecomposicao?: Extract<RegraCobertura, { referencia: "CICLO_MATRICULA" }>;
  memoriaRecomposicao?: z.infer<typeof ReferenciaRecomposicaoContinuidadeSchema>;
}) {
  const dados = PlanejarContinuidadeMensalSchema.parse(input);
  const regra = opcoes.regraRecomposicao ?? dados.regraCobertura;
  const primeiraAposRecomposicao = Boolean(
    opcoes.regraRecomposicao && proximoDiaCivil(dados.ultimaCobertura.fim) === opcoes.regraRecomposicao.dataReferencia,
  );
  if (opcoes.regraRecomposicao && !primeiraAposRecomposicao && dados.ultimaCobertura.fim < opcoes.regraRecomposicao.dataReferencia) {
    throw new ErroRegra("A última cobertura é anterior à âncora aplicada da recomposição; confira a cadeia.");
  }
  if (!primeiraAposRecomposicao) {
    const coberturaAtual = periodoMensalNaData(regra, dados.ultimaCobertura.inicio);
    if ((!opcoes.retomadaAplicada && coberturaAtual.inicio !== dados.ultimaCobertura.inicio) || coberturaAtual.fim !== dados.ultimaCobertura.fim) {
      throw new ErroRegra("A última cobertura não corresponde a um período completo da referência contratual.");
    }
  }
  const proximaCobertura = periodoMensalNaData(regra, primeiraAposRecomposicao ? opcoes.regraRecomposicao!.dataReferencia : proximoDiaCivil(dados.ultimaCobertura.fim));
  if (proximaCobertura.inicio < dados.vigenteDesde) throw new ErroRegra("A continuidade contratada ainda não está vigente para a próxima cobertura.");
  const vencimentoCalculado = vencimentoDaCobertura(proximaCobertura.inicio, dados.referenciaVencimento, dados.diaVencimento);
  let memoriaVencimento: ReturnType<typeof ajustarVencimentoDiaUtil>;
  try { memoriaVencimento = ajustarVencimentoDiaUtil({ dataCalculada: vencimentoCalculado, regra: dados.ajusteVencimento === "MANTER_DATA" ? { regra: "MANTER_DATA" } : dados.ajusteVencimento }); }
  catch (erro) { if (erro instanceof ErroConferenciaVencimento) throw new ErroRegra(erro.message); throw erro; }
  const vencimento = memoriaVencimento.dataAjustada;
  const emissaoEm = subtrairDias(vencimento, dados.antecedenciaDias);
  return {
    cobertura: proximaCobertura, vencimento, emissaoEm, memoriaVencimento,
    valorOriginal: dados.valorOriginal, valorNegociado: dados.valorNegociado, moeda: dados.moeda,
    ...(opcoes.memoriaRecomposicao ? { memoriaCobertura: { regraContratada: dados.regraCobertura, regraAplicada: regra, origemRecomposicao: opcoes.memoriaRecomposicao } } : {}),
    status: dados.dataPlanejamento < emissaoEm ? ("AGUARDAR_EMISSAO" as const) : ("PRONTA_PARA_EMISSAO" as const),
  };
}


