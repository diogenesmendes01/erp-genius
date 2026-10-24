import { EventEmitter } from 'node:events';
import { afterEach, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ launch: vi.fn(), writes: new Map<string, string>(), modo: 'ok', paginas: [] as unknown[], browser: null as unknown, indice: 0, alvoIndice: 0, badReference: false }));
vi.mock('playwright-core', () => ({ chromium: { launch: h.launch } }));
vi.mock('node:fs/promises', async () => ({ ...await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises'), readFile: async (p: unknown, ...args: unknown[]) => { if (h.badReference && String(p).endsWith('support.js'))
        return Buffer.from('divergente'); const real = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises'); return real.readFile(p as never, ...args as [
    ]); }, mkdir: vi.fn(async () => { }), writeFile: vi.fn(async (p: unknown, s: unknown) => { h.writes.set(String(p), String(s)); }) }));
vi.mock('../../scripts/visual/espera-app.mjs', async () => ({ ...await vi.importActual('../../scripts/visual/espera-app.mjs'), autenticarApp: vi.fn(async () => { }) }));
vi.mock('../../scripts/visual/oportunidades-inbox.mjs', async () => ({ ...await vi.importActual('../../scripts/visual/oportunidades-inbox.mjs'), abrirOportunidadesApp: async (p: unknown, _c: unknown, _b: unknown, _cfg: unknown, i: unknown) => abrir(p as FakePage, i as never), abrirOportunidadesPrototipo: async (p: unknown) => { eventos(p as FakePage); return { metadados: { referenciaOriginal: true } }; } }));
import * as cli from '../../scripts/visual/capturar-inbox.mjs';
import { hashCorpoPainel327 } from '../../scripts/visual/coletor-oportunidades.mjs';
const detalhes = { pessoa: { id: 'inbox-327-pessoa' }, oportunidade: { id: 'inbox-327-proposta' }, campos: [] }, op = { atual: { id: 'inbox-327-proposta' }, outras: [], pessoaId: 'inbox-327-pessoa' };
const base = 'http://localhost:3110', raiz = base + '/api/inbox/atendimentos/inbox-327-proposta-atendimento/painel/';
function pedido(p: FakePage, url: string, body: unknown) { const q = { url: () => url, method: () => 'GET', frame: () => ({ page: () => p }), response: async () => r, failure: () => ({ errorText: 'net::ERR_ABORTED' }) }; const r = { request: () => q, status: () => 200, ok: () => true, url: () => url, finished: async () => null, json: async () => body }; return { q, r, start: () => p.emit('request', q), fim: () => { p.emit('response', r); p.emit('requestfinished', q); } }; }
function eventos(p: FakePage) { if (p.indice !== h.alvoIndice)
    return; switch (h.modo) {
    case 'excecao':
    case 'pageerrorExato':
    case 'quaseExcecao': {
        const suporte = new URL('../../docs/planejamento/inbox-prototipo/prototipo/support.js', import.meta.url).href;
        let texto = "TypeError: Cannot read properties of undefined (reading 'sel')\n" + ' at Component.componentDidUpdate (eval at evalDcLogic (' + suporte + ':844:16), <anonymous>:143:202)\n' + ' at StreamableComponent.componentDidUpdate (' + suporte + ':1013:24)';
        if (h.modo === 'quaseExcecao')
            texto = texto.replace('143:202', '143:203');
        if (h.modo === 'pageerrorExato')
            p.emit('pageerror', new Error(texto));
        else
            p.emit('console', { type: () => 'error', text: () => texto });
        break;
    }
    case 'react':
        p.emit('console', { type: () => 'warning', text: () => 'Hydration failed' });
        break;
    case 'console':
        p.emit('console', { type: () => 'error', text: () => 'erro inesperado' });
        break;
    case 'pageerror':
        p.emit('pageerror', new Error('erro nativo'));
        break;
    case 'http':
        p.emit('response', { status: () => 500, url: () => base + '/api/inesperado', request: () => ({ method: () => 'GET', url: () => base + '/api/inesperado' }) });
        break;
    case 'aborto': {
        const q = pedido(p, base + '/api/inesperado', {});
        q.start();
        p.emit('requestfailed', q.q);
        break;
    }
    case 'abortoOp': {
        const q = pedido(p, raiz + 'oportunidades', op);
        q.start();
        p.emit('requestfailed', q.q);
        break;
    }
} }
class FakePage extends EventEmitter {
    fechada = false;
    indice = h.indice++;
    setDefaultTimeout() { }
    url() { return base + '/inbox?c=inbox-327-proposta-atendimento'; }
    isClosed() { return this.fechada; }
    context() { return { browser: () => h.browser }; }
    async evaluate() { return true; }
    async screenshot() { if (h.modo === 'aposSelo' && this.indice === h.alvoIndice) {
        const q = pedido(this, raiz + 'oportunidades', op);
        q.start();
        q.fim();
    } }
}
async function abrir(p: FakePage, i: {
    coletor: {
        aguardar(): Promise<unknown>;
        marcarTransicao(t: unknown, p: unknown): void;
    };
    identidade: Record<string, unknown>;
}) { expect(i?.coletor, 'CLI precisa instalar coletor antes navegar').toBeTruthy(); const d = pedido(p, raiz + 'detalhes', detalhes); d.start(); d.fim(); i.coletor.marcarTransicao(await i.coletor.aguardar(), { ...i.identidade, fase: 'detalhes-inicial', atendimentoAtualId: 'inbox-327-proposta-atendimento', corpoEsperadoSha256: hashCorpoPainel327(detalhes), paginaAtiva: true, semanticaFinal: true }); const o = pedido(p, raiz + 'oportunidades', op); o.start(); o.fim(); eventos(p); return { metadados: { descricaoEsperada: { alvo: 'app' }, oportunidadesPreflight: { leiturasPreflight: 4, corpoOportunidadesSha256: hashCorpoPainel327(op) } } }; }
function preparar() { h.writes.clear(); h.paginas = []; h.indice = 0; h.launch.mockImplementation(async () => { let ligado = true; const b = { isConnected: () => ligado, close: async () => { ligado = false; }, newContext: async () => { let p: FakePage; return { addInitScript: async () => { }, route: async () => { }, newPage: async () => { p = new FakePage(); h.paginas.push(p); return p; }, close: async () => { p.fechada = true; p.emit('close'); if (h.modo === 'aposCloseGenerico' && p.indice === h.alvoIndice) {
            const q = pedido(p, base + '/api/inesperado', {});
            q.start();
            p.emit('requestfailed', q.q);
        } if (h.modo === 'aposClose' && p.indice === h.alvoIndice) {
            const q = pedido(p, raiz + 'oportunidades', op);
            q.start();
            q.fim();
        } } }; } }; h.browser = b; return b; }); for (const [k, v] of Object.entries({ PW_CHROMIUM: 'fake-no-browser', INBOX_VISUAL_OPORTUNIDADES_ATENDIMENTO: 'inbox-327-proposta-atendimento', INBOX_VISUAL_OPORTUNIDADES_ID: 'inbox-327-proposta', INBOX_VISUAL_OPORTUNIDADES_PESSOA: 'inbox-327-pessoa', INBOX_VISUAL_OPORTUNIDADES_ADMIN_USUARIO_ID: 'inbox-327-admin', INBOX_VISUAL_OPORTUNIDADES_ADMIN_EMAIL: 'admin327@genius.test', INBOX_VISUAL_OPORTUNIDADES_ADMIN_SENHA: 'ficticia-unit', INBOX_VISUAL_OPORTUNIDADES_LEITOR_USUARIO_ID: 'inbox-327-leitor', INBOX_VISUAL_OPORTUNIDADES_LEITOR_EMAIL: 'leitor327@genius.test', INBOX_VISUAL_OPORTUNIDADES_LEITOR_SENHA: 'ficticia-unit' }))
    vi.stubEnv(k, v); }
afterEach(() => { vi.unstubAllEnvs(); h.modo = 'ok'; h.alvoIndice = 0; h.badReference = false; });
const executar = (estado = 'painel-oportunidades', alvo = 'app') => cli.executarCapturas327(['--estado', estado, '--alvo', alvo, '--base', base]);
function manifesto() { const raw = [...h.writes.entries()].find(([k]) => k.endsWith('manifesto.json'))?.[1]; expect(raw).toBeTruthy(); return JSON.parse(raw!) as {
    browsersClosed: boolean;
    capturas: {
        falhas: string[];
        aceiteCandidato: boolean;
        aquisicoesUI: {
            detalhes: number;
            oportunidades: number;
        };
        coletaOportunidades: {
            browserFechado: boolean;
        };
    }[];
}; }
it.each(['painel-oportunidades', 'painel-oportunidades-leitor'])('CLI %s mede UI real do coletor separado e fecha todos antesaceite', async (estado) => { preparar(); expect(cli.executarCapturas327).toBeTypeOf('function'); await executar(estado); const m = manifesto(); expect(m.browsersClosed).toBe(true); expect(m.capturas).toHaveLength(6); for (const c of m.capturas) {
    expect(c.falhas).toEqual([]);
    expect(c.aceiteCandidato).toBe(true);
    expect(c.aquisicoesUI).toEqual({ detalhes: 1, oportunidades: 1 });
    expect(c.coletaOportunidades.browserFechado).toBe(true);
} expect(h.paginas.every(p => (p as FakePage).isClosed())).toBe(true); });
it.each(['react', 'console', 'pageerror', 'http', 'aborto', 'abortoOp', 'aposSelo', 'aposClose', 'aposCloseGenerico'])('CLI nova327 preserva guarda %s e negativo final depoisclose', async (modo) => { preparar(); h.modo = modo; await expect(executar()).rejects.toThrow(); const m = manifesto(); expect(m.browsersClosed).toBe(true); expect(m.capturas[0].falhas.length).toBeGreaterThan(0); expect(m.capturas[0].aceiteCandidato).toBe(false); expect(h.paginas.every(p => (p as FakePage).isClosed())).toBe(true); });
it('todos18novos casos passam pela mesma guardaReact953, inclusive PROTO e leitor', async () => { for (const [estado, alvo, n] of [['painel-oportunidades', 'ambos', 12], ['painel-oportunidades-leitor', 'app', 6]] as const)
    for (let indice = 0; indice < n; indice++) {
        preparar();
        h.modo = 'react';
        h.alvoIndice = indice;
        await expect(executar(estado, alvo)).rejects.toThrow();
        const m = manifesto();
        expect(m.capturas[indice].falhas.join(' ')).toMatch(/React|Hydration/);
        expect(m.browsersClosed).toBe(true);
    } });
it('consoleerrorPROTO exato tem bruto privado e limite estatico, APP/pageerror/quase nunca excecao', async () => {
    preparar();
    h.modo = 'excecao';
    await executar('painel-oportunidades', 'prototipo');
    const m = manifesto();
    expect(m.capturas).toHaveLength(6);
    expect(m.capturas.every(c => c.falhas.length === 0 && c.aceiteCandidato)).toBe(true);
    const bruto = [...h.writes.entries()].find(([k]) => k.includes('prototipo327-console-bruto-'));
    expect(bruto?.[1]).toContain('143:202');
    const raw = [...h.writes.entries()].find(([k]) => k.endsWith('manifesto.json'))![1];
    expect(raw).not.toContain('143:202');
    expect(raw).toContain('consoleErrorsExcecaoExata');
    for (const [modo, alvo] of [['excecao', 'app'], ['pageerrorExato', 'prototipo'], ['quaseExcecao', 'prototipo']]) {
        preparar();
        h.modo = modo;
        await expect(executar('painel-oportunidades', alvo)).rejects.toThrow();
        expect(manifesto().capturas[0].falhas.length).toBeGreaterThan(0);
    }
});
it('hash diferente do original recusa anteslaunch sem editar referencia', async () => { preparar(); h.badReference = true; h.launch.mockClear(); await expect(executar('painel-oportunidades', 'prototipo')).rejects.toThrow(/Originais/); expect(h.launch).not.toHaveBeenCalled(); });
