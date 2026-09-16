import { z } from "zod";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";
const Entrada = z.object({ formaAgenda: z.enum(["PARTICULAR_GRADE_FIXA", "PARTICULAR_FLEXIVEL"]), fusoOrigem: FusoInstitucionalSchema,
  horarios: z.array(z.object({ inicio: z.string().datetime(), fim: z.string().datetime(), professorNome: z.string().min(1) })).min(1).max(1000),
});
export function formatarAgendaParticular(input: z.input<typeof Entrada>) {
  const d = Entrada.parse(input);
  if (d.horarios.some((h) => Date.parse(h.fim) <= Date.parse(h.inicio))) throw new Error("Intervalo particular inválido.");
  const formato = new Intl.DateTimeFormat("pt-BR", { timeZone: d.fusoOrigem, dateStyle: "short", timeStyle: "short" });
  const forma = d.formaAgenda === "PARTICULAR_GRADE_FIXA" ? "Grade fixa" : "Agenda flexível; encontros posteriores sujeitos a novo agendamento";
  return [`${forma}. Fuso: ${d.fusoOrigem}.`, ...d.horarios.map((h) => `${formato.format(new Date(h.inicio))} - ${formato.format(new Date(h.fim))}; ${(Date.parse(h.fim) - Date.parse(h.inicio)) / 60000} minutos; professor: ${h.professorNome}.`)].join("\n");
}
