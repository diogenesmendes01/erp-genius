/** Entradas reais336; configuração explícita, sem seed ou resposta de negócio fabricada. */
export function configurarEntrada(estado, env = process.env) {
  const superficie = estado.replace(/^entrada-/, '');
  const config = { funil: ['/funil', 'o'], tarefas: ['/tarefas', 't'], contatos: ['/contatos', 'c'], agente: ['/aria', 'aba'] }[superficie];
  const rota = env['INBOX_VISUAL_' + superficie.toUpperCase()];
  const id = env.INBOX_VISUAL_ATENDIMENTO;
  if (!config || !id || !rota || !rota.startsWith('/') || rota.startsWith('//')) throw new Error('Entrada336 exige rota e atendimento explícitos.');
  const url = new URL(rota, 'http://localhost');
  if (url.origin !== 'http://localhost' || url.pathname !== config[0] || url.hash || !url.searchParams.get(config[1]) || (superficie === 'agente' && url.searchParams.get('aba') !== 'historico')) throw new Error('Rota da entrada336 não corresponde à superfície.');
  const abrir = '/inbox?c=' + encodeURIComponent(id);
  return { estado, rota, abrir, agendar: superficie === 'agente' ? null : abrir + '&agendar=1' };
}

/** Callback autocontido. Conteúdo e posição são observados, nunca sintetizados. */
export function semanticaEntradaPronta(alvo) {
  const visivel = e => {
    if (e.closest('[inert]')) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height >= 44 && r.left >= -1 && r.right <= window.innerWidth + 1 && r.top >= -1 && r.bottom <= window.innerHeight + 1;
  };
  const links = [...document.querySelectorAll('a')];
  const abrir = links.filter(e => e.textContent.trim() === 'Abrir conversa' && e.getAttribute('href') === alvo.abrir && visivel(e));
  const agendar = links.filter(e => e.textContent.trim() === 'Agendar mensagem' && visivel(e));
  return abrir.length === 1 && (alvo.agendar ? agendar.length === 1 && agendar[0].getAttribute('href') === alvo.agendar : agendar.length === 0) && document.documentElement.scrollWidth <= window.innerWidth + 1;
}

export async function abrirEntradaApp(pagina, base, alvo) {
  await pagina.goto(base + alvo.rota, { waitUntil: 'load' });
  const abrir = pagina.getByRole('link', { name: 'Abrir conversa', exact: true }).filter({ visible: true });
  await abrir.waitFor({ state: 'visible' });
  await abrir.scrollIntoViewIfNeeded();
  await pagina.waitForFunction(semanticaEntradaPronta, alvo);
  return { metadados: { entradaReal: alvo, referenciaFuncionalPrototipo: null } };
}
