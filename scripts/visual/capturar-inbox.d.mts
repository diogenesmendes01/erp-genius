import type { BrowserContext, Page } from 'playwright-core';
import type { InstrumentacaoOportunidades327 } from './oportunidades-inbox.mjs';
import type { AlvoVisual, TemaVisual, TamanhoVisual } from './nucleo-captura.mjs';
export declare function abrirApp(pagina: Page, contexto: BrowserContext, base: string, ids: {
    beatriz: string;
    mariana: string;
    semNome?: string;
}, estado: string, tamanho: string, instrumentacao327?: InstrumentacaoOportunidades327): Promise<{
    finalizar?: () => Promise<void>;
    metadados?: Record<string, unknown>;
}>;
export declare function abrirPrototipo(pagina: Page, estado: string): Promise<void | {
    metadados: Record<string, unknown>;
}>;
export declare function planejarCapturas327(argv: string[]): {
    ajuda: true;
} | {
    ajuda: false;
    alvo: string;
    estado: string;
    base: string;
    alvos: AlvoVisual[];
    estados: string[];
    tarefas: {
        alvo: AlvoVisual;
        tema: TemaVisual;
        tamanho: TamanhoVisual;
        estado: string;
    }[];
};
export declare function executarCapturas327(argv?: string[]): Promise<void>;
