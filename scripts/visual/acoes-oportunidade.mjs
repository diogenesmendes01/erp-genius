import { ESTADOS_CAPTURA327, combinacoesCaptura327 } from './oportunidades-inbox.mjs';
import { TEMAS } from './nucleo-captura.mjs';
import { hashCorpoPainel327 } from './coletor-oportunidades.mjs';
import { esperarHidratacaoApp } from './espera-app.mjs';
const exigir = (ok, mensagem) => { if (!ok) throw new Error('Acoes328: ' + mensagem); };
const tamanhos = ['desktop', 'tablet', 'celular'];
const semProto = motivo => ({ tamanhos, prototipo: false, motivoSemReferencia: motivo });
export const ESTADOS_ACOES328 = Object.freeze({
    'painel-acoes-experimental': { tamanhos, prototipo: true },
    'painel-acoes-perda': semProto('Perda usa o ModalPerda real; o prototipo nao implementa sua abertura.'),
    'funil-perda-referencia': semProto('Referencia funcional APP Funil atual; nunca PROTO.'),
    'painel-acoes-experimental-leitor': semProto('Convite D13 somente leitura e APP-only.'),
});
export const ESTADOS_CAPTURA328 = Object.freeze({ ...ESTADOS_CAPTURA327, ...ESTADOS_ACOES328 });
export function combinacoesAcoes328({ alvos, estados }) {
    exigir(new Set(alvos).size === alvos.length && new Set(estados).size === estados.length, 'alvos/estados duplicados.');
    const saida = [];
    for (const alvo of alvos) for (const estado of estados) {
        exigir(['app', 'prototipo'].includes(alvo) && Object.hasOwn(ESTADOS_ACOES328, estado), 'alvo/estado328 desconhecido.');
        const d = ESTADOS_ACOES328[estado];
        if (alvo === 'prototipo' && !d.prototipo) continue;
        for (const tema of TEMAS) for (const tamanho of d.tamanhos) saida.push({ alvo, tema, tamanho, estado });
    }
    return saida;
}
export function combinacoesCaptura328({ alvos, estados }) {
    exigir(new Set(alvos).size === alvos.length && new Set(estados).size === estados.length, 'alvos/estados duplicados.');
    return alvos.flatMap(alvo => estados.flatMap(estado => Object.hasOwn(ESTADOS_ACOES328, estado) ? combinacoesAcoes328({ alvos: [alvo], estados: [estado] }) : combinacoesCaptura327({ alvos: [alvo], estados: [estado] })));
}
const campos = ['atendimentoId', 'oportunidadeId', 'pessoaId', 'ator', 'usuarioId', 'email', 'fusoEscola', 'fusoExibicao'];
const iana = valor => { try { return typeof valor === 'string' && !!valor && !!new Intl.DateTimeFormat('pt-BR', { timeZone: valor }); } catch { return false; } };
export function configurarAcoes328(entrada) {
    exigir(entrada && Object.keys(entrada).length === campos.length && Object.keys(entrada).every(k => campos.includes(k)), 'configuracao explicita sem campos extras.');
    exigir(entrada.atendimentoId === 'inbox-328-atendimento' && entrada.oportunidadeId === 'inbox-328-oportunidade' && entrada.pessoaId === 'inbox-328-pessoa', 'identidade ficticia328 exigida.');
    exigir(['admin', 'leitor'].includes(entrada.ator) && entrada.usuarioId === 'inbox-328-' + entrada.ator && entrada.email === 'inbox328.' + entrada.ator + '@genius.test', 'ator328 divergente.');
    exigir(iana(entrada.fusoEscola) && (entrada.fusoExibicao === null || iana(entrada.fusoExibicao)), 'fusos explicitos validos exigidos.');
    exigir(entrada.fusoExibicao === (entrada.ator === 'admin' ? null : 'America/New_York'), 'preferencia pessoal da fixture divergente.');
    return Object.freeze({ ...entrada });
}
export function configurarAcoesCli328(estado, env = process.env) {
    exigir(Object.hasOwn(ESTADOS_ACOES328, estado), 'estado328 desconhecido.');
    const ator = estado === 'painel-acoes-experimental-leitor' ? 'leitor' : 'admin', prefixo = 'INBOX_VISUAL_ACOES_' + ator.toUpperCase();
    exigir(env[prefixo + '_FUSO'] !== undefined, 'preferencia explicita da fixture exigida.');
    return configurarAcoes328({ atendimentoId: env.INBOX_VISUAL_ACOES_ATENDIMENTO, oportunidadeId: env.INBOX_VISUAL_ACOES_ID, pessoaId: env.INBOX_VISUAL_ACOES_PESSOA, ator, usuarioId: env[prefixo + '_USUARIO_ID'], email: env[prefixo + '_EMAIL'], fusoEscola: env.INBOX_VISUAL_ACOES_FUSO_ESCOLA, fusoExibicao: env[prefixo + '_FUSO'] === 'ORIGEM' ? null : env[prefixo + '_FUSO'] });
}
const etapas = [['NOVO', 'Novo'], ['EM_ATENDIMENTO', '1º Contato'], ['QUALIFICADO', 'Qualificado'], ['EXPERIMENTAL_AGENDADA', 'Exp. Agendada'], ['EXPERIMENTAL_REALIZADA', 'Exp. Realizada'], ['NO_SHOW', 'No-show'], ['PROPOSTA', 'Proposta'], ['AGUARDANDO_MATRICULA', 'Aguardando Matrícula'], ['MATRICULADO', 'Matriculado'], ['PERDIDO', 'Perdido']];
const motivos = [['NAO_RESPONDEU', 'Não respondeu'], ['PRECO', 'Preço'], ['TEMPO', 'Tempo/Horário'], ['CONCORRENCIA', 'Concorrência'], ['INTERESSE', 'Sem interesse'], ['LOCALIZACAO', 'Localização'], ['EMPRESA', 'Empresa (B2B)'], ['QUALIFICACAO', 'Qualificação'], ['OUTRO', 'Outro']];
export function descreverAcoes328(config, painel, dados) {
    configurarAcoes328(config);
    const o = dados?.atual, cap = painel?.cabecalho?.capacidades;
    exigir(o?.id === config.oportunidadeId && dados.pessoaId === config.pessoaId && cap && typeof painel.acoes?.contatoNome === 'string' && painel.acoes.contatoNome.trim() && typeof painel.cabecalho.subtitulo === 'string' && painel.cabecalho.subtitulo.trim(), 'descricao/identidade do produtor exigida.');
    const legado = painel.acoes?.leadId ?? null;
    exigir(legado === null || legado === config.oportunidadeId, 'vinculo legado divergente.');
    const fuso = config.fusoExibicao ?? config.fusoEscola;
    exigir(o.dataExperimental === null || Number.isFinite(Date.parse(o.dataExperimental)), 'instante experimental invalido.');
    const experimental = o.dataExperimental ? { instante: o.dataExperimental, fuso, quando: new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: fuso }).format(new Date(o.dataExperimental)), professor: o.professorExperimental ?? 'Sem professor', status: o.etapa === 'NO_SHOW' ? 'Não compareceu' : o.etapa === 'EXPERIMENTAL_REALIZADA' ? 'Realizada' : o.experimentalConfirmada ? 'Confirmada' : 'Agendada' } : null;
    return { alvo: 'app', superficie: 'inbox', fase: 'cartao', ator: config.ator, nomeCabecalho: painel.acoes.contatoNome, subtitulo: painel.cabecalho.subtitulo, produto: o.produto ?? o.titulo, titulo: o.titulo, valorTexto: o.valor === null ? 'Sem valor' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: o.moeda }).format(Number(o.valor)).replaceAll('\u00a0', ' '), etapa: o.etapa, etapaRotulo: etapas.find(([v]) => v === o.etapa)?.[1], podeMover: cap.moverEtapa, podeAbrirFunil: config.ator === 'admin', podeAssumir: config.ator === 'admin', hrefFunilAtual: '/funil?o=' + encodeURIComponent(config.oportunidadeId), hrefFunilLegado: legado ? '/funil?o=' + encodeURIComponent(legado) : null, segmentos: etapas.filter(([v]) => !['NO_SHOW', 'PERDIDO'].includes(v)).map(([, r]) => r), opcoes: etapas.map(([valor, rotulo]) => ({ valor, rotulo, recusada: ['NOVO', 'EM_ATENDIMENTO', 'NO_SHOW'].includes(valor) })), campos: [{ rotulo: 'Responsável', valor: o.responsavel?.nome ?? 'Sem responsável' }, { rotulo: 'Temperatura', valor: 'Quente' }, { rotulo: 'Produto', valor: o.produto ?? '—' }], experimental, motivos, observacao: 'Observação fictícia 328 — não enviar', permissoes328Origem: 'AbrirFunil/Assumir sao expectativas da fixture e papel conferido; Assumir nao e capacidade exposta pelo DTO Painel. ROOT deve pinhar contexto/fusos na admissao.' };
}
function baseLocal(base) { let u; try { u = new URL(base); } catch { exigir(false, 'base local3110 exigida.'); } exigir(u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname) && u.port === '3110' && u.pathname === '/' && !u.search && !u.hash && !u.username && !u.password, 'base local3110 exigida.'); return u.origin; }
/** Somente quatro GET; fusos/contextoAssumir serao pinados pelo ROOT na admissao, sem inventar endpoint. */
export async function confirmarAcoes328(contexto, base, config) {
    configurarAcoes328(config); base = baseLocal(base);
    const ler = async path => { const r = await contexto.request.get(base + path, { maxRedirects: 0, maxRetries: 0 }); exigir(r.status() === 200, 'GET real HTTP' + r.status() + ' em ' + path); return r.json(); };
    const sessao = await ler('/api/auth/session'), admin = config.ator === 'admin';
    exigir(sessao?.user?.id === config.usuarioId && sessao.user.email === config.email && JSON.stringify(sessao.user.papeis) === JSON.stringify([admin ? 'ADMINISTRADOR' : 'PROFESSOR']), 'sessao/ator divergente.');
    const raiz = '/api/inbox/atendimentos/' + encodeURIComponent(config.atendimentoId) + '/painel', painel = await ler(raiz), cap = painel?.cabecalho?.capacidades;
    exigir(painel?.setor === 'COMERCIAL' && painel.pessoaId === config.pessoaId && painel.oportunidade?.id === config.oportunidadeId && painel.cabecalho?.pessoaId === config.pessoaId && painel.podeEnviar === false, 'contexto da fixture divergente.');
    exigir(cap?.veLead === true && cap.verContato === admin && cap.editarContato === admin && cap.moverEtapa === admin, 'capacidades divergentes.');
    const dados = await ler(raiz + '/oportunidades'), o = dados?.atual;
    exigir(dados?.pessoaId === config.pessoaId && Array.isArray(dados.outras) && dados.outras.length === 0 && o?.id === config.oportunidadeId && o.titulo === 'Oportunidade ficticia328' && o.produto === 'Ingles Ficticio 328' && o.valor === '1234.56' && o.moeda === 'BRL' && o.etapa === 'EXPERIMENTAL_REALIZADA' && o.temperatura === 'QUENTE' && o.responsavel?.id === 'inbox-328-admin' && o.responsavel.nome === 'Admin ficticio328' && o.dataExperimental === '2026-10-16T22:00:00.000Z' && o.experimentalConfirmada === false && o.professorExperimental === 'Professor ficticio328' && o.motivoPerda === null, 'oportunidade experimental divergente.');
    const detalhes = await ler(raiz + '/detalhes');
    exigir(detalhes?.pessoa?.id === config.pessoaId && detalhes.oportunidade?.id === o.id && detalhes.oportunidade.produto === o.produto && detalhes.oportunidade.valor === o.valor && detalhes.oportunidade.moeda === o.moeda && detalhes.oportunidade.etapa === o.etapa && detalhes.b2b === null && Array.isArray(detalhes.campos) && detalhes.campos.length === 0, 'detalhes iniciais divergentes.');
    return { leiturasPreflight: 4, aquisicoesUI: null, corpoDetalhesSha256: hashCorpoPainel327(detalhes), corpoOportunidadesSha256: hashCorpoPainel327(dados), descricao: descreverAcoes328(config, painel, dados), capacidadesPainel: { ...cap, podeEnviar: false } };
}
/** Callback autocontido, somente leitura; fase e superficie sao metadados, nunca aplicados ao DOM. */
export function semanticaAcoes328(d) {
    if (!d || !['app', 'prototipo'].includes(d.alvo) || !['detalhes', 'topo', 'cartao', 'perda', 'funil'].includes(d.fase)) return false;
    const texto = e => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const acessivel = e => { if (!e) return false; for (let n = e; n; n = n.parentElement) { const s = window.getComputedStyle(n); if (n.inert || n.hasAttribute('hidden') || n.getAttribute('aria-hidden') === 'true' || s.display === 'none' || ['hidden', 'collapse'].includes(s.visibility)) return false; } return true; };
    const visivel = (e, inteiro = true) => {
        if (!acessivel(e)) return false;
        const r = e.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return false;
        const l = { left: 0, right: window.innerWidth, top: 0, bottom: window.innerHeight };
        for (let n = e; n; n = n.parentElement) {
            const s = window.getComputedStyle(n); if (Number(s.opacity) <= 0) return false;
            if (n === e) continue;
            const x = s.overflowX || s.overflow, y = s.overflowY || s.overflow;
            if (![x, y].some(v => ['auto', 'scroll', 'hidden', 'clip'].includes(v))) continue;
            const c = n.getBoundingClientRect();
            if (['auto', 'scroll', 'hidden', 'clip'].includes(x)) { l.left = Math.max(l.left, c.left + (n.clientLeft || 0)); l.right = Math.min(l.right, c.left + (n.clientLeft || 0) + (n.clientWidth || c.width)); }
            if (['auto', 'scroll', 'hidden', 'clip'].includes(y)) { l.top = Math.max(l.top, c.top + (n.clientTop || 0)); l.bottom = Math.min(l.bottom, c.top + (n.clientTop || 0) + (n.clientHeight || c.height)); }
        }
        return inteiro ? r.left >= l.left - 1 && r.right <= l.right + 1 && r.top >= l.top - 1 && r.bottom <= l.bottom + 1 : Math.min(r.right, l.right) > Math.max(r.left, l.left) && Math.min(r.bottom, l.bottom) > Math.max(r.top, l.top);
    };
    const pendente = area => [area, ...area.querySelectorAll('[aria-busy="true"], [role="alert"], [role="status"]')].some(e => acessivel(e) && (e.getAttribute('aria-busy') === 'true' || (['alert', 'status'].includes(e.getAttribute('role')) && !!(texto(e) || (e.getAttribute('aria-label') ?? '').trim() || (e.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean).map(id => document.getElementById(id)).filter(acessivel).map(texto).join(' ')))));
    const um = (lista, pred) => { const ns = [...lista].filter(pred); return ns.length === 1 ? ns[0] : null; };
    if (document.documentElement.scrollWidth > window.innerWidth + 1) return false;
    const modais = [...document.querySelectorAll('[aria-modal="true"]')].filter(e => visivel(e, false));
    if (d.fase === 'perda') {
        if (d.alvo !== 'app' || !d.podeMover || modais.length !== 1) return false;
        const m = modais[0], titulo = (m.getAttribute('aria-labelledby') ?? '').split(/\s+/).map(id => texto(document.getElementById(id))).join(' ') || m.getAttribute('aria-label');
        if (m.getAttribute('role') !== 'dialog' || titulo !== 'Marcar ' + d.titulo + ' como perdida' || pendente(m) || m.getAnimations({ subtree: true }).some(a => a.playState === 'running')) return false;
        const radios = [...m.querySelectorAll('input[type="radio"]')];
        if (radios.length !== d.motivos.length || radios.some((r, i) => r.name && r.name !== 'motivoPerda' || r.getAttribute('name') !== 'motivoPerda' || (r.value ?? r.getAttribute('value')) !== d.motivos[i][0] || r.disabled || r.checked !== (d.motivos[i][0] === 'OUTRO') || !visivel(r.parentElement) || texto(r.parentElement) !== d.motivos[i][1])) return false;
        const campo = um(m.querySelectorAll('textarea[name="observacao"]'), e => e.value === d.observacao && !e.disabled && e.getAttribute('maxlength') === '500' && texto(e.parentElement).includes('Observação (obrigatória)') && visivel(e));
        const voltar = um(m.querySelectorAll('button'), e => texto(e) === 'Voltar' && visivel(e) && !e.disabled);
        const confirmar = um(m.querySelectorAll('button'), e => texto(e) === 'Marcar como perdida' && visivel(e) && !e.disabled && e.getAttribute('aria-busy') !== 'true');
        return !!campo && !!voltar && !!confirmar;
    }
    if (d.fase === 'funil') {
        const m = um(modais, e => ((e.getAttribute('aria-label') ?? '').trim() || (e.getAttribute('aria-labelledby') ?? '').split(/\s+/).map(id => texto(document.getElementById(id))).join(' ')) === d.titulo);
        return d.alvo === 'app' && d.podeAbrirFunil && !!m && m.contains(document.activeElement) && acessivel(document.activeElement) && !m.getAnimations({ subtree: true }).some(a => a.playState === 'running') && !pendente(m) && !!um(m.querySelectorAll('button'), e => texto(e) === 'Marcar como perdida' && !e.disabled && visivel(e));
    }
    const app = d.alvo === 'app', painel = app ? document.getElementById('painel-contato') : document.querySelector('[data-m="panel"]');
    if (!visivel(painel, false) || painel.getAnimations({ subtree: true }).some(a => a.playState === 'running') || modais.some(m => m !== painel)) return false;
    if (!um(painel.querySelectorAll(app ? 'h2' : 'div'), e => texto(e) === d.nomeCabecalho && visivel(e))) return false;
    if (app && !um((painel.querySelector('[data-cabecalho-contato]')?.querySelectorAll('p') ?? []), e => texto(e) === d.subtitulo && visivel(e))) return false;
    let area;
    if (app) {
        const tab = um(painel.querySelectorAll('[role="tab"]'), e => e.getAttribute('data-aba') === (d.fase === 'detalhes' ? 'detalhes' : 'oportunidades') && e.getAttribute('aria-selected') === 'true' && !e.disabled && visivel(e));
        if (!tab) return false;
        area = document.getElementById(tab.getAttribute('aria-controls'));
        if (area?.getAttribute('role') !== 'tabpanel' || area.getAttribute('aria-labelledby') !== tab.id) return false;
    } else {
        if (d.ator !== 'admin' || !um(painel.querySelectorAll('button'), e => texto(e) === 'Oportunidades' && visivel(e) && !['transparent', 'rgba(0, 0, 0, 0)'].includes(window.getComputedStyle(e).borderBottomColor))) return false;
        const titulo = um(painel.querySelectorAll('div'), e => texto(e) === 'Oportunidade atual' && visivel(e)); area = titulo?.closest('section');
    }
    if (!visivel(area, false) || pendente(area)) return false;
    if (d.fase === 'detalhes') {
        const op = um(painel.querySelectorAll('[role="tab"]'), e => e.getAttribute('data-aba') === 'oportunidades' && e.getAttribute('aria-selected') === 'false' && visivel(e) && !e.disabled);
        const botao = um(area.querySelectorAll('button[aria-label="Abrir oportunidade atual"]'), e => !e.disabled && visivel(e) && ['Oportunidade atual', d.produto, d.valorTexto, d.etapaRotulo].every(v => texto(e).includes(v)));
        return !!op && !!botao && !area.querySelector('select');
    }
    const header = app ? area.querySelector('header') : area, bloco = app ? header?.parentElement : area;
    if (!header || !bloco || !area.contains(bloco) || (app && bloco === area) || !texto(header).includes('Oportunidade atual') || !texto(header).includes('Funil Matrículas')) return false;
    const select = um(bloco.querySelectorAll('select'), e => e.value === d.etapa && e.disabled === !d.podeMover);
    if (!select) return false;
    const opcoes = [...select.querySelectorAll('option')];
    if (opcoes.length !== d.opcoes.length || opcoes.some((o, i) => o.value !== d.opcoes[i].valor || texto(o) !== d.opcoes[i].rotulo || o.disabled !== d.opcoes[i].recusada)) return false;
    if (app && (select.getAttribute('name') !== 'etapaOportunidade' || !um(bloco.querySelectorAll('label'), e => e.getAttribute('for') === select.id && texto(e) === 'Etapa da oportunidade'))) return false;
    if (app && bloco.querySelector('section[aria-label="Cadastro do contato"]')) return false;
    const links = [...painel.querySelectorAll('a')].filter(a => (a.getAttribute('href') ?? '').startsWith('/funil'));
    if (links.filter(a => bloco.contains(a)).some(a => !d.podeAbrirFunil || a.getAttribute('href') !== d.hrefFunilAtual)) return false;
    const legados = links.filter(a => !bloco.contains(a));
    if (app && (legados.length > 1 || legados.some(a => { const slot = a.closest('section[aria-label="Cadastro do contato"]'); return !slot || slot.contains(bloco) || a.getAttribute('href') !== d.hrefFunilLegado || texto(a) !== 'Abrir oportunidade'; }))) return false;
    const topo = d.fase === 'topo';
    if (![d.produto, d.valorTexto].every(v => !!um(header.querySelectorAll(app ? 'p' : 'div'), e => texto(e) === v && acessivel(e)))) return false;
    if ((topo || !app) && (!(app ? visivel(header) : visivel(header, false)) || !visivel(select) || ![d.produto, d.valorTexto].every(v => [...header.querySelectorAll(app ? 'p' : 'div')].some(e => texto(e) === v && visivel(e))))) return false;
    if (app) {
        const grupo = bloco.querySelector('[role="group"][aria-label="Etapas da oportunidade"]'), botoes = [...(grupo?.querySelectorAll('button') ?? [])];
        if (!grupo || botoes.length !== 8 || Math.abs(parseFloat(window.getComputedStyle(grupo).columnGap) - 3) > .5 || !Number.isFinite(parseFloat(window.getComputedStyle(grupo).columnGap))) return false;
        if (botoes.some((b, i) => b.getAttribute('aria-label') !== 'Etapa ' + d.segmentos[i] || b.disabled !== !d.podeMover || b.getAttribute('aria-current') !== (i === 4 ? 'step' : null) || (topo && (!visivel(b) || b.getBoundingClientRect().height < 44)))) return false;
        const spans = botoes.map(b => b.querySelector('span'));
        if (spans.some(e => !e || Math.abs(e.getBoundingClientRect().height - 4) > .5 || (!Number.isFinite(parseFloat(window.getComputedStyle(e).borderRadius)) || Math.abs(parseFloat(window.getComputedStyle(e).borderRadius) - 2) > .5))) return false;
        const cores = spans.map(e => window.getComputedStyle(e).backgroundColor);
        if (cores.slice(0, 5).some(c => c !== cores[4]) || cores.slice(5).some(c => c !== cores[5]) || cores[4] === cores[5]) return false;
        for (const c of d.campos) { const dt = um(bloco.querySelectorAll('dt'), e => texto(e) === c.rotulo), dd = dt?.parentElement?.querySelector('dd'); if (!dd || texto(dd) !== c.valor || (!topo && !visivel(dd))) return false; }
        const lapis = painel.querySelector('button[aria-label="Editar contato"]'); if (d.ator === 'admin' ? (!visivel(lapis) || lapis.disabled) : !!lapis) return false;
    } else {
        const barras = [...area.querySelectorAll('div[title]')].filter(e => d.segmentos.includes(e.getAttribute('title')));
        if (barras.length !== 6 || barras.some((b, i) => b.getAttribute('title') !== d.segmentos[i] || !visivel(b) || Math.abs(b.getBoundingClientRect().height - 4) > .5 || !Number.isFinite(parseFloat(window.getComputedStyle(b).borderRadius)) || Math.abs(parseFloat(window.getComputedStyle(b).borderRadius) - 2) > .5)) return false;
        const cores = barras.map(b => window.getComputedStyle(b).backgroundColor); if (cores.slice(0, 3).some(c => c !== cores[2]) || cores.slice(3).some(c => c !== cores[3]) || cores[2] === cores[3]) return false;
    }
    if (app) for (const [nome, permitido] of [['Assumir conversa', d.podeAssumir], ['Marcar como perdido', d.podeMover]]) {
        const ns = [...bloco.querySelectorAll('button')].filter(b => texto(b) === nome);
        if (permitido ? ns.length !== 1 || ns[0].disabled || ns[0].getAttribute('aria-busy') === 'true' || (!topo && !visivel(ns[0])) : ns.length !== 0) return false;
    }
    const card = app ? bloco.querySelector('section[aria-label="Aula experimental"]') : um(area.querySelectorAll('span'), e => texto(e) === 'Aula experimental')?.parentElement?.parentElement;
    if (!d.experimental) return !card;
    if (!card || !bloco.contains(card) || (!topo && !visivel(card)) || !(app ? card.querySelector('svg') : card.querySelector('i')) || !texto(card).includes(d.experimental.professor)) return false;
    if (app && !um(card.querySelectorAll('h4'), e => texto(e) === 'Aula experimental')) return false;
    const icon = card.querySelector(app ? 'svg' : 'i');
    if (!(icon.getAttribute('class') ?? '').includes(app ? 'icon-tabler-calendar-check' : 'icon-calendar-check')) return false;
    const badge = um(card.querySelectorAll('span'), e => texto(e) === d.experimental.status && (topo || visivel(e)));
    if (!badge || (app && !(badge.getAttribute('class') ?? '').includes(d.experimental.status === 'Não compareceu' ? 'bg-red-50 text-red-700' : 'bg-brand-bg text-brand-700'))) return false;
    if (app) {
        const time = um(card.querySelectorAll('time'), e => e.getAttribute('datetime') === d.experimental.instante && e.getAttribute('title') === 'Horário em ' + d.experimental.fuso && texto(e) === d.experimental.quando && (topo || visivel(e)));
        if (!time || texto(time.parentElement) !== d.experimental.quando + ' · ' + d.experimental.professor) return false;
    } else if (!texto(card).includes(d.experimental.quando + ' · ' + d.experimental.professor) || !window.getComputedStyle(badge).color || window.getComputedStyle(badge).color !== window.getComputedStyle(icon).color || ['transparent', 'rgba(0, 0, 0, 0)'].includes(window.getComputedStyle(badge).backgroundColor)) return false;
    const editar = [...card.querySelectorAll('a')];
    if (d.podeAbrirFunil ? editar.length !== 1 || texto(editar[0]) !== 'Editar' || editar[0].getAttribute('href') !== d.hrefFunilAtual || (!topo && !visivel(editar[0])) : editar.length !== 0) return false;
    return true;
}
export function semanticaFechamento328() {
    const e = document.activeElement; if (!e || e === document.body || e.disabled || !e.isConnected || e.closest('[inert], [aria-hidden="true"]') || !['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT'].includes(e.tagName)) return false;
    const l = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    for (let n = e; n; n = n.parentElement) {
        const s = window.getComputedStyle(n); if (n.inert || n.hasAttribute('hidden') || s.display === 'none' || ['hidden', 'collapse'].includes(s.visibility) || Number(s.opacity) <= 0) return false;
        if (n === e) continue; const x = s.overflowX || s.overflow, y = s.overflowY || s.overflow;
        if (![x, y].some(v => ['auto', 'scroll', 'hidden', 'clip'].includes(v))) continue; const c = n.getBoundingClientRect();
        if (['auto', 'scroll', 'hidden', 'clip'].includes(x)) { l.left = Math.max(l.left, c.left + (n.clientLeft || 0)); l.right = Math.min(l.right, c.left + (n.clientLeft || 0) + (n.clientWidth || c.width)); }
        if (['auto', 'scroll', 'hidden', 'clip'].includes(y)) { l.top = Math.max(l.top, c.top + (n.clientTop || 0)); l.bottom = Math.min(l.bottom, c.top + (n.clientTop || 0) + (n.clientHeight || c.height)); }
    }
    const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top >= l.top && r.bottom <= l.bottom && r.left >= l.left && r.right <= l.right && ![...document.querySelectorAll('[aria-modal="true"]')].some(m => m.textContent.includes('Motivo da perda') && !m.inert && window.getComputedStyle(m).display !== 'none');
}
async function preencherPerda(pagina, descricao) {
    const modal = pagina.getByRole('dialog', { name: 'Marcar ' + descricao.titulo + ' como perdida', exact: true });
    await modal.getByRole('radio', { name: 'Outro', exact: true }).check();
    await modal.locator('textarea[name="observacao"]').fill(descricao.observacao);
    await pagina.waitForFunction(semanticaAcoes328, descricao);
    return async () => { await modal.getByRole('button', { name: 'Voltar', exact: true }).click(); await pagina.waitForFunction(semanticaFechamento328); };
}
/** Nenhum submit; preflight separado da coletaUI, transicao depois de corpo/DOM iniciais completos. */
export async function abrirAcoesApp328(pagina, contexto, base, config, estado, instrumentacao) {
    exigir(Object.hasOwn(ESTADOS_ACOES328, estado), 'estado328 desconhecido.');
    exigir((estado === 'painel-acoes-experimental-leitor') === (config.ator === 'leitor'), 'ator/estado328 divergente.');
    const funil = estado === 'funil-perda-referencia';
    exigir(funil || instrumentacao?.coletor && instrumentacao?.identidade, 'instrumentacao/coletor327 obrigatorios.');
    const preflight = await confirmarAcoes328(contexto, base, config); base = baseLocal(base);
    let descricao = { ...preflight.descricao, superficie: funil ? 'funil' : 'inbox', fase: funil ? 'funil' : 'detalhes' };
    await pagina.goto(base + (funil ? descricao.hrefFunilAtual : '/inbox?c=' + encodeURIComponent(config.atendimentoId)), { waitUntil: 'domcontentloaded' });
    if (!funil) await esperarHidratacaoApp(pagina);
    const observacoes = [];
    if (!funil) {
        const painel = pagina.locator('#painel-contato');
        if (!await painel.isVisible() || await painel.getAttribute('aria-hidden') === 'true') await pagina.getByRole('button', { name: 'Painel do contato', exact: true }).click();
        await painel.waitFor({ state: 'visible' }); await pagina.waitForFunction(semanticaAcoes328, descricao);
        const token = await instrumentacao.coletor.aguardar();
        const prova = { ...instrumentacao.identidade, fase: 'detalhes-inicial', atendimentoAtualId: new URL(pagina.url()).searchParams.get('c'), corpoEsperadoSha256: preflight.corpoDetalhesSha256, paginaAtiva: !pagina.isClosed(), semanticaFinal: await pagina.evaluate(semanticaAcoes328, descricao) };
        exigir(prova.semanticaFinal, 'DOM inicial falso antes da transicao.'); instrumentacao.coletor.marcarTransicao(token, prova);
        await painel.getByRole('tab', { name: 'Oportunidades', exact: true }).click(); descricao = { ...descricao, fase: 'topo' };
        await pagina.waitForFunction(semanticaAcoes328, descricao); observacoes.push({ fase: 'topo', headerBarraObservados: true, naoProvaHeaderNaFotoInferior: true });
        if (estado !== 'painel-acoes-perda') {
            await painel.getByRole('region', { name: 'Aula experimental', exact: true }).scrollIntoViewIfNeeded();
            if (descricao.podeMover) await painel.getByRole('button', { name: 'Marcar como perdido', exact: true }).scrollIntoViewIfNeeded();
            descricao = { ...descricao, fase: 'cartao' }; await pagina.waitForFunction(semanticaAcoes328, descricao);
        } else { await painel.getByRole('button', { name: 'Marcar como perdido', exact: true }).click(); descricao = { ...descricao, fase: 'perda' }; }
    } else { await pagina.waitForFunction(semanticaAcoes328, descricao); await pagina.getByRole('button', { name: 'Marcar como perdida', exact: true }).click(); descricao = { ...descricao, fase: 'perda' }; }
    const finalizar = descricao.fase === 'perda' ? await preencherPerda(pagina, descricao) : undefined;
    return { finalizar, metadados: { papelArtefato: funil ? 'APP_FUNIL_REFERENCIA_FUNCIONAL_ATUAL' : 'APP_INBOX_PRODUTO', oportunidadesPreflight: preflight, aquisicoesUI: null, descricaoEsperada: descricao, observacoesGeometria: observacoes, mutacoesProdutoSolicitadas: 0 } };
}
export function descricaoPrototipo328() {
    const segmentos = ['Novo lead', 'Qualificação', 'Aula experimental', 'Proposta', 'Negociação', 'Matrícula'];
    return { alvo: 'prototipo', superficie: 'original', fase: 'cartao', ator: 'admin', nomeCabecalho: 'Mariana Costa', produto: 'Inglês Intensivo B1 · Semestral', titulo: null, valorTexto: 'R$ 720', etapa: 'Aula experimental', podeMover: true, podeAbrirFunil: true, podeAssumir: false, hrefFunilAtual: 'Funil.dc.html', segmentos, opcoes: segmentos.map(v => ({ valor: v, rotulo: v, recusada: false })), experimental: { instante: null, fuso: null, quando: 'Qui 16/10 · 19:00', professor: 'Helena Prado', status: 'Realizada' } };
}
export async function abrirAcoesPrototipo328(pagina, estado) {
    exigir(estado === 'painel-acoes-experimental', 'PROTO somente experimental original328.');
    const descricao = descricaoPrototipo328(), url = new URL('../../docs/planejamento/inbox-prototipo/prototipo/Inbox.dc.html', import.meta.url); url.search = '?c=c1';
    await pagina.goto(url.href, { waitUntil: 'load' }); const root = pagina.locator('[data-m="root"]'); await root.waitFor({ state: 'visible' });
    const chat = root.locator('[data-m="chat"]'); if (!await chat.isVisible()) await root.getByText('Mariana Costa', { exact: true }).first().click(); await chat.waitFor({ state: 'visible' });
    const painel = root.locator('[data-m="panel"]'); if (!await painel.isVisible()) await root.getByTitle('Painel do contato', { exact: true }).first().click(); await painel.waitFor({ state: 'visible' });
    await painel.getByRole('button', { name: 'Oportunidades', exact: true }).click(); await pagina.waitForFunction(semanticaAcoes328, descricao);
    return { metadados: { papelArtefato: 'PROTO_ORIGINAL_REFERENCIA_ESTATICA', referenciaOriginal: true, descricaoEsperada: descricao, aquisicoesUI: null, limiteReferencia: 'Somente painel estatico original; sem prova de autoscroll/foco/selecao.' } };
}
