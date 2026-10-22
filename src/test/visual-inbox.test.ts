import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import {
  ESTADOS, TAMANHOS, TEMAS, cancelamentoDeMensagensRecuperado, caminhoNoNpm, combinacoes, nomeDaCaptura, tipoDoArquivo,
} from "../../scripts/visual/nucleo-captura.mjs";
import { exigirBancoDescartavel } from "../../scripts/visual/demo-inbox";
import { autenticarApp, esperarConteudoApp } from "../../scripts/visual/espera-app.mjs";

describe("harness visual do Inbox", () => {
  it("CLI documenta as opções sem abrir browser nem banco", () => {
    const r = spawnSync(process.execPath, ["scripts/visual/capturar-inbox.mjs", "--help"], { cwd: process.cwd(), encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("--alvo");
    expect(r.stdout).toContain("--estado");
  });
  it("gera os doze pares de captura da conversa nos três tamanhos e dois temas", () => {
    expect(TAMANHOS).toEqual({ desktop: [1440, 900], tablet: [1024, 768], celular: [390, 844] });
    expect(TEMAS).toEqual(["escuro", "claro"]);
    const pares = combinacoes({ alvos: ["app", "prototipo"], estados: ["conversa"] });
    expect(pares).toHaveLength(12);
    expect(pares.map((p) => nomeDaCaptura(p.alvo, p.tema, p.tamanho, p.estado))).toContain("prototipo-escuro-celular-conversa.png");
    expect(nomeDaCaptura("app", "claro", "desktop", "menu-mais")).toBe("app-claro-desktop-menu-mais.png");
  });

  it("respeita tamanhos por estado e não captura no protótipo um estado só do app", () => {
    expect(combinacoes({ alvos: ["app"], estados: ["celular-lista"] }).map((c) => c.tamanho)).toEqual(["celular", "celular"]);
    expect(combinacoes({ alvos: ["prototipo"], estados: ["sem-selecao"] })).toEqual([]);
    for (const [nome, estado] of Object.entries(ESTADOS)) if (estado.referencia) expect(existsSync(estado.referencia), nome).toBe(true);
  });

  it("serve recursos unpkg apenas de módulos locais e com MIME apropriado", () => {
    expect(caminhoNoNpm("https://unpkg.com/react@18.3.1/umd/react.production.min.js", "/r/node_modules")).toBe(path.join("/r/node_modules", "react/umd/react.production.min.js"));
    expect(caminhoNoNpm("https://unpkg.com/@babel/standalone@7.29.0/babel.min.js", "/r/node_modules")).toBe(path.join("/r/node_modules", "@babel/standalone/babel.min.js"));
    expect(caminhoNoNpm("https://unpkg.com/lucide-static@0.460.0/font/lucide.css", "/n")).toBe(path.join("/n", "lucide-static/font/lucide.css"));
    expect(caminhoNoNpm("https://unpkg.com/lucide-static@0.460.0/font/lucide.woff2?t=42", "/n")).toBe(path.join("/n", "lucide-static/font/lucide.woff2"));
    expect(() => caminhoNoNpm("https://unpkg.com/react@18.3.1/../../secret", "/r/node_modules")).toThrow();
    expect(() => caminhoNoNpm("https://example.com/react@18.3.1/index.js", "/r/node_modules")).toThrow();
    expect(() => caminhoNoNpm("https://unpkg.com/react@18.3.1/%2e%2e/secret", "/r/node_modules")).toThrow();
    expect(tipoDoArquivo("a.css")).toBe("text/css");
    expect(tipoDoArquivo("a.js")).toBe("application/javascript");
    expect(tipoDoArquivo("a.woff2")).toBe("font/woff2");
    expect(tipoDoArquivo("a.ttf")).toBe("font/ttf");
    expect(tipoDoArquivo("a.bin")).toBe("application/octet-stream");
  });

  it("só autoriza host e porta locais com nome EXATO da lista de perfis", () => {
    for (const banco of ["erp_genius_test", "erp_genius_test_dev_email", "erp_genius_test_dev_gravacoes", "erp_genius_test_tester", "erp_genius_test_ciint"]) {
      expect(() => exigirBancoDescartavel(`postgres://postgres:teste@localhost:54329/${banco}`)).not.toThrow();
    }
    expect(() => exigirBancoDescartavel("postgres://postgres:teste@127.0.0.1:54329/erp_genius_test_tester")).not.toThrow();
    for (const url of [
      "postgres://postgres:teste@db.prod:54329/erp_genius_test",
      "postgres://postgres:teste@localhost:5432/erp_genius_test",
      "postgres://postgres:teste@localhost:54329/erp_genius_test_not_in_list",
      "postgres://postgres:teste@localhost:54329/outro",
      "postgres://postgres:teste@localhost:54329/erp_genius_test?schema=production",
      "not-a-url",
    ]) expect(() => exigirBancoDescartavel(url), url).toThrow("banco descartável");
  });

  it("aguarda mensagem e painel reais da fixture antes da captura, mesmo após a região aparecer", async () => {
    let liberarMensagem!: () => void;
    let liberarPainel!: () => void;
    const mensagem = new Promise<void>((resolve) => { liberarMensagem = resolve; });
    const painel = new Promise<void>((resolve) => { liberarPainel = resolve; });
    const esperas: string[] = [];
    const locator = (nome: string, promessa: Promise<void> = Promise.resolve()) => ({
      waitFor: async () => { esperas.push(nome); await promessa; },
      getByText: (texto: string) => locator(texto, mensagem),
    });
    const pagina = {
      getByRole: (_role: string, opcoes: { name: string }) => locator(opcoes.name, opcoes.name === "Painel Comercial" ? painel : Promise.resolve()),
    };
    let terminou = false;
    const espera = esperarConteudoApp(pagina as unknown as Parameters<typeof esperarConteudoApp>[0], "conversa", "desktop").then(() => { terminou = true; });
    await Promise.resolve();
    expect(terminou).toBe(false);
    liberarMensagem();
    await Promise.resolve();
    expect(terminou).toBe(false);
    liberarPainel();
    await espera;
    expect(esperas).toContain("Quero saber o valor do Inglês Intensivo B1.");
    expect(esperas).toContain("Painel Comercial");
  });

  it("aguarda a nota interna específica no estado do compositor humano", async () => {
    let liberarNota!: () => void;
    const nota = new Promise<void>((resolve) => { liberarNota = resolve; });
    const conversa = {
      waitFor: async () => undefined,
      getByText: () => ({ waitFor: async () => undefined }),
      getByRole: () => ({ getByText: () => ({ waitFor: () => nota }) }),
    };
    const pagina = { getByRole: (_role: string, opcoes: { name: string }) => opcoes.name === "Conversa" ? conversa : { waitFor: async () => undefined } };
    let terminou = false;
    const espera = esperarConteudoApp(pagina as unknown as Parameters<typeof esperarConteudoApp>[0], "humano-compositor", "desktop").then(() => { terminou = true; });
    await Promise.resolve();
    expect(terminou).toBe(false);
    liberarNota();
    await espera;
    expect(terminou).toBe(true);
  });

  it.each(["celular-painel", "tablet-painel"])("no Drawer %s espera o painel sem exigir a conversa que ficou oculta", async (estado) => {
    let painelPronto!: () => void;
    let drawerPronto!: () => void;
    const painel = new Promise<void>((resolve) => { painelPronto = resolve; });
    const drawer = new Promise<void>((resolve) => { drawerPronto = resolve; });
    const pagina = { waitForFunction: () => drawer, getByRole: (_role: string, opcoes: { name: string }) => {
      if (opcoes.name === "Conversa") return { waitFor: async () => { throw new Error("Conversa oculta pelo Drawer"); } };
      if (opcoes.name === "Painel Comercial") return { waitFor: () => painel };
      throw new Error(`Região inesperada: ${opcoes.name}`);
    } };
    let terminou = false;
    const espera = esperarConteudoApp(pagina as unknown as Parameters<typeof esperarConteudoApp>[0], estado, estado === "celular-painel" ? "celular" : "tablet").then(() => { terminou = true; });
    await Promise.resolve();
    expect(terminou).toBe(false);
    painelPronto();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(terminou).toBe(false);
    drawerPronto();
    await espera;
    expect(terminou).toBe(true);
  });

  it.each(["altura zero", "fora da altura", "transição em execução"])("não fotografa Drawer com %s mesmo dentro da largura", async (caso) => {
    const area = { width: 390, height: caso === "altura zero" ? 0 : 844, left: 0, right: 390, top: 0, bottom: caso === "fora da altura" ? 900 : 844 };
    const drawer = { getBoundingClientRect: () => area, getAnimations: () => caso === "transição em execução" ? [{ playState: "running" }] : [] };
    vi.stubGlobal("document", { querySelector: () => drawer });
    vi.stubGlobal("window", { innerWidth: 390, innerHeight: 844 });
    try {
      const pagina = {
        getByRole: () => ({ waitFor: async () => undefined }),
        waitForFunction: async (condicao: () => boolean) => { expect(condicao()).toBe(false); },
      };
      await esperarConteudoApp(pagina as unknown as Parameters<typeof esperarConteudoApp>[0], "celular-painel", "celular");
    } finally { vi.unstubAllGlobals(); }
  });

  it("autentica via CSRF e confirma sessão antes de abrir o Inbox", async () => {
    const chamadas: string[] = [];
    const request = {
      get: async (url: string) => { chamadas.push(`GET ${url}`); return { ok: () => true, json: async () => url.endsWith("csrf") ? { csrfToken: "csrf-local" } : { user: { email: "admin@genius.com" } } }; },
      post: async (url: string, opcoes: { form: Record<string, string> }) => { chamadas.push(`POST ${url}`); expect(opcoes.form).toMatchObject({ csrfToken: "csrf-local", email: "admin@genius.com", senha: "genius123" }); return { ok: () => true, status: () => 200 }; },
    };
    await autenticarApp({ request } as unknown as Parameters<typeof autenticarApp>[0], "http://127.0.0.1:3017", "admin@genius.com", "genius123");
    expect(chamadas).toEqual(["GET http://127.0.0.1:3017/api/auth/csrf", "POST http://127.0.0.1:3017/api/auth/callback/credentials", "GET http://127.0.0.1:3017/api/auth/session"]);
  });

  it("só diagnostica aborto de GET mensagens quando outro GET idêntico concluiu e a fixture apareceu", () => {
    const base = "http://localhost:3108";
    const url = `${base}/api/inbox/atendimentos/inbox-demo-mariana-307/mensagens`;
    const concluido = new Set([`GET ${url}`]);
    const pedido = { url, method: "GET", erro: "net::ERR_ABORTED" };
    expect(cancelamentoDeMensagensRecuperado(pedido, concluido, base, true)).toBe(true);
    expect(cancelamentoDeMensagensRecuperado(pedido, new Set(), base, true)).toBe(false);
    expect(cancelamentoDeMensagensRecuperado(pedido, concluido, base, false)).toBe(false);
    expect(cancelamentoDeMensagensRecuperado({ ...pedido, erro: "net::ERR_CONNECTION_RESET" }, concluido, base, true)).toBe(false);
    expect(cancelamentoDeMensagensRecuperado({ ...pedido, method: "POST" }, concluido, base, true)).toBe(false);
    expect(cancelamentoDeMensagensRecuperado({ ...pedido, url: `${base}/api/inbox/atendimentos/inbox-demo-mariana-307/painel` }, concluido, base, true)).toBe(false);
    expect(cancelamentoDeMensagensRecuperado({ ...pedido, url: "https://example.com/api/inbox/atendimentos/id/mensagens" }, concluido, base, true)).toBe(false);
  });
});

it("inclui painel-fechado nos dois alvos sem capturar em tamanho incompatível", () => {
  expect(combinacoes({ alvos: ["app", "prototipo"], estados: ["painel-fechado"] })).toHaveLength(4);
});
it("painel-fechado aguarda a thread e comprova o fechamento, sem exigir conteúdo oculto", async () => {
  const chamadas: string[] = [];
  let liberar!: () => void; const fechado = new Promise<void>((ok) => { liberar = ok; });
  const pagina = {
    getByRole: (_role: string, o: { name: string }) => {
      if (o.name === "Painel Comercial") throw new Error("Painel deveria estar fechado");
      return { waitFor: async () => { chamadas.push(o.name); }, getByText: (texto: string) => ({ waitFor: async () => { chamadas.push(texto); } }) };
    },
    waitForFunction: () => fechado,
  };
  let terminou = false;
  const espera = esperarConteudoApp(pagina as unknown as Parameters<typeof esperarConteudoApp>[0], "painel-fechado", "desktop").then(() => { terminou = true; });
  await new Promise((ok) => setTimeout(ok, 0)); expect(terminou).toBe(false); liberar(); await espera;
  expect(chamadas).toContain("Quero saber o valor do Inglês Intensivo B1.");
});

it("warnings React de chave e hidratação invalidam captura do app; HMR normal não", async () => {
  const { problemaReactNaCaptura } = await import("../../scripts/visual/nucleo-captura.mjs");
  expect(problemaReactNaCaptura('Each child in a list should have a unique "key" prop.')).toBe(true);
  expect(problemaReactNaCaptura('Encountered two children with the same key, a')).toBe(true);
  expect(problemaReactNaCaptura('Hydration failed because the server rendered HTML did not match')).toBe(true);
  expect(problemaReactNaCaptura('[Fast Refresh] done in 500ms')).toBe(false);
});

it("lista-vazia acrescenta doze pares app/protótipo nos três tamanhos", () => {
  const tarefas = combinacoes({ alvos: ["app", "prototipo"], estados: ["lista-vazia"] });
  expect(tarefas).toHaveLength(12);
  expect(new Set(tarefas.map(t => t.tamanho))).toEqual(new Set(["desktop", "tablet", "celular"]));
});
it("lista-vazia espera o vazio real e ausência de itens, sem pedir thread oculta", async () => {
  let liberarVazio!: () => void, liberarZero!: () => void;
  const vazio = new Promise<void>(ok => { liberarVazio = ok; });
  const zero = new Promise<void>(ok => { liberarZero = ok; });
  const pagina = {
    getByRole: (_r: string, o: { name: string }) => {
      if (o.name !== "Conversas") throw Error("Não deve exigir thread/painel: " + o.name);
      return { getByText: (texto: string) => { expect(texto).toBe("Nenhuma conversa neste filtro."); return { waitFor: () => vazio }; } };
    },
    waitForFunction: () => zero,
  };
  let terminou = false;
  const espera = esperarConteudoApp(pagina as unknown as Parameters<typeof esperarConteudoApp>[0], "lista-vazia", "celular").then(() => { terminou = true; });
  await Promise.resolve(); expect(terminou).toBe(false);
  liberarVazio(); await Promise.resolve(); expect(terminou).toBe(false);
  liberarZero(); await espera; expect(terminou).toBe(true);
});
