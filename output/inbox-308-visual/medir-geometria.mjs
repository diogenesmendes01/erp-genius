import { chromium } from "playwright-core";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { autenticarApp, esperarConteudoApp } from "../../scripts/visual/espera-app.mjs";
if (!process.env.INBOX_VISUAL_EMAIL || !process.env.INBOX_VISUAL_SENHA) throw new Error("Defina as credenciais fictícias locais em INBOX_VISUAL_EMAIL/INBOX_VISUAL_SENHA.");
const base = "http://localhost:3110";
const ids = JSON.parse(await readFile(new URL("../../tmp/visual/demo-ids.json", import.meta.url), "utf8"));
if (ids.perfil !== "dev-email") throw new Error("Perfil incorreto para medição");
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const destino = new URL("./", import.meta.url); await mkdir(destino, { recursive: true });
const larguras = [390, 699, 700, 767, 768, 959, 960, 1024, 1099, 1100, 1199, 1200, 1279, 1280, 1399, 1400, 1440];
const resultados = [];
try {
  for (const tema of ["light", "dark"]) {
    const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
    const erros = [];
    await contexto.addInitScript((tema) => localStorage.setItem("tema", tema), tema);
    await contexto.route("**/*", async (rota) => new URL(rota.request().url()).origin === base ? rota.continue() : rota.abort());
    await autenticarApp(contexto, base, process.env.INBOX_VISUAL_EMAIL, process.env.INBOX_VISUAL_SENHA);
    const pagina = await contexto.newPage(); pagina.on("pageerror", (e) => erros.push(e.message)); pagina.on("console", (e) => { if (/hydration|hydrating|did not match|same key|unique.*key/i.test(e.text())) erros.push(e.text()); });
    for (const width of larguras) {
      const height = width === 390 ? 844 : width === 1440 ? 900 : 768;
      await pagina.setViewportSize({ width, height });
      await pagina.goto(`${base}/inbox?c=${ids.ids.beatriz}`, { waitUntil: "domcontentloaded" });
      await esperarConteudoApp(pagina, "humano-compositor", width >= 1400 ? "desktop" : width < 960 ? "celular" : "tablet");
      const campo = pagina.getByRole("textbox", { name: "Digite uma mensagem", exact: true });
      await campo.fill("Mensagem fictícia de teste; não enviar.");
      await pagina.getByRole("button", { name: "Enviar", exact: true }).waitFor();
      await pagina.evaluate(() => document.fonts.ready);
      const medida = await pagina.evaluate(() => {
        const caixa = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom, display: s.display, clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, clientHeight: el.clientHeight, scrollHeight: el.scrollHeight }; };
        const conversa = document.querySelector('section[aria-label="Conversa"]');
        const campo = conversa.querySelector('textarea[aria-label="Digite uma mensagem"]');
        const controles = [...conversa.querySelectorAll("button")].filter((b) => ["Anexar", "Emojis"].includes(b.getAttribute("aria-label")) || b.textContent === "Enviar").map((b) => ({ nome: b.getAttribute("aria-label") ?? b.textContent, ...caixa(b) }));
        return { documento: { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight }, lista: caixa(document.querySelector('section[aria-label="Conversas"]')), conversa: caixa(conversa), painel: caixa(document.querySelector("#painel-contato")), campo: caixa(campo), controles, pressionado: document.querySelector('button[aria-controls="painel-contato"]')?.getAttribute("aria-pressed") };
      });
      const falhas = [];
      if (medida.documento.scrollHeight > height + 1 || medida.documento.scrollWidth > width + 1) falhas.push("documento rolando");
      if (medida.conversa.scrollWidth > medida.conversa.clientWidth + 1) falhas.push("overflow horizontal da conversa");
      if (medida.campo.width < 120) falhas.push("campo menor que120");
      if (medida.controles.some((c) => c.x < medida.conversa.x - 1 || c.right > medida.conversa.right + 1 || c.bottom > height + 1)) falhas.push("controle fora da conversa/viewport");
      resultados.push({ tema, width, height, ...medida, falhas, pageerrors: [...erros] });
      if ([390, 768, 960, 1024, 1280, 1400, 1440].includes(width)) await pagina.screenshot({ path: new URL(`${width}x${height}-${tema}-humano.png`, destino).pathname.replace(/^\/([A-Za-z]:)/,"$1"), style: '[data-nextjs-toast]:not(:has([data-has-issues="true"])) { visibility: hidden !important; }' });
      process.stdout.write(`${tema} ${width}: thread=${medida.conversa.width} campo=${medida.campo.width} painel=${medida.painel.width} ${falhas.join(",") || "OK"}\n`);
    }
    await contexto.close();
  }
} finally { await browser.close(); await writeFile(new URL("medidas-iniciais.json", destino), JSON.stringify(resultados, null, 2)); }
if (resultados.some((r) => r.falhas.length || r.pageerrors.length)) throw new Error("Medição registrou falhas");
