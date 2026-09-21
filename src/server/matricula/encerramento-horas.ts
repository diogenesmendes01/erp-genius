import { Prisma } from "@prisma/client";
import { z } from "zod";

const dinheiro = z.string().regex(/^\d+(?:\.\d{1,2})?$/);
const minutos = z.number().int().positive().max(5256000);
const evidencia = z.string().trim().min(5).max(2000);
export const SaldoHorasEncerramentoSchema = z.object({
  matriculaId: z.string().min(1), moeda: z.string().regex(/^[A-Z]{3}$/),
  compras: z.array(z.object({
    compraId: z.string().min(1), matriculaId: z.string().min(1), moeda: z.string().regex(/^[A-Z]{3}$/),
    contratoVersaoId: z.string().min(1), recebimentoReferencia: z.string().min(1), evidenciaCondicoes: evidencia,
    minutosComprados: minutos, valorOriginal: dinheiro, descontoOriginal: dinheiro, valorPagoAlocado: dinheiro,
    minutosReservados: z.number().int().nonnegative(),
    consumos: z.array(z.object({ id: z.string().min(1), minutos, motivo: z.enum(["AULA_REALIZADA", "FALTA_COBRAVEL", "CANCELAMENTO_TARDIO_COBRAVEL"]), evidencia }).strict()),
    liquidacoesAnteriores: z.array(z.object({ id: z.string().min(1), minutos, valor: dinheiro, referenciaAcerto: z.string().min(1) }).strict()),
  }).strict()).max(1000),
}).strict().superRefine((d, ctx) => {
  const falha = (message: string) => ctx.addIssue({ code: "custom", message });
  if (new Set(d.compras.map((c) => c.compraId)).size !== d.compras.length) falha("Compra de horas repetida.");
  for (const c of d.compras) {
    if (c.minutosReservados !== 0) falha("Resolva as reservas de horas antes de apurar o encerramento.");
    if (c.matriculaId !== d.matriculaId || c.moeda !== d.moeda) falha("Compra pertence a outra matrícula ou moeda.");
    const liquido = new Prisma.Decimal(c.valorOriginal).minus(c.descontoOriginal);
    if (liquido.isNegative() || !liquido.equals(c.valorPagoAlocado)) falha("Concilie o pagamento alocado e os descontos da compra original.");
    const ids = [...c.consumos, ...c.liquidacoesAnteriores].map((m) => m.id);
    if (new Set(ids).size !== ids.length) falha("Destinação de horas repetida; concilie o histórico.");
    if ([...c.consumos, ...c.liquidacoesAnteriores].reduce((s, m) => s + m.minutos, 0) > c.minutosComprados) falha("Destinações excedem as horas compradas.");
    if (c.liquidacoesAnteriores.reduce((s, m) => s.plus(m.valor), new Prisma.Decimal(0)).gt(liquido)) falha("Créditos anteriores excedem o valor da compra.");
  }
});

/** Q97: apuração por compra original. Não cria crédito nem retém multa. */
export function calcularSaldoHorasEncerramento(input: z.input<typeof SaldoHorasEncerramentoSchema>) {
  const d = SaldoHorasEncerramentoSchema.parse(input);
  const compras = d.compras.map((c) => {
    const consumidos = c.consumos.reduce((s, m) => s + m.minutos, 0);
    const liquidados = c.liquidacoesAnteriores.reduce((s, m) => s + m.minutos, 0);
    const pendentes = c.minutosComprados - consumidos - liquidados;
    const pago = new Prisma.Decimal(c.valorPagoAlocado);
    const creditoAnterior = c.liquidacoesAnteriores.reduce((s, m) => s.plus(m.valor), new Prisma.Decimal(0));
    // Arredonda o direito financeiro acumulado uma vez e desconta o já liquidado.
    const direitoTotal = pago.mul(c.minutosComprados - consumidos).div(c.minutosComprados).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const credito = direitoTotal.minus(creditoAnterior);
    if (credito.isNegative() || (pendentes === 0 && !credito.isZero())) throw new Error("Liquidações anteriores divergem do saldo da compra; concilie antes do encerramento.");
    return { compraId: c.compraId, minutosComprados: c.minutosComprados, minutosConsumidos: consumidos, minutosLiquidados: liquidados, minutosPendentes: pendentes,
      creditoApurado: credito.toFixed(2), origem: c,
      memoria: { unidadeHoraMinutos: 60, valorLiquidoOriginal: pago.toFixed(2), direitoAcumulado: direitoTotal.toFixed(2), creditoAnterior: creditoAnterior.toFixed(2), arredondamento: "HALF_UP_2_CASAS" },
    };
  });
  return { matriculaId: d.matriculaId, moeda: d.moeda, compras,
    creditoApurado: compras.reduce((s, c) => s.plus(c.creditoApurado), new Prisma.Decimal(0)).toFixed(2),
    exigeAprovacaoIndependente: true as const, multaIncluida: false as const, efetivado: false as const };
}
