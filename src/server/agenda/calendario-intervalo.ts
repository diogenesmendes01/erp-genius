import { z } from "zod";
import { DataCivilSchema } from "@/server/matricula/cobertura";
import { dataCivilInstitucional, FusoInstitucionalSchema } from "@/server/operacao/fuso";

const Entrada = z.object({ inicio: z.string().datetime({ offset: true }), fim: z.string().datetime({ offset: true }), fusoEscola: FusoInstitucionalSchema,
  periodos: z.array(z.object({ id: z.string().min(1), inicio: DataCivilSchema, fim: DataCivilSchema }).strict()).max(10000),
}).strict().superRefine((d, ctx) => {
  if (Date.parse(d.fim) <= Date.parse(d.inicio)) ctx.addIssue({ code: "custom", message: "Intervalo do encontro inválido." });
  if (d.periodos.some((p) => p.fim < p.inicio)) ctx.addIssue({ code: "custom", message: "Período não letivo invertido." });
});

/** Intervalo [início, fim): terminar exatamente à meia-noite não ocupa o dia seguinte. */
export function conferirDiasNaoLetivos(input: z.input<typeof Entrada>) {
  const d = Entrada.parse(input);
  const primeiroDia = dataCivilInstitucional(new Date(d.inicio), d.fusoEscola);
  const ultimoDia = dataCivilInstitucional(new Date(Date.parse(d.fim) - 1), d.fusoEscola);
  return { primeiroDia, ultimoDia, periodosAfetados: d.periodos.filter((p) => p.inicio <= ultimoDia && p.fim >= primeiroDia).map((p) => p.id) };
}
