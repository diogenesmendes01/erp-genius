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
export const APELIDOS_FUSO_LEGADOS: Readonly<Record<string, string>> = Object.freeze({
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
