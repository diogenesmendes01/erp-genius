// Recalcula as métricas automatizáveis das seções 7.1 a 7.6 de docs/42-auditoria-frontend-ux.md.
// Node puro, sem dependência. Uso:
//   node scripts/medicao-ux/metricas.mjs [raiz]            (raiz = pasta com src/ e tailwind.config.ts; padrão: o repositório)
//   node scripts/medicao-ux/metricas.mjs [raiz] --json
// Para medir a linha de base: git archive 9bd583d2 src tailwind.config.ts | tar -x -C <pasta> e passar <pasta> como raiz.
// Arquivos *.test.ts(x) e src/test ficam de fora (medimos código de produção, nos dois lados da comparação).
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, basename, relative, sep } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const RAIZ = args.find((a) => !a.startsWith("--")) ?? join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = join(RAIZ, "src");

function listar(dir) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) saida.push(...listar(p));
    else saida.push(p);
  }
  return saida;
}
const rel = (f) => relative(RAIZ, f).split(sep).join("/");
const ehTeste = (f) => /\.test\.tsx?$/.test(f) || rel(f).startsWith("src/test/");
const todos = listar(SRC).filter((f) => !ehTeste(f));
const cache = new Map();
const ler = (f) => (cache.has(f) ? cache.get(f) : (cache.set(f, readFileSync(f, "utf8")), cache.get(f)));
const TSX = todos.filter((f) => f.endsWith(".tsx"));
const TS_TSX = todos.filter((f) => /\.tsx?$/.test(f));
const em = (prefixo) => (f) => rel(f).startsWith(prefixo);

// conta linhas que casam (equivale a grep -rn ... | wc -l)
const linhas = (arqs, re) => arqs.reduce((n, f) => n + ler(f).split("\n").filter((l) => re.test(l)).length, 0);
// conta ocorrências (equivale a grep -ro ... | wc -l)
const ocorr = (arqs, re) => arqs.reduce((n, f) => n + [...ler(f).matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"))].length, 0);
const arquivosCom = (arqs, re) => arqs.filter((f) => re.test(ler(f)));

const M = {};
const put = (sec, nome, valor, nota = "") => ((M[sec] ??= []).push({ nome, valor, nota }));

// ---------- 7.1 estado de rota ----------
const APP = todos.filter(em("src/app/"));
const paginas = APP.filter((f) => basename(f) === "page.tsx");
const especiais = (nome) => APP.filter((f) => basename(f) === nome);
const cobertura = (nome) =>
  paginas.filter((p) => {
    let d = dirname(p);
    while (rel(d).startsWith("src/app")) {
      if (existsSync(join(d, nome))) return true;
      d = dirname(d);
    }
    return false;
  }).length;
put("7.1", "page.tsx", paginas.length);
put("7.1", "loading.tsx", especiais("loading.tsx").length, `páginas cobertas por herança: ${cobertura("loading.tsx")}/${paginas.length}`);
put("7.1", "error.tsx", especiais("error.tsx").length, `páginas cobertas por herança: ${cobertura("error.tsx")}/${paginas.length}`);
put("7.1", "not-found.tsx", especiais("not-found.tsx").length);
put("7.1", "global-error.*", APP.filter((f) => /^global-error\./.test(basename(f))).length);
put("7.1", "notFound() (linhas)", linhas(TS_TSX, /notFound\(\)/), `arquivos: ${arquivosCom(TS_TSX, /notFound\(\)/).length}`);
put("7.1", "<Suspense (linhas)", linhas(TSX, /<Suspense/));

// ---------- 7.2 cor fora do token ----------
const config = (await import(pathToFileURL(join(RAIZ, "tailwind.config.ts")).href)).default;
const cores = config.theme?.extend?.colors ?? {};
const MAPA = new Map(Object.entries(cores).filter(([, v]) => typeof v === "object").map(([n, s]) => [n, new Set(Object.keys(s).map(Number))]));
const PADRAO = new Set("slate gray zinc neutral stone red orange amber yellow lime green emerald teal cyan sky blue indigo violet purple fuchsia pink rose".split(" "));
const UTIL_COR = /(?<![\w-])(?:[a-z0-9-]+:)*!?(?:bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|outline|divide|from|via|to|fill|stroke|placeholder|accent|caret|decoration)-([a-z]+)-(\d{2,3})(?:\/\d+)?(?![\w-])/g;
let fora = 0, mapeadas = 0;
const arqsFora = new Set();
for (const f of TSX) {
  for (const m of ler(f).matchAll(UTIL_COR)) {
    const [, cor, shade] = m;
    const perm = MAPA.get(cor);
    if (perm ? !perm.has(Number(shade)) : PADRAO.has(cor)) (fora++, arqsFora.add(f));
    else if (perm) mapeadas++;
  }
}
put("7.2", "arquivos com bg-brand-700", arquivosCom(TSX, /bg-brand-700/).length);
put("7.2", "bg-white (linhas)", linhas(TSX, /bg-white/), `arquivos: ${arquivosCom(TSX, /bg-white/).length}`);
put("7.2", "shades fora do mapa (ocorrências)", fora, `arquivos: ${arqsFora.size}`);
put("7.2", "classes dark: (linhas)", linhas(TSX, /dark:/));
put("7.2", "shadow- (linhas)", linhas(TSX, /shadow-/), "inclui shadow-none e textos");
put("7.2", "% classe de cor fora do token", `${((100 * fora) / (fora + mapeadas)).toFixed(1)}%`, `${fora} / (${fora} + ${mapeadas} mapeadas)`);

// ---------- 7.3 design system ----------
const BOTAO_LITERAL = /className="[^"]*bg-brand-(600|700)[^"]*"/g;
const BOTAO_AMPLO = /className="[^"]*bg-brand-(600|700|solid)[^"]*"/g;
const distintas = (re) => new Set(TSX.flatMap((f) => [...ler(f).matchAll(re)].map((m) => m[0]))).size;
put("7.3", "strings distintas do botão primário (critério da auditoria)", distintas(BOTAO_LITERAL), "bg-brand-600|700 em className literal");
put("7.3", "strings distintas do botão primário (com bg-brand-solid)", distintas(BOTAO_AMPLO));
put("7.3", "arquivos que usam Botao/botaoClasses", arquivosCom(TSX, /\b(botaoClasses|<Botao\b)/).length);
put("7.3", "importações de @/components/*", ocorr(TSX, /from "@\/components\/[A-Za-z]*"/));
put("7.3", "componentes em src/components", todos.filter((f) => rel(f).startsWith("src/components/") && f.endsWith(".tsx")).length);
let headings = 0, semMedium = 0;
for (const f of TSX) for (const m of ler(f).matchAll(/<h[1-3]\b[^>]*>/g)) (headings++, /font-medium/.test(m[0]) || semMedium++);
const css = existsSync(join(SRC, "app", "globals.css")) ? readFileSync(join(SRC, "app", "globals.css"), "utf8") : "";
const regraHeading = /h1,[\s\S]{0,80}?font-weight:\s*500/.test(css);
put("7.3", "headings h1-h3 sem font-medium na classe", `${semMedium} de ${headings}`, regraHeading ? "regra global font-weight 500 em globals.css: SIM (peso resolvido pela base)" : "sem regra global");
put("7.3", "font-semibold (linhas)", linhas(TSX, /font-semibold/));
put("7.3", "mapas de rótulo ad-hoc (src/app + src/components)", ocorr(TSX.filter((f) => em("src/app/")(f) || em("src/components/")(f)), /(const|function) (rotulo|rotulos|ROTULO|ROTULOS)[A-Za-z0-9_]*/));
// enum cru: {x.status|situacao|estado|tipo} como filho de texto do JSX (não atributo, não argumento de função)
const ENUM_CRU = /(?<![=(,?:]\s*)(?<![\w$])\{\s*[\w$]+(?:[?!]?\.[\w$]+)*[?!]?\.(status|situacao|estado|tipo)\s*\}/g;
put("7.3", "enum cru em texto ({x.status|situacao|estado|tipo} fora de atributo)", ocorr(TSX, ENUM_CRU), `arquivos: ${arquivosCom(TSX, new RegExp(ENUM_CRU.source)).length}; heurística — a auditoria leu caso a caso, e o rótulo pode já vir mapeado na consulta`);
put("7.3", "{valor} {moeda} cru (linhas)", linhas(TSX, /\{[^{}]*\}\s*\{[\w.?]*moeda\}/));
put("7.3", "data ISO crua (.vencimento/.competencia/.coberturaInicio em {…})", linhas(TSX, /\{[\w.?]*\.(vencimento|competencia|coberturaInicio)\}/));
put("7.3", "redações distintas de \"Resultado não confirmado\"", new Set(TS_TSX.flatMap((f) => [...ler(f).matchAll(/"Resultado não confirmado[^"]*"/g)].map((m) => m[0]))).size, `usos de MSG_*_INCERT*: ${ocorr(TSX, /MSG_(RESULTADO_INCERTO|DECISAO_INCERTA)\w*/)}`);
put("7.3", "códigos de spec na tela (Q23|Q92|Q165|M01|(S15)) em src/app", linhas(TSX.filter(em("src/app/")), /Q23|Q92|Q165|M01|\(S15\)/), "linhas; inclui comentários");

// ---------- 7.4 acessibilidade ----------
// Varre cada <input|select|textarea …> respeitando chaves e aspas (atributos JSX podem conter "=>").
function tags(texto, nomes) {
  const re = new RegExp(`<(${nomes})\\b`, "g");
  const saida = [];
  for (const m of texto.matchAll(re)) {
    let i = m.index + m[0].length, prof = 0, aspas = null;
    for (; i < texto.length; i++) {
      const c = texto[i];
      if (aspas) { if (c === aspas) aspas = null; continue; }
      if (c === '"' || c === "'" || c === "`") aspas = c;
      else if (c === "{") prof++;
      else if (c === "}") prof--;
      else if (c === ">" && prof === 0) break;
    }
    saida.push({ pos: m.index, tag: m[1], texto: texto.slice(m.index, i + 1) });
  }
  return saida;
}
let controles = 0, semNome = 0, dentroLabel = 0, comAria = 0, comHtmlFor = 0;
const arqsSemNome = new Set();
for (const f of TSX) {
  const t = ler(f);
  for (const c of tags(t, "input|select|textarea")) {
    if (/type="(hidden|submit|button|reset)"/.test(c.texto)) continue;
    controles++;
    const antes = t.slice(0, c.pos);
    const abertos = (antes.match(/<label\b/g) ?? []).length - (antes.match(/<\/label>/g) ?? []).length;
    if (/aria-label(ledby)?=/.test(c.texto)) { comAria++; continue; }
    if (abertos > 0) { dentroLabel++; continue; }
    const id = c.texto.match(/\bid=("[^"]+"|\{[^}]+\})/);
    if (id && t.includes(`htmlFor=${id[1]}`)) { comHtmlFor++; continue; }
    semNome++; arqsSemNome.add(f);
  }
}
put("7.4", "controles sem nome acessível", semNome, `${arqsSemNome.size} arquivos; de ${controles} controles (${dentroLabel} dentro de <label>, ${comAria} com aria-label, ${comHtmlFor} com id↔htmlFor). Heurística estática: não segue {...props}`);
put("7.4", "aria-invalid (ocorrências)", ocorr(TSX, /aria-invalid/), `required: ${ocorr(TSX, /\brequired\b/)}`);
const overlays = arquivosCom(TSX, /fixed inset-0/);
const overlaysOk = overlays.filter((f) => { const t = ler(f); return /"dialog"/.test(t) && /aria-modal/.test(t) && /Escape/.test(t); });
put("7.4", "overlays fixed inset-0 com role=dialog + aria-modal + Escape", `${overlaysOk.length} de ${overlays.length}`, `${overlays.map((f) => basename(f)).join(", ")}; usos de <Modal/<Drawer: ${ocorr(TSX, /<(Modal|Drawer)\b/)}`);
put("7.4", "regra focus-visible em globals.css (linhas)", css.split("\n").filter((l) => /focus-visible/.test(l)).length);
put("7.4", "outline-none sem focus:ring na linha", ler.length && TSX.reduce((n, f) => n + ler(f).split("\n").filter((l) => /outline-none/.test(l) && !/focus:ring/.test(l)).length, 0), `outline-none total (linhas): ${linhas(TSX, /outline-none/)}`);
const comErro = arquivosCom(TSX, /setErro/);
const semLive = comErro.filter((f) => !/role="alert"/.test(ler(f)));
const semLiveAjust = semLive.filter((f) => !/<(FeedbackAcao|MensagemStatus|EstadoRota)\b/.test(ler(f)));
put("7.4", "telas com setErro e sem role=\"alert\"", semLive.length, `${semLiveAjust.length} se FeedbackAcao/MensagemStatus contarem como live region (de ${comErro.length} com setErro)`);
const sidebar = existsSync(join(SRC, "components", "Sidebar.tsx")) ? readFileSync(join(SRC, "components", "Sidebar.tsx"), "utf8") : "";
const layoutApp = existsSync(join(SRC, "app", "(app)", "layout.tsx")) ? readFileSync(join(SRC, "app", "(app)", "layout.tsx"), "utf8") : "";
put("7.4", "skip link / aria-current (Sidebar + (app)/layout)", `${(sidebar + layoutApp).match(/Pular para/g)?.length ?? 0} / ${sidebar.match(/aria-current/g)?.length ?? 0}`);

// contraste WCAG a partir dos tokens de globals.css
function tokens(bloco) {
  const m = css.match(new RegExp(`${bloco}\\s*\\{([\\s\\S]*?)\\n\\}`));
  const t = {};
  if (m) for (const x of m[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)) t[x[1]] = x[2].trim();
  return t;
}
const hex = (s) => { const h = s.replace("#", ""); const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h; return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16)); };
const cor = (s, fundo) => {
  const r = s.match(/rgba?\(([^)]+)\)/);
  if (!r) return hex(s);
  const [R, G, B, A = 1] = r[1].split(",").map(Number);
  return [R, G, B].map((v, i) => v * A + fundo[i] * (1 - A));
};
const lum = (rgb) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const claro = tokens(":root"), escuro = { ...claro, ...tokens("\\.dark") };
const reprovados = [];
for (const [nomeTema, T] of [["claro", claro], ["escuro", escuro]]) {
  const sup = ["--bg-page", "--surface", "--surface-muted"].filter((k) => T[k]);
  for (const s of sup) {
    const fundo = hex(T[s]);
    const c = contraste(cor(T["--text-terciary"], fundo), fundo);
    if (c < 4.5) reprovados.push(`${nomeTema}: --text-terciary/${s} ${c.toFixed(2)}`);
    for (const [k, alvo] of [["--border-control", 3], ["--border", 3], ["--brand-border", 3]]) {
      if (!T[k]) continue;
      const cb = contraste(cor(T[k], fundo), fundo);
      if (cb < alvo) reprovados.push(`${nomeTema}: ${k}/${s} ${cb.toFixed(2)}`);
    }
  }
  for (const k of ["--brand", "--brand-solid"]) {
    if (!T[k]) continue;
    const c = contraste([255, 255, 255], hex(T[k]));
    if (c < 4.5) reprovados.push(`${nomeTema}: #fff/${k} ${c.toFixed(2)}`);
  }
}
const familias = new Set(reprovados.map((r) => r.split(" ")[1].split("/")[0] + (r.includes("#fff") ? "" : "")));
put("7.4", "pares de token reprovando AA", `${familias.size} famílias`, reprovados.join("; ") || "nenhum");

// ---------- 7.5 listas ----------
const UI = TSX.filter((f) => em("src/app/")(f) || em("src/components/")(f));
put("7.5", "arquivos com useSearchParams", arquivosCom(UI, /useSearchParams/).length, `arquivos com useFiltrosUrl: ${arquivosCom(UI, /useFiltrosUrl/).length}; page.tsx que leem searchParams: ${paginas.filter((p) => /searchParams/.test(ler(p))).length}`);
put("7.5", "placeholder=\"Buscar (linhas em src/app)", linhas(TSX.filter(em("src/app/")), /placeholder="Buscar/), `campos type="search": ${ocorr(TSX, /type="search"/)}`);
put("7.5", "contador \"de {itens.length}\"", linhas(TSX.filter(em("src/app/")), /de \{itens\.length\}/), `padrão amplo {a} de {b}: ${linhas(UI, /\}\s+de\s+\{[^}]*(length|total)[^}]*\}/)}`);
const comTabela = arquivosCom(TSX, /<table\b/);
const largasSemScroll = comTabela.filter((f) => (ler(f).match(/<th\b/g) ?? []).length >= 7 && !/overflow-x/.test(ler(f)));
// por tabela: <th> dentro do bloco <table>…</table> e overflow-x nos 400 caracteres antes da abertura
let tabelas = 0, tabelasLargas = 0, largasSemScrollT = 0, tabelasOverflowHidden = 0;
for (const f of comTabela) {
  const t = ler(f);
  for (const m of t.matchAll(/<table\b[\s\S]*?<\/table>/g)) {
    tabelas++;
    const antes = t.slice(Math.max(0, m.index - 400), m.index);
    if (/overflow-hidden/.test(antes.slice(-200)) && !/overflow-x/.test(antes)) tabelasOverflowHidden++;
    if ((m[0].match(/<th\b/g) ?? []).length >= 7) (tabelasLargas++, /overflow-x/.test(antes) || largasSemScrollT++);
  }
}
put("7.5", "tabelas 7+ colunas sem overflow-x", `${largasSemScrollT} de ${tabelasLargas} tabelas largas (${tabelas} tabelas em ${comTabela.length} arquivos)`, `por arquivo (≥7 <th> no arquivo e nenhum overflow-x): ${largasSemScroll.length}; wrappers overflow-hidden sem overflow-x: ${tabelasOverflowHidden}`);
const comProxima = arquivosCom(TSX, /Próxima/);
const comProximx = arquivosCom(TSX, /Próxim[ao]s?\b/);
put("7.5", "paginações só para frente (\"Próxima\" sem \"Anterior\")", `${comProxima.filter((f) => !/Anterior/.test(ler(f))).length} de ${comProxima.length}`, `Próxim[ao]s? sem Anterior: ${comProximx.filter((f) => !/Anterior/.test(ler(f))).length} de ${comProximx.length}; arquivos que usam <Paginacao: ${arquivosCom(TSX, /<Paginacao\b/).length}`);
put("7.5", "aria-sort (linhas)", linhas(TSX, /aria-sort/), `usos de <ColunaOrdenavel: ${ocorr(TSX, /<ColunaOrdenavel\b/)}`);

// ---------- 7.6 robustez ----------
const cliente = TSX.filter((f) => /^["']use client["']/m.test(ler(f)));
const chamaAcao = cliente.filter((f) => /from "@\/server\//.test(ler(f)));
const semCatch = chamaAcao.filter((f) => !/catch/.test(ler(f)));
const semCatchAjust = semCatch.filter((f) => !/useAcaoCliente|executarAcaoCliente|criarExecutor/.test(ler(f)));
put("7.6", "client components com server action e sem catch", `${semCatch.length} de ${chamaAcao.length}`, `${semCatchAjust.length} se useAcaoCliente/executarAcaoCliente contar como catch central`);
const comRefresh = arquivosCom(TSX, /router\.refresh\(\)/);
const soRefresh = comRefresh.filter((f) => !/setMensagem|setSucesso|setAviso|setNota/i.test(ler(f)));
const soRefreshAjust = soRefresh.filter((f) => !/sucesso:|useAcaoCliente|<MensagemStatus|<FeedbackAcao[^>]*sucesso/.test(ler(f)));
put("7.6", "fluxos que terminam só em router.refresh()", `${soRefresh.length} de ${comRefresh.length}`, `${soRefreshAjust.length} se mensagem de sucesso via useAcaoCliente/FeedbackAcao/MensagemStatus contar`);
const TSX_LIB = [...TSX, ...TS_TSX.filter(em("src/lib/"))];
put("7.6", ".focus() / scrollIntoView (linhas)", `${linhas(TSX_LIB, /\.focus\(/)} / ${linhas(TSX_LIB, /scrollIntoView/)}`, "tsx + src/lib");
let dinheiroNumber = 0;
for (const f of TSX) for (const c of tags(ler(f), "input")) if (/type="number"/.test(c.texto) && /step="0\.01"/.test(c.texto)) dinheiroNumber++;
put("7.6", "dinheiro em type=number step=0.01", linhas(TSX, /<input[^>]*type="number"[^>]*step="0\.01"/), `varredura de tag multilinha: ${dinheiroNumber}; usos de <CampoMoeda: ${ocorr(TSX, /<CampoMoeda\b/)}`);
put("7.6", "campos de fuso em texto (name=\"fuso)", linhas(TSX, /name="fuso/), `defaultValue="UTC": ${linhas(TSX, /defaultValue="UTC"/)}; usos de <CampoFuso: ${ocorr(TSX, /<CampoFuso\b/)}`);

// ---------- extras (citados nas seções 4 e 5, sem tabela própria na 7) ----------
put("extras", "grid-cols-2 sem prefixo de breakpoint (ocorrências)", ocorr(TSX, /(?<![\w:-])grid-cols-2(?![\w-])/));
put("extras", "page/layout com metadata ou generateMetadata", APP.filter((f) => /^(page|layout)\.tsx$/.test(basename(f)) && /export (const metadata|async function generateMetadata|function generateMetadata)/.test(ler(f))).length);
put("extras", "classes de mostrar/esconder por breakpoint (md:hidden | hidden md:)", ocorr(TSX, /\b(md:hidden|sm:hidden|hidden (sm|md|lg):)/));
put("extras", "toISOString() impresso como texto (seguido de texto, ponto ou tag)", ocorr(TSX, /\{[^{}]*toISOString\(\)[^{}]*\}\s*(\(UTC\)|\.|<\/)/), `toISOString() em qualquer {…} (inclui valor de campo e payload): ${linhas(TSX, /\{[^{}]*toISOString\(\)[^{}]*\}/)}`);
put("extras", "beforeunload", ocorr(TS_TSX, /beforeunload/));
put("extras", "window.confirm / confirm(", ocorr(TSX, /\bconfirm\(/));
put("extras", "<textarea com minLength e sem contador (textarea crus)", ocorr(TSX, /<textarea\b[^>]*minLength/), `usos de <CampoTexto: ${ocorr(TSX, /<CampoTexto\b/)}`);
put("extras", "<p>Nenhum… cru (estado vazio sem componente)", ocorr(TSX, /<p>\s*Nenhum/), `usos de <EstadoVazio: ${ocorr(TSX, /<EstadoVazio\b/)}`);

// ---------- saída ----------
if (args.includes("--json")) console.log(JSON.stringify(M, null, 1));
else for (const [sec, itens] of Object.entries(M)) {
  console.log(`\n## ${sec}`);
  for (const { nome, valor, nota } of itens) console.log(`- ${nome}: ${valor}${nota ? `  (${nota})` : ""}`);
}
