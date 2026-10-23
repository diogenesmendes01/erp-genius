import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import postcss from "postcss";
import tailwind from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme.js";
import { chromium } from "playwright";

const base = new URL(process.env.INBOX_VISUAL_BASE ?? "http://localhost:3110");
if (!["localhost", "127.0.0.1"].includes(base.hostname) || base.port !== "3110" || base.protocol !== "http:") throw new Error("Use somente o servidor DEV A local na porta 3110.");
const email = process.env.INBOX_VISUAL_EMAIL, senha = process.env.INBOX_VISUAL_PASSWORD;
if (!email || !senha) throw new Error("Informe credenciais fictícias locais por INBOX_VISUAL_EMAIL/PASSWORD; não as publique.");
const pasta = path.resolve("output/inbox-306-visual");
await fs.mkdir(pasta, { recursive: true });
const require = createRequire(import.meta.url);
const hash = (texto) => createHash("sha256").update(texto).digest("hex");
const avaliar = (texto, escopo = {}) => {
  const js = ts.transpileModule(texto, { fileName: "amostra.tsx", compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React } }).outputText;
  const exports = {};
  new Function("require", "exports", "React", ...Object.keys(escopo), js)(require, exports, React, ...Object.values(escopo));
  return exports.default;
};
const fontMono = (n) => {
  const abertura = ts.isJsxElement(n) ? n.openingElement : ts.isJsxSelfClosingElement(n) ? n : null;
  return abertura?.attributes.properties.some((p) => ts.isJsxAttribute(p) && p.name.getText() === "className" && p.initializer && ts.isStringLiteral(p.initializer) && p.initializer.text.split(" ").includes("font-mono"));
};
const dados = { codigo: "A1B2C3D4E5F6", p: { pdfHash: "ab".repeat(32), transcricaoHash: "cd".repeat(32) }, campo: { chave: "nome_contratante" } };
const definicoes = [
  { nome: "Código de certificado (12 hex, formato do gerador)", arquivo: "src/app/certificado/[codigo]/page.tsx", alvo: "codigo.toUpperCase", pai: true, contexto: "rounded-lg border border-green-200 bg-green-50 p-4 text-sm" },
  { nome: "Hash SHA-256 do PDF (64 caracteres)", arquivo: "src/app/(app)/matriculas/[id]/contrato/origem-historica/page.tsx", alvo: "p.pdfHash" },
  { nome: "Hash da transcrição (64 caracteres)", arquivo: "src/app/(app)/matriculas/[id]/contrato/origem-historica/page.tsx", alvo: "p.transcricaoHash" },
  { nome: "Input de conferência (rolagem própria esperada)", arquivo: "src/app/(app)/matriculas/[id]/contrato/origem-historica/Formularios.tsx", alvo: 'name="pdfHashConferido"', pai: true },
  { nome: "Código fictício de pareamento (nenhuma ação de motor)", arquivo: "src/app/(app)/configuracao/whatsapp/NumerosPainel.tsx", alvo: "{codigo}", escopo: { ...dados, codigo: "1234-5678" } },
  { nome: "Variável de contrato: dt solicita 600; faixa local registrada 400–500", arquivo: "src/app/(app)/configuracao/contratos/[codigo]/page.tsx", alvo: "campo.chave" },
];
const proveniencia = [];
const elementos = [];
for (const [i, d] of definicoes.entries()) {
  const texto = await fs.readFile(d.arquivo, "utf8"), fonte = ts.createSourceFile(d.arquivo, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let escolhido;
  const visitar = (n) => { if (!escolhido && fontMono(n) && n.getText(fonte).includes(d.alvo)) escolhido = d.pai ? n.parent : n; ts.forEachChild(n, visitar); };
  visitar(fonte);
  if (!escolhido) throw new Error(`Trecho real não encontrado: ${d.arquivo} (${d.alvo})`);
  const jsx = escolhido.getText(fonte), Componente = avaliar(`const Trecho = () => (${jsx}); export default Trecho;`, d.escopo ?? dados);
  proveniencia.push({ nome: d.nome, arquivo: d.arquivo, linha: fonte.getLineAndCharacterOfPosition(escolhido.getStart(fonte)).line + 1, sha256Trecho: hash(jsx), jsx });
  elementos.push(React.createElement("section", { key: i, "data-amostra": i, style: { padding: 12, border: "1px solid var(--border)", borderRadius: 10 } },
    React.createElement("h2", { className: "text-sm font-medium", style: { marginBottom: 8 } }, d.nome),
    React.createElement("div", { className: d.contexto ?? "", "data-trecho": i }, React.createElement(Componente))));
}
const tokens = React.createElement("section", { className: "fundo-conversa", style: { padding: 12, display: "flex", gap: 12, flexWrap: "wrap" } },
  ...Array.from({ length: 8 }, (_, i) => React.createElement("span", { key: i, className: `bg-avatar-${i + 1} text-white`, style: { padding: 8, borderRadius: 8 } }, `A${i + 1}`)),
  React.createElement("span", { className: "bg-bubble-ia text-ai-700", style: { padding: 8 } }, "Aria · IA"),
  React.createElement("span", { className: "bg-bubble-note text-amber-700", style: { padding: 8 } }, "Nota interna"));
const html = renderToStaticMarkup(React.createElement("main", { id: "prova-mono", style: { padding: 16, display: "grid", gap: 12, maxWidth: 1000, margin: "0 auto" } },
  React.createElement("h1", { className: "text-xl font-medium", id: "fase-mono" }, "Prova isolada #306"),
  React.createElement("p", { id: "prova-sans", className: "font-sans text-sm" }, "Roboto permanece na interface. Trechos reais com dados fictícios; nenhuma ação de negócio."), tokens, ...elementos));
const config = avaliar(await fs.readFile("tailwind.config.ts", "utf8"));
const css = (await postcss([tailwind({ ...config, content: [{ raw: html, extension: "html" }] })]).process(await fs.readFile("src/app/globals.css", "utf8"), { from: undefined })).css;
const pilhaAnterior = defaultTheme.fontFamily.mono.join(", ");
const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROMIUM ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const resultados = [];
try {
  for (const [width, height] of [[1440, 900], [1024, 768], [390, 844]]) for (const tema of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const externos = [];
    await context.route("**/*", (r) => {
      if (["localhost", "127.0.0.1"].includes(new URL(r.request().url()).hostname)) return r.continue();
      externos.push(new URL(r.request().url()).hostname); return r.abort();
    });
    await context.addInitScript((t) => localStorage.setItem("tema", t), tema);
    const { csrfToken } = await (await context.request.get(new URL("/api/auth/csrf", base).href)).json();
    const auth = await context.request.post(new URL("/api/auth/callback/credentials", base).href, { headers: { "X-Auth-Return-Redirect": "1" }, form: { csrfToken, email, senha, callbackUrl: new URL("/inbox", base).href } });
    if (!auth.ok()) throw new Error(`Auth local falhou: ${auth.status()}`);
    const page = await context.newPage(); page.setDefaultTimeout(120_000);
    const erros = []; page.on("pageerror", (e) => erros.push(e.message));
    await page.goto(new URL("/inbox", base).href, { waitUntil: "domcontentloaded" });
    await page.locator("[data-vista]").waitFor(); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300);
    const fonte = await page.evaluate(async () => {
      const s = getComputedStyle(document.documentElement), mono = s.getPropertyValue("--font-mono").trim(), sans = s.getPropertyValue("--font-sans").trim();
      if (!mono || !sans) throw new Error("Variável de fonte ausente");
      const familia = mono.split(",")[0].trim();
      const carregadas = await Promise.all([document.fonts.load(`400 16px ${familia}`), document.fonts.load(`500 16px ${familia}`)]);
      await document.fonts.ready;
      const faces = [...document.fonts].map((f) => ({ familia: f.family, peso: f.weight, estado: f.status }));
      const tokens = Object.fromEntries(["--avatar-4", "--bubble-ia", "--bubble-note", "--chat-dot"].map((n) => [n, s.getPropertyValue(n).trim()]));
      return { mono, sans, carregadas: carregadas.map((c) => c.length), faces, tokens, bodyFamily: getComputedStyle(document.body).fontFamily };
    });
    if (fonte.carregadas.some((n) => n === 0) || fonte.tokens["--avatar-4"] !== "#6e62aa") throw new Error("Fonte real/tokens não confirmados");
    await page.screenshot({ path: path.join(pasta, `app-${width}x${height}-${tema}.png`), fullPage: true });
    await page.evaluate(({ html, css }) => {
      for (const filho of document.body.children) if (filho instanceof HTMLElement) filho.style.setProperty("display", "none", "important");
      const style = document.createElement("style"); style.id = "css-prova"; style.textContent = css; document.head.appendChild(style);
      const amostra = document.createElement("div"); amostra.id = "isolado306"; amostra.innerHTML = html; document.body.appendChild(amostra);
      for (const input of amostra.querySelectorAll("input")) { input.value = "ab".repeat(32); input.readOnly = true; }
    }, { html, css });
    const medicoes = [];
    for (const fase of ["anterior-reconstituida", "mono-local"]) {
      await page.evaluate(({ fase, pilhaAnterior }) => {
        document.getElementById("override-mono")?.remove();
        if (fase === "anterior-reconstituida") { const s = document.createElement("style"); s.id = "override-mono"; s.textContent = `#prova-mono .font-mono { font-family: ${pilhaAnterior}; }`; document.head.appendChild(s); }
        document.getElementById("fase-mono").textContent = fase === "mono-local" ? "#306 · JetBrains Mono local (atual)" : "#306 · pilha anterior reconstituída";
      }, { fase, pilhaAnterior });
      await page.evaluate(() => document.fonts.ready);
      const medida = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth,
        sans: getComputedStyle(document.getElementById("prova-sans")).fontFamily,
        amostras: [...document.querySelectorAll("[data-trecho] .font-mono")].map((el) => {
          const s = getComputedStyle(el), r = el.getBoundingClientRect(), p = el.closest("[data-amostra]").getBoundingClientRect();
          return { amostra: el.closest("[data-amostra]").getAttribute("data-amostra"), tag: el.tagName, peso: s.fontWeight, familia: s.fontFamily, largura: r.width, altura: r.height, clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, dentro: r.left >= p.left && r.right <= p.right, quebra: s.wordBreak, tracking: s.letterSpacing, sintese: s.fontSynthesis };
        }),
      }));
      if (medida.documentWidth > width || medida.amostras.some((a) => !a.dentro)) throw new Error(`Overflow externo em ${width}/${tema}/${fase}`);
      if (fase === "mono-local" && medida.amostras.some((a) => a.familia.split(",")[0].replace(/["']/g, "").trim() !== fonte.mono.split(",")[0].replace(/["']/g, "").trim())) throw new Error("Amostra não resolveu a família mono real");
      medicoes.push({ fase, ...medida });
      await page.screenshot({ path: path.join(pasta, `${fase}-${width}x${height}-${tema}.png`), fullPage: true });
    }
    if (medicoes[0].sans !== medicoes[1].sans || medicoes[1].sans.split(",")[0].replace(/["']/g, "").trim() !== fonte.sans.split(",")[0].replace(/["']/g, "").trim()) throw new Error("Sans/Roboto mudou entre as amostras");
    resultados.push({ width, height, tema, fonte, medicoes, erros, externos: [...new Set(externos)] });
    console.log(JSON.stringify({ width, height, tema, facesCarregadas: fonte.carregadas, amostras: medicoes[1].amostras.length, sansPreservada: true, pageErrors: erros.length }));
    await context.close();
  }
} finally { await browser.close(); }
await fs.writeFile(path.join(pasta, "metricas.json"), JSON.stringify({ origem: "Fonte atual no app3110; baseline mono reconstruída pela pilha default do Tailwind3, sem alegar captura do app antigo. Trechos JSX reais extraídos sem imports de ações. CSS compilado de globals/config reais; fontes Next reais carregadas. Só dados fictícios.", pilhaAnterior, proveniencia, resultados }, null, 2) + "\n");
if (resultados.some((r) => r.erros.length || r.externos.length)) throw new Error("Erro de página ou tentativa de recurso externo; verificar manifesto.");
