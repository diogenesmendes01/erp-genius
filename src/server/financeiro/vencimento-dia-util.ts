import { z } from "zod";
import { DataCivilSchema } from "@/server/matricula/cobertura";

/**
 * Data civil que pode ser persistida. Este cálculo não usa Date local nem fuso:
 * toda comparação é feita no calendário gregoriano representado por YYYY-MM-DD.
 */
export const DataCivilPersistivelSchema = DataCivilSchema.refine(
  (data) => data >= "0001-01-01" && data <= "9999-12-31",
  "Data fora do intervalo persistível.",
);

const DiasSemanaUteisSchema = z
  .array(z.number().int().min(0).max(6))
  .min(1, "Informe ao menos um dia útil financeiro.")
  .max(7)
  .refine((dias) => new Set(dias).size === dias.length, "Dia útil financeiro repetido.");

/** Calendário financeiro explícito; não é nem deriva de calendário escolar. */
export const CalendarioFinanceiroSchema = z
  .object({
    id: z.string().trim().min(1).max(200),
    versao: z.number().int().positive(),
    referencia: z.string().trim().min(1).max(2_000),
    inicioVigencia: DataCivilPersistivelSchema,
    fimVigencia: DataCivilPersistivelSchema,
    diasSemanaUteis: DiasSemanaUteisSchema,
    feriados: z.array(DataCivilPersistivelSchema),
  })
  .strict()
  .superRefine((calendario, contexto) => {
    if (calendario.fimVigencia < calendario.inicioVigencia) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fimVigencia"],
        message: "Vigência do calendário financeiro invertida.",
      });
    }
    if (new Set(calendario.feriados).size !== calendario.feriados.length) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["feriados"],
        message: "Feriado financeiro repetido.",
      });
    }
    calendario.feriados.forEach((feriado, indice) => {
      if (feriado < calendario.inicioVigencia || feriado > calendario.fimVigencia) {
        contexto.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["feriados", indice],
          message: "Feriado fora da vigência do calendário financeiro.",
        });
      }
    });
  });

export const RegraVencimentoDiaUtilSchema = z.discriminatedUnion("regra", [
  z.object({ regra: z.literal("MANTER_DATA") }).strict(),
  z.object({ regra: z.literal("PROXIMO_DIA_UTIL"), calendario: CalendarioFinanceiroSchema }).strict(),
]);

export const AjustarVencimentoDiaUtilSchema = z
  .object({
    dataCalculada: DataCivilPersistivelSchema,
    regra: RegraVencimentoDiaUtilSchema,
  })
  .strict();

export type EntradaAjustarVencimentoDiaUtil = z.input<typeof AjustarVencimentoDiaUtilSchema>;
export type ResultadoAjusteVencimentoDiaUtil = {
  dataCalculada: string;
  dataAjustada: string;
  regraAplicada: "MANTER_DATA" | "PROXIMO_DIA_UTIL";
  referenciaCalendarioAplicada: { id: string; versao: number; referencia: string } | null;
};

/** Indica que a conferência humana precisa corrigir a configuração ou a data. */
export class ErroConferenciaVencimento extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroConferenciaVencimento";
  }
}

function paraDataUtc(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  const resultado = new Date(0);
  resultado.setUTCHours(0, 0, 0, 0);
  // Date.UTC transforma os anos 0..99 em 1900..1999; setUTCFullYear não.
  resultado.setUTCFullYear(ano, mes - 1, dia);
  return resultado;
}

function proximoDiaCivil(data: string): string {
  const proximo = paraDataUtc(data);
  proximo.setUTCDate(proximo.getUTCDate() + 1);
  return proximo.toISOString().slice(0, 10);
}

/**
 * Ajusta exclusivamente a data de vencimento já calculada. Não recebe nem altera
 * cobertura contratual, dia de vencimento ou qualquer calendário acadêmico.
 */
export function ajustarVencimentoDiaUtil(input: EntradaAjustarVencimentoDiaUtil): ResultadoAjusteVencimentoDiaUtil {
  let dados: z.infer<typeof AjustarVencimentoDiaUtilSchema>;
  try {
    dados = AjustarVencimentoDiaUtilSchema.parse(input);
  } catch {
    throw new ErroConferenciaVencimento("Conferência necessária: data ou calendário financeiro inválido.");
  }

  if (dados.regra.regra === "MANTER_DATA") {
    return {
      dataCalculada: dados.dataCalculada,
      dataAjustada: dados.dataCalculada,
      regraAplicada: dados.regra.regra,
      referenciaCalendarioAplicada: null,
    };
  }

  const calendario = dados.regra.calendario;
  if (dados.dataCalculada < calendario.inicioVigencia || dados.dataCalculada > calendario.fimVigencia) {
    throw new ErroConferenciaVencimento("Conferência necessária: data calculada fora da vigência do calendário financeiro.");
  }

  const feriados = new Set(calendario.feriados);
  let candidata = dados.dataCalculada;
  while (candidata <= calendario.fimVigencia) {
    const diaSemana = paraDataUtc(candidata).getUTCDay();
    if (calendario.diasSemanaUteis.includes(diaSemana) && !feriados.has(candidata)) {
      return {
        dataCalculada: dados.dataCalculada,
        dataAjustada: candidata,
        regraAplicada: dados.regra.regra,
        referenciaCalendarioAplicada: {
          id: calendario.id,
          versao: calendario.versao,
          referencia: calendario.referencia,
        },
      };
    }
    if (candidata === calendario.fimVigencia) break;
    candidata = proximoDiaCivil(candidata);
  }

  throw new ErroConferenciaVencimento("Conferência necessária: não há dia útil financeiro na vigência aplicável.");
}
