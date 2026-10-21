import { Prisma } from "@prisma/client";
import { z } from "zod";
import { descontoAcumulado, acimaDaAlcada } from "@/server/financeiro/regras";

export const ConferenciaAlcadaSchema = z.object({
  componentes: z.array(z.object({ tipo: z.enum(["MATRICULA", "MENSALIDADE", "HORA_PARTICULAR"]),
    referencia: z.string().nullable(), proposto: z.string(), limitePct: z.string().nullable(), descontoPct: z.string().nullable(),
    resultado: z.enum(["DENTRO_ALCADA", "EXIGE_APROVACAO", "REFERENCIA_INSUFICIENTE"]) })).length(2),
});

/** Análise de preço somente: não aprova cadastro, contrato, cobrança ou ativação. */
export function conferirAlcadaPreparacao(input: {
  regime: "MENSALIDADE" | "HORA_PARTICULAR"; moeda: string; taxa: string; servico: string;
  limiteTaxa: Prisma.Decimal.Value | null; limiteMensalidade: Prisma.Decimal.Value | null;
  referencias: { tipoCobranca: string; valor: Prisma.Decimal.Value; moeda: string }[];
}) {
  return ConferenciaAlcadaSchema.parse({ componentes: (["MATRICULA", input.regime] as const).map((tipo) => {
    const refs = input.referencias.filter((r) => r.tipoCobranca === tipo);
    const proposto = tipo === "MATRICULA" ? input.taxa : input.servico;
    const limite = tipo === "MATRICULA" ? input.limiteTaxa : tipo === "MENSALIDADE" ? input.limiteMensalidade : null;
    const limitePct = limite === null ? null : new Prisma.Decimal(limite).toString();
    if (refs.length !== 1 || refs[0].moeda !== input.moeda) return { tipo, proposto, limitePct, referencia: null, descontoPct: null, resultado: "REFERENCIA_INSUFICIENTE" };
    const referencia = new Prisma.Decimal(refs[0].valor).toString();
    return { tipo, referencia, proposto, limitePct, descontoPct: descontoAcumulado(referencia, proposto).toString(),
      resultado: acimaDaAlcada(referencia, proposto, limite) ? "EXIGE_APROVACAO" : "DENTRO_ALCADA" };
  }) });
}
