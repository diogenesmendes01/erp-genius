import { hashCorpoPainel327 } from './coletor-oportunidades.mjs';
import { ESTADOS as ESTADOS_BASE, TEMAS, combinacoes as combinacoesBase } from './nucleo-captura.mjs';
import { esperarHidratacaoApp } from './espera-app.mjs';
const IDS = Object.freeze({ atendimentoId: 'inbox-327-proposta-atendimento', oportunidadeId: 'inbox-327-proposta', pessoaId: 'inbox-327-pessoa' });
const CAMPOS_CONFIG = ['atendimentoId', 'oportunidadeId', 'pessoaId', 'ator', 'usuarioId', 'email'];
const ETAPAS = [['NOVO', 'Novo'], ['EM_ATENDIMENTO', '1º Contato'], ['QUALIFICADO', 'Qualificado'], ['EXPERIMENTAL_AGENDADA', 'Exp. Agendada'], ['EXPERIMENTAL_REALIZADA', 'Exp. Realizada'], ['NO_SHOW', 'No-show'], ['PROPOSTA', 'Proposta'], ['AGUARDANDO_MATRICULA', 'Aguardando Matrícula'], ['MATRICULADO', 'Matriculado'], ['PERDIDO', 'Perdido']];
const PROTO = ['Novo lead', 'Qualificação', 'Aula experimental', 'Proposta', 'Negociação', 'Matrícula'];
const exigir = (ok, mensagem) => { if (!ok)
    throw new Error('Oportunidades327: ' + mensagem); };
/** Fixture/ator explicitos; sem credencial, seed, ambiente implicito ou fallback canonico. */
export function configurarOportunidades(entrada) {
    exigir(entrada && Object.keys(entrada).length === CAMPOS_CONFIG.length && Object.keys(entrada).every(k => CAMPOS_CONFIG.includes(k)), 'configuracao explicita da fixture exigida.');
    exigir(Object.entries(IDS).every(([k, v]) => entrada[k] === v) && ['admin', 'leitor'].includes(entrada.ator), 'identidade da fixture divergente.');
    exigir(entrada.usuarioId === 'inbox-327-' + entrada.ator && entrada.email === entrada.ator + '327@genius.test', 'ator explicito da fixture divergente.');
    return Object.freeze({ ...entrada });
}
/** Descricao esperada, jamais aplicada ao DOM ou a resposta HTTP. Proto conserva dados originais. */
export function descricaoOportunidades(config, alvo = 'app', cabecalho) {
    configurarOportunidades(config);
    exigir(['app', 'prototipo'].includes(alvo), 'alvo desconhecido.');
    exigir(alvo !== 'prototipo' || config.ator === 'admin', 'leitor D13 e APP-only; prototipo nao representa permissoes.');
    const app = alvo === 'app';
    exigir(!app || (typeof cabecalho?.nome === 'string' && cabecalho.nome.trim() && typeof cabecalho?.subtitulo === 'string' && cabecalho.subtitulo.trim()), 'nome/subtitulo do produtor Painel exigidos.');
    const leadIdLegado = app ? cabecalho?.leadIdLegado ?? null : null;
    exigir(!app || leadIdLegado === null || leadIdLegado === config.oportunidadeId, 'vinculo legado divergente do alvo autorizado.');
    return { alvo, ator: config.ator, nomeCabecalho: app ? cabecalho.nome : 'Mariana Costa', subtitulo: app ? cabecalho.subtitulo : null, produto: app ? 'Curso ficticio327' : 'Inglês Intensivo B1 · Semestral', valorTexto: app ? 'R$ 1.234,56' : 'R$ 720', etapa: app ? 'PROPOSTA' : 'Aula experimental', podeMover: app ? config.ator === 'admin' : true,
        ...(app ? { podeAbrirFunil: config.ator === 'admin', hrefFunilAtual: '/funil?o=' + encodeURIComponent(config.oportunidadeId), hrefFunilLegado: leadIdLegado ? '/funil?o=' + encodeURIComponent(leadIdLegado) : null } : {}),
        segmentos: app ? ETAPAS.filter(([v]) => !['NO_SHOW', 'PERDIDO'].includes(v)).map(([, r]) => r) : [...PROTO],
        opcoes: app ? ETAPAS.map(([valor, rotulo]) => ({ valor, rotulo, recusada: ['NOVO', 'EM_ATENDIMENTO', 'EXPERIMENTAL_REALIZADA', 'NO_SHOW'].includes(valor) })) : PROTO.map(r => ({ valor: r, rotulo: r, recusada: false })),
        campos: app ? [{ rotulo: 'Responsável', valor: 'Admin ficticio327' }, { rotulo: 'Temperatura', valor: 'Quente' }, { rotulo: 'Produto', valor: 'Curso ficticio327' }] : [] };
}
function validarBase(base) {
    let u;
    try {
        u = new URL(base);
    }
    catch {
        exigir(false, 'base local3110 invalida.');
    }
    exigir(u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname) && u.port === '3110' && u.pathname === '/' && !u.search && !u.hash && !u.username && !u.password, 'base HTTP local3110 exigida.');
    return u.origin;
}
/** Quatro leituras preflight; nao sao aquisicoes UI nem prova de apenas um GET no browser. */
export async function confirmarOportunidades(contexto, base, config) {
    configurarOportunidades(config);
    base = validarBase(base);
    const ler = async (caminho) => { const r = await contexto.request.get(base + caminho); exigir(r.status() === 200, 'GET real HTTP' + r.status() + ' em ' + caminho); return r.json(); };
    const sessao = await ler('/api/auth/session');
    exigir(sessao?.user?.id === config.usuarioId && sessao.user.email === config.email && JSON.stringify(sessao.user.papeis) === JSON.stringify([config.ator === 'admin' ? 'ADMINISTRADOR' : 'PROFESSOR']), 'sessao/ator divergente.');
    const raiz = '/api/inbox/atendimentos/' + encodeURIComponent(config.atendimentoId) + '/painel';
    const painel = await ler(raiz), admin = config.ator === 'admin', cap = painel?.cabecalho?.capacidades;
    exigir(painel?.setor === 'COMERCIAL' && painel.pessoaId === config.pessoaId && painel.oportunidade?.id === config.oportunidadeId && painel.cabecalho?.pessoaId === config.pessoaId && painel.podeEnviar === false, 'contexto comercial da fixture divergente.');
    exigir(cap?.veLead === true && cap.verContato === admin && cap.editarContato === admin && cap.moverEtapa === admin, 'capacidades da fixture divergentes.');
    const dados = await ler(raiz + '/oportunidades'), o = dados?.atual;
    exigir(dados?.pessoaId === config.pessoaId && Array.isArray(dados.outras) && dados.outras.length === 0 && o?.id === config.oportunidadeId && o.titulo === 'Oportunidade ficticia327' && o.produto === 'Curso ficticio327' && o.valor === '1234.56' && o.moeda === 'BRL' && o.etapa === 'PROPOSTA' && o.temperatura === 'QUENTE' && o.responsavel?.id === 'inbox-327-admin' && o.responsavel.nome === 'Admin ficticio327' && o.dataExperimental === null && o.experimentalConfirmada === false && o.professorExperimental === null && o.motivoPerda === null, 'oportunidade/descricao esperada divergente.');
    const detalhes = await ler(raiz + '/detalhes');
    exigir(detalhes?.pessoa?.id === config.pessoaId && detalhes?.oportunidade?.id === config.oportunidadeId && detalhes.oportunidade.produto === o.produto && detalhes.oportunidade.valor === o.valor && detalhes.oportunidade.moeda === o.moeda && detalhes.oportunidade.etapa === o.etapa && detalhes.b2b === null && Array.isArray(detalhes.campos) && detalhes.campos.length === 0, 'detalhes iniciais divergentes.');
    return { statusSessao: 200, statusPainel: 200, statusOportunidades: 200, statusDetalhes: 200, leiturasPreflight: 4, corpoDetalhesSha256: hashCorpoPainel327(detalhes), corpoOportunidadesSha256: hashCorpoPainel327(dados), aquisicoesUI: null, atendimentoId: config.atendimentoId, oportunidadeId: o.id, pessoaId: dados.pessoaId, ator: config.ator, capacidades: { veLead: cap.veLead, verContato: cap.verContato, editarContato: cap.editarContato, moverEtapa: cap.moverEtapa, podeEnviar: painel.podeEnviar }, descricao: descricaoOportunidades(config, 'app', { nome: painel.acoes?.contatoNome, subtitulo: painel.cabecalho?.subtitulo, leadIdLegado: painel.acoes?.leadId ?? null }) };
}
/** Callback autocontido e somente leitura para evaluate/waitForFunction. */
export function semanticaOportunidadesProntas(d) {
    if (!d || !['app', 'prototipo'].includes(d.alvo))
        return false;
    const texto = e => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
    // Geometria visual e exposicao acessivel sao criterios distintos: sr-only/opacity nao ocultam anuncios.
    const acessivel = e => { if (!e) return false; for (let n = e; n; n = n.parentElement) { const s = window.getComputedStyle(n); if (n.inert || n.hasAttribute('hidden') || n.getAttribute('aria-hidden') === 'true' || s.display === 'none' || ['hidden', 'collapse'].includes(s.visibility)) return false; } return true; };
    const alcance = e => {
        if (!acessivel(e)) return null;
        const r = e.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return null;
        const limite = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
        for (let n = e; n; n = n.parentElement) {
            const s = window.getComputedStyle(n);
            if (Number(s.opacity) <= 0) return null;
            if (n === e) continue;
            if (![s.overflowX || s.overflow, s.overflowY || s.overflow].some(v => ['auto', 'scroll', 'hidden', 'clip'].includes(v))) continue;
            const c = n.getBoundingClientRect(), x = c.left + (n.clientLeft || 0), y = c.top + (n.clientTop || 0);
            if (['auto', 'scroll', 'hidden', 'clip'].includes(s.overflowX || s.overflow)) { limite.left = Math.max(limite.left, x); limite.right = Math.min(limite.right, x + (n.clientWidth || c.width)); }
            if (['auto', 'scroll', 'hidden', 'clip'].includes(s.overflowY || s.overflow)) { limite.top = Math.max(limite.top, y); limite.bottom = Math.min(limite.bottom, y + (n.clientHeight || c.height)); }
        }
        return { r, limite };
    };
    const perceptivel = (e, inteira = true) => { const a = alcance(e); if (!a) return false; const { r, limite: l } = a; return inteira ? r.left >= l.left - 1 && r.right <= l.right + 1 && r.top >= l.top - 1 && r.bottom <= l.bottom + 1 : Math.min(r.right, l.right) > Math.max(r.left, l.left) && Math.min(r.bottom, l.bottom) > Math.max(r.top, l.top); };
    const estadoPendente = area => [area, ...area.querySelectorAll('[aria-busy="true"], [role="alert"], [role="status"]')].some(e => {
        if (!acessivel(e)) return false;
        if (e.getAttribute('aria-busy') === 'true') return true;
        if (!['alert', 'status'].includes(e.getAttribute('role'))) return false;
        const rotulo = (e.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean).map(id => document.getElementById(id)).filter(acessivel).map(texto).join(' ');
        return !!(texto(e) || (e.getAttribute('aria-label') ?? '').trim() || rotulo);
    });
    const medida = (v, n) => Number.isFinite(parseFloat(v)) && Math.abs(parseFloat(v) - n) <= .5;
    const dentro = r => r.width > 0 && r.height > 0 && r.left >= -1 && r.right <= window.innerWidth + 1 && r.top >= -1 && r.bottom <= window.innerHeight + 1;
    const visivel = e => { if (d.alvo === 'app') return perceptivel(e); if (!e || e.inert || e.closest('[inert]') || e.closest('[aria-hidden="true"]'))
        return false; const s = window.getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0 && dentro(e.getBoundingClientRect()) && perceptivel(e); };
    const app = d.alvo === 'app', painel = app ? document.getElementById('painel-contato') : document.querySelector('[data-m="panel"]');
    if (!visivel(painel) || painel.getAnimations({ subtree: true }).some(a => a.playState === 'running') || document.documentElement.scrollWidth > window.innerWidth + 1)
        return false;
    if ([...painel.querySelectorAll(app ? 'h2' : 'div')].filter(e => texto(e) === d.nomeCabecalho && visivel(e)).length !== 1)
        return false;
    if (app) {
        const c = painel.querySelector('[data-cabecalho-contato]');
        if (!visivel(c) || ![...c.querySelectorAll('p')].some(p => visivel(p) && texto(p) === d.subtitulo))
            return false;
    }
    const modais = [...document.querySelectorAll('[aria-modal="true"]')].filter(visivel);
    if (modais.some(m => m !== painel) || modais.length > 1)
        return false;
    let area;
    if (app) {
        const tabs = [...painel.querySelectorAll('[role="tab"]')].filter(t => t.getAttribute('data-aba') === 'oportunidades' && t.getAttribute('aria-selected') === 'true' && visivel(t));
        if (tabs.length !== 1 || tabs[0].disabled)
            return false;
        area = document.getElementById(tabs[0].getAttribute('aria-controls'));
        if (!area || area.getAttribute('role') !== 'tabpanel' || area.getAttribute('aria-labelledby') !== tabs[0].id)
            return false;
    }
    else {
        if (d.ator !== 'admin')
            return false;
        const tabs = [...painel.querySelectorAll('button')].filter(t => texto(t) === 'Oportunidades' && visivel(t));
        if (tabs.length !== 1 || ['transparent', 'rgba(0, 0, 0, 0)'].includes(window.getComputedStyle(tabs[0]).borderBottomColor))
            return false;
        const titulos = [...painel.querySelectorAll('div')].filter(e => texto(e) === 'Oportunidade atual' && visivel(e));
        if (titulos.length !== 1)
            return false;
        area = titulos[0].closest('section');
    }
    if (app ? (!perceptivel(area, false) || estadoPendente(area)) : (!perceptivel(area, false) || area.getAttribute('aria-busy') === 'true' || area.querySelector('[aria-busy="true"]') || area.querySelector('[role="alert"]') || area.querySelector('[role="status"]')))
        return false;
    const header = app ? area.querySelector('header') : area;
    if (!header || (app && !visivel(header)) || !texto(header).includes('Oportunidade atual') || !texto(header).includes('Funil Matrículas'))
        return false;
    if (!app && ![...header.querySelectorAll('span')].some(e => texto(e) === 'Funil Matrículas' && visivel(e)))
        return false;
    const folhas = [...header.querySelectorAll(app ? 'p' : 'div')].filter(visivel);
    if (!folhas.some(e => texto(e) === d.produto) || !folhas.some(e => texto(e) === d.valorTexto))
        return false;
    const selects = [...area.querySelectorAll('select')].filter(visivel);
    if (selects.length !== 1)
        return false;
    const select = selects[0];
    if (select.value !== d.etapa || select.disabled !== !d.podeMover)
        return false;
    const opcoes = [...select.querySelectorAll('option')];
    if (opcoes.length !== d.opcoes.length || opcoes.some((o, i) => o.value !== d.opcoes[i].valor || texto(o) !== d.opcoes[i].rotulo || o.disabled !== d.opcoes[i].recusada))
        return false;
    if (app) {
        const bloco327 = header.parentElement;
        if (!bloco327 || bloco327 === area || !area.contains(bloco327) || !bloco327.contains(select))
            return false;
        if (select.getAttribute('name') !== 'etapaOportunidade' || ![...area.querySelectorAll('label')].some(l => bloco327.contains(l) && l.getAttribute('for') === select.id && texto(l) === 'Etapa da oportunidade'))
            return false;
        const grupo = area.querySelector('[role="group"][aria-label="Etapas da oportunidade"]');
        if (!visivel(grupo) || !medida(window.getComputedStyle(grupo).columnGap, 3) || !bloco327.contains(grupo))
            return false;
        const botoes = [...grupo.querySelectorAll('button')];
        if (botoes.length !== 8 || botoes.some((b, i) => !visivel(b) || b.getAttribute('aria-label') !== 'Etapa ' + d.segmentos[i] || b.disabled !== !d.podeMover || b.getAttribute('aria-current') !== (i === 5 ? 'step' : null) || b.getBoundingClientRect().height < 44))
            return false;
        const barras = botoes.map(b => b.querySelector('span'));
        if (barras.some(s => !s || !dentro(s.getBoundingClientRect()) || Math.abs(s.getBoundingClientRect().height - 4) > .5 || !medida(window.getComputedStyle(s).borderRadius, 2)))
            return false;
        const cores = barras.map(s => window.getComputedStyle(s).backgroundColor);
        if (cores.slice(0, 6).some(c => c !== cores[5]) || cores[6] !== cores[7] || cores[5] === cores[6])
            return false;
        const linhas = [...area.querySelectorAll('dt')];
        if (d.campos.some(c => { const dt = linhas.find(e => texto(e) === c.rotulo), dd = dt?.parentElement?.querySelector('dd'); return !bloco327.contains(dt) || !bloco327.contains(dd) || !visivel(dd) || texto(dd) !== c.valor; }))
            return false;
        const lapis = painel.querySelector('button[aria-label="Editar contato"]');
        if (d.podeMover ? (!visivel(lapis) || lapis.disabled) : !!lapis)
            return false;
        if (typeof d.podeAbrirFunil !== 'boolean' || typeof d.hrefFunilAtual !== 'string' || !d.hrefFunilAtual.startsWith('/funil?o=') || !(d.hrefFunilLegado === null || d.hrefFunilLegado === d.hrefFunilAtual))
            return false;
        if (bloco327.querySelector('section[aria-label="Cadastro do contato"]'))
            return false;
        const linksFunil = [...painel.querySelectorAll('a')].filter(a => (a.getAttribute('href') ?? '').startsWith('/funil'));
        if (linksFunil.filter(a => bloco327.contains(a)).some(a => !d.podeAbrirFunil || a.getAttribute('href') !== d.hrefFunilAtual))
            return false;
        const legados = linksFunil.filter(a => !bloco327.contains(a));
        if (legados.length > 1 || legados.some(a => { const slot = a.closest('section[aria-label="Cadastro do contato"]'); return !slot || slot.contains(bloco327) || a.getAttribute('href') !== d.hrefFunilLegado || texto(a) !== 'Abrir oportunidade'; }))
            return false;
    }
    else {
        const barras = [...area.querySelectorAll('div[title]')].filter(e => d.segmentos.includes(e.getAttribute('title')));
        if (barras.length !== 6 || barras.some((b, i) => !visivel(b) || b.getAttribute('title') !== d.segmentos[i] || Math.abs(b.getBoundingClientRect().height - 4) > .5 || !medida(window.getComputedStyle(b).borderRadius, 2)))
            return false;
        const cores = barras.map(b => window.getComputedStyle(b).backgroundColor);
        if (cores.slice(0, 3).some(c => c !== cores[2]) || cores.slice(3).some(c => c !== cores[3]) || cores[2] === cores[3])
            return false;
    }
    return true;
}
/** Preflight e navegacao somente leitura; nao requer mensagem/nota na fixture nova. */
export async function abrirOportunidadesApp(pagina, contexto, base, config, instrumentacao) {
    exigir(instrumentacao?.coletor && instrumentacao?.identidade, 'instrumentacao/coletor327 obrigatorios.');
    const preflight = await confirmarOportunidades(contexto, base, config);
    base = validarBase(base);
    await pagina.goto(base + '/inbox?c=' + encodeURIComponent(config.atendimentoId), { waitUntil: 'domcontentloaded' });
    await esperarHidratacaoApp(pagina);
    const painel = pagina.locator('#painel-contato');
    if (!await painel.isVisible() || await painel.getAttribute('aria-hidden') === 'true')
        await pagina.getByRole('button', { name: 'Painel do contato', exact: true }).click();
    await painel.waitFor({ state: 'visible' });
    await pagina.waitForFunction(semanticaDetalhesInicial327, preflight.descricao);
    const token = await instrumentacao.coletor.aguardar();
    instrumentacao.coletor.marcarTransicao(token, { ...instrumentacao.identidade, fase: 'detalhes-inicial', atendimentoAtualId: new URL(pagina.url()).searchParams.get('c'), corpoEsperadoSha256: preflight.corpoDetalhesSha256, paginaAtiva: !pagina.isClosed(), semanticaFinal: await pagina.evaluate(semanticaDetalhesInicial327, preflight.descricao) });
    await painel.getByRole('tab', { name: 'Oportunidades', exact: true }).click();
    await pagina.waitForFunction(semanticaOportunidadesProntas, preflight.descricao);
    return { metadados: { oportunidadesPreflight: preflight, aquisicoesUI: null, descricaoEsperada: preflight.descricao } };
}
/** Somente o HTML originalc1/aba; nenhuma mutacao de etapa, valor, dados ou CSS. */
export async function abrirOportunidadesPrototipo(pagina, config) {
    const descricao = descricaoOportunidades(config, 'prototipo');
    const url = new URL('../../docs/planejamento/inbox-prototipo/prototipo/Inbox.dc.html', import.meta.url);
    url.search = '?c=c1';
    await pagina.goto(url.href, { waitUntil: 'load' });
    const root = pagina.locator('[data-m="root"]');
    await root.waitFor({ state: 'visible' });
    const chat = root.locator('[data-m="chat"]');
    if (!await chat.isVisible())
        await root.getByText('Mariana Costa', { exact: true }).first().click();
    await chat.waitFor({ state: 'visible' });
    const painel = root.locator('[data-m="panel"]');
    if (!await painel.isVisible())
        await root.getByTitle('Painel do contato', { exact: true }).first().click();
    await painel.waitFor({ state: 'visible' });
    await painel.getByRole('button', { name: 'Oportunidades', exact: true }).click();
    await pagina.waitForFunction(semanticaOportunidadesProntas, descricao);
    return { metadados: { referenciaOriginal: true, descricaoEsperada: descricao, aquisicoesUI: null } };
}
/** Extensao327: o nucleo325 permanece com220; a CLI combinada expoe238. */
export const ESTADOS_OPORTUNIDADES327 = Object.freeze({
    'painel-oportunidades': { tamanhos: ['desktop', 'tablet', 'celular'], prototipo: true },
    'painel-oportunidades-leitor': { tamanhos: ['desktop', 'tablet', 'celular'], prototipo: false, motivoSemReferencia: 'Convite D13 somente leitura nao tem equivalente funcional no prototipo.' },
});
export const ESTADOS_CAPTURA327 = Object.freeze({ ...ESTADOS_BASE, ...ESTADOS_OPORTUNIDADES327 });
export function combinacoesCaptura327({ alvos, estados }) {
    exigir(new Set(alvos).size === alvos.length && new Set(estados).size === estados.length, 'alvos/estados duplicados.');
    const resultado = [];
    for (const alvo of alvos)
        for (const estado of estados) {
            exigir(['app', 'prototipo'].includes(alvo) && Object.hasOwn(ESTADOS_CAPTURA327, estado), 'alvo/estado desconhecido.');
            if (Object.hasOwn(ESTADOS_BASE, estado)) {
                resultado.push(...combinacoesBase({ alvos: [alvo], estados: [estado] }));
                continue;
            }
            const d = ESTADOS_OPORTUNIDADES327[estado];
            if (alvo === 'prototipo' && !d.prototipo)
                continue;
            for (const tema of TEMAS)
                for (const tamanho of d.tamanhos)
                    resultado.push({ alvo, tema, tamanho, estado });
        }
    return resultado;
}
export function configurarOportunidadesCli(estado, env = process.env) {
    exigir(Object.hasOwn(ESTADOS_OPORTUNIDADES327, estado), 'estado327 desconhecido.');
    const ator = estado === 'painel-oportunidades-leitor' ? 'leitor' : 'admin', prefixo = 'INBOX_VISUAL_OPORTUNIDADES_' + ator.toUpperCase();
    return configurarOportunidades({ atendimentoId: env.INBOX_VISUAL_OPORTUNIDADES_ATENDIMENTO, oportunidadeId: env.INBOX_VISUAL_OPORTUNIDADES_ID, pessoaId: env.INBOX_VISUAL_OPORTUNIDADES_PESSOA, ator, usuarioId: env[prefixo + '_USUARIO_ID'] ?? env.INBOX_VISUAL_USUARIO_ID, email: env[prefixo + '_EMAIL'] ?? env.INBOX_VISUAL_EMAIL });
}
// Mesmos originais: blobs Git LF ou checkout Windows CRLF; hashes físicos continuam no manifesto.
export function excecaoConsolePrototipo327({ alvo, tipo, texto, hashes }) {
    if (alvo !== 'prototipo' || tipo !== 'error' || !['7698a34bad041c95f45710cfe3ed6f79a97ba5f49bf5d941751c37324233d8cf', 'd798650956fba7ccee3b4efb22d56e81fb6504d89909c23178b9691d3515db50'].includes(hashes?.htmlSha256) || !['d6bb6dd3aadb9ff722d5d6db2193572ece476b915899575a571de7a0717f001f', '8fe7df74405f3c55f49b7249c74ea1397e65d07dea2b1bd3b4a489bec2e28cbe'].includes(hashes?.supportSha256))
        return false;
    const suporte = new URL('../../docs/planejamento/inbox-prototipo/prototipo/support.js', import.meta.url).href;
    return typeof texto === 'string' && texto.startsWith("TypeError: Cannot read properties of undefined (reading 'sel')\n") && texto.includes('Component.componentDidUpdate (eval at evalDcLogic (' + suporte + ':844:16), <anonymous>:143:202)') && texto.includes('StreamableComponent.componentDidUpdate (' + suporte + ':1013:24)');
}
/** DOM inicial completo antes do clique; nenhum aborto generico dispensado na troca de aba. */
export function semanticaDetalhesInicial327(d) {
    if (d?.alvo !== 'app')
        return false;
    const texto = e => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
    // Geometria visual e exposicao acessivel sao criterios distintos: sr-only/opacity nao ocultam anuncios.
    const acessivel = e => { if (!e) return false; for (let n = e; n; n = n.parentElement) { const s = window.getComputedStyle(n); if (n.inert || n.hasAttribute('hidden') || n.getAttribute('aria-hidden') === 'true' || s.display === 'none' || ['hidden', 'collapse'].includes(s.visibility)) return false; } return true; };
    const alcance = e => {
        if (!acessivel(e)) return null;
        const r = e.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return null;
        const limite = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
        for (let n = e; n; n = n.parentElement) {
            const s = window.getComputedStyle(n);
            if (Number(s.opacity) <= 0) return null;
            if (n === e) continue;
            if (![s.overflowX || s.overflow, s.overflowY || s.overflow].some(v => ['auto', 'scroll', 'hidden', 'clip'].includes(v))) continue;
            const c = n.getBoundingClientRect(), x = c.left + (n.clientLeft || 0), y = c.top + (n.clientTop || 0);
            if (['auto', 'scroll', 'hidden', 'clip'].includes(s.overflowX || s.overflow)) { limite.left = Math.max(limite.left, x); limite.right = Math.min(limite.right, x + (n.clientWidth || c.width)); }
            if (['auto', 'scroll', 'hidden', 'clip'].includes(s.overflowY || s.overflow)) { limite.top = Math.max(limite.top, y); limite.bottom = Math.min(limite.bottom, y + (n.clientHeight || c.height)); }
        }
        return { r, limite };
    };
    const perceptivel = (e, inteira = true) => { const a = alcance(e); if (!a) return false; const { r, limite: l } = a; return inteira ? r.left >= l.left - 1 && r.right <= l.right + 1 && r.top >= l.top - 1 && r.bottom <= l.bottom + 1 : Math.min(r.right, l.right) > Math.max(r.left, l.left) && Math.min(r.bottom, l.bottom) > Math.max(r.top, l.top); };
    const estadoPendente = area => [area, ...area.querySelectorAll('[aria-busy="true"], [role="alert"], [role="status"]')].some(e => {
        if (!acessivel(e)) return false;
        if (e.getAttribute('aria-busy') === 'true') return true;
        if (!['alert', 'status'].includes(e.getAttribute('role'))) return false;
        const rotulo = (e.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean).map(id => document.getElementById(id)).filter(acessivel).map(texto).join(' ');
        return !!(texto(e) || (e.getAttribute('aria-label') ?? '').trim() || rotulo);
    });
    const visivel = e => perceptivel(e);
    const p = document.getElementById('painel-contato');
    if (!visivel(p) || p.getAnimations({ subtree: true }).some(a => a.playState === 'running') || document.documentElement.scrollWidth > window.innerWidth + 1)
        return false;
    const cab = p.querySelector('[data-cabecalho-contato]');
    if (!visivel(cab) || [...cab.querySelectorAll('h2')].filter(e => visivel(e) && texto(e) === d.nomeCabecalho).length !== 1 || ![...cab.querySelectorAll('p')].some(e => visivel(e) && texto(e) === d.subtitulo))
        return false;
    const modais = [...document.querySelectorAll('[aria-modal="true"]')].filter(visivel);
    if (modais.some(e => e !== p) || modais.length > 1)
        return false;
    const tabs = [...p.querySelectorAll('[role="tab"]')].filter(visivel), det = tabs.find(t => t.getAttribute('data-aba') === 'detalhes'), op = tabs.find(t => t.getAttribute('data-aba') === 'oportunidades');
    if (tabs.length !== 2 || !det || !op || det.disabled || op.disabled || det.getAttribute('aria-selected') !== 'true' || op.getAttribute('aria-selected') !== 'false')
        return false;
    const area = document.getElementById(det.getAttribute('aria-controls'));
    if (!perceptivel(area, false) || area.getAttribute('role') !== 'tabpanel' || area.getAttribute('aria-labelledby') !== det.id || estadoPendente(area) || area.querySelector('select'))
        return false;
    const botoes = [...area.querySelectorAll('button[aria-label="Abrir oportunidade atual"]')].filter(visivel);
    return botoes.length === 1 && !botoes[0].disabled && ['Oportunidade atual', d.produto, d.valorTexto, 'Proposta'].every(t => texto(botoes[0]).includes(t));
}
