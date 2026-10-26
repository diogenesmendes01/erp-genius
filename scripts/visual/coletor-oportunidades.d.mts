import type { Page, Request } from 'playwright-core';
export type IdentidadeColetor327 = {
    base: string;
    contextoId: string;
    paginaId: string;
    atendimentoId: string;
    oportunidadeId: string;
    pessoaId: string;
    usuarioId: string;
};
export type ProvaColetor327 = IdentidadeColetor327 & {
    fase: 'detalhes-inicial' | 'oportunidades';
    atendimentoAtualId: string | null;
    corpoEsperadoSha256: string;
    paginaAtiva: boolean;
    semanticaFinal: boolean;
};
export type TokenColetor327 = Readonly<{
    versao: number;
    iniciados: number;
    pendentes: number;
}>;
export type AuditoriaColetor327 = {
    falhas: string[];
    diagnosticos: unknown[];
    iniciados: number;
    settled: number;
    pendentes: number;
    selado: boolean;
    fechado: boolean;
    fase: string;
    transicaoOrdem: number | null;
    registros: unknown[];
    aquisicoesUI: {
        detalhes: number;
        oportunidades: number;
    };
    browserFechado?: boolean;
    aceitavel?: boolean;
};
export type ColetorOportunidades327 = {
    aguardar(ms?: number): Promise<TokenColetor327>;
    marcarTransicao(token: TokenColetor327, prova: ProvaColetor327): void;
    selar(token: TokenColetor327, prova: ProvaColetor327): void;
    acompanha(pedido: Request): boolean;
    auditarFechamento(): Promise<AuditoriaColetor327>;
    encerrar(): Promise<AuditoriaColetor327>;
    estado(): {
        iniciados: number;
        pendentes: number;
        versao: number;
        fase: string;
        selado: boolean;
        fechado: boolean;
        encerrado: boolean;
    };
};
export type CapturaAuditavel327 = {
    falhas: string[];
    diagnosticos: unknown[];
    aceiteCandidato?: boolean;
    coletaOportunidades?: AuditoriaColetor327;
    aquisicoesUI?: {
        detalhes: number;
        oportunidades: number;
    } | null;
};
export function hashCorpoPainel327(corpo: unknown): string;
export function instalarColetorOportunidades327(pagina: Page, identidade: IdentidadeColetor327, opcoes?: {
    timeoutMs?: number;
}): ColetorOportunidades327;
export function finalizarCapturasOportunidades327(entradas: {
    coletor: ColetorOportunidades327;
    captura: CapturaAuditavel327 | null;
}[]): Promise<void>;
