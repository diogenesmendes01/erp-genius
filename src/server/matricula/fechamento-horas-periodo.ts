import { z } from "zod";
import { DataCivilSchema, RegraCoberturaSchema, periodoMensalNaData } from "./cobertura";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";
import { instanteDaGrade } from "@/server/agenda/grade";

export const PeriodoFechamentoHorasSchema = z.object({ referencia: RegraCoberturaSchema, dataNoPeriodo: DataCivilSchema,
  fuso: FusoInstitucionalSchema, vencimento: DataCivilSchema, clausula: z.string().trim().min(5).max(2000) }).strict();

/** Referência proposta deve ser conferida contra o contrato antes da emissão. */
export function resolverPeriodoFechamentoHoras(input: z.input<typeof PeriodoFechamentoHorasSchema>) {
  const d = PeriodoFechamentoHorasSchema.parse(input), civil = periodoMensalNaData(d.referencia, d.dataNoPeriodo);
  const proximo = new Date(Date.parse(`${civil.fim}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  return { ...civil, fuso: d.fuso, vencimento: d.vencimento, referencia: d.referencia,
    inicioInstante: instanteDaGrade(civil.inicio, "00:00", d.fuso).toISOString(), fimExclusivo: instanteDaGrade(proximo, "00:00", d.fuso).toISOString() };
}
