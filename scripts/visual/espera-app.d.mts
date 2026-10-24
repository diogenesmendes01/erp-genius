import type { BrowserContext, Page } from "playwright-core";

export function autenticarApp(contexto: BrowserContext, base: string, email: string, senha: string): Promise<void>;
export function esperarConteudoApp(pagina: Page, estado: string, tamanho: string): Promise<void>;
export function esperarHidratacaoApp(pagina: Page): Promise<void>;

export function semanticaThreadHumanaPronta(): boolean;

export function abrirPopoverColunaApp(pagina: Page, estado: string, tamanho: string): Promise<void>;
export function semanticaPopoverColunaPronta(titulo: string): boolean;

export function semanticaPainelDetalhesPronto(): boolean;

export function abrirMenuConversaApp(pagina: Page, tamanho: string): Promise<void>;
export function semanticaMenuConversaPronto(): boolean;

export function abrirBuscaConversaApp(pagina: Page, tamanho: string): Promise<void>;
export function semanticaBuscaConversaPronta(): boolean;

export function abrirNotaConversaApp(pagina: Page, tamanho: string): Promise<void>;
export function semanticaRodapePronto(modo: "responder" | "nota"): boolean;

export function confirmarPainelSemNome(contexto: BrowserContext, base: string, id: string): Promise<{ status: 200; semNome: true; podeEditarNome: true }>;
export function semanticaPainelSemNomePronto(): boolean;

export function confirmarPainelSecretaria(contexto: BrowserContext, base: string, id: string): Promise<{ status: 200; matriculaId: string; codigo: string }>;
export function semanticaPainelSecretariaPronto(alvo: { matriculaId: string; codigo: string }): boolean;
