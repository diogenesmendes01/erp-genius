import { z } from "zod";

const DIA = 86_400_000;
/** Data civil representada em UTC, independente do fuso do servidor. */
export const DataCivilSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((valor) => {
  const data = new Date(`${valor}T00:00:00.000Z`);
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}, "Data civil inválida.");
export const RegraCoberturaSchema = z.discriminatedUnion("referencia", [
  z.object({ referencia: z.literal("MES_CIVIL") }).strict(),
  z.object({ referencia: z.literal("CICLO_MATRICULA"), dataReferencia: DataCivilSchema }).strict(),
]);
export type RegraCobertura = z.infer<typeof RegraCoberturaSchema>;
export const CoberturaInicialSchema = z.object({
  referencia: z.enum(["MES_CIVIL", "CICLO_MATRICULA"]),
  inicio: DataCivilSchema,
}).strict().refine((d) => d.referencia !== "MES_CIVIL" || d.inicio.endsWith("-01"), {
  message: "No mês civil, informe o primeiro dia do mês coberto.", path: ["inicio"],
});
const utc = (s: string) => new Date(`${DataCivilSchema.parse(s)}T00:00:00.000Z`);
const civil = (d: Date) => d.toISOString().slice(0, 10);
function inicioMes(ano: number, mes: number) {
  const data = new Date(0);
  data.setUTCFullYear(ano, mes, 1);
  return data;
}
function aniversario(ancora: Date, meses: number) {
  const primeiro = inicioMes(ancora.getUTCFullYear(), ancora.getUTCMonth() + meses);
  const seguinte = inicioMes(primeiro.getUTCFullYear(), primeiro.getUTCMonth() + 1);
  const ultimo = new Date(seguinte.getTime() - DIA).getUTCDate();
  primeiro.setUTCDate(Math.min(ancora.getUTCDate(), ultimo));
  return primeiro;
}
/** Q62: intervalo inclusivo contendo a data; não deriva cobertura do vencimento. */
export function periodoMensalNaData(regra: RegraCobertura, data: string) {
  const r = RegraCoberturaSchema.parse(regra), alvo = utc(data);
  let inicio: Date, proximo: Date;
  if (r.referencia === "MES_CIVIL") {
    inicio = inicioMes(alvo.getUTCFullYear(), alvo.getUTCMonth());
    proximo = inicioMes(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1);
  } else {
    const ancora = utc(r.dataReferencia);
    if (alvo < ancora) throw new Error("Data anterior à referência contratual de cobertura.");
    let meses = (alvo.getUTCFullYear() - ancora.getUTCFullYear()) * 12 + alvo.getUTCMonth() - ancora.getUTCMonth();
    if (aniversario(ancora, meses) > alvo) meses--;
    inicio = aniversario(ancora, meses); proximo = aniversario(ancora, meses + 1);
  }
  return { inicio: civil(inicio), fim: civil(new Date(proximo.getTime() - DIA)), dias: (proximo.getTime() - inicio.getTime()) / DIA };
}
/** Q65: não depende do vencimento ou do estado global da pessoa. */
export function efeitoPausaNaCobertura(periodo: { inicio: string; fim: string }, dataEfetiva: string) {
  const inicio = utc(periodo.inicio), fim = utc(periodo.fim), pausa = utc(dataEfetiva);
  if (fim < inicio) throw new Error("Período de cobertura invertido.");
  if (fim < pausa) return "PRESERVAR_PERIODO_ANTERIOR" as const;
  if (inicio <= pausa) return "MANTER_PERIODO_INICIADO_INTEGRAL" as const;
  return "SUSPENDER_PERIODO_FUTURO" as const;
}
