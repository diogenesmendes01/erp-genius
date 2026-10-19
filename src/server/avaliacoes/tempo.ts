import { z } from "zod";
import { instanteDaGrade } from "@/server/agenda/grade";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";

/**
 * D10 (decisão do dono, 19/10/2026; C7 da #170): sem o fuso da escola, o lançamento de avaliação fica bloqueado —
 * em UTC a data da avaliação pode cair no dia errado. A tela esconde o formulário e a ação recusa com esta mensagem.
 */
export const MSG_LANCAMENTO_SEM_FUSO =
  "Lançamento de avaliação bloqueado: a escola ainda não tem fuso configurado, e em UTC a data da avaliação pode cair no dia errado. Configure o fuso da escola em Configuração › Operação (perfil de administração) antes de lançar.";

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
