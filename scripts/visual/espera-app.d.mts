import type { BrowserContext, Page } from "playwright-core";

export function autenticarApp(contexto: BrowserContext, base: string, email: string, senha: string): Promise<void>;
export function esperarConteudoApp(pagina: Page, estado: string, tamanho: string): Promise<void>;
export function esperarHidratacaoApp(pagina: Page): Promise<void>;

export function semanticaThreadHumanaPronta(): boolean;
