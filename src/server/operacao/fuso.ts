import { z } from "zod";

export function fusoIanaValido(fuso: string): boolean {
  if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)*$/.test(fuso)) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: fuso }).format(); return true; } catch { return false; }
}

export const MSG_FUSO_NAO_RECONHECIDO = "Não reconhecemos esse fuso. Escolha um da lista, como America/Sao_Paulo ou America/Costa_Rica.";

export const FusoInstitucionalSchema = z.string().trim().min(1).max(100).refine(fusoIanaValido, "Informe um fuso válido, como America/Sao_Paulo ou America/Costa_Rica.");

export const APELIDOS_FUSO_US_BRASIL: Readonly<Record<string, string>> = Object.freeze({
  "US/Eastern": "America/New_York",
  "US/Central": "America/Chicago",
  "US/Mountain": "America/Denver",
  "US/Pacific": "America/Los_Angeles",
  "US/Arizona": "America/Phoenix",
  "US/Alaska": "America/Anchorage",
  "US/Hawaii": "Pacific/Honolulu",
  "US/East-Indiana": "America/Indiana/Indianapolis",
  "US/Indiana-Starke": "America/Indiana/Knox",
  "US/Michigan": "America/Detroit",
  "US/Aleutian": "America/Adak",
  "US/Samoa": "Pacific/Pago_Pago",
  "Brazil/East": "America/Sao_Paulo",
  "Brazil/West": "America/Manaus",
  "Brazil/Acre": "America/Rio_Branco",
  "Brazil/DeNoronha": "America/Noronha",
});

export const LINKS_FUSO_BACKWARD_ICU: Readonly<Record<string, string>> = Object.freeze({
  "Africa/Asmera": "Africa/Asmara",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "America/Catamarca": "America/Argentina/Catamarca",
  "America/Cordoba": "America/Argentina/Cordoba",
  "America/Godthab": "America/Nuuk",
  "America/Indianapolis": "America/Indiana/Indianapolis",
  "America/Jujuy": "America/Argentina/Jujuy",
  "America/Louisville": "America/Kentucky/Louisville",
  "America/Mendoza": "America/Argentina/Mendoza",
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Rangoon": "Asia/Yangon",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "Europe/Kiev": "Europe/Kyiv",
  "Pacific/Enderbury": "Pacific/Kanton",
  "Pacific/Ponape": "Pacific/Pohnpei",
  "Pacific/Truk": "Pacific/Chuuk",
});

export const APELIDOS_FUSO_LEGADOS: Readonly<Record<string, string>> = Object.freeze({ ...APELIDOS_FUSO_US_BRASIL, ...LINKS_FUSO_BACKWARD_ICU });

const APELIDOS_POR_CHAVE = new Map(Object.entries(APELIDOS_FUSO_LEGADOS).map(([apelido, canonico]) => [apelido.toLowerCase(), canonico]));

export function normalizarFusoIana(fuso: string): string {
  const limpo = fuso.trim();
  return APELIDOS_POR_CHAVE.get(limpo.toLowerCase()) ?? limpo;
}

export const FusoPreferenciaSchema = z.string().transform(normalizarFusoIana).pipe(FusoInstitucionalSchema);

export function dataCivilInstitucional(instante: Date, fuso: string) {
  const timeZone = FusoInstitucionalSchema.parse(fuso);
  if (!Number.isFinite(instante.getTime())) throw new Error("Instante inválido.");
  const partes = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instante);
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}

export function inicioDoDiaCivil(data: string, fuso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  const alvo = m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : NaN;
  if (!Number.isFinite(alvo) || new Date(alvo).toISOString().slice(0, 10) !== data) throw new Error("Data civil inválida.");
  let antes = alvo / 1000 - 15 * 3600;
  let depois = alvo / 1000 + 15 * 3600;
  while (depois - antes > 1) {
    const meio = Math.floor((antes + depois) / 2);
    if (dataCivilInstitucional(new Date(meio * 1000), fuso) >= data) depois = meio;
    else antes = meio;
  }
  return new Date(depois * 1000);
}

export function inicioDoDiaInstitucional(instante: Date, fuso: string): Date {
  return inicioDoDiaCivil(dataCivilInstitucional(instante, fuso), fuso);
}

export function inicioDoDiaSeguinteInstitucional(instante: Date, fuso: string): Date {
  const hoje = new Date(`${dataCivilInstitucional(instante, fuso)}T00:00:00Z`);
  hoje.setUTCDate(hoje.getUTCDate() + 1);
  return inicioDoDiaCivil(hoje.toISOString().slice(0, 10), fuso);
}

export function inicioDoMesInstitucional(instante: Date, fuso: string): Date {
  return inicioDoDiaCivil(`${dataCivilInstitucional(instante, fuso).slice(0, 8)}01`, fuso);
}

export function diaCivilGravado(gravada: Date, fuso: string): string {
  const utc = gravada.toISOString().slice(0, 10);
  const daEscola = dataCivilInstitucional(gravada, fuso);
  return utc > daEscola ? utc : daEscola;
}

const msDoDia = (civil: string) => Date.parse(`${civil}T00:00:00Z`);

export function diasCivisDesde(agora: Date, gravada: Date, fuso: string): number {
  return Math.round((msDoDia(dataCivilInstitucional(agora, fuso)) - msDoDia(diaCivilGravado(gravada, fuso))) / 86400000);
}

export function vencimentoEmAtraso(vencimento: Date, agora: Date, fuso: string): boolean {
  return diasCivisDesde(agora, vencimento, fuso) > 0;
}

export function limiteDoAtraso(agora: Date, fuso: string): Date {
  const hoje = dataCivilInstitucional(agora, fuso);
  return new Date(Math.min(msDoDia(hoje), inicioDoDiaCivil(hoje, fuso).getTime()));
}

const DIA_DA_SEMANA: Readonly<Record<string, number>> = Object.freeze({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 });

export function horaEDiaInstitucional(instante: Date, fuso: string): { hora: number; diaSemana: number } {
  return horaEDiaNoFuso(instante, FusoInstitucionalSchema.parse(fuso));
}

export function horaEDiaNoFuso(instante: Date, timeZone: string): { hora: number; diaSemana: number } {
  if (!Number.isFinite(instante.getTime())) throw new Error("Instante inválido.");
  const partes = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(instante);
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return { hora: Number(parte("hour")), diaSemana: DIA_DA_SEMANA[parte("weekday")] };
}
