#!/usr/bin/env node
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
import { resolverBancoTeste } from "../test-profile.mjs";
import { ESTADOS, TAMANHOS, cancelamentoDeMensagensRecuperado, caminhoNoNpm, combinacoes, nomeDaCaptura, problemaReactNaCaptura, tipoDoArquivo } from "./nucleo-captura.mjs";
import { autenticarApp, esperarConteudoApp } from "./espera-app.mjs";

const raiz = fileURLToPath(new URL("../../", import.meta.url));
const nodeModules = path.join(raiz, "node_modules");
const destino = path.join(raiz, "tmp", "visual");
const prototipo = path.join(raiz, "docs", "planejamento", "inbox-prototipo", "prototipo", "Inbox.dc.html");
const AJUDA = "Uso: node scripts/visual/capturar-inbox.mjs --alvo app|prototipo|ambos --estado <nome>|todos [--base http://127.0.0.1:3017]";

function argumentos(argv) {
  if (argv.includes("--help")) return { ajuda: true };
  const opcoes = { alvo: "ambos", estado: "conversa", base: "http://127.0.0.1:3017" };
  for (let i = 0; i < argv.length; i += 2) {
    const chave = argv[i];
    if (!Object.hasOwn({ "--alvo": 1, "--estado": 1, "--base": 1 }, chave) || !argv[i + 1]) throw new Error(AJUDA);
    opcoes[chave.slice(2)] = argv[i + 1];
  }
  if (!["app", "prototipo", "ambos"].includes(opcoes.alvo) || (opcoes.estado !== "todos" && !Object.hasOwn(ESTADOS, opcoes.estado))) throw new Error(AJUDA);
  const base = new URL(opcoes.base);
  if (base.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(base.hostname) || !base.port || base.pathname !== "/" || base.search || base.hash || base.username || base.password) throw new Error("A base do app visual deve ser HTTP local, sem caminho nem credenciais.");
  return { ...opcoes, base: base.origin, ajuda: false };
}

async function idsDaDemo() {
  const { perfil } = resolverBancoTeste(raiz);
  const dado = JSON.parse(await readFile(path.join(destino, "demo-ids.json"), "utf8"));
  if (dado.perfil !== perfil || !dado.ids?.mariana || !dado.ids?.beatriz) throw new Error("IDs da demo não pertencem ao perfil local deste worktree.");
  return dado.ids;
}

async function prepararRede(contexto, alvo, base, falhas) {
  await contexto.route("**/*", async (rota) => {
    const url = rota.request().url();
    const u = new URL(url);
    if (u.protocol === "file:") return rota.continue();
    if (alvo === "app" && u.origin === base) return rota.continue();
    if (alvo === "prototipo" && u.protocol === "https:" && u.hostname === "fonts.googleapis.com" && u.pathname.startsWith("/css2"))
      return rota.fulfill({ status: 200, contentType: "text/css", body: "" });
    if (alvo === "prototipo" && u.protocol === "https:" && u.hostname === "unpkg.com") {
      try {
        const arquivo = caminhoNoNpm(url, nodeModules);
        const relativo = path.relative(nodeModules, arquivo);
        if (!relativo || relativo.startsWith("..") || path.isAbsolute(relativo)) throw new Error("Fora de node_modules");
        return rota.fulfill({ status: 200, contentType: tipoDoArquivo(arquivo), body: await readFile(arquivo) });
      } catch (erro) {
        falhas.push(`Recurso npm local indisponível: ${u.pathname} (${String(erro)})`);
        return rota.abort();
      }
    }
    falhas.push(`Tráfego externo bloqueado: ${u.origin}${u.pathname}`);
    return rota.abort();
  });
}

async function abrirApp(pagina, contexto, base, ids, estado, tamanho) {
  await autenticarApp(contexto, base, process.env.INBOX_VISUAL_EMAIL ?? "admin@genius.com", process.env.INBOX_VISUAL_SENHA ?? "genius123");
  const id = estado === "humano-compositor" ? ids.beatriz : ids.mariana;
  const semSelecao = estado === "sem-selecao" || estado === "celular-lista";
  await pagina.goto(`${base}/inbox${semSelecao ? "" : `?c=${encodeURIComponent(id)}`}`, { waitUntil: "domcontentloaded" });
  if (estado === "celular-painel" || estado === "tablet-painel") {
    // A mensagem chega pelo efeito cliente: este ponto também comprova a hidratação antes do clique no painel.
    await esperarConteudoApp(pagina, "conversa", tamanho);
    await pagina.getByRole("button", { name: "Painel do contato" }).click();
  }
  if (estado === "painel-fechado") {
    await esperarConteudoApp(pagina, "conversa", tamanho);
    await pagina.getByRole("button", { name: "Painel do contato", exact: true }).click();
  }
  await esperarConteudoApp(pagina, estado, tamanho);
}

async function abrirPrototipo(pagina, estado) {
  const c = estado === "humano-compositor" ? "c4" : "c1";
  await pagina.goto(`${pathToFileURL(prototipo).href}?c=${c}`, { waitUntil: "load" });
  const root = pagina.locator('[data-m="root"]');
  await root.waitFor({ state: "visible" });
  if (estado === "celular-lista") await root.locator('[data-m="list"]').waitFor({ state: "visible" });
  if (estado === "conversa" || estado === "painel-fechado" || estado === "celular-conversa" || estado === "celular-painel" || estado === "tablet-painel") {
    const chat = root.locator('[data-m="chat"]');
    if (!(await chat.isVisible())) await root.getByText("Mariana Costa", { exact: true }).first().click();
    await chat.waitFor({ state: "visible" });
  }
  if (estado === "celular-painel" || estado === "tablet-painel") {
    const detalhes = root.getByTitle("Painel do contato");
    await detalhes.first().click();
    await root.locator('[data-m="panel"]').waitFor({ state: "visible" });
  }
  if (estado === "painel-fechado") {
    await root.getByTitle("Painel do contato").first().click();
    await root.locator('[data-m="panel"]').waitFor({ state: "hidden" });
  }
  await pagina.waitForTimeout(4000);
}

async function main() {
  const o = argumentos(process.argv.slice(2));
  if (o.ajuda) { process.stdout.write(`${AJUDA}\nEstados: ${Object.keys(ESTADOS).join(", ")}\n`); return; }
  const alvos = o.alvo === "ambos" ? ["app", "prototipo"] : [o.alvo];
  const estados = o.estado === "todos" ? Object.keys(ESTADOS) : [o.estado];
  const tarefas = combinacoes({ alvos, estados });
  const ids = alvos.includes("app") ? await idsDaDemo() : null;
  const executablePath = process.env.PW_CHROMIUM ?? (process.platform === "win32" ? null : "/opt/pw-browsers/chromium-1194/chrome-linux/chrome");
  if (!executablePath) throw new Error("Defina PW_CHROMIUM para o Chrome local; o harness não baixa navegador.");
  await mkdir(destino, { recursive: true });
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--allow-file-access-from-files"] });
  const capturas = [];
  try {
    for (const tarefa of tarefas) {
      const [width, height] = TAMANHOS[tarefa.tamanho];
      const contexto = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, locale: "pt-BR", timezoneId: "America/Sao_Paulo", hasTouch: tarefa.tamanho === "celular" });
      const falhas = [];
      const abortados = [];
      const concluidos = new Set();
      const conclusoes = [];
      try {
        await contexto.addInitScript(({ alvo, tema }) => {
          localStorage.setItem(alvo === "app" ? "tema" : "crm-theme", alvo === "app" ? (tema === "escuro" ? "dark" : "light") : tema);
          if (alvo === "prototipo") { localStorage.setItem("crm-role", "admin"); localStorage.setItem("crm-push-asked", "1"); }
        }, { alvo: tarefa.alvo, tema: tarefa.tema });
        await prepararRede(contexto, tarefa.alvo, o.base, falhas);
        const pagina = await contexto.newPage();
        pagina.on("pageerror", (erro) => falhas.push(`pageerror: ${erro.message}`));
        pagina.on("console", (mensagem) => { if (tarefa.alvo === "app" && problemaReactNaCaptura(mensagem.text())) falhas.push(`React: ${mensagem.text()}`); });
        pagina.on("requestfailed", (pedido) => abortados.push({ url: pedido.url(), method: pedido.method(), erro: pedido.failure()?.errorText ?? "" }));
        pagina.on("requestfinished", (pedido) => {
          if (pedido.method() !== "GET") return;
          conclusoes.push(pedido.response().then((resposta) => { if (resposta?.ok()) concluidos.add(`GET ${pedido.url()}`); }));
        });
        pagina.on("response", (resposta) => { if (resposta.status() === 404) falhas.push(`404: ${resposta.url()}`); });
        pagina.setDefaultTimeout(30_000);
        if (tarefa.alvo === "app") await abrirApp(pagina, contexto, o.base, ids, tarefa.estado, tarefa.tamanho);
        else await abrirPrototipo(pagina, tarefa.estado);
        await pagina.evaluate(() => document.fonts.ready);
        const nome = nomeDaCaptura(tarefa.alvo, tarefa.tema, tarefa.tamanho, tarefa.estado);
        // Estilo temporário só da foto: mantém indicadores de issues e todos os listeners de diagnóstico.
        await pagina.screenshot({ path: path.join(destino, nome), style: tarefa.alvo === "app" ? '[data-nextjs-toast]:not(:has([data-has-issues="true"])) { visibility: hidden !important; }' : undefined });
        await Promise.all(conclusoes);
        const diagnosticos = [];
        for (const pedido of abortados) {
          const registro = `requestfailed: ${pedido.url} ${pedido.erro}`;
          if (tarefa.alvo === "app" && cancelamentoDeMensagensRecuperado(pedido, concluidos, o.base, true)) diagnosticos.push(`GET da thread cancelado e recuperado: ${pedido.url}`);
          else falhas.push(registro);
        }
        capturas.push({ ...tarefa, arquivo: nome, width, height, falhas, diagnosticos });
        process.stdout.write(`${nome}: ${falhas.length ? `FALHAS ${falhas.length}` : "OK"}\n`);
      } finally { await contexto.close(); }
    }
  } finally { await browser.close(); }
  await writeFile(path.join(destino, "manifesto.json"), JSON.stringify({ capturas }, null, 2) + "\n");
  if (capturas.some((c) => c.falhas.length)) throw new Error("Captura visual registrou falhas; veja tmp/visual/manifesto.json.");
  process.stdout.write(`Capturas concluídas: ${capturas.length} em ${destino}\n`);
}

main().catch((erro) => { console.error(erro); process.exitCode = 1; });
