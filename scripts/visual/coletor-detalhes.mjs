import { hashCorpoDetalhes325, cancelamentoDetalhes325Recuperado } from './detalhes-inbox.mjs';

/** Coleta desde START; listeners sobrevivem a context.close e só saem após browser.close+auditoria. */
export function instalarColetorDetalhes325(pagina, identidade, { timeoutMs = 30000 } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw new Error('Timeout de coleta325 inválido.');
  const dono = Object.freeze({ base: identidade.base, contextoId: identidade.contextoId, paginaId: identidade.paginaId, atendimentoId: identidade.atendimentoId });
  const url = dono.base + '/api/inbox/atendimentos/' + encodeURIComponent(dono.atendimentoId) + '/painel/detalhes';
  const entradas = new Map(), tarefas = new Set(), tokens = new WeakSet(), violacoes = new Set(), listeners = [];
  let ordinal = 0, versao = 0, selado = false, fechado = false, encerrado = false, provaSelada = null;
  const exato = q => q.method() === 'GET' && q.url() === url;
  const pendentes = () => [...entradas.values()].filter(e => !e.settled || e.processando).length;
  const violar = codigo => violacoes.add(codigo);
  const alterar = (evento, registro) => { versao++; if (selado) violar(`${evento}_APOS_SELO:${registro?.ordem ?? 'sem-start'}`); };
  const ouvir = (evento, fn) => { pagina.on(evento, fn); listeners.push([evento, fn]); };
  const obter = (q, evento) => {
    const e = entradas.get(q);
    if (!e) violar(`${evento}_SEM_START`);
    return e;
  };
  function concluir(e) { if (!e.settled) { e.settled = true; e.resolver(); } }
  ouvir('request', q => {
    const ordem = ++ordinal;
    if (!exato(q)) return;
    if (entradas.has(q)) { violar('START_DUPLICADO'); return; }
    let resolver;
    const done = new Promise(r => { resolver = r; });
    const registro = { ...dono, ordem, method: 'GET', url, headersObservados: false, corpoConcluido: false };
    try { if (q.frame().page() !== pagina) violar('START_OUTRA_PAGINA'); } catch { violar('START_SEM_IDENTIDADE_PAGINA'); }
    entradas.set(q, { registro, done, resolver, settled: false, lendo: false, processando: false });
    alterar('START', registro);
    if (fechado) violar('START_APOS_FECHAMENTO');
  });
  ouvir('response', r => {
    const q = r.request(); if (!exato(q)) return;
    const e = obter(q, 'HEADERS'); if (!e) return;
    alterar('HEADERS', e.registro); e.registro.headersObservados = true; e.registro.status = r.status();
  });
  ouvir('requestfailed', q => {
    if (!exato(q)) return;
    const e = obter(q, 'FAILURE'); if (!e) return;
    alterar('FAILURE', e.registro); e.registro.erro = q.failure()?.errorText ?? 'falha-sem-codigo'; e.registro.corpoConcluido = false;
    concluir(e);
  });
  ouvir('requestfinished', q => {
    if (!exato(q)) return;
    const e = obter(q, 'FINISHED'); if (!e) return;
    alterar('FINISHED', e.registro);
    if (e.lendo || e.settled) { violar('FINISHED_DUPLICADO_OU_APOS_FAILURE'); return; }
    e.lendo = true; e.processando = true;
    const tarefa = (async () => {
      try {
        const r = await q.response();
        if (!r || await r.finished() !== null) throw new Error('Corpo não concluiu.');
        const hash = hashCorpoDetalhes325(await r.json());
        if (!e.registro.erro) { e.registro.corpoSha256 = hash; e.registro.corpoConcluido = true; }
      } catch { e.registro.erro = e.registro.erro ?? 'corpo-invalido-ou-interrompido'; e.registro.corpoConcluido = false; }
      finally { alterar('BODY_SETTLED', e.registro); concluir(e); }
    })();
    tarefas.add(tarefa); void tarefa.finally(() => { tarefas.delete(tarefa); e.processando = false; versao++; });
  });
  ouvir('close', () => { fechado = true; if (pendentes()) violar('FECHAMENTO_COM_PENDENTES'); });

  async function comPrazo(promessa, limite) {
    let timer;
    try { return await Promise.race([promessa, new Promise((_, rejeitar) => { timer = setTimeout(() => rejeitar(new Error('Timeout da barreira GETDetalhes325.')), Math.max(0, limite - Date.now())); })]); }
    finally { clearTimeout(timer); }
  }
  async function aguardar(prazo = timeoutMs) {
    const limite = Date.now() + prazo;
    try {
      for (;;) {
        const atual = versao;
        const promessas = [...entradas.values()].filter(e => !e.settled).map(e => e.done).concat([...tarefas]);
        if (promessas.length) await comPrazo(Promise.all(promessas), limite);
        // Inclui STARTs/callbacks que chegaram enquanto o snapshot de promessas anterior era aguardado.
        await comPrazo(new Promise(r => setImmediate(r)), limite);
        if (pendentes() === 0 && versao === atual) { const token = Object.freeze({ versao, iniciados: entradas.size, pendentes: 0 }); tokens.add(token); return token; }
      }
    } catch (e) { violar('TIMEOUT_BARREIRA'); throw e; }
  }
  function provaValida(prova) {
    return prova && Object.keys(dono).every(k => prova[k] === dono[k]) && prova.atendimentoAtualId === dono.atendimentoId
      && prova.paginaAtiva === true && prova.semanticaFinal === true && /^[a-f0-9]{64}$/.test(prova.corpoEsperadoSha256 ?? '');
  }
  function avaliar(prova) {
    const falhas = [...violacoes], diagnosticos = [];
    const registros = [...entradas.values()].map(e => ({ ...e.registro, settled: e.settled }));
    if (!selado) falhas.push('SEM_SELO');
    if (!provaValida(prova)) falhas.push('PROVA_FINAL_INVALIDA');
    if (!registros.length) falhas.push('SEM_START_DETALHES');
    if (pendentes()) falhas.push('PENDENTES_NAO_ZERADOS');
    for (const r of registros) {
      if (!r.settled) { falhas.push('REQUEST_PENDENTE:' + r.ordem); continue; }
      if (r.erro) {
        if (cancelamentoDetalhes325Recuperado(r, registros, prova)) diagnosticos.push({ tipo: 'GETDetalhes325 recuperado', inicioAbortado: r.ordem, iniciosSubstitutos: registros.filter(s => cancelamentoDetalhes325Recuperado(r, [s], prova)).map(s => s.ordem), corpoSha256: prova.corpoEsperadoSha256 });
        else falhas.push('GET_DETALHES_FALHOU:' + r.ordem + ':' + r.erro);
      } else if (!r.headersObservados || r.status !== 200 || !r.corpoConcluido || r.corpoSha256 !== prova?.corpoEsperadoSha256) falhas.push('HEADERS_BODY_OU_HASH_INVALIDO:' + r.ordem);
    }
    return { falhas: [...new Set(falhas)], diagnosticos, iniciados: entradas.size, settled: registros.filter(r => r.settled).length, pendentes: pendentes(), selado, fechado, registros };
  }
  function selar(token, prova) {
    if (!tokens.has(token) || token.versao !== versao || pendentes() || pagina.isClosed() || !provaValida(prova)) { violar('SELO_INVALIDADO'); throw new Error('Selo325 invalidado por evento/pedido pendente ou prova inválida.'); }
    provaSelada = { ...prova }; selado = true;
    if (avaliar(provaSelada).falhas.length) throw new Error('Coleta325 contém falha sem recuperação.');
  }
  async function auditarFechamento() {
    if (!pagina.isClosed() || !fechado) throw new Error('Página/contexto precisam estar fechados antes da auditoria325.');
    try { await aguardar(Math.min(timeoutMs, 3000)); } catch { /* o timeout permanece como falha conservadora */ }
    return avaliar(provaSelada);
  }
  async function encerrar() {
    const browser = pagina.context().browser();
    if (!browser || browser.isConnected()) throw new Error('Browser precisa estar fechado antes do veredito325.');
    const resultado = await auditarFechamento();
    // Transporte encerrado, todos os STARTs auditados e pendências verificadas: nenhum listener é removido antes.
    for (const [evento, fn] of listeners) pagina.off(evento, fn);
    encerrado = true;
    return { ...resultado, browserFechado: true, aceitavel: resultado.falhas.length === 0 && resultado.pendentes === 0 };
  }
  return { aguardar, selar, auditarFechamento, encerrar, estado: () => ({ iniciados: entradas.size, pendentes: pendentes(), versao, selado, fechado, encerrado }) };
}

/** É esta auditoria após browser.close que libera ou rejeita cada candidata. */
export async function finalizarCapturasDetalhes325(entradas) {
  for (const { coletor, captura } of entradas) {
    let resultado;
    try { resultado = await coletor.encerrar(); }
    catch { resultado = { ...coletor.estado(), falhas: ["AUDITORIA_FINAL_NAO_CONFIRMADA"], diagnosticos: [], browserFechado: false, aceitavel: false }; }
    if (!captura) continue;
    captura.falhas = [...new Set([...captura.falhas, ...resultado.falhas])];
    captura.diagnosticos.push(...resultado.diagnosticos);
    captura.coletaDetalhes = resultado;
    captura.aceiteCandidato = resultado.aceitavel && captura.falhas.length === 0;
  }
}
