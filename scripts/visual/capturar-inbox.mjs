#!/usr/bin/env node
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
import { resolverBancoTeste } from "../test-profile.mjs";
import { ESTADOS, TAMANHOS, cancelamentoDeMensagensRecuperado, caminhoNoNpm, combinacoes, nomeDaCaptura, problemaReactNaCaptura, tipoDoArquivo } from "./nucleo-captura.mjs";
import { abrirBuscaConversaApp, abrirMenuConversaApp, abrirNotaConversaApp, semanticaRodapePronto, abrirPopoverColunaApp, autenticarApp, esperarConteudoApp, esperarHidratacaoApp } from "./espera-app.mjs";
import { anonimizarTelefonesNoDom } from "./anonimizar-telefones.mjs";

import { instalarConclusaoMensagens, instalarErroEstado, abrirCarregandoApp, confirmarPainelVazio, semanticaEstado319Pronto } from "./estados-inbox.mjs";

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

export async function abrirApp(pagina, contexto, base, ids, estado, tamanho) {
  await autenticarApp(contexto, base, process.env.INBOX_VISUAL_EMAIL ?? (estado === "painel-vazio" ? "joao@genius.com" : "admin@genius.com"), process.env.INBOX_VISUAL_SENHA ?? "genius123");
  if (estado === "carregando") return { finalizar: await abrirCarregandoApp(pagina, contexto, base), metadados: { fallbackReal: true, latenciaLocalMs: 3000, medicaoStreaming: false } };
  const id = ["humano-compositor", "busca-conversa", "nota", "painel-erro", "thread-erro", "painel-vazio"].includes(estado) ? ids.beatriz : ids.mariana;
  const ausenciaLegitima = estado === "painel-vazio" ? await confirmarPainelVazio(contexto, base, id) : undefined;
  const estado319 = ["painel-erro", "thread-erro", "painel-vazio"].includes(estado);
  const popoverColuna = ["filtros", "seletor-numero", "nova-conversa"].includes(estado);
  const semSelecao = estado === "sem-selecao" || estado === "celular-lista" || popoverColuna;
  const consulta = estado === "lista-vazia" ? "?busca=zzzz" : semSelecao ? "" : `?c=${encodeURIComponent(id)}`;
  const finalizar = ['painel-erro', 'painel-vazio'].includes(estado) ? instalarConclusaoMensagens(pagina, base, id) : undefined;
  await pagina.goto(`${base}/inbox${consulta}`, { waitUntil: "domcontentloaded" });
  if (popoverColuna) await abrirPopoverColunaApp(pagina, estado, tamanho);
  if (estado === "menu-mais") await abrirMenuConversaApp(pagina, tamanho);
  if (estado === "busca-conversa") await abrirBuscaConversaApp(pagina, tamanho);
  if (estado === "nota") await abrirNotaConversaApp(pagina, tamanho);
  if (["painel-detalhes", "celular-painel", "tablet-painel"].includes(estado)) {
    // A mensagem chega pelo efeito cliente: este ponto também comprova a hidratação antes do clique no painel.
    await esperarConteudoApp(pagina, "conversa", tamanho);
    await esperarHidratacaoApp(pagina);
    if (!(await pagina.locator('aside[aria-label="Painel do contato"]').isVisible())) await pagina.getByRole("button", { name: "Painel do contato", exact: true }).click();
  }
  if (estado === "painel-fechado") {
    await esperarConteudoApp(pagina, "conversa", tamanho);
    await pagina.getByRole("button", { name: "Painel do contato", exact: true }).click();
  }
  if (estado319) {
    await esperarHidratacaoApp(pagina);
    if (["painel-erro", "painel-vazio"].includes(estado) && !(await pagina.locator('#painel-contato').isVisible())) await pagina.getByRole("button", {name:"Painel do contato",exact:true}).click();
    await pagina.waitForFunction(semanticaEstado319Pronto, estado);
  } else {
    await esperarConteudoApp(pagina, estado, tamanho);
    await esperarHidratacaoApp(pagina);
    if (estado === "sem-selecao") await pagina.waitForFunction(semanticaEstado319Pronto, estado);
  }
  if (estado === "humano-compositor" || estado === "nota") {
    await pagina.waitForFunction(semanticaRodapePronto, estado === "nota" ? "nota" : "responder");
    // Mostra a nota real seguida da autoria/status; rolagem interna explícita, sem sintetizar conteúdo.
    await pagina.getByRole("region", { name: "Conversa", exact: true }).getByRole("note").filter({ hasText: "Família pediu atendimento no período da tarde." }).evaluate(nota => nota.scrollIntoView({ block: "start" }));
  }
  return { finalizar, metadados: ausenciaLegitima ? { ausenciaLegitima } : undefined };
}

async function abrirPrototipo(pagina, estado) {
  const c = ["humano-compositor", "nota"].includes(estado) ? "c4" : "c1";
  await pagina.goto(`${pathToFileURL(prototipo).href}?c=${c}`, { waitUntil: "load" });
  const root = pagina.locator('[data-m="root"]');
  await root.waitFor({ state: "visible" });
  if (["filtros", "seletor-numero", "nova-conversa"].includes(estado)) {
    const lista = root.locator('[data-m="list"]');
    await lista.waitFor({ state: "visible" });
    await lista.getByText("Mariana Costa", { exact: true }).first().waitFor({ state: "visible" });
    if (estado === "seletor-numero") {
      await lista.getByRole("button", { name: /Todos os WhatsApp/ }).click();
      await lista.getByText("Ver conversas de", { exact: true }).waitFor({ state: "visible" });
      await lista.getByText("Gerenciar números em Configurações", { exact: true }).waitFor({ state: "visible" });
    } else {
      await lista.getByTitle(estado === "filtros" ? "Filtros" : "Nova conversa", { exact: true }).click();
      const folha = lista.locator('[data-m="sheet"]').filter({ hasText: estado === "filtros" ? "Filtrar conversas" : "Nova conversa" });
      await folha.waitFor({ state: "visible" });
      if (estado === "filtros") await folha.getByRole("button", { name: /^Mostrar .* conversas$/ }).waitFor({ state: "visible" });
      else await folha.getByPlaceholder("Nome ou número com DDD", { exact: true }).waitFor({ state: "visible" });
    }
  }
  if (estado === "lista-vazia") {
    const lista = root.locator('[data-m="list"]');
    await lista.getByPlaceholder("Buscar conversas, contatos, tags").fill("zzzz");
    await lista.getByText("Nenhuma conversa neste filtro.", { exact: true }).waitFor({ state: "visible" });
  }
  if (estado === "celular-lista") await root.locator('[data-m="list"]').waitFor({ state: "visible" });
  if (estado === "menu-mais" || estado === "humano-compositor" || estado === "nota" || estado === "conversa" || estado === "painel-fechado" || estado === "celular-conversa" || estado === "celular-painel" || estado === "tablet-painel" || estado === "painel-detalhes") {
    const chat = root.locator('[data-m="chat"]');
    if (!(await chat.isVisible())) await root.getByText(["humano-compositor", "nota"].includes(estado) ? "Beatriz Lima" : "Mariana Costa", { exact: true }).first().click();
    await chat.waitFor({ state: "visible" });
  }
  if (["painel-detalhes", "celular-painel", "tablet-painel"].includes(estado)) {
    const detalhes = root.getByTitle("Painel do contato");
    if (!(await root.locator('[data-m="panel"]').isVisible())) await detalhes.first().click();
    const painel = root.locator('[data-m="panel"]');
    await painel.waitFor({ state: "visible" });
    await painel.getByText("Mariana Costa", { exact: true }).first().waitFor({ state: "visible" });
    await painel.getByText("Detalhes", { exact: true }).waitFor({ state: "visible" });
  }
  if (estado === "painel-fechado") {
    await root.getByTitle("Painel do contato").first().click();
    await root.locator('[data-m="panel"]').waitFor({ state: "hidden" });
  }
  if (estado === "menu-mais") {
    const chat = root.locator('[data-m="chat"]');
    await chat.getByTitle("Mais", { exact: true }).click();
    await chat.locator('[data-m="sheet"]').filter({ hasText: "Status da conversa" }).waitFor({ state: "visible" });
  }
  if (estado === "nota") {
    const rodape = root.locator('[data-m="chat"] footer');
    const nota = rodape.getByText("Nota interna", { exact: true });
    if (!(await nota.evaluate(e => e.tagName === "BUTTON"))) throw new Error("O texto Nota interna do protótipo não é um botão.");
    await nota.click();
    await rodape.getByPlaceholder("Nota interna · @ para mencionar", { exact: true }).waitFor({ state: "visible" });
  } else if (estado === "humano-compositor") {
    await root.locator('[data-m="chat"] footer').getByPlaceholder("Escreva uma mensagem", { exact: true }).waitFor({ state: "visible" });
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
  const fontesHarness = Object.fromEntries(await Promise.all(["capturar-inbox.mjs", "nucleo-captura.mjs", "espera-app.mjs", "anonimizar-telefones.mjs", "estados-inbox.mjs"].map(async nome => [nome, createHash("sha256").update(await readFile(new URL(nome, import.meta.url))).digest("hex")])));
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
        const erroControlado = await instalarErroEstado(contexto, o.base, ids?.beatriz, tarefa.alvo === "app" ? tarefa.estado : "");
        const pagina = await contexto.newPage();
        pagina.on("pageerror", (erro) => falhas.push(`pageerror: ${erro.message}`));
        pagina.on("console", (mensagem) => { if (tarefa.alvo === "app" && problemaReactNaCaptura(mensagem.text())) falhas.push(`React: ${mensagem.text()}`); });
        pagina.on("requestfailed", (pedido) => abortados.push({ pedidoReal: pedido, url: pedido.url(), method: pedido.method(), erro: pedido.failure()?.errorText ?? "" }));
        pagina.on("requestfinished", (pedido) => {
          if (pedido.method() !== "GET") return;
          conclusoes.push(pedido.response().then((resposta) => { if (resposta?.ok()) concluidos.add(`GET ${pedido.url()}`); }));
        });
        pagina.on("response", (resposta) => { if (resposta.status() >= 400 && !erroControlado.respostaEsperada(resposta)) falhas.push(`HTTP ${resposta.status()}: ${resposta.url()}`); });
        pagina.setDefaultTimeout(30_000);
        let estadoApp;
        if (tarefa.alvo === "app") estadoApp = await abrirApp(pagina, contexto, o.base, ids, tarefa.estado, tarefa.tamanho);
        else await abrirPrototipo(pagina, tarefa.estado);
        await pagina.evaluate(() => document.fonts.ready);
        const nome = nomeDaCaptura(tarefa.alvo, tarefa.tema, tarefa.tamanho, tarefa.estado);
        const anonimizacao = await pagina.evaluate(anonimizarTelefonesNoDom);
        // Estilo temporário só da foto: mantém indicadores de issues e todos os listeners de diagnóstico.
        await pagina.screenshot({ path: path.join(destino, nome), style: tarefa.alvo === "app" ? '[data-nextjs-toast]:not(:has([data-has-issues="true"])) { visibility: hidden !important; }' : undefined });
        await estadoApp?.finalizar?.();
        await erroControlado.finalizar(pagina);
        await Promise.all(conclusoes);
        const diagnosticos = [...erroControlado.diagnosticos];
        for (const pedido of abortados) {
          const registro = `requestfailed: ${pedido.url} ${pedido.erro}`;
          if (erroControlado.cancelamentoEsperado(pedido.pedidoReal, pedido.erro)) diagnosticos.push(`GET500 controlado cancelado e substituído por headers500 observados/erro público pronto: ${pedido.url}`);
          else if (tarefa.alvo === "app" && cancelamentoDeMensagensRecuperado(pedido, concluidos, o.base, true)) diagnosticos.push(`GET da thread cancelado e recuperado: ${pedido.url}`);
          else falhas.push(registro);
        }
        capturas.push({ ...tarefa, ...estadoApp?.metadados, ...(ESTADOS[tarefa.estado].motivoSemReferencia ? {referenciaFuncionalPrototipo:null,motivoSemReferencia:ESTADOS[tarefa.estado].motivoSemReferencia} : {}), ...(tarefa.estado === "busca-conversa" ? { referenciaFuncionalPrototipo: null, motivoSemReferencia: "Busca local E1 não tem comportamento equivalente no protótipo aprovado." } : {}), arquivo: nome, width, height, falhas, diagnosticos, anonimizacao });
        process.stdout.write(`${nome}: ${falhas.length ? `FALHAS ${falhas.length}` : "OK"}\n`);
      } finally { await contexto.close(); }
    }
  } finally { await browser.close(); }
  await writeFile(path.join(destino, "manifesto.json"), JSON.stringify({ fonteApp: process.env.INBOX_VISUAL_FONTE ?? null, fontesHarness, capturas }, null, 2) + "\n");
  if (capturas.some((c) => c.falhas.length)) throw new Error("Captura visual registrou falhas; veja tmp/visual/manifesto.json.");
  process.stdout.write(`Capturas concluídas: ${capturas.length} em ${destino}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((erro) => { console.error(erro); process.exitCode = 1; });
