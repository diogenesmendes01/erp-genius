import { candidatosDaGrade } from "@/server/agenda/grade";
import { FusoInstitucionalSchema } from "./fuso";
import { resolverFusoExibicao } from "./fuso-exibicao";

// Campo de ENTRADA <input type="datetime-local"> (lote 3 do fuso pessoal nas telas, Q176). O navegador entrega
// "AAAA-MM-DDTHH:mm" (segundos e milissegundos opcionais) SEM fuso. Antes, várias telas faziam `new Date(valor)` no
// cliente (fuso do navegador) ou `new Date(ano, mes, …)` no servidor (fuso do processo, UTC em produção). Agora:
// - a tela escreve AO LADO do campo o fuso em que o valor é lido (`fusoDoCampoLocal`, o mesmo das datas exibidas:
//   preferência pessoal; sem ela, o da escola);
// - o valor inicial (`value`/`defaultValue`/`max`) sai do instante NESSE fuso (`valorCampoLocal`);
// - a tela envia o texto digitado e o fuso; o SERVIDOR converte (`instanteDoCampoLocal`), sem depender do fuso do
//   processo nem do navegador.
// Fallback documentado: preferência e fuso da escola inválidos ou ausentes → "UTC", ESCRITO ao lado do campo (a tela
// não quebra e não presume um fuso calado). O servidor nunca cai em fallback: fuso inválido recebido é recusado.

/** Valor de um `datetime-local`: minutos, com segundos e milissegundos opcionais. */
export const VALOR_CAMPO_LOCAL = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::([0-5]\d)(?:\.(\d{1,3}))?)?$/;

/**
 * Fuso em que um campo `datetime-local` é lido e escrito: o fuso pessoal de exibição; sem ele, o da escola (ou o de
 * origem da tela); nenhum dos dois válido → "UTC", que a tela escreve ao lado do campo.
 */
export function fusoDoCampoLocal(preferencia: string | null | undefined, fusoEscola: string | null | undefined): string {
  return resolverFusoExibicao(preferencia, fusoEscola ?? "");
}

export type PrecisaoCampoLocal = "minuto" | "segundo" | "milissegundo";

/**
 * Valor de um `datetime-local` para o instante no fuso (valor inicial, `max`). Fuso inválido usa "UTC" — o mesmo
 * fallback de `fusoDoCampoLocal`, então a tela que mostra o fuso resolvido continua coerente. Valor que não é data
 * (ou ausente) vira "" (campo vazio), sem lançar.
 */
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

/**
 * Converte o texto de um `datetime-local` no instante que ele significa no fuso INFORMADO. Não lança e não escolhe
 * em silêncio: formato inválido, data impossível (31/02), fuso inválido, horário pulado ou repetido na mudança de
 * horário de verão voltam como erro legível. O servidor usa `exigirInstanteDoCampoLocal` (src/server/_shared/
 * campo-local.ts), que transforma o erro em ErroRegra.
 */
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
