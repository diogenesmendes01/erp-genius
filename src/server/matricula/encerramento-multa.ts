import { Prisma } from "@prisma/client";
import { z } from "zod";

const Valor = z.string().regex(/^\d+(?:\.\d{1,2})?$/, "Valor monetário inválido.");
const Clausula = {
  contratoVersaoId: z.string().trim().min(1),
  clausulaId: z.string().trim().min(1),
  condicoesAplicacao: z.string().trim().min(1),
  evidenciaAplicabilidade: z.string().trim().min(1),
  moeda: z.string().regex(/^[A-Z]{3}$/),
};
export const MultaEncerramentoSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("SEM_PREVISAO"), contratoVersaoId: z.string().trim().min(1), motivo: z.string().trim().min(1), moeda: z.string().regex(/^[A-Z]{3}$/) }).strict(),
  z.object({ tipo: z.literal("VALOR_FIXO"), ...Clausula, valor: Valor }).strict(),
  z.object({ tipo: z.literal("PERCENTUAL"), ...Clausula, percentual: Valor, baseCalculo: Valor, descricaoBase: z.string().trim().min(1) }).strict(),
]);

/** Q17: somente cálculo da previsão contratual; não autoriza aplicação ou dispensa. */
export function calcularMultaEncerramento(input: z.input<typeof MultaEncerramentoSchema>) {
  const regra = MultaEncerramentoSchema.parse(input);
  const exato = regra.tipo === "SEM_PREVISAO" ? new Prisma.Decimal(0)
    : regra.tipo === "VALOR_FIXO" ? new Prisma.Decimal(regra.valor)
      : new Prisma.Decimal(regra.baseCalculo).mul(regra.percentual).div(100);
  return {
    regra, valor: exato.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2),
    memoria: { valorAntesArredondamento: exato.toString(), arredondamento: "HALF_UP_2_CASAS" },
  };
}
