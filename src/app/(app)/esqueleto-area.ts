import { ROTULO_ABA } from "./financeiro/abas";

// Formato do esqueleto do (app)/loading.tsx pelo caminho de destino (#174). Esse loading cobre a espera da
// PRIMEIRA entrada numa área com layout próprio: o layout da área ainda não montou, e o loading.tsx da área
// fica dentro dele. Aqui só as áreas cujo layout desenha título, cabeçalho ou abas; o resto usa o genérico.

export type AreaEsqueleto = "financeiro" | "configuracao" | "matricula" | "abas";

export interface FormatoEsqueletoArea {
  area: AreaEsqueleto;
  /** O que o leitor de tela ouve ("Carregando …"). */
  rotulo: string;
}

const ABAS_FINANCEIRO = Object.keys(ROTULO_ABA).join("|");

const REGRAS: { padrao: RegExp; formato: FormatoEsqueletoArea }[] = [
  // Só as abas do (painel): /financeiro/acertos-taxa, /continuidade etc. não têm título nem barra de abas.
  { padrao: new RegExp(`^/financeiro(?:/?$|/(?:${ABAS_FINANCEIRO})(?:/|$))`), formato: { area: "financeiro", rotulo: "financeiro" } },
  { padrao: /^\/configuracao(?:\/|$)/, formato: { area: "configuracao", rotulo: "configuração" } },
  // /matriculas/nova não fica sob o layout do registro.
  { padrao: /^\/matriculas\/(?!nova(?:\/|$))[^/]+(?:\/|$)/, formato: { area: "matricula", rotulo: "matrícula" } },
  { padrao: /^\/academico(?:\/|$)/, formato: { area: "abas", rotulo: "acadêmico" } },
  { padrao: /^\/diario(?:\/|$)/, formato: { area: "abas", rotulo: "diário de aulas" } },
];

/** O formato da área de `caminho`, ou null para o esqueleto genérico. */
export function areaDoEsqueleto(caminho: string): FormatoEsqueletoArea | null {
  return REGRAS.find((r) => r.padrao.test(caminho))?.formato ?? null;
}
