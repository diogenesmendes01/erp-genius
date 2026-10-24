import type { Page } from "playwright-core";
export type EntradaReal = { estado: string; rota: string; abrir: string; agendar: string | null };
export function configurarEntrada(estado: string, env?: Record<string, string | undefined>): EntradaReal;
export function semanticaEntradaPronta(alvo: EntradaReal): boolean;
export function abrirEntradaApp(pagina: Page, base: string, alvo: EntradaReal): Promise<{ metadados: { entradaReal: EntradaReal; referenciaFuncionalPrototipo: null } }>;
