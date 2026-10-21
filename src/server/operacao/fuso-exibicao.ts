import { FusoInstitucionalSchema } from "./fuso";

/** Preferência só interpreta instantes já persistidos; não muda fontes ou datas civis. */
export function resolverFusoExibicao(preferencia: string | null | undefined, fusoOrigem: string) {
  const preferido = FusoInstitucionalSchema.safeParse(preferencia);
  if (preferido.success) return preferido.data;
  const origem = FusoInstitucionalSchema.safeParse(fusoOrigem);
  return origem.success ? origem.data : "UTC";
}

/**
 * Valor inicial de um campo de fuso de ENTRADA (docs/43 §6 item 6): o fuso da escola, senão a preferência de
 * exibição de quem preenche; "" quando nenhum dos dois vale — o campo fica vazio e obrigatório, nunca um
 * "UTC" presumido.
 */
export function fusoInicialDeEntrada(institucional: string | null | undefined, preferencia: string | null | undefined): string {
  for (const fuso of [institucional, preferencia]) {
    const valido = FusoInstitucionalSchema.safeParse(fuso);
    if (valido.success) return valido.data;
  }
  return "";
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
