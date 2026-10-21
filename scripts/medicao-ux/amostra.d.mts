import type { Achado } from "./achados.mjs";
export function gerador(semente: number): () => number;
export function sortear<T extends { linha: number }>(lista: T[], q: number, aleatorio: () => number): T[];
export function amostra(achados: Achado[], qMedia: number, qBaixa: number, semente: number): Achado[];
export function argumentosDaAmostra(args: string[]): { qMedia: number; qBaixa: number; semente: number };
