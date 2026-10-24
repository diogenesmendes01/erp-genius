import type { BrowserContext, Page } from 'playwright-core';
export type ModoDetalhes325 = 'pessoa' | 'b2b' | 'convidado';
export type ConfiguracaoDetalhes325 = { id: string; modo: ModoDetalhes325; campoRestrito: string | null };
export type Detalhes325Pronto = { corpoEsperadoSha256: string; modo: ModoDetalhes325; nomeCabecalho: string; subtitulo: string; quadrado: boolean; textos: string[]; fichaHref: string | null; empresaHref: string | null; oportunidadeHref: string; participantes: { pessoaId: string; nome: string; naConversa: boolean; hrefConversa: string | null }[]; campoRestrito: string | null; marcaCampoAria: boolean };
export declare const ESTADOS_DETALHES_325: readonly string[];
export declare function configurarDetalhes325(estado: string, env?: Record<string, string | undefined>): ConfiguracaoDetalhes325;
export declare function confirmarDetalhes325(contexto: BrowserContext, base: string, configuracao: ConfiguracaoDetalhes325): Promise<Detalhes325Pronto>;
export declare function semanticaDetalhes325Pronto(esperado: Detalhes325Pronto): boolean;
export declare function abrirDetalhes325(pagina: Page, contexto: BrowserContext, base: string, configuracao: ConfiguracaoDetalhes325): Promise<{ metadados: { detalhes325: Detalhes325Pronto } }>;
export declare function abrirPrototipoDetalhes325(pagina: Page, url: string, estado: string): Promise<void>;

export type PedidoDetalhes325 = { ordem: number; method: string; url: string; erro?: string; contextoId: string; paginaId: string; atendimentoId: string; headersObservados?: boolean; status?: number; corpoConcluido?: boolean; corpoSha256?: string };
export type ProvaDetalhes325 = { base: string; contextoId: string; paginaId: string; atendimentoId: string; atendimentoAtualId: string | null; corpoEsperadoSha256: string; paginaAtiva: boolean; semanticaFinal: boolean };
export declare function hashCorpoDetalhes325(corpo: unknown): string;
export declare function cancelamentoDetalhes325Recuperado(pedido: PedidoDetalhes325, respostas: PedidoDetalhes325[], prova: ProvaDetalhes325 | null): boolean;
