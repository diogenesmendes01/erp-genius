import { FusoInstitucionalSchema } from "./fuso";

/** Preferência só interpreta instantes já persistidos; não muda fontes ou datas civis. */
export function resolverFusoExibicao(preferencia: string | null | undefined, fusoOrigem: string) {
  const preferido = FusoInstitucionalSchema.safeParse(preferencia);
  if (preferido.success) return preferido.data;
  const origem = FusoInstitucionalSchema.safeParse(fusoOrigem);
  return origem.success ? origem.data : "UTC";
}

export function formatarInstanteExibicao(valor: Date | string, preferencia: string | null | undefined, fusoOrigem: string) {
  const instante = new Date(valor);
  if (!Number.isFinite(instante.getTime())) return { texto: String(valor), fuso: resolverFusoExibicao(preferencia, fusoOrigem) };
  const fuso = resolverFusoExibicao(preferencia, fusoOrigem);
  try {
    return { texto: new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fuso }).format(instante), fuso };
  } catch {
    return { texto: instante.toISOString(), fuso: "UTC" };
  }
}
