// Fotografa páginas de um PDF no visualizador do Chromium. Uso: node docs/qa/pdf/paginas.mjs <nome-sem-ext> <pagina> [<pagina>...]
import { chromium } from "playwright";
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const pasta = dirname(fileURLToPath(import.meta.url));
const [nome, ...paginas] = process.argv.slice(2);
const b = await chromium.launch({ headless: false, args: ["--window-size=900,1300"] });
const ctx = await b.newContext({ viewport: { width: 880, height: 1245 } });
const p = await ctx.newPage();
for (const pg of paginas) {
  await p.goto(pathToFileURL(join(pasta, nome + ".pdf")).href + `#page=${pg}&zoom=100&toolbar=0`);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: join(pasta, `${nome}.p${pg}.png`) });
  console.log("ok", nome, pg);
}
await b.close();
