#!/usr/bin/env node
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
import { resolverBancoTeste } from "../test-profile.mjs";
import { TAMANHOS, cancelamentoDeMensagensRecuperado, caminhoNoNpm, nomeDaCaptura, problemaReactNaCaptura, tipoDoArquivo } from "./nucleo-captura.mjs";
import { confirmarPainelSecretaria, semanticaPainelSecretariaPronto, confirmarPainelSemNome, abrirBuscaConversaApp, abrirMenuConversaApp, abrirNotaConversaApp, semanticaRodapePronto, abrirPopoverColunaApp, autenticarApp, esperarConteudoApp, esperarHidratacaoApp } from "./espera-app.mjs";
import { configurarEntrada, abrirEntradaApp } from "./entradas-inbox.mjs";
import { ESTADOS_DETALHES_325, configurarDetalhes325, abrirDetalhes325, abrirPrototipoDetalhes325, semanticaDetalhes325Pronto } from "./detalhes-inbox.mjs";
import { instalarColetorDetalhes325, finalizarCapturasDetalhes325 } from "./coletor-detalhes.mjs";
import { ESTADOS_CAPTURA327 as ESTADOS, combinacoesCaptura327 as combinacoes, ESTADOS_OPORTUNIDADES327, configurarOportunidadesCli, abrirOportunidadesApp, abrirOportunidadesPrototipo, semanticaOportunidadesProntas, excecaoConsolePrototipo327 } from './oportunidades-inbox.mjs';
import { instalarColetorOportunidades327, finalizarCapturasOportunidades327 } from './coletor-oportunidades.mjs';
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

export function planejarCapturas327(argv) {
  const o=argumentos(argv);if(o.ajuda)return o;
  const alvos=o.alvo==='ambos'?['app','prototipo']:[o.alvo],estados=o.estado==='todos'?Object.keys(ESTADOS):[o.estado];
  return {...o,alvos,estados,tarefas:combinacoes({alvos,estados})};
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

export async function abrirApp(pagina, contexto, base, ids, estado, tamanho, instrumentacao327) {
  if(Object.hasOwn(ESTADOS_OPORTUNIDADES327,estado)){
    const config=configurarOportunidadesCli(estado),prefixo='INBOX_VISUAL_OPORTUNIDADES_'+config.ator.toUpperCase();
    const senha=process.env[prefixo+'_SENHA']??process.env.INBOX_VISUAL_SENHA;
    if(!senha||!instrumentacao327)throw new Error('Cenario327 exige credenciais e coletor explicitos.');
    await autenticarApp(contexto,base,config.email,senha);
    return abrirOportunidadesApp(pagina,contexto,base,config,instrumentacao327);
  }
  if (ESTADOS_DETALHES_325.includes(estado)) {
    const configuracao = configurarDetalhes325(estado);
    if (!process.env.INBOX_VISUAL_EMAIL || !process.env.INBOX_VISUAL_SENHA) throw new Error("Cenários325 exigem credenciais fictícias explícitas, sem login padrão.");
    await autenticarApp(contexto, base, process.env.INBOX_VISUAL_EMAIL, process.env.INBOX_VISUAL_SENHA);
    return abrirDetalhes325(pagina, contexto, base, configuracao);
  }
  await autenticarApp(contexto, base, process.env.INBOX_VISUAL_EMAIL ?? (estado === "painel-vazio" ? "joao@genius.com" : "admin@genius.com"), process.env.INBOX_VISUAL_SENHA ?? "genius123");
  if (estado.startsWith("entrada-")) return abrirEntradaApp(pagina, base, configurarEntrada(estado));
  if (estado === "carregando") return { finalizar: await abrirCarregandoApp(pagina, contexto, base), metadados: { fallbackReal: true, latenciaLocalMs: 3000, medicaoStreaming: false } };
  const id = estado === "painel-secretaria" ? process.env.INBOX_VISUAL_SECRETARIA : estado === "painel-sem-nome" ? process.env.INBOX_VISUAL_SEM_NOME ?? ids.semNome : ["humano-compositor", "busca-conversa", "nota", "painel-erro", "thread-erro", "painel-vazio"].includes(estado) ? ids.beatriz : ids.mariana;
  if (estado === "painel-secretaria") {
    const painelSecretariaReal = await confirmarPainelSecretaria(contexto, base, id);
    const concluirMensagens = instalarConclusaoMensagens(pagina, base, id);
    await pagina.goto(`${base}/inbox?c=${encodeURIComponent(id)}`, { waitUntil: "domcontentloaded" });
    await esperarHidratacaoApp(pagina);
    if (!(await pagina.locator('aside[aria-label="Painel do contato"]').isVisible())) await pagina.getByRole("button", { name: "Painel do contato", exact: true }).click();
    await pagina.waitForFunction(semanticaPainelSecretariaPronto, painelSecretariaReal);
    await concluirMensagens();
    return { metadados: { painelSecretariaReal } };
  }
  const painelSemNomeReal = estado === "painel-sem-nome" ? await confirmarPainelSemNome(contexto, base, id) : undefined;
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
  if (estado === "painel-sem-nome") {
    await esperarHidratacaoApp(pagina);
    if (!(await pagina.locator('aside[aria-label="Painel do contato"]').isVisible())) await pagina.getByRole("button", { name: "Painel do contato", exact: true }).click();
  }
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
  return { finalizar, metadados: painelSemNomeReal ? { painelSemNomeReal } : ausenciaLegitima ? { ausenciaLegitima } : undefined };
}

export async function abrirPrototipo(pagina, estado) {
  if(Object.hasOwn(ESTADOS_OPORTUNIDADES327,estado))return abrirOportunidadesPrototipo(pagina,configurarOportunidadesCli(estado));
  if (ESTADOS_DETALHES_325.includes(estado)) return abrirPrototipoDetalhes325(pagina, pathToFileURL(prototipo).href, estado);
  const c = estado === "painel-sem-nome" ? "c9" : ["humano-compositor", "nota"].includes(estado) ? "c4" : "c1";
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
  if (estado === "menu-mais" || estado === "humano-compositor" || estado === "nota" || estado === "conversa" || estado === "painel-fechado" || estado === "celular-conversa" || estado === "celular-painel" || estado === "tablet-painel" || estado === "painel-detalhes" || estado === "painel-sem-nome") {
    const chat = root.locator('[data-m="chat"]');
    if (!(await chat.isVisible())) await root.getByText(estado === "painel-sem-nome" ? "Sem nome" : ["humano-compositor", "nota"].includes(estado) ? "Beatriz Lima" : "Mariana Costa", { exact: true }).first().click();
    await chat.waitFor({ state: "visible" });
  }
  if (["painel-detalhes", "celular-painel", "tablet-painel", "painel-sem-nome"].includes(estado)) {
    const detalhes = root.getByTitle("Painel do contato");
    if (!(await root.locator('[data-m="panel"]').isVisible())) await detalhes.first().click();
    const painel = root.locator('[data-m="panel"]');
    await painel.waitFor({ state: "visible" });
    if (estado === "painel-sem-nome") {
      await painel.getByPlaceholder("Nome do contato", { exact: true }).waitFor({ state: "visible" });
      await painel.getByRole("button", { name: "Salvar", exact: true }).waitFor({ state: "visible" });
    } else await painel.getByText("Mariana Costa", { exact: true }).first().waitFor({ state: "visible" });
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

export async function executarCapturas327(argv=process.argv.slice(2)) {
  const o = planejarCapturas327(argv);
  if (o.ajuda) { process.stdout.write(`${AJUDA}\nEstados: ${Object.keys(ESTADOS).join(", ")}\n`); return; }
  const { alvos, estados, tarefas } = o;
  const ids = alvos.includes("app") ? estados.every(e => e.startsWith("entrada-") || ESTADOS_DETALHES_325.includes(e) || Object.hasOwn(ESTADOS_OPORTUNIDADES327,e)) ? {} : await idsDaDemo() : null;
  const executablePath = process.env.PW_CHROMIUM;
  if (!executablePath) throw new Error("Defina PW_CHROMIUM para o Chrome local; o harness não baixa navegador.");
  await mkdir(destino, { recursive: true });
  const fontesHarness = Object.fromEntries(await Promise.all(["capturar-inbox.mjs", "nucleo-captura.mjs", "espera-app.mjs", "anonimizar-telefones.mjs", "estados-inbox.mjs", "entradas-inbox.mjs", "detalhes-inbox.mjs", "coletor-detalhes.mjs", "oportunidades-inbox.mjs", "coletor-oportunidades.mjs"].map(async nome => [nome, createHash("sha256").update(await readFile(new URL(nome, import.meta.url))).digest("hex")])));
  const referencias327=tarefas.some(t=>t.alvo==='prototipo'&&Object.hasOwn(ESTADOS_OPORTUNIDADES327,t.estado))?Object.fromEntries(await Promise.all([['htmlSha256',prototipo],['supportSha256',path.join(path.dirname(prototipo),'support.js')]].map(async([k,p])=>[k,createHash('sha256').update(await readFile(p)).digest('hex')]))):null;
  if(referencias327&&(!['7698a34bad041c95f45710cfe3ed6f79a97ba5f49bf5d941751c37324233d8cf', 'd798650956fba7ccee3b4efb22d56e81fb6504d89909c23178b9691d3515db50'].includes(referencias327.htmlSha256)||!['d6bb6dd3aadb9ff722d5d6db2193572ece476b915899575a571de7a0717f001f', '8fe7df74405f3c55f49b7249c74ea1397e65d07dea2b1bd3b4a489bec2e28cbe'].includes(referencias327.supportSha256)))throw new Error('Originais327 divergentes; referencia recusada antesbrowser.');
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--allow-file-access-from-files"] });
  const capturas = [], coletoresDetalhes = [], coletoresOportunidades = [], brutosReferencia327 = [], auditoriasGenericas327 = [];
  let erroExecucao = null, browsersClosed = false;

  try {
    for (const tarefa of tarefas) {
      const [width, height] = TAMANHOS[tarefa.tamanho];
      const contexto = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, locale: "pt-BR", timezoneId: "America/Sao_Paulo", hasTouch: tarefa.tamanho === "celular" });
      const falhas = [];
      const abortados = [];
      const concluidos = new Set();
      const conclusoes = [];
      const contextoId = randomUUID(), paginaId = randomUUID(), ordens = new WeakMap();
      let inicioRequest = 0, coletorDetalhes = null, vinculoDetalhes = null, fotoCapturada = false, coletorOp = null, vinculoOp = null, identidadeOp = null;
      const novo327=Object.hasOwn(ESTADOS_OPORTUNIDADES327,tarefa.estado);
      const diagnosticos327=[], abortosVistos327=new Set();let erroControlado;
      const auditarGenericos327=async()=>{
        await Promise.all(conclusoes);
        for(const pedido of abortados){
          if(abortosVistos327.has(pedido.pedidoReal))continue;abortosVistos327.add(pedido.pedidoReal);
          if(coletorOp?.acompanha(pedido.pedidoReal))continue;
          if(erroControlado?.cancelamentoEsperado(pedido.pedidoReal,pedido.erro))diagnosticos327.push('GET500 controlado cancelado e substituido: '+pedido.url);
          else if(tarefa.alvo==='app'&&cancelamentoDeMensagensRecuperado(pedido,concluidos,o.base,true))diagnosticos327.push('GET da thread cancelado e recuperado: '+pedido.url);
          else falhas.push('requestfailed: '+pedido.url+' '+pedido.erro);
        }
      };
      if(novo327)auditoriasGenericas327.push(auditarGenericos327);
      const nome = nomeDaCaptura(tarefa.alvo, tarefa.tema, tarefa.tamanho, tarefa.estado);
      const idDetalhes = tarefa.alvo === "app" && ESTADOS_DETALHES_325.includes(tarefa.estado) ? configurarDetalhes325(tarefa.estado).id : null;
      const urlDetalhes = idDetalhes ? o.base + "/api/inbox/atendimentos/" + encodeURIComponent(idDetalhes) + "/painel/detalhes" : null;
      try {
        await contexto.addInitScript(({ alvo, tema }) => {
          localStorage.setItem(alvo === "app" ? "tema" : "crm-theme", alvo === "app" ? (tema === "escuro" ? "dark" : "light") : tema);
          if (alvo === "prototipo") { localStorage.setItem("crm-role", "admin"); localStorage.setItem("crm-push-asked", "1"); }
        }, { alvo: tarefa.alvo, tema: tarefa.tema });
        await prepararRede(contexto, tarefa.alvo, o.base, falhas);
        erroControlado = await instalarErroEstado(contexto, o.base, ids?.beatriz, tarefa.alvo === "app" ? tarefa.estado : "");
        const pagina = await contexto.newPage();
        if (idDetalhes) {
          coletorDetalhes = instalarColetorDetalhes325(pagina, { base: o.base, contextoId, paginaId, atendimentoId: idDetalhes });
          vinculoDetalhes = { coletor: coletorDetalhes, captura: null }; coletoresDetalhes.push(vinculoDetalhes);
        }
        if(novo327&&tarefa.alvo==='app'){
          const config=configurarOportunidadesCli(tarefa.estado);
          identidadeOp={base:o.base,contextoId,paginaId,atendimentoId:config.atendimentoId,oportunidadeId:config.oportunidadeId,pessoaId:config.pessoaId,usuarioId:config.usuarioId};
          coletorOp=instalarColetorOportunidades327(pagina,identidadeOp);vinculoOp={coletor:coletorOp,captura:null};coletoresOportunidades.push(vinculoOp);
        }
        pagina.on("request", pedido => ordens.set(pedido, ++inicioRequest));
        pagina.on("pageerror", (erro) => falhas.push(`pageerror: ${erro.message}`));
        pagina.on("console", mensagem => {
          const texto=mensagem.text();
          if(novo327&&excecaoConsolePrototipo327({alvo:tarefa.alvo,tipo:mensagem.type(),texto,hashes:referencias327})){brutosReferencia327.push({contextoId,paginaId,tarefa,texto});return;}
          if((tarefa.alvo==='app'||novo327)&&problemaReactNaCaptura(texto))falhas.push('React: '+texto);
          else if(novo327&&mensagem.type()==='error')falhas.push('consoleerror327: '+texto);
        });
        pagina.on("requestfailed", (pedido) => abortados.push({ pedidoReal: pedido, contextoId, paginaId, atendimentoId: idDetalhes, ordem: ordens.get(pedido), url: pedido.url(), method: pedido.method(), erro: pedido.failure()?.errorText ?? "" }));
        pagina.on("requestfinished", (pedido) => {
          if (pedido.method() !== "GET") return;
          conclusoes.push(pedido.response().then((resposta) => { if (resposta?.ok()) concluidos.add(`GET ${pedido.url()}`); }));
        });
        pagina.on("response", (resposta) => { if (resposta.status() >= 400 && !erroControlado.respostaEsperada(resposta)) falhas.push(`HTTP ${resposta.status()}: ${resposta.url()}`); });
        pagina.setDefaultTimeout(30_000);
        let estadoApp;
        if (tarefa.alvo === "app") estadoApp = await abrirApp(pagina, contexto, o.base, ids, tarefa.estado, tarefa.tamanho, coletorOp?{coletor:coletorOp,identidade:identidadeOp}:undefined);
        else estadoApp = await abrirPrototipo(pagina, tarefa.estado);
        await pagina.evaluate(() => document.fonts.ready);
        const anonimizacao = novo327 ? {aplicada:false,motivo:"Fixture327 ficticia; DOM original preservado."} : await pagina.evaluate(anonimizarTelefonesNoDom);
        if (coletorDetalhes) {
          const token = await coletorDetalhes.aguardar();
          const esperado = estadoApp.metadados.detalhes325;
          const prova = { base: o.base, contextoId, paginaId, atendimentoId: idDetalhes, atendimentoAtualId: new URL(pagina.url()).searchParams.get("c"), corpoEsperadoSha256: esperado.corpoEsperadoSha256, paginaAtiva: !pagina.isClosed(), semanticaFinal: await pagina.evaluate(semanticaDetalhes325Pronto, esperado) };
          coletorDetalhes.selar(token, prova);
        }
        if(coletorOp){
          const token=await coletorOp.aguardar(),preflight=estadoApp.metadados.oportunidadesPreflight;
          coletorOp.selar(token,{...identidadeOp,fase:'oportunidades',atendimentoAtualId:new URL(pagina.url()).searchParams.get('c'),corpoEsperadoSha256:preflight.corpoOportunidadesSha256,paginaAtiva:!pagina.isClosed(),semanticaFinal:await pagina.evaluate(semanticaOportunidadesProntas,estadoApp.metadados.descricaoEsperada)});
        }
        // Estilo temporário só da foto: mantém indicadores de issues e todos os listeners de diagnóstico.
        await pagina.screenshot({ path: path.join(destino, nome), style: tarefa.alvo === "app" && !novo327 ? '[data-nextjs-toast]:not(:has([data-has-issues="true"])) { visibility: hidden !important; }' : undefined });
        fotoCapturada = true;
        await estadoApp?.finalizar?.();
        await erroControlado.finalizar(pagina);
        await Promise.all(conclusoes);
        const diagnosticos = novo327?diagnosticos327:[...erroControlado.diagnosticos];
        for (const pedido of abortados) {
          if(novo327)continue; // auditado tambem aposcontextclose/browserclose
          if(coletorOp?.acompanha(pedido.pedidoReal))continue; // somente START observado, auditado atebrowserclose
          if (coletorDetalhes && pedido.method === "GET" && pedido.url === urlDetalhes) continue; // auditado desde START e também após close
          const registro = `requestfailed: ${pedido.url} ${pedido.erro}`;
          if (erroControlado.cancelamentoEsperado(pedido.pedidoReal, pedido.erro)) diagnosticos.push(`GET500 controlado cancelado e substituído por headers500 observados/erro público pronto: ${pedido.url}`);
          else if (tarefa.alvo === "app" && cancelamentoDeMensagensRecuperado(pedido, concluidos, o.base, true)) diagnosticos.push(`GET da thread cancelado e recuperado: ${pedido.url}`);
          else falhas.push(registro);
        }
        const captura = { ...tarefa, ...estadoApp?.metadados, ...(ESTADOS[tarefa.estado].motivoSemReferencia ? {referenciaFuncionalPrototipo:null,motivoSemReferencia:ESTADOS[tarefa.estado].motivoSemReferencia} : {}), ...(tarefa.estado === "busca-conversa" ? { referenciaFuncionalPrototipo: null, motivoSemReferencia: "Busca local E1 não tem comportamento equivalente no protótipo aprovado." } : {}), arquivo: nome, width, height, falhas, diagnosticos, anonimizacao };
        capturas.push(captura); if (vinculoDetalhes) vinculoDetalhes.captura = captura; if(vinculoOp)vinculoOp.captura=captura;
      } catch (erro) {
        if (!coletorDetalhes&&!novo327) throw erro;
        falhas.push((novo327?"Coleta327":"Coleta325")+" interrompida: " + erro.message);
        const captura = { ...tarefa, arquivo: fotoCapturada ? nome : null, width, height, falhas, diagnosticos: novo327?diagnosticos327:[] };
        capturas.push(captura); if(vinculoDetalhes)vinculoDetalhes.captura = captura; if(vinculoOp)vinculoOp.captura=captura;
      } finally {
        await contexto.close();
        if(novo327)await auditarGenericos327();
        if(coletorOp){const parcial=await coletorOp.auditarFechamento();if(vinculoOp.captura)vinculoOp.captura.falhas.push(...parcial.falhas);}
        if (coletorDetalhes) {
          const parcial = await coletorDetalhes.auditarFechamento();
          if (vinculoDetalhes.captura) vinculoDetalhes.captura.falhas.push(...parcial.falhas);
        }
      }
      if (vinculoDetalhes?.captura?.falhas.length||vinculoOp?.captura?.falhas.length||(novo327&&capturas.at(-1)?.falhas.length)) break; // interrompe no primeiro negativo325/327 conhecido
    }
  } catch (erro) { erroExecucao = erro; }
  finally {
    try { await browser.close(); browsersClosed = true; } catch (erro) { erroExecucao = erroExecucao ?? erro; }
    await finalizarCapturasDetalhes325(coletoresDetalhes);
    for(const auditar of auditoriasGenericas327)await auditar();
    await finalizarCapturasOportunidades327(coletoresOportunidades);
  }
  for(const c of capturas)if(c.alvo==='prototipo'&&Object.hasOwn(ESTADOS_OPORTUNIDADES327,c.estado)){c.aceiteCandidato=browsersClosed&&c.falhas.length===0;c.limiteReferencia='Painel estatico original; sem prova de autoscroll, foco ou selecao.';}
  if(brutosReferencia327.length)await writeFile(path.join(destino,'prototipo327-console-bruto-'+randomUUID()+'.json'),JSON.stringify(brutosReferencia327,null,2)+'\n',{flag:'wx',mode:0o600});
  await writeFile(path.join(destino, "manifesto.json"), JSON.stringify({ fonteApp: process.env.INBOX_VISUAL_FONTE ?? null, fontesHarness, browsersClosed, referencia327:referencias327?{...referencias327,consoleErrorsExcecaoExata:brutosReferencia327.length,limite:"Painel estatico; sem autoscroll/foco/selecao."}:null, erroExecucao: erroExecucao?.message ?? null, capturas }, null, 2) + "\n");
  for (const c of capturas) process.stdout.write(`${c.arquivo ?? c.estado}: ${c.falhas.length ? `FALHAS ${c.falhas.length}` : "OK"}\n`);
  if (erroExecucao) throw erroExecucao;
  if (capturas.some((c) => c.falhas.length)) throw new Error("Captura visual registrou falhas; veja tmp/visual/manifesto.json.");
  process.stdout.write(`Capturas concluídas: ${capturas.length} em ${destino}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) executarCapturas327().catch((erro) => { console.error(erro); process.exitCode = 1; });
