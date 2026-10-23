
/** Intercepta só o GET inicial exato. Uma resposta real não injetada nunca vira diagnóstico esperado. */
export async function instalarErroEstado(contexto, base, id, estado) {
  const pedidos = new WeakSet(), diagnosticos = [];
  const tipo = estado === 'painel-erro' ? 'painel' : estado === 'thread-erro' ? 'mensagens' : null;
  if (tipo) {
    const caminho = `/api/inbox/atendimentos/${encodeURIComponent(id)}/${tipo}`;
    await contexto.route(u => u.origin === base && u.pathname === caminho && !u.search, async rota => {
      const pedido = rota.request();
      if (pedido.method() !== 'GET') return rota.fallback();
      pedidos.add(pedido);
      diagnosticos.push({ tipo: '500-controlado-exato', metodo: 'GET', caminho });
      return rota.fulfill({ status: 500, contentType: 'text/plain', headers: {'cache-control':'no-store'}, body: 'Falha controlada privada da captura319.' });
    });
  }
  return { diagnosticos, respostaEsperada: resposta => resposta.status() === 500 && pedidos.has(resposta.request()) };
}

/** Callback autocontido para evaluate/waitForFunction; nenhuma alteração de conteúdo/estilo. */
export function semanticaEstado319Pronto(estado) {
  const visivel = e => {
    if (!e || e.inert || e.closest('[inert]')) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.left >= -1 && r.right <= window.innerWidth + 1 && r.top >= -1 && r.bottom <= window.innerHeight + 1;
  };
  if (estado === 'carregando') {
    const anuncios = [...document.querySelectorAll('[role="status"]')].filter(e => e.textContent.trim() === 'Carregando conversas');
    const root = anuncios[0]?.parentElement;
    return anuncios.length === 1 && root?.getAttribute('aria-busy') === 'true' && visivel(root) && root.querySelectorAll('[data-esqueleto="titulo"]').length === 1;
  }
  const painel = document.querySelector('#painel-contato');
  if (estado === 'sem-selecao') {
    const lista = document.querySelector('section[aria-label="Conversas"]'), conversa = document.querySelector('section[aria-label="Conversa"]');
    const texto = conversa?.textContent ?? '';
    return !painel && visivel(lista) && texto.includes('Escolha uma conversa') && texto.includes('As mensagens aparecem aqui.') && (window.innerWidth >= 960 ? visivel(conversa) : conversa?.getBoundingClientRect().width === 0);
  }
  if (estado === 'painel-vazio') return visivel(painel) && painel.textContent.includes('Sem oportunidade visível para você.') && !painel.querySelector('[role="alert"],[aria-busy="true"]');
  const regiao = estado === 'painel-erro' ? painel : document.querySelector('section[aria-label="Conversa"]');
  if (!visivel(regiao)) return false;
  const publico = estado === 'painel-erro' ? 'Não foi possível carregar os detalhes.' : 'Não foi possível carregar as mensagens.';
  const alerta = [...regiao.querySelectorAll('[role="alert"]')].find(e => e.textContent.includes(publico));
  const retry = alerta && [...alerta.querySelectorAll('button')].find(e => e.textContent.trim() === 'Tentar de novo');
  return visivel(alerta) && visivel(retry) && !retry.disabled && !/ErroFonte|\/api\/|HTTP|500|Falha controlada/i.test(alerta.textContent);
}

import {esperarHidratacaoApp} from './espera-app.mjs';

/** Loading.tsx real sob latência local; a hidratação do Inbox só é aguardada após a foto. */
export async function abrirCarregandoApp(pagina, contexto, base) {
  await pagina.goto(base + '/home', {waitUntil:'load'});
  await pagina.getByLabel('Navegação principal', {exact:true}).waitFor({state:'attached'});
  await pagina.waitForFunction(() => typeof window.next?.router?.push === 'function');
  const documento = await pagina.evaluate(() => performance.timeOrigin);
  const cdp = await contexto.newCDPSession(pagina);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {offline:false,latency:3000,downloadThroughput:5000000,uploadThroughput:5000000});
  await pagina.evaluate(() => window.next.router.push('/inbox?busca=319-carregando-' + Date.now()));
  await pagina.waitForFunction(semanticaEstado319Pronto, 'carregando');
  return async () => {
    await cdp.send('Network.emulateNetworkConditions', {offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
    await cdp.detach();
    await esperarHidratacaoApp(pagina);
    if (await pagina.evaluate(() => performance.timeOrigin) !== documento) throw new Error('Loading319 sofreu navegação de documento.');
  };
}

/** Certifica o corpo real autorizado; jamais transforma erro de transporte em vazio. */
export async function confirmarPainelVazio(contexto, base, id) {
  const resposta = await contexto.request.get(`${base}/api/inbox/atendimentos/${encodeURIComponent(id)}/painel`);
  if (resposta.status() !== 200) throw new Error(`Ausência legítima exige GET real200; recebido${resposta.status()}.`);
  const dado = await resposta.json();
  if (!dado || dado.setor !== 'COMERCIAL' || dado.oportunidade !== null) throw new Error('Fixture não comprova ausência legítima autorizada.');
  return {status:200,setor:dado.setor,oportunidade:null};
}

/** Observa somente corpos finitos já iniciados; não muda status nem a política de cancelamentos. */
export function instalarConclusaoMensagens(pagina, base, id) {
  const url = base + '/api/inbox/atendimentos/' + encodeURIComponent(id) + '/mensagens';
  const pendentes = new Set();
  const registrar = pedido => {
    if (pedido.method() !== 'GET' || pedido.url() !== url) return;
    const conclusao = pedido.response().then(resposta => resposta?.finished()).catch(() => undefined);
    pendentes.add(conclusao);
    void conclusao.finally(() => pendentes.delete(conclusao));
  };
  pagina.on('request', registrar);
  return async () => {
    // O veredito considera os requests iniciados até aqui, não SSE ou novas consultas futuras.
    pagina.off('request', registrar);
    let timer;
    try {
      await Promise.race([
        Promise.all([...pendentes]),
        new Promise((_, rejeitar) => { timer = setTimeout(() => rejeitar(new Error('Conclusão das mensagens excedeu30000ms.')), 30000); }),
      ]);
    } finally { clearTimeout(timer); }
  };
}
