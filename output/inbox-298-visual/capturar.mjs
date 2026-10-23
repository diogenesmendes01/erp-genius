import fs from "node:fs";
import path from "node:path";
import cp from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IconCircle, IconCircleCheck } from "@tabler/icons-react";
import postcss from "postcss";
import tailwind from "tailwindcss";
import { chromium } from "playwright";

// O JSX extraído é transpilado para CommonJS; só sua avaliação e a config TS usam este loader.
const requireForCapture = createRequire(import.meta.url);
const captureDir = fileURLToPath(new URL(".", import.meta.url));
const root = path.resolve(captureDir, "../..");
const base = "3dbd3df803ef840bf2190cec9d4fc98d4a05a755";
const sources = {
  enquete: "src/components/conversa/EnqueteLeitura.tsx",
  reserva: "src/app/(app)/alunos/[id]/creditos/[creditoId]/DevolucaoCredito.tsx",
};
const fontData = fs.readFileSync(path.join(root, "src/app/fonts/roboto-variable.woff2")).toString("base64");
const viewport = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
];
function loadFunction(source, name, globals) {
  const sf = ts.createSourceFile("componente.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const decl = sf.statements.find((n) => ts.isFunctionDeclaration(n) && n.name && n.name.text === name);
  if (!decl) throw new Error("Function not found: " + name);
  const code = decl.getText(sf) + (decl.modifiers && decl.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ? "" : "\nexports." + name + " = " + name + ";");
  const js = ts.transpileModule(code, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  const names = Object.keys(globals);
  new Function("require", "module", "exports", ...names, js)(requireForCapture, mod, mod.exports, ...Object.values(globals));
  return mod.exports[name];
}
function render(name, stage) {
  const src = stage === "antes"
    ? cp.execFileSync("git", ["show", base + ":" + sources[name]], { cwd: root, encoding: "utf8" })
    : fs.readFileSync(path.join(root, sources[name]), "utf8");
  if (name === "enquete") {
    const Comp = loadFunction(src, "EnqueteLeitura", { IconCircle, IconCircleCheck });
    return renderToStaticMarkup(React.createElement(Comp, { enquete: {
      nome: "Enquete de leitura",
      selecionavel: 1,
      opcoes: [
        { texto: "Aula pela manhã", votos: 7, escolhida: true },
        { texto: "Aula à noite", votos: 3 },
      ],
    } }));
  }
  const Comp = loadFunction(src, "Reserva", {
    rotular: (_labels, estado) => estado === "AGUARDANDO_EXECUCAO" ? "Aguardando execução" : estado,
    ESTADO_RESERVA_DEVOLUCAO_CREDITO_LABEL: {},
  });
  const dados = { decisao: { reserva: {
    id: "reserva-visual",
    estado: "AGUARDANDO_EXECUCAO",
    referenciaExterna: null,
    evidenciaExecucao: null,
    cancelamento: null,
    conciliacoes: [],
  } }, podeCancelar: false, podeExecutar: false, podeConciliar: false };
  return renderToStaticMarkup(React.createElement(Comp, {
    dados, ocupado: false, enviar: () => {}, chavesExecucao: { current: new Map() },
  }));
}
function documentHtml(name, stage, theme, markup, css) {
  const title = name === "enquete" ? "EnqueteLeitura" : "Reserva de devolução de crédito";
  return '<!doctype html><html lang="pt-BR" class="' + (theme === "escuro" ? "dark" : "") + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css + '</style><style>@font-face{font-family:RobotoLocal;src:url(data:font/woff2;base64,' + fontData + ') format(woff2);font-weight:100 900}:root{--font-sans:RobotoLocal}main{max-width:640px;margin:40px auto;padding:24px;background:var(--surface);border:1px solid var(--border);border-radius:12px}@media(max-width:500px){main{margin:16px;padding:16px}}</style></head><body><main data-capture="' + name + '"><h1 style="font-size:18px;font-weight:600;margin-bottom:16px">' + title + ' · ' + stage + ' · ' + theme + '</h1>' + markup + '</main></body></html>';
}
(async () => {
  const markup = {};
  for (const name of Object.keys(sources)) for (const stage of ["antes", "depois"]) {
    markup[name + "-" + stage] = render(name, stage);
  }
  const config = requireForCapture(path.join(root, "tailwind.config.ts")).default;
  const cssPath = path.join(root, "src/app/globals.css");
  const allHtml = Object.values(markup).join("\n") + " bg-page text-gray-900";
  const result = await postcss([tailwind({ ...config, content: [{ raw: allHtml, extension: "html" }] })])
    .process(fs.readFileSync(cssPath, "utf8"), { from: cssPath });
  const browser = await chromium.launch({ headless: true });
  const metrics = [];
  try {
    for (const name of Object.keys(sources)) for (const stage of ["antes", "depois"]) for (const theme of ["claro", "escuro"]) {
      const page = await browser.newPage({ viewport: viewport[0], deviceScaleFactor: 1 });
      await page.setContent(documentHtml(name, stage, theme, markup[name + "-" + stage], result.css));
      const selector = name === "enquete" ? "[data-enquete] li:first-child i" : '[data-capture="reserva"] > div';
      const bg = await page.locator(selector).evaluate((el) => getComputedStyle(el).backgroundColor);
      metrics.push({ componente: name, versao: stage, tema: theme, background: bg });
      if (stage === "antes" && bg !== "rgba(0, 0, 0, 0)") throw new Error("Before state unexpectedly has background: " + JSON.stringify(metrics.at(-1)));
      if (stage === "depois" && bg === "rgba(0, 0, 0, 0)") throw new Error("After state has no background: " + JSON.stringify(metrics.at(-1)));
      for (const v of viewport) {
        await page.setViewportSize(v);
        const file = name + "-" + stage + "-" + theme + "-" + v.width + "x" + v.height + ".png";
        await page.screenshot({ path: path.join(captureDir, file), fullPage: false });
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(captureDir, "metricas.json"), JSON.stringify({
    fonteAntes: base,
    fonteDepois: cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    notas: "Funções JSX reais extraídas por TypeScript AST. Reserva usa apenas dados de fixture e rótulo de estado injetado; ações não são executadas. CSS gerado do globals.css e tailwind.config.ts reais. Captura de componente isolado, não homologação do fluxo financeiro.",
    metricas: metrics,
  }, null, 2) + "\n");
  console.log(JSON.stringify(metrics, null, 2));
})().catch((e) => { console.error(e); process.exitCode = 1; });
