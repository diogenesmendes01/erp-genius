// Funções puras da medição da auditoria de UI/UX (docs/42 → docs/43). Sem acesso a disco:
// recebem texto e devolvem números, para serem testadas com fontes em memória
// (src/test/medicao-ux.test.ts). Node ≥ 18, sem dependência.

/** Paletas padrão do Tailwind: classe com elas e fora do mapa do config quebra o tema escuro. */
export const PADRAO_TAILWIND = new Set(
  "slate gray zinc neutral stone red orange amber yellow lime green emerald teal cyan sky blue indigo violet purple fuchsia pink rose".split(" "),
);

/** Utilitário de cor com shade numérica (mesmo detector de src/app/paleta.test.ts). */
export const UTILITARIO_COR =
  /(?<![\w-])(?:[a-z0-9-]+:)*!?(?:bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|outline|divide|from|via|to|fill|stroke|placeholder|accent|caret|decoration)-([a-z]+)-(\d{2,3})(?:\/\d+)?(?![\w-])/g;

/** Devolve o trecho entre a chave que abre em `inicio` e a chave que a fecha. */
function blocoEntreChaves(texto, inicio) {
  let prof = 0;
  for (let i = inicio; i < texto.length; i++) {
    if (texto[i] === "{") prof++;
    else if (texto[i] === "}" && --prof === 0) return texto.slice(inicio + 1, i);
  }
  throw new Error("chave sem fechamento no bloco de cores");
}

/**
 * Lê o mapa de cores de `theme.extend.colors` do tailwind.config.ts sem importar o .ts
 * (Node 20 não remove tipos). Só as entradas com objeto de shades entram no mapa.
 * @param {string} textoConfig
 * @returns {Map<string, Set<number>>}
 */
export function mapaDeCores(textoConfig) {
  const semComentario = textoConfig.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1");
  const m = /\bcolors\s*:\s*\{/.exec(semComentario);
  if (!m) throw new Error("tailwind.config.ts sem bloco `colors`");
  const bloco = blocoEntreChaves(semComentario, m.index + m[0].length - 1);
  const mapa = new Map();
  // percorre só as entradas de primeiro nível: chave, ":", valor (objeto, string ou outro)
  const chave = /\s*,?\s*(?:"([\w-]+)"|'([\w-]+)'|([A-Za-z_$][\w$]*))\s*:\s*/y;
  let i = 0;
  while (i < bloco.length) {
    chave.lastIndex = i;
    const x = chave.exec(bloco);
    if (!x) break;
    const nome = x[1] ?? x[2] ?? x[3];
    i = chave.lastIndex;
    if (bloco[i] === "{") {
      const interno = blocoEntreChaves(bloco, i);
      mapa.set(nome, new Set([...interno.matchAll(/(?:^|[,{\s])(\d{2,3})\s*:/g)].map((s) => Number(s[1]))));
      i += interno.length + 2;
    } else if (bloco[i] === '"' || bloco[i] === "'") {
      i = bloco.indexOf(bloco[i], i + 1) + 1;
    } else {
      const proxima = bloco.indexOf(",", i);
      i = proxima < 0 ? bloco.length : proxima;
    }
  }
  return mapa;
}

/**
 * Conta utilitários de cor fora do mapa (shade não mapeada de cor mapeada, ou paleta padrão
 * não mapeada) e os mapeados.
 * @param {string} texto
 * @param {Map<string, Set<number>>} mapa
 */
export function contarCores(texto, mapa) {
  let fora = 0;
  let mapeadas = 0;
  for (const [, cor, shade] of texto.matchAll(UTILITARIO_COR)) {
    const permitidas = mapa.get(cor);
    if (permitidas ? !permitidas.has(Number(shade)) : PADRAO_TAILWIND.has(cor)) fora++;
    else if (permitidas) mapeadas++;
  }
  return { fora, mapeadas };
}

/**
 * Varre cada tag `<nome …>` respeitando chaves e aspas (atributos JSX podem conter "=>").
 * @param {string} texto
 * @param {string} nomes alternativas separadas por "|"
 */
export function tags(texto, nomes) {
  const saida = [];
  for (const m of texto.matchAll(new RegExp(`<(${nomes})\\b`, "g"))) {
    let i = m.index + m[0].length;
    let prof = 0;
    let aspas = null;
    for (; i < texto.length; i++) {
      const c = texto[i];
      if (aspas) {
        if (c === aspas) aspas = null;
      } else if (c === '"' || c === "'" || c === "`") aspas = c;
      else if (c === "{") prof++;
      else if (c === "}") prof--;
      else if (c === ">" && prof === 0) break;
    }
    saida.push({ pos: m.index, tag: m[1], texto: texto.slice(m.index, i + 1) });
  }
  return saida;
}

/**
 * Controles de formulário e seu nome acessível: dentro de <label>, aria-label(ledby) ou id↔htmlFor.
 * Ignora input hidden/submit/button/reset. Estático: não segue {...props}.
 * @param {string} texto
 */
export function nomesDeControles(texto) {
  const r = { controles: 0, semNome: 0, dentroLabel: 0, comAria: 0, comHtmlFor: 0 };
  for (const c of tags(texto, "input|select|textarea")) {
    if (/type="(hidden|submit|button|reset)"/.test(c.texto)) continue;
    r.controles++;
    if (/aria-label(ledby)?=/.test(c.texto)) {
      r.comAria++;
      continue;
    }
    const antes = texto.slice(0, c.pos);
    if ((antes.match(/<label\b/g) ?? []).length - (antes.match(/<\/label>/g) ?? []).length > 0) {
      r.dentroLabel++;
      continue;
    }
    const id = c.texto.match(/\bid=("[^"]+"|\{[^}]+\})/);
    if (id && texto.includes(`htmlFor=${id[1]}`)) {
      r.comHtmlFor++;
      continue;
    }
    r.semNome++;
  }
  return r;
}

/** Variáveis CSS de um bloco (`:root`, `.dark`) de globals.css. */
export function tokensCss(css, seletor) {
  const esc = seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = css.match(new RegExp(`${esc}\\s*\\{([\\s\\S]*?)\\n\\}`));
  const t = {};
  if (m) for (const x of m[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)) t[x[1]] = x[2].trim();
  return t;
}

const hexParaRgb = (s) => {
  const h = s.replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16));
};
/** Cor opaca resultante; rgba() é composto sobre o fundo. */
export function corSobre(valor, fundo) {
  const r = valor.match(/rgba?\(([^)]+)\)/);
  if (!r) return hexParaRgb(valor);
  const [R, G, B, A = 1] = r[1].split(",").map(Number);
  return [R, G, B].map((v, i) => v * A + fundo[i] * (1 - A));
}
const luminancia = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** Razão de contraste WCAG 2.x entre duas cores RGB. */
export function contraste(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
export { hexParaRgb };

/**
 * Pares de token que reprovam: --text-terciary < 4,5 sobre cada superfície; bordas
 * (--border-control, --border, --brand-border) < 3 sobre cada superfície; #fff < 4,5 sobre
 * --brand e --brand-solid. Família = o token (ou "#fff/--brand"), independente de tema e superfície.
 * @param {string} css conteúdo de globals.css
 */
export function paresReprovados(css) {
  const claro = tokensCss(css, ":root");
  const escuro = { ...claro, ...tokensCss(css, ".dark") };
  const reprovados = [];
  for (const [tema, T] of [["claro", claro], ["escuro", escuro]]) {
    for (const sup of ["--bg-page", "--surface", "--surface-muted"].filter((k) => T[k])) {
      const fundo = hexParaRgb(T[sup]);
      for (const [token, limiar] of [["--text-terciary", 4.5], ["--border-control", 3], ["--border", 3], ["--brand-border", 3]]) {
        if (!T[token]) continue;
        const valor = contraste(corSobre(T[token], fundo), fundo);
        if (valor < limiar) reprovados.push({ tema, familia: token, par: `${token}/${sup}`, valor });
      }
    }
    for (const k of ["--brand", "--brand-solid"]) {
      if (!T[k]) continue;
      const valor = contraste([255, 255, 255], hexParaRgb(T[k]));
      if (valor < 4.5) reprovados.push({ tema, familia: `#fff/${k}`, par: `#fff/${k}`, valor });
    }
  }
  return { reprovados, familias: [...new Set(reprovados.map((r) => r.familia))].sort() };
}

/**
 * Páginas cobertas por um arquivo especial (loading.tsx, error.tsx) no próprio segmento ou em
 * qualquer segmento acima, até src/app.
 * @param {string[]} paginas caminhos posix "src/app/…/page.tsx"
 * @param {Set<string>} diretoriosCom diretórios posix que contêm o arquivo especial
 */
export function paginasCobertas(paginas, diretoriosCom) {
  return paginas.filter((p) => {
    let d = p.slice(0, p.lastIndexOf("/"));
    while (d.startsWith("src/app")) {
      if (diretoriosCom.has(d)) return true;
      d = d.slice(0, d.lastIndexOf("/"));
    }
    return false;
  }).length;
}

/** Arquivo de teste fica fora da medição (código de produção nos dois lados da comparação). */
export const ehTeste = (caminhoPosix) => /\.test\.tsx?$/.test(caminhoPosix) || caminhoPosix.startsWith("src/test/");

/** Arquivo com paginação para frente (critério literal da métrica 7.5): tem "Próxima". */
export const temProxima = (texto) => /Próxima/.test(texto);
/** Paginação só para frente (métrica 7.5): "Próxima" sem "Anterior" no mesmo arquivo. A trava
 * src/app/paginacao-dois-sentidos.test.ts usa este mesmo critério para conferir o conjunto medido. */
export const soParaFrente = (texto) => temProxima(texto) && !/Anterior/.test(texto);

/** Client component que chama server action. */
export const chamaServerAction = (texto) => /^["']use client["']/m.test(texto) && /from "@\/server\//.test(texto);
/** Sem nenhum `catch` no arquivo (critério literal da auditoria). */
export const semCatchLiteral = (texto) => !/catch/.test(texto);
/** Sem `catch` e sem o executor central (useAcaoCliente/executarAcaoCliente/criarExecutor). */
export const semCatchCentral = (texto) => semCatchLiteral(texto) && !/useAcaoCliente|executarAcaoCliente|criarExecutor/.test(texto);

/** Lê inteiro ≥ 0 de argumento de linha de comando; erro claro se inválido. */
export function inteiroDoArgumento(valor, nome, padrao) {
  if (valor === undefined) return padrao;
  if (!/^\d+$/.test(valor)) throw new Error(`${nome} inválido: "${valor}" (esperado inteiro ≥ 0)`);
  return Number(valor);
}

/** Normaliza severidade ("Média" → "Media"); erro para valor fora de Alta|Media|Baixa. */
export function normalizarSeveridade(valor) {
  const v = String(valor ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const ok = { alta: "Alta", media: "Media", baixa: "Baixa" }[v.toLowerCase()];
  if (!ok) throw new Error(`severidade inválida: "${valor}" (use Alta, Media ou Baixa)`);
  return ok;
}

/**
 * Estimativa estratificada de uma proporção (amostra aleatória simples dentro de cada estrato,
 * ponderada pela população): p̂ = Σ N_h p_h / N; Var = Σ N_h² (1 − n_h/N_h) p_h(1 − p_h)/(n_h − 1) / N².
 * Estrato com p_h = 0 ou 1 contribui variância zero, o que subestima o intervalo com n_h pequeno.
 * @param {{ populacao: number, amostra: number, casos: number }[]} estratos
 */
export function estimativaEstratificada(estratos) {
  const N = estratos.reduce((t, e) => t + e.populacao, 0);
  let total = 0;
  let variancia = 0;
  for (const { populacao, amostra, casos } of estratos) {
    if (amostra <= 0) throw new Error("estrato sem amostra");
    const p = casos / amostra;
    total += populacao * p;
    if (amostra > 1) variancia += populacao ** 2 * (1 - amostra / populacao) * (p * (1 - p)) / (amostra - 1);
  }
  const proporcao = total / N;
  const erro = (1.96 * Math.sqrt(variancia)) / N;
  return { total, proporcao, ic95: [Math.max(0, proporcao - erro), Math.min(1, proporcao + erro)] };
}

/** Exige Node ≥ 18 (lookbehind, ??=, Array#at); sai com mensagem clara se não. */
export function exigirNode(versao = process.versions.node) {
  const maior = Number(versao.split(".")[0]);
  if (maior < 18) throw new Error(`Node ${versao} não suportado: use Node ≥ 18 (o projeto usa 20).`);
}
