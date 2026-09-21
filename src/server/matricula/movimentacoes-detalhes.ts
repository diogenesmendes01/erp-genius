import { z } from "zod";
import { DataCivilSchema } from "./cobertura";

const intervalo = z.object({ inicio: DataCivilSchema, fim: DataCivilSchema });
const comum = { matriculaId: z.string(), codigo: z.string().nullable(), pendencias: z.array(z.string()) };
const pausa = z.object({ dataEfetiva: DataCivilSchema, fusoInstitucional: z.string().nullable(), matriculas: z.array(z.object({
  ...comum, periodos: z.array(z.object({ cobrancaId: z.string(), codigo: z.string().nullable(), inicio: DataCivilSchema.nullable(), fim: DataCivilSchema.nullable(),
    vencimento: z.string().datetime(), efeito: z.enum(["CONFERIR_COBERTURA", "PRESERVAR_PERIODO_ANTERIOR", "MANTER_PERIODO_INICIADO_INTEGRAL", "SUSPENDER_PERIODO_FUTURO"]),
  })),
})) });
const retomada = z.object({ retorno: DataCivilSchema, fusoInstitucional: z.string().nullable(), matriculas: z.array(z.object({
  ...comum, pausaId: z.string().nullable(), periodos: z.array(z.object({ cobrancaId: z.string(), coberturaAnterior: intervalo, cobertura: intervalo,
    vencimentoAnterior: DataCivilSchema, vencimento: DataCivilSchema,
  })),
})) });

/** Lista explícita de campos operacionais; descarta campos extras em qualquer nível. */
export function projetarDetalhesMovimentacao(tipo: "PAUSA" | "RETOMADA", snapshot: unknown) {
  if (tipo === "PAUSA") {
    const r = pausa.safeParse(snapshot);
    return r.success ? { tipo, impactos: r.data } : null;
  }
  const r = retomada.safeParse(snapshot);
  return r.success ? { tipo, impactos: r.data } : null;
}
