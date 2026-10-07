import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix } from "node:path";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusAluno, StatusComissao } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

// E1 / §5.6 A9 (docs/42-auditoria-frontend-ux.md): "0 colunas ordenáveis"; meta "≥ 3 (/comissoes,
// /alunos, /empresas)". Trava: (1) as tabelas dessas telas têm cabeçalhos ordenáveis, renderizados com
// aria-sort; (2) aria-sort só nasce de <ColunaOrdenavel> — um <th aria-sort> à mão costuma marcar a
// ordem sem ordenar no servidor (ou ordenar só a página exibida), o que mente para quem usa leitor de tela.

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/server/empresas/acoes", () => ({ salvarEmpresa: vi.fn() }));
vi.mock("@/app/(app)/alunos/ImportarAlunosModal", () => ({ ImportarAlunosModal: () => null }));
// Sentinela no lugar do componente: nas tabelas renderizadas, todo aria-sort teria de vir dele — então
// o HTML não pode ter aria-sort nenhum, escrito de qualquer jeito (revisão R1 da #136, B3).
vi.mock("@/components/ColunaOrdenavel", async () => {
  const { createElement: h } = await import("react");
  return { ColunaOrdenavel: ({ campo, rotulo }: { campo: string; rotulo: string }) => h("th", { "data-coluna-ordenavel": campo }, rotulo) };
});

import { AlunosLista } from "./(app)/alunos/AlunosLista";
import { EmpresasCliente } from "./(app)/empresas/EmpresasCliente";
import { Comissoes } from "./(app)/financeiro/FinanceiroPainel";
import { lerFiltrosAlunos } from "@/server/alunos/filtros";
import { lerFiltrosEmpresas } from "@/server/empresas/filtros";
import { lerOrdemComissoes } from "@/server/financeiro/ordem-comissoes";

const COMPONENTE = "src/components/ColunaOrdenavel.tsx";

/**
 * Código de produção do src, em toda extensão que o app carrega: .ts/.tsx e também .js/.jsx/.mjs/.cjs/.json
 * (revisão R3 da #136, B9: um helper .js ou um JSON com "aria-sort" ficavam fora da varredura). Testes e a
 * infraestrutura de teste (src/test) ficam de fora — e, por isso, a produção não pode importá-los (R1 da #149, B1).
 */
export const ehFonteDeProducao = (arquivo: string) => /\.(tsx?|jsx?|mjs|cjs|json)$/.test(arquivo)
  && !/\.(test|spec)\.[cm]?[jt]sx?$/.test(arquivo) && !/(^|\/)__(tests|mocks)__\//.test(arquivo) && !/^src\/test\//.test(arquivo);
/** Extensões de código: um import que resolve para um destes fora da varredura é apontado (CSS, fontes e imagens não). */
const CODIGO = /\.[cm]?[jt]sx?$|\.json$/;

const fontes = (readdirSync("src", { recursive: true }) as string[])
  .map((f) => join("src", f).split("\\").join("/"))
  .filter((arquivo) => ehFonteDeProducao(arquivo) && statSync(arquivo).isFile())
  .map((arquivo) => ({ arquivo, conteudo: readFileSync(arquivo, "utf-8") }));

/** As telas da meta e o arquivo que monta cada tabela. */
const TELAS = [
  "src/app/(app)/alunos/AlunosLista.tsx",
  "src/app/(app)/empresas/EmpresasCliente.tsx",
  "src/app/(app)/financeiro/FinanceiroPainel.tsx",
  "src/app/(app)/comissoes/page.tsx",
];

// ---------------------------------------------------------------------------------------------------
// Trava "só o componente escreve aria-sort" — falha fechada (revisão R3 da #136, B9; follow-up #141)
// ---------------------------------------------------------------------------------------------------
//
// Avaliar o texto não basta: sempre sobra uma grafia que o avaliador não reconstrói. Por isso a trava
// fecha as duas pontas, em todo arquivo de produção fora do componente:
//   (a) o TEXTO — toda expressão de texto é avaliada (literal, template, `+`/`+=`, ternário, `satisfies`,
//       membro de objeto, constante e helper do arquivo ou importados, inclusive de .js/.json, `replace`,
//       `String.fromCharCode`, `atob`, `JSON.parse`, `join`, `concat`…) e não pode dar "aria-sort"/"ariaSort",
//       nem "aria" seguido de um pedaço desconhecido, nem um pedaço desconhecido seguido de "-sort";
//   (b) o DESTINO — um atributo só chega ao elemento por nome escrito no JSX, por spread ou por API do DOM:
//       - spread em <th>, ou em elemento com role de cabeçalho (ou role calculado): proibido;
//       - spread em elemento HTML, em componente externo ou em componente que repassa as props ao HTML:
//         as chaves precisam ser conhecidas (objeto literal, constante, helper do projeto). Chave calculada
//         que não se resolve, objeto mutado depois de criado, origem externa fora da lista fechada → falha;
//       - APIs que criam elemento ou escrevem atributo pelo nome (createElement, cloneElement, jsx,
//         setAttribute, innerHTML…): proibidas; HTML e script embutidos precisam ser texto conhecido e
//         passam pela mesma trava; `eval`/`new Function` proibidos;
//       - escrita ou chamada com nome calculado em objeto do DOM (ref.current, e.target, document…) ou no
//         módulo do React: proibida;
//       - repassar props só vale para o objeto de props INTEIRO (`props`, `{ a, ...resto }`) do 1º parâmetro de
//         um componente; prop desestruturada, `props.x`, outro parâmetro ou função comum contam como desconhecidos.
//   (c) o GRAFO — a produção não importa o que a varredura não lê (teste, mock, src/test, arquivo fora do src),
//       nem import que não se resolve ou de caminho calculado.

const DESCONHECIDO = "\u0000";
/** Valor de `Symbol(...)`: chave conhecida que não é texto. */
const SIMBOLO = "\u0001símbolo";
/** Marca de regex literal entre os argumentos de `replace`. */
const REGEX = "\u0002";
const LIMITE = 64;
const PROFUNDIDADE = 14;
/** Passos de avaliação por expressão; estourou, a expressão é apontada (falha fechada). */
const ORCAMENTO = 200_000;
const EXTENSOES = [".tsx", ".ts", ".jsx", ".js", ".mjs", ".cjs", ".json"];

/** Texto que é ou pode virar o atributo: "aria-sort", "ariaSort", "aria" + desconhecido, desconhecido + "-sort". */
export const suspeito = (texto: string) => {
  const t = texto.toLowerCase();
  return t.replace(/[-_]/g, "").includes("ariasort") || /(^|[^a-z0-9])aria[-_]?\u0000/.test(t) || /\u0000[-_]?sort($|[^a-z])/.test(t);
};

/** Nomes que criam elemento ou escrevem atributo/HTML pelo nome — fora do componente, não aparecem. */
const PROIBIDOS = new Set([
  "createElement", "createElementNS", "cloneElement", "jsx", "jsxs", "jsxDEV", "setAttribute", "setAttributeNS", "toggleAttribute",
  "setAttributeNode", "setAttributeNodeNS", "createAttribute", "createAttributeNS", "setNamedItem", "setNamedItemNS",
  "insertAdjacentHTML", "createContextualFragment", "setHTMLUnsafe", "parseHTMLUnsafe", "innerHTML", "outerHTML", "srcdoc",
]);
/**
 * Origens externas cujas chaves são fixas pela biblioteca (lista fechada): o `register(...)` do react-hook-form e o
 * `attributes`/`listeners` do dnd-kit. Qualquer outra origem externa com chaves desconhecidas falha fechada.
 */
const EXTERNOS_CONFIAVEIS = new Map([
  ["react-hook-form", ["useForm", "useFormContext"]], ["@dnd-kit/core", ["useDraggable", "useDroppable"]], ["@dnd-kit/sortable", ["useSortable"]],
]);
/** Raízes, membros e consultas que levam a um nó do DOM. */
const RAIZES_DOM = new Set(["document", "window", "globalThis", "self", "top", "parent", "frames", "opener"]);
const MEMBROS_DOM = new Set([
  "current", "target", "currentTarget", "srcElement", "relatedTarget", "ownerDocument", "parentElement", "parentNode", "firstChild",
  "lastChild", "firstElementChild", "lastElementChild", "previousElementSibling", "nextElementSibling", "children", "childNodes",
  "form", "elements", "documentElement", "body", "head", "activeElement", "labels", "options", "selectedOptions",
]);
const CONSULTAS_DOM = /^(querySelector(All)?|getElementById|getElementsBy\w+|closest|elementFromPoint|elementsFromPoint|item|namedItem)$/;
/** Métodos de texto que a avaliação reproduz (t: texto, n: número, r: regex ou texto). */
const METODOS_DE_TEXTO = new Map<string, readonly ("t" | "n" | "r")[]>([
  ["replace", ["r", "t"]], ["replaceAll", ["r", "t"]], ["toLowerCase", []], ["toUpperCase", []], ["toLocaleLowerCase", []],
  ["toLocaleUpperCase", []], ["trim", []], ["trimStart", []], ["trimEnd", []], ["normalize", ["t"]], ["slice", ["n", "n"]],
  ["substring", ["n", "n"]], ["substr", ["n", "n"]], ["at", ["n"]], ["charAt", ["n"]], ["padStart", ["n", "t"]], ["padEnd", ["n", "t"]],
  ["repeat", ["n"]], ["toString", []], ["valueOf", []],
]);
/** Chamadas avaliadas como texto: função pelo nome (`juntar(a, b)`, `String(x)`) ou estes métodos. */
const METODOS_RAIZ = new Set([...METODOS_DE_TEXTO.keys(), "join", "concat", "fromCharCode", "fromCodePoint", "parse"]);
/** Funções do React que devolvem o próprio argumento (para seguir o componente ou o callback) — lista fechada. */
const IDENTIDADE_REACT = new Set(["forwardRef", "memo", "useCallback"]);

type Funcao = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | ts.MethodDeclaration;
const ehFuncao = (n: ts.Node): n is Funcao => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);

type Ctx = {
  arquivo: string; sf: ts.SourceFile; json: boolean;
  /** Atribuições a um nome (`x = …`, `x += …`, desestruturação). */
  atribuicoes: Map<string, ts.BinaryExpression[]>;
  /** Escritas no objeto guardado num nome (`x.a = …`, `x[k] = …`, `delete x.a`, `Object.assign(x, …)`). */
  mutacoes: Map<string, ts.Node[]>;
  incrementos: Map<string, ts.Node[]>;
};
/** Parâmetros já ligados a argumentos (chamada de função do projeto), avaliados sob demanda. */
type Ligacoes = ReadonlyMap<ts.ParameterDeclaration, () => Valor[]>;
/** Um valor possível de uma expressão, depois de seguir nomes, imports, membros, chamadas e ternários. */
type Valor =
  | { tipo: "expr"; expr: ts.Node; ctx: Ctx; lig: Ligacoes }
  | { tipo: "modulo"; caminho: string }
  | { tipo: "externo"; modulo: string; nome: string }
  /** Parâmetro de função (props): as chaves são as do chamador. */
  | { tipo: "parametro" }
  /** Lado falso de `&&`, propriedade ausente: não espalha nada. */
  | { tipo: "nada" }
  | { tipo: "desconhecido" };
type Ligacao =
  | { tipo: "decl"; decl: ts.VariableDeclaration; escopo: ts.Node }
  | { tipo: "param"; param: ts.ParameterDeclaration; fn: ts.SignatureDeclaration }
  | { tipo: "funcao"; fn: ts.FunctionDeclaration | ts.FunctionExpression }
  | { tipo: "import"; origem: string; nome: string }
  | { tipo: "opaco" };
type Chaves = { nomes: string[]; aberta: boolean; repasse: boolean };

const VAZIO: Ligacoes = new Map();
const DESC_V: Valor = { tipo: "desconhecido" };
const NADA: Valor = { tipo: "nada" };
const PARAM: Valor = { tipo: "parametro" };

const visitar = (no: ts.Node, f: (n: ts.Node) => void) => { f(no); ts.forEachChild(no, (filho) => visitar(filho, f)); };
const dentro = (n: ts.Node, escopo: ts.Node) => n.pos >= escopo.pos && n.end <= escopo.end;
const semEmbrulho = (n: ts.Node): ts.Node => {
  let x = n;
  while (ts.isParenthesizedExpression(x) || ts.isAsExpression(x) || ts.isSatisfiesExpression(x) || ts.isNonNullExpression(x) || ts.isTypeAssertionExpression(x)) x = x.expression;
  return x;
};
const ehAtribuicao = (n: ts.Node): n is ts.BinaryExpression => ts.isBinaryExpression(n)
  && n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment;
const limitarTextos = (xs: string[]) => { const u = [...new Set(xs)]; return u.length > LIMITE ? [...u.slice(0, LIMITE - 1), DESCONHECIDO] : u; };
const limitarValores = (xs: Valor[]) => (xs.length > LIMITE ? [...xs.slice(0, LIMITE - 1), DESC_V] : xs);
const produto = (a: string[], b: string[]) => limitarTextos(a.flatMap((x) => b.map((y) => x + y)));
/** Todas as combinações (uma escolha por posição), até o limite. */
const combinacoes = (listas: string[][]): string[][] => {
  let r: string[][] = [[]];
  for (const l of listas) {
    r = r.flatMap((c) => l.map((x) => [...c, x]));
    if (r.length > LIMITE) return [listas.map(() => DESCONHECIDO)];
  }
  return r;
};
const aplicarTexto = (vals: string[], f: (s: string) => unknown) => limitarTextos(vals.map((s) => {
  if (s.includes(DESCONHECIDO)) return DESCONHECIDO;
  try { const r = f(s); return typeof r === "string" && r.length <= 2000 ? r : DESCONHECIDO; } catch { return DESCONHECIDO; }
}));
const trecho = (v: string) => v.split(DESCONHECIDO).join("…").slice(0, 60);

/** Tipo de script pela extensão (.ts não é lido como TSX: `<T>(x)` viraria JSX). */
const tipoDeScript = (arquivo: string) => (arquivo.endsWith(".json") ? ts.ScriptKind.JSON : arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX
  : arquivo.endsWith(".jsx") ? ts.ScriptKind.JSX : /\.[cm]?js$/.test(arquivo) ? ts.ScriptKind.JS : arquivo.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.TSX);

const nomesDaLigacao = (n: ts.BindingName): string[] => (ts.isIdentifier(n) ? [n.text]
  : (n.elements as readonly ts.ArrayBindingElement[]).flatMap((el) => (ts.isOmittedExpression(el) ? [] : nomesDaLigacao(el.name))));
/** Caminho de chaves da raiz de uma desestruturação até o nome (`const { a: { b } } = x` → ["a", "b"]; resto: null). */
type Caminho = { chaves: (string | null)[]; padroes: ts.Expression[]; intermediario: boolean };
function caminhoAte(nome: string, alvo: ts.BindingName): Caminho | null {
  if (ts.isIdentifier(alvo)) return alvo.text === nome ? { chaves: [], padroes: [], intermediario: false } : null;
  const elementos = alvo.elements as readonly ts.ArrayBindingElement[];
  for (let i = 0; i < elementos.length; i++) {
    const el = elementos[i];
    if (ts.isOmittedExpression(el)) continue;
    const r = caminhoAte(nome, el.name);
    if (!r) continue;
    const chave = el.dotDotDotToken ? null : ts.isArrayBindingPattern(alvo) ? String(i)
      : el.propertyName ? (ts.isComputedPropertyName(el.propertyName) ? DESCONHECIDO : el.propertyName.text) : ts.isIdentifier(el.name) ? el.name.text : DESCONHECIDO;
    const final = ts.isIdentifier(el.name);
    return { chaves: [chave, ...r.chaves], padroes: el.initializer && final ? [el.initializer, ...r.padroes] : r.padroes, intermediario: r.intermediario || (!!el.initializer && !final) };
  }
  return null;
}

/** A declaração visível de um nome a partir de um ponto do código (escopo léxico: parâmetros, blocos, arquivo, imports). */
function ligacaoDe(nome: string, de: ts.Node): Ligacao | null {
  for (let n: ts.Node | undefined = de; n; n = n.parent) {
    if (ts.isFunctionLike(n)) {
      for (const p of n.parameters) if (nomesDaLigacao(p.name).includes(nome)) return { tipo: "param", param: p, fn: n };
      if (ts.isFunctionExpression(n) && n.name?.text === nome) return { tipo: "funcao", fn: n };
    }
    if (ts.isCatchClause(n) && n.variableDeclaration && nomesDaLigacao(n.variableDeclaration.name).includes(nome)) return { tipo: "opaco" };
    if ((ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n)) && n.initializer && ts.isVariableDeclarationList(n.initializer)) {
      for (const d of n.initializer.declarations) if (nomesDaLigacao(d.name).includes(nome)) return ts.isForStatement(n) ? { tipo: "decl", decl: d, escopo: n } : { tipo: "opaco" };
    }
    const instrucoes = ts.isSourceFile(n) || ts.isBlock(n) || ts.isModuleBlock(n) || ts.isCaseClause(n) || ts.isDefaultClause(n) ? n.statements : [];
    for (const s of instrucoes) {
      if (ts.isVariableStatement(s)) {
        for (const d of s.declarationList.declarations) if (nomesDaLigacao(d.name).includes(nome)) return { tipo: "decl", decl: d, escopo: n };
      } else if (ts.isFunctionDeclaration(s)) {
        if (s.name?.text === nome) return { tipo: "funcao", fn: s };
      } else if (ts.isClassDeclaration(s) || ts.isEnumDeclaration(s) || ts.isModuleDeclaration(s) || ts.isImportEqualsDeclaration(s)) {
        if (s.name && ts.isIdentifier(s.name) && s.name.text === nome) return { tipo: "opaco" };
      } else if (ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier) && s.importClause) {
        const c = s.importClause, origem = s.moduleSpecifier.text, b = c.namedBindings;
        if (c.name?.text === nome) return { tipo: "import", origem, nome: "default" };
        if (b && ts.isNamespaceImport(b) && b.name.text === nome) return { tipo: "import", origem, nome: "*" };
        if (b && ts.isNamedImports(b)) for (const el of b.elements) if (el.name.text === nome) return { tipo: "import", origem, nome: (el.propertyName ?? el.name).text };
      }
    }
  }
  return null;
}

/**
 * Função de componente: nome com inicial maiúscula — o dela, ou o da constante que a recebe, direto ou por
 * forwardRef/memo. Só o objeto de props inteiro de um componente pode ser repassado (R1 da #149, B2): um
 * componente só é usado em JSX (ou chamado direto, o que também é conferido), onde quem chama tem as chaves travadas.
 */
const ehComponente = (fn: ts.SignatureDeclaration) => {
  const proprio = ts.isFunctionDeclaration(fn) || ts.isFunctionExpression(fn) ? fn.name?.text : undefined;
  if (proprio && /^[A-Z]/.test(proprio)) return true;
  let p: ts.Node = fn.parent;
  while (ts.isParenthesizedExpression(p) || (ts.isCallExpression(p) && /(^|\.)(forwardRef|memo)$/.test(p.expression.getText()))) p = p.parent;
  return ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) && /^[A-Z]/.test(p.name.text);
};

/** Retornos de uma função (sem entrar em funções internas). */
const retornos = (fn: Funcao): ts.Expression[] => {
  if (!fn.body) return [];
  if (!ts.isBlock(fn.body)) return [fn.body];
  const r: ts.Expression[] = [];
  const andar = (n: ts.Node): void => {
    if (ehFuncao(n) || ts.isClassLike(n)) return;
    if (ts.isReturnStatement(n) && n.expression) r.push(n.expression);
    ts.forEachChild(n, andar);
  };
  ts.forEachChild(fn.body, andar);
  return r;
};

const raizDeMembro = (e: ts.Node): ts.Identifier | null => {
  let x = semEmbrulho(e);
  while (ts.isPropertyAccessExpression(x) || ts.isElementAccessExpression(x)) x = semEmbrulho(x.expression);
  return ts.isIdentifier(x) ? x : null;
};
const MUTADORES = /^(Object\.(assign|defineProperty|defineProperties|setPrototypeOf)|Reflect\.(set|defineProperty|deleteProperty|setPrototypeOf))$/;

function criarCtx(arquivo: string, fonte: string): Ctx {
  const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, tipoDeScript(arquivo));
  const ctx: Ctx = { arquivo, sf, json: arquivo.endsWith(".json"), atribuicoes: new Map(), mutacoes: new Map(), incrementos: new Map() };
  const somar = <T>(m: Map<string, T[]>, nome: string, x: T) => { m.set(nome, [...(m.get(nome) ?? []), x]); };
  const mutar = (alvo: ts.Node, n: ts.Node) => { const r = raizDeMembro(alvo); if (r) somar(ctx.mutacoes, r.text, n); };
  visitar(sf, (n) => {
    if (ehAtribuicao(n)) {
      const esquerda = semEmbrulho(n.left);
      if (ts.isIdentifier(esquerda)) somar(ctx.atribuicoes, esquerda.text, n);
      else if (ts.isObjectLiteralExpression(esquerda) || ts.isArrayLiteralExpression(esquerda)) {
        visitar(esquerda, (x) => { if (ts.isIdentifier(x) && !(ts.isPropertyAssignment(x.parent) && x.parent.name === x)) somar(ctx.atribuicoes, x.text, n); });
      } else mutar(esquerda, n);
    }
    if (ts.isDeleteExpression(n)) mutar(n.expression, n);
    if ((ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) && (n.operator === ts.SyntaxKind.PlusPlusToken || n.operator === ts.SyntaxKind.MinusMinusToken)) {
      const alvo = semEmbrulho(n.operand);
      if (ts.isIdentifier(alvo)) somar(ctx.incrementos, alvo.text, n);
      else mutar(alvo, n);
    }
    if (ts.isCallExpression(n) && n.arguments[0] && MUTADORES.test(n.expression.getText(sf))) mutar(n.arguments[0], n);
  });
  return ctx;
}

/** `x.current` de um useRef criado com objeto ou lista: guarda dados, não um nó do DOM. */
const refDeDados = (e: ts.PropertyAccessExpression) => {
  const raiz = semEmbrulho(e.expression);
  if (!ts.isIdentifier(raiz)) return false;
  const l = ligacaoDe(raiz.text, raiz);
  if (l?.tipo !== "decl" || !l.decl.initializer || !ts.isIdentifier(l.decl.name)) return false;
  const i = semEmbrulho(l.decl.initializer);
  if (!ts.isCallExpression(i) || !/^(React\.)?useRef$/.test(i.expression.getText())) return false;
  const a = i.arguments[0] && semEmbrulho(i.arguments[0]);
  return !!a && (ts.isObjectLiteralExpression(a) || ts.isArrayLiteralExpression(a));
};
/** Parâmetro que recebe um nó do DOM: o da função em `ref={...}` ou passada a useCallback (que vira ref). */
const parametroDeRef = (fn: ts.SignatureDeclaration) => {
  let p: ts.Node = fn.parent;
  while (ts.isParenthesizedExpression(p)) p = p.parent;
  if (ts.isJsxExpression(p) && ts.isJsxAttribute(p.parent) && p.parent.name.getText() === "ref") return true;
  return ts.isCallExpression(p) && /(^|\.)useCallback$/.test(p.expression.getText());
};
/** A expressão leva a um nó do DOM (document, ref.current, e.target, querySelector…)? */
const domish = (e0: ts.Node, prof = 0): boolean => {
  if (prof > PROFUNDIDADE) return true;
  const e = semEmbrulho(e0);
  if (ts.isIdentifier(e)) {
    const l = ligacaoDe(e.text, e);
    if (!l) return RAIZES_DOM.has(e.text);
    if (l.tipo === "param") return parametroDeRef(l.fn);
    return l.tipo === "decl" && !!l.decl.initializer && domish(l.decl.initializer, prof + 1);
  }
  if (ts.isPropertyAccessExpression(e) && MEMBROS_DOM.has(e.name.text) && !(e.name.text === "current" && refDeDados(e))) return true;
  if (ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e)) return domish(e.expression, prof + 1);
  if (ts.isCallExpression(e)) { const c = semEmbrulho(e.expression); return ts.isPropertyAccessExpression(c) && CONSULTAS_DOM.test(c.name.text); }
  if (ts.isConditionalExpression(e)) return domish(e.whenTrue, prof + 1) || domish(e.whenFalse, prof + 1);
  if (ts.isBinaryExpression(e) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.CommaToken].includes(e.operatorToken.kind)) {
    return domish(e.left, prof + 1) || domish(e.right, prof + 1);
  }
  return false;
};

/** Raízes da avaliação de texto: literais, templates, `+`/`+=`, chamadas de texto, chaves calculadas e índices. */
const raizDeTexto = (n: ts.Node): boolean => {
  const p = n.parent;
  if (ts.isStringLiteralLike(n)) {
    if (!p) return true;
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p) || ts.isModuleDeclaration(p)) return false;
    if (ts.isLiteralTypeNode(p) && ts.isImportTypeNode(p.parent)) return false;
    return !(ts.isCallExpression(p) && (p.expression.kind === ts.SyntaxKind.ImportKeyword || p.expression.getText() === "require"));
  }
  if (ts.isTemplateExpression(n) || ts.isTaggedTemplateExpression(n)) return true;
  if (ts.isBinaryExpression(n)) return n.operatorToken.kind === ts.SyntaxKind.PlusToken || n.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken;
  if (ts.isCallExpression(n)) {
    const c = semEmbrulho(n.expression);
    return ts.isIdentifier(c) || (ts.isPropertyAccessExpression(c) && METODOS_RAIZ.has(c.name.text));
  }
  return !!p && (ts.isComputedPropertyName(p) || (ts.isElementAccessExpression(p) && p.argumentExpression === n));
};

/**
 * Analisador com cache de arquivos. `virtuais` são fontes em memória (autoteste e scripts embutidos);
 * o resto é lido do disco. Os imports do projeto ("./x", "@/x", com qualquer extensão de produção) são seguidos.
 */
function analisador(virtuais = new Map<string, string>()) {
  const existe = (c: string) => virtuais.has(c) || (existsSync(c) && statSync(c).isFile());
  const contextos = new Map<string, Ctx | null>();
  const contexto = (arquivo: string): Ctx | null => {
    if (!contextos.has(arquivo)) contextos.set(arquivo, existe(arquivo) ? criarCtx(arquivo, virtuais.get(arquivo) ?? readFileSync(arquivo, "utf-8")) : null);
    return contextos.get(arquivo) ?? null;
  };
  const modulos = new Map<string, string | null>();
  /** Arquivo do projeto que o import aponta, se existir (externo: null). */
  const resolverModulo = (de: string, origem: string): string | null => {
    const chave = posix.dirname(de) + DESCONHECIDO + origem;
    if (!modulos.has(chave)) {
      const base = origem.startsWith("@/") ? "src/" + origem.slice(2) : origem.startsWith(".") ? posix.join(posix.dirname(de), origem) : null;
      modulos.set(chave, base === null ? null : [base, ...EXTENSOES.map((e) => base + e), ...EXTENSOES.map((e) => base + "/index" + e)].find(existe) ?? null);
    }
    return modulos.get(chave) ?? null;
  };

  let orcamento = ORCAMENTO;
  const emCurso = new Set<ts.Node>();
  const emCursoTexto = new Set<ts.Node>();

  /** Valores possíveis de uma expressão. */
  const valores = (e0: ts.Node, ctx: Ctx, lig: Ligacoes, prof: number): Valor[] => {
    if (prof > PROFUNDIDADE || --orcamento < 0) return [DESC_V];
    const e = semEmbrulho(e0);
    const v = (x: ts.Node) => valores(x, ctx, lig, prof + 1);
    if (ts.isConditionalExpression(e)) return limitarValores([...v(e.whenTrue), ...v(e.whenFalse)]);
    if (ts.isBinaryExpression(e)) {
      const op = e.operatorToken.kind;
      if (op === ts.SyntaxKind.AmpersandAmpersandToken) return limitarValores([NADA, ...v(e.right)]);
      if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) return limitarValores([...v(e.left), ...v(e.right)]);
      if (op === ts.SyntaxKind.CommaToken || op === ts.SyntaxKind.EqualsToken) return v(e.right);
    }
    if (ts.isAwaitExpression(e)) return v(e.expression);
    if (ts.isIdentifier(e)) return e.text === "undefined" && !ligacaoDe("undefined", e) ? [NADA] : valoresDoNome(e.text, e, ctx, lig, prof);
    if (ts.isPropertyAccessExpression(e)) return membro(v(e.expression), [e.name.text], prof);
    if (ts.isElementAccessExpression(e)) return membro(v(e.expression), textos(e.argumentExpression, ctx, lig, prof + 1), prof);
    if (ts.isCallExpression(e)) return chamada(e, ctx, lig, prof);
    return [{ tipo: "expr", expr: e, ctx, lig }];
  };

  const valoresDoNome = (nome: string, de: ts.Node, ctx: Ctx, lig: Ligacoes, prof: number): Valor[] => {
    const l = ligacaoDe(nome, de);
    if (!l || l.tipo === "opaco") return [DESC_V];
    if (l.tipo === "funcao") return [{ tipo: "expr", expr: l.fn, ctx, lig: VAZIO }];
    if (l.tipo === "import") {
      const caminho = resolverModulo(ctx.arquivo, l.origem);
      if (!caminho) return [{ tipo: "externo", modulo: l.origem, nome: l.nome }];
      return l.nome === "*" ? [{ tipo: "modulo", caminho }] : exportado(caminho, l.nome, prof + 1);
    }
    if (l.tipo === "param") {
      const arg = lig.get(l.param), cam = caminhoAte(nome, l.param.name);
      if (!arg) {
        // Repasse só do objeto de props inteiro (`props`, `{ a, ...resto }`) do 1º parâmetro de um componente. Prop
        // desestruturada (`{ extra }`), outro parâmetro, função comum (`.map((x) => <div {...x} />)`): desconhecido.
        const inteiro = l.fn.parameters[0] === l.param && ehComponente(l.fn) && !!cam && (cam.chaves.length === 0 || (cam.chaves.length === 1 && cam.chaves[0] === null));
        return [inteiro ? PARAM : DESC_V];
      }
      return cam ? aplicarCaminho(arg(), cam, ctx, lig, prof) : [DESC_V];
    }
    if (emCurso.has(l.decl)) return [DESC_V];
    emCurso.add(l.decl);
    try {
      const cam = caminhoAte(nome, l.decl.name);
      const r: Valor[] = cam ? aplicarCaminho(l.decl.initializer ? valores(l.decl.initializer, ctx, lig, prof + 1) : [DESC_V], cam, ctx, lig, prof) : [DESC_V];
      for (const a of ctx.atribuicoes.get(nome) ?? []) {
        if (!dentro(a, l.escopo)) continue;
        const op = a.operatorToken.kind;
        if (!ts.isIdentifier(semEmbrulho(a.left))) r.push(DESC_V);
        else if (op === ts.SyntaxKind.PlusEqualsToken) r.push({ tipo: "expr", expr: a, ctx, lig });
        else if ([ts.SyntaxKind.EqualsToken, ts.SyntaxKind.BarBarEqualsToken, ts.SyntaxKind.QuestionQuestionEqualsToken, ts.SyntaxKind.AmpersandAmpersandEqualsToken].includes(op)) {
          r.push(...valores(a.right, ctx, lig, prof + 1));
        } else r.push(DESC_V);
      }
      // Objeto escrito depois de criado (`o[k] = v`, `Object.assign(o, …)`): as chaves deixam de ser conhecidas.
      if ([...(ctx.incrementos.get(nome) ?? []), ...(ctx.mutacoes.get(nome) ?? [])].some((n) => dentro(n, l.escopo))) r.push(DESC_V);
      return limitarValores(r);
    } finally {
      emCurso.delete(l.decl);
    }
  };

  const aplicarCaminho = (base: Valor[], cam: Caminho, ctx: Ctx, lig: Ligacoes, prof: number): Valor[] => {
    let r = base;
    for (const k of cam.chaves) if (k !== null) r = membro(r, [k], prof);
    return limitarValores([...r, ...cam.padroes.flatMap((p) => valores(p, ctx, lig, prof + 1)), ...(cam.intermediario ? [DESC_V] : [])]);
  };

  const nomesDePropriedade = (n: ts.PropertyName, ctx: Ctx, lig: Ligacoes, prof: number): string[] =>
    (ts.isComputedPropertyName(n) ? textos(n.expression, ctx, lig, prof + 1) : [n.text]);

  const membro = (vals: Valor[], chaves: string[], prof: number): Valor[] => limitarValores(vals.flatMap((v) => chaves.flatMap((k) => membroDe(v, k, prof))));
  const membroDe = (v: Valor, k: string, prof: number): Valor[] => {
    if (prof > PROFUNDIDADE) return [DESC_V];
    // `props.extra`: o valor de uma prop não é o objeto de props — as chaves dele não são travadas no chamador.
    if (v.tipo === "parametro" || v.tipo === "desconhecido") return [DESC_V];
    if (v.tipo === "nada") return [NADA];
    // `React.forwardRef`, `ns.useForm`: o nome passa a ser o membro; `useForm().register`: segue sendo "de useForm".
    if (v.tipo === "externo") return [{ tipo: "externo", modulo: v.modulo, nome: v.nome === "default" || v.nome === "*" ? k : v.nome }];
    if (v.tipo === "modulo") return k.includes(DESCONHECIDO) ? [DESC_V] : exportado(v.caminho, k, prof + 1);
    const e = semEmbrulho(v.expr), qualquer = k.includes(DESCONHECIDO);
    if (ts.isObjectLiteralExpression(e)) {
      const r: Valor[] = [];
      let espalha = false;
      for (const p of e.properties) {
        if (ts.isSpreadAssignment(p)) {
          espalha = true;
          r.push(...membro(valores(p.expression, v.ctx, v.lig, prof + 1), [k], prof + 1));
          continue;
        }
        const nomes = nomesDePropriedade(p.name, v.ctx, v.lig, prof);
        if (!qualquer && !nomes.some((n) => n === k || n.includes(DESCONHECIDO))) continue;
        if (ts.isPropertyAssignment(p)) r.push(...valores(p.initializer, v.ctx, v.lig, prof + 1));
        else if (ts.isShorthandPropertyAssignment(p)) r.push(...valoresDoNome(p.name.text, p.name, v.ctx, v.lig, prof + 1));
        else if (ts.isMethodDeclaration(p)) r.push({ tipo: "expr", expr: p, ctx: v.ctx, lig: v.lig });
        else r.push(DESC_V);
      }
      if (qualquer) r.push(DESC_V);
      return r.length || espalha ? limitarValores(r) : [NADA];
    }
    if (ts.isArrayLiteralExpression(e)) {
      if (qualquer) return limitarValores([...e.elements.flatMap((x) => valores(ts.isSpreadElement(x) ? x.expression : x, v.ctx, v.lig, prof + 1)), DESC_V]);
      if (!/^\d+$/.test(k) || e.elements.slice(0, Number(k) + 1).some((x) => ts.isSpreadElement(x))) return [DESC_V];
      const x = e.elements[Number(k)];
      return x ? valores(x, v.ctx, v.lig, prof + 1) : [NADA];
    }
    return [DESC_V];
  };

  const temModificador = (s: ts.Node, k: ts.SyntaxKind) => ts.canHaveModifiers(s) && !!ts.getModifiers(s)?.some((m) => m.kind === k);
  /** Valor de um nome exportado por um arquivo do projeto (ESM, reexportação, `export *`, CommonJS e JSON). */
  const exportado = (caminho: string, nome: string, prof: number): Valor[] => {
    const c = contexto(caminho);
    if (!c || prof > PROFUNDIDADE) return [DESC_V];
    if (c.json) {
      const raiz = (c.sf.statements[0] as ts.ExpressionStatement | undefined)?.expression;
      if (!raiz) return [DESC_V];
      const v: Valor = { tipo: "expr", expr: raiz, ctx: c, lig: VAZIO };
      return nome === "default" ? [v] : membroDe(v, nome, prof + 1);
    }
    for (const s of c.sf.statements) {
      const exporta = temModificador(s, ts.SyntaxKind.ExportKeyword), padrao = temModificador(s, ts.SyntaxKind.DefaultKeyword);
      if (ts.isVariableStatement(s)) {
        if (exporta) for (const d of s.declarationList.declarations) if (nomesDaLigacao(d.name).includes(nome)) return valoresDoNome(nome, d, c, VAZIO, prof + 1);
      } else if (ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s)) {
        if (exporta && (padrao ? nome === "default" : s.name?.text === nome)) return ts.isFunctionDeclaration(s) ? [{ tipo: "expr", expr: s, ctx: c, lig: VAZIO }] : [DESC_V];
      } else if (ts.isExportAssignment(s)) {
        if (!s.isExportEquals && nome === "default") return valores(s.expression, c, VAZIO, prof + 1);
      } else if (ts.isExportDeclaration(s) && s.exportClause) {
        const destino = s.moduleSpecifier && ts.isStringLiteral(s.moduleSpecifier) ? s.moduleSpecifier.text : null;
        const outro = destino === null ? null : resolverModulo(caminho, destino);
        if (ts.isNamespaceExport(s.exportClause)) {
          if (s.exportClause.name.text === nome) return outro ? [{ tipo: "modulo", caminho: outro }] : destino ? [{ tipo: "externo", modulo: destino, nome: "*" }] : [DESC_V];
          continue;
        }
        for (const el of s.exportClause.elements) {
          if (el.name.text !== nome) continue;
          const local = (el.propertyName ?? el.name).text;
          if (destino === null) return valoresDoNome(local, el, c, VAZIO, prof + 1);
          return outro ? exportado(outro, local, prof + 1) : [{ tipo: "externo", modulo: destino, nome: local }];
        }
      }
    }
    // CommonJS (.js/.cjs): `module.exports = …`, `module.exports.X = …`, `exports.X = …`.
    for (const s of c.sf.statements) {
      if (!ts.isExpressionStatement(s) || !ehAtribuicao(s.expression)) continue;
      const alvo = s.expression.left.getText(c.sf), valor = s.expression.right;
      if (alvo === `module.exports.${nome}` || alvo === `exports.${nome}`) return valores(valor, c, VAZIO, prof + 1);
      if (alvo === "module.exports") return nome === "default" ? valores(valor, c, VAZIO, prof + 1) : membro(valores(valor, c, VAZIO, prof + 1), [nome], prof + 1);
    }
    for (const s of c.sf.statements) {
      if (!ts.isExportDeclaration(s) || s.exportClause || !s.moduleSpecifier || !ts.isStringLiteral(s.moduleSpecifier)) continue;
      const outro = resolverModulo(caminho, s.moduleSpecifier.text);
      const r = outro ? exportado(outro, nome, prof + 1) : [DESC_V];
      if (r.some((x) => x.tipo !== "desconhecido")) return r;
    }
    return [DESC_V];
  };

  const chamada =(e: ts.CallExpression, ctx: Ctx, lig: Ligacoes, prof: number): Valor[] => {
    const callee = semEmbrulho(e.expression), [a0] = e.arguments;
    // import("x") / require("x"): o módulo.
    if (callee.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(callee) && callee.text === "require" && !ligacaoDe("require", callee))) {
      const origem = a0 ? textos(a0, ctx, lig, prof + 1) : [];
      if (origem.length !== 1 || origem[0].includes(DESCONHECIDO)) return [DESC_V];
      const caminho = resolverModulo(ctx.arquivo, origem[0]);
      return caminho ? [{ tipo: "modulo", caminho }] : [{ tipo: "externo", modulo: origem[0], nome: "*" }];
    }
    return limitarValores(valores(callee, ctx, lig, prof + 1).flatMap((f): Valor[] => {
      if (f.tipo === "externo") {
        if (f.modulo === "react" && IDENTIDADE_REACT.has(f.nome) && a0) return valores(a0, ctx, lig, prof + 1);
        if (f.modulo === "react" && f.nome === "useMemo" && a0) {
          return valores(a0, ctx, lig, prof + 1).flatMap((g) => (g.tipo === "expr" && ehFuncao(g.expr) ? chamar(g.expr, g.ctx, [], prof) : [DESC_V]));
        }
        return [{ tipo: "externo", modulo: f.modulo, nome: f.nome }];
      }
      if (f.tipo === "expr" && ehFuncao(f.expr)) return chamar(f.expr, f.ctx, e.arguments.map((a) => ({ a, ctx, lig })), prof);
      return [DESC_V];
    }));
  };

  /** Valores devolvidos por uma função do projeto, com os parâmetros ligados aos argumentos. */
  const chamar = (fn: Funcao, ctx: Ctx, args: readonly { a: ts.Expression; ctx: Ctx; lig: Ligacoes }[], prof: number): Valor[] => {
    if (emCurso.has(fn) || prof > PROFUNDIDADE) return [DESC_V];
    const espalhado = args.findIndex(({ a }) => ts.isSpreadElement(a));
    const lig = new Map<ts.ParameterDeclaration, () => Valor[]>();
    fn.parameters.forEach((p, i) => {
      let memo: Valor[] | null = null;
      const calcular = (): Valor[] => {
        if (p.dotDotDotToken || (espalhado >= 0 && i >= espalhado)) return [DESC_V];
        const arg = args[i];
        if (arg) return valores(arg.a, arg.ctx, arg.lig, prof + 1);
        return p.initializer ? valores(p.initializer, ctx, lig, prof + 1) : [NADA];
      };
      lig.set(p, () => (memo ??= calcular()));
    });
    emCurso.add(fn);
    try {
      const rs = retornos(fn);
      return limitarValores(rs.length ? rs.flatMap((r) => valores(r, ctx, lig, prof + 1)) : [NADA]);
    } finally {
      emCurso.delete(fn);
    }
  };

  /** Textos possíveis de uma expressão (DESCONHECIDO marca o pedaço que não se resolve). */
  const textos = (e0: ts.Node, ctx: Ctx, lig: Ligacoes, prof: number): string[] => {
    if (prof > PROFUNDIDADE || --orcamento < 0) return [DESCONHECIDO];
    const e = semEmbrulho(e0);
    const t = (x: ts.Node) => textos(x, ctx, lig, prof + 1);
    if (ts.isStringLiteralLike(e)) return [e.text];
    if (ts.isNumericLiteral(e)) return [String(Number(e.text))];
    if (e.kind === ts.SyntaxKind.TrueKeyword) return ["true"];
    if (e.kind === ts.SyntaxKind.FalseKeyword) return ["false"];
    if (e.kind === ts.SyntaxKind.NullKeyword) return ["null"];
    if (ts.isTemplateExpression(e)) return e.templateSpans.reduce((acc, s) => produto(produto(acc, t(s.expression)), [s.literal.text]), [e.head.text]);
    if (ts.isBinaryExpression(e) && (e.operatorToken.kind === ts.SyntaxKind.PlusToken || e.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken)) {
      if (emCursoTexto.has(e)) return [DESCONHECIDO];
      emCursoTexto.add(e);
      try { return produto(t(e.left), t(e.right)); } finally { emCursoTexto.delete(e); }
    }
    if (ts.isTaggedTemplateExpression(e)) {
      if (!/^String\.raw$/.test(e.tag.getText(ctx.sf))) return [DESCONHECIDO];
      const tpl = e.template;
      return ts.isNoSubstitutionTemplateLiteral(tpl) ? [tpl.rawText ?? tpl.text]
        : tpl.templateSpans.reduce((acc, s) => produto(produto(acc, t(s.expression)), [s.literal.rawText ?? s.literal.text]), [tpl.head.rawText ?? tpl.head.text]);
    }
    if (ts.isArrayLiteralExpression(e)) return juntar(e, [","], ctx, lig, prof);
    if (ts.isCallExpression(e)) {
      const r = textoDeChamada(e, ctx, lig, prof);
      if (r) return r;
    }
    const vs = valores(e, ctx, lig, prof + 1), [unico] = vs;
    if (vs.length === 1 && unico.tipo === "expr" && semEmbrulho(unico.expr) === e) return [DESCONHECIDO];
    return limitarTextos(vs.flatMap((v) => (v.tipo === "expr" ? textos(v.expr, v.ctx, v.lig, prof + 1) : v.tipo === "nada" ? [""] : [DESCONHECIDO])));
  };

  const juntar = (arr: ts.ArrayLiteralExpression, seps: string[], ctx: Ctx, lig: Ligacoes, prof: number): string[] => {
    if (arr.elements.some((x) => ts.isSpreadElement(x))) return [DESCONHECIDO];
    return limitarTextos(combinacoes(arr.elements.map((x) => textos(x, ctx, lig, prof + 1))).flatMap((c) => seps.map((s) => c.join(s))));
  };

  /** Chamadas que produzem texto conhecido: String(), Symbol(), atob, decodeURIComponent, String.fromCharCode, JSON.parse, join, concat, replace… */
  const textoDeChamada = (e: ts.CallExpression, ctx: Ctx, lig: Ligacoes, prof: number): string[] | null => {
    const callee = semEmbrulho(e.expression), [a0] = e.arguments;
    const t = (x: ts.Node) => textos(x, ctx, lig, prof + 1);
    const global = (n: ts.Node, nome: string) => ts.isIdentifier(n) && n.text === nome && !ligacaoDe(nome, n);
    if (global(callee, "String")) return a0 ? t(a0) : [""];
    if (global(callee, "Symbol")) return [SIMBOLO];
    for (const nome of ["atob", "decodeURIComponent", "decodeURI", "unescape"]) {
      if (global(callee, nome)) return a0 ? aplicarTexto(t(a0), (s) => (globalThis as unknown as Record<string, (x: string) => unknown>)[nome](s)) : [DESCONHECIDO];
    }
    if (!ts.isPropertyAccessExpression(callee)) return null;
    const alvo = semEmbrulho(callee.expression), metodo = callee.name.text;
    if (global(alvo, "String") && (metodo === "fromCharCode" || metodo === "fromCodePoint")) {
      const partes: string[][] = [];
      for (const a of e.arguments) {
        if (!ts.isSpreadElement(a)) { partes.push(t(a)); continue; }
        const vs = valores(a.expression, ctx, lig, prof + 1), v = vs[0];
        if (vs.length !== 1 || v.tipo !== "expr") return [DESCONHECIDO];
        const arr = semEmbrulho(v.expr);
        if (!ts.isArrayLiteralExpression(arr) || arr.elements.some((x) => ts.isSpreadElement(x))) return [DESCONHECIDO];
        partes.push(...arr.elements.map((x) => textos(x, v.ctx, v.lig, prof + 1)));
      }
      return limitarTextos(combinacoes(partes).map((c) => {
        const n = c.map(Number);
        if (c.some((x) => x.includes(DESCONHECIDO)) || n.some((x) => !Number.isFinite(x))) return DESCONHECIDO;
        try { return metodo === "fromCharCode" ? String.fromCharCode(...n) : String.fromCodePoint(...n); } catch { return DESCONHECIDO; }
      }));
    }
    if (global(alvo, "Symbol") && metodo === "for") return [SIMBOLO];
    if (global(alvo, "JSON") && metodo === "parse") {
      return a0 ? aplicarTexto(t(a0), (s) => { const r: unknown = JSON.parse(s); return typeof r === "string" ? r : DESCONHECIDO; }) : [DESCONHECIDO];
    }
    if (metodo === "join") {
      const seps = a0 ? t(a0) : [","];
      return limitarTextos(valores(alvo, ctx, lig, prof + 1).flatMap((v) => {
        const arr = v.tipo === "expr" ? semEmbrulho(v.expr) : null;
        return v.tipo === "expr" && arr && ts.isArrayLiteralExpression(arr) ? juntar(arr, seps, v.ctx, v.lig, prof) : [DESCONHECIDO];
      }));
    }
    if (metodo === "concat") return e.arguments.reduce((acc, a) => produto(acc, t(a)), t(alvo));
    const tipos = METODOS_DE_TEXTO.get(metodo);
    if (!tipos) return null;
    const args = e.arguments.map((a, i) => {
      const x = semEmbrulho(a);
      return tipos[i] === "r" && ts.isRegularExpressionLiteral(x) ? [REGEX + x.text] : t(a);
    });
    return limitarTextos(combinacoes([t(alvo), ...args]).map(([base, ...xs]) => {
      if ([base, ...xs].some((x) => x.includes(DESCONHECIDO))) return DESCONHECIDO;
      try {
        const conv = xs.map((x, i): unknown => {
          if (x.startsWith(REGEX)) { const lit = x.slice(1), fim = lit.lastIndexOf("/"); return new RegExp(lit.slice(1, fim), lit.slice(fim + 1)); }
          return tipos[i] === "n" ? Number(x) : x;
        });
        if (conv.some((x) => typeof x === "number" && (!Number.isFinite(x) || Math.abs(x) > 2000))) return DESCONHECIDO;
        const r: unknown = (String.prototype as unknown as Record<string, (...a: unknown[]) => unknown>)[metodo].apply(base, conv);
        return typeof r === "string" && r.length <= 2000 ? r : DESCONHECIDO;
      } catch {
        return DESCONHECIDO;
      }
    }));
  };

  /** Chaves que um spread pode pôr no elemento. */
  const chavesDe = (e: ts.Node, ctx: Ctx, lig: Ligacoes, prof: number): Chaves => {
    const r: Chaves = { nomes: [], aberta: false, repasse: false };
    if (prof > PROFUNDIDADE) return { ...r, aberta: true };
    for (const v of valores(e, ctx, lig, prof + 1)) {
      if (v.tipo === "nada") continue;
      if (v.tipo === "parametro") { r.repasse = true; continue; }
      if (v.tipo === "externo") { if (!EXTERNOS_CONFIAVEIS.get(v.modulo)?.includes(v.nome)) r.aberta = true; continue; }
      if (v.tipo !== "expr") { r.aberta = true; continue; }
      const x = semEmbrulho(v.expr);
      if (ts.isObjectLiteralExpression(x)) {
        for (const p of x.properties) {
          if (ts.isSpreadAssignment(p)) {
            const k = chavesDe(p.expression, v.ctx, v.lig, prof + 1);
            r.nomes.push(...k.nomes);
            r.aberta ||= k.aberta;
            r.repasse ||= k.repasse;
            continue;
          }
          const nomes = nomesDePropriedade(p.name, v.ctx, v.lig, prof);
          r.nomes.push(...nomes);
          if (nomes.some((n) => n.includes(DESCONHECIDO))) r.aberta = true;
        }
      } else if (!(ts.isArrayLiteralExpression(x) || ts.isStringLiteralLike(x) || ts.isNumericLiteral(x)
        || [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(x.kind))) r.aberta = true;
    }
    return r;
  };

  const ehIntrinseco = (tag: ts.JsxTagNameExpression) => ts.isJsxNamespacedName(tag) || (ts.isIdentifier(tag) && /^[a-z]/.test(tag.text));
  const repassa = new Map<ts.Node, boolean>();
  /** O componente repassa as próprias props (spread de parâmetro) a um elemento HTML ou a outro componente que repassa? */
  const funcaoRepassa = (fn: Funcao, ctx: Ctx, prof: number): boolean => {
    const memo = repassa.get(fn);
    if (memo !== undefined) return memo;
    repassa.set(fn, true); // recursão: falha fechada
    let r = false;
    if (fn.body) {
      visitar(fn.body, (n) => {
        if (r || !ts.isJsxSpreadAttribute(n) || !chavesDe(n.expression, ctx, VAZIO, prof + 1).repasse) return;
        const tag = n.parent.parent.tagName;
        if (ehIntrinseco(tag) || componenteRepassa(tag, ctx, prof + 1)) r = true;
      });
    }
    repassa.set(fn, r);
    return r;
  };
  /** Componente que pode levar props ao HTML: repassador do projeto, externo ou não resolvido (falha fechada). */
  const componenteRepassa = (tag: ts.JsxTagNameExpression, ctx: Ctx, prof: number): boolean => {
    if (prof > PROFUNDIDADE || ts.isJsxNamespacedName(tag) || tag.kind === ts.SyntaxKind.ThisKeyword) return true;
    const vs = valores(tag, ctx, VAZIO, prof + 1);
    return !vs.length || vs.some((v) => v.tipo !== "expr" || !ehFuncao(v.expr) || funcaoRepassa(v.expr, v.ctx, prof + 1));
  };
  /** Nome do elemento HTML: a tag minúscula, ou o texto que uma tag variável (`const Tag = "th"`) guarda. */
  const nomesDaTag = (tag: ts.JsxTagNameExpression, ctx: Ctx): string[] | null => {
    if (ehIntrinseco(tag)) return [tag.getText(ctx.sf)];
    const r = valores(tag, ctx, VAZIO, 1).flatMap((v) => {
      const x = v.tipo === "expr" ? semEmbrulho(v.expr) : null;
      return x && ts.isStringLiteralLike(x) ? [x.text] : [];
    });
    return r.length ? r : null;
  };

  /** Script embutido (HTML/script/URL javascript:) analisado como fonte .js pela mesma trava. */
  const analisarEmbutido = (ctx: Ctx, n: ts.Node, fonte: string, nivel: number): string[] => {
    if (nivel >= 3) return ["script embutido em profundidade demais"];
    const caminho = `${ctx.arquivo}#embutido-${n.pos}-${nivel}.js`;
    virtuais.set(caminho, fonte);
    contextos.delete(caminho);
    const c = contexto(caminho);
    return c ? achadosDe(c, nivel + 1) : ["script embutido ilegível"];
  };

  const achadosDe = (ctx: Ctx, nivel: number): string[] => {
    const { sf } = ctx;
    const achados: string[] = [];
    const achar = (n: ts.Node, o: string) => { achados.push(`${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}: ${o}`); };
    const avaliar = (n: ts.Node): string[] | null => { orcamento = ORCAMENTO; const r = textos(n, ctx, VAZIO, 0); return orcamento < 0 ? null : r; };
    const chaveAberta = (n: ts.Node) => (avaliar(n) ?? [DESCONHECIDO]).some((v) => v.includes(DESCONHECIDO));
    // O módulo do React em si (`import * as R`, `import React`), não o que os hooks devolvem.
    const deReact = (n: ts.Node) => {
      orcamento = ORCAMENTO;
      return valores(n, ctx, VAZIO, 0).some((v) => v.tipo === "externo" && /^react(-dom)?(\/|$)/.test(v.modulo) && (v.nome === "*" || v.nome === "default"));
    };
    const conferirImport = (n: ts.Node, origem: string | null) => {
      if (origem === null || origem.includes(DESCONHECIDO)) { achar(n, "import de caminho calculado"); return; }
      if (!/^(\.|@\/|\/)/.test(origem)) return; // pacote
      const alvo = resolverModulo(ctx.arquivo, origem);
      if (!alvo) achar(n, `import de "${origem}", que não se resolve`);
      else if (CODIGO.test(alvo) && !(alvo.startsWith("src/") && ehFonteDeProducao(alvo))) achar(n, `import de código fora da varredura: ${alvo}`);
    };
    const embutido = (n: ts.Node, vals: string[] | null, script: boolean, onde: string) => {
      if (!vals || vals.some((v) => v.includes(DESCONHECIDO))) { achar(n, `${onde} com conteúdo não avaliável`); return; }
      for (const v of vals) {
        if (suspeito(v) || (!script && /<script\b|javascript:|\son[a-z]+\s*=/i.test(v))) { achar(n, `${onde} com "${trecho(v)}"`); return; }
        const sub = script ? analisarEmbutido(ctx, n, v, nivel) : [];
        if (sub.length) { achar(n, `${onde}: ${sub[0]}`); return; }
      }
    };

    visitar(sf, (n) => {
      // Nome do atributo escrito no JSX, ou a propriedade ariaSort.
      if (ts.isJsxAttribute(n) && /^aria[-_]?sort$/i.test(n.name.getText(sf))) achar(n, `atributo ${n.name.getText(sf)}`);
      if ((ts.isIdentifier(n) || ts.isPrivateIdentifier(n)) && /^#?aria[-_]?sort$/i.test(n.text)) achar(n, `identificador ${n.text}`);

      // APIs que criam elemento ou escrevem atributo/HTML pelo nome; código montado em texto.
      if (ts.isIdentifier(n) && PROIBIDOS.has(n.text)) achar(n, `API proibida fora do componente: ${n.text}`);
      if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
        const c = semEmbrulho(n.expression);
        if (ts.isIdentifier(c) && (c.text === "eval" || c.text === "Function") && !ligacaoDe(c.text, c)) achar(n, `código montado em texto: ${c.text}`);
        if (ts.isPropertyAccessExpression(c) && /^(write|writeln)$/.test(c.name.text) && domish(c.expression)) achar(n, `escrita de HTML: ${c.name.text}`);
      }
      if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && /^react\/jsx(-dev)?-runtime$/.test(n.moduleSpecifier.text)) achar(n, "import do runtime de JSX");

      // A varredura fecha pelo grafo (R1 da #149, B1): a produção não importa código que ela não lê — teste,
      // mock, src/test, arquivo fora do src —, nem import que não se resolve ou de caminho calculado.
      const soTipos = (ts.isImportDeclaration(n) && !!n.importClause && (n.importClause.isTypeOnly || (!n.importClause.name && !!n.importClause.namedBindings
          && ts.isNamedImports(n.importClause.namedBindings) && n.importClause.namedBindings.elements.length > 0 && n.importClause.namedBindings.elements.every((e) => e.isTypeOnly))))
        || (ts.isExportDeclaration(n) && (n.isTypeOnly || (!!n.exportClause && ts.isNamedExports(n.exportClause) && n.exportClause.elements.length > 0 && n.exportClause.elements.every((e) => e.isTypeOnly))))
        || (ts.isImportEqualsDeclaration(n) && n.isTypeOnly);
      const especificador = (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) ? n.moduleSpecifier
        : ts.isImportEqualsDeclaration(n) && ts.isExternalModuleReference(n.moduleReference) ? n.moduleReference.expression : undefined;
      if (especificador && !soTipos) conferirImport(n, ts.isStringLiteral(especificador) ? especificador.text : null);
      if (ts.isCallExpression(n) && (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === "require" && !ligacaoDe("require", n.expression)))) {
        const origem = n.arguments[0] ? avaliar(n.arguments[0]) : null;
        conferirImport(n, origem && origem.length === 1 ? origem[0] : null);
      }

      // Componente que repassa as props ao HTML chamado como função: o argumento é o objeto de props (B2).
      if (ts.isCallExpression(n) && n.arguments[0]) {
        const c = semEmbrulho(n.expression);
        const nomeC = ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : "";
        if (/^[A-Z]/.test(nomeC)) {
          orcamento = ORCAMENTO;
          if (valores(c, ctx, VAZIO, 0).some((v) => v.tipo === "expr" && ehFuncao(v.expr) && funcaoRepassa(v.expr, v.ctx, 0))) {
            const k = chavesDe(n.arguments[0], ctx, VAZIO, 0);
            if (k.aberta || k.repasse || k.nomes.some(suspeito)) achar(n, `props com chaves desconhecidas na chamada direta de ${nomeC}`);
          }
        }
      }

      // (a) o texto.
      if (raizDeTexto(n)) {
        const vals = avaliar(n);
        if (!vals) achar(n, "expressão grande demais para avaliar");
        else {
          const ruim = vals.find((v) => suspeito(v) || PROIBIDOS.has(v) || v === "eval");
          if (ruim !== undefined) achar(n, `texto "${trecho(ruim)}"`);
          for (const v of vals) {
            if (!/^\s*javascript:/i.test(v)) continue;
            const sub = v.includes(DESCONHECIDO) ? ["URL javascript: não avaliável"] : analisarEmbutido(ctx, n, v.replace(/^\s*javascript:/i, ""), nivel);
            if (sub.length) achar(n, `URL javascript: ${sub[0]}`);
          }
        }
      }

      // (b) spread no JSX.
      if (ts.isJsxSpreadAttribute(n)) {
        const el = n.parent.parent, tag = el.tagName;
        orcamento = ORCAMENTO;
        const nomesTag = nomesDaTag(tag, ctx);
        if (nomesTag?.some((x) => x.toLowerCase() === "th" || x.includes(DESCONHECIDO))) achar(n, "spread em <th> fora do componente");
        const role = el.attributes.properties.find((a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && a.name.getText(sf) === "role");
        if (role) {
          const i = role.initializer;
          const vals = !i ? [""] : ts.isStringLiteral(i) ? [i.text] : ts.isJsxExpression(i) && i.expression ? avaliar(i.expression) ?? [DESCONHECIDO] : [DESCONHECIDO];
          if (vals.some((v) => v.includes(DESCONHECIDO) || /^(columnheader|rowheader)$/i.test(v.trim()))) achar(n, "spread em elemento com role de cabeçalho (ou role calculado)");
        }
        orcamento = ORCAMENTO;
        const k = chavesDe(n.expression, ctx, VAZIO, 0);
        const ruim = k.nomes.find(suspeito);
        if (ruim !== undefined) achar(n, `spread com a chave "${trecho(ruim)}"`);
        else if (k.aberta && (nomesTag !== null || componenteRepassa(tag, ctx, 0))) achar(n, `spread com chaves desconhecidas em <${tag.getText(sf)}>`);
      }

      // (b) HTML e script embutidos.
      if (ts.isJsxAttribute(n) && n.initializer) {
        const nome = n.name.getText(sf), tagEl = n.parent.parent.tagName.getText(sf);
        const expr = ts.isJsxExpression(n.initializer) ? n.initializer.expression : n.initializer;
        if (nome === "dangerouslySetInnerHTML" && expr) {
          orcamento = ORCAMENTO;
          const vals = limitarTextos(membro(valores(expr, ctx, VAZIO, 0), ["__html"], 0).flatMap((v) => (v.tipo === "expr" ? textos(v.expr, v.ctx, v.lig, 1) : [DESCONHECIDO])));
          embutido(n, orcamento < 0 ? null : vals, tagEl === "script", "dangerouslySetInnerHTML");
        }
        if (/^src[dD]oc$/.test(nome) && expr) embutido(n, avaliar(expr), false, "srcDoc");
      }
      if (ts.isJsxElement(n) && n.openingElement.tagName.getText(sf) === "script" && n.children.length) {
        orcamento = ORCAMENTO;
        const partes = n.children.map((c) => (ts.isJsxText(c) ? [c.text] : ts.isJsxExpression(c) && c.expression ? textos(c.expression, ctx, VAZIO, 0) : [DESCONHECIDO]));
        embutido(n, orcamento < 0 ? null : combinacoes(partes).map((c) => c.join("")), true, "<script>");
      }

      // (b) escrita/chamada com nome calculado em objeto do DOM, ou leitura assim no React e nos globais.
      if (ehAtribuicao(n)) {
        const esquerda = semEmbrulho(n.left);
        if (ts.isElementAccessExpression(esquerda) && domish(esquerda.expression) && chaveAberta(esquerda.argumentExpression)) achar(n, "escrita com chave calculada em objeto do DOM");
      }
      if (ts.isElementAccessExpression(n)) {
        const base = semEmbrulho(n.expression);
        const global = ts.isIdentifier(base) && RAIZES_DOM.has(base.text) && !ligacaoDe(base.text, base);
        const chamado = ts.isCallExpression(n.parent) && semEmbrulho(n.parent.expression) === n && domish(base);
        if ((global || chamado || deReact(base)) && chaveAberta(n.argumentExpression)) achar(n, "acesso com nome calculado em objeto do DOM ou do React");
      }
      if (ts.isCallExpression(n) && n.arguments[0]) {
        const nome = semEmbrulho(n.expression).getText(sf), [alvo, chave] = n.arguments;
        if (/^(Object\.assign|Object\.defineProperties)$/.test(nome) && domish(alvo)) {
          orcamento = ORCAMENTO;
          const fontesDeChaves = n.arguments.slice(1).map((s) => chavesDe(s, ctx, VAZIO, 0));
          if (fontesDeChaves.some((k) => k.aberta || k.repasse || k.nomes.some(suspeito))) achar(n, `${nome} com chaves desconhecidas em objeto do DOM`);
        }
        if (/^(Object\.defineProperty|Reflect\.(set|defineProperty))$/.test(nome) && chave && domish(alvo) && chaveAberta(chave)) achar(n, `${nome} com chave calculada em objeto do DOM`);
      }
    });
    return achados;
  };

  return {
    achados: (arquivo: string): string[] => {
      const c = contexto(arquivo);
      return c ? achadosDe(c, 0) : [`${arquivo}: ilegível`];
    },
  };
}

/** Achados de aria-sort fora do componente numa fonte; `modulos` são arquivos virtuais para os imports do autoteste. */
export function ariaSortNoFonte(fonte: string, arquivo = "src/app/x.tsx", modulos: Record<string, string> = {}): string[] {
  return analisador(new Map([...Object.entries(modulos), [arquivo, fonte]])).achados(arquivo);
}

const colunas = (html: string) => (html.match(/data-coluna-ordenavel="[^"]+"/g) ?? []).map((m) => m.slice(23, -1));

describe("colunas ordenáveis (E1)", () => {
  it("aria-sort só é escrito por <ColunaOrdenavel> — nenhum arquivo de produção o põe à mão, em nenhuma grafia", () => {
    const analise = analisador();
    const ofensores = fontes.filter(({ arquivo }) => arquivo !== COMPONENTE).flatMap(({ arquivo }) => analise.achados(arquivo).map((a) => `${arquivo}:${a}`));
    expect(ofensores).toEqual([]);
    // Com app/ ou pages/ na raiz, o Next ignora src/app — e as telas sairiam da varredura.
    expect(["app", "pages"].filter((d) => existsSync(d))).toEqual([]);
  }, 120_000);

  it("o próprio componente: aria-sort só no <th>, sem spread, e só exporta ColunaOrdenavel", () => {
    const conteudo = fontes.find((f) => f.arquivo === COMPONENTE)?.conteudo ?? "";
    const sf = ts.createSourceFile(COMPONENTE, conteudo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const ondeAriaSort: string[] = [], exportados: string[] = [];
    let spreads = 0;
    visitar(sf, (n) => {
      if (ts.isJsxAttribute(n) && /^aria[-_]?sort$/i.test(n.name.getText(sf))) ondeAriaSort.push(n.parent.parent.tagName.getText(sf));
      if (ts.isJsxSpreadAttribute(n) || ts.isSpreadAssignment(n)) spreads++;
    });
    for (const s of sf.statements) {
      if (ts.isExportDeclaration(s) || ts.isExportAssignment(s)) exportados.push(s.getText(sf));
      else if (ts.canHaveModifiers(s) && ts.getModifiers(s)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
        exportados.push(...(ts.isVariableStatement(s) ? s.declarationList.declarations.flatMap((d) => nomesDaLigacao(d.name)) : [(s as ts.DeclarationStatement).name?.getText(sf) ?? "?"]));
      }
    }
    expect(ondeAriaSort).toEqual(["th"]);
    expect(spreads).toBe(0);
    expect(exportados).toEqual(["ColunaOrdenavel"]);
  });

  it("as tabelas de /alunos, /empresas e /comissoes (as duas telas) usam <ColunaOrdenavel>", () => {
    const sem = TELAS.filter((t) => !/<ColunaOrdenavel\b/.test(fontes.find((f) => f.arquivo === t)?.conteudo ?? ""));
    expect(sem).toEqual([]);
  });

  it("/alunos: cabeçalhos ordenáveis vêm de <ColunaOrdenavel>, e nenhum aria-sort de outro lugar", () => {
    const html = renderToStaticMarkup(createElement(AlunosLista, {
      alunos: [{ id: "a1", codigo: "A-1", nome: "Ana", status: StatusAluno.ATIVO, pais: "Costa Rica", turmas: [], financeiro: null }],
      total: 1, totalBase: 1, filtros: lerFiltrosAlunos({}), opcoes: { paises: [], turmas: [] }, exibirFinanceiro: true,
    }));
    expect(colunas(html)).toEqual(["nome", "pais", "status"]);
    expect(html).not.toContain("aria-sort");
  });

  it("/empresas: cabeçalhos ordenáveis vêm de <ColunaOrdenavel>, e nenhum aria-sort de outro lugar", () => {
    const html = renderToStaticMarkup(createElement(EmpresasCliente, {
      empresas: [{ id: "e1", codigo: "E-1", nome: "Acme", pais: null, ativo: true, colaboradores: 2, faturasAReceber: 0 }],
      total: 1, totalBase: 1, filtros: lerFiltrosEmpresas({}), paises: [],
    }));
    expect(colunas(html)).toEqual(["codigo", "nome", "colaboradores", "situacao"]);
    expect(html).not.toContain("aria-sort");
  });

  it("/financeiro/comissoes: cabeçalhos ordenáveis vêm de <ColunaOrdenavel>, e nenhum aria-sort de outro lugar", () => {
    const html = renderToStaticMarkup(createElement(Comissoes, {
      comissoes: [{ id: "c1", vendedor: "Bia", valor: 10, moeda: "USD", percentual: 5, status: StatusComissao.PENDENTE }],
      aPagar: [], podePagar: false, onFechar: () => {}, fechamentoAutomatico: false, onToggleAutomatico: () => {}, isPending: false,
      ordenacao: { atual: lerOrdemComissoes({}), rota: "/financeiro/comissoes", parametros: {} },
    }));
    expect(colunas(html)).toEqual(["vendedor", "valor", "status"]);
    expect(html).not.toContain("aria-sort");
  });

  it("varredura: .js, .jsx, .mjs, .cjs e .json de produção entram; testes ficam de fora (B9, X20/X21)", () => {
    for (const a of ["src/lib/x.ts", "src/app/x.tsx", "src/lib/x.js", "src/lib/x.jsx", "src/lib/x.mjs", "src/lib/x.cjs", "src/lib/x.json"]) expect(ehFonteDeProducao(a), a).toBe(true);
    for (const a of ["src/app/x.test.ts", "src/app/x.test.tsx", "src/lib/x.spec.js", "src/lib/__mocks__/x.ts", "src/lib/__tests__/x.ts", "src/test/integracao.ts", "src/app/globals.css", "src/lib/x.md"]) {
      expect(ehFonteDeProducao(a), a).toBe(false);
    }
  });

  it("autoteste (B1 da R1 da #149): a produção não importa código que a varredura não lê", () => {
    const CABECALHO = 'export function CabecalhoPais() { return <th aria-sort="ascending">País</th>; }';
    const casos: [string, string, Record<string, string>][] = [
      ["E1 componente num *.test.tsx", 'import { CabecalhoPais } from "@/components/CabecalhoPais.test"; const x = <CabecalhoPais />;', { "src/components/CabecalhoPais.test.tsx": CABECALHO }],
      ["E1 reexportação de *.test", 'export { CabecalhoPais } from "@/components/CabecalhoPais.test";', { "src/components/CabecalhoPais.test.tsx": CABECALHO }],
      ["E1 import dinâmico de *.test", 'export const m = import("@/components/CabecalhoPais.test");', { "src/components/CabecalhoPais.test.tsx": CABECALHO }],
      ["E1 *.spec.tsx", 'import { CabecalhoPais } from "@/components/CabecalhoPais.spec"; const x = <CabecalhoPais />;', { "src/components/CabecalhoPais.spec.tsx": CABECALHO }],
      ["E2 componente em __mocks__", 'import { CabecalhoPais } from "@/lib/__mocks__/cabecalho"; const x = <CabecalhoPais />;', { "src/lib/__mocks__/cabecalho.tsx": CABECALHO }],
      ["E2 componente em __tests__ por require", 'const m = require("@/lib/__tests__/cabecalho");', { "src/lib/__tests__/cabecalho.tsx": CABECALHO }],
      ["E2 componente em src/test", 'import { CabecalhoPais } from "@/test/cabecalho"; const x = <CabecalhoPais />;', { "src/test/cabecalho.tsx": CABECALHO }],
      ["E3 componente fora do src", 'import { CabecalhoPais } from "../../componentes-extra/CabecalhoPais"; const x = <CabecalhoPais />;', { "componentes-extra/CabecalhoPais.tsx": CABECALHO }],
      ["E3 import de efeito fora do src", 'import "../../componentes-extra/efeito";', { "componentes-extra/efeito.js": "export {};" }],
      ["import que não se resolve", 'import { CabecalhoPais } from "./nao-existe"; const x = <CabecalhoPais />;', {}],
      ["import de caminho absoluto", 'import { CabecalhoPais } from "/tmp/CabecalhoPais"; const x = <CabecalhoPais />;', {}],
      ["import dinâmico de caminho calculado", "declare const caminho: string; export const m = import(caminho);", {}],
    ];
    for (const [nome, fonte, modulos] of casos) expect(ariaSortNoFonte(fonte, "src/app/x.tsx", modulos), nome).not.toEqual([]);
    // Só tipos não levam código; CSS e pacotes não são a varredura.
    expect(ariaSortNoFonte('import type { CabecalhoPais } from "@/components/CabecalhoPais.test"; import { type X } from "@/lib/__mocks__/x"; import "./globals.css"; import { z } from "zod";',
      "src/app/x.tsx", { "src/components/CabecalhoPais.test.tsx": CABECALHO, "src/lib/__mocks__/x.ts": "export type X = 1;" })).toEqual([]);
  });

  it("autoteste (EXTENSOES): import sem extensão de cada tipo de módulo de produção se resolve — e não é apontado", () => {
    const modulos: Record<string, string> = {
      "src/lib/ok-tsx.tsx": "export const OK = 1;", "src/lib/ok-ts.ts": "export const OK = 1;", "src/lib/ok-jsx.jsx": "export const OK = 1;",
      "src/lib/ok-js.js": "export const OK = 1;", "src/lib/ok-mjs.mjs": "export const OK = 1;", "src/lib/ok-cjs.cjs": "module.exports = { OK: 1 };",
      "src/lib/ok-json.json": '{ "OK": 1 }', "src/lib/okdir/index.ts": "export const OK = 1;",
    };
    for (const nome of ["ok-tsx", "ok-ts", "ok-jsx", "ok-js", "ok-mjs", "ok-cjs", "ok-json", "okdir"]) {
      expect(ariaSortNoFonte(`import M from "@/lib/${nome}"; export const x = M;`, "src/app/x.tsx", modulos), nome).toEqual([]);
    }
  });

  it("autoteste (texto): grafias antigas — literal, camelCase, concatenação, template, join, concat, constante, helper .ts", () => {
    for (const fonte of [
      '<th aria-sort="ascending">', "<th ariaSort={x}>", '<th {...{["aria-" + "sort"]: "ascending"}}>', "<th {...{[`aria-${t}`]: v}}>", "const k = 'aria-' + 'sort';",
      '<th {...{["aria" + "-sort"]: "ascending"}}>', '<th {...{[`aria${"-sort"}`]: "ascending"}}>', '<th {...{["aria-so" + "rt"]: "x"}}>',
      'const k = ["aria", "sort"].join("-");', 'const k = "aria".concat("-sort");', 'const A = "aria"; const k = A + "-sort";', 'const k = "aria-" + atributo;',
    ]) expect(ariaSortNoFonte(fonte), fonte).not.toEqual([]);
    expect(ariaSortNoFonte('export const ORDEM = "aria-sort";', "src/lib/helper.ts")).not.toEqual([]);
  });

  it("autoteste (texto): as evasões da revisão R3 da #136 (B9) — cada uma pega pelo avaliador, sem depender do <th>", () => {
    const PEDACOS = { "src/lib/pedacos.ts": 'export const ARIA = "aria"; export const SORT = "-sort";' };
    const casos: [string, string, Record<string, string>?][] = [
      ["X1 replace", 'const k = "aria-sorx".replace("x", "t");'],
      ["X1 replace com regex", 'const k = "aria-sorx".replace(/x$/, "t");'],
      ["X1 replaceAll", 'const k = "aria-sorx".replaceAll("x", "t");'],
      ["X3 satisfies", 'const k = ("aria" satisfies string) + "-sort";'],
      ["X5 ternário em pedaço", 'declare const c: boolean; const k = (c ? "aria" : "") + "-sort";'],
      ["X6 +=", 'let k = "aria"; k += "-sort";'],
      ["X7 String.fromCharCode", "const k = String.fromCharCode(97, 114, 105, 97, 45, 115, 111, 114, 116);"],
      ["X7 fromCharCode com lista", "const C = [97, 114, 105, 97, 45, 115, 111, 114, 116]; const k = String.fromCharCode(...C);"],
      ["X7 fromCodePoint hexadecimal", "const k = String.fromCodePoint(0x61, 0x72, 0x69, 0x61, 0x2d, 0x73, 0x6f, 0x72, 0x74);"],
      ["X9 membro de objeto", 'const ATR = { a: "aria", s: "-sort" }; const k = ATR.a + ATR.s;'],
      ["X9 membro por índice", 'const ATR = { a: "aria", s: "-sort" }; const k = ATR["a"] + ATR["s"];'],
      ["X9 membro aninhado em template", 'const P = { x: { a: "aria" } }; const k = `${P.x.a}-sort`;'],
      ["helper que junta os pedaços", 'const juntar = (a: string, b: string) => a + b; const k = juntar("aria", "-sort");'],
      ["atob", 'const k = atob("YXJpYS1zb3J0");'],
      ["decodeURIComponent", 'const k = decodeURIComponent("aria%2Dsort");'],
      ["JSON.parse com escape", String.raw`const k = JSON.parse('"\\u0061ria-sort"');`],
      ["pedaço desconhecido + -sort", "declare const prefixo: string; const k = prefixo + \"-sort\";"],
      ["X10 pedaços importados de src/lib", 'import { ARIA, SORT } from "@/lib/pedacos"; const k = ARIA + SORT;', PEDACOS],
      ["X10 import de namespace", 'import * as P from "@/lib/pedacos"; const k = P.ARIA + P.SORT;', PEDACOS],
      ["X10 reexportação", 'import { A, S } from "@/lib/indice"; const k = `${A}${S}`;', { ...PEDACOS, "src/lib/indice.ts": 'export { ARIA as A, SORT as S } from "./pedacos";' }],
      ["X20 pedaços num .js", 'import { PEDACOS } from "@/lib/pedacos.js"; const k = PEDACOS.a + PEDACOS.s;', { "src/lib/pedacos.js": 'export const PEDACOS = { a: "aria", s: "-sort" };' }],
      ["X21 pedaços num JSON", 'import P from "@/lib/pedacos.json"; const k = P.a + P.s;', { "src/lib/pedacos.json": '{ "a": "aria", "s": "-sort" }' }],
    ];
    for (const [nome, fonte, modulos] of casos) expect(ariaSortNoFonte(fonte, "src/app/x.tsx", modulos), nome).not.toEqual([]);
    expect(ariaSortNoFonte('export const P = { "aria-sort": "ascending" };', "src/lib/x.js"), "X20 helper .js").not.toEqual([]);
    expect(ariaSortNoFonte('module.exports = { atributo: "aria-sort" };', "src/lib/x.cjs"), "X20 CommonJS").not.toEqual([]);
    expect(ariaSortNoFonte('{ "atributo": "aria-sort" }', "src/lib/x.json"), "X21 JSON").not.toEqual([]);
    expect(ariaSortNoFonte('{ "aria-sort": "ascending" }', "src/lib/x.json"), "X21 chave JSON").not.toEqual([]);
  });

  it("autoteste (destino): spread, API do DOM e HTML embutido que podem pôr aria-sort, mesmo com o nome ilegível", () => {
    const casos: [string, string][] = [
      ["spread em <th>, mesmo de props", "function T(p: object) { return <th {...p} />; }"],
      ["spread em <th> por tag variável", 'const Tag = "th"; function T(p: object) { return <Tag {...p} />; }'],
      ["spread em role=columnheader", 'function T(p: object) { return <div role="columnheader" {...p} />; }'],
      ["spread com role calculado", "function T(p: object, r: string) { return <div role={r} {...p} />; }"],
      ["chave calculada que não se resolve, em HTML", 'import { f } from "pacote"; const x = <div {...{ [f()]: "ascending" }} />;'],
      ["objeto mutado com chave calculada", 'import { f } from "pacote"; const o: Record<string, string> = {}; o[f()] = "ascending"; const x = <div {...o} />;'],
      ["origem externa fora da lista", 'import { useAlgo } from "pacote"; function C() { const a = useAlgo(); return <div {...a} />; }'],
      ["componente local que repassa ao HTML", 'import { f } from "pacote"; function Repassa(p: object) { return <span {...p} />; } const x = <Repassa {...{ [f()]: "x" }} />;'],
      ["Botao (repassa ao <button>)", 'import { f } from "pacote"; import { Botao } from "@/components/Botao"; const x = <Botao {...{ [f()]: "x" }} />;'],
      ["componente externo", 'import Link from "next/link"; import { f } from "pacote"; const x = <Link href="/" {...{ [f()]: "x" }} />;'],
      ["createElement", 'import { createElement } from "react"; const x = createElement("th", { scope: "col" });'],
      ["React.cloneElement", 'import React from "react"; declare const el: React.ReactElement; const x = React.cloneElement(el, {});'],
      ["runtime de JSX", 'import { jsx } from "react/jsx-runtime"; const x = jsx("th", {});'],
      ["nome calculado no módulo do React", 'import * as R from "react"; declare const nome: string; const f = R["create" + nome];'],
      ["setAttribute", "declare const el: HTMLElement; declare const k: string; el.setAttribute(k, \"ascending\");"],
      ["setAttribute por texto", 'declare const el: HTMLElement; declare const k: string; (el as unknown as Record<string, (a: string, b: string) => void>)["set" + "Attribute"](k, "x");'],
      ["toggleAttribute", "declare const el: HTMLElement; declare const k: string; el.toggleAttribute(k);"],
      ["innerHTML", 'declare const el: HTMLElement; el.innerHTML = "<b>x</b>";'],
      ["ref.current com chave calculada", 'import { useRef } from "react"; declare const k: string; function C() { const ref = useRef<HTMLTableCellElement>(null); (ref.current as unknown as Record<string, string>)[k] = "ascending"; return null; }'],
      ["e.currentTarget com chave calculada", "declare const k: string; const h = (e: { currentTarget: object }) => { (e.currentTarget as Record<string, string>)[k] = \"x\"; };"],
      ["callback de ref com chave calculada", 'declare const k: string; const x = <th ref={(el) => { if (el) (el as unknown as Record<string, string>)[k] = "x"; }} />;'],
      ["document com chave calculada", "declare const k: string; (document.querySelector(\"th\") as unknown as Record<string, string>)[k] = \"x\";"],
      ["Object.assign em nó do DOM", 'import { f } from "pacote"; declare const e: { target: object }; Object.assign(e.target, { [f()]: "x" });'],
      ["dangerouslySetInnerHTML não avaliável", "declare const html: string; const x = <div dangerouslySetInnerHTML={{ __html: html }} />;"],
      ["script embutido que escreve atributo", "const x = <script dangerouslySetInnerHTML={{ __html: \"document.querySelector('th').setAttribute(k, 'ascending')\" }} />;"],
      ["script como filho", "const x = <script>{\"document.querySelector('th').toggleAttribute(k)\"}</script>;"],
      ["URL javascript:", 'const x = <a href="javascript:document.body.setAttribute(k, v)">x</a>;'],
      ["eval", 'declare const codigo: string; eval(codigo);'],
      ["new Function", 'declare const codigo: string; const f = new Function(codigo);'],
    ];
    for (const [nome, fonte] of casos) expect(ariaSortNoFonte(fonte), nome).not.toEqual([]);
  });

  it("autoteste (B2 da R1 da #149): só o objeto de props inteiro de um componente pode ser repassado", () => {
    const casos: [string, string][] = [
      ["E4 objeto por prop comum", 'function Cel({ extra }: { extra: Record<string, string> }) { return <div {...extra} />; } const x = <Cel extra={{ [String(Date.now())]: "ascending" }} />;'],
      ["E4b aria-sort montado de forma ilegível", 'function Cel({ extra }: { extra: Record<string, string> }) { return <div {...extra} />; } const x = <Cel extra={{ [["ar", "ia-so", "rt"].reverse().reverse().join("")]: "ascending" }} />;'],
      ["E4 por props.extra", "function Cel(props: { extra: object }) { return <div {...props.extra} />; }"],
      ["E4 prop aninhada do resto", "function Cel({ ...resto }: { extra: object }) { return <div {...resto.extra} />; }"],
      ["segundo parâmetro", "function Cel(a: object, b: object) { return <div {...b} />; }"],
      ["função comum (não componente)", "const linha = (p: object) => <tr {...p} />;"],
      ["callback de .map", "declare const itens: object[]; const x = itens.map((i) => <div {...i} />);"],
      ["componente repassador chamado direto", 'import { f } from "pacote"; function Repassa(p: object) { return <span {...p} />; } const x = Repassa({ [f()]: "x" });'],
    ];
    for (const [nome, fonte] of casos) expect(ariaSortNoFonte(fonte), nome).not.toEqual([]);
    const permitidos: [string, string][] = [
      ["props inteiras", "function Cel(props: object) { return <div {...props} />; }"],
      ["resto das props", "function Cel({ a, ...resto }: { a: string }) { return <div {...resto}>{a}</div>; }"],
      ["componente em arrow", "const Cel = (p: object) => <div {...p} />;"],
      ["componente em forwardRef", 'import { forwardRef } from "react"; const Cel = forwardRef<HTMLButtonElement, object>(function cel(p, ref) { return <button ref={ref} {...p} />; });'],
      ["componente em memo", 'import { memo } from "react"; const Cel = memo((p: object) => <div {...p} />);'],
      ["componente repassador chamado direto com chaves conhecidas", 'function Repassa(p: object) { return <span {...p} />; } const x = Repassa({ title: "x" });'],
    ];
    for (const [nome, fonte] of permitidos) expect(ariaSortNoFonte(fonte), nome).toEqual([]);
  });

  it("autoteste (B3 da R1 da #149): cada item das listas fechadas tem um caso que falha sem ele", () => {
    // PROIBIDOS: o nome sozinho, num objeto qualquer (nenhuma outra regra pega).
    for (const nome of PROIBIDOS) expect(ariaSortNoFonte(`declare const el: any; declare const k: string; el.${nome}(k);`), nome).not.toEqual([]);
    // RAIZES_DOM: escrita com chave calculada no global.
    for (const raiz of RAIZES_DOM) expect(ariaSortNoFonte(`declare const k: string; ${raiz}[k] = "ascending";`), raiz).not.toEqual([]);
    // MEMBROS_DOM: escrita com chave calculada no membro de um objeto qualquer.
    for (const m of MEMBROS_DOM) expect(ariaSortNoFonte(`declare const o: any; declare const k: string; o.${m}[k] = "ascending";`), m).not.toEqual([]);
    // CONSULTAS_DOM: escrita com chave calculada no resultado da consulta.
    for (const c of ["querySelector", "querySelectorAll", "getElementById", "getElementsByTagName", "getElementsByClassName", "closest", "elementFromPoint", "elementsFromPoint", "item", "namedItem"]) {
      expect(ariaSortNoFonte(`declare const o: any; declare const k: string; o.${c}("x")[k] = "ascending";`), c).not.toEqual([]);
    }
    for (const m of ["write", "writeln"]) expect(ariaSortNoFonte(`declare const html: string; document.${m}(html);`), m).not.toEqual([]);
    // METODOS_DE_TEXTO: sem o método, o último pedaço vira desconhecido e "aria-sor" + ? não é apontado.
    const metodos: Record<string, string> = {
      replace: '"x".replace("x", "t")', replaceAll: '"x".replaceAll("x", "t")', toLowerCase: '"T".toLowerCase()', toUpperCase: '"t".toUpperCase()',
      toLocaleLowerCase: '"T".toLocaleLowerCase()', toLocaleUpperCase: '"t".toLocaleUpperCase()', trim: '" t ".trim()', trimStart: '" t".trimStart()',
      trimEnd: '"t ".trimEnd()', normalize: '"t".normalize("NFC")', slice: '"xt".slice(1)', substring: '"xt".substring(1)', substr: '"xt".substr(1)',
      at: '"xt".at(1)', charAt: '"xt".charAt(1)', padStart: '"".padStart(1, "t")', padEnd: '"".padEnd(1, "t")', repeat: '"t".repeat(1)',
      toString: '"t".toString()', valueOf: '"t".valueOf()',
    };
    expect(Object.keys(metodos).sort()).toEqual([...METODOS_DE_TEXTO.keys()].sort());
    for (const [m, expr] of Object.entries(metodos)) expect(ariaSortNoFonte(`const k = "aria-sor" + ${expr};`), m).not.toEqual([]);
    expect(ariaSortNoFonte('declare const x: string; const k = "aria-sor" + x;'), "controle do método").toEqual([]);
    // MUTADORES: objeto de chaves conhecidas, depois mutado — o spread em HTML passa a ter chaves desconhecidas.
    for (const m of ["Object.assign(o, x)", "Object.defineProperty(o, x, {})", "Object.defineProperties(o, x)", "Object.setPrototypeOf(o, x)",
      "Reflect.set(o, x, 1)", "Reflect.defineProperty(o, x, {})", "Reflect.deleteProperty(o, x)", "Reflect.setPrototypeOf(o, x)"]) {
      expect(ariaSortNoFonte(`declare const x: any; const o = { a: 1 }; ${m}; const y = <div {...o} />;`), m).not.toEqual([]);
    }
    expect(ariaSortNoFonte("declare const x: any; const o = { a: 1 }; const y = <div {...o} />;"), "controle do mutador").toEqual([]);
    // IDENTIDADE_REACT: o componente/callback é seguido através da função do React.
    expect([...IDENTIDADE_REACT].sort()).toEqual(["forwardRef", "memo", "useCallback"]);
    for (const f of ["forwardRef", "memo"]) {
      const fonte = f === "forwardRef"
        ? 'import { forwardRef } from "react"; import { dados } from "pacote"; const Fixo = forwardRef<HTMLParagraphElement, { x: string }>(function Fixo({ x }, ref) { return <p ref={ref}>{x}</p>; }); const y = <Fixo {...dados} />;'
        : 'import { memo } from "react"; import { dados } from "pacote"; const Fixo = memo(function Fixo({ x }: { x: string }) { return <p>{x}</p>; }); const y = <Fixo {...dados} />;';
      expect(ariaSortNoFonte(fonte), `${f}: componente que não repassa`).toEqual([]);
    }
    expect(ariaSortNoFonte('import { useCallback } from "react"; function C() { const juntar = useCallback((a: string, b: string) => a + b, []); const k = juntar("aria", "-sort"); return k; }'), "useCallback").not.toEqual([]);
    expect(ariaSortNoFonte('import { useMemo } from "react"; function C() { const juntar = useMemo(() => (a: string, b: string) => a + b, []); const k = juntar("aria", "-sort"); return k; }'), "useMemo").not.toEqual([]);
    // EXTERNOS_CONFIAVEIS: lista fechada exata — acrescentar uma origem afrouxa a trava.
    expect([...EXTERNOS_CONFIAVEIS]).toEqual([
      ["react-hook-form", ["useForm", "useFormContext"]], ["@dnd-kit/core", ["useDraggable", "useDroppable"]], ["@dnd-kit/sortable", ["useSortable"]],
    ]);
    for (const [modulo, hooks] of EXTERNOS_CONFIAVEIS) for (const hook of hooks) {
      expect(ariaSortNoFonte(`import { ${hook} } from "${modulo}"; function C() { const r = ${hook}(); return <div {...r} />; }`), `${modulo}#${hook}`).toEqual([]);
      expect(ariaSortNoFonte(`import { ${hook} } from "outro-${modulo}"; function C() { const r = ${hook}(); return <div {...r} />; }`), `outro módulo: ${hook}`).not.toEqual([]);
    }
  });

  it("autoteste (controle negativo): o que o app usa hoje não é apontado", () => {
    const casos: [string, string][] = [
      ["aria-label", '<th aria-label="Valor">'],
      ["texto comum", 'const t = "ordenar";'],
      ["template de classe", "<th className={`px-${n}`}>"],
      ["concatenação comum", 'const s = "Página " + n;'],
      ["palavra terminada em aria", 'declare const n: string; const s = "Secretaria" + n;'],
      ["replace que não dá aria-sort", 'const k = "aria-label".replace("label", "describedby");'],
      ["register do react-hook-form", 'import { useForm } from "react-hook-form"; function F() { const { register } = useForm(); return <input {...register("nome")} />; }'],
      ["attributes/listeners do dnd-kit", 'import { useDraggable } from "@dnd-kit/core"; function C() { const { attributes, listeners } = useDraggable({ id: "a" }); return <button {...attributes} {...listeners} />; }'],
      ["helper do projeto com chaves conhecidas", 'import { useInicioDoPeriodo } from "@/lib/periodo-form"; function F() { const periodo = useInicioDoPeriodo(); return <input {...periodo.propsInicio} />; }'],
      ["repasse das próprias props", "function B({ a, ...resto }: { a: string; [k: string]: unknown }) { return <button {...resto}>{a}</button>; }"],
      ["objeto de chaves conhecidas em componente", 'import { ColunaOrdenavel } from "@/components/ColunaOrdenavel"; const coluna = { ordenacao: null, rota: "/x", parametros: {} }; const x = <ColunaOrdenavel campo="a" rotulo="A" {...coluna} />;'],
      ["dados desconhecidos em componente que não repassa", 'import { consultar } from "pacote"; function Interno({ x }: { x: string }) { return <p>{x}</p>; } const d = consultar(); const y = <Interno {...d.dado} />;'],
      ["registro comum com chave calculada", 'declare const lista: { moeda: string }[]; const r: Record<string, number> = {}; for (const c of lista) r[c.moeda] = 1;'],
      ["useRef de registro", 'import { useRef } from "react"; declare const id: string; function C() { const chaves = useRef<Record<string, string>>({}); chaves.current[id] ??= "x"; return null; }'],
      ["Object.assign com chaves conhecidas no form", "declare const e: { currentTarget: HTMLFormElement }; const f = e.currentTarget; Object.assign(f, { __dados: 1 });"],
      ["script de tema conhecido", "const tema = \"(function(){document.documentElement.classList.add('dark')})();\"; const x = <script dangerouslySetInnerHTML={{ __html: tema }} />;"],
      ["Symbol como chave", 'const protegido = Symbol.for("x"); declare const o: object; Object.defineProperty(o, protegido, { value: true });'],
    ];
    for (const [nome, fonte] of casos) expect(ariaSortNoFonte(fonte), nome).toEqual([]);
  });
});
