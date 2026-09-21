import { Prisma } from "@prisma/client";
import { z } from "zod";
import { DataCivilSchema } from "./cobertura";
import { ParcelaEncerramentoSchema, calcularParcelaEncerramento } from "./encerramento-calculo";
import { MultaEncerramentoSchema, calcularMultaEncerramento } from "./encerramento-multa";

export const AcertoMensalEncerramentoSchema = z.object({
  matriculaId: z.string().min(1), contratoVersaoId: z.string().min(1), moeda: z.string().regex(/^[A-Z]{3}$/),
  dataEfetiva: DataCivilSchema,
  parcelas: z.array(ParcelaEncerramentoSchema), multa: MultaEncerramentoSchema,
}).strict().superRefine((d, ctx) => {
  const falha = (message: string) => ctx.addIssue({ code: "custom", message });
  if (new Set(d.parcelas.map((p) => p.cobrancaId)).size !== d.parcelas.length) falha("Cobrança duplicada no acerto.");
  if (d.multa.moeda !== d.moeda || d.multa.contratoVersaoId !== d.contratoVersaoId) falha("Multa pertence a outra moeda ou versão contratual.");
  for (const p of d.parcelas) {
    if (p.moeda !== d.moeda || p.contratoVersaoId !== d.contratoVersaoId || p.dataEfetiva !== d.dataEfetiva) falha("Parcela incompatível com a referência do acerto.");
  }
  const periodos = [...d.parcelas].sort((a, b) => a.coberturaInicio.localeCompare(b.coberturaInicio));
  for (let i = 1; i < periodos.length; i++) if (periodos[i].coberturaInicio <= periodos[i - 1].coberturaFim) falha("Períodos sobrepostos exigem conferência antes do acerto.");
});

/** Prévia aritmética; a origem das parcelas deve ser conferida no banco pelo fluxo de proposta. */
export function calcularAcertoMensalEncerramento(input: z.input<typeof AcertoMensalEncerramentoSchema>) {
  const d = AcertoMensalEncerramentoSchema.parse(input);
  const parcelas = d.parcelas.map(calcularParcelaEncerramento);
  const multa = calcularMultaEncerramento(d.multa);
  const soma = (campo: "valorDevido" | "saldoDevido" | "creditoApurado") => parcelas.reduce((total, p) => total.plus(p[campo]), new Prisma.Decimal(0));
  return {
    matriculaId: d.matriculaId, contratoVersaoId: d.contratoVersaoId, moeda: d.moeda, dataEfetiva: d.dataEfetiva,
    parcelas, multa,
    totalServico: soma("valorDevido").toFixed(2),
    saldoDevidoSemCompensarCreditos: soma("saldoDevido").plus(multa.valor).toFixed(2),
    creditoApuradoSemUtilizacao: soma("creditoApurado").toFixed(2),
  };
}
