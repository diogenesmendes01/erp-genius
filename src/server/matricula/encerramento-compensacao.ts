import { Prisma } from "@prisma/client";
import { z } from "zod";
import { DataCivilSchema } from "./cobertura";

const Dias = z.array(DataCivilSchema).max(3660).refine((dias) => new Set(dias).size === dias.length, "Dia repetido na compensação.");
export const CompensacaoEncerramentoSchema = z.object({
  matriculaId: z.string().min(1), condicoesId: z.string().min(1), cobrancaOrigemId: z.string().min(1),
  compensacaoId: z.string().min(1), moeda: z.string().regex(/^[A-Z]{3}$/),
  coberturaOriginalInicio: DataCivilSchema, coberturaOriginalFim: DataCivilSchema,
  valorCoberturaOriginalConferido: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
  regraCalculo: z.literal("DIAS_REAIS_PERIODO_ORIGEM"),
  evidenciaCondicoes: z.string().trim().min(5).max(2000),
  diasIndisponiveis: Dias,
  diasRecompostos: Dias,
  diasLiquidadosFinanceiramente: Dias,
  diasContempladosNoProporcional: Dias,
}).strict().superRefine((d, ctx) => {
  const falha = (message: string) => ctx.addIssue({ code: "custom", message });
  if (d.coberturaOriginalFim < d.coberturaOriginalInicio) falha("Período original invertido.");
  const origem = new Set(d.diasIndisponiveis);
  if (d.diasIndisponiveis.some((dia) => dia < d.coberturaOriginalInicio || dia > d.coberturaOriginalFim)) falha("Dia indisponível fora da cobertura original.");
  const destinos = [...d.diasRecompostos, ...d.diasLiquidadosFinanceiramente, ...d.diasContempladosNoProporcional];
  if (destinos.some((dia) => !origem.has(dia))) falha("Compensação aponta para dia que não consta na origem.");
  if (new Set(destinos).size !== destinos.length) falha("O mesmo dia aparece em mais de uma destinação; concilie o histórico.");
});

/** Q83: somente apuração do ajuste; não cria crédito, liquidação ou devolução. */
export function calcularCompensacaoPendenteEncerramento(input: z.input<typeof CompensacaoEncerramentoSchema>) {
  const d = CompensacaoEncerramentoSchema.parse(input);
  const resolvidos = new Set([...d.diasRecompostos, ...d.diasLiquidadosFinanceiramente, ...d.diasContempladosNoProporcional]);
  const diasPendentes = d.diasIndisponiveis.filter((dia) => !resolvidos.has(dia)).sort();
  const diasPeriodoOriginal = (Date.parse(`${d.coberturaOriginalFim}T00:00:00Z`) - Date.parse(`${d.coberturaOriginalInicio}T00:00:00Z`)) / 86_400_000 + 1;
  const base = new Prisma.Decimal(d.valorCoberturaOriginalConferido);
  const exato = base.mul(diasPendentes.length).div(diasPeriodoOriginal);
  return { origem: d, diasPendentes, quantidadePendente: diasPendentes.length,
    valorAjusteApurado: exato.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2),
    memoria: { valorCoberturaOriginal: base.toFixed(2), diasPeriodoOriginal, diasPendentes: diasPendentes.length,
      valorAntesArredondamento: exato.toString(), arredondamento: "HALF_UP_2_CASAS" },
  };
}
