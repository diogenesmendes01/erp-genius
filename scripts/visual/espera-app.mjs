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

/** Espera o conteúdo identificável da fixture, não somente o contêiner inicial da tela. */
export async function esperarConteudoApp(pagina, estado, tamanho) {
  if (estado === "celular-painel" || estado === "tablet-painel") {
    // Após abrir o Drawer, InboxNovo oculta a região Conversa; a mensagem já foi aguardada antes do clique.
    await pagina.getByRole("region", { name: "Painel Comercial", exact: true }).waitFor({ state: "visible" });
    // `visible` inclui o Drawer ainda deslocado; a superfície final precisa caber no viewport e terminar a transição.
    await pagina.waitForFunction(() => {
      const drawer = document.querySelector('aside[role="dialog"][aria-label="Detalhes da conversa"]');
      if (!drawer) return false;
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
  if (humano) await conversa.getByRole("note").getByText("Família pediu atendimento no período da tarde.", { exact: true }).waitFor({ state: "visible" });
  if (tamanho === "desktop") {
    await pagina.getByRole("region", { name: "Painel Comercial", exact: true }).waitFor({ state: "visible" });
  }
}
