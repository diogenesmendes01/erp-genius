import { candidatosDaGrade } from "@/server/agenda/grade";
import { FusoInstitucionalSchema } from "./fuso";
import { resolverFusoExibicao } from "./fuso-exibicao";

export const VALOR_CAMPO_LOCAL = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::([0-5]\d)(?:\.(\d{1,3}))?)?$/;

export function fusoDoCampoLocal(preferencia: string | null | undefined, fusoEscola: string | null | undefined): string {
  return resolverFusoExibicao(preferencia, fusoEscola ?? "");
}

export type PrecisaoCampoLocal = "minuto" | "segundo" | "milissegundo";

export function valorCampoLocal(instante: Date | string | null | undefined, fuso: string, precisao: PrecisaoCampoLocal = "minuto"): string {
  if (instante == null || instante === "") return "";
  const data = new Date(instante);
  if (!Number.isFinite(data.getTime())) return "";
  const valido = FusoInstitucionalSchema.safeParse(fuso);
  const timeZone = valido.success ? valido.data : "UTC";
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(data);
  const p = (tipo: string) => partes.find((x) => x.type === tipo)?.value ?? "00";
  const minuto = `${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}`;
  if (precisao === "minuto") return minuto;
  if (precisao === "segundo") return `${minuto}:${p("second")}`;
  return `${minuto}:${p("second")}.${String(data.getUTCMilliseconds()).padStart(3, "0")}`;
}

export type ConversaoCampoLocal = { ok: true; instante: Date } | { ok: false; erro: string };

export function instanteDoCampoLocal(local: string, fuso: string): ConversaoCampoLocal {
  const m = VALOR_CAMPO_LOCAL.exec(typeof local === "string" ? local.trim() : "");
  if (!m) return { ok: false, erro: "Informe data e hora completas." };
  const valido = FusoInstitucionalSchema.safeParse(fuso);
  if (!valido.success) return { ok: false, erro: "Informe um fuso válido para a data e hora, como America/Sao_Paulo ou America/Costa_Rica." };
  const [, data, hora, segundos = "0", milis = "0"] = m;
  const civil = new Date(`${data}T00:00:00Z`);
  if (!Number.isFinite(civil.getTime()) || civil.toISOString().slice(0, 10) !== data) return { ok: false, erro: "Data inexistente; confira o dia e o mês." };
  let candidatos: Date[];
  try { candidatos = candidatosDaGrade(data, hora, valido.data); } catch { return { ok: false, erro: "Informe data e hora completas." }; }
  if (candidatos.length === 0) return { ok: false, erro: `Esse horário não existe em ${valido.data} (mudança de horário de verão); escolha outro.` };
  if (candidatos.length > 1) return { ok: false, erro: `Esse horário se repete em ${valido.data} (mudança de horário de verão); escolha outro.` };
  return { ok: true, instante: new Date(candidatos[0].getTime() + Number(segundos) * 1000 + Number(milis.padEnd(3, "0"))) };
}
