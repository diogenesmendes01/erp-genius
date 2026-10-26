import { createHash } from 'node:crypto';
/** Hash JSON canonico sem reter corpo, cookies ou dados de autenticacao. */
export function hashCorpoPainel327(corpo) {
    if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo))
        throw new Error('Corpo Painel327 invalido.');
    const ordenar = v => Array.isArray(v) ? v.map(ordenar) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, ordenar(v[k])])) : v;
    return createHash('sha256').update(JSON.stringify(ordenar(corpo))).digest('hex');
}
/** Protocolo proprio327: Details inicial completo+DOM -> transicao explicita -> Oportunidades. */
export function instalarColetorOportunidades327(pagina, identidade, { timeoutMs = 30000 } = {}) {
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000)
        throw new Error('Timeout327 invalido.');
    const chaves = ['base', 'contextoId', 'paginaId', 'atendimentoId', 'oportunidadeId', 'pessoaId', 'usuarioId'];
    if (!identidade || !chaves.every(k => typeof identidade[k] === 'string' && identidade[k].trim()))
        throw new Error('Identidade327 incompleta.');
    const u = new URL(identidade.base);
    if (u.origin !== identidade.base || u.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(u.hostname) || !u.port || u.username || u.password)
        throw new Error('Base327 invalida.');
    const dono = Object.freeze(Object.fromEntries(chaves.map(k => [k, identidade[k]])));
    const raiz = dono.base + '/api/inbox/atendimentos/' + encodeURIComponent(dono.atendimentoId) + '/painel/';
    const tipo = q => q.method() !== 'GET' ? null : q.url() === raiz + 'detalhes' ? 'detalhes-inicial' : q.url() === raiz + 'oportunidades' ? 'oportunidades' : null;
    const entradas = new Map(), tarefas = new Set(), tokens = new WeakSet(), violacoes = new Set(), listeners = [];
    let ordem = 0, versao = 0, fase = 'detalhes-inicial', transicaoOrdem = null, provaDetalhes = null, provaFinal = null, selado = false, fechado = false, encerrado = false;
    const violar = c => violacoes.add(c);
    const pendentes = () => [...entradas.values()].filter(e => !e.settled || e.processando).length;
    const alterar = (ev, r) => { versao++; if (selado)
        violar(ev + '_APOS_SELO:' + r.ordem); if (fase === 'oportunidades' && r.tipo === 'detalhes-inicial')
        violar(ev + '_DETALHES_APOS_TRANSICAO:' + r.ordem); };
    const ouvir = (ev, f) => { pagina.on(ev, f); listeners.push([ev, f]); };
    const obter = (q, ev) => { const e = entradas.get(q); if (!e)
        violar(ev + '_SEM_START'); return e; };
    const concluir = e => { if (!e.settled) {
        e.settled = true;
        e.resolver();
    } };
    ouvir('request', q => { const n = ++ordem, t = tipo(q); if (!t)
        return; if (entradas.has(q)) {
        violar('START_DUPLICADO');
        return;
    } let resolver; const done = new Promise(r => resolver = r); const registro = { ...dono, tipo: t, ordem: n, method: 'GET', url: q.url(), headersObservados: false, corpoConcluido: false }; try {
        if (q.frame().page() !== pagina)
            violar('START_OUTRA_PAGINA');
    }
    catch {
        violar('START_SEM_PAGINA');
    } entradas.set(q, { registro, done, resolver, settled: false, lendo: false, processando: false }); alterar('START', registro); if (t === 'oportunidades' && fase !== 'oportunidades')
        violar('OPORTUNIDADES_ANTES_TRANSICAO'); if (fechado)
        violar('START_APOS_FECHAMENTO'); });
    ouvir('response', r => { const q = r.request(); if (!tipo(q))
        return; const e = obter(q, 'HEADERS'); if (!e)
        return; if (e.registro.headersObservados)
        violar('HEADERS_DUPLICADOS'); alterar('HEADERS', e.registro); e.registro.headersObservados = true; e.registro.status = r.status(); });
    ouvir('requestfailed', q => { if (!tipo(q))
        return; const e = obter(q, 'FAILURE'); if (!e)
        return; if (e.settled || e.lendo)
        violar('FAILURE_DUPLICADA_OU_APOS_FINISHED'); alterar('FAILURE', e.registro); e.registro.erro = q.failure()?.errorText ?? 'falha-sem-codigo'; e.registro.corpoConcluido = false; concluir(e); });
    ouvir('requestfinished', q => { if (!tipo(q))
        return; const e = obter(q, 'FINISHED'); if (!e)
        return; alterar('FINISHED', e.registro); if (e.lendo || e.settled) {
        violar('FINISHED_DUPLICADO_OU_APOS_FAILURE');
        return;
    } e.lendo = true; e.processando = true; const tarefa = (async () => { try {
        const r = await q.response();
        if (!r || await r.finished() !== null)
            throw Error('Corpo incompleto');
        const hash = hashCorpoPainel327(await r.json());
        if (!e.registro.erro) {
            e.registro.corpoSha256 = hash;
            e.registro.corpoConcluido = true;
        }
    }
    catch {
        e.registro.erro = e.registro.erro ?? 'corpo-invalido-ou-interrompido';
        e.registro.corpoConcluido = false;
    }
    finally {
        alterar('BODY_SETTLED', e.registro);
        concluir(e);
    } })(); tarefas.add(tarefa); void tarefa.finally(() => { tarefas.delete(tarefa); e.processando = false; versao++; }); });
    ouvir('close', () => { fechado = true; if (pendentes())
        violar('FECHAMENTO_COM_PENDENTES'); });
    async function prazo(p, limite) { let timer; try {
        return await Promise.race([p, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Timeout da barreira327.')), Math.max(0, limite - Date.now())); })]);
    }
    finally {
        clearTimeout(timer);
    } }
    async function aguardar(ms = timeoutMs) { const limite = Date.now() + ms; try {
        for (;;) {
            const v = versao, ps = [...entradas.values()].filter(e => !e.settled).map(e => e.done).concat([...tarefas]);
            if (ps.length)
                await prazo(Promise.all(ps), limite);
            await prazo(new Promise(r => setImmediate(r)), limite);
            if (pendentes() === 0 && v === versao) {
                const t = Object.freeze({ versao, iniciados: entradas.size, pendentes: 0 });
                tokens.add(t);
                return t;
            }
        }
    }
    catch (e) {
        violar('TIMEOUT_BARREIRA');
        throw e;
    } }
    const registros = () => [...entradas.values()].map(e => ({ ...e.registro, settled: e.settled }));
    const valida = (p, f) => p && chaves.every(k => p[k] === dono[k]) && p.fase === f && p.atendimentoAtualId === dono.atendimentoId && p.paginaAtiva === true && p.semanticaFinal === true && /^[a-f0-9]{64}$/.test(p.corpoEsperadoSha256 ?? '');
    function avaliarTipo(t, p, rs) { const falhas = [], diagnosticos = [], alvos = rs.filter(r => r.tipo === t); if (!valida(p, t))
        falhas.push('PROVA_' + t + '_INVALIDA'); if (!alvos.length)
        falhas.push('SEM_START_' + t); for (const r of alvos) {
        if (!r.settled) {
            falhas.push('REQUEST_PENDENTE:' + r.ordem);
            continue;
        }
        if (r.erro) {
            const substitutos = alvos.filter(s => r.erro === 'net::ERR_ABORTED' && (!r.headersObservados || r.status === 200) && Number.isInteger(r.ordem) && s.ordem > r.ordem && s.settled && !s.erro && s.headersObservados && s.status === 200 && s.corpoConcluido && s.corpoSha256 === p?.corpoEsperadoSha256 && (t !== 'detalhes-inicial' || (transicaoOrdem === null || s.ordem <= transicaoOrdem)));
            if (valida(p, t) && substitutos.length)
                diagnosticos.push({ tipo: 'GET327 recuperado', endpoint: t, inicioAbortado: r.ordem, iniciosSubstitutos: substitutos.map(s => s.ordem), corpoSha256: p.corpoEsperadoSha256 });
            else
                falhas.push('GET_FALHOU:' + t + ':' + r.ordem + ':' + r.erro);
        }
        else if (!r.headersObservados || r.status !== 200 || !r.corpoConcluido || r.corpoSha256 !== p?.corpoEsperadoSha256)
            falhas.push('HEADERS_BODY_HASH_INVALIDO:' + t + ':' + r.ordem);
    } return { falhas, diagnosticos }; }
    function tokenValido(t, p, f) { return tokens.has(t) && t.versao === versao && !pendentes() && !pagina.isClosed() && valida(p, f); }
    function marcarTransicao(token, p) { if (fase !== 'detalhes-inicial' || !tokenValido(token, p, 'detalhes-inicial')) {
        violar('TRANSICAO_INVALIDADA');
        throw new Error('Transicao327 invalidada.');
    } const a = avaliarTipo('detalhes-inicial', p, registros()); if (violacoes.size || a.falhas.length) {
        violar('DETALHES_INICIAL_FALHOU');
        throw new Error('Detalhes inicial327 contem falha.');
    } provaDetalhes = { ...p }; transicaoOrdem = ordem; fase = 'oportunidades'; versao++; }
    function avaliar() { const rs = registros(), a = avaliarTipo('detalhes-inicial', provaDetalhes, rs), b = avaliarTipo('oportunidades', provaFinal, rs); const falhas = [...violacoes, ...a.falhas, ...b.falhas]; if (!selado)
        falhas.push('SEM_SELO'); if (!provaDetalhes || transicaoOrdem === null)
        falhas.push('SEM_TRANSICAO'); if (pendentes())
        falhas.push('PENDENTES_NAO_ZERADOS'); return { falhas: [...new Set(falhas)], diagnosticos: [...a.diagnosticos, ...b.diagnosticos], iniciados: entradas.size, settled: rs.filter(r => r.settled).length, pendentes: pendentes(), selado, fechado, fase, transicaoOrdem, registros: rs, aquisicoesUI: { detalhes: rs.filter(r => r.tipo === 'detalhes-inicial').length, oportunidades: rs.filter(r => r.tipo === 'oportunidades').length } }; }
    function selar(token, p) { if (fase !== 'oportunidades' || !tokenValido(token, p, 'oportunidades')) {
        violar('SELO_INVALIDADO');
        throw new Error('Selo327 invalidado.');
    } provaFinal = { ...p }; selado = true; if (avaliar().falhas.length)
        throw new Error('Coleta327 contem falha sem recuperacao.'); }
    async function auditarFechamento() { if (!pagina.isClosed() || !fechado)
        throw new Error('Pagina precisa estar fechada327.'); try {
        await aguardar(Math.min(timeoutMs, 3000));
    }
    catch { /* timeout permanece negativo */ } return avaliar(); }
    async function encerrar() { const browser = pagina.context().browser(); if (!browser || browser.isConnected())
        throw new Error('Browser precisa estar fechado327.'); const r = await auditarFechamento(); for (const [ev, f] of listeners)
        pagina.off(ev, f); encerrado = true; return { ...r, browserFechado: true, aceitavel: r.falhas.length === 0 && r.pendentes === 0 }; }
    return { aguardar, marcarTransicao, selar, auditarFechamento, encerrar, acompanha: q => entradas.has(q), estado: () => ({ iniciados: entradas.size, pendentes: pendentes(), versao, fase, selado, fechado, encerrado }) };
}
/** Somente este resultado depois de browser.close pode liberar a candidata327. */
export async function finalizarCapturasOportunidades327(entradas) { for (const { coletor, captura } of entradas) {
    let r;
    try {
        r = await coletor.encerrar();
    }
    catch {
        r = { ...coletor.estado(), falhas: ['AUDITORIA_FINAL327_NAO_CONFIRMADA'], diagnosticos: [], browserFechado: false, aceitavel: false, aquisicoesUI: null };
    }
    if (!captura)
        continue;
    captura.falhas = [...new Set([...captura.falhas, ...r.falhas])];
    captura.diagnosticos.push(...r.diagnosticos);
    captura.coletaOportunidades = r;
    captura.aquisicoesUI = r.aquisicoesUI;
    captura.aceiteCandidato = r.aceitavel && captura.falhas.length === 0;
} }
