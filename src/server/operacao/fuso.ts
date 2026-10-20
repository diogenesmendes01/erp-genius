import { z } from "zod";

/**
 * Fuso IANA reconhecido pelo ambiente (America/Sao_Paulo, America/Costa_Rica, UTC…). É o mesmo critério do
 * servidor (FusoInstitucionalSchema, PaisSchema) e da validação do <CampoFuso> no navegador: "GMT-3",
 * "+03:00", "Brasil" e "America/Sao Paulo" (com espaço) não passam.
 */
export function fusoIanaValido(fuso: string): boolean {
  if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)*$/.test(fuso)) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: fuso }).format(); return true; } catch { return false; }
}

/** Mensagem do campo de fuso para quem digita (sem o jargão "IANA"; docs/42 L2652 e L2709). */
export const MSG_FUSO_NAO_RECONHECIDO = "Não reconhecemos esse fuso. Escolha um da lista, como America/Sao_Paulo ou America/Costa_Rica.";

export const FusoInstitucionalSchema = z.string().trim().min(1).max(100).refine(fusoIanaValido, "Informe um fuso válido, como America/Sao_Paulo ou America/Costa_Rica.");

/**
 * Apelidos legados conhecidos e seu nome canônico IANA (decisão do dono, 17/10/2026). O Intl do Node aceita
 * esses apelidos, mas um Postgres sem `tzdata-legacy` não os lista em `pg_timezone_names`, e o trigger
 * `validar_fuso_exibicao_266` passa a recusar qualquer UPDATE da linha que os guarde. Mapa pequeno e explícito:
 * só os apelidos que a escola pode encontrar (EUA e Brasil); a migration 20261017150000 converte os já gravados.
 */
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

/**
 * Links do arquivo `backward` do tzdata que o ICU ainda lista em `Intl.supportedValuesOf("timeZone")` (revisão
 * R1 do #210, C1). O `CampoFuso` das telas de preferência sugere essa lista, mas um Postgres sem `tzdata-legacy`
 * não tem esses nomes, e salvar um deles falhava com "Fuso de exibição inválido". Conferido no Node 22 (ICU do
 * ambiente) contra `pg_timezone_names` de um Postgres sem `tzdata-legacy`: são exatamente estes 18, e o destino
 * de cada um é o alvo do link no `tzdata.zi`. A migration 20261017170000 converte os já gravados.
 */
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

/** Todos os apelidos legados normalizados ao salvar uma preferência de fuso. */
export const APELIDOS_FUSO_LEGADOS: Readonly<Record<string, string>> = Object.freeze({ ...APELIDOS_FUSO_US_BRASIL, ...LINKS_FUSO_BACKWARD_ICU });

const APELIDOS_POR_CHAVE = new Map(Object.entries(APELIDOS_FUSO_LEGADOS).map(([apelido, canonico]) => [apelido.toLowerCase(), canonico]));

/** Troca um apelido legado conhecido pelo nome canônico; qualquer outro valor volta só sem espaços nas pontas. */
export function normalizarFusoIana(fuso: string): string {
  const limpo = fuso.trim();
  return APELIDOS_POR_CHAVE.get(limpo.toLowerCase()) ?? limpo;
}

/** Fuso de preferência pessoal (equipe e portal do aluno): normaliza o apelido e valida como o institucional. */
export const FusoPreferenciaSchema = z.string().transform(normalizarFusoIana).pipe(FusoInstitucionalSchema);

/** Data civil da escola, independente das preferências de exibição e do servidor. */
export function dataCivilInstitucional(instante: Date, fuso: string) {
  const timeZone = FusoInstitucionalSchema.parse(fuso);
  if (!Number.isFinite(instante.getTime())) throw new Error("Instante inválido.");
  const partes = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instante);
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}

/**
 * Primeiro instante do dia civil `data` (AAAA-MM-DD) no fuso da escola (Q176 · ref. #164). Normalmente é a
 * meia-noite; onde ela não existe (início do horário de verão, como America/Santiago em 06/09/2026), é o
 * primeiro instante válido do dia, à 01h. Nunca depende do fuso do servidor.
 */
export function inicioDoDiaCivil(data: string, fuso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  const alvo = m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : NaN;
  if (!Number.isFinite(alvo) || new Date(alvo).toISOString().slice(0, 10) !== data) throw new Error("Data civil inválida.");
  // Em segundos: 15h antes da meia-noite UTC ainda é a véspera em qualquer fuso (até +14h); 15h depois já é o dia
  // ou depois (até −12h). A data civil não recua ao longo do tempo, então a busca binária acha a virada exata.
  let antes = alvo / 1000 - 15 * 3600;
  let depois = alvo / 1000 + 15 * 3600;
  while (depois - antes > 1) {
    const meio = Math.floor((antes + depois) / 2);
    if (dataCivilInstitucional(new Date(meio * 1000), fuso) >= data) depois = meio;
    else antes = meio;
  }
  return new Date(depois * 1000);
}

/** Primeiro instante do dia civil da escola em que `instante` cai (ver `inicioDoDiaCivil`). */
export function inicioDoDiaInstitucional(instante: Date, fuso: string): Date {
  return inicioDoDiaCivil(dataCivilInstitucional(instante, fuso), fuso);
}

/** Primeiro instante do dia civil da escola seguinte ao de `instante`: o fim exclusivo do "hoje" da escola. */
export function inicioDoDiaSeguinteInstitucional(instante: Date, fuso: string): Date {
  const hoje = new Date(`${dataCivilInstitucional(instante, fuso)}T00:00:00Z`);
  hoje.setUTCDate(hoje.getUTCDate() + 1);
  return inicioDoDiaCivil(hoje.toISOString().slice(0, 10), fuso);
}

/** Primeiro instante do mês civil da escola em que `instante` cai (dia 1, ver `inicioDoDiaCivil`). */
export function inicioDoMesInstitucional(instante: Date, fuso: string): Date {
  return inicioDoDiaCivil(`${dataCivilInstitucional(instante, fuso).slice(0, 8)}01`, fuso);
}

/**
 * Dia civil (AAAA-MM-DD) de uma data gravada, como vencimento ou promessa. Elas nasceram como dia
 * civil em convenções distintas: meio-dia ou meia-noite do fuso da escola, ou meia-noite UTC no
 * legado. O maior entre o dia UTC e o dia da escola recupera o dia civil nas três; num instante
 * legado ambíguo fica o dia mais tardio, que nunca antecipa lembrete, cobrança, restrição ou atraso.
 */
export function diaCivilGravado(gravada: Date, fuso: string): string {
  const utc = gravada.toISOString().slice(0, 10);
  const daEscola = dataCivilInstitucional(gravada, fuso);
  return utc > daEscola ? utc : daEscola;
}

const msDoDia = (civil: string) => Date.parse(`${civil}T00:00:00Z`);

/** Dias de calendário da escola entre a data gravada e `agora` (positivo = já passou; ignora hora). */
export function diasCivisDesde(agora: Date, gravada: Date, fuso: string): number {
  return Math.round((msDoDia(dataCivilInstitucional(agora, fuso)) - msDoDia(diaCivilGravado(gravada, fuso))) / 86400000);
}

/**
 * Vencimento em atraso (ref. #247): só quando o dia civil da escola já passou do dia do vencimento. O dia
 * do vencimento vale inteiro, até a meia-noite da escola, qualquer que seja a convenção de gravação.
 */
export function vencimentoEmAtraso(vencimento: Date, agora: Date, fuso: string): boolean {
  return diasCivisDesde(agora, vencimento, fuso) > 0;
}

/**
 * O mesmo critério de `vencimentoEmAtraso` como instante, para filtrar no banco: `vencimento < limite`
 * ⟺ em atraso. `diaCivilGravado` < hoje exige o dia UTC e o dia da escola antes de hoje, ou seja, o
 * instante antes da meia-noite UTC de hoje e antes do início de hoje na escola; vale o menor dos dois.
 */
export function limiteDoAtraso(agora: Date, fuso: string): Date {
  const hoje = dataCivilInstitucional(agora, fuso);
  return new Date(Math.min(msDoDia(hoje), inicioDoDiaCivil(hoje, fuso).getTime()));
}

const DIA_DA_SEMANA: Readonly<Record<string, number>> = Object.freeze({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 });

/** Hora (0–23) e dia da semana (0 = domingo) de `instante` no fuso informado, independente do servidor. */
export function horaEDiaInstitucional(instante: Date, fuso: string): { hora: number; diaSemana: number } {
  const timeZone = FusoInstitucionalSchema.parse(fuso);
  if (!Number.isFinite(instante.getTime())) throw new Error("Instante inválido.");
  const partes = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(instante);
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return { hora: Number(parte("hour")), diaSemana: DIA_DA_SEMANA[parte("weekday")] };
}
