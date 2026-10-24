import {runInNewContext} from 'node:vm';
import { createHash } from 'node:crypto';
import { expect, it, vi, afterEach } from 'vitest';
import * as op from '../../scripts/visual/oportunidades-inbox.mjs';
import { ESTADOS, combinacoes } from '../../scripts/visual/nucleo-captura.mjs';
import * as cli from '../../scripts/visual/capturar-inbox.mjs';
const todos: Parameters<typeof combinacoes>[0] = { alvos: ['app', 'prototipo'], estados: Object.keys(ESTADOS) };
afterEach(() => { vi.unstubAllEnvs(); });
it('extensaoCLI238 possui bijecao220+18, preserva190/220 byteiguais semduplicatas', () => {
    expect(op.combinacoesCaptura327).toBeTypeOf('function');
    const casos = op.combinacoesCaptura327({ alvos: ['app', 'prototipo'], estados: Object.keys(op.ESTADOS_CAPTURA327) });
    const antigos = combinacoes(todos), key = (c: {
        alvo: string;
        estado: string;
        tema: string;
        tamanho: string;
    }) => [c.alvo, c.estado, c.tema, c.tamanho].join('|');
    expect(casos).toHaveLength(238);
    expect(new Set(casos.map(key)).size).toBe(238);
    expect(casos.filter(c => Object.hasOwn(ESTADOS, c.estado))).toEqual(antigos);
    expect(createHash('sha256').update(JSON.stringify(casos.filter(c => Object.hasOwn(ESTADOS, c.estado)))).digest('hex')).toBe('67dafd95efaa1e8ad6aea9c531fff03bffabe8066abafe566f947a35a5ce1a52');
    const estados190 = Object.keys(ESTADOS).filter(e => !['painel-detalhes-pessoa', 'painel-detalhes-b2b', 'painel-detalhes-convidado'].includes(e));
    const antigos190 = combinacoes({ ...todos, estados: estados190 });
    expect(antigos190).toHaveLength(190);
    expect(createHash('sha256').update(JSON.stringify(casos.filter(c => estados190.includes(c.estado)))).digest('hex')).toBe('c669324e360cf097784814ae7750dc2d54becb933b4d8f0ea27b416b236c1ea4');
    expect(casos.filter(c => estados190.includes(c.estado))).toEqual(antigos190);
    expect(casos.filter(c => !Object.hasOwn(ESTADOS, c.estado))).toHaveLength(18);
    expect(op.combinacoesCaptura327({ alvos: ['app', 'prototipo'], estados: ['painel-oportunidades'] })).toHaveLength(12);
    expect(op.combinacoesCaptura327({ alvos: ['app', 'prototipo'], estados: ['painel-oportunidades-leitor'] })).toHaveLength(6);
});
it('planejamento usado pelo mainCLI expoe238 e rejeita estado desconhecido', () => {
    expect(cli.planejarCapturas327).toBeTypeOf('function');
    const p = cli.planejarCapturas327(['--alvo', 'ambos', '--estado', 'todos', '--base', 'http://localhost:3110']);
    if (p.ajuda)
        throw Error('planejamento retornou ajuda');
    expect(p.tarefas).toHaveLength(238);
    expect(p.estados).toContain('painel-oportunidades');
    expect(() => cli.planejarCapturas327(['--estado', 'inventado'])).toThrow();
    expect(cli.planejarCapturas327(['--help']).ajuda).toBe(true);
});
it('configCLI327 nao requer demo-ids e usa ator explicito, jamais credencial padrao', () => {
    const env = { INBOX_VISUAL_OPORTUNIDADES_ATENDIMENTO: 'inbox-327-proposta-atendimento', INBOX_VISUAL_OPORTUNIDADES_ID: 'inbox-327-proposta', INBOX_VISUAL_OPORTUNIDADES_PESSOA: 'inbox-327-pessoa', INBOX_VISUAL_USUARIO_ID: 'inbox-327-admin', INBOX_VISUAL_EMAIL: 'admin327@genius.test' };
    expect(op.configurarOportunidadesCli('painel-oportunidades', env).ator).toBe('admin');
    expect(() => op.configurarOportunidadesCli('painel-oportunidades-leitor', env)).toThrow();
    expect(() => op.configurarOportunidadesCli('painel-oportunidades', {})).toThrow();
    expect(() => op.combinacoesCaptura327({ alvos: ['app'], estados: ['painel-oportunidades', 'painel-oportunidades'] })).toThrow();
});
const suporte = new URL('../../docs/planejamento/inbox-prototipo/prototipo/support.js', import.meta.url).href;
const texto = "TypeError: Cannot read properties of undefined (reading 'sel')\n" + ' at Component.componentDidUpdate (eval at evalDcLogic (' + suporte + ':844:16), <anonymous>:143:202)\n' + ' at StreamableComponent.componentDidUpdate (' + suporte + ':1013:24)';
const hashes = { htmlSha256: '7698a34bad041c95f45710cfe3ed6f79a97ba5f49bf5d941751c37324233d8cf', supportSha256: 'd6bb6dd3aadb9ff722d5d6db2193572ece476b915899575a571de7a0717f001f' };
it('excecaoEXATA somente consoleerrorPROTO, hashescallsites iguais e limiteestatico', () => {
    const entrada = { alvo: 'prototipo', tipo: 'error', texto, hashes };
    expect(op.excecaoConsolePrototipo327(entrada)).toBe(true);
    for (const e of [{ ...entrada, alvo: 'app' }, { ...entrada, tipo: 'pageerror' }, { ...entrada, tipo: 'warning' }, { ...entrada, hashes: { ...hashes, htmlSha256: '0'.repeat(64) } }, { ...entrada, hashes: { ...hashes, supportSha256: '0'.repeat(64) } }, { ...entrada, texto: texto.replace('143:202', '143:203') }, { ...entrada, texto: texto.replace('1013:24', '1013:25') }, { ...entrada, texto: texto.replace('sel', 'convs') }, { ...entrada, texto: caminhoDivergente(texto, suporte) }])
        expect(op.excecaoConsolePrototipo327(e)).toBe(false);
});

function caminhoDivergente(erro:string, suporte:string){return erro.replace(suporte,suporte+'-divergente');}
it.each([
 ['A',new URL('../../scripts/visual/oportunidades-inbox.mjs',import.meta.url).href],
 ['TESTER','file:///C:/worktrees/tester/erp-genius/scripts/visual/oportunidades-inbox.mjs'],
 ['ROOT','file:///C:/worktrees/root/erp-genius/scripts/visual/oportunidades-inbox.mjs'],
])('negativo de path continua divergente na raiz %s sem depender do nome do worktree',(_nome,arquivo)=>{
 const observado=new URL('../../docs/planejamento/inbox-prototipo/prototipo/support.js',arquivo).href;
 const predicado=runInNewContext('('+op.excecaoConsolePrototipo327.toString().replaceAll('import.meta.url',JSON.stringify(arquivo))+')',{URL,__vite_ssr_import_meta__:{url:arquivo}}) as typeof op.excecaoConsolePrototipo327;
 const local=texto.replaceAll(suporte,observado),entrada={alvo:'prototipo',tipo:'error',texto:local,hashes};
 expect(predicado(entrada)).toBe(true);expect(predicado({...entrada,texto:caminhoDivergente(local,observado)})).toBe(false);
});
