import { esperarHidratacaoApp } from './espera-app.mjs';
import { instalarConclusaoMensagens } from './estados-inbox.mjs';

export const ESTADOS_DETALHES_325 = Object.freeze(['painel-detalhes-pessoa', 'painel-detalhes-b2b', 'painel-detalhes-convidado']);
export function configurarDetalhes325(estado, env = process.env) {
  const modo = { 'painel-detalhes-pessoa': 'pessoa', 'painel-detalhes-b2b': 'b2b', 'painel-detalhes-convidado': 'convidado' }[estado];
  const id = modo && env['INBOX_VISUAL_325_' + (modo === 'pessoa' ? 'PESSOA' : modo === 'b2b' ? 'B2B' : 'CONVIDADO')];
  if (!modo || typeof id !== 'string' || !id.trim()) throw new Error('Cenário325 exige ID explícito da fixture reservada.');
  const campoRestrito = modo === 'convidado' ? env.INBOX_VISUAL_325_CAMPO_RESTRITO : null;
  if (modo === 'convidado' && !campoRestrito?.trim()) throw new Error('Convidado325 exige campo restrito conhecido para prova negativa.');
  return { id, modo, campoRestrito };
}

/** Somente leitura real. O descriptor contém valores fictícios esperados, nunca resposta/headers. */
export async function confirmarDetalhes325(contexto, base, configuracao) {
  const { id, modo, campoRestrito } = configuracao;
  const caminho = `${base}/api/inbox/atendimentos/${encodeURIComponent(id)}/painel`;
  const painel = await contexto.request.get(caminho);
  if (painel.status() !== 200) throw new Error(`Preflight325 painel exige HTTP200; recebido${painel.status()}.`);
  const p = await painel.json();
  const resposta = await contexto.request.get(caminho + '/detalhes');
  if (resposta.status() !== 200) throw new Error(`Preflight325 Detalhes exige HTTP200; recebido${resposta.status()}.`);
  const d = await resposta.json();
  const b2b = modo !== 'pessoa';
  const cap = p?.cabecalho?.capacidades;
  const preenchido = v => typeof v === 'string' && !!v.trim();
  if (!['pessoa', 'b2b', 'convidado'].includes(modo) || p?.setor !== 'COMERCIAL' || !d?.pessoa || !d.oportunidade || !Array.isArray(d.campos)
    || !preenchido(d.oportunidade.id) || !preenchido(d.pessoa.id) || !preenchido(d.pessoa.nome) || !preenchido(d.pessoa.email) || !preenchido(p.cabecalho?.subtitulo)
    || typeof cap?.verContato !== 'boolean' || typeof cap?.verEmpresa !== 'boolean' || p.cabecalho.quadrado !== b2b
    || !!d.b2b !== b2b || d.oportunidade.b2b !== b2b) throw new Error('Fixture325 não comprova Pessoa/oportunidade/contexto comercial esperado.');
  if (modo === 'convidado' && (cap.verContato || cap.verEmpresa || cap.editarContato !== false || p.podeEnviar !== false || d.campos.length || !preenchido(campoRestrito))) throw new Error('Convidado325 recebeu direitos/dados além do contrato D13.');
  if (b2b && (!preenchido(d.b2b.empresa?.id) || !preenchido(d.b2b.empresa.nome) || !preenchido(d.pessoa.empresa?.documento)
    || !Array.isArray(d.b2b.participantes) || d.b2b.participantes.length < 2 || d.b2b.participantes.filter(x => x.naConversa).length !== 1)) throw new Error('Fixture325 não comprova empresa/documento/participantes distintos.');
  const participantes = b2b ? d.b2b.participantes.map(x => {
    if (!preenchido(x.pessoaId) || !preenchido(x.nome) || typeof x.naConversa !== 'boolean' || !(x.hrefConversa === null || /^\/inbox\?c=[^&#?]+$/.test(x.hrefConversa))) throw new Error('Destino B2B325 inválido ou não autorizado pelo produtor.');
    return { pessoaId: x.pessoaId, nome: x.nome, naConversa: x.naConversa, hrefConversa: x.hrefConversa };
  }) : [];
  const formatarCampo = c => c.valor === null || c.valor === '' ? '—' : typeof c.valor === 'boolean' ? c.valor ? 'Sim' : 'Não' : c.tipo === 'DATA' && /^\d{4}-\d{2}-\d{2}$/.test(c.valor) ? c.valor.split('-').reverse().join('/') : String(c.valor);
  const textos = [d.pessoa.email, d.oportunidade.produto ?? d.oportunidade.titulo, ...(b2b ? [d.b2b.empresa.nome, d.pessoa.cargo, d.pessoa.empresa.documento, d.pessoa.empresa.segmentoMercado, d.pessoa.empresa.porte, d.pessoa.empresa.site ?? d.pessoa.linkedin, 'Documento da empresa'] : [d.pessoa.cidade]), ...d.campos.flatMap(c => [c.nome, formatarCampo(c)])].filter(preenchido);
  return { modo, nomeCabecalho: b2b ? d.b2b.empresa.nome : d.pessoa.nome, subtitulo: p.cabecalho.subtitulo, quadrado: b2b, textos,
    fichaHref: cap.verContato ? '/contatos?c=' + encodeURIComponent(d.pessoa.id) : null,
    empresaHref: b2b && cap.verEmpresa ? '/empresas/' + encodeURIComponent(d.b2b.empresa.id) : null,
    oportunidadeHref: "/funil?o=" + encodeURIComponent(d.oportunidade.id), participantes, campoRestrito: modo === 'convidado' ? campoRestrito : null, marcaCampoAria: d.campos.some(c => c.ia === true) };
}

/** Callback autocontido; nenhum DOM/CSS é alterado para tornar a prova positiva. */
export function semanticaDetalhes325Pronto(esperado) {
  const paineis = [...document.querySelectorAll('#painel-contato')];
  if (paineis.length !== 1 || document.documentElement.scrollWidth > window.innerWidth + 1) return false;
  const painel = paineis[0], r = painel.getBoundingClientRect();
  if (painel.inert || painel.closest('[inert]') || r.width <= 0 || r.height <= 0 || r.left < -1 || r.right > window.innerWidth + 1 || r.top < -1 || r.bottom > window.innerHeight + 1 || painel.getAnimations().some(a => a.playState === 'running') || painel.querySelector('[role="alert"],[aria-busy="true"]')) return false;
  const header = painel.querySelector('[data-cabecalho-contato]');
  const avatar = header?.querySelector(':scope > span');
  const caixaAvatar = avatar?.getBoundingClientRect();
  if (header?.querySelector('h2')?.textContent.trim() !== esperado.nomeCabecalho || header?.querySelector(':scope > p')?.textContent.trim() !== esperado.subtitulo
    || !caixaAvatar || Math.abs(caixaAvatar.width - 132) > .5 || Math.abs(caixaAvatar.height - 132) > .5
    || !avatar.getAttribute('class')?.includes(esperado.quadrado ? 'rounded-[34px]' : 'rounded-full')) return false;
  const abas = [...painel.querySelectorAll('[role="tab"]')];
  if (abas.length !== 1 || abas[0].textContent.trim() !== 'Detalhes' || abas[0].getAttribute('aria-selected') !== 'true') return false;
  const corpo = painel.querySelector('[role="tabpanel"]');
  if (!corpo?.textContent.includes('Oportunidade atual') || !esperado.textos.every(t => corpo.textContent.includes(t)) || (esperado.campoRestrito && corpo.textContent.includes(esperado.campoRestrito))) return false;
  if (!!corpo.querySelector('[aria-label="Preenchido pela Aria"]') !== esperado.marcaCampoAria) return false;
  const links = [...corpo.querySelectorAll('a')];
  const hrefs = links.map(a => a.getAttribute('href'));
  const cartoes = links.filter(a => a.textContent.includes('Oportunidade atual'));
  if (cartoes.length !== 1 || cartoes[0].getAttribute('href') !== esperado.oportunidadeHref) return false;
  const fichas = hrefs.filter(h => h?.startsWith('/contatos?c='));
  const empresas = hrefs.filter(h => h?.startsWith('/empresas/'));
  if (JSON.stringify(fichas) !== JSON.stringify(esperado.fichaHref ? [esperado.fichaHref] : []) || JSON.stringify(empresas) !== JSON.stringify(esperado.empresaHref ? [esperado.empresaHref] : [])) return false;
  const falar = links.filter(a => a.textContent.trim() === 'Falar com').map(a => a.getAttribute('href')).sort();
  const autorizados = esperado.participantes.filter(p => !p.naConversa && p.hrefConversa).map(p => p.hrefConversa).sort();
  if (JSON.stringify(falar) !== JSON.stringify(autorizados)) return false;
  return esperado.participantes.every(p => corpo.textContent.includes(p.nome)) && (esperado.participantes.some(p => p.naConversa) ? corpo.textContent.includes('Na conversa') : !corpo.textContent.includes('Na conversa'));
}

export async function abrirDetalhes325(pagina, contexto, base, configuracao) {
  const esperado = await confirmarDetalhes325(contexto, base, configuracao);
  const concluirMensagens = instalarConclusaoMensagens(pagina, base, configuracao.id);
  try {
    await pagina.goto(`${base}/inbox?c=${encodeURIComponent(configuracao.id)}`, { waitUntil: 'domcontentloaded' });
    await esperarHidratacaoApp(pagina);
    if (!(await pagina.locator('#painel-contato').isVisible())) await pagina.getByRole('button', { name: 'Painel do contato', exact: true }).click();
    await pagina.waitForFunction(semanticaDetalhes325Pronto, esperado);
    await concluirMensagens();
    return { metadados: { detalhes325: esperado } };
  } catch (erro) { await concluirMensagens(); throw erro; }
}

/** Referência original c1/c2; abre somente UI local, sem editar dados/HTML do protótipo. */
export async function abrirPrototipoDetalhes325(pagina, url, estado) {
  const b2b = estado === 'painel-detalhes-b2b';
  if (!['painel-detalhes-pessoa', 'painel-detalhes-b2b'].includes(estado)) throw new Error('Convite325 não tem referência funcional de autorização no protótipo.');
  const nome = b2b ? 'Grupo Ventura Logística' : 'Mariana Costa';
  await pagina.goto(url + '?c=' + (b2b ? 'c2' : 'c1'), { waitUntil: 'load' });
  const root = pagina.locator('[data-m="root"]'); await root.waitFor({ state: 'visible' });
  if (!(await root.locator('[data-m="chat"]').isVisible())) await root.getByText(nome, { exact: true }).first().click();
  const painel = root.locator('[data-m="panel"]');
  if (!(await painel.isVisible())) await root.getByTitle('Painel do contato', { exact: true }).first().click();
  await painel.waitFor({ state: 'visible' });
  await painel.getByText(nome, { exact: true }).first().waitFor({ state: 'visible' });
  await painel.getByText('Oportunidade atual', { exact: true }).waitFor({ state: 'visible' });
  if (b2b) await painel.getByText('Contatos nesta oportunidade', { exact: true }).waitFor({ state: 'visible' });
  await painel.getByText('Detalhes', { exact: true }).waitFor({ state: 'visible' });
}
