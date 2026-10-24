import type { Page } from 'playwright-core';
import type { PedidoDetalhes325, ProvaDetalhes325 } from './detalhes-inbox.mjs';
export type TokenColeta325 = Readonly<{ versao: number; iniciados: number; pendentes: number }>;
export type AuditoriaColeta325 = { falhas: string[]; diagnosticos: unknown[]; iniciados: number; settled: number; pendentes: number; selado: boolean; fechado: boolean; registros: (PedidoDetalhes325 & { settled: boolean })[]; browserFechado?: boolean; aceitavel?: boolean };
export type ColetorDetalhes325 = { aguardar(): Promise<TokenColeta325>; selar(token: TokenColeta325, prova: ProvaDetalhes325): void; auditarFechamento(): Promise<AuditoriaColeta325>; encerrar(): Promise<AuditoriaColeta325>; estado(): { iniciados: number; pendentes: number; versao: number; selado: boolean; fechado: boolean; encerrado: boolean } };
export type CapturaAuditavel325 = { falhas: string[]; diagnosticos: unknown[]; coletaDetalhes?: AuditoriaColeta325; aceiteCandidato?: boolean };
export declare function instalarColetorDetalhes325(pagina: Page, identidade: Pick<ProvaDetalhes325, 'base' | 'contextoId' | 'paginaId' | 'atendimentoId'>, opcoes?: { timeoutMs?: number }): ColetorDetalhes325;
export declare function finalizarCapturasDetalhes325(entradas: { coletor: ColetorDetalhes325; captura: CapturaAuditavel325 | null }[]): Promise<void>;
