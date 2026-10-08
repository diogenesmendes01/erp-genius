export const PADRAO_TAILWIND: Set<string>;
export const UTILITARIO_COR: RegExp;
export function mapaDeCores(textoConfig: string): Map<string, Set<number>>;
export function contarCores(texto: string, mapa: Map<string, Set<number>>): { fora: number; mapeadas: number };
export function tags(texto: string, nomes: string): { pos: number; tag: string; texto: string }[];
export function nomesDeControles(texto: string): {
  controles: number;
  semNome: number;
  dentroLabel: number;
  comAria: number;
  comHtmlFor: number;
};
export function tokensCss(css: string, seletor: string): Record<string, string>;
export function corSobre(valor: string, fundo: number[]): number[];
export function hexParaRgb(valor: string): number[];
export function contraste(a: number[], b: number[]): number;
export function paresReprovados(css: string): {
  reprovados: { tema: "claro" | "escuro"; familia: string; par: string; valor: number }[];
  familias: string[];
};
export function paginasCobertas(paginas: string[], diretoriosCom: Set<string>): number;
export function ehTeste(caminhoPosix: string): boolean;
export function temProxima(texto: string): boolean;
export function soParaFrente(texto: string): boolean;
export function chamaServerAction(texto: string): boolean;
export function semCatchLiteral(texto: string): boolean;
export function semCatchCentral(texto: string): boolean;
export function inteiroDoArgumento(valor: string | undefined, nome: string, padrao: number): number;
export function normalizarSeveridade(valor: unknown): "Alta" | "Media" | "Baixa";
export function estimativaEstratificada(estratos: { populacao: number; amostra: number; casos: number }[]): {
  total: number;
  proporcao: number;
  ic95: [number, number];
};
export function exigirNode(versao?: string): void;
