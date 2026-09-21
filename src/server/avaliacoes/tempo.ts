import { z } from "zod";
import { instanteDaGrade } from "@/server/agenda/grade";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";

export const DataHoraAvaliacaoSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::[0-5]\d(?:\.\d{1,3})?)?$/);
export function instanteAvaliacaoLocal(local: string, fuso: string) {
  DataHoraAvaliacaoSchema.parse(local);
  const minuto = instanteDaGrade(local.slice(0, 10), local.slice(11, 16), fuso);
  const segundos = local.length > 16 ? Number(local.slice(17)) : 0;
  return new Date(minuto.getTime() + Math.round(segundos * 1000));
}

export function dataHoraAvaliacaoLocal(instante: Date, fuso: string) {
  const timeZone = FusoInstitucionalSchema.parse(fuso);
  if (!Number.isFinite(instante.getTime())) throw new Error("Data inválida.");
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(instante);
  const p = (tipo: string) => partes.find(x => x.type === tipo)!.value;
  return `${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}:${p("second")}.${String(instante.getUTCMilliseconds()).padStart(3, "0")}`;
}
