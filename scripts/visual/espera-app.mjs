/** Login HTTP no mesmo contexto do browser: evita clicar num formulário ainda sem hidratação React. */
export async function autenticarApp(contexto, base, email, senha) {
  const csrf = await contexto.request.get(`${base}/api/auth/csrf`);
  if (!csrf.ok()) throw new Error(`CSRF da demo indisponível: HTTP ${csrf.status()}`);
  const { csrfToken } = await csrf.json();
  if (!csrfToken) throw new Error("CSRF da demo ausente.");
  const login = await contexto.request.post(`${base}/api/auth/callback/credentials`, {
    form: { csrfToken, email, senha, callbackUrl: `${base}/inbox` },
  });
  if (login.status() >= 400) throw new Error(`Login da demo falhou: HTTP ${login.status()}`);
  const sessao = await contexto.request.get(`${base}/api/auth/session`);
  if (!sessao.ok() || (await sessao.json()).user?.email !== email) throw new Error("Sessão da demo não foi autenticada.");
}

/** O conteúdo pode vir de SSR; a conexão só acontece após a assinatura cliente hidratar. */
export async function esperarHidratacaoApp(pagina) {
  await pagina.locator('[data-conectado="1"]').waitFor({ state: "visible" });
}

/** Espera o conteúdo identificável da fixture, não somente o contêiner inicial da tela. */
export async function esperarConteudoApp(pagina, estado, tamanho) {
  if (estado === "busca-conversa") {
    await pagina.locator('input[aria-label="Buscar na conversa"]').waitFor({ state: "visible" });
    await pagina.waitForFunction(semanticaBuscaConversaPronta);
    return;
  }
  if (estado === "menu-mais") {
    await pagina.getByRole("menu", { name: "Mais ações da conversa", exact: true }).waitFor({ state: "visible" });
    await pagina.waitForFunction(semanticaMenuConversaPronto);
    return;
  }
  const tituloColuna = { filtros: "Filtrar conversas", "seletor-numero": "Ver conversas de", "nova-conversa": "Nova conversa" }[estado];
  if (tituloColuna) {
    const dialogo = pagina.getByRole("dialog", { name: tituloColuna, exact: true });
    await dialogo.waitFor({ state: "visible" });
    if (estado === "filtros") {
      await dialogo.getByRole("group", { name: "Setor", exact: true }).waitFor({ state: "visible" });
      await dialogo.getByRole("group", { name: "Status", exact: true }).waitFor({ state: "visible" });
      await dialogo.getByRole("button", { name: "Mostrar conversas", exact: true }).waitFor({ state: "visible" });
    } else if (estado === "nova-conversa") {
      await dialogo.getByLabel(/^Finalidade e destinatário/).waitFor({ state: "visible" });
      await dialogo.getByLabel(/^Canal da escola/).waitFor({ state: "visible" });
      await dialogo.getByRole("button", { name: "Abrir atendimento", exact: true }).waitFor({ state: "visible" });
    } else await dialogo.getByRole("button", { name: "Todos os números", exact: true }).waitFor({ state: "visible" });
    await pagina.waitForFunction(semanticaPopoverColunaPronta, tituloColuna);
    return;
  }
  if (estado === "lista-vazia") {
    await pagina.getByRole("region", { name: "Conversas", exact: true }).getByText("Nenhuma conversa neste filtro.", { exact: true }).waitFor({ state: "visible" });
    await pagina.waitForFunction(() => {
      const vazio = document.querySelector('[aria-label="Conversas"] [data-estado-vazio]');
      return !!vazio && !vazio.parentElement.querySelector("button");
    });
    return;
  }
  if (["painel-detalhes", "celular-painel", "tablet-painel"].includes(estado)) {
    // A thread foi confirmada antes de abrir; na vista própria fica oculta.
    await pagina.getByRole("region", { name: "Painel Comercial", exact: true }).waitFor({ state: "visible" });
    await pagina.waitForFunction(semanticaPainelDetalhesPronto);
    return;
  }

  if (estado === "sem-selecao" || estado === "celular-lista") {
    await pagina.getByRole("region", { name: "Conversas", exact: true }).getByText("Mariana Costa", { exact: true }).waitFor({ state: "visible" });
    return;
  }
  const conversa = pagina.getByRole("region", { name: "Conversa", exact: true });
  await conversa.waitFor({ state: "visible" });
  const humano = estado === "humano-compositor" || estado === "nota";
  await conversa.getByText(humano ? "Quero matricular meu filho Pedro." : "Quero saber o valor do Inglês Intensivo B1.", { exact: true }).waitFor({ state: "visible" });
  if (humano) {
    await conversa.getByRole("note").getByText("Família pediu atendimento no período da tarde.", { exact: true }).waitFor({ state: "visible" });
    await pagina.waitForFunction(semanticaThreadHumanaPronta);
  }
  if (estado === "painel-fechado") {
    await pagina.waitForFunction(() => {
      const painel = document.querySelector('aside[aria-label="Painel do contato"]');
      return !!painel && painel.getBoundingClientRect().width === 0;
    });
  } else if (tamanho === "desktop") {
    await pagina.getByRole("region", { name: "Painel Comercial", exact: true }).waitFor({ state: "visible" });
  }
}

/** Callback DOM autocontido: não libera foto de contêiner vazio/markup anterior à thread314. */
export function semanticaThreadHumanaPronta() {
  const conversa = document.querySelector('section[aria-label="Conversa"]');
  if (!conversa) return false;
  const mensagens = [...conversa.querySelectorAll('[data-mensagem-id]')];
  const status = '[title="Enviando"],[title="Enviada"],[title="Entregue"],[title="Lida"],[title="Não enviada"]';
  const autor = mensagens.some(m => [...m.querySelectorAll('span')].some(s => s.textContent?.trim() === 'Você'));
  const notas = [...conversa.querySelectorAll('[role="note"]')].filter(n => !n.closest('footer'));
  const nota = notas.some(n => n.textContent.includes('Nota interna')) && notas.every(n => n.getAttribute('data-nota-id')
    && !n.querySelector('button,[role="menu"],img,video,audio') && !n.querySelector(status));
  const dia = [...conversa.querySelectorAll('[data-virtual-key]')].some(n => n.getAttribute('data-virtual-key')?.startsWith('dia:') && n.textContent.trim());
  return autor && nota && dia && mensagens.some(m => m.querySelector(status));
}

/** O clique não pode acontecer no markupSSR antes de o React assinar a página. */
export async function abrirPopoverColunaApp(pagina, estado, tamanho) {
  if (!["filtros", "seletor-numero", "nova-conversa"].includes(estado)) throw new Error("Popover da coluna desconhecido: " + estado);
  await esperarConteudoApp(pagina, "celular-lista", tamanho);
  await esperarHidratacaoApp(pagina);
  if (estado === "seletor-numero") await pagina.getByRole("region", { name: "Conversas", exact: true }).getByRole("button", { name: /^Todos os números(?: · |$)/ }).click();
  else await pagina.getByRole("button", { name: estado === "filtros" ? "Filtros" : "Nova conversa", exact: true }).click();
}

/** Callback DOM autocontido: folha final, transição terminada e ação/rodapé dentro do viewport. */
export function semanticaPopoverColunaPronta(titulo) {
  const dialogo = [...document.querySelectorAll('[role="dialog"]')].find(d => d.getAttribute("aria-label") === titulo);
  if (!dialogo || dialogo.inert || dialogo.getAttribute("aria-hidden") === "true") return false;
  const dentro = r => r.width > 0 && r.height > 0 && r.left >= -1 && r.right <= window.innerWidth + 1 && r.top >= -1 && r.bottom <= window.innerHeight + 1;
  const area = dialogo.getBoundingClientRect();
  if (!dentro(area) || dialogo.getAnimations().some(a => a.playState === "running")) return false;
  const final = dialogo.querySelector("footer") ?? dialogo.querySelector("form button");
  if (!final) return true;
  const fim = final.getBoundingClientRect();
  return dentro(fim) && fim.top >= area.top - 1 && fim.bottom <= area.bottom + 1;
}

/** Callback DOM da fixture canônica318: setor sozinho não prova cabeçalho/tags/abas carregados. */
export function semanticaPainelDetalhesPronto() {
  const painel = document.querySelector('aside[aria-label="Painel do contato"]');
  if (!painel || painel.inert || painel.getAttribute?.("aria-hidden") === "true") return false;
  const r = painel.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0 || r.left < -1 || r.right > window.innerWidth + 1 || r.top < -1 || r.bottom > window.innerHeight + 1 || painel.getAnimations().some(a => a.playState === "running")) return false;
  const header = painel.querySelector?.('[data-cabecalho-contato]');
  if (!header || header.querySelector('h2')?.textContent?.trim() !== "Mariana Costa") return false;
  if (!["Adulto", "Inglês", "Noite"].every(t => header.textContent.includes(t)) || header.querySelector('[aria-label="Criada pela Aria"]')?.parentElement?.textContent?.trim() !== "Noite") return false;
  const avatar = header.querySelector(':scope > span')?.getBoundingClientRect();
  if (!avatar || Math.abs(avatar.width - 132) > .5 || Math.abs(avatar.height - 132) > .5) return false;
  const abas = [...painel.querySelectorAll('[role="tab"]')];
  if (abas.length !== 1 || abas[0].textContent.trim() !== "Detalhes" || abas[0].getAttribute('aria-selected') !== "true") return false;
  const fechar = [...painel.querySelectorAll('button[aria-label="Fechar painel do contato"]')];
  const botao = fechar[0]?.getBoundingClientRect();
  return fechar.length === 1 && !!botao && Math.abs(botao.width - 36) <= .5 && Math.abs(botao.height - 36) <= .5;
}

/** Abre somente depois da thread e da assinatura cliente; nunca aciona um comando. */
export async function abrirMenuConversaApp(pagina, tamanho) {
  await esperarConteudoApp(pagina, "conversa", tamanho);
  await esperarHidratacaoApp(pagina);
  await pagina.getByRole("button", { name: "Mais ações da conversa", exact: true }).click();
}
/** Callback DOM autocontido315: menu real no viewport e capacidades indisponíveis legíveis. */
export function semanticaMenuConversaPronto() {
  const header = document.querySelector('section[aria-label="Conversa"] > header');
  const menu = document.querySelector('[role="menu"][aria-label="Mais ações da conversa"]');
  if (!header || !menu || Math.abs(header.getBoundingClientRect().height - 68) > .5) return false;
  const r = menu.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0 || r.left < -1 || r.right > window.innerWidth + 1 || r.top < -1 || r.bottom > window.innerHeight + 1) return false;
  const itens = [...menu.querySelectorAll('[role="menuitem"]')];
  const busca = itens.find(i => i.textContent.includes('Buscar na conversa'));
  const bloqueio = itens.find(i => i.textContent.includes('Bloquear contato'));
  return itens.length >= 4 && !!busca && !busca.disabled && !busca.textContent.includes('Em breve') && !!bloqueio?.disabled
    && bloqueio.textContent.includes('Disponível quando o motor próprio da escola entrar em uso.');
}

/** #316: somente UI local, sem consulta extra ou ação de negócio. */
export async function abrirBuscaConversaApp(pagina, tamanho) {
 await esperarConteudoApp(pagina, "humano-compositor", tamanho);
 await esperarHidratacaoApp(pagina);
 const botao = pagina.getByRole("button", {name:"Buscar na conversa",exact:true});
 if (await botao.isVisible()) await botao.click();
 else { await pagina.getByRole("button", {name:"Mais ações da conversa",exact:true}).click(); await pagina.getByRole("menuitem", {name:"Buscar na conversa",exact:true}).click(); }
 await pagina.locator('input[aria-label="Buscar na conversa"]').fill("matricular");
}
/** Callback DOM autocontido: exige destaque/foco reais e header preservado, não só a barra montada. */
export function semanticaBuscaConversaPronta() {
 const regiao = document.querySelector('section[aria-label="Conversa"]');
 if (!regiao) return false;
 const header = regiao.querySelector("header"), campo = regiao.querySelector('input[aria-label="Buscar na conversa"]');
 if (!header || !campo || Math.abs(header.getBoundingClientRect().height - 68) > .5 || campo.value !== "matricular" || document.activeElement !== campo) return false;
 const r = campo.getBoundingClientRect(), area = regiao.getBoundingClientRect();
 return r.width > 0 && r.height > 0 && r.left >= -1 && r.right <= window.innerWidth + 1 && r.top >= -1 && r.bottom <= window.innerHeight + 1
  && area.left >= -1 && area.right <= window.innerWidth + 1 && /[1-9]\d* de [1-9]\d*/.test(regiao.querySelector('[role="status"]')?.textContent ?? "")
  && !!regiao.querySelector('[data-mensagem-id] .ring-amber-600');
}

/** #317: troca apenas a aba, depois do conteúdo e da assinatura cliente. Não envia nota. */
export async function abrirNotaConversaApp(pagina, tamanho) {
  await esperarConteudoApp(pagina, "humano-compositor", tamanho);
  await esperarHidratacaoApp(pagina);
  await pagina.getByRole("region", { name: "Conversa", exact: true }).getByRole("tab", { name: "Nota interna", exact: true }).click();
}

/** Callback DOM autocontido317: editor atual e abas/controles reais alcançáveis, sem liberar casca antiga. */
export function semanticaRodapePronto(modo) {
  if (!["responder", "nota"].includes(modo)) return false;
  const conversa = document.querySelector('section[aria-label="Conversa"]');
  const rodape = conversa?.querySelector('footer'), header = conversa?.querySelector('header');
  if (!rodape || rodape.inert || !header || Math.abs(header.getBoundingClientRect().height - 68) > .5) return false;
  const dentro = e => {
    const r = e?.getBoundingClientRect();
    return !!r && r.width > 0 && r.height > 0 && r.left >= -1 && r.right <= window.innerWidth + 1 && r.top >= -1 && r.bottom <= window.innerHeight + 1;
  };
  if (!dentro(rodape)) return false;
  const abas = [...rodape.querySelectorAll('[role="tab"]')];
  const ativa = abas.find(t => t.textContent.trim() === (modo === "nota" ? "Nota interna" : "Responder"));
  if (abas.length !== 2 || !ativa || ativa.disabled || ativa.getAttribute('aria-selected') !== 'true'
    || abas.filter(t => t.getAttribute('aria-selected') === 'true').length !== 1
    || abas.some(t => !dentro(t) || t.getBoundingClientRect().height < 44)) return false;
  const painel = rodape.querySelector('[role="tabpanel"]');
  const campo = painel?.querySelector('textarea[aria-label="' + (modo === 'nota' ? 'Escreva uma nota interna' : 'Escreva uma mensagem') + '"]');
  if (!campo || campo.disabled || !dentro(campo) || campo.getBoundingClientRect().height < 44
    || painel.id !== ativa.getAttribute('aria-controls') || painel.getAttribute('aria-labelledby') !== ativa.id) return false;
  const emoji = rodape.querySelector('button[aria-label="Emojis"]');
  const anexar = rodape.querySelector('button[aria-label="Anexar"]');
  const agenda = rodape.querySelector('button[aria-label="Agendar mensagem"]');
  const voz = rodape.querySelector('button[aria-label="Gravar mensagem de voz"]');
  const enviar = [...rodape.querySelectorAll('button')].find(b => b.textContent.trim() === 'Enviar');
  if (modo === 'nota' && (anexar || agenda || voz || !rodape.querySelector('[role="note"]')?.textContent.includes('não é enviada ao contato.') || !enviar)) return false;
  if (modo === 'responder' && (!anexar || (!voz && !enviar))) return false;
  if (!emoji || ![emoji, anexar, agenda, voz, enviar].filter(Boolean).every(b => dentro(b) && b.getBoundingClientRect().width >= 44 && b.getBoundingClientRect().height >= 44)) return false;
  return rodape.textContent.includes('/ respostas rápidas') && !rodape.textContent.includes('@ mencionar');
}
