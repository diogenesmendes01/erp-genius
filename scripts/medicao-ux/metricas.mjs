// Recalcula as métricas automatizáveis das seções 7.1 a 7.6 de docs/42-auditoria-frontend-ux.md.
// Node ≥ 18 puro, sem dependência (o mapa de cores é lido do texto do tailwind.config.ts, sem
// importar o .ts). Uso:
//   node scripts/medicao-ux/metricas.mjs [raiz] [--json]
//   (raiz = pasta com src/ e tailwind.config.ts; padrão: o repositório)
//
// Linha de base: o commit 1ca53675 — o main que a auditoria leu (pai do branch da auditoria).
// NÃO use o merge da auditoria (9bd583d2): a #64 (bordas de rota) entrou no main antes dele, então
// esse merge já tem loading/error/not-found e outros 10 números diferentes da base.
//   git archive 1ca53675 src tailwind.config.ts | tar -x -C <pasta>
//   node scripts/medicao-ux/metricas.mjs <pasta>
// Arquivos *.test.ts(x) e src/test ficam de fora (código de produção, nos dois lados da comparação).
// A lógica pura está em nucleo.mjs e é testada em src/test/medicao-ux.test.ts.
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ARQUIVO_DO_CAMPO_FUSO, camposDeFuso, instantesCrus } from "./fuso.mjs";
import {
  chamaServerAction, contarCores, ehTeste, exigirNode, mapaDeCores, nomesDeControles, paginasCobertas,
  paresReprovados, semCatchCentral, semCatchLiteral, tags,
} from "./nucleo.mjs";

function listar(raiz, dir = "src") {
  const saida = [];
  for (const nome of readdirSync(join(raiz, dir)).sort()) {
    const rel = `${dir}/${nome}`;
    if (statSync(join(raiz, rel)).isDirectory()) saida.push(...listar(raiz, rel));
    else saida.push(rel);
  }
  return saida;
}

/**
 * Mede a árvore em `raiz`. Devolve as seções para exibição e `n`, com os números brutos.
 * @param {string} raiz
 */
export function medir(raiz) {
  const todos = listar(raiz).filter((f) => !ehTeste(f));
  const cache = new Map();
  const ler = (f) => {
    if (!cache.has(f)) cache.set(f, readFileSync(join(raiz, ...f.split("/")), "utf8"));
    return cache.get(f);
  };
  const base = (f) => f.slice(f.lastIndexOf("/") + 1);
  const dir = (f) => f.slice(0, f.lastIndexOf("/"));
  const em = (prefixo) => (f) => f.startsWith(prefixo);
  const TSX = todos.filter((f) => f.endsWith(".tsx"));
  const TS_TSX = todos.filter((f) => /\.tsx?$/.test(f));
  // linhas que casam (grep -rn | wc -l) e ocorrências (grep -ro | wc -l)
  const linhas = (arqs, re) => arqs.reduce((n, f) => n + ler(f).split("\n").filter((l) => re.test(l)).length, 0);
  const ocorr = (arqs, re) => arqs.reduce((n, f) => n + [...ler(f).matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`))].length, 0);
  const arquivosCom = (arqs, re) => arqs.filter((f) => re.test(ler(f)));

  const secoes = {};
  const n = {};
  const put = (sec, nome, valor, nota = "") => {
    secoes[sec] ??= [];
    secoes[sec].push({ nome, valor, nota });
  };

  // ---------- 7.1 estado de rota ----------
  const APP = todos.filter(em("src/app/"));
  const paginas = APP.filter((f) => base(f) === "page.tsx");
  const especiais = (nome) => APP.filter((f) => base(f) === nome);
  const cobertas = (nome) => paginasCobertas(paginas, new Set(especiais(nome).map(dir)));
  n.paginas = paginas.length;
  n.loading = especiais("loading.tsx").length;
  n.loadingCobertas = cobertas("loading.tsx");
  n.error = especiais("error.tsx").length;
  n.errorCobertas = cobertas("error.tsx");
  n.notFound = especiais("not-found.tsx").length;
  n.globalError = APP.filter((f) => /^global-error\./.test(base(f))).length;
  n.chamadasNotFound = linhas(TS_TSX, /notFound\(\)/);
  n.suspense = linhas(TSX, /<Suspense/);
  put("7.1", "page.tsx", n.paginas);
  put("7.1", "loading.tsx", n.loading, `páginas cobertas por herança: ${n.loadingCobertas}/${n.paginas}`);
  put("7.1", "error.tsx", n.error, `páginas cobertas por herança: ${n.errorCobertas}/${n.paginas}`);
  put("7.1", "not-found.tsx", n.notFound);
  put("7.1", "global-error.*", n.globalError);
  put("7.1", "notFound() (linhas)", n.chamadasNotFound, `arquivos: ${arquivosCom(TS_TSX, /notFound\(\)/).length}`);
  put("7.1", "<Suspense (linhas)", n.suspense);

  // ---------- 7.2 cor fora do token ----------
  const mapa = mapaDeCores(readFileSync(join(raiz, "tailwind.config.ts"), "utf8"));
  n.coresFora = 0;
  n.coresMapeadas = 0;
  let arqsFora = 0;
  for (const f of TSX) {
    const c = contarCores(ler(f), mapa);
    n.coresFora += c.fora;
    n.coresMapeadas += c.mapeadas;
    if (c.fora > 0) arqsFora++;
  }
  n.bgBrand700 = arquivosCom(TSX, /bg-brand-700/).length;
  n.bgWhite = linhas(TSX, /bg-white/);
  put("7.2", "arquivos com bg-brand-700", n.bgBrand700);
  put("7.2", "bg-white (linhas)", n.bgWhite, `arquivos: ${arquivosCom(TSX, /bg-white/).length}`);
  put("7.2", "shades fora do mapa (ocorrências)", n.coresFora, `arquivos: ${arqsFora}`);
  put("7.2", "classes dark: (linhas)", linhas(TSX, /dark:/));
  put("7.2", "shadow- (linhas)", linhas(TSX, /shadow-/), "inclui shadow-none e textos");
  const pct = n.coresFora + n.coresMapeadas ? (100 * n.coresFora) / (n.coresFora + n.coresMapeadas) : 0;
  put("7.2", "% classe de cor fora do token", `${pct.toFixed(1)}%`, `${n.coresFora} / (${n.coresFora} + ${n.coresMapeadas} mapeadas)`);

  // ---------- 7.3 design system ----------
  const distintas = (re) => new Set(TSX.flatMap((f) => [...ler(f).matchAll(re)].map((m) => m[0]))).size;
  put("7.3", "strings distintas do botão primário (critério da auditoria)", distintas(/className="[^"]*bg-brand-(600|700)[^"]*"/g), "bg-brand-600|700 em className literal");
  put("7.3", "strings distintas do botão primário (com bg-brand-solid)", distintas(/className="[^"]*bg-brand-(600|700|solid)[^"]*"/g));
  put("7.3", "arquivos que usam Botao/botaoClasses", arquivosCom(TSX, /\b(botaoClasses|<Botao\b)/).length);
  put("7.3", "importações de @/components/*", ocorr(TSX, /from "@\/components\/[A-Za-z]*"/));
  put("7.3", "componentes em src/components", todos.filter((f) => f.startsWith("src/components/") && f.endsWith(".tsx")).length);
  let headings = 0;
  let semMedium = 0;
  for (const f of TSX) {
    for (const m of ler(f).matchAll(/<h[1-3]\b[^>]*>/g)) {
      headings++;
      if (!/font-medium/.test(m[0])) semMedium++;
    }
  }
  const css = existsSync(join(raiz, "src", "app", "globals.css")) ? readFileSync(join(raiz, "src", "app", "globals.css"), "utf8") : "";
  const regraHeading = /h1,[\s\S]{0,80}?font-weight:\s*500/.test(css);
  put("7.3", "headings h1-h3 sem font-medium na classe", `${semMedium} de ${headings}`, regraHeading ? "regra global font-weight 500 em globals.css: SIM (peso resolvido pela base)" : "sem regra global");
  put("7.3", "font-semibold (linhas)", linhas(TSX, /font-semibold/));
  put("7.3", "mapas de rótulo ad-hoc (src/app + src/components)", ocorr(TSX.filter((f) => em("src/app/")(f) || em("src/components/")(f)), /(const|function) (rotulo|rotulos|ROTULO|ROTULOS)[A-Za-z0-9_]*/));
  // enum cru: {x.status|situacao|estado|tipo} como filho de texto do JSX (não atributo, não argumento)
  const ENUM_CRU = /(?<![=(,?:]\s*)(?<![\w$])\{\s*[\w$]+(?:[?!]?\.[\w$]+)*[?!]?\.(status|situacao|estado|tipo)\s*\}/g;
  put("7.3", "enum cru em texto ({x.status|situacao|estado|tipo} fora de atributo)", ocorr(TSX, ENUM_CRU), `arquivos: ${arquivosCom(TSX, new RegExp(ENUM_CRU.source)).length}; heurística — a auditoria leu caso a caso`);
  put("7.3", "{valor} {moeda} cru (linhas)", linhas(TSX, /\{[^{}]*\}\s*\{[\w.?]*moeda\}/));
  put("7.3", "data ISO crua (.vencimento/.competencia/.coberturaInicio em {…})", linhas(TSX, /\{[\w.?]*\.(vencimento|competencia|coberturaInicio)\}/));
  put("7.3", "redações distintas de \"Resultado não confirmado\"", new Set(TS_TSX.flatMap((f) => [...ler(f).matchAll(/"Resultado não confirmado[^"]*"/g)].map((m) => m[0]))).size, `usos de MSG_*_INCERT*: ${ocorr(TSX, /MSG_(RESULTADO_INCERTO|DECISAO_INCERTA)\w*/)}`);
  put("7.3", "códigos de spec na tela (Q23|Q92|Q165|M01|(S15)) em src/app", linhas(TSX.filter(em("src/app/")), /Q23|Q92|Q165|M01|\(S15\)/), "linhas; inclui comentários");

  // ---------- 7.4 acessibilidade ----------
  const ctl = { controles: 0, semNome: 0, dentroLabel: 0, comAria: 0, comHtmlFor: 0 };
  let arqsSemNome = 0;
  for (const f of TSX) {
    const r = nomesDeControles(ler(f));
    for (const k of Object.keys(ctl)) ctl[k] += r[k];
    if (r.semNome > 0) arqsSemNome++;
  }
  n.controles = ctl.controles;
  n.controlesSemNome = ctl.semNome;
  put("7.4", "controles sem nome acessível", ctl.semNome, `${arqsSemNome} arquivos; de ${ctl.controles} controles (${ctl.dentroLabel} dentro de <label>, ${ctl.comAria} com aria-label, ${ctl.comHtmlFor} com id↔htmlFor). Heurística estática: não segue {...props}`);
  put("7.4", "aria-invalid (ocorrências)", ocorr(TSX, /aria-invalid/), `required: ${ocorr(TSX, /\brequired\b/)}`);
  const overlays = arquivosCom(TSX, /fixed inset-0/);
  const overlaysOk = overlays.filter((f) => /"dialog"/.test(ler(f)) && /aria-modal/.test(ler(f)) && /Escape/.test(ler(f)));
  put("7.4", "overlays fixed inset-0 com role=dialog + aria-modal + Escape", `${overlaysOk.length} de ${overlays.length}`, `${overlays.map(base).join(", ")}; usos de <Modal/<Drawer: ${ocorr(TSX, /<(Modal|Drawer)\b/)}`);
  put("7.4", "regra focus-visible em globals.css (linhas)", css.split("\n").filter((l) => /focus-visible/.test(l)).length);
  put("7.4", "outline-none sem focus:ring na linha", TSX.reduce((t, f) => t + ler(f).split("\n").filter((l) => /outline-none/.test(l) && !/focus:ring/.test(l)).length, 0), `outline-none total (linhas): ${linhas(TSX, /outline-none/)}`);
  const comErro = arquivosCom(TSX, /setErro/);
  const semLive = comErro.filter((f) => !/role="alert"/.test(ler(f)));
  const semLiveAjust = semLive.filter((f) => !/<(FeedbackAcao|MensagemStatus|EstadoRota)\b/.test(ler(f)));
  put("7.4", "telas com setErro e sem role=\"alert\"", semLive.length, `${semLiveAjust.length} se FeedbackAcao/MensagemStatus contarem como live region (de ${comErro.length} com setErro)`);
  const lerSe = (...p) => (existsSync(join(raiz, ...p)) ? readFileSync(join(raiz, ...p), "utf8") : "");
  const sidebar = lerSe("src", "components", "Sidebar.tsx");
  const layoutApp = lerSe("src", "app", "(app)", "layout.tsx");
  put("7.4", "skip link / aria-current (Sidebar + (app)/layout)", `${(sidebar + layoutApp).match(/Pular para/g)?.length ?? 0} / ${sidebar.match(/aria-current/g)?.length ?? 0}`);
  const contr = paresReprovados(css);
  n.familiasReprovadas = contr.familias.length;
  put("7.4", "pares de token reprovando AA", `${contr.familias.length} famílias (${contr.familias.join(", ")})`, contr.reprovados.map((r) => `${r.tema}: ${r.par} ${r.valor.toFixed(3)}`).join("; ") || "nenhum");

  // ---------- 7.5 listas ----------
  const UI = TSX.filter((f) => em("src/app/")(f) || em("src/components/")(f));
  put("7.5", "arquivos com useSearchParams", arquivosCom(UI, /useSearchParams/).length, `arquivos com useFiltrosUrl: ${arquivosCom(UI, /useFiltrosUrl/).length}; page.tsx que leem searchParams: ${paginas.filter((p) => /searchParams/.test(ler(p))).length}`);
  put("7.5", "placeholder=\"Buscar (linhas em src/app)", linhas(TSX.filter(em("src/app/")), /placeholder="Buscar/));
  put("7.5", "contador \"de {itens.length}\"", linhas(TSX.filter(em("src/app/")), /de \{itens\.length\}/), `padrão amplo {a} de {b}: ${linhas(UI, /\}\s+de\s+\{[^}]*(length|total)[^}]*\}/)}`);
  const comTabela = arquivosCom(TSX, /<table\b/);
  const largasPorArquivo = comTabela.filter((f) => (ler(f).match(/<th\b/g) ?? []).length >= 7 && !/overflow-x/.test(ler(f)));
  // por tabela: <th> no bloco <table>…</table> e overflow-x nos 400 caracteres antes da abertura
  let tabelas = 0;
  let largas = 0;
  let largasSemScroll = 0;
  let cortadas = 0;
  for (const f of comTabela) {
    const t = ler(f);
    for (const m of t.matchAll(/<table\b[\s\S]*?<\/table>/g)) {
      tabelas++;
      const antes = t.slice(Math.max(0, m.index - 400), m.index);
      if (/overflow-hidden/.test(antes.slice(-200)) && !/overflow-x/.test(antes)) cortadas++;
      if ((m[0].match(/<th\b/g) ?? []).length >= 7) {
        largas++;
        if (!/overflow-x/.test(antes)) largasSemScroll++;
      }
    }
  }
  put("7.5", "tabelas 7+ colunas sem overflow-x", `${largasSemScroll} de ${largas} tabelas largas (${tabelas} tabelas em ${comTabela.length} arquivos)`, `por arquivo (≥7 <th> no arquivo e nenhum overflow-x): ${largasPorArquivo.length}; wrappers overflow-hidden sem overflow-x: ${cortadas}`);
  const comProxima = arquivosCom(TSX, /Próxima/);
  n.soParaFrente = comProxima.filter((f) => !/Anterior/.test(ler(f))).length;
  put("7.5", "paginações só para frente (\"Próxima\" sem \"Anterior\")", `${n.soParaFrente} de ${comProxima.length}`, `arquivos que usam <Paginacao: ${arquivosCom(TSX, /<Paginacao\b/).length}`);
  put("7.5", "aria-sort (linhas)", linhas(TSX, /aria-sort/), `usos de <ColunaOrdenavel: ${ocorr(TSX, /<ColunaOrdenavel\b/)}`);

  // ---------- 7.6 robustez ----------
  const chamaAcao = TSX.filter((f) => chamaServerAction(ler(f)));
  n.chamaAcao = chamaAcao.length;
  n.semCatchLiteral = chamaAcao.filter((f) => semCatchLiteral(ler(f))).length;
  n.semCatchCentral = chamaAcao.filter((f) => semCatchCentral(ler(f))).length;
  put("7.6", "client components com server action e sem catch", `${n.semCatchLiteral} de ${n.chamaAcao}`, `${n.semCatchCentral} se useAcaoCliente/executarAcaoCliente contar como catch central`);
  const comRefresh = arquivosCom(TSX, /router\.refresh\(\)/);
  const soRefresh = comRefresh.filter((f) => !/setMensagem|setSucesso|setAviso|setNota/i.test(ler(f)));
  const soRefreshAjust = soRefresh.filter((f) => !/sucesso:|useAcaoCliente|<MensagemStatus|<FeedbackAcao[^>]*sucesso/.test(ler(f)));
  put("7.6", "fluxos que terminam só em router.refresh()", `${soRefresh.length} de ${comRefresh.length}`, `${soRefreshAjust.length} se mensagem de sucesso via useAcaoCliente/FeedbackAcao/MensagemStatus contar`);
  const TSX_LIB = [...TSX, ...TS_TSX.filter(em("src/lib/"))];
  put("7.6", ".focus() / scrollIntoView (linhas)", `${linhas(TSX_LIB, /\.focus\(/)} / ${linhas(TSX_LIB, /scrollIntoView/)}`, "tsx + src/lib");
  let dinheiroNumber = 0;
  for (const f of TSX) for (const c of tags(ler(f), "input")) if (/type="number"/.test(c.texto) && /step="0\.01"/.test(c.texto)) dinheiroNumber++;
  put("7.6", "dinheiro em type=number step=0.01", linhas(TSX, /<input[^>]*type="number"[^>]*step="0\.01"/), `varredura de tag multilinha: ${dinheiroNumber}; usos de <CampoMoeda: ${ocorr(TSX, /<CampoMoeda\b/)}`);
  put("7.6", "campos de fuso em texto (name=\"fuso)", linhas(TSX, /name="fuso/), `defaultValue="UTC" (linhas, inclui comentários): ${linhas(TSX, /defaultValue="UTC"/)}; usos de <CampoFuso: ${ocorr(TSX, /<CampoFuso\b/)}`);
  // Critério da trava src/app/fuso-instante.test.ts (docs/43 §6 item 6): por atributo, spread, placeholder ou rótulo.
  const fusos = TSX.flatMap((f) => camposDeFuso(ler(f)).map((c) => ({ ...c, arquivo: f })));
  n.camposFusoFora = fusos.filter((c) => c.tipo === "campo" && c.arquivo !== ARQUIVO_DO_CAMPO_FUSO).length;
  n.listasFusoFora = fusos.filter((c) => c.tipo === "lista" && c.arquivo !== ARQUIVO_DO_CAMPO_FUSO).length;
  put("7.6", "campos de fuso fora do CampoFuso (critério da trava fuso-instante)", n.camposFusoFora, `listas de fusos (datalist/select) fora do CampoFuso: ${n.listasFusoFora}; arquivos: ${new Set(fusos.filter((c) => c.arquivo !== ARQUIVO_DO_CAMPO_FUSO).map((c) => c.arquivo)).size}`);

  // ---------- extras (citados nas seções 4 e 5, sem tabela própria na 7) ----------
  put("extras", "grid-cols-2 sem prefixo de breakpoint (ocorrências)", ocorr(TSX, /(?<![\w:-])grid-cols-2(?![\w-])/));
  put("extras", "page/layout com metadata ou generateMetadata", APP.filter((f) => /^(page|layout)\.tsx$/.test(base(f)) && /export (const metadata|async function generateMetadata|function generateMetadata)/.test(ler(f))).length);
  put("extras", "classes de mostrar/esconder por breakpoint (md:hidden | hidden md:)", ocorr(TSX, /\b(md:hidden|sm:hidden|hidden (sm|md|lg):)/));
  put("extras", "toISOString() impresso como texto (seguido de texto, ponto ou tag)", ocorr(TSX, /\{[^{}]*toISOString\(\)[^{}]*\}\s*(\(UTC\)|\.|<\/)/), `toISOString() em qualquer {…} (inclui valor de campo e payload): ${linhas(TSX, /\{[^{}]*toISOString\(\)[^{}]*\}/)}`);
  n.instantesCrus = TSX.reduce((t, f) => t + instantesCrus(ler(f)).length, 0);
  put("extras", "instantes crus na tela (critério da trava fuso-instante)", n.instantesCrus, "toISOString/toJSON/toUTCString, com cortes, como filho de JSX ou em ${…} de template que não é key/href/…; formatar(x.toISOString()) não conta");
  put("extras", "beforeunload", ocorr(TS_TSX, /beforeunload/));
  put("extras", "window.confirm / confirm(", ocorr(TSX, /\bconfirm\(/));
  put("extras", "<textarea com minLength (textarea crus)", ocorr(TSX, /<textarea\b[^>]*minLength/), `usos de <CampoTexto: ${ocorr(TSX, /<CampoTexto\b/)}`);
  put("extras", "<p>Nenhum… cru (estado vazio sem componente)", ocorr(TSX, /<p>\s*Nenhum/), `usos de <EstadoVazio: ${ocorr(TSX, /<EstadoVazio\b/)}`);

  return { secoes, n };
}

// ---------- linha de comando ----------
const executadoDireto = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (executadoDireto) {
  try {
    exigirNode();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  const args = process.argv.slice(2);
  const raiz = args.find((a) => !a.startsWith("--")) ?? join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  if (!existsSync(join(raiz, "src")) || !existsSync(join(raiz, "tailwind.config.ts"))) {
    console.error(`raiz inválida: ${raiz} (precisa ter src/ e tailwind.config.ts)`);
    process.exit(1);
  }
  const { secoes } = medir(raiz.split(sep).join("/"));
  if (args.includes("--json")) console.log(JSON.stringify(secoes, null, 1));
  else {
    for (const [sec, itens] of Object.entries(secoes)) {
      console.log(`\n## ${sec}`);
      for (const { nome, valor, nota } of itens) console.log(`- ${nome}: ${valor}${nota ? `  (${nota})` : ""}`);
    }
  }
}
