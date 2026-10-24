import type { BrowserContext, Page } from 'playwright-core';
import type { AlvoVisual, EstadoVisual, TemaVisual, TamanhoVisual } from './nucleo-captura.mjs';
import type { ColetorOportunidades327, IdentidadeColetor327 } from './coletor-oportunidades.mjs';
export type ConfigOportunidades = {
    atendimentoId: string;
    oportunidadeId: string;
    pessoaId: string;
    ator: 'admin' | 'leitor';
    usuarioId: string;
    email: string;
};
export type DescricaoOportunidades = {
    alvo: 'app' | 'prototipo';
    ator: 'admin' | 'leitor';
    nomeCabecalho: string;
    subtitulo: string | null;
    produto: string;
    valorTexto: string;
    etapa: string;
    podeMover: boolean;
    /** Expectativas APP da fixture fechada, independentes de moverEtapa; ausentes no PROTO. */
    podeAbrirFunil?: boolean;
    hrefFunilAtual?: string;
    hrefFunilLegado?: string | null;
    segmentos: string[];
    opcoes: {
        valor: string;
        rotulo: string;
        recusada: boolean;
    }[];
    campos: {
        rotulo: string;
        valor: string;
    }[];
};
export type PreflightOportunidades = {
    statusSessao: 200;
    statusPainel: 200;
    statusDetalhes: 200;
    statusOportunidades: 200;
    leiturasPreflight: 4;
    corpoDetalhesSha256: string;
    corpoOportunidadesSha256: string;
    aquisicoesUI: null;
    atendimentoId: string;
    oportunidadeId: string;
    pessoaId: string;
    ator: 'admin' | 'leitor';
    capacidades: {
        veLead: boolean;
        verContato: boolean;
        editarContato: boolean;
        moverEtapa: boolean;
        podeEnviar: boolean;
    };
    descricao: DescricaoOportunidades;
};
export type InstrumentacaoOportunidades327 = {
    coletor: ColetorOportunidades327;
    identidade: IdentidadeColetor327;
};
export const ESTADOS_OPORTUNIDADES327: Readonly<Record<string, EstadoVisual>>;
export const ESTADOS_CAPTURA327: Readonly<Record<string, EstadoVisual>>;
export function combinacoesCaptura327(opcoes: {
    alvos: AlvoVisual[];
    estados: string[];
}): {
    alvo: AlvoVisual;
    tema: TemaVisual;
    tamanho: TamanhoVisual;
    estado: string;
}[];
export function configurarOportunidadesCli(estado: string, env?: Record<string, string | undefined>): Readonly<ConfigOportunidades>;
export function configurarOportunidades(entrada: ConfigOportunidades): Readonly<ConfigOportunidades>;
export function descricaoOportunidades(config: ConfigOportunidades, alvo?: 'app' | 'prototipo', cabecalho?: {
    nome: string;
    subtitulo: string;
    leadIdLegado?: string | null;
}): DescricaoOportunidades;
export function confirmarOportunidades(contexto: BrowserContext, base: string, config: ConfigOportunidades): Promise<PreflightOportunidades>;
export function semanticaOportunidadesProntas(descricao: DescricaoOportunidades): boolean;
export function semanticaDetalhesInicial327(descricao: DescricaoOportunidades): boolean;
export function abrirOportunidadesApp(pagina: Page, contexto: BrowserContext, base: string, config: ConfigOportunidades, instrumentacao: InstrumentacaoOportunidades327): Promise<{
    metadados: {
        oportunidadesPreflight: PreflightOportunidades;
        aquisicoesUI: null;
        descricaoEsperada: DescricaoOportunidades;
    };
}>;
export function abrirOportunidadesPrototipo(pagina: Page, config: ConfigOportunidades): Promise<{
    metadados: {
        referenciaOriginal: true;
        descricaoEsperada: DescricaoOportunidades;
        aquisicoesUI: null;
    };
}>;
export function excecaoConsolePrototipo327(entrada: {
    alvo: string;
    tipo: string;
    texto: string;
    hashes: {
        htmlSha256: string;
        supportSha256: string;
    } | null;
}): boolean;
