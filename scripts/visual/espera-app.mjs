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
  if (estado === "sem-selecao" || estado === "celular-lista") {
    await pagina.getByRole("region", { name: "Conversas", exact: true }).getByText("Mariana Costa", { exact: true }).waitFor({ state: "visible" });
    return;
  }
  const conversa = pagina.getByRole("region", { name: "Conversa", exact: true });
  await conversa.waitFor({ state: "visible" });
  const humano = estado === "humano-compositor";
  await conversa.getByText(humano ? "Quero matricular meu filho Pedro." : "Quero saber o valor do Inglês Intensivo B1.", { exact: true }).waitFor({ state: "visible" });
  if (humano) await conversa.getByRole("note").getByText("Família pediu atendimento no período da tarde.", { exact: true }).waitFor({ state: "visible" });
  if (tamanho === "desktop" || estado === "celular-painel" || estado === "tablet-painel") {
    await pagina.getByRole("region", { name: "Painel Comercial", exact: true }).waitFor({ state: "visible" });
  }
}
