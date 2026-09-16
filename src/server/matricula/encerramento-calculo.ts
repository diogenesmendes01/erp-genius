import { Prisma } from "@prisma/client";
import { z } from "zod";
import { DataCivilSchema } from "./cobertura";

const Valor = z.string().refine((v) => /^\d+(?:\.\d{1,2})?$/.test(v), "Valor monetário inválido.");
export const ParcelaEncerramentoSchema = z.object({
  contratoVersaoId: z.string().min(1), cobrancaId: z.string().min(1), moeda: z.string().length(3),
  coberturaInicio: DataCivilSchema, coberturaFim: DataCivilSchema, dataEfetiva: DataCivilSchema,
  diaEncerramento: z.enum(["INCLUIR", "EXCLUIR"]),
  metodoDesconto: z.enum(["ANTES_DO_PROPORCIONAL", "DEPOIS_DO_PROPORCIONAL"]),
  valorBase: Valor, descontoValido: Valor, recebido: Valor, creditoLiquidado: Valor.optional(),
}).strict().superRefine((d, ctx) => {
  if (d.coberturaFim < d.coberturaInicio) ctx.addIssue({ code: "custom", message: "Cobertura invertida.", path: ["coberturaFim"] });
  if (Valor.safeParse(d.descontoValido).success && Valor.safeParse(d.valorBase).success && new Prisma.Decimal(d.descontoValido).gt(d.valorBase)) ctx.addIssue({ code: "custom", message: "Desconto superior à base exige conferência.", path: ["descontoValido"] });
});
const DIA = 86_400_000;
const data = (civil: string) => new Date(`${civil}T00:00:00.000Z`).getTime();

/** Q15/Q28/Q63: uma parcela do acerto, sem executar ajuste, crédito ou devolução. */
export function calcularParcelaEncerramento(input: z.input<typeof ParcelaEncerramentoSchema>) {
  const d = ParcelaEncerramentoSchema.parse(input);
  const inicio = data(d.coberturaInicio), fim = data(d.coberturaFim);
  const limite = data(d.dataEfetiva) - (d.diaEncerramento === "EXCLUIR" ? DIA : 0);
  const diasPeriodo = (fim - inicio) / DIA + 1;
  const diasCobertos = Math.max(0, Math.min(diasPeriodo, (limite - inicio) / DIA + 1));
  const base = new Prisma.Decimal(d.valorBase), desconto = new Prisma.Decimal(d.descontoValido);
  const fracao = new Prisma.Decimal(diasCobertos).div(diasPeriodo);
  const bruto = d.metodoDesconto === "ANTES_DO_PROPORCIONAL"
    ? base.minus(desconto).mul(fracao)
    : base.mul(fracao).minus(desconto);
  const valorDevido = Prisma.Decimal.max(0, bruto).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const liquidado = new Prisma.Decimal(d.recebido).plus(d.creditoLiquidado ?? 0);
  return {
    ...d, diasPeriodo, diasCobertos,
    ultimoDiaCoberto: diasCobertos ? new Date(Math.min(fim, limite)).toISOString().slice(0, 10) : null,
    valorDevido: valorDevido.toFixed(2),
    saldoDevido: Prisma.Decimal.max(0, valorDevido.minus(liquidado)).toFixed(2),
    creditoApurado: Prisma.Decimal.max(0, liquidado.minus(valorDevido)).toFixed(2),
    memoria: { base: base.toFixed(2), desconto: desconto.toFixed(2), numerador: diasCobertos, denominador: diasPeriodo, valorAntesArredondamento: Prisma.Decimal.max(0, bruto).toString(), arredondamento: "HALF_UP_2_CASAS" },
  };
}
