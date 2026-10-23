import { chromium } from "playwright-core";
import { writeFile } from "node:fs/promises";
import { autenticarApp, esperarConteudoApp } from "../../scripts/visual/espera-app.mjs";
if (!process.env.INBOX_VISUAL_EMAIL || !process.env.INBOX_VISUAL_SENHA) throw new Error("Defina as credenciais fictícias locais em INBOX_VISUAL_EMAIL/INBOX_VISUAL_SENHA.");
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "pt-BR" });
const base = "http://localhost:3110";
await contexto.route("**/*", (rota) => new URL(rota.request().url()).origin === base ? rota.continue() : rota.abort());
try {
  await autenticarApp(contexto, base, process.env.INBOX_VISUAL_EMAIL, process.env.INBOX_VISUAL_SENHA);
  const pagina = await contexto.newPage(); await pagina.goto(`${base}/inbox?c=inbox-demo-beatriz-307`);
  await esperarConteudoApp(pagina, "humano-compositor", "desktop");
  await pagina.getByRole("textbox", { name: "Digite uma mensagem", exact: true }).fill("Mensagem fictícia de teste; não enviar.");
  await pagina.evaluate(() => document.fonts.ready);
  // Probe temporária no próprio nó real, sem mudar fonte, controles ou comportamento. Remove os estilos ao terminar.
  const medidas = await pagina.evaluate(() => {
    const conversa = document.querySelector('section[aria-label="Conversa"]');
    const antes = conversa.getAttribute("style");
    try { return [320, 336, 348, 360, 372, 390, 400, 416, 436].map((width) => {
      conversa.style.width = `${width}px`; conversa.style.flex = `0 0 ${width}px`;
      const entrada = conversa.querySelector('textarea[aria-label="Digite uma mensagem"]');
      const r = conversa.getBoundingClientRect(), campo = entrada.getBoundingClientRect();
      const controles = [...entrada.parentElement.querySelectorAll("button")].map((b) => { const c = b.getBoundingClientRect(); return { nome: b.getAttribute("aria-label") ?? b.textContent, width: c.width, x: c.x - r.x, right: c.right - r.x }; });
      return { thread: width, campo: campo.width, scrollWidth: conversa.scrollWidth, clientWidth: conversa.clientWidth, controles, todosDentro: controles.every((c) => c.x >= 0 && c.right <= width) && campo.right <= r.right };
    }); } finally { if (antes === null) conversa.removeAttribute("style"); else conversa.setAttribute("style", antes); }
  });
  await writeFile(new URL("limites-compositor.json", import.meta.url), JSON.stringify({ tipo: "probe CSS temporária no compositor humano real preenchido; não é screenshot de aceite", medidas }, null, 2));
  process.stdout.write(JSON.stringify(medidas.map((m) => ({ thread: m.thread, campo: m.campo, dentro: m.todosDentro, overflow: m.scrollWidth > m.clientWidth }))) + "\n");
} finally { await contexto.close(); await browser.close(); }
