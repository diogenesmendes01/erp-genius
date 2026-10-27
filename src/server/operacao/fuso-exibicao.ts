import { formatarDataCivil } from "@/lib/data-civil";
import { FusoInstitucionalSchema, dataCivilInstitucional, diaCivilGravado } from "./fuso";

export function resolverFusoExibicao(preferencia: string | null | undefined, fusoOrigem: string) {
  const preferido = FusoInstitucionalSchema.safeParse(preferencia);
  if (preferido.success) return preferido.data;
  const origem = FusoInstitucionalSchema.safeParse(fusoOrigem);
  return origem.success ? origem.data : "UTC";
}

export function fusoInicialDeEntrada(institucional: string | null | undefined, preferencia: string | null | undefined): string {
  for (const fuso of [institucional, preferencia]) {
    const valido = FusoInstitucionalSchema.safeParse(fuso);
    if (valido.success) return valido.data;
  }
  return "";
}

const ESTILOS_INSTANTE = {
  dataHora: { dateStyle: "short", timeStyle: "short" },
  data: { dateStyle: "short" },
  hora: { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
  diaMesHora: { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;
export type EstiloInstante = keyof typeof ESTILOS_INSTANTE;

export function formatarInstanteExibicao(valor: Date | string, preferencia: string | null | undefined, fusoOrigem: string, estilo: EstiloInstante = "dataHora") {
  const instante = new Date(valor);
  if (!Number.isFinite(instante.getTime())) return { texto: String(valor), fuso: resolverFusoExibicao(preferencia, fusoOrigem) };
  const fuso = resolverFusoExibicao(preferencia, fusoOrigem);
  try {
    return { texto: new Intl.DateTimeFormat("pt-BR", { ...ESTILOS_INSTANTE[estilo], timeZone: fuso }).format(instante), fuso };
  } catch {
    return { texto: instante.toISOString(), fuso: "UTC" };
  }
}

export function formatarDiaCivilGravado(valor: Date | string | null | undefined, fusoEscola: string, ausente = "—"): string {
  if (valor == null || valor === "") return ausente;
  const instante = new Date(valor);
  if (!Number.isFinite(instante.getTime())) return String(valor);
  const fuso = FusoInstitucionalSchema.safeParse(fusoEscola);
  return formatarDataCivil(fuso.success ? diaCivilGravado(instante, fuso.data) : instante.toISOString().slice(0, 10), ausente);
}

export function diaCivilDoPagamento(gravada: Date, fusoEscola: string): string {
  const utc = gravada.toISOString();
  const fuso = FusoInstitucionalSchema.safeParse(fusoEscola);
  if (!fuso.success || utc.endsWith("T00:00:00.000Z")) return utc.slice(0, 10);
  return dataCivilInstitucional(gravada, fuso.data);
}

export function formatarDiaDoPagamento(valor: Date | string | null | undefined, fusoEscola: string, ausente = "—"): string {
  if (valor == null || valor === "") return ausente;
  const instante = new Date(valor);
  if (!Number.isFinite(instante.getTime())) return String(valor);
  return formatarDataCivil(diaCivilDoPagamento(instante, fusoEscola), ausente);
}

export function formatarDiaDaEscola(valor: Date | string | null | undefined, fusoEscola: string, ausente = "—"): string {
  if (valor == null || valor === "") return ausente;
  const instante = new Date(valor);
  if (!Number.isFinite(instante.getTime())) return String(valor);
  const fuso = FusoInstitucionalSchema.safeParse(fusoEscola);
  return formatarDataCivil(fuso.success ? dataCivilInstitucional(instante, fuso.data) : instante.toISOString().slice(0, 10), ausente);
}
