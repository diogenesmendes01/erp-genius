// Gera os PDFs do kit de QA a partir dos HTML desta pasta (A4, Chromium via Playwright).
//
//   node docs/qa/pdf/render.mjs            → renderiza todos os *.html da pasta
//   node docs/qa/pdf/render.mjs 01-guia    → só os arquivos cujo nome contém "01-guia"
//
// Usa o Chromium que o Playwright já instalou (ms-playwright). Não precisa de servidor.
import { chromium } from "playwright";
import { readdirSync, statSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";

const pasta = dirname(fileURLToPath(import.meta.url));
const filtro = process.argv[2] ?? "";
const arquivos = readdirSync(pasta)
  .filter((f) => f.endsWith(".html") && f.includes(filtro))
  .sort();

if (arquivos.length === 0) {
  console.error("Nenhum .html encontrado em", pasta, filtro ? `com filtro "${filtro}"` : "");
  process.exit(1);
}

const rodape = (titulo) =>
  `<div style="font-family:Roboto,'Segoe UI',sans-serif;font-size:8.5px;color:#6d6c64;width:100%;padding:0 16mm;display:flex;justify-content:space-between;align-items:center">
     <span>ERP Genius · ${titulo}</span>
     <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
   </div>`;

const navegador = await chromium.launch();
try {
  for (const arquivo of arquivos) {
    const pagina = await navegador.newPage();
    await pagina.goto(pathToFileURL(join(pasta, arquivo)).href, { waitUntil: "networkidle" });
    await pagina.evaluate(() => document.fonts.ready);
    const titulo = await pagina.title();
    const saida = join(pasta, basename(arquivo, ".html") + ".pdf");
    await pagina.pdf({
      path: saida,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: rodape(titulo),
      margin: { top: "18mm", right: "16mm", bottom: "20mm", left: "16mm" },
    });
    await pagina.close();
    const kb = Math.round(statSync(saida).size / 1024);
    console.log(`ok  ${basename(saida)}  (${kb} KB)`);
  }
} finally {
  await navegador.close();
}
