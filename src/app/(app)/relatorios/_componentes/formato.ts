import { variacao } from "@/server/relatorios/periodo";

export type ParamsRelatorio = Record<string, string>;

const num = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const dinheiro = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtInteiro = (n: number) => inteiro.format(n);
export const fmtPct = (v: number | null) => (v == null ? "—" : `${num.format(Math.round(v * 1000) / 10)}%`);
export const fmtDias = (v: number | null) => (v == null ? "—" : `${num.format(v)} d`);
export const fmtMinutos = (v: number | null) =>
  v == null ? "—" : v < 60 ? `${num.format(v)} min` : `${num.format(Math.round((v / 60) * 10) / 10)} h`;

export const fmtMoedas = (xs: { moeda: string; valor: number }[]) =>
  xs.length === 0 ? "—" : xs.map((x) => `${x.moeda} ${dinheiro.format(x.valor)}`).join(" · ");

export function variacaoMoedas(a: { moeda: string; valor: number }[], b: { moeda: string; valor: number }[]) {
  if (a.length === 1 && b.length === 1 && a[0].moeda === b[0].moeda) return variacao(a[0].valor, b[0].valor).texto;
  return variacao(null, null).texto;
}

export const variacaoTexto = (atual: number | null, anterior: number | null) => variacao(atual, anterior).texto;

export function hrefRelatorio(atuais: ParamsRelatorio, trocas: Record<string, string | null | undefined> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...atuais, ...trocas })) {
    if (v === null || v === undefined || v === "") continue;
    q.set(k, v);
  }
  const s = q.toString();
  return s ? `/relatorios?${s}` : "/relatorios";
}
