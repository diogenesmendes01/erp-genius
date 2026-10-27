import { z } from "zod";
import { RegraVencimentoDiaUtilSchema } from "@/server/financeiro/vencimento-dia-util";
import { planejarContinuidadeMensal } from "./continuidade-mensal";
import { PlanejarContinuidadeMensalSchema } from "./continuidade-mensal-schema";

export const PlanejarContinuidadeFinanceiraSchema = PlanejarContinuidadeMensalSchema
  .omit({ ajusteVencimento: true })
  .extend({ regraVencimento: RegraVencimentoDiaUtilSchema }).strict();

export function planejarContinuidadeComVencimentoFinanceiro(
  input: z.input<typeof PlanejarContinuidadeFinanceiraSchema>,
) {
  const { regraVencimento, ...dados } = PlanejarContinuidadeFinanceiraSchema.parse(input);
  return planejarContinuidadeMensal({ ...dados, ajusteVencimento: regraVencimento });
}
