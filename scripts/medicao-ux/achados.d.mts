export type Achado = {
  linha: number;
  area: string;
  rota: string;
  n: number;
  sev: "Alta" | "Media" | "Baixa";
  categoria: string;
  problema: string;
  evidencia: string;
  recomendacao: string;
};
export const CAMINHO_DOC_42: URL;
export function extrairAchados(texto: string): Achado[];
export function resumoPorArea(achados: Achado[]): Record<string, { Alta: number; Media: number; Baixa: number }>;
export function achadosDoRepositorio(): Achado[];
