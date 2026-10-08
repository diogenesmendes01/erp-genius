import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Trava do "não perder o que foi digitado" (docs/43-medicao-auditoria-ux.md §6 item 3; docs/42-auditoria-frontend-ux.md
// L562, L629, L1314, L1327, L1814, L2217 e os demais achados do padrão). Formulários perdiam o que foi digitado de
// duas formas que o React deixa passar sem erro: um `key` com a versão do registro, a página ou o filtro da URL —
// qualquer refresh, troca de página ou de filtro remontava o formulário e apagava o estado — e um
// <form method="get"> que navegava (às vezes com outro <form> dentro do fluxo) para trocar fuso, busca ou maioridade.
//
// Pelo AST do TypeScript, em todo arquivo de produção de src/app e src/components:
// K. KEY DE REMONTAGEM SEM VALOR VOLÁTIL. É key de remontagem todo `key` (atributo JSX ou `key` no objeto de
//    props de createElement/cloneElement) que não é o do elemento DEVOLVIDO por um callback de iteração
//    (ITERADORES: `lista.map(x => <Item key={…} />)`, inclusive função local passada por nome, ternário, `&&`,
//    array devolvido por flatMap e `return` do callback) — o key de item identifica o item na lista e fica de fora.
//    Volátil é o que muda com refresh, página ou filtro:
//    (a) NOME: identificador, propriedade (também `x["…"]`) ou texto (literal e partes fixas de template) com uma
//        PALAVRAS_VOLATEIS — no próprio key e em tudo de que ele depende no arquivo: constante e `let` (com as
//        atribuições), desestruturação (o nome da propriedade conta), função local chamada no key (o corpo dela);
//    (b) URL: valor que vem de `searchParams` (parâmetro da página, `props.searchParams`, `await searchParams`) ou
//        de `useSearchParams()`, seguido por constante, desestruturação, operador e chamada NÃO aguardada (`Number`,
//        `safeParse`…). O resultado de uma consulta aguardada (`await consultar({ pagina })`) não é o valor da URL:
//        o que dele muda com a página é pego pelo nome, em (a).
// F. NENHUM <form> ANINHADO: <form> dentro de outro <form> — direto, dentro de expressão JSX (map, ternário),
//    por variável ou função local com JSX, por componente (local ou importado, seguido pelo caminho do módulo,
//    com alias, `export { … }`, reexportação e namespace) que renderiza <form>, e <form> passado como filho de um
//    componente que renderiza <form>. Componente que a trava não segue dentro de um <form> — de pacote fora de
//    PACOTES_SEM_FORM, tag computada (`<props.X>`, parâmetro) — falha fechado.
// E. Arquivo que não analisa (erro de sintaxe): falha fechado.
//
// Exceções: arquivo + regra + trecho exato (espaços normalizados) + motivo; cada uma casa com exatamente um
// achado, e a lista é comparada com uma cópia literal (acrescentar exceção exige mexer nos dois lugares).

const RAIZES = ["src/app", "src/components"];

/** Palavras que fazem um valor mudar com refresh, página ou filtro (comparadas sem caixa e sem acento). */
export const PALAVRAS_VOLATEIS = ["versao", "versoes", "pagina", "cursor", "busca", "filtro", "searchparams"];
/** Callbacks de iteração: o elemento que o callback devolve é item de lista (o key dele identifica o item). */
export const ITERADORES = ["map", "flatMap"];
/** Funções que recebem o callback de iteração como 2º argumento (`Array.from(x, cb)`). */
export const ITERADORES_COM_FONTE = ["from"];
/** Fábricas de elemento cujo objeto de props pode trazer `key` (1º argumento: o tipo; 2º: as props). */
export const FABRICAS_DE_ELEMENTO = ["createElement", "cloneElement"];
/**
 * Pacotes cujos componentes não renderizam <form> (podem aparecer dentro de um formulário). O `Controller` do
 * react-hook-form só chama o `render` que a tela passa — e esse JSX está no arquivo e é conferido aqui.
 */
export const PACOTES_SEM_FORM = ["next/link", "next/image", "react", "@tabler/icons-react", "react-hook-form"];
/** Ganchos que entregam os parâmetros da URL no cliente. */
export const GANCHOS_DA_URL = ["useSearchParams"];
/** Passos de dependência seguidos antes de desistir (falha fechada). */
const PROFUNDIDADE_MAXIMA = 12;

const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const PALAVRA_VOLATIL = new RegExp(PALAVRAS_VOLATEIS.join("|"));
/** O texto contém uma palavra volátil (sem caixa e sem acento)? Devolve a palavra, ou null. */
export function palavraVolatil(texto: string): string | null {
  return semAcento(texto).match(PALAVRA_VOLATIL)?.[0] ?? null;
}
const normaliza = (t: string) => t.replace(/\s+/g, " ").trim();

export type Regra = "key" | "form" | "arquivo";
export type Achado = { arquivo: string; regra: Regra; trecho: string; problema: string };

function desembrulha(e: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) || ts.isSatisfiesExpression(e) || ts.isTypeAssertionExpression(e)) e = e.expression;
  return e;
}

// ---------------------------------------------------------------------------------------------------
// Escopo: a declaração de um nome, procurada de dentro para fora (bloco, função, catch, for, arquivo).
// ---------------------------------------------------------------------------------------------------
type Declaracao =
  | { tipo: "variavel"; no: ts.VariableDeclaration; nome: ts.Identifier; elemento: ts.BindingElement | null }
  | { tipo: "parametro"; no: ts.ParameterDeclaration; nome: ts.Identifier; elemento: ts.BindingElement | null }
  | { tipo: "funcao"; no: ts.FunctionDeclaration }
  | { tipo: "import"; no: ts.ImportDeclaration; nome: ts.Identifier; original: string | null; namespace: boolean };

const criaEscopo = (n: ts.Node) => ts.isSourceFile(n) || ts.isBlock(n) || ts.isFunctionLike(n) || ts.isCatchClause(n) || ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n) || ts.isCaseBlock(n) || ts.isModuleBlock(n);

/** Os nomes declarados por um padrão de desestruturação (com o elemento de onde cada um sai). */
function nomesDoPadrao(nome: ts.BindingName, elemento: ts.BindingElement | null, saida: { nome: ts.Identifier; elemento: ts.BindingElement | null }[]) {
  if (ts.isIdentifier(nome)) { saida.push({ nome, elemento }); return; }
  for (const el of nome.elements) if (!ts.isOmittedExpression(el)) nomesDoPadrao(el.name, el, saida);
}

/** O escopo onde a declaração vale: `var` e função sobem até a função; o resto fica no bloco. */
function escopoDe(n: ts.Node): ts.Node {
  let p = n.parent;
  while (p && !criaEscopo(p)) p = p.parent;
  return p ?? n.getSourceFile();
}

/** Mapa nome → declarações do arquivo, cada uma com o escopo em que vale. */
function declaracoes(sf: ts.SourceFile) {
  const mapa = new Map<string, { decl: Declaracao; escopo: ts.Node }[]>();
  const poe = (nome: string, decl: Declaracao, escopo: ts.Node) => { const l = mapa.get(nome) ?? []; l.push({ decl, escopo }); mapa.set(nome, l); };
  const visita = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n)) {
      const nomes: { nome: ts.Identifier; elemento: ts.BindingElement | null }[] = [];
      nomesDoPadrao(n.name, null, nomes);
      for (const x of nomes) poe(x.nome.text, { tipo: "variavel", no: n, nome: x.nome, elemento: x.elemento }, escopoDe(n.parent));
    } else if (ts.isParameter(n)) {
      const nomes: { nome: ts.Identifier; elemento: ts.BindingElement | null }[] = [];
      nomesDoPadrao(n.name, null, nomes);
      for (const x of nomes) poe(x.nome.text, { tipo: "parametro", no: n, nome: x.nome, elemento: x.elemento }, n.parent);
    } else if (ts.isFunctionDeclaration(n) && n.name) {
      poe(n.name.text, { tipo: "funcao", no: n }, escopoDe(n));
    } else if (ts.isImportDeclaration(n) && n.importClause) {
      const c = n.importClause;
      if (c.name) poe(c.name.text, { tipo: "import", no: n, nome: c.name, original: "default", namespace: false }, sf);
      if (c.namedBindings && ts.isNamespaceImport(c.namedBindings)) poe(c.namedBindings.name.text, { tipo: "import", no: n, nome: c.namedBindings.name, original: null, namespace: true }, sf);
      if (c.namedBindings && ts.isNamedImports(c.namedBindings)) for (const e of c.namedBindings.elements) poe(e.name.text, { tipo: "import", no: n, nome: e.name, original: (e.propertyName ?? e.name).text, namespace: false }, sf);
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return mapa;
}

const contem = (fora: ts.Node, dentro: ts.Node) => dentro.pos >= fora.pos && dentro.end <= fora.end;

/** A declaração que vale para o identificador (o escopo mais interno que contém o uso). */
function resolverEm(mapa: ReturnType<typeof declaracoes>, id: ts.Identifier): Declaracao | null {
  const candidatas = (mapa.get(id.text) ?? []).filter((c) => contem(c.escopo, id));
  if (!candidatas.length) return null;
  candidatas.sort((a, b) => (a.escopo.end - a.escopo.pos) - (b.escopo.end - b.escopo.pos));
  return candidatas[0].decl;
}

/** O identificador está em posição de valor (não é nome de propriedade, de atributo ou de declaração)? */
function ehReferencia(id: ts.Identifier): boolean {
  const p = id.parent;
  if (ts.isPropertyAccessExpression(p) && p.name === id) return false;
  if (ts.isPropertyAssignment(p) && p.name === id) return false;
  if (ts.isJsxAttribute(p)) return false;
  if ((ts.isVariableDeclaration(p) || ts.isParameter(p) || ts.isBindingElement(p) || ts.isFunctionDeclaration(p)) && p.name === id) return false;
  if (ts.isBindingElement(p) && p.propertyName === id) return false;
  if (ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p) || ts.isJsxClosingElement(p)) return false;
  return true;
}

// ---------------------------------------------------------------------------------------------------
// K: key de remontagem.
// ---------------------------------------------------------------------------------------------------
const ehCallback = (n: ts.Node): n is ts.ArrowFunction | ts.FunctionExpression => ts.isArrowFunction(n) || ts.isFunctionExpression(n);

/** A chamada recebe `arg` como callback de iteração (`x.map(arg)`, `Array.from(x, arg)`)? */
function ehArgumentoDeIteracao(arg: ts.Node): boolean {
  const chamada = arg.parent;
  if (!chamada || !ts.isCallExpression(chamada)) return false;
  const callee = desembrulha(chamada.expression);
  const nome = ts.isPropertyAccessExpression(callee) ? callee.name.text : ts.isElementAccessExpression(callee) && ts.isStringLiteralLike(callee.argumentExpression) ? callee.argumentExpression.text : null;
  if (nome && ITERADORES.includes(nome)) return chamada.arguments[0] === arg;
  if (nome && ITERADORES_COM_FONTE.includes(nome) && ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === "Array") return chamada.arguments[1] === arg;
  return false;
}

/** As expressões que uma função devolve (corpo de arrow ou `return` do próprio corpo, sem descer em funções aninhadas). */
function resultados(f: ts.SignatureDeclaration & { body?: ts.Node }): ts.Expression[] {
  if (!f.body) return [];
  if (!ts.isBlock(f.body)) return [f.body as ts.Expression];
  const saida: ts.Expression[] = [];
  const visita = (n: ts.Node) => {
    if (ts.isFunctionLike(n)) return;
    if (ts.isReturnStatement(n) && n.expression) saida.push(n.expression);
    ts.forEachChild(n, visita);
  };
  ts.forEachChild(f.body, visita);
  return saida;
}

/** Os elementos "de saída" de uma expressão devolvida: ternário, &&, ||, ??, array, parênteses. */
function elementosDevolvidos(e: ts.Expression, saida: Set<ts.Node>) {
  e = desembrulha(e);
  if (ts.isConditionalExpression(e)) { elementosDevolvidos(e.whenTrue, saida); elementosDevolvidos(e.whenFalse, saida); return; }
  if (ts.isBinaryExpression(e) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(e.operatorToken.kind)) {
    if (e.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken) elementosDevolvidos(e.left, saida);
    elementosDevolvidos(e.right, saida);
    return;
  }
  if (ts.isArrayLiteralExpression(e)) { for (const x of e.elements) elementosDevolvidos(x, saida); return; }
  if (ts.isJsxElement(e)) saida.add(e.openingElement);
  else if (ts.isJsxSelfClosingElement(e)) saida.add(e);
  else if (ts.isJsxFragment(e)) saida.add(e);
  else if (ts.isCallExpression(e)) saida.add(e);
}

/** Elementos (abertura JSX, fragmento ou chamada de fábrica) que são item de lista no arquivo. */
function itensDeLista(sf: ts.SourceFile, mapa: ReturnType<typeof declaracoes>): Set<ts.Node> {
  const saida = new Set<ts.Node>();
  const visita = (n: ts.Node) => {
    if (ts.isCallExpression(n)) {
      for (const arg of n.arguments) {
        if (!ehArgumentoDeIteracao(arg)) continue;
        const a = desembrulha(arg);
        if (ehCallback(a)) for (const r of resultados(a)) elementosDevolvidos(r, saida);
        else if (ts.isIdentifier(a)) {
          // `lista.map(Linha)` / `lista.map(linha)`: a função local passada por nome devolve os itens.
          const d = resolverEm(mapa, a);
          if (d?.tipo === "funcao") for (const r of resultados(d.no)) elementosDevolvidos(r, saida);
          if (d?.tipo === "variavel" && !d.elemento && d.no.initializer && ehCallback(desembrulha(d.no.initializer))) for (const r of resultados(desembrulha(d.no.initializer) as ts.ArrowFunction)) elementosDevolvidos(r, saida);
        }
      }
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return saida;
}

type Ctx = { mapa: ReturnType<typeof declaracoes>; contaminadas: Set<ts.Node> };

/** A expressão lê a URL diretamente: `searchParams` (identificador ou `.searchParams`) ou `useSearchParams()`. */
function fonteDaUrl(n: ts.Node): boolean {
  if (ts.isIdentifier(n) && semAcento(n.text) === "searchparams" && (ehReferencia(n) || (ts.isPropertyAccessExpression(n.parent) && n.parent.name === n))) return true;
  if (ts.isCallExpression(n)) {
    const c = desembrulha(n.expression);
    const nome = ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : null;
    if (nome && GANCHOS_DA_URL.includes(nome)) return true;
  }
  return false;
}

/** Lê a URL em algum ponto de `e`, sem descer no que é aguardado como consulta (`await f(…)`)? */
function leUrl(e: ts.Node, ctx: Ctx): boolean {
  let achou = false;
  const visita = (n: ts.Node) => {
    if (achou) return;
    const aguardada = ts.isAwaitExpression(n) ? desembrulha(n.expression) : null;
    if (aguardada && ts.isCallExpression(aguardada)) {
      // `await searchParams` lê a URL; `await consultar({ pagina })` é o resultado da consulta, não a URL. Em
      // `await Promise.all([searchParams, consultar(…)])` cada item conta por si: o que não é chamada é seguido.
      if (aguardada.expression.getText() === "Promise.all") for (const a of aguardada.arguments) {
        const lista = desembrulha(a);
        if (ts.isArrayLiteralExpression(lista)) for (const x of lista.elements) if (!ts.isCallExpression(desembrulha(x as ts.Expression))) visita(x);
      }
      return;
    }
    if (fonteDaUrl(n)) { achou = true; return; }
    if (ts.isIdentifier(n) && ehReferencia(n)) {
      const d = resolverEm(ctx.mapa, n);
      if (d && (d.tipo === "variavel" || d.tipo === "parametro") && ctx.contaminadas.has(d.nome)) { achou = true; return; }
    }
    if (ts.isFunctionLike(n) && n !== e) return;
    ts.forEachChild(n, visita);
  };
  visita(e);
  return achou;
}

/** Nomes contaminados pela URL: declarações cujo valor (ou desestruturação) lê a URL, até o ponto fixo. */
function contaminacao(sf: ts.SourceFile, mapa: ReturnType<typeof declaracoes>): Set<ts.Node> {
  const ctx: Ctx = { mapa, contaminadas: new Set() };
  const decls: { nome: ts.Identifier; fonte: ts.Node[] }[] = [];
  for (const lista of mapa.values()) for (const { decl } of lista) {
    if (decl.tipo === "variavel") {
      const fontes: ts.Node[] = [];
      if (decl.no.initializer) fontes.push(decl.no.initializer);
      // atribuições ao `let`: `x = …`
      const visita = (n: ts.Node) => {
        if (ts.isBinaryExpression(n) && n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment && ts.isIdentifier(n.left) && n.left.text === decl.nome.text && resolverEm(mapa, n.left)?.tipo === "variavel") fontes.push(n.right);
        ts.forEachChild(n, visita);
      };
      visita(sf);
      decls.push({ nome: decl.nome, fonte: fontes });
    } else if (decl.tipo === "parametro") {
      // `{ searchParams }` desestruturado do parâmetro da página: o nome do elemento é a própria fonte.
      const prop = decl.elemento?.propertyName ?? decl.elemento?.name;
      if (prop && ts.isIdentifier(prop) && semAcento(prop.text) === "searchparams") ctx.contaminadas.add(decl.nome);
      if (decl.no.initializer) decls.push({ nome: decl.nome, fonte: [decl.no.initializer] });
    }
  }
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const d of decls) if (!ctx.contaminadas.has(d.nome) && d.fonte.some((f) => leUrl(f, ctx))) { ctx.contaminadas.add(d.nome); mudou = true; }
  }
  return ctx.contaminadas;
}

/**
 * O primeiro motivo de volatilidade de `e` (nome com palavra volátil, ou leitura da URL), seguindo as dependências
 * locais até PROFUNDIDADE_MAXIMA; null se não há. Passou da profundidade: falha fechado.
 */
function volatil(e: ts.Node, ctx: Ctx, prof = 0, vistos = new Set<ts.Node>()): string | null {
  if (prof > PROFUNDIDADE_MAXIMA) return "dependência longa demais para seguir (falha fechada)";
  if (leUrl(e, ctx)) return "lê a URL (searchParams)";
  let motivo: string | null = null;
  const visita = (n: ts.Node) => {
    if (motivo) return;
    // Consulta aguardada: o resultado não é o argumento (`await consultar({ pagina })` não é "a página");
    // só o nome do que é chamado conta (`await consultarVersao()`).
    const aguardada = ts.isAwaitExpression(n) ? desembrulha(n.expression) : null;
    if (aguardada && ts.isCallExpression(aguardada)) { visita(aguardada.expression); return; }
    if (ts.isIdentifier(n) || ts.isPrivateIdentifier(n)) {
      const p = palavraVolatil(n.text);
      if (p) { motivo = `nome com "${p}": ${n.text}`; return; }
    }
    if (ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
      const p = palavraVolatil(n.text);
      if (p) { motivo = `texto com "${p}": ${n.text}`; return; }
    }
    if (ts.isIdentifier(n) && ehReferencia(n)) {
      const d = resolverEm(ctx.mapa, n);
      const no = d && d.tipo !== "import" ? d.no : null;
      if (d && no && !vistos.has(no)) {
        vistos.add(no);
        if (d.tipo === "variavel") {
          // o nome da propriedade desestruturada conta (`const { versaoEsperada: v } = d`)
          const prop = d.elemento?.propertyName;
          if (prop && ts.isIdentifier(prop) && palavraVolatil(prop.text)) { motivo = `nome com "${palavraVolatil(prop.text)}": ${prop.text}`; return; }
          if (d.no.initializer) motivo = volatil(d.no.initializer, ctx, prof + 1, vistos);
          if (!motivo) {
            const atribuicoes: ts.Expression[] = [];
            const coleta = (m: ts.Node) => {
              if (ts.isBinaryExpression(m) && m.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && m.operatorToken.kind <= ts.SyntaxKind.LastAssignment && ts.isIdentifier(m.left) && resolverEm(ctx.mapa, m.left)?.tipo === "variavel" && (resolverEm(ctx.mapa, m.left) as { nome: ts.Identifier }).nome === d.nome) atribuicoes.push(m.right);
              ts.forEachChild(m, coleta);
            };
            coleta(n.getSourceFile());
            for (const a of atribuicoes) if (!motivo) motivo = volatil(a, ctx, prof + 1, vistos);
          }
        } else if (d.tipo === "parametro") {
          const prop = d.elemento?.propertyName;
          if (prop && ts.isIdentifier(prop) && palavraVolatil(prop.text)) { motivo = `nome com "${palavraVolatil(prop.text)}": ${prop.text}`; return; }
          if (d.no.initializer) motivo = volatil(d.no.initializer, ctx, prof + 1, vistos);
        } else if (d.tipo === "funcao" && d.no.body) {
          motivo = volatil(d.no.body, ctx, prof + 1, vistos);
        }
        if (motivo) return;
      } else if (d?.tipo === "import" && d.original && palavraVolatil(d.original)) {
        motivo = `nome com "${palavraVolatil(d.original)}": ${d.original}`;
        return;
      }
    }
    ts.forEachChild(n, visita);
  };
  visita(e);
  return motivo;
}

/** Os `key` de remontagem do arquivo: [nó do valor, trecho para a exceção]. */
function keysDeRemontagem(sf: ts.SourceFile, itens: Set<ts.Node>): { valor: ts.Node; trecho: string }[] {
  const saida: { valor: ts.Node; trecho: string }[] = [];
  const visita = (n: ts.Node) => {
    if (ts.isJsxAttribute(n) && n.name.getText(sf) === "key") {
      const el = n.parent.parent;
      if (!itens.has(el)) saida.push({ valor: n.initializer ?? n, trecho: normaliza(n.getText(sf)) });
    }
    if (ts.isCallExpression(n)) {
      const c = desembrulha(n.expression);
      const nome = ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : null;
      const props = n.arguments[1] ? desembrulha(n.arguments[1]) : null;
      if (nome && FABRICAS_DE_ELEMENTO.includes(nome) && props && ts.isObjectLiteralExpression(props) && !itens.has(n)) {
        for (const p of props.properties) {
          if (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === "key") saida.push({ valor: p, trecho: normaliza(p.getText(sf)) });
        }
      }
    }
    // Spread com objeto literal que traz `key` (`<X {...{ key: v }} />`).
    if (ts.isJsxSpreadAttribute(n)) {
      const o = desembrulha(n.expression);
      if (ts.isObjectLiteralExpression(o) && !itens.has(n.parent.parent)) for (const p of o.properties) {
        if (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === "key") saida.push({ valor: p, trecho: normaliza(p.getText(sf)) });
      }
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return saida;
}

// ---------------------------------------------------------------------------------------------------
// F: <form> aninhado (com componentes seguidos pelo caminho do módulo).
// ---------------------------------------------------------------------------------------------------
export type Leitor = (arquivo: string) => string | null;
const lerDoDisco: Leitor = (arquivo) => (existsSync(arquivo) ? readFileSync(arquivo, "utf8") : null);

/** Caminho (sem extensão resolvida) de um especificador: `@/x` → src/x; relativo → junto do arquivo; pacote → null. */
export function caminhoDoModulo(especificador: string, arquivo: string): string | null {
  if (especificador.startsWith("@/")) return posix.join("src", especificador.slice(2));
  if (especificador.startsWith(".")) return posix.join(posix.dirname(arquivo.split("\\").join("/")), especificador);
  return null;
}
/** O arquivo do módulo (tenta .tsx, .ts, /index.tsx, /index.ts), ou null. */
function arquivoDoModulo(base: string, ler: Leitor): string | null {
  for (const c of [`${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`, base]) if (/\.tsx?$/.test(c) && ler(c) !== null) return c;
  return null;
}

type Fonte = { arquivo: string; sf: ts.SourceFile; mapa: ReturnType<typeof declaracoes> };
type Veredito = "form" | "sem-form" | { opaco: string };

export class Modulos {
  private cache = new Map<string, Fonte | null>();
  private exportados = new Map<string, Veredito>();
  /** Veredito por declaração de componente/variável (com marca de "em cálculo" para ciclos). */
  readonly memo = new Map<ts.Node, Veredito>();
  constructor(private ler: Leitor) {}
  fonte(arquivo: string): Fonte | null {
    if (!this.cache.has(arquivo)) {
      const texto = this.ler(arquivo);
      if (texto === null) this.cache.set(arquivo, null);
      else {
        const sf = ts.createSourceFile(arquivo, texto, ts.ScriptTarget.Latest, true, arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
        this.cache.set(arquivo, { arquivo, sf, mapa: declaracoes(sf) });
      }
    }
    return this.cache.get(arquivo) ?? null;
  }
  /** O que o export `nome` do módulo renderiza (seguindo `export { a as b }` e reexportação). */
  exportado(arquivo: string, nome: string, prof: number): Veredito {
    const chave = `${arquivo}#${nome}`;
    const visto = this.exportados.get(chave);
    if (visto) return visto;
    this.exportados.set(chave, "sem-form"); // ciclo: o que está sendo calculado não soma
    const f = this.fonte(arquivo);
    let v: Veredito = { opaco: `export ${nome} não encontrado em ${arquivo}` };
    if (f) {
      for (const st of f.sf.statements) {
        if (nome === "default" && ts.isExportAssignment(st)) { v = rendeForm(st.expression, f, this, prof + 1); break; }
        const mods = ts.canHaveModifiers(st) ? ts.getModifiers(st) ?? [] : [];
        const exportado = mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword), padrao = mods.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
        if (exportado && (ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && ((padrao && nome === "default") || st.name?.text === nome)) { v = rendeForm(st, f, this, prof + 1); break; }
        if (exportado && ts.isVariableStatement(st)) {
          const d = st.declarationList.declarations.find((x) => ts.isIdentifier(x.name) && x.name.text === nome);
          if (d) { v = d.initializer ? rendeForm(d.initializer, f, this, prof + 1) : "sem-form"; break; }
        }
        if (ts.isExportDeclaration(st) && st.exportClause && ts.isNamedExports(st.exportClause)) {
          const e = st.exportClause.elements.find((x) => x.name.text === nome);
          if (e) {
            const original = (e.propertyName ?? e.name).text;
            if (st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier)) v = this.doImport(st.moduleSpecifier.text, arquivo, original, prof + 1);
            else { const d = resolverNoTopo(f, original); v = d ? rendeForm(d, f, this, prof + 1) : { opaco: `export ${nome} sem declaração em ${arquivo}` }; }
            break;
          }
        }
        if (ts.isExportDeclaration(st) && !st.exportClause && st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier)) {
          const r = this.doImport(st.moduleSpecifier.text, arquivo, nome, prof + 1);
          if (typeof r !== "object") { v = r; break; }
        }
      }
    }
    this.exportados.set(chave, v);
    return v;
  }
  /** Componente importado de `especificador` (nome original do export). */
  doImport(especificador: string, arquivo: string, original: string, prof: number): Veredito {
    if (PACOTES_SEM_FORM.includes(especificador)) return "sem-form";
    const base = caminhoDoModulo(especificador, arquivo);
    if (base === null) return { opaco: `componente do pacote ${especificador} (fora de PACOTES_SEM_FORM)` };
    const alvo = arquivoDoModulo(base, this.ler);
    if (!alvo) return { opaco: `módulo ${especificador} não encontrado` };
    return this.exportado(alvo, original, prof);
  }
}

/** Declaração de topo de um nome no arquivo (para `export { x }`). */
function resolverNoTopo(f: Fonte, nome: string): ts.Node | null {
  for (const st of f.sf.statements) {
    if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name?.text === nome) return st;
    if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && d.name.text === nome) return d.initializer ?? null;
  }
  return null;
}

const junta = (a: Veredito, b: Veredito): Veredito => (a === "form" || b === "form" ? "form" : typeof a === "object" ? a : b);

/** O que uma tag de componente (`<X>`, `<N.X>`) renderiza. */
function vereditoDaTag(tag: ts.JsxTagNameExpression, f: Fonte, mods: Modulos, prof: number): Veredito {
  if (ts.isIdentifier(tag)) {
    if (/^[a-z]/.test(tag.text)) return tag.text === "form" ? "form" : "sem-form";
    return vereditoDoNome(tag, f, mods, prof);
  }
  if (ts.isPropertyAccessExpression(tag) && ts.isIdentifier(tag.expression)) {
    const d = resolverEm(f.mapa, tag.expression);
    if (d?.tipo === "import" && d.namespace && ts.isStringLiteral(d.no.moduleSpecifier)) return mods.doImport(d.no.moduleSpecifier.text, f.arquivo, tag.name.text, prof);
  }
  return { opaco: `tag que a trava não segue: <${tag.getText(f.sf)}>` };
}

/** Veredito de uma declaração local, calculado uma vez (o ciclo conta como "sem-form" enquanto calcula). */
function vereditoMemo(alvo: ts.Node, f: Fonte, mods: Modulos, prof: number): Veredito {
  const visto = mods.memo.get(alvo);
  if (visto) return visto;
  mods.memo.set(alvo, "sem-form");
  const v = rendeForm(alvo, f, mods, prof);
  mods.memo.set(alvo, v);
  return v;
}

/** O que o componente nomeado por `id` renderiza (declaração local, constante, alias ou import). */
function vereditoDoNome(id: ts.Identifier, f: Fonte, mods: Modulos, prof: number): Veredito {
  if (prof > PROFUNDIDADE_MAXIMA) return { opaco: "componentes encadeados demais para seguir (falha fechada)" };
  const d = resolverEm(f.mapa, id);
  if (!d) return { opaco: `componente sem declaração: <${id.text}>` };
  if (d.tipo === "funcao") return vereditoMemo(d.no, f, mods, prof + 1);
  if (d.tipo === "variavel" && !d.elemento && d.no.initializer) return vereditoMemo(d.no.initializer, f, mods, prof + 1);
  if (d.tipo === "import" && !d.namespace && d.original && ts.isStringLiteral(d.no.moduleSpecifier)) return mods.doImport(d.no.moduleSpecifier.text, f.arquivo, d.original, prof + 1);
  return { opaco: `componente que a trava não segue: <${id.text}>` };
}

/**
 * O que o nó renderiza: "form" se há <form> nele (ou num componente/variável/função que ele usa), "sem-form" se
 * não há, `{ opaco }` se há algo que a trava não segue.
 */
function rendeForm(n: ts.Node, f: Fonte, mods: Modulos, prof: number): Veredito {
  if (prof > PROFUNDIDADE_MAXIMA) return { opaco: "componentes encadeados demais para seguir (falha fechada)" };
  let v: Veredito = "sem-form";
  const visita = (m: ts.Node) => {
    if (v === "form") return;
    if (ts.isJsxOpeningElement(m) || ts.isJsxSelfClosingElement(m)) v = junta(v, vereditoDaTag(m.tagName, f, mods, prof));
    else if (ts.isIdentifier(m) && ehReferencia(m) && !(ts.isJsxOpeningElement(m.parent) || ts.isJsxSelfClosingElement(m.parent))) {
      // variável ou função local com JSX usada aqui (`{sub}`, `{linha(x)}`)
      const d = resolverEm(f.mapa, m);
      const alvo = d?.tipo === "funcao" ? d.no : d?.tipo === "variavel" && !d.elemento ? d.no.initializer : null;
      if (alvo && !contem(alvo, m)) v = junta(v, vereditoMemo(alvo, f, mods, prof + 1));
    }
    ts.forEachChild(m, visita);
  };
  visita(n);
  return v;
}

/** Os <form> nativos de um arquivo e os componentes que renderizam <form>, com o que há dentro deles. */
function formsAninhados(f: Fonte, mods: Modulos): Achado[] {
  const achados: Achado[] = [];
  const formNativo = (n: ts.Node): n is ts.JsxElement => ts.isJsxElement(n) && ts.isIdentifier(n.openingElement.tagName) && n.openingElement.tagName.text === "form";
  const visitaDentro = (raiz: ts.JsxElement, deQuem: string) => {
    const visita = (m: ts.Node) => {
      if (m !== raiz) {
        if (ts.isJsxOpeningElement(m) || ts.isJsxSelfClosingElement(m)) {
          const v = vereditoDaTag(m.tagName, f, mods, 0);
          if (v === "form") achados.push({ arquivo: f.arquivo, regra: "form", trecho: normaliza(m.getText(f.sf)).slice(0, 120), problema: `<form> dentro de ${deQuem}` });
          else if (typeof v === "object") achados.push({ arquivo: f.arquivo, regra: "form", trecho: normaliza(m.getText(f.sf)).slice(0, 120), problema: `dentro de ${deQuem}: ${v.opaco}` });
        } else if (ts.isJsxExpression(m) && m.expression) {
          const v = rendeFormNaExpressao(m.expression, f, mods);
          if (v === "form") achados.push({ arquivo: f.arquivo, regra: "form", trecho: normaliza(m.getText(f.sf)).slice(0, 120), problema: `<form> (por variável ou função) dentro de ${deQuem}` });
          else if (typeof v === "object") achados.push({ arquivo: f.arquivo, regra: "form", trecho: normaliza(m.getText(f.sf)).slice(0, 120), problema: `dentro de ${deQuem}: ${v.opaco}` });
        }
      }
      ts.forEachChild(m, visita);
    };
    for (const c of raiz.children) visita(c);
  };
  const visita = (n: ts.Node) => {
    if (formNativo(n)) visitaDentro(n, "<form>");
    else if (ts.isJsxElement(n) && !ts.isIdentifier(n.openingElement.tagName) || (ts.isJsxElement(n) && ts.isIdentifier(n.openingElement.tagName) && /^[A-Z]/.test(n.openingElement.tagName.text))) {
      // componente que renderiza <form>: o que é passado como filho entra no form dele.
      const v = vereditoDaTag(n.openingElement.tagName, f, mods, 0);
      if (v === "form") visitaDentro(n, `<${n.openingElement.tagName.getText(f.sf)}> (que renderiza <form>)`);
    }
    ts.forEachChild(n, visita);
  };
  visita(f.sf);
  return achados;
}

/** Uma expressão JSX (`{sub}`, `{linha()}`) traz <form> por variável ou função local? (JSX inline é visitado à parte.) */
function rendeFormNaExpressao(e: ts.Expression, f: Fonte, mods: Modulos): Veredito {
  let v: Veredito = "sem-form";
  const visita = (m: ts.Node) => {
    if (v === "form") return;
    if (ts.isJsxElement(m) || ts.isJsxSelfClosingElement(m) || ts.isJsxFragment(m)) return; // visitado pelo laço de fora
    if (ts.isIdentifier(m) && ehReferencia(m)) {
      const d = resolverEm(f.mapa, m);
      const alvo = d?.tipo === "funcao" ? d.no : d?.tipo === "variavel" && !d.elemento ? d.no.initializer : null;
      if (alvo && !contem(alvo, m)) v = junta(v, vereditoMemo(alvo, f, mods, 1));
    }
    ts.forEachChild(m, visita);
  };
  visita(e);
  return v;
}

// ---------------------------------------------------------------------------------------------------
// Análise de um arquivo.
// ---------------------------------------------------------------------------------------------------
export function analisar(fonte: string, arquivo = "virtual.tsx", ler: Leitor = lerDoDisco, compartilhado?: Modulos): Achado[] {
  // Na varredura, um Modulos só para todos os arquivos (cada módulo é lido e analisado uma vez).
  const mods = compartilhado ?? new Modulos((a) => (a === arquivo ? fonte : ler(a)));
  const f = mods.fonte(arquivo);
  if (!f) return [{ arquivo, regra: "arquivo", trecho: "(arquivo)", problema: "não foi lido (falha fechada)" }];
  const diag = (f.sf as unknown as { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics ?? [];
  if (diag.length) return [{ arquivo, regra: "arquivo", trecho: "(arquivo)", problema: `não analisa (falha fechada): ${ts.flattenDiagnosticMessageText(diag[0].messageText, " ")}` }];
  const achados: Achado[] = [];
  const ctx: Ctx = { mapa: f.mapa, contaminadas: contaminacao(f.sf, f.mapa) };
  const itens = itensDeLista(f.sf, f.mapa);
  for (const k of keysDeRemontagem(f.sf, itens)) {
    const motivo = volatil(k.valor, ctx);
    if (motivo) achados.push({ arquivo, regra: "key", trecho: k.trecho, problema: `key de remontagem volátil — ${motivo}` });
  }
  achados.push(...formsAninhados(f, mods));
  return achados;
}

// ---------------------------------------------------------------------------------------------------
// Exceções (arquivo + regra + trecho exato + motivo) e a varredura.
// ---------------------------------------------------------------------------------------------------
export type Excecao = { arquivo: string; regra: Regra; trecho: string; motivo: string };

/** Pendência herdada: key com versão que reinicia o formulário depois de salvar, fora do recorte do item 3. */
const VERSAO_PENDENTE = "pendência fora do recorte do item 3 (docs/43 §6): a versão no key reinicia o formulário depois de salvar; tirá-la exige conferir, componente a componente, se a versão ou o conteúdo inicial ficam presos no estado — próxima PR do padrão";

export const EXCECOES: Excecao[] = [
  {
    arquivo: "src/app/(app)/alunos/[id]/academico/page.tsx", regra: "key", trecho: "key={matriculaId ?? \"legado\"}",
    motivo: "identidade do registro, não filtro nem página: a matrícula escolhida na URL troca o contexto inteiro do painel (outra matrícula, outras solicitações) — começar do zero é o esperado",
  },
  {
    arquivo: "src/app/(app)/matriculas/[id]/contrato/page.tsx", regra: "key", trecho: "key={`${s.modelo}:${revisao.dado.revisaoHash}`}",
    motivo: "identidade do modelo escolhido + hash da revisão conferida: outro modelo ou outro conteúdo é outra prévia, e registrar a anterior seria registrar o que não foi conferido",
  },
  {
    arquivo: "src/app/(app)/configuracao/contratos/[codigo]/page.tsx", regra: "key", trecho: "key={atual.id}",
    motivo: "o editor da nova versão parte da versão atual (o id dela, não a página); a trava o acusa porque a versão atual só é lida na página 1 do histórico — pendência: tirar o editor da paginação do histórico (próxima PR)",
  },
  {
    arquivo: "src/app/(app)/academico/recuperacoes/tentativas/[itemReservaId]/designacao/page.tsx", regra: "key", trecho: "key={`${d.versaoEsperada}:${d.buscaProfessor}`}",
    motivo: "pendência fora do recorte do item 3 (docs/43 §6 lista a designação da avaliação, não a da recuperação): mesma busca por <form> GET + key com a busca; migrar como em [codigo]/designacao na próxima PR do padrão",
  },
  {
    arquivo: "src/app/(app)/academico/recuperacoes/tentativas/[itemReservaId]/designacao/page.tsx", regra: "key", trecho: "key={d.buscaProfessor}",
    motivo: "pendência fora do recorte do item 3 (docs/43 §6 lista a designação da avaliação, não a da recuperação): mesma busca por <form> GET + key com a busca; migrar como em [codigo]/designacao na próxima PR do padrão",
  },
  { arquivo: "src/app/(app)/secretaria/CondicoesEncerramento.tsx", regra: "key", trecho: "key={`${documentoId ?? \"original\"}-${versoes.length}`}", motivo: VERSAO_PENDENTE },
  { arquivo: "src/app/(app)/secretaria/SecretariaPainel.tsx", regra: "key", trecho: "key={`${m.cobertura.cobrancaId}-${m.cobertura.versao}`}", motivo: VERSAO_PENDENTE },
  { arquivo: "src/app/(app)/academico/admissoes/[id]/page.tsx", regra: "key", trecho: "key={`${r.ultimaVersao}:${r.fusoInstitucional}`}", motivo: VERSAO_PENDENTE },
  { arquivo: "src/app/(app)/academico/recuperacoes/planos/page.tsx", regra: "key", trecho: "key={`${d.versaoEsperada}:${d.autorizacaoPreparacao?.id ?? \"sem-autorizacao\"}`}", motivo: VERSAO_PENDENTE },
  { arquivo: "src/app/(app)/academico/recuperacoes/[realizacaoId]/page.tsx", regra: "key", trecho: "key={d.versaoEsperada}", motivo: VERSAO_PENDENTE },
  { arquivo: "src/app/(app)/academico/regras/[nivelId]/page.tsx", regra: "key", trecho: "key={d.ultimaVersao}", motivo: VERSAO_PENDENTE },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/RecomposicaoPainel.tsx", regra: "key", trecho: "key={JSON.stringify(mensalidades.map((c) => [c.id, c.versao, c.coberturaInicio, c.coberturaFim]))}", motivo: VERSAO_PENDENTE },
  { arquivo: "src/app/(app)/matriculas/[id]/nova-reserva/page.tsx", regra: "key", trecho: "key={`${r.dado.anteriorId}-${r.dado.versaoOferta}`}", motivo: VERSAO_PENDENTE },
  { arquivo: "src/app/(app)/secretaria/reservas/[id]/page.tsx", regra: "key", trecho: "key={r.versaoAtual}", motivo: VERSAO_PENDENTE },
  { arquivo: "src/app/(app)/secretaria/reservas/particulares/[id]/page.tsx", regra: "key", trecho: "key={r.versaoAtual}", motivo: VERSAO_PENDENTE },
  { arquivo: "src/app/(app)/academico/correcoes/revisoes/[casoId]/page.tsx", regra: "key", trecho: "key={`${caso.solicitacao.id}:${caso.solicitacao.status}:${caso.situacao}:${historico.dado.itens[0]?.versao ?? 0}`}", motivo: VERSAO_PENDENTE },
  { arquivo: "src/app/(app)/academico/recuperacoes/correcoes/[notaId]/page.tsx", regra: "key", trecho: "key={`${d.vigente.origemId}-${d.versaoEsperada}`}", motivo: VERSAO_PENDENTE },
  { arquivo: "src/app/(app)/academico/regras/turmas/[turmaId]/page.tsx", regra: "key", trecho: "key={`${d.revisao.estadoHash}:${d.revisao.versaoEsperada}`}", motivo: VERSAO_PENDENTE },
  { arquivo: "src/app/(app)/academico/regras/turmas/[turmaId]/historica/ConferenciaRegraHistorica.tsx", regra: "key", trecho: "key={`${revisao.destinoId}:${revisao.estadoHash}:${revisao.versaoEsperada}`}", motivo: VERSAO_PENDENTE },
  { arquivo: "src/app/(app)/academico/reposicoes/correcoes/[reposicaoId]/page.tsx", regra: "key", trecho: "key={`${dado.reposicao.id}:${dado.conclusao.id}:${dado.versaoEsperada}`}", motivo: VERSAO_PENDENTE },
  { arquivo: "src/app/(app)/academico/recuperacoes/planos/[propostaId]/prorrogacoes/page.tsx", regra: "key", trecho: "key={`${d.versaoEsperada}:${d.prazoVigente}`}", motivo: VERSAO_PENDENTE },
  { arquivo: "src/app/(app)/diario/encontros/[id]/correcao/page.tsx", regra: "key", trecho: "key={`${revisao.dado.snapshot.diarioId}:${revisao.dado.estadoHash}:${revisao.dado.versaoAtual}`}", motivo: VERSAO_PENDENTE },
];

/** Casa por arquivo + regra + trecho; cada exceção tem de casar com exatamente um achado. */
export function conferirExcecoes(achados: Achado[], excecoes: Excecao[]): { semExcecao: string[]; soltas: string[] } {
  const casa = (a: Achado, e: Excecao) => a.arquivo === e.arquivo && a.regra === e.regra && a.trecho === normaliza(e.trecho);
  return {
    semExcecao: achados.filter((a) => !excecoes.some((e) => casa(a, e))).map((a) => `${a.arquivo}: [${a.regra}] ${a.trecho} — ${a.problema}`),
    soltas: excecoes.filter((e) => achados.filter((a) => casa(a, e)).length !== 1).map((e) => `${e.arquivo}: [${e.regra}] ${e.trecho}`),
  };
}

function arquivosDeProducao() {
  const saida: { arquivo: string; fonte: string }[] = [];
  for (const raiz of RAIZES) for (const f of readdirSync(raiz, { recursive: true }) as string[]) {
    if (!/\.tsx?$/.test(f) || /\.test\.tsx?$/.test(f)) continue;
    const arquivo = join(raiz, f).split("\\").join("/");
    saida.push({ arquivo, fonte: readFileSync(arquivo, "utf8") });
  }
  return saida;
}

// ===== TESTES =====

/** As telas do item 3 (docs/43 §6) e o componente de formulário que não pode ter key volátil nelas. */
export const TELAS_DO_ITEM_3: [string, string][] = [
  ["src/app/(app)/academico/avaliacoes/[alocacaoId]/[codigo]/page.tsx", "LancarNotas"],
  ["src/app/(app)/academico/avaliacoes/[alocacaoId]/[codigo]/designacao/page.tsx", "FormularioDesignacao"],
  ["src/app/(app)/matriculas/[id]/contrato/previas/[previaId]/participantes/page.tsx", "FormularioParticipantes"],
  ["src/app/(app)/leads/[id]/contratacao/page.tsx", "PreparacaoFormulario"],
  ["src/app/(app)/academico/segundas-chamadas/reservas/[reservaId]/substituicao/page.tsx", "Formulario"],
  ["src/app/(app)/academico/correcoes/[lancamentoId]/page.tsx", "ProporCorrecao"],
  ["src/app/(app)/academico/calendario/[id]/replanejamento/page.tsx", "EditorRevisao"],
  ["src/app/(app)/academico/calendario/[id]/replanejamento/EditorRevisao.tsx", "SalvarRevisao"],
  ["src/app/(app)/academico/calendario/novo/page.tsx", "PrepararCalendario"],
  ["src/app/(app)/academico/grades/nova/page.tsx", "PrepararGrade"],
];

/** O `key` de cada uso do componente no arquivo (null quando não tem key). */
function keysDoComponente(fonte: string, componente: string): (string | null)[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const saida: (string | null)[] = [];
  const visita = (n: ts.Node) => {
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && n.tagName.getText(sf) === componente) {
      const k = n.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === "key");
      saida.push(k ? normaliza(k.getText(sf)) : null);
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return saida;
}

/** Módulos falsos (caminho → fonte) para os imports das fontes virtuais. */
const leitorVirtual = (modulos: Record<string, string>): Leitor => (a) => (Object.prototype.hasOwnProperty.call(modulos, a) ? modulos[a] : null);
const problemas = (fonte: string, modulos: Record<string, string> = {}, arquivo = "src/app/x/virtual.tsx") => analisar(fonte, arquivo, leitorVirtual(modulos)).map((a) => `${a.regra}: ${a.problema}`);
const trechos = (fonte: string, modulos: Record<string, string> = {}, arquivo = "src/app/x/virtual.tsx") => analisar(fonte, arquivo, leitorVirtual(modulos)).map((a) => a.trecho);

describe("formulários preservam o digitado: sem key volátil, sem <form> aninhado (docs/43 §6 item 3)", () => {
  const arquivos = arquivosDeProducao();
  const mods = new Modulos(lerDoDisco);
  const achados = arquivos.flatMap(({ arquivo, fonte }) => analisar(fonte, arquivo, lerDoDisco, mods));

  it("a varredura acha os arquivos (não passa vazia por erro de caminho) e inclui as telas do item 3", () => {
    expect(arquivos.length).toBeGreaterThan(300);
    expect(arquivos.map((a) => a.arquivo)).toEqual(expect.arrayContaining(["src/components/Modal.tsx", ...TELAS_DO_ITEM_3.map(([a]) => a)]));
  });

  it("nenhum key de remontagem volátil e nenhum <form> aninhado — exceções ancoradas", () => {
    expect(conferirExcecoes(achados, EXCECOES)).toEqual({ semExcecao: [], soltas: [] });
  });

  it("cada exceção tem motivo de verdade", () => {
    for (const e of EXCECOES) expect(e.motivo.trim().length, `${e.arquivo}: ${e.trecho}`).toBeGreaterThan(30);
  });

  it("a lista de exceções é a combinada (cópia literal: acrescentar exceção exige mexer aqui também)", () => {
    expect(EXCECOES.map((e) => `${e.arquivo} :: ${e.regra} :: ${e.trecho}`)).toEqual([
      "src/app/(app)/alunos/[id]/academico/page.tsx :: key :: key={matriculaId ?? \"legado\"}",
      "src/app/(app)/matriculas/[id]/contrato/page.tsx :: key :: key={`${s.modelo}:${revisao.dado.revisaoHash}`}",
      "src/app/(app)/configuracao/contratos/[codigo]/page.tsx :: key :: key={atual.id}",
      "src/app/(app)/academico/recuperacoes/tentativas/[itemReservaId]/designacao/page.tsx :: key :: key={`${d.versaoEsperada}:${d.buscaProfessor}`}",
      "src/app/(app)/academico/recuperacoes/tentativas/[itemReservaId]/designacao/page.tsx :: key :: key={d.buscaProfessor}",
      "src/app/(app)/secretaria/CondicoesEncerramento.tsx :: key :: key={`${documentoId ?? \"original\"}-${versoes.length}`}",
      "src/app/(app)/secretaria/SecretariaPainel.tsx :: key :: key={`${m.cobertura.cobrancaId}-${m.cobertura.versao}`}",
      "src/app/(app)/academico/admissoes/[id]/page.tsx :: key :: key={`${r.ultimaVersao}:${r.fusoInstitucional}`}",
      "src/app/(app)/academico/recuperacoes/planos/page.tsx :: key :: key={`${d.versaoEsperada}:${d.autorizacaoPreparacao?.id ?? \"sem-autorizacao\"}`}",
      "src/app/(app)/academico/recuperacoes/[realizacaoId]/page.tsx :: key :: key={d.versaoEsperada}",
      "src/app/(app)/academico/regras/[nivelId]/page.tsx :: key :: key={d.ultimaVersao}",
      "src/app/(app)/alunos/[id]/movimentacoes/RecomposicaoPainel.tsx :: key :: key={JSON.stringify(mensalidades.map((c) => [c.id, c.versao, c.coberturaInicio, c.coberturaFim]))}",
      "src/app/(app)/matriculas/[id]/nova-reserva/page.tsx :: key :: key={`${r.dado.anteriorId}-${r.dado.versaoOferta}`}",
      "src/app/(app)/secretaria/reservas/[id]/page.tsx :: key :: key={r.versaoAtual}",
      "src/app/(app)/secretaria/reservas/particulares/[id]/page.tsx :: key :: key={r.versaoAtual}",
      "src/app/(app)/academico/correcoes/revisoes/[casoId]/page.tsx :: key :: key={`${caso.solicitacao.id}:${caso.solicitacao.status}:${caso.situacao}:${historico.dado.itens[0]?.versao ?? 0}`}",
      "src/app/(app)/academico/recuperacoes/correcoes/[notaId]/page.tsx :: key :: key={`${d.vigente.origemId}-${d.versaoEsperada}`}",
      "src/app/(app)/academico/regras/turmas/[turmaId]/page.tsx :: key :: key={`${d.revisao.estadoHash}:${d.revisao.versaoEsperada}`}",
      "src/app/(app)/academico/regras/turmas/[turmaId]/historica/ConferenciaRegraHistorica.tsx :: key :: key={`${revisao.destinoId}:${revisao.estadoHash}:${revisao.versaoEsperada}`}",
      "src/app/(app)/academico/reposicoes/correcoes/[reposicaoId]/page.tsx :: key :: key={`${dado.reposicao.id}:${dado.conclusao.id}:${dado.versaoEsperada}`}",
      "src/app/(app)/academico/recuperacoes/planos/[propostaId]/prorrogacoes/page.tsx :: key :: key={`${d.versaoEsperada}:${d.prazoVigente}`}",
      "src/app/(app)/diario/encontros/[id]/correcao/page.tsx :: key :: key={`${revisao.dado.snapshot.diarioId}:${revisao.dado.estadoHash}:${revisao.dado.versaoAtual}`}",
    ]);
  });

  it("listas fechadas da trava (cópia literal)", () => {
    expect(PALAVRAS_VOLATEIS).toEqual(["versao", "versoes", "pagina", "cursor", "busca", "filtro", "searchparams"]);
    expect(ITERADORES).toEqual(["map", "flatMap"]);
    expect(ITERADORES_COM_FONTE).toEqual(["from"]);
    expect(FABRICAS_DE_ELEMENTO).toEqual(["createElement", "cloneElement"]);
    expect(PACOTES_SEM_FORM).toEqual(["next/link", "next/image", "react", "@tabler/icons-react", "react-hook-form"]);
    expect(GANCHOS_DA_URL).toEqual(["useSearchParams"]);
    expect(TELAS_DO_ITEM_3.map(([a, c]) => `${a} :: ${c}`)).toEqual([
      "src/app/(app)/academico/avaliacoes/[alocacaoId]/[codigo]/page.tsx :: LancarNotas",
      "src/app/(app)/academico/avaliacoes/[alocacaoId]/[codigo]/designacao/page.tsx :: FormularioDesignacao",
      "src/app/(app)/matriculas/[id]/contrato/previas/[previaId]/participantes/page.tsx :: FormularioParticipantes",
      "src/app/(app)/leads/[id]/contratacao/page.tsx :: PreparacaoFormulario",
      "src/app/(app)/academico/segundas-chamadas/reservas/[reservaId]/substituicao/page.tsx :: Formulario",
      "src/app/(app)/academico/correcoes/[lancamentoId]/page.tsx :: ProporCorrecao",
      "src/app/(app)/academico/calendario/[id]/replanejamento/page.tsx :: EditorRevisao",
      "src/app/(app)/academico/calendario/[id]/replanejamento/EditorRevisao.tsx :: SalvarRevisao",
      "src/app/(app)/academico/calendario/novo/page.tsx :: PrepararCalendario",
      "src/app/(app)/academico/grades/nova/page.tsx :: PrepararGrade",
    ]);
  });

  it("cada palavra volátil da lista é acusada no key (inteira, em camelCase e com acento)", () => {
    const COPIA = ["versao", "versoes", "pagina", "cursor", "busca", "filtro", "searchparams"];
    const COM_ACENTO: Record<string, string> = { versao: "versão", versoes: "versões", pagina: "página" };
    for (const p of COPIA) {
      expect(problemas(`export function T({ d }: { d: Record<string, string> }) { return <F key={d.${p}} />; }`), p).toEqual([expect.stringMatching(/key de remontagem/)]);
      expect(problemas(`export function T({ d }: { d: Record<string, string> }) { return <F key={d.ultimo${p[0].toUpperCase()}${p.slice(1)}Esperado} />; }`), `${p} camelCase`).toEqual([expect.stringMatching(/key de remontagem/)]);
      if (Object.prototype.hasOwnProperty.call(COM_ACENTO, p)) expect(problemas(`export function T({ d }: { d: Record<string, string> }) { return <F key={\`\${d.id}:${COM_ACENTO[p]}\`} />; }`), `${p} com acento`).toEqual([expect.stringMatching(/key de remontagem/)]);
    }
  });

  it("as telas do item 3 não têm key volátil nem <form method=\"get\"> (o formulário continua montado)", () => {
    for (const [arquivo, componente] of TELAS_DO_ITEM_3) {
      const fonte = readFileSync(arquivo, "utf8");
      expect(analisar(fonte, arquivo), arquivo).toEqual([]);
      expect(keysDoComponente(fonte, componente).length, `${arquivo}: <${componente}> existe`).toBeGreaterThan(0);
      expect(fonte, arquivo).not.toMatch(/method=["']get["']/i);
    }
    // As que ficaram com key: só a identidade do registro (a oferta escolhida; a base escolhida em outra tela).
    expect(keysDoComponente(readFileSync("src/app/(app)/leads/[id]/contratacao/page.tsx", "utf8"), "PreparacaoFormulario")).toEqual(["key={o.selecionada.id}"]);
    expect(keysDoComponente(readFileSync("src/app/(app)/academico/calendario/novo/page.tsx", "utf8"), "PrepararCalendario")).toEqual(["key={base?.id ?? \"novo\"}"]);
    for (const [arquivo, componente] of TELAS_DO_ITEM_3.filter(([, c]) => c !== "PreparacaoFormulario" && c !== "PrepararCalendario")) {
      expect(keysDoComponente(readFileSync(arquivo, "utf8"), componente).every((k) => k === null), `${arquivo}: <${componente}> sem key`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------------------------------
// Autotestes em fonte virtual: cada evasão é acusada; as formas certas passam.
// ---------------------------------------------------------------------------------------------------
describe("autoteste K: key de remontagem volátil", () => {
  it("K1 — versão, página e busca direto no key (propriedade, template, acesso por texto)", () => {
    expect(trechos("export function T({ d }: { d: { versaoEsperada: number } }) { return <F key={d.versaoEsperada} />; }")).toEqual(["key={d.versaoEsperada}"]);
    expect(trechos("export function T({ c, o }: { c: { pagina: number }; o: { id: string } }) { return <F key={`${o.id}:${c.pagina}`} />; }")).toEqual(["key={`${o.id}:${c.pagina}`}"]);
    expect(trechos('export function T({ d }: { d: Record<string, number> }) { return <F key={d["versaoEsperada"]} />; }')).toEqual(['key={d["versaoEsperada"]}']);
    expect(trechos("export function T({ d }: { d: { busca: string } }) { return <form key={d.busca} />; }")).toEqual(["key={d.busca}"]);
  });
  it("K2 — alias: constante, desestruturação com outro nome, let com atribuição, função local, parâmetro renomeado", () => {
    expect(trechos("export function T({ d }: { d: { versaoEsperada: number } }) { const v = d.versaoEsperada; return <F key={v} />; }")).toEqual(["key={v}"]);
    expect(trechos("export function T({ d }: { d: { versaoEsperada: number } }) { const { versaoEsperada: v } = d; return <F key={v} />; }")).toEqual(["key={v}"]);
    expect(trechos('export function T({ d }: { d: { versao: number } }) { let k = "x"; k = String(d.versao); return <F key={k} />; }')).toEqual(["key={k}"]);
    expect(trechos("export function T({ d }: { d: { versao: number } }) { function chave() { return d.versao; } return <F key={chave()} />; }")).toEqual(["key={chave()}"]);
    expect(trechos("export function T({ versaoEsperada: v }: { versaoEsperada: number }) { return <F key={v} />; }")).toEqual(["key={v}"]);
  });
  it("K3 — valor da URL: searchParams desestruturado, props.searchParams, transformação, safeParse, Promise.all e useSearchParams", () => {
    expect(problemas('export default async function P({ searchParams }: { searchParams: Promise<{ substitutoId?: string }> }) { const { substitutoId } = await searchParams; return <F key={substitutoId ?? "x"} />; }')).toEqual([expect.stringMatching(/lê a URL/)]);
    expect(problemas('export default async function P(props: { searchParams: Promise<{ maioridade?: string }> }) { const q = await props.searchParams; const m = q.maioridade === "MAIOR" ? q.maioridade : null; return <F key={m ?? "p"} />; }')).toEqual([expect.stringMatching(/lê a URL/)]);
    expect(problemas('export default async function P({ searchParams }: { searchParams: Promise<{ fuso?: string }> }) { const s = await searchParams; const v = Esquema.safeParse(s.fuso ?? "UTC"); const fuso = v.data; return <F key={fuso} />; }')).toEqual([expect.stringMatching(/lê a URL/)]);
    expect(problemas('export default async function P({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ x?: string }> }) { const [p, s] = await Promise.all([params, searchParams]); return <F key={s.x ?? p.id} />; }')).toEqual([expect.stringMatching(/lê a URL/)]);
    expect(problemas('export function T() { const sp = useSearchParams(); const f = sp.get("x"); return <F key={f ?? ""} />; }')).toEqual([expect.stringMatching(/lê a URL/)]);
  });
  it("K4 — createElement/cloneElement com key no objeto de props e spread de objeto literal", () => {
    expect(trechos("export function T({ d }: { d: { versao: number } }) { return createElement(F, { key: d.versao }); }")).toEqual(["key: d.versao"]);
    expect(trechos("export function T({ d, e }: { d: { versao: number }; e: JSX.Element }) { return cloneElement(e, { key: d.versao }); }")).toEqual(["key: d.versao"]);
    expect(trechos("export function T({ d }: { d: { versao: number } }) { return <F {...{ key: d.versao }} />; }")).toEqual(["key: d.versao"]);
  });
  it("K5 — import com nome volátil e dependência longa demais (falha fechada)", () => {
    expect(problemas('import { VERSAO_ATUAL } from "./x"; export function T() { return <F key={VERSAO_ATUAL} />; }')).toEqual([expect.stringMatching(/versao/)]);
    const cadeia = Array.from({ length: 16 }, (_, i) => `const a${i + 1} = a${i};`).join(" ");
    expect(problemas(`export function T({ a0 }: { a0: string }) { ${cadeia} return <F key={a16} />; }`)).toEqual([expect.stringMatching(/falha fechada/)]);
  });
  it("K6 — elemento DENTRO de um item de lista tem key de remontagem (só o devolvido é item)", () => {
    expect(trechos("export function T({ l }: { l: { id: string; versao: number }[] }) { return <>{l.map((v) => <div key={v.id}><F key={v.versao} /></div>)}</>; }")).toEqual(["key={v.versao}"]);
  });
  it("controle: item de lista (map, flatMap, Array.from, ternário, return, função passada por nome) e identidade passam", () => {
    const ok = [
      "export function T({ l }: { l: { versao: number }[] }) { return <ul>{l.map((v) => <li key={v.versao}>{v.versao}</li>)}</ul>; }",
      "export function T({ l }: { l: { versao: number; ok: boolean }[] }) { return <ul>{l.map((v) => v.ok ? <li key={v.versao}>a</li> : <li key={`n-${v.versao}`}>b</li>)}</ul>; }",
      "export function T({ l }: { l: { versao: number }[] }) { return <ul>{l.map((v) => { const x = v.versao; return <li key={x}>{x}</li>; })}</ul>; }",
      "export function T({ l }: { l: { versao: number }[] }) { return <ul>{l.flatMap((v) => [<li key={`a${v.versao}`}>a</li>, <li key={`b${v.versao}`}>b</li>])}</ul>; }",
      "export function T() { return <ul>{Array.from({ length: 3 }, (_, pagina) => <li key={pagina}>{pagina}</li>)}</ul>; }",
      "function Linha(v: { versao: number }) { return <li key={v.versao}>{v.versao}</li>; } export function T({ l }: { l: { versao: number }[] }) { return <ul>{l.map(Linha)}</ul>; }",
      "export function T({ d }: { d: { id: string; estadoHash: string } }) { return <F key={`${d.id}:${d.estadoHash}`} />; }",
      "export default async function P({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) { const s = await searchParams; const r = await consultar({ pagina: Number(s.pagina ?? 1) }); const d = r.dado; return <F key={d.id} />; }",
    ];
    for (const f of ok) expect(problemas(f), f).toEqual([]);
  });
});

describe("autoteste F: <form> aninhado", () => {
  it("F1 — direto, dentro de expressão (map, &&) e por variável ou função local", () => {
    expect(problemas("export function T() { return <form><div><form /></div></form>; }")).toEqual([expect.stringMatching(/<form> dentro de <form>/)]);
    expect(problemas("export function T({ l }: { l: string[] }) { return <form>{l.map((x) => <form key={x} />)}</form>; }")).toEqual([expect.stringMatching(/<form> dentro de <form>/)]);
    expect(problemas("export function T({ a }: { a: boolean }) { return <form>{a && <form />}</form>; }")).toEqual([expect.stringMatching(/<form> dentro de <form>/)]);
    expect(problemas("export function T() { const sub = <form />; return <form>{sub}</form>; }")).toEqual([expect.stringMatching(/por variável ou função/)]);
    expect(problemas("export function T() { const sub = () => <form />; return <form>{sub()}</form>; }")).toEqual([expect.stringMatching(/por variável ou função/)]);
  });
  it("F2 — componente local que renderiza <form>, e alias dele", () => {
    expect(problemas("function Sub() { return <form />; } export function T() { return <form><Sub /></form>; }")).toEqual([expect.stringMatching(/<form> dentro de <form>/)]);
    expect(problemas("const Sub = () => <section><form /></section>; const Outro = Sub; export function T() { return <form><Outro /></form>; }")).toEqual([expect.stringMatching(/<form> dentro de <form>/)]);
  });
  it("F3 — componente importado: relativo, alias @/, renomeado, export { }, default, namespace e reexportação", () => {
    const modulos = {
      "src/app/x/Sub.tsx": "export function Sub() { return <form />; }",
      "src/components/Envolto.tsx": "function Interno() { return <form />; } export { Interno as Envolto };",
      "src/app/x/Padrao.tsx": "export default function Padrao() { return <div><form /></div>; }",
      "src/app/x/indice.ts": 'export { Sub } from "./Sub";',
      "src/app/x/tudo.ts": 'export * from "./Sub";',
    };
    for (const f of [
      'import { Sub } from "./Sub"; export function T() { return <form><Sub /></form>; }',
      'import { Sub as Outro } from "@/app/x/Sub"; export function T() { return <form><Outro /></form>; }',
      'import { Envolto } from "@/components/Envolto"; export function T() { return <form><Envolto /></form>; }',
      'import Padrao from "./Padrao"; export function T() { return <form><Padrao /></form>; }',
      'import * as M from "./Sub"; export function T() { return <form><M.Sub /></form>; }',
      'import { Sub } from "./indice"; export function T() { return <form><Sub /></form>; }',
      'import { Sub } from "./tudo"; export function T() { return <form><Sub /></form>; }',
    ]) expect(problemas(f, modulos), f).toEqual([expect.stringMatching(/<form> dentro de <form>/)]);
  });
  it("F4 — <form> passado como filho de um componente que renderiza <form>", () => {
    const modulos = { "src/app/x/Envelope.tsx": "export function Envelope({ children }: { children: React.ReactNode }) { return <form>{children}</form>; }" };
    expect(problemas('import { Envelope } from "./Envelope"; export function T() { return <Envelope><div><form /></div></Envelope>; }', modulos)).toEqual([expect.stringMatching(/<form> dentro de <Envelope>/)]);
  });
  it("F5 — o que a trava não segue dentro de um <form> falha fechado: pacote fora da lista, tag computada, componente por parâmetro, módulo ausente", () => {
    expect(problemas('import { Algo } from "pacote-qualquer"; export function T() { return <form><Algo /></form>; }')).toEqual([expect.stringMatching(/pacote-qualquer/)]);
    expect(problemas("export function T({ props }: { props: { X: () => null } }) { return <form><props.X /></form>; }")).toEqual([expect.stringMatching(/não segue/)]);
    expect(problemas("export function T({ Comp }: { Comp: () => null }) { return <form><Comp /></form>; }")).toEqual([expect.stringMatching(/não segue/)]);
    expect(problemas('import { Sumiu } from "./sumiu"; export function T() { return <form><Sumiu /></form>; }')).toEqual([expect.stringMatching(/não encontrado/)]);
  });
  it("lista fechada de pacotes sem form: cada um passa dentro de um <form>", () => {
    for (const p of ["next/link", "next/image", "react", "@tabler/icons-react", "react-hook-form"]) {
      expect(problemas(`import { X } from "${p}"; export function T() { return <form><X /></form>; }`), p).toEqual([]);
    }
  });
  it("controle: forms irmãos, componente sem form dentro de form e form como filho de componente sem form passam", () => {
    const modulos = { "src/app/x/Campo.tsx": "export function Campo() { return <label><input /></label>; }" };
    expect(problemas("export function T() { return <><form /><form /></>; }")).toEqual([]);
    expect(problemas('import { Campo } from "./Campo"; export function T() { return <form><Campo /><button>Ok</button></form>; }', modulos)).toEqual([]);
    expect(problemas('import { Campo } from "./Campo"; export function T() { return <Campo><form /></Campo>; }', modulos)).toEqual([]);
  });
});

describe("autoteste E e conferência das exceções", () => {
  it("E — arquivo que não analisa falha fechado", () => {
    expect(analisar("export function T( { return <div>; }")).toEqual([{ arquivo: "virtual.tsx", regra: "arquivo", trecho: "(arquivo)", problema: expect.stringMatching(/falha fechada/) }]);
  });
  it("conferirExcecoes: achado sem exceção acusa; exceção sem alvo, de outra regra ou ambígua fica solta", () => {
    const a: Achado = { arquivo: "a.tsx", regra: "key", trecho: "key={d.versao}", problema: "x" };
    expect(conferirExcecoes([a], [])).toEqual({ semExcecao: ["a.tsx: [key] key={d.versao} — x"], soltas: [] });
    expect(conferirExcecoes([a], [{ arquivo: "a.tsx", regra: "key", trecho: "key={d.versao}", motivo: "m" }])).toEqual({ semExcecao: [], soltas: [] });
    expect(conferirExcecoes([], [{ arquivo: "a.tsx", regra: "key", trecho: "key={d.versao}", motivo: "m" }])).toEqual({ semExcecao: [], soltas: ["a.tsx: [key] key={d.versao}"] });
    expect(conferirExcecoes([a], [{ arquivo: "a.tsx", regra: "form", trecho: "key={d.versao}", motivo: "m" }]).soltas).toEqual(["a.tsx: [form] key={d.versao}"]);
    expect(conferirExcecoes([a, a], [{ arquivo: "a.tsx", regra: "key", trecho: "key={d.versao}", motivo: "m" }]).soltas).toEqual(["a.tsx: [key] key={d.versao}"]);
  });
});
