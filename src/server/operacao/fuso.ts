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

/** Data civil da escola, independente das preferências de exibição e do servidor. */
export function dataCivilInstitucional(instante: Date, fuso: string) {
  const timeZone = FusoInstitucionalSchema.parse(fuso);
  if (!Number.isFinite(instante.getTime())) throw new Error("Instante inválido.");
  const partes = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instante);
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}
