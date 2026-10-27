import { ROTULO_ABA } from "./financeiro/abas";

export type AreaEsqueleto = "financeiro" | "configuracao" | "matricula" | "abas";

export interface FormatoEsqueletoArea {
  area: AreaEsqueleto;
  rotulo: string;
}

const ABAS_FINANCEIRO = Object.keys(ROTULO_ABA).join("|");

const REGRAS: { padrao: RegExp; formato: FormatoEsqueletoArea }[] = [
  { padrao: new RegExp(`^/financeiro(?:/?$|/(?:${ABAS_FINANCEIRO})(?:/|$))`), formato: { area: "financeiro", rotulo: "financeiro" } },
  { padrao: /^\/configuracao(?:\/|$)/, formato: { area: "configuracao", rotulo: "configuração" } },
  { padrao: /^\/matriculas\/(?!nova(?:\/|$))[^/]+(?:\/|$)/, formato: { area: "matricula", rotulo: "matrícula" } },
  { padrao: /^\/academico(?:\/|$)/, formato: { area: "abas", rotulo: "acadêmico" } },
  { padrao: /^\/diario(?:\/|$)/, formato: { area: "abas", rotulo: "diário de aulas" } },
];

export function areaDoEsqueleto(caminho: string): FormatoEsqueletoArea | null {
  return REGRAS.find((r) => r.padrao.test(caminho))?.formato ?? null;
}
