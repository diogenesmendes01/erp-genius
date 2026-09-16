import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { validarValorAlteracaoAditivo } from "./aditivo-valores";
import { hashSubstituicao } from "./substituicao-estado";

type VersaoCondicoesMensal = {
  id: string;
  versao: number;
  condicoes: Prisma.JsonValue;
  condicoesHash: string;
  vigenciaInicio: Date;
};

type EntradaMensalVigente = {
  matriculaId: string;
  inicioCobertura: Date;
  fimCobertura: Date;
  valorOriginal: string;
  valorNegociadoOriginal: string;
  moedaOriginal: string;
};

function fimCivilExclusivo(fimCobertura: Date): Date {
  if (
    fimCobertura.getUTCHours() !== 0 ||
    fimCobertura.getUTCMinutes() !== 0 ||
    fimCobertura.getUTCSeconds() !== 0 ||
    fimCobertura.getUTCMilliseconds() !== 0
  ) {
    throw new ErroRegra("O fim da cobertura mensal deve ser uma data civil em UTC.");
  }

  const fimExclusivo = new Date(fimCobertura);
  fimExclusivo.setUTCDate(fimExclusivo.getUTCDate() + 1);
  return fimExclusivo;
}

function validarCobertura(inicioCobertura: Date, fimCobertura: Date): Date {
  if (
    !Number.isFinite(inicioCobertura.getTime()) ||
    !Number.isFinite(fimCobertura.getTime()) ||
    fimCobertura < inicioCobertura
  ) {
    throw new ErroRegra("Cobertura mensal inválida.");
  }

  if (inicioCobertura.toISOString().slice(11) !== "00:00:00.000Z") {
    throw new ErroRegra("O início da cobertura mensal deve ser uma data civil em UTC.");
  }
  return fimCivilExclusivo(fimCobertura);
}

function condicoesObjeto(condicoes: Prisma.JsonValue): Record<string, unknown> {
  if (condicoes === null || Array.isArray(condicoes) || typeof condicoes !== "object") {
    throw new ErroRegra("Condições formalizadas divergentes.");
  }

  return condicoes as Record<string, unknown>;
}

function resumoFinanceiro(versao: VersaoCondicoesMensal): string {
  if (hashSubstituicao(versao.condicoes) !== versao.condicoesHash) {
    throw new ErroRegra("Condições formalizadas divergentes.");
  }

  const condicoes = condicoesObjeto(versao.condicoes);
  if (
    "COBERTURA_INICIO" in condicoes ||
    "COBERTURA_FIM" in condicoes ||
    "PRIMEIRA_MENSALIDADE_VENCIMENTO" in condicoes
  ) {
    throw new ErroRegra("Alterações de cobertura ou vencimento exigem fluxo próprio.");
  }

  return hashSubstituicao({
    MENSALIDADE_VALOR: condicoes.MENSALIDADE_VALOR ?? null,
    MOEDA: condicoes.MOEDA ?? null,
    REGIME: condicoes.REGIME ?? null,
  });
}

export function resolverMensalVigente(
  versoes: readonly VersaoCondicoesMensal[],
  inicioCobertura: Date,
  fimCobertura: Date,
  valorOriginal: string,
  valorNegociadoOriginal: string,
  moedaOriginal: string,
) {
  const fimExclusivo = validarCobertura(inicioCobertura, fimCobertura);
  const efetiva = [...versoes]
    .filter((versao) => versao.vigenciaInicio <= inicioCobertura)
    .sort(
      (a, b) =>
        b.vigenciaInicio.getTime() - a.vigenciaInicio.getTime() || b.versao - a.versao,
    )[0];

  const resumoBase = efetiva
    ? resumoFinanceiro(efetiva)
    : hashSubstituicao({ MENSALIDADE_VALOR: null, MOEDA: null, REGIME: null });

  const possuiMudancaFinanceiraNaCobertura = versoes
    .filter(
      (versao) =>
        versao.vigenciaInicio > inicioCobertura && versao.vigenciaInicio < fimExclusivo,
    )
    .some((versao) => resumoFinanceiro(versao) !== resumoBase);

  if (possuiMudancaFinanceiraNaCobertura) {
    throw new ErroRegra("Há mudança financeira durante a cobertura mensal.");
  }

  if (!efetiva) {
    return {
      valorOriginal,
      valorNegociado: valorNegociadoOriginal,
      moeda: moedaOriginal,
      versaoAditivo: null,
    };
  }

  resumoFinanceiro(efetiva);
  const condicoes = condicoesObjeto(efetiva.condicoes);

  if (condicoes.REGIME) {
    const regime = validarValorAlteracaoAditivo("REGIME", condicoes.REGIME);
    if (regime.tipo !== "REGIME" || regime.regime !== "MENSALIDADE") {
      throw new ErroRegra("O regime formalizado não permite mensalidade.");
    }
  }

  if (condicoes.MOEDA) {
    const moeda = validarValorAlteracaoAditivo("MOEDA", condicoes.MOEDA);
    if (moeda.tipo !== "MOEDA" || moeda.moeda !== moedaOriginal) {
      throw new ErroRegra("Mudança de moeda exige fluxo próprio.");
    }
  }

  const valor = condicoes.MENSALIDADE_VALOR
    ? validarValorAlteracaoAditivo("MENSALIDADE_VALOR", condicoes.MENSALIDADE_VALOR)
    : null;
  if (valor && valor.tipo !== "DINHEIRO") {
    throw new ErroRegra("Valor mensal formalizado inválido.");
  }
  if (valor?.tipo === "DINHEIRO" && valor.moeda !== moedaOriginal) {
    throw new ErroRegra("Valor mensal usa moeda incompatível.");
  }

  return {
    valorOriginal,
    valorNegociado: valor?.tipo === "DINHEIRO" ? valor.valor : valorNegociadoOriginal,
    moeda: moedaOriginal,
    versaoAditivo: {
      id: efetiva.id,
      versao: efetiva.versao,
      condicoesHash: efetiva.condicoesHash,
    },
  };
}

export async function resolverMensalVigenteTx(
  tx: Prisma.TransactionClient,
  input: EntradaMensalVigente,
) {
  const fimExclusivo = validarCobertura(input.inicioCobertura, input.fimCobertura);
  const versoes = await tx.versaoCondicoesAditivo.findMany({
    where: {
      matriculaId: input.matriculaId,
      vigenciaInicio: { lt: fimExclusivo },
    },
    select: {
      id: true,
      versao: true,
      condicoes: true,
      condicoesHash: true,
      vigenciaInicio: true,
    },
  });

  return resolverMensalVigente(
    versoes,
    input.inicioCobertura,
    input.fimCobertura,
    input.valorOriginal,
    input.valorNegociadoOriginal,
    input.moedaOriginal,
  );
}
