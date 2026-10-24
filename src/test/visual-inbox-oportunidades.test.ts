import { afterEach, expect, it, vi } from 'vitest';
import { runInNewContext } from 'node:vm';
import { criarDomMinimo, desligarObservadores, Elemento } from './dom-minimo';
const h = vi.hoisted(() => ({ hidratar: vi.fn(async () => { }) }));
vi.mock('../../scripts/visual/espera-app.mjs', () => ({ esperarHidratacaoApp: h.hidratar }));
import * as api from '../../scripts/visual/oportunidades-inbox.mjs';
const entrada = (ator: 'admin' | 'leitor' = 'admin') => ({ atendimentoId: 'inbox-327-proposta-atendimento', oportunidadeId: 'inbox-327-proposta', pessoaId: 'inbox-327-pessoa', ator, usuarioId: 'inbox-327-' + ator, email: ator + '327@genius.test' });
const config = (ator: 'admin' | 'leitor' = 'admin') => api.configurarOportunidades(entrada(ator));
function corpos(ator: 'admin' | 'leitor' = 'admin') {
    const admin = ator === 'admin';
    return {
        sessao: { user: { id: 'inbox-327-' + ator, email: ator + '327@genius.test', papeis: [admin ? 'ADMINISTRADOR' : 'PROFESSOR'] } },
        painel: { acoes: { contatoNome: 'Oportunidade ficticia327', leadId: 'inbox-327-proposta' as string | null }, setor: 'COMERCIAL', pessoaId: 'inbox-327-pessoa', oportunidade: { id: 'inbox-327-proposta' }, podeEnviar: false, cabecalho: { subtitulo: 'Pessoa física · Curso ficticio327', pessoaId: 'inbox-327-pessoa', capacidades: { veLead: true, verContato: admin, editarContato: admin, moverEtapa: admin } } },
        detalhes: { pessoa: { id: 'inbox-327-pessoa', nome: 'Mariana Teste327' }, oportunidade: { id: 'inbox-327-proposta', produto: 'Curso ficticio327', valor: '1234.56', moeda: 'BRL', etapa: 'PROPOSTA' }, b2b: null, campos: [] },
        oportunidades: { pessoaId: 'inbox-327-pessoa', outras: [], atual: { id: 'inbox-327-proposta', titulo: 'Oportunidade ficticia327', produto: 'Curso ficticio327', valor: '1234.56', moeda: 'BRL', etapa: 'PROPOSTA', temperatura: 'QUENTE', responsavel: { id: 'inbox-327-admin', nome: 'Admin ficticio327' }, dataExperimental: null, experimentalConfirmada: false, professorExperimental: null, motivoPerda: null } },
    };
}
function contexto(ator: 'admin' | 'leitor' = 'admin') { const dados = corpos(ator); const get = vi.fn(async (url: string) => ({ status: () => 200, json: async () => structuredClone(url.endsWith('/session') ? dados.sessao : url.endsWith('/oportunidades') ? dados.oportunidades : url.endsWith('/detalhes') ? dados.detalhes : dados.painel) })); return { dados, get, request: { get } }; }
afterEach(() => { desligarObservadores(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('configuracao exige IDs e ator explicitos, sem senha ou fallback da canonica', () => {
    const c = config();
    expect(c.atendimentoId).toBe(entrada().atendimentoId);
    expect(Object.isFrozen(c)).toBe(true);
    for (const dado of [undefined, {}, { ...entrada(), atendimentoId: 'inbox-demo-mariana-307' }, { ...entrada(), oportunidadeId: '' }, { ...entrada(), pessoaId: 'outra' }, { ...entrada(), usuarioId: 'inbox-327-leitor' }, { ...entrada(), email: 'admin@real.com' }, { ...entrada(), senha: 'privada' }])
        expect(() => api.configurarOportunidades(dado as never)).toThrow(/327|fixture|expl/i);
});
it.each(['admin', 'leitor'] as const)('preflight %s prova sessao e tres GETs reais, com descricao e contagem separada da UI', async (ator) => {
    const c = contexto(ator);
    const r = await api.confirmarOportunidades(c as never, 'http://localhost:3110', config(ator));
    expect(c.get.mock.calls.map(([u]) => u)).toEqual(['http://localhost:3110/api/auth/session', 'http://localhost:3110/api/inbox/atendimentos/inbox-327-proposta-atendimento/painel', 'http://localhost:3110/api/inbox/atendimentos/inbox-327-proposta-atendimento/painel/oportunidades', 'http://localhost:3110/api/inbox/atendimentos/inbox-327-proposta-atendimento/painel/detalhes']);
    expect(r).toMatchObject({ statusPainel: 200, statusOportunidades: 200, leiturasPreflight: 4, aquisicoesUI: null, descricao: { produto: 'Curso ficticio327', valorTexto: 'R$ 1.234,56', etapa: 'PROPOSTA', podeMover: ator === 'admin' } });
});
it.each([401, 403, 404, 500])('preflight falha fechado em HTTP%s sem converter erro em vazio', async (status) => {
    const c = contexto();
    c.get.mockResolvedValueOnce({ status: () => status, json: async () => ({}) } as never);
    await expect(api.confirmarOportunidades(c as never, 'http://localhost:3110', config())).rejects.toThrow(/HTTP/);
    expect(c.get).toHaveBeenCalledTimes(1);
});
it.each(['https://localhost:3110', 'http://localhost:3111', 'http://example.com:3110', 'http://localhost:3110/inbox', 'http://u:s@localhost:3110'])('base %s nao inicia preflight', async (base) => {
    const c = contexto();
    await expect(api.confirmarOportunidades(c as never, base, config())).rejects.toThrow(/base|local|3110/i);
    expect(c.get).not.toHaveBeenCalled();
});
it.each(['ator', 'papel', 'contexto', 'pessoa', 'identidade', 'envio', 'capacidade', 'valor', 'moeda', 'etapa', 'produto', 'responsavel', 'outras'])('preflight rejeita divergencia real de %s', async (caso) => {
    const c = contexto('leitor');
    switch (caso) {
        case 'ator':
            c.dados.sessao.user.id = 'outro';
            break;
        case 'papel':
            c.dados.sessao.user.papeis = ['ADMINISTRADOR'];
            break;
        case 'contexto':
            c.dados.painel.setor = 'SECRETARIA';
            break;
        case 'pessoa':
            c.dados.oportunidades.pessoaId = 'outra';
            break;
        case 'identidade':
            c.dados.oportunidades.atual.id = 'op-alheia';
            break;
        case 'envio':
            c.dados.painel.podeEnviar = true;
            break;
        case 'capacidade':
            c.dados.painel.cabecalho.capacidades.moverEtapa = true;
            break;
        case 'valor':
            c.dados.oportunidades.atual.valor = '0.00';
            break;
        case 'moeda':
            c.dados.oportunidades.atual.moeda = 'USD';
            break;
        case 'etapa':
            c.dados.oportunidades.atual.etapa = 'QUALIFICADO';
            break;
        case 'produto':
            c.dados.oportunidades.atual.produto = 'Outro';
            break;
        case 'responsavel':
            c.dados.oportunidades.atual.responsavel.id = 'outro';
            break;
        case 'outras': (c.dados.oportunidades.outras as unknown[]).push({ id: 'outra' });
    }
    await expect(api.confirmarOportunidades(c as never, 'http://localhost:3110', config('leitor'))).rejects.toThrow(/327|fixture|sessao|contexto|oportunidade|capacidade/i);
});
function dom(alvo: 'app' | 'prototipo' = 'app', ator: 'admin' | 'leitor' = 'admin') {
    const { documento: d } = criarDomMinimo();
    Object.assign(d, { querySelector: (s: string) => d.body.querySelector(s), querySelectorAll: (s: string) => d.body.querySelectorAll(s) });
    const estilos = new WeakMap<Elemento, Record<string, string>>();
    const areas = new WeakMap<Elemento, {
        left: number;
        top: number;
        right: number;
        bottom: number;
        width: number;
        height: number;
    }>();
    const rect = { left: 0, top: 0, right: 340, bottom: 700, width: 340, height: 700 };
    const e = (tag: string, attrs: Record<string, string> = {}, texto = '', pai: Elemento = d.body) => { const n = d.createElement(tag); for (const [k, v] of Object.entries(attrs))
        n.setAttribute(k, v); if (texto)
        n.textContent = texto; pai.appendChild(n); Object.assign(n, { getBoundingClientRect: () => areas.get(n) ?? rect, getAnimations: () => [] }); return n; };
    vi.stubGlobal('document', d);
    vi.stubGlobal('window', { innerWidth: 390, innerHeight: 844, getComputedStyle: (n: Elemento) => ({ visibility: 'visible', display: 'block', opacity: '1', borderRadius: '2px', columnGap: '3px', backgroundColor: n.getAttribute('data-cor') ?? 'green', borderBottomColor: 'green', borderBottomWidth: '2px', ...estilos.get(n) }) });
    Object.assign(d.documentElement, { scrollWidth: 390 });
    const root = e('div', { 'data-m': 'root' });
    const painel = e('aside', alvo === 'app' ? { id: 'painel-contato', 'aria-label': 'Painel do contato' } : { 'data-m': 'panel' }, '', root);
    const cabecalho = e(alvo === 'app' ? 'header' : 'div', alvo === 'app' ? { 'data-cabecalho-contato': '' } : {}, '', painel);
    const nome = e(alvo === 'app' ? 'h2' : 'div', {}, alvo === 'app' ? 'Oportunidade ficticia327' : 'Mariana Costa', cabecalho);
    const subtitulo = e('p', {}, alvo === 'app' ? 'Pessoa física · Curso ficticio327' : 'Inglês Intensivo B1', cabecalho);
    const tab = e('button', alvo === 'app' ? { role: 'tab', 'data-aba': 'oportunidades', 'aria-selected': 'true', id: 'tab-op', 'aria-controls': 'conteudo' } : {}, 'Oportunidades', painel);
    const detalhes = e('button', {}, 'Detalhes', painel);
    estilos.set(detalhes, { borderBottomColor: 'rgba(0, 0, 0, 0)' });
    const area = e(alvo === 'app' ? 'div' : 'section', alvo === 'app' ? { role: 'tabpanel', id: 'conteudo', 'aria-labelledby': 'tab-op' } : {}, '', painel);
    // PainelContato envolve TODOSchildren no tabpanel: bloco327 e slots legados sao irmaos internos.
    const composicao = alvo === 'app' ? e('div', { class: 'flex flex-col gap-5' }, '', area) : area;
    const bloco = alvo === 'app' ? e('div', { class: 'min-w-0 space-y-4' }, '', e('div', { class: '-mx-[18px] px-[18px]' }, '', composicao)) : area;
    const header = e('header', {}, '', bloco);
    e(alvo === 'app' ? 'h3' : 'div', {}, 'Oportunidade atual', header);
    e('span', {}, 'Funil Matrículas', header);
    const produto = e(alvo === 'app' ? 'p' : 'div', {}, alvo === 'app' ? 'Curso ficticio327' : 'Inglês Intensivo B1 · Semestral', header);
    const valor = e(alvo === 'app' ? 'p' : 'div', {}, alvo === 'app' ? 'R$ 1.234,56' : 'R$ 720', header);
    const grupo = e('div', alvo === 'app' ? { role: 'group', 'aria-label': 'Etapas da oportunidade' } : {}, '', bloco);
    const nomes = alvo === 'app' ? ['Novo', '1º Contato', 'Qualificado', 'Exp. Agendada', 'Exp. Realizada', 'Proposta', 'Aguardando Matrícula', 'Matriculado'] : ['Novo lead', 'Qualificação', 'Aula experimental', 'Proposta', 'Negociação', 'Matrícula'];
    const botoes = nomes.map((nome, i) => { const b = e(alvo === 'app' ? 'button' : 'div', alvo === 'app' ? { 'aria-label': 'Etapa ' + nome, ...(i === 5 ? { 'aria-current': 'step' } : {}) } : { title: nome, 'data-cor': i < 3 ? 'green' : 'gray' }, '', grupo); Object.assign(b, { disabled: ator === 'leitor' }); if (alvo === 'app') {
        const s = e('span', { 'aria-hidden': 'true', 'data-cor': i < 6 ? 'green' : 'gray' }, '', b);
        areas.set(s, { left: 0, top: 0, right: 30, bottom: 4, width: 30, height: 4 });
    }
    else
        areas.set(b, { left: 0, top: 0, right: 30, bottom: 4, width: 30, height: 4 }); return b; });
    if (alvo === 'app')
        e('label', { for: 'etapa327' }, 'Etapa da oportunidade', bloco);
    const select = e('select', alvo === 'app' ? { name: 'etapaOportunidade', id: 'etapa327' } : {}, '', bloco);
    Object.assign(select, { value: alvo === 'app' ? 'PROPOSTA' : 'Aula experimental', disabled: alvo === 'app' && ator === 'leitor' });
    const valores = alvo === 'app' ? ['NOVO', 'EM_ATENDIMENTO', 'QUALIFICADO', 'EXPERIMENTAL_AGENDADA', 'EXPERIMENTAL_REALIZADA', 'NO_SHOW', 'PROPOSTA', 'AGUARDANDO_MATRICULA', 'MATRICULADO', 'PERDIDO'] : nomes;
    const rotulos = alvo === 'app' ? [...nomes.slice(0, 5), 'No-show', ...nomes.slice(5), 'Perdido'] : nomes;
    valores.forEach((v, i) => Object.assign(e('option', { value: v }, rotulos[i], select), { value: v, disabled: alvo === 'app' && ['NOVO', 'EM_ATENDIMENTO', 'EXPERIMENTAL_REALIZADA', 'NO_SHOW'].includes(v) }));
    const dl = e('dl', {}, '', bloco);
    for (const [k, v] of [['Responsável', 'Admin ficticio327'], ['Temperatura', 'Quente'], ['Produto', 'Curso ficticio327']]) {
        const r = e('div', {}, '', dl);
        e('dt', {}, k, r);
        e('dd', {}, v, r);
    }
    if (alvo === 'app' && ator === 'admin')
        Object.assign(e('button', { 'aria-label': 'Editar contato' }, '', painel), { disabled: false });
    return { d, e, painel, area, bloco, composicao, tab, select, botoes, produto, valor, estilos, areas, grupo, nome, subtitulo, descricao: api.descricaoOportunidades(config(ator), alvo, alvo === 'app' ? { nome: corpos(ator).painel.acoes.contatoNome, subtitulo: corpos(ator).painel.cabecalho.subtitulo, leadIdLegado: corpos(ator).painel.acoes.leadId } : undefined) };
}
it.each(['admin', 'leitor'] as const)('callback APP %s aceita semantica real e roda sem closure no browser', ator => {
    const f = dom('app', ator);
    expect(api.semanticaOportunidadesProntas(f.descricao)).toBe(true);
    const isolado = runInNewContext('(' + api.semanticaOportunidadesProntas.toString() + ')', { document: globalThis.document, window: globalThis.window }) as typeof api.semanticaOportunidadesProntas;
    expect(isolado(f.descricao)).toBe(true);
});
it.each(['cabecalho', 'subtitulo', 'aba', 'etapa', 'segmentos', 'opcoes', 'label', 'produto', 'moeda', 'ocupado', 'alerta', 'inert', 'fora', 'overflow', 'animacao', 'cor', 'altura', 'raio', 'estado', 'permissao', 'modal'])('callback APP rejeita %s sem trocar DOM/dados para passar', caso => {
    const f = dom();
    switch (caso) {
        case 'cabecalho':
            f.nome.textContent = 'Mariana Teste327';
            break;
        case 'subtitulo':
            f.subtitulo.textContent = 'Subtitulo reconstruido';
            break;
        case 'aba':
            f.tab.setAttribute('aria-selected', 'false');
            break;
        case 'etapa':
            Object.assign(f.select, { value: 'QUALIFICADO' });
            break;
        case 'segmentos':
            f.botoes[0].parentElement!.removeChild(f.botoes[0]);
            break;
        case 'opcoes':
            f.select.removeChild(f.select.childNodes[0]);
            break;
        case 'label':
            f.select.setAttribute('id', 'outro');
            break;
        case 'produto':
            f.produto.textContent = 'Outro';
            break;
        case 'moeda':
            f.valor.textContent = '1234.56 BRL';
            break;
        case 'ocupado':
            f.area.setAttribute('aria-busy', 'true');
            break;
        case 'alerta':
            f.e('p', { role: 'alert' }, 'Falhou', f.area);
            break;
        case 'inert':
            f.painel.setAttribute('inert', '');
            break;
        case 'fora':
            f.areas.set(f.select, { left: 0, top: 900, right: 340, bottom: 944, width: 340, height: 44 });
            break;
        case 'overflow':
            Object.assign(f.d.documentElement, { scrollWidth: 500 });
            break;
        case 'animacao':
            Object.assign(f.painel, { getAnimations: () => [{ playState: 'running' }] });
            break;
        case 'cor':
            (f.botoes[0].childNodes[0] as Elemento).setAttribute('data-cor', 'gray');
            break;
        case 'altura':
            f.areas.set(f.botoes[0].childNodes[0] as Elemento, { left: 0, top: 0, right: 30, bottom: 8, width: 30, height: 8 });
            break;
        case 'raio':
            f.estilos.set(f.botoes[0].childNodes[0] as Elemento, { borderRadius: '0px' });
            break;
        case 'estado':
            f.botoes[0].setAttribute('aria-current', 'step');
            break;
        case 'permissao':
            Object.assign(f.select, { disabled: true });
            break;
        case 'modal': f.e('div', { 'aria-modal': 'true' });
    }
    expect(api.semanticaOportunidadesProntas(f.descricao)).toBe(false);
});
it('leitor exige controles disabled e ausencia de edicao/link global', () => { const f = dom('app', 'leitor'); Object.assign(f.botoes[0], { disabled: false }); expect(api.semanticaOportunidadesProntas(f.descricao)).toBe(false); Object.assign(f.botoes[0], { disabled: true }); f.e('a', { href: '/funil?o=x' }, 'Abrir no funil', f.bloco); expect(api.semanticaOportunidadesProntas(f.descricao)).toBe(false); });
it('callback prototipo conserva seis etapas/720/original, sem fabricar equivalencia APP', () => { const f = dom('prototipo'); expect(api.semanticaOportunidadesProntas(f.descricao)).toBe(true); Object.assign(f.select, { value: 'Proposta' }); expect(api.semanticaOportunidadesProntas(f.descricao)).toBe(false); expect(() => api.descricaoOportunidades(config('leitor'), 'prototipo')).toThrow(/D13|leitor|APP/); });
function paginaFalsa() { const ordem: string[] = []; const no = (nome: string): unknown => { const n = { isVisible: async () => false, getAttribute: async () => null, waitFor: async () => { ordem.push('esperar:' + nome); }, click: async () => { ordem.push('click:' + nome); }, first: () => n, getByRole: (_r: string, o: {
        name: string;
    }) => no(o.name), getByText: (nome: string) => no(nome), getByTitle: (nome: string) => no(nome), locator: (s: string) => no(s) }; return n; }; return { ordem, url: () => 'http://localhost:3110/inbox?c=inbox-327-proposta-atendimento', isClosed: () => false, evaluate: vi.fn(async () => true), goto: vi.fn(async (u: string) => { ordem.push('goto:' + u); }), locator: (s: string) => no(s), getByRole: (_r: string, o: {
        name: string;
    }) => no(o.name), waitForFunction: vi.fn(async () => { ordem.push('semantica'); }) }; }
it('abrirAPP faz preflight antesgoto e somente painel/aba, sem exigir mensagens inexistentes', async () => {
    const p = paginaFalsa(), c = contexto();
    const get = c.get.getMockImplementation()!;
    c.get.mockImplementation(async (u) => { p.ordem.push('GET:' + u); return get(u); });
    await api.abrirOportunidadesApp(p as never, c as never, 'http://localhost:3110', config(), instrumentacao(p.ordem) as never);
    expect(p.ordem.filter(x => x.startsWith('GET:'))).toHaveLength(4);
    expect(p.ordem[4]).toBe('goto:http://localhost:3110/inbox?c=inbox-327-proposta-atendimento');
    expect(p.ordem.filter(x => x.startsWith('click:'))).toEqual(['click:Painel do contato', 'click:Oportunidades']);
    expect(h.hidratar).toHaveBeenCalledOnce();
    expect(p.waitForFunction).toHaveBeenCalledWith(api.semanticaOportunidadesProntas, api.descricaoOportunidades(config(), 'app', { nome: corpos().painel.acoes.contatoNome, subtitulo: corpos().painel.cabecalho.subtitulo, leadIdLegado: corpos().painel.acoes.leadId }));
});
it('abrirprototipo so navega originalc1 e aba, leitor nao ganha referencia artificial', async () => {
    const p = paginaFalsa();
    await api.abrirOportunidadesPrototipo(p as never, config());
    expect(p.goto.mock.calls[0][0]).toMatch(/Inbox\.dc\.html\?c=c1$/);
    expect(p.ordem.filter(x => x.startsWith('click:'))).toEqual(['click:Mariana Costa', 'click:Painel do contato', 'click:Oportunidades']);
    const leitor = paginaFalsa();
    await expect(api.abrirOportunidadesPrototipo(leitor as never, config('leitor'))).rejects.toThrow(/D13|leitor|APP/);
    expect(leitor.goto).not.toHaveBeenCalled();
});
it('callback rejeita gap CSS ausente/normal, sem aceitar NaN como trespx', () => { const f = dom(); f.estilos.set(f.grupo, { columnGap: 'normal' }); expect(api.semanticaOportunidadesProntas(f.descricao)).toBe(false); });
it.each(['aba', 'valor', 'barra', 'cor'])('callback prototipo rejeita %s original divergente', caso => { const f = dom('prototipo'); switch (caso) {
    case 'aba':
        f.estilos.set(f.tab, { borderBottomColor: 'rgba(0, 0, 0, 0)' });
        break;
    case 'valor':
        f.valor.textContent = '1234.56';
        break;
    case 'barra':
        f.botoes[0].parentElement!.removeChild(f.botoes[0]);
        break;
    case 'cor': f.botoes[0].setAttribute('data-cor', 'gray');
} expect(api.semanticaOportunidadesProntas(f.descricao)).toBe(false); });
it('descricao APP usa nome/subtitulo retornados pelo Painel, sem reconstruir precedencia', () => { expect(api.descricaoOportunidades(config(), 'app', { nome: 'Nome do produtor327', subtitulo: 'Subtitulo do produtor327' })).toMatchObject({ nomeCabecalho: 'Nome do produtor327', subtitulo: 'Subtitulo do produtor327' }); });
function instrumentacao(ordem: string[]) { return { identidade: { base: 'http://localhost:3110', contextoId: 'ctx', paginaId: 'pag', ...entrada(), usuarioId: 'inbox-327-admin' }, coletor: { aguardar: async () => { ordem.push('drain'); return {}; }, marcarTransicao: (_t: unknown, p: {
            semanticaFinal: boolean;
        }) => { if (!p.semanticaFinal)
            throw Error('DOM inicial invalido'); ordem.push('transicao'); } } }; }
it('abrirAPP exige coletor e prova inicial completa antesclicarO, sem silenciar cancelamento', async () => {
    const p = paginaFalsa(), c = contexto();
    await expect(api.abrirOportunidadesApp(p as never, c as never, 'http://localhost:3110', config(), undefined as never)).rejects.toThrow(/coletor|instrumentacao/i);
    expect(c.get).not.toHaveBeenCalled();
    const r = await api.abrirOportunidadesApp(p as never, c as never, 'http://localhost:3110', config(), instrumentacao(p.ordem) as never);
    expect(p.ordem.indexOf('transicao')).toBeGreaterThan(p.ordem.indexOf('drain'));
    expect(p.ordem.indexOf('click:Oportunidades')).toBeGreaterThan(p.ordem.indexOf('transicao'));
    expect(r.metadados.oportunidadesPreflight).toMatchObject({ leiturasPreflight: 4, corpoDetalhesSha256: expect.stringMatching(/^[a-f0-9]{64}$/), corpoOportunidadesSha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
});
it('DOM inicial divergente impede transicao e cliqueO mesmo apos drain', async () => { const p = paginaFalsa(); p.evaluate.mockResolvedValue(false); await expect(api.abrirOportunidadesApp(p as never, contexto() as never, 'http://localhost:3110', config(), instrumentacao(p.ordem) as never)).rejects.toThrow(/DOM/); expect(p.ordem).not.toContain('click:Oportunidades'); });
it.each(['pessoa', 'oportunidade', 'campos'])('preflight inicial rejeita DTOdetalhes divergente %s', async (caso) => { const c = contexto(); if (caso === 'pessoa')
    c.dados.detalhes.pessoa.id = 'outro'; if (caso === 'oportunidade')
    c.dados.detalhes.oportunidade.id = 'outro'; if (caso === 'campos')
    c.dados.detalhes.campos = null as never; await expect(api.confirmarOportunidades(c as never, 'http://localhost:3110', config())).rejects.toThrow(/detalhes/i); });
function inicial() { const f = dom(); for (const n of [...f.area.childNodes])
    f.area.removeChild(n); f.tab.setAttribute('data-aba', 'detalhes'); f.tab.textContent = 'Detalhes'; const t = f.e('button', { role: 'tab', 'data-aba': 'oportunidades', 'aria-selected': 'false' }, 'Oportunidades', f.painel); const cartao = f.e('button', { 'aria-label': 'Abrir oportunidade atual' }, 'Oportunidade atual Curso ficticio327 · R$ 1.234,56 · Proposta', f.area); Object.assign(cartao, { disabled: false }); return { ...f, t, cartao }; }
it('callback Detalhesinicial usa produtor e duasabas, executavel semclosure', () => { const f = inicial(); expect(api.semanticaDetalhesInicial327(f.descricao)).toBe(true); const isolado = runInNewContext('(' + api.semanticaDetalhesInicial327.toString() + ')', { document: globalThis.document, window: globalThis.window }); expect(isolado(f.descricao)).toBe(true); });
it.each(['loading', 'aba', 'identidade', 'cartao', 'alerta', 'modal', 'inert'])('callback inicial recusa %s antes da transicao', caso => { const f = inicial(); switch (caso) {
    case 'loading':
        f.area.setAttribute('aria-busy', 'true');
        break;
    case 'aba':
        f.t.setAttribute('aria-selected', 'true');
        break;
    case 'identidade':
        f.nome.textContent = 'Mariana Teste327';
        break;
    case 'cartao':
        f.cartao.textContent = 'Oportunidade atual Curso errado';
        break;
    case 'alerta':
        f.e('p', { role: 'alert' }, 'Erro', f.area);
        break;
    case 'modal':
        f.e('div', { 'aria-modal': 'true' });
        break;
    case 'inert': f.painel.setAttribute('inert', '');
} expect(api.semanticaDetalhesInicial327(f.descricao)).toBe(false); });

// Causais A6: callbacks reais serializados, sem browser/HTTP/alteracao de DOM de produto.
function geometria327(tipo: 'detalhes' | 'oportunidades') {
    const f = tipo === 'detalhes' ? inicial() : dom();
    const ret = (top: number, bottom: number, left = 10, right = 330) => ({ left, right, top, bottom, width: right - left, height: bottom - top });
    const visitar = (n: Elemento) => { f.areas.set(n, ret(380, 430)); for (const c of n.childNodes) if (c instanceof Elemento) visitar(c); };
    visitar(f.painel);
    for (let n: Elemento | null = f.painel; n; n = n.parentElement) f.areas.set(n, ret(0, 844, 0, 390));
    const cab = f.painel.querySelector('[data-cabecalho-contato]')!;
    f.areas.set(cab, ret(0, 308)); f.areas.set(f.nome, ret(20, 50)); f.areas.set(f.subtitulo, ret(60, 90));
    for (const t of f.painel.querySelectorAll('button')) if (t.parentElement === f.painel) f.areas.set(t, ret(314, 358));
    f.areas.set(f.area, ret(369, 700));
    f.estilos.set(f.painel, { overflowY: 'auto', overflowX: 'hidden' });
    for (const b of f.botoes) if (b.childNodes[0]) f.areas.set(b.childNodes[0] as Elemento, ret(390, 394));
    const callback = tipo === 'detalhes' ? api.semanticaDetalhesInicial327 : api.semanticaOportunidadesProntas;
    const executar = () => runInNewContext('(' + callback.toString() + ')', { document: globalThis.document, window: globalThis.window })(f.descricao) as boolean;
    return { ...f, ret, executar, cab };
}
it.each(['detalhes', 'oportunidades'] as const)('A6 %s: area naturalmente longa intersecta scrollport sem cortar controles', tipo => {
    const f = geometria327(tipo); expect(f.executar()).toBe(true);
    f.areas.set(f.area, f.ret(369, 997)); expect(f.executar()).toBe(true);
});
it.each(['detalhes', 'oportunidades'] as const)('A6 %s: regiao permanente status sr-only vazia/whitespace nao significa loading', tipo => {
    const f = geometria327(tipo); expect(f.executar()).toBe(true);
    f.e('p', { role: 'status', class: 'sr-only' }, '  \n ', f.area); expect(f.executar()).toBe(true);
});
it.each(['detalhes', 'oportunidades'] as const)('A6 %s: area longa com status idle reproduz duas clausulas medidas', tipo => {
    const f = geometria327(tipo); f.areas.set(f.area, f.ret(369, 997));
    f.e('p', { role: 'status', class: 'sr-only' }, '', f.area); expect(f.executar()).toBe(true);
});
for (const tipo of ['detalhes', 'oportunidades'] as const) {
    it.each(['fora', 'zero', 'hidden', 'inert', 'aria-hidden', 'display', 'visibility', 'cabecalho-cortado', 'aba-cortada', 'aba-desabilitada', 'controle-desabilitado', 'controle-cortado', 'recorte-ancestral', 'busy', 'status-texto', 'sr-only-texto', 'opacity-zero-texto', 'alerta-texto', 'status-label', 'status-labelledby'])(`A6 ${tipo}: recusa %s`, caso => {
        const f = geometria327(tipo); expect(f.executar()).toBe(true);
        const controle = tipo === 'detalhes' ? f.area.querySelector('button')! : f.select;
        switch (caso) {
            case 'fora': f.areas.set(f.area, f.ret(850, 997)); break;
            case 'zero': f.areas.set(f.area, f.ret(369, 369)); break;
            case 'hidden': f.area.setAttribute('hidden', ''); break;
            case 'inert': f.area.setAttribute('inert', ''); break;
            case 'aria-hidden': f.area.setAttribute('aria-hidden', 'true'); break;
            case 'display': f.estilos.set(f.area, { display: 'none' }); break;
            case 'visibility': f.estilos.set(f.area, { visibility: 'hidden' }); break;
            case 'cabecalho-cortado': f.areas.set(f.cab, f.ret(-20, 308)); break;
            case 'aba-cortada': f.areas.set(f.tab, f.ret(830, 880)); break;
            case 'aba-desabilitada': Object.assign(f.tab, { disabled: true }); break;
            case 'controle-desabilitado': Object.assign(controle, { disabled: true }); break;
            case 'controle-cortado': f.areas.set(controle, f.ret(830, 880)); break;
            case 'recorte-ancestral': {
                const clip = f.e('div', {}, '', f.area); f.estilos.set(clip, { overflowY: 'hidden' });
                f.areas.set(clip, f.ret(400, 420)); clip.appendChild(controle); break;
            }
            case 'busy': f.e('div', { 'aria-busy': 'true' }, '', f.area); break;
            case 'status-texto': f.e('p', { role: 'status' }, 'Carregando', f.area); break;
            case 'sr-only-texto': f.e('p', { role: 'status', class: 'sr-only' }, 'Carregando', f.area); break;
            case 'opacity-zero-texto': { const n = f.e('p', { role: 'status' }, 'Carregando', f.area); f.estilos.set(n, { opacity: '0' }); break; }
            case 'alerta-texto': f.e('p', { role: 'alert' }, 'Falhou', f.area); break;
            case 'status-label': f.e('p', { role: 'status', 'aria-label': 'Carregando' }, '', f.area); break;
            case 'status-labelledby': f.e('span', { id: 'rotulo-vivo' }, 'Carregando', f.painel); f.e('p', { role: 'status', 'aria-labelledby': 'rotulo-vivo' }, '', f.area); break;
        }
        expect(f.executar()).toBe(false);
    });
    it.each(['vazio', 'aria-hidden', 'inert', 'hidden', 'display', 'visibility'])(`A6 ${tipo}: ignora status %s sem ignorar estado acessivel`, caso => {
        const f = geometria327(tipo); const pai = f.e('div', {}, '', f.area);
        f.e('p', { role: 'status' }, caso === 'vazio' ? ' \n ' : 'Carregando', pai);
        if (['aria-hidden', 'inert', 'hidden'].includes(caso)) pai.setAttribute(caso, caso === 'aria-hidden' ? 'true' : '');
        if (caso === 'display') f.estilos.set(pai, { display: 'none' });
        if (caso === 'visibility') f.estilos.set(pai, { visibility: 'hidden' });
        expect(f.executar()).toBe(true);
    });
}

// PROTO real medido no DIAG: SECTION358..920.234375, scrollport342..900 e folha R$720.
function geometriaProtoMedida327() {
    const f = dom('prototipo');
    Object.assign(window, { innerWidth: 1440, innerHeight: 900 }); Object.assign(f.d.documentElement, { scrollWidth: 1440 });
    const ret = (top: number, bottom: number, left = 1111, right = 1422) => ({ left, right, top, bottom, width: right - left, height: bottom - top });
    const visitar = (n: Elemento) => { f.areas.set(n, ret(358, 396.5)); for (const c of n.childNodes) if (c instanceof Elemento) visitar(c); }; visitar(f.area);
    f.areas.set(f.painel, ret(0, 900, 1092, 1440)); f.areas.set(f.nome.parentElement!, ret(0, 297, 1093, 1440)); f.areas.set(f.nome, ret(188, 213)); f.areas.set(f.subtitulo, ret(215, 231)); f.areas.set(f.tab, ret(303, 341));
    const scroll = f.e('div', {}, '', f.painel); scroll.appendChild(f.area); f.areas.set(scroll, ret(342, 900, 1093, 1440)); f.estilos.set(scroll, { overflowY: 'auto', overflowX: 'auto' }); Object.assign(scroll, { clientWidth: 347, clientHeight: 558, scrollHeight: 818 });
    f.areas.set(f.area, ret(358, 920.234375)); f.areas.set(f.produto, ret(377, 396.5)); f.areas.set(f.valor, ret(408.5, 430.5)); f.areas.set(f.select, ret(452.5, 486.5)); f.botoes.forEach((b, i) => f.areas.set(b, ret(442.5, 446.5, 1111 + i * 50, 1160 + i * 50)));
    const titulo = f.area.querySelector('header')!.querySelector('div')!, funil = f.area.querySelector('span')!;
    const executar = (d = f.descricao) => runInNewContext('(' + api.semanticaOportunidadesProntas.toString() + ')', { document: globalThis.document, window: globalThis.window })(d) as boolean;
    return { ...f, ret, scroll, titulo, funil, executar };
}
it('PROTO esperado conserva moeda literal do original R$720, sem ajustar DOM para720', () => { const f = geometriaProtoMedida327(); f.areas.set(f.area, f.ret(358, 850)); expect(f.descricao.valorTexto).toBe('R$ 720'); expect(f.executar()).toBe(true); });
it('PROTO aceita SECTION natural medida e controles visiveis no scrollport, com moeda correta independente', () => { const f = geometriaProtoMedida327(); expect(f.executar({ ...f.descricao, valorTexto: 'R$ 720' })).toBe(true); });
it('PROTO geometria e valor medidos passam juntos na funcao real serializada', () => { const f = geometriaProtoMedida327(); expect(f.executar()).toBe(true); });
it.each(['area-fora', 'area-zero', 'valor-sem-moeda', 'valor-errado', 'produto-oculto', 'valor-cortado', 'select-cortado', 'nome-cortado', 'titulo-cortado', 'funil-oculto', 'clipping-ancestral', 'busy', 'status', 'alert'])('PROTO conserva guarda %s', caso => {
    const f = geometriaProtoMedida327(), d = { ...f.descricao, valorTexto: 'R$ 720' }; f.areas.set(f.area, f.ret(358, 850)); expect(f.executar(d)).toBe(true);
    switch (caso) {
        case 'area-fora': f.areas.set(f.area, f.ret(950, 1070)); break;
        case 'area-zero': f.areas.set(f.area, f.ret(358, 358)); break;
        case 'valor-sem-moeda': f.valor.textContent = '720'; break;
        case 'valor-errado': f.valor.textContent = 'R$ 721'; break;
        case 'produto-oculto': f.estilos.set(f.produto, { display: 'none' }); break;
        case 'valor-cortado': f.areas.set(f.valor, f.ret(880, 910)); break;
        case 'select-cortado': f.areas.set(f.select, f.ret(880, 920)); break;
        case 'nome-cortado': f.areas.set(f.nome, f.ret(-10, 30)); break;
        case 'titulo-cortado': f.areas.set(f.titulo, f.ret(330, 360)); break;
        case 'funil-oculto': f.estilos.set(f.funil, { visibility: 'hidden' }); break;
        case 'clipping-ancestral': { const clip = f.e('div', {}, '', f.area); f.estilos.set(clip, { overflowY: 'hidden' }); f.areas.set(clip, f.ret(455, 470)); clip.appendChild(f.select); break; }
        case 'busy': f.e('div', { 'aria-busy': 'true' }, '', f.area); break;
        case 'status': f.e('p', { role: 'status' }, 'Carregando', f.area); break;
        case 'alert': f.e('p', { role: 'alert' }, 'Falhou', f.area); break;
    }
    expect(f.executar(d)).toBe(false);
});

// HTMLnativo7cb6: tabpanel contem bloco327 e Cadastro legado; so o bloco327 delimita linksnovos.
const hrefAtual327 = '/funil?o=inbox-327-proposta';
function links327(ator: 'admin' | 'leitor' = 'leitor', abrir = ator === 'admin') {
    const f = dom('app', ator), descricao = { ...f.descricao, podeAbrirFunil: abrir, hrefFunilAtual: hrefAtual327, hrefFunilLegado: hrefAtual327 as string | null };
    const legado = (pai = f.composicao, href = hrefAtual327, rotulo = 'Cadastro do contato', texto = 'Abrir oportunidade') => { const slot = f.e('section', { 'aria-label': rotulo }, '', f.e('div', { class: '-mx-[18px] px-[18px]' }, '', pai)); return f.e('a', { href }, texto, f.e('p', { class: 'flex flex-wrap gap-x-3 gap-y-1' }, '', slot)); };
    const executar = () => (runInNewContext('(' + api.semanticaOportunidadesProntas.toString() + ')', { document: globalThis.document, window: globalThis.window }) as typeof api.semanticaOportunidadesProntas)(descricao);
    return { ...f, descricao, legado, executar };
}
it.each(['admin', 'leitor'] as const)('preflight %s registra abrir e mover separados e href legado do DTO sem novoGET', async ator => { const c = contexto(ator), r = await api.confirmarOportunidades(c as never, 'http://localhost:3110', config(ator)); expect(r.descricao).toMatchObject({ podeMover: ator === 'admin', podeAbrirFunil: ator === 'admin', hrefFunilAtual: hrefAtual327, hrefFunilLegado: hrefAtual327 }); expect(c.get).toHaveBeenCalledTimes(4); });
it('preflight nao autoriza href legado se o DTO nao projeta lead', async () => { const c = contexto('leitor'); c.dados.painel.acoes.leadId = null; const r = await api.confirmarOportunidades(c as never, 'http://localhost:3110', config('leitor')); expect(r.descricao.hrefFunilLegado).toBeNull(); expect(c.get).toHaveBeenCalledTimes(4); });
it('preflight recusa lead legado divergente do alvo previamente autorizado', async () => { const c = contexto('leitor'); c.dados.painel.acoes.leadId = 'outra'; await expect(api.confirmarOportunidades(c as never, 'http://localhost:3110', config('leitor'))).rejects.toThrow(/legado|vinculo|identidade/i); });
it('arvore nativa: leitor com footer legado dentro do tabpanel e fora do bloco327 passa', () => { const f = links327(); const link = f.legado(); expect(f.area.contains(link)).toBe(true); expect(f.bloco.contains(link)).toBe(false); expect(f.area.querySelector('header')!.parentElement).toBe(f.bloco); expect(f.descricao.podeMover).toBe(false); expect(f.descricao.podeAbrirFunil).toBe(false); expect(f.executar()).toBe(true); });
it('moverfalse e abrirtrue permite link novo exato na area, preservando controles readonly', () => { const f = links327('leitor', true); f.e('a', { href: hrefAtual327 }, 'Abrir no funil', f.bloco); expect(Reflect.get(f.select, 'disabled')).toBe(true); expect(f.botoes.every(b => Reflect.get(b, 'disabled') === true)).toBe(true); expect(f.executar()).toBe(true); });
it('movertrue nao concede abrirfalse para link novo da area', () => { const f = links327('admin', false); f.e('a', { href: hrefAtual327 }, 'Abrir no funil', f.bloco); expect(f.executar()).toBe(false); });
it.each(['admin', 'leitor'] as const)('abrirtrue nao exige link quando fluxo inicial ausente: %s', ator => { const f = links327(ator, true); expect(f.executar()).toBe(true); });
it.each(['slot-errado', 'ID-errado', 'query-extra', 'texto-errado', 'duplicado', 'sem-preflight', 'fora-slot', 'ID-interno-errado'])('mesmo abrirtrue recusa link indevido %s', caso => {
    const f = links327('admin', true);
    switch (caso) {
        case 'slot-errado': f.legado(f.painel, hrefAtual327, 'Outro slot'); break;
        case 'ID-errado': f.legado(f.painel, '/funil?o=outra'); break;
        case 'query-extra': f.legado(f.painel, hrefAtual327 + '&x=1'); break;
        case 'texto-errado': f.legado(f.painel, hrefAtual327, 'Cadastro do contato', 'Outro rotulo'); break;
        case 'duplicado': f.legado(); f.legado(); break;
        case 'sem-preflight': f.descricao.hrefFunilLegado = null; f.legado(); break;
        case 'fora-slot': f.e('a', { href: hrefAtual327 }, 'Abrir oportunidade', f.painel); break;
        case 'ID-interno-errado': f.e('a', { href: '/funil?o=outra' }, 'Abrir no funil', f.bloco); break;
    }
    expect(f.executar()).toBe(false);
});
it('slot legado dentro do bloco327 nao contorna abrirfalse', () => { const f = links327(); f.legado(f.bloco); expect(f.executar()).toBe(false); });
it.each(['select', 'segmento', 'lapis'])('abrirtrue e footer valido nao concedem escrita %s', caso => { const f = links327('leitor', true); f.legado(); if (caso === 'select') Object.assign(f.select, { disabled: false }); if (caso === 'segmento') Object.assign(f.botoes[0], { disabled: false }); if (caso === 'lapis') f.e('button', { 'aria-label': 'Editar contato' }, '', f.painel); expect(f.executar()).toBe(false); });

it.each(['admin', 'leitor'] as const)('legado verdadeiramente fora do tabpanel preserva compatibilidade segura: %s', ator => { const f = links327(ator), link = f.legado(f.painel); expect(f.area.contains(link)).toBe(false); expect(f.bloco.contains(link)).toBe(false); expect(f.painel.contains(link)).toBe(true); expect(f.executar()).toBe(true); });
it('mesmo abrirtrue proibe slotCadastro descendente do bloco327', () => { const f = links327('admin', true); const link = f.legado(f.bloco); expect(f.bloco.contains(link)).toBe(true); expect(f.executar()).toBe(false); });
it.each(['header-direto-area', 'select-fora-bloco', 'grupo-fora-bloco', 'label-fora-bloco', 'campo-fora-bloco', 'header-em-wrapper'])('fronteira327 deve possuir controles/campos reais: %s', caso => {
 const f = links327(); const header = f.area.querySelector('header')!;
 switch(caso){case 'header-direto-area': f.area.appendChild(header); break; case 'select-fora-bloco': f.composicao.appendChild(f.select); break; case 'grupo-fora-bloco': f.composicao.appendChild(f.grupo); break; case 'label-fora-bloco': f.composicao.appendChild(f.area.querySelector('label')!); break; case 'campo-fora-bloco': f.composicao.appendChild(f.area.querySelector('dt')!.parentElement!); break; case 'header-em-wrapper': f.e('div', {}, '', f.bloco).appendChild(header); break;}
 expect(f.executar()).toBe(false);
});
