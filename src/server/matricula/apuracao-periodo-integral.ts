import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { DataCivilSchema } from "./cobertura";

const DecimalSchema = z.string().regex(
  /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/,
  "Informe decimal canônico não negativo com até duas casas.",
);
const MoedaSchema = z.string().regex(/^[A-Z]{3}$/, "Informe moeda ISO de três letras.");
const DataCivilPersistivelSchema = DataCivilSchema.refine(
  (data) => data >= "0001-01-01",
  "Data fora do intervalo persistível.",
);

export const ApuracaoPeriodoIntegralSchema = z
  .object({
    cobrancaId: z.string().min(1),
    matriculaId: z.string().min(1),
    moeda: MoedaSchema,
    valorOriginal: DecimalSchema,
    valorNegociado: DecimalSchema,
    valorRecebido: DecimalSchema,
    valorLiquidadoCredito: DecimalSchema,
    saldoRegistrado: DecimalSchema.nullable(),
    recebimentos: z.array(
      z
        .object({
          id: z.string().min(1),
          valor: DecimalSchema,
          moeda: MoedaSchema,
        })
        .strict(),
    ),
    cobertura: z
      .object({ inicio: DataCivilPersistivelSchema, fim: DataCivilPersistivelSchema })
      .strict()
      .refine((cobertura) => cobertura.inicio <= cobertura.fim, "Cobertura invertida."),
    diasConfirmados: z.array(DataCivilPersistivelSchema),
    escolha: z.enum(["CREDITO", "COBERTURA_FUTURA"]),
  })
  .strict();

export type EntradaApuracaoPeriodoIntegral = z.input<typeof ApuracaoPeriodoIntegralSchema>;

function decimal(valor: string, campo: string): Prisma.Decimal {
  try {
    return new Prisma.Decimal(DecimalSchema.parse(valor));
  } catch {
    throw new ErroRegra(`${campo} deve ser decimal canônico não negativo com até duas casas.`);
  }
}

function formatar(valor: Prisma.Decimal): string {
  return valor.toFixed(2);
}

function totalDias(inicio: string, fim: string): number {
  const inicioData = new Date(`${inicio}T00:00:00.000Z`);
  const fimData = new Date(`${fim}T00:00:00.000Z`);
  return (fimData.getTime() - inicioData.getTime()) / 86_400_000 + 1;
}

/**
 * Monta a memória de tratamento de um período integralmente indisponível. O
 * resultado não cria crédito, não cancela cobrança e não transfere datas.
 */
export function apurarRegularizacaoPeriodoIntegral(
  input: EntradaApuracaoPeriodoIntegral,
) {
  const dados = ApuracaoPeriodoIntegralSchema.parse(input);
  const inicio = dados.cobertura.inicio;
  const fim = dados.cobertura.fim;
  const quantidadeCobertura = totalDias(inicio, fim);
  const diasUnicos = new Set(dados.diasConfirmados);
  if ([...diasUnicos].some((dia) => dia < inicio || dia > fim) || diasUnicos.size !== quantidadeCobertura) {
    throw new ErroRegra("A escolha exige indisponibilidade confirmada em todos os dias da cobertura.");
  }

  const idsRecebimentos = new Set<string>();
  let somaRecebimentos = new Prisma.Decimal(0);
  for (const recebimento of dados.recebimentos) {
    if (idsRecebimentos.has(recebimento.id)) {
      throw new ErroRegra("Há recebimento repetido na memória da cobrança.");
    }
    idsRecebimentos.add(recebimento.id);
    if (recebimento.moeda !== dados.moeda) {
      throw new ErroRegra("A moeda de um recebimento diverge da moeda da cobrança.");
    }
    somaRecebimentos = somaRecebimentos.plus(decimal(recebimento.valor, "O valor recebido"));
  }

  const valorOriginal = decimal(dados.valorOriginal, "O valor original");
  const valorNegociado = decimal(dados.valorNegociado, "O valor negociado");
  const valorRecebido = decimal(dados.valorRecebido, "O valor recebido");
  const valorLiquidadoCredito = decimal(
    dados.valorLiquidadoCredito,
    "O valor liquidado com crédito",
  );
  if (!somaRecebimentos.equals(valorRecebido)) {
    throw new ErroRegra("A soma dos recebimentos diverge do valor recebido registrado.");
  }
  const saldoCalculado = Prisma.Decimal.max(
    0,
    valorNegociado.minus(valorRecebido).minus(valorLiquidadoCredito),
  );
  if (dados.saldoRegistrado !== null && !decimal(dados.saldoRegistrado, "O saldo registrado").equals(saldoCalculado)) {
    throw new ErroRegra("O saldo registrado diverge do saldo reconciliado da cobrança.");
  }

  const memoriaBase = {
    cobrancaId: dados.cobrancaId,
    matriculaId: dados.matriculaId,
    moeda: dados.moeda,
    cobertura: dados.cobertura,
    diasConfirmados: [...diasUnicos].sort(),
    totalDias: quantidadeCobertura,
    valores: {
      valorOriginal: formatar(valorOriginal),
      valorNegociado: formatar(valorNegociado),
      valorRecebido: formatar(valorRecebido),
      valorLiquidadoCredito: formatar(valorLiquidadoCredito),
      saldoReconciliado: formatar(saldoCalculado),
    },
  };

  if (dados.escolha === "CREDITO") {
    const creditoDevolvido = valorRecebido.plus(valorLiquidadoCredito);
    return {
      ...memoriaBase,
      escolha: "CREDITO" as const,
      saldoADesobrigar: formatar(saldoCalculado),
      creditoPorRecebimentos: formatar(valorRecebido),
      creditoPorLiquidacaoPrevia: formatar(valorLiquidadoCredito),
      creditoAConstituir: formatar(creditoDevolvido),
    };
  }

  return {
    ...memoriaBase,
    escolha: "COBERTURA_FUTURA" as const,
    saldoAConservar: formatar(saldoCalculado),
    transferenciaCoberturaPendente: true as const,
  };
}
