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
  if (estado === "celular-painel" || estado === "tablet-painel") {
    // Após abrir o painel único, InboxNovo oculta a região Conversa; a mensagem já foi aguardada antes do clique.
    await pagina.getByRole("region", { name: "Painel Comercial", exact: true }).waitFor({ state: "visible" });
    // `visible` inclui uma superfície ainda deslocada; a superfície final precisa caber no viewport e terminar a transição.
    await pagina.waitForFunction(() => {
      const drawer = document.querySelector('aside[aria-label="Painel do contato"]');
      if (!drawer || drawer.inert || drawer.getAttribute?.("aria-hidden") === "true") return false;
      const area = drawer.getBoundingClientRect();
      return area.width > 0 && area.height > 0
        && area.left >= -1 && area.right <= window.innerWidth + 1
        && area.top >= -1 && area.bottom <= window.innerHeight + 1
        && drawer.getAnimations().every((animacao) => animacao.playState !== "running");
    });
    return;
  }
  if (estado === "sem-selecao" || estado === "celular-lista") {
    await pagina.getByRole("region", { name: "Conversas", exact: true }).getByText("Mariana Costa", { exact: true }).waitFor({ state: "visible" });
    return;
  }
  const conversa = pagina.getByRole("region", { name: "Conversa", exact: true });
  await conversa.waitFor({ state: "visible" });
  const humano = estado === "humano-compositor";
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
  const notas = [...conversa.querySelectorAll('[role="note"]')];
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
