import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
const base = 'http://localhost:3110', raiz = base + '/api/inbox/atendimentos/a/painel/';
const dono = { base, contextoId: 'ctx', paginaId: 'pag', atendimentoId: 'a', oportunidadeId: 'op', pessoaId: 'pes', usuarioId: 'u' };
const detalhes = { pessoa: { id: 'pes' }, oportunidade: { id: 'op' }, campos: [] }, op = { atual: { id: 'op', etapa: 'PROPOSTA' }, outras: [], pessoaId: 'pes' };
const hashD = createHash('sha256').update('{"campos":[],"oportunidade":{"id":"op"},"pessoa":{"id":"pes"}}').digest('hex');
const hashO = createHash('sha256').update('{"atual":{"etapa":"PROPOSTA","id":"op"},"outras":[],"pessoaId":"pes"}').digest('hex');
const prova = (fase: 'detalhes-inicial' | 'oportunidades') => ({ ...dono, fase, atendimentoAtualId: 'a', corpoEsperadoSha256: fase === 'detalhes-inicial' ? hashD : hashO, paginaAtiva: true, semanticaFinal: true });
async function modulo() { const caminho = '../../scripts/visual/' + 'coletor-oportunidades.mjs'; const x = await import(caminho).catch(() => null); expect(x, 'coletor327 ausente').not.toBeNull(); return x!; }
function pagina() { let fechada = false, conectado = true; const e = new EventEmitter(); return Object.assign(e, { isClosed: () => fechada, context: () => ({ browser: () => ({ isConnected: () => conectado }) }), fechar() { fechada = true; e.emit('close'); }, browserFechar() { conectado = false; } }); }
type Pagina = ReturnType<typeof pagina>;
function pedido(p: Pagina, tipo: 'detalhes' | 'oportunidades' = 'oportunidades', json: () => Promise<unknown> = async () => tipo === 'detalhes' ? detalhes : op, opts: {
    status?: number;
    url?: string;
    method?: string;
    outraPagina?: boolean;
} = {}) {
    let erro = 'net::ERR_ABORTED';
    const q = { method: () => opts.method ?? 'GET', url: () => opts.url ?? raiz + tipo, frame: () => ({ page: () => opts.outraPagina ? {} : p }), failure: () => ({ errorText: erro }), response: async () => r };
    const r = { request: () => q, status: () => opts.status ?? 200, finished: async () => null, json };
    return { q, r, iniciar() { p.emit('request', q); }, headers() { p.emit('response', r); }, terminar() { p.emit('response', r); p.emit('requestfinished', q); }, falhar(codigo = 'net::ERR_ABORTED') { erro = codigo; p.emit('requestfailed', q); } };
}
const turno = () => new Promise<void>(r => setTimeout(r, 0));
async function inicial(p: Pagina, c: {
    aguardar(): Promise<unknown>;
    marcarTransicao(t: unknown, p: unknown): void;
}) { const d = pedido(p, 'detalhes'); d.iniciar(); d.terminar(); c.marcarTransicao(await c.aguardar(), prova('detalhes-inicial')); }
async function fechar(p: Pagina, c: {
    encerrar(): Promise<unknown>;
}) { p.fechar(); p.browserFechar(); return c.encerrar(); }
it('duas fases reais, body/hash e auditoria depois do browser liberam candidata e medem UI sem preflight', async () => { const x = await modulo(), p = pagina(), c = x.instalarColetorOportunidades327(p, dono); await inicial(p, c); const o = pedido(p); o.iniciar(); o.terminar(); c.selar(await c.aguardar(), prova('oportunidades')); const r = await fechar(p, c) as {
    aceitavel: boolean;
    aquisicoesUI: {
        detalhes: number;
        oportunidades: number;
    };
    pendentes: number;
}; expect(r.aceitavel).toBe(true); expect(r.aquisicoesUI).toEqual({ detalhes: 1, oportunidades: 1 }); expect(r.pendentes).toBe(0); expect(p.listenerCount('request')).toBe(0); });
it('Op START antes da transicao explicita nao se torna uma prova positiva', async () => { const x = await modulo(), p = pagina(), c = x.instalarColetorOportunidades327(p, dono); const d = pedido(p, 'detalhes'), o = pedido(p); d.iniciar(); d.terminar(); o.iniciar(); o.terminar(); const token = await c.aguardar(); expect(() => c.marcarTransicao(token, prova('detalhes-inicial'))).toThrow(); expect((await fechar(p, c) as {
    aceitavel: boolean;
}).aceitavel).toBe(false); });
it('transicao exige token proprio e Details completo, pagina/DOM/identidade conhecidos', async () => { const x = await modulo(); for (const alterar of [(p: Record<string, unknown>) => { p.semanticaFinal = false; }, (p: Record<string, unknown>) => { p.atendimentoAtualId = 'b'; }, (p: Record<string, unknown>) => { p.paginaId = 'outra'; }, (p: Record<string, unknown>) => { p.fase = 'oportunidades'; }]) {
    const p = pagina(), c = x.instalarColetorOportunidades327(p, dono), d = pedido(p, 'detalhes');
    d.iniciar();
    d.terminar();
    const token = await c.aguardar(), pv = prova('detalhes-inicial');
    alterar(pv);
    expect(() => c.marcarTransicao(token, pv)).toThrow();
    await fechar(p, c);
} });
it('Details abortado sem substituto nao e ignorado ao trocar de aba', async () => { const x = await modulo(), p = pagina(), c = x.instalarColetorOportunidades327(p, dono); const d = pedido(p, 'detalhes'); d.iniciar(); d.falhar(); const token = await c.aguardar(); expect(() => c.marcarTransicao(token, prova('detalhes-inicial'))).toThrow(); expect((await fechar(p, c) as {
    aceitavel: boolean;
}).aceitavel).toBe(false); });
it('StrictMode Details recuperado exige substituto posterior inteiro/hash e DOM antes do clique', async () => { const x = await modulo(), p = pagina(), c = x.instalarColetorOportunidades327(p, dono); const a = pedido(p, 'detalhes'), b = pedido(p, 'detalhes'); a.iniciar(); a.falhar(); b.iniciar(); b.terminar(); c.marcarTransicao(await c.aguardar(), prova('detalhes-inicial')); const o = pedido(p); o.iniciar(); o.terminar(); c.selar(await c.aguardar(), prova('oportunidades')); const r = await fechar(p, c) as {
    aceitavel: boolean;
    diagnosticos: unknown[];
}; expect(r.aceitavel).toBe(true); expect(r.diagnosticos).toHaveLength(1); });
it('novo Details depois da transicao reprova mesmo com200/DOMOportunidades aparentemente certo', async () => { const x = await modulo(), p = pagina(), c = x.instalarColetorOportunidades327(p, dono); await inicial(p, c); const d = pedido(p, 'detalhes'), o = pedido(p); d.iniciar(); d.terminar(); o.iniciar(); o.terminar(); const token = await c.aguardar(); expect(() => c.selar(token, prova('oportunidades'))).toThrow(); expect((await fechar(p, c) as {
    aceitavel: boolean;
}).aceitavel).toBe(false); });
it('35abortado/38integro nao libera enquanto48 esta em voo; erro48 nao e mascarado', async () => { const x = await modulo(), p = pagina(), c = x.instalarColetorOportunidades327(p, dono); await inicial(p, c); const a = pedido(p), b = pedido(p), d = pedido(p); a.iniciar(); a.falhar(); b.iniciar(); b.terminar(); d.iniciar(); let acabou = false; const espera = c.aguardar().then((t: unknown) => { acabou = true; return t; }); await turno(); expect(acabou).toBe(false); d.falhar(); const token = await espera; expect(() => c.selar(token, prova('oportunidades'))).toThrow(); expect((await fechar(p, c) as {
    aceitavel: boolean;
}).aceitavel).toBe(false); });
it('START surgido durante parse JSON integra drain dinamico', async () => { const x = await modulo(), p = pagina(), c = x.instalarColetorOportunidades327(p, dono); await inicial(p, c); let liberar!: (v: unknown) => void; const lento = new Promise(r => liberar = r); const a = pedido(p, 'oportunidades', () => lento), b = pedido(p); void lento.then(() => b.iniciar()); a.iniciar(); a.terminar(); let terminou = false; const espera = c.aguardar().then((t: unknown) => { terminou = true; return t; }); await turno(); liberar(op); await turno(); expect(terminou).toBe(false); b.terminar(); c.selar(await espera, prova('oportunidades')); expect((await fechar(p, c) as {
    aceitavel: boolean;
}).aceitavel).toBe(true); });
it('finished sembody/hash continua pendente e timeout permanece negativo', async () => { const x = await modulo(), p = pagina(), c = x.instalarColetorOportunidades327(p, dono, { timeoutMs: 20 }); await inicial(p, c); let liberar!: (v: unknown) => void; const lento = new Promise(r => liberar = r); const o = pedido(p, 'oportunidades', () => lento); o.iniciar(); o.terminar(); await expect(c.aguardar()).rejects.toThrow(/timeout/i); liberar(op); await turno(); expect((await fechar(p, c) as {
    aceitavel: boolean;
}).aceitavel).toBe(false); });
it('headers200 sem requestfinished nao concluem coleta', async () => { const x = await modulo(), p = pagina(), c = x.instalarColetorOportunidades327(p, dono, { timeoutMs: 20 }); await inicial(p, c); const o = pedido(p); o.iniciar(); o.headers(); await expect(c.aguardar()).rejects.toThrow(); o.falhar(); await fechar(p, c); });
it('aborto natural O recuperado so por posterior completo mesmohash e todas settled', async () => { const x = await modulo(), p = pagina(), c = x.instalarColetorOportunidades327(p, dono); await inicial(p, c); const a = pedido(p), b = pedido(p), d = pedido(p); a.iniciar(); a.falhar(); b.iniciar(); b.terminar(); d.iniciar(); d.terminar(); c.selar(await c.aguardar(), prova('oportunidades')); const r = await fechar(p, c) as {
    aceitavel: boolean;
    diagnosticos: unknown[];
    iniciados: number;
}; expect(r.aceitavel).toBe(true); expect(r.diagnosticos).toHaveLength(1); expect(r.iniciados).toBe(4); });
it('body48 divergente reprova apesar de substituto38 com hash esperado', async () => { const x = await modulo(), p = pagina(), c = x.instalarColetorOportunidades327(p, dono); await inicial(p, c); const a = pedido(p), b = pedido(p), d = pedido(p, 'oportunidades', async () => ({ atual: { id: 'outro' } })); a.iniciar(); a.falhar(); b.iniciar(); b.terminar(); d.iniciar(); d.terminar(); const token = await c.aguardar(); expect(() => c.selar(token, prova('oportunidades'))).toThrow(); expect((await fechar(p, c) as {
    aceitavel: boolean;
}).aceitavel).toBe(false); });
it.each([403, 404, 500])('HTTP%s em Op nao vira corpo valido com mesmoJSON', async (status) => { const x = await modulo(), p = pagina(), c = x.instalarColetorOportunidades327(p, dono); await inicial(p, c); const o = pedido(p, 'oportunidades', async () => op, { status }); o.iniciar(); o.terminar(); const token = await c.aguardar(); expect(() => c.selar(token, prova('oportunidades'))).toThrow(); expect((await fechar(p, c) as {
    aceitavel: boolean;
}).aceitavel).toBe(false); });
it('token anterior a novoSTART invalida selo mesmo depois de ambos finished', async () => { const x = await modulo(), p = pagina(), c = x.instalarColetorOportunidades327(p, dono); await inicial(p, c); const a = pedido(p); a.iniciar(); a.terminar(); const t = await c.aguardar(), b = pedido(p); b.iniciar(); b.terminar(); await c.aguardar(); expect(() => c.selar(t, prova('oportunidades'))).toThrow(); await fechar(p, c); });
it('novo START/failure em contextclose depois de selo invalida candidata aposbrowser', async () => { const x = await modulo(), p = pagina(), c = x.instalarColetorOportunidades327(p, dono); await inicial(p, c); const a = pedido(p); a.iniciar(); a.terminar(); c.selar(await c.aguardar(), prova('oportunidades')); const d = pedido(p); d.iniciar(); p.fechar(); d.falhar(); p.browserFechar(); const captura = { falhas: [] as string[], diagnosticos: [] as unknown[] }; await x.finalizarCapturasOportunidades327([{ coletor: c, captura }]); expect((captura as typeof captura & {
    aceiteCandidato: boolean;
}).aceiteCandidato).toBe(false); expect(captura.falhas.length).toBeGreaterThan(0); });
it('listeners sobrevivem auditoria parcial atebrowserclose e capturam failure tardio', async () => { const x = await modulo(), p = pagina(), c = x.instalarColetorOportunidades327(p, dono); await inicial(p, c); const a = pedido(p); a.iniciar(); a.terminar(); c.selar(await c.aguardar(), prova('oportunidades')); p.fechar(); expect((await c.auditarFechamento()).falhas).toHaveLength(0); expect(p.listenerCount('requestfailed')).toBeGreaterThan(0); a.falhar(); p.browserFechar(); expect((await c.encerrar()).aceitavel).toBe(false); });
it('browser ainda conectado nunca libera veredito nem remove listeners', async () => { const x = await modulo(), p = pagina(), c = x.instalarColetorOportunidades327(p, dono); await inicial(p, c); const a = pedido(p); a.iniciar(); a.terminar(); c.selar(await c.aguardar(), prova('oportunidades')); p.fechar(); await expect(c.encerrar()).rejects.toThrow(/browser/i); expect(p.listenerCount('request')).toBeGreaterThan(0); p.browserFechar(); expect((await c.encerrar()).aceitavel).toBe(true); });
it('SSE/query/POST/outroendpoint nao sao isentos pelo coletor327', async () => { const x = await modulo(), p = pagina(), c = x.instalarColetorOportunidades327(p, dono); for (const opts of [{ url: base + '/api/inbox/eventos' }, { url: raiz + 'oportunidades?x=1' }, { method: 'POST' }, { url: raiz + 'atividade' }]) {
    const q = pedido(p, 'oportunidades', async () => op, opts);
    q.iniciar();
    expect(c.acompanha(q.q)).toBe(false);
} expect(c.estado().iniciados).toBe(0); await fechar(p, c); });
it('Request sem START ou deoutraPagina invalida e nao usa headers/body como prova isolada', async () => { const x = await modulo(); for (const outro of [false, true]) {
    const p = pagina(), c = x.instalarColetorOportunidades327(p, dono);
    await inicial(p, c);
    const a = pedido(p, 'oportunidades', async () => op, { outraPagina: outro });
    if (outro)
        a.iniciar();
    a.terminar();
    const token = await c.aguardar();
    expect(() => c.selar(token, prova('oportunidades'))).toThrow();
    expect((await fechar(p, c) as {
        aceitavel: boolean;
    }).aceitavel).toBe(false);
} });
it('finalizador falha fechado se browser nao foi encerrado', async () => { const x = await modulo(), p = pagina(), c = x.instalarColetorOportunidades327(p, dono); await inicial(p, c); const a = pedido(p); a.iniciar(); a.terminar(); c.selar(await c.aguardar(), prova('oportunidades')); p.fechar(); const captura = { falhas: [] as string[], diagnosticos: [] as unknown[] }; await x.finalizarCapturasOportunidades327([{ coletor: c, captura }]); expect(captura.falhas).toContain('AUDITORIA_FINAL327_NAO_CONFIRMADA'); p.browserFechar(); await c.encerrar(); });
it.each(['detalhes', 'oportunidades'] as const)('HTTP403 observado em %s nao vira aborto natural recuperado por200posterior', async (tipo) => { const x = await modulo(), p = pagina(), c = x.instalarColetorOportunidades327(p, dono); if (tipo === 'oportunidades')
    await inicial(p, c); const a = pedido(p, tipo, async () => tipo === 'detalhes' ? detalhes : op, { status: 403 }), b = pedido(p, tipo); a.iniciar(); a.headers(); a.falhar(); b.iniciar(); b.terminar(); const token = await c.aguardar(); expect(() => tipo === 'detalhes' ? c.marcarTransicao(token, prova('detalhes-inicial')) : c.selar(token, prova('oportunidades'))).toThrow(); await fechar(p, c); });
it('token forjado nao autoriza transicao mesmo com mesmos campos', async () => { const x = await modulo(), p = pagina(), c = x.instalarColetorOportunidades327(p, dono), d = pedido(p, 'detalhes'); d.iniciar(); d.terminar(); const token = await c.aguardar(); expect(() => c.marcarTransicao({ ...token }, prova('detalhes-inicial'))).toThrow(); await fechar(p, c); });
it('body sem headers observados nao libera selo', async () => { const x = await modulo(), p = pagina(), c = x.instalarColetorOportunidades327(p, dono); await inicial(p, c); const o = pedido(p); o.iniciar(); p.emit('requestfinished', o.q); const token = await c.aguardar(); expect(() => c.selar(token, prova('oportunidades'))).toThrow(); await fechar(p, c); });
it('DOMfinal falso ou identidade final diferente nao sela', async () => { const x = await modulo(); for (const campo of ['semanticaFinal', 'oportunidadeId', 'usuarioId']) {
    const p = pagina(), c = x.instalarColetorOportunidades327(p, dono);
    await inicial(p, c);
    const o = pedido(p);
    o.iniciar();
    o.terminar();
    const token = await c.aguardar(), pv: Record<string, unknown> = prova('oportunidades');
    pv[campo] = campo === 'semanticaFinal' ? false : 'outro';
    expect(() => c.selar(token, pv)).toThrow();
    await fechar(p, c);
} });
