// Captura o HTML em mídia de impressão (largura A4) para conferência visual. Uso: node docs/qa/pdf/preview.mjs <nome>
import { chromium } from "playwright";
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const pasta = dirname(fileURLToPath(import.meta.url));
const nome = process.argv[2];
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1 });
await p.emulateMedia({ media: "print" });
await p.goto(pathToFileURL(join(pasta, nome + ".html")).href, { waitUntil: "networkidle" });
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: join(pasta, nome + ".preview.png"), fullPage: true });
await b.close(); console.log("ok");
