import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { ehTeste, soParaFrente } from "../../scripts/medicao-ux/nucleo.mjs";

// Trava da paginação nos dois sentidos (docs/43-medicao-auditoria-ux.md §6 item 4; docs/42, E4): 31 de 62
// arquivos tinham "Próxima" sem "Anterior". A lista paginada que só anda para frente obriga o operador a
// voltar ao início e avançar de novo para rever a página anterior.
//
// Regra 1 — link só para frente. Todo link de página (atributo `href` de elemento JSX e propriedade `href`
// de objeto em qualquer lugar: `{...{ href }}`, `createElement(Link, { href })`) que AVANÇA uma chave de página precisa,
// no mesmo arquivo, de um link que RECUA a mesma chave. Os links do <Paginacao> (src/components/Paginacao.tsx,
// "← Anterior · Página N · Próxima →") e do <PaginacaoFila> (src/components/PaginacaoFila.tsx, cursor das filas)
// ficam de fora: os componentes já andam nos dois sentidos. No cursor de duas chaves (`antes…`/`depois…`),
// recuar por uma cobre avançar pela outra da mesma lista (`antesPendencias` cobre `depoisPendencias`).
//   - Chave de página: `cursor`, `antes…`, `depois…`, `xCursor`, `pagina`, `paginaX` (as mesmas de
//     vazio-paginado.test.ts). A chave é lida onde a URL é montada: `?chave=` em template ou em `+`,
//     `chave=valor` literal, propriedade de objeto (`hrefLista`, `URLSearchParams`, espalhamento, nome
//     calculado que resolve para texto), `?${chave}=` com a chave numa expressão (se não resolver para
//     texto, conta como chave de página) e o par `["chave", valor]` / `.set("chave", valor)`.
//   - Valor que AVANÇA: `pagina + 1` (o outro lado é número de página), nome `proximo…`/`next…`
//     (`d.proximoCursor`, `r.dado.proximoId`) e, falhando fechado, qualquer valor que a trava não sabe
//     ler (`versoes[29].id`, `ultimo.id`, parâmetro de função de seta): desconhecido conta como avanço.
//   - Valor que RECUA: `pagina - 1` e nome com "anterior" (`paginaAnterior`, `cursorAnterior`).
//   - Valor que MANTÉM a página (a própria chave sem passo: `pagina`, `r.pagina`, `cursor`) ou VOLTA AO
//     INÍCIO (literal: `?pagina=1`, `null`) não conta.
//   - A URL é seguida por dentro: constante local (com os `.set`/`.append` feitos nela), função local
//     (com os argumentos no lugar dos parâmetros), objeto local lido por propriedade, template aninhado e
//     `.toString()`. Não desce em acesso a propriedade de dado (`d.proximoCursor` é valor; `d` não é URL).
// Regra 2 — página lida sem navegação. Arquivo que lê chave de página da URL (tipo do `searchParams`,
// `lerPagina(…)`, `lerNavegacao(…)`, `.get("chave")`) precisa mostrar alguma navegação de página: <Paginacao>,
// <PaginacaoFila>, um link de página ou um componente importado do projeto (./, ../, @/) que mostre (até três níveis).
// Regra 3 — filas de trabalho por cursor (decisão de 10/10/2026): descrita junto do código, abaixo de `casosDoArquivo`.
//
// Exceções: arquivo + trecho exato (o texto normalizado da expressão do link, ou as chaves lidas na
// regra 2) + motivo; cada uma tem de casar com exatamente um caso, e a lista é conferida contra a cópia
// literal ANCORAS (mudar uma sem a outra falha).
//
// A trava e a medição chegam ao mesmo conjunto: o critério da métrica 7.5 (scripts/medicao-ux,
// `soParaFrente`: "Próxima" sem "Anterior") aplicado a src/ dá exatamente SO_PARA_FRENTE_MEDIDOS, e cada
// arquivo dele ou é exceção desta trava (pendência) ou está em NAO_E_PAGINACAO (o "Próxima" é texto de
// domínio e o arquivo não tem link de página).
//
// Fora do alcance (declarado): paginação por estado no cliente, sem URL (botões que chamam a consulta de
// novo, como DisponibilidadeOferta e CorrecaoAula); `router.push`/`redirect` (a volta para a última página
// válida não é navegação da lista); chave de página com nome fora do padrão (`cadastros`, `modelos`,
// `turmas` em leads/[id]/contratacao e contrato/aditivos, que já andam nos dois sentidos); URL guardada em
// estrutura que não é constante local (estado, contexto, prop). Duas listas no mesmo arquivo com o mesmo
// nome de chave contam como uma.

const RAIZES = ["src/app", "src/components"];

// <regra>
/** Os componentes de paginação nos dois sentidos (página numerada e cursor das filas): seus links não passam pela regra. */
const PAGINACAO = "Paginacao";
const PAGINACAO_FILA = "PaginacaoFila";
const NAVEGADORES = new Set([PAGINACAO, PAGINACAO_FILA]);
/** Cursor nos dois sentidos com duas chaves (`antes…`/`depois…`): recuar por uma cobre avançar pela outra. */
const PAR_DO_CURSOR = (chave: string) => (/^antes/.test(chave) ? chave.replace(/^antes/, "depois") : /^depois/.test(chave) ? chave.replace(/^depois/, "antes") : null);
/** Chave de página na URL: cursor (`cursor`, `antes…`, `depois…`, `xCursor`) ou número (`pagina`, `paginaX`). */
const CHAVE = /^(cursor|antes|depois|before|after)([A-Z]\w*)?$|^(?!proxim|next)\w+Cursor$|^(pagina|page)([A-Z]\w*)?$/;
/** Número de página: `+ 1` avança, `- 1` recua. */
const NUMERO = /^(pagina|page)([A-Z]\w*)?$/;
/** Nome de valor que aponta para a página seguinte. */
const AVANCO = /^(proxim[oa]|next)([A-Z]\w*)?$/;
/** Nome de valor que aponta para a página anterior. */
const RECUO = /anterior/i;
const MAX_PROFUNDIDADE = 12;
/** Par `chave=valor` com valor dentro do mesmo pedaço de texto. */
const PAR_LITERAL = /(?:^|[?&])([A-Za-z_]\w*)=([^&#]+)/g;
/** Pedaço de texto que termina em `chave=`: o valor é a expressão seguinte. */
const CHAVE_NO_FIM = /(?:^|[?&])([A-Za-z_]\w*)=$/;

export type Sentido = "frente" | "tras" | "manter" | "inicio" | "desconhecido";
type Funcao = ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression;
type Vinculo = { expr: ts.Expression; amb: Ambiente };
type Ambiente = { decl: Map<string, ts.Node[]>; mutacoes: Map<string, ts.CallExpression[]>; params: Map<string, Vinculo>; pilha: Set<ts.Node> };
type Valor = { chave: string; expr: ts.Expression | null; literal: boolean; amb: Ambiente };
export type LinkDePagina = { trecho: string; frente: string[]; tras: string[] };
export type Caso = { arquivo: string; regra: "so-para-frente" | "le-pagina-sem-navegacao"; trecho: string; chaves: string[] };
/** Fonte de um arquivo do projeto (caminho posix a partir da raiz), ou null se não existe. */
export type LerFonte = (caminho: string) => string | null;

const normaliza = (t: string) => t.replace(/\s+/g, " ").trim();

function desembrulha(e: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) || ts.isSatisfiesExpression(e) || ts.isTypeAssertionExpression(e)) e = e.expression;
  return e;
}

function nomeDe(e: ts.Expression): string | null {
  e = desembrulha(e);
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  return null;
}

const ehFuncao = (n: ts.Node): n is Funcao => ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n);
const ehTexto = (n: ts.Node): n is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral => ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);

/** Declarações locais por nome (inicializador de `const x = …` e funções declaradas) e os `.set`/`.append` feitos em cada nome. */
function ambienteDoArquivo(sf: ts.SourceFile): Ambiente {
  const decl = new Map<string, ts.Node[]>(), mutacoes = new Map<string, ts.CallExpression[]>();
  const junta = <T,>(mapa: Map<string, T[]>, nome: string, no: T) => mapa.set(nome, [...(mapa.get(nome) ?? []), no]);
  const visita = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) junta(decl, n.name.text, n.initializer);
    if (ts.isFunctionDeclaration(n) && n.name) junta(decl, n.name.text, n);
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && /^(set|append)$/.test(n.expression.name.text) && ts.isIdentifier(n.expression.expression)) junta(mutacoes, n.expression.expression.text, n);
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return { decl, mutacoes, params: new Map(), pilha: new Set() };
}

/** Ambiente da chamada de uma função local: cada parâmetro simples recebe o argumento, lido no ambiente de quem chama. */
function ambienteDaChamada(f: Funcao, args: readonly ts.Expression[], amb: Ambiente): Ambiente {
  const params = new Map(amb.params);
  f.parameters.forEach((p, i) => {
    if (!ts.isIdentifier(p.name)) return;
    if (args[i]) params.set(p.name.text, { expr: args[i], amb });
    else params.delete(p.name.text);
  });
  return { ...amb, params };
}

/** Inicializadores (não funções) de um nome local ainda não visitados nesta leitura. */
const inicializadores = (nome: string, amb: Ambiente) => (amb.decl.get(nome) ?? []).filter((d): d is ts.Expression => !ehFuncao(d) && !amb.pilha.has(d));

/** Objeto literal que a expressão é (direto, por parâmetro ou por constante local). */
function objetoDe(e0: ts.Expression, amb: Ambiente, prof = 0): { obj: ts.ObjectLiteralExpression; amb: Ambiente } | null {
  if (prof > MAX_PROFUNDIDADE) return null;
  const e = desembrulha(e0);
  if (ts.isObjectLiteralExpression(e)) return { obj: e, amb };
  if (ts.isIdentifier(e)) {
    const vinculo = amb.params.get(e.text);
    if (vinculo) return objetoDe(vinculo.expr, vinculo.amb, prof + 1);
    const inits = inicializadores(e.text, amb);
    if (inits.length === 1) return objetoDe(inits[0], amb, prof + 1);
  }
  return null;
}

/** Propriedade `nome` de um objeto literal local (para `links.proxima`, `f.antes` com `f` vinculado a `{ antes: … }`). */
function propriedadeDe(e: ts.PropertyAccessExpression, amb: Ambiente): Vinculo | null {
  const alvo = objetoDe(e.expression, amb);
  if (!alvo) return null;
  for (const p of alvo.obj.properties) {
    if (ts.isPropertyAssignment(p) && textoDoNome(p.name, alvo.amb) === e.name.text) return { expr: p.initializer, amb: alvo.amb };
    if (ts.isShorthandPropertyAssignment(p) && p.name.text === e.name.text) return { expr: p.name, amb: alvo.amb };
  }
  return null;
}

function uniao(conjuntos: Set<Sentido>[], padrao: Sentido): Set<Sentido> {
  const r = new Set<Sentido>();
  for (const c of conjuntos) for (const s of c) r.add(s);
  if (!r.size) r.add(padrao);
  return r;
}

/** Para onde o valor de uma chave de página leva. */
export function classificar(e0: ts.Expression, amb: Ambiente, prof = 0): Set<Sentido> {
  const so = (s: Sentido) => new Set<Sentido>([s]);
  if (prof > MAX_PROFUNDIDADE) return so("desconhecido");
  const e = desembrulha(e0);
  const K = ts.SyntaxKind;
  if (ts.isNumericLiteral(e) || ehTexto(e) || e.kind === K.NullKeyword || e.kind === K.TrueKeyword || e.kind === K.FalseKeyword || (ts.isIdentifier(e) && e.text === "undefined")) return so("inicio");
  if (ts.isTemplateExpression(e)) return uniao(e.templateSpans.map((s) => classificar(s.expression, amb, prof + 1)), "inicio");
  if (ts.isPrefixUnaryExpression(e)) return classificar(e.operand, amb, prof + 1);
  if (ts.isAwaitExpression(e)) return classificar(e.expression, amb, prof + 1);
  if (ts.isConditionalExpression(e)) return uniao([classificar(e.whenTrue, amb, prof + 1), classificar(e.whenFalse, amb, prof + 1)], "inicio");
  if (ts.isBinaryExpression(e)) {
    const op = e.operatorToken.kind;
    if (op === K.PlusToken || op === K.MinusToken) {
      const direita = desembrulha(e.right), esquerda = desembrulha(e.left);
      const outro = ts.isNumericLiteral(direita) ? esquerda : ts.isNumericLiteral(esquerda) && op === K.PlusToken ? direita : null;
      if (outro) {
        const base = classificar(outro, amb, prof + 1), nome = nomeDe(outro);
        if ((nome && NUMERO.test(nome)) || base.has("manter")) return so(op === K.PlusToken ? "frente" : "tras");
        return base;
      }
    }
    if (op === K.QuestionQuestionToken || op === K.BarBarToken || op === K.AmpersandAmpersandToken || op === K.PlusToken) {
      return uniao([classificar(e.left, amb, prof + 1), classificar(e.right, amb, prof + 1)], "inicio");
    }
    return so("desconhecido");
  }
  if (ts.isIdentifier(e)) {
    const vinculo = amb.params.get(e.text);
    if (vinculo) return classificar(vinculo.expr, vinculo.amb, prof + 1);
    if (RECUO.test(e.text)) return so("tras");
    if (AVANCO.test(e.text)) return so("frente");
    const inits = inicializadores(e.text, amb);
    if (inits.length) {
      for (const i of inits) amb.pilha.add(i);
      const s = uniao(inits.map((i) => classificar(i, amb, prof + 1)), "desconhecido");
      for (const i of inits) amb.pilha.delete(i);
      // A própria chave de página guardada numa constante (`const pagina = lerPagina(q)`) só muda de página com passo explícito.
      if (CHAVE.test(e.text)) return so(s.has("tras") ? "tras" : s.has("frente") ? "frente" : "manter");
      return s;
    }
    if (CHAVE.test(e.text)) return so("manter");
    return so("desconhecido");
  }
  if (ts.isPropertyAccessExpression(e)) {
    const nome = e.name.text;
    if (RECUO.test(nome)) return so("tras");
    if (AVANCO.test(nome)) return so("frente");
    const prop = propriedadeDe(e, amb);
    if (prop) return classificar(prop.expr, prop.amb, prof + 1);
    if (CHAVE.test(nome)) return so("manter");
    return so("desconhecido");
  }
  if (ts.isCallExpression(e)) return uniao(e.arguments.map((a) => classificar(a, amb, prof + 1)), "desconhecido");
  return so("desconhecido");
}

/** O sentido de um valor: recuo vence, depois avanço e desconhecido (falha fechado), depois manter e início. */
export function sentidoFinal(s: Set<Sentido>): Sentido {
  for (const x of ["tras", "frente", "desconhecido", "manter"] as const) if (s.has(x)) return x;
  return "inicio";
}

/** Texto do nome de uma propriedade; nome calculado só se resolver para texto (literal, parâmetro ou constante). */
function textoDoNome(nome: ts.PropertyName, amb: Ambiente): string | null {
  if (ts.isIdentifier(nome) || ts.isStringLiteral(nome) || ts.isNumericLiteral(nome) || ts.isNoSubstitutionTemplateLiteral(nome)) return nome.text;
  if (ts.isComputedPropertyName(nome)) return textoDaExpressao(nome.expression, amb);
  return null;
}

function textoDaExpressao(e0: ts.Expression, amb: Ambiente, prof = 0): string | null {
  if (prof > MAX_PROFUNDIDADE) return null;
  const e = desembrulha(e0);
  if (ehTexto(e)) return e.text;
  if (ts.isIdentifier(e)) {
    const vinculo = amb.params.get(e.text);
    if (vinculo) return textoDaExpressao(vinculo.expr, vinculo.amb, prof + 1);
    const inits = inicializadores(e.text, amb);
    if (inits.length === 1) return textoDaExpressao(inits[0], amb, prof + 1);
  }
  return null;
}

/** Pedaços de texto e expressões de um template ou de uma soma de textos, na ordem. */
function partesDeTexto(n0: ts.Expression): (string | ts.Expression)[] {
  const n = desembrulha(n0);
  if (ts.isTemplateExpression(n)) {
    const r: (string | ts.Expression)[] = [n.head.text];
    for (const s of n.templateSpans) r.push(s.expression, s.literal.text);
    return r;
  }
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) return [...partesDeTexto(n.left), ...partesDeTexto(n.right)];
  if (ehTexto(n)) return [n.text];
  return [n];
}

/** Valores das chaves de página onde a URL é montada, seguindo constantes, funções e objetos locais. */
function coletarValores(raiz: ts.Expression, amb: Ambiente): Valor[] {
  const saida: Valor[] = [];
  const chavePar = (chave: string | null, expr: ts.Expression | null, a: Ambiente) => {
    if (chave !== null && (chave === "?" || CHAVE.test(chave))) saida.push({ chave, expr, literal: false, amb: a });
  };
  const literais = (texto: string, a: Ambiente) => {
    for (const m of texto.matchAll(PAR_LITERAL)) if (CHAVE.test(m[1])) saida.push({ chave: m[1], expr: null, literal: true, amb: a });
  };
  /** `.set("chave", v)` / `.append("chave", v)`. */
  const mutacao = (c: ts.CallExpression, a: Ambiente) => {
    const [k, v] = c.arguments;
    if (k) chavePar(textoDaExpressao(k, a) ?? "?", v ?? null, a);
  };
  /** Corpo de função: o que ela devolve é URL; `.set`/`.append` no caminho também contam. */
  const corpo = (f: Funcao, a: Ambiente, prof: number) => {
    if (!f.body) return;
    if (!ts.isBlock(f.body)) { url(f.body, a, prof + 1); return; }
    const visita = (n: ts.Node) => {
      if (ts.isReturnStatement(n) && n.expression) url(n.expression, a, prof + 1);
      else if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && /^(set|append)$/.test(n.expression.name.text)) mutacao(n, a);
      if (!ehFuncao(n)) ts.forEachChild(n, visita);
    };
    ts.forEachChild(f.body, visita);
  };
  /** Expressão que produz (parte de) uma URL. */
  const url = (n0: ts.Expression, a: Ambiente, prof: number): void => {
    if (prof > MAX_PROFUNDIDADE) return;
    const n = desembrulha(n0);
    if (ts.isObjectLiteralExpression(n)) {
      for (const p of n.properties) {
        if (ts.isPropertyAssignment(p)) chavePar(textoDoNome(p.name, a) ?? (ts.isComputedPropertyName(p.name) ? "?" : null), p.initializer, a);
        else if (ts.isShorthandPropertyAssignment(p)) chavePar(p.name.text, p.name, a);
        else if (ts.isSpreadAssignment(p)) url(p.expression, a, prof + 1);
      }
      return;
    }
    if (ts.isTemplateExpression(n) || (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken)) {
      let anterior = "";
      let candidataAChave: ts.Expression | null = null;
      for (const parte of partesDeTexto(n)) {
        if (typeof parte === "string") { literais(parte, a); anterior += parte; continue; }
        const m = CHAVE_NO_FIM.exec(anterior);
        if (m) chavePar(m[1], parte, a);
        // `?${chave}=${valor}`: a chave vem de uma expressão; se não resolver para texto, conta como chave de página.
        else if (anterior === "=" && candidataAChave) chavePar(textoDaExpressao(candidataAChave, a) ?? "?", parte, a);
        else url(parte, a, prof + 1);
        candidataAChave = /(^|[?&])$/.test(anterior) && !m ? parte : null;
        anterior = "";
      }
      const fim = CHAVE_NO_FIM.exec(anterior);
      if (fim) chavePar(fim[1], null, a);
      return;
    }
    if (ehTexto(n)) {
      literais(n.text, a);
      const fim = CHAVE_NO_FIM.exec(n.text);
      if (fim) chavePar(fim[1], null, a);
      return;
    }
    if (ts.isConditionalExpression(n)) { url(n.whenTrue, a, prof + 1); url(n.whenFalse, a, prof + 1); return; }
    if (ts.isBinaryExpression(n)) { url(n.left, a, prof + 1); url(n.right, a, prof + 1); return; }
    if (ts.isArrayLiteralExpression(n)) {
      const [k, v] = n.elements;
      if (k && ehTexto(k)) chavePar(k.text, v ?? null, a);
      for (const el of n.elements) if (ts.isArrayLiteralExpression(el) || ts.isObjectLiteralExpression(el) || ts.isSpreadElement(el)) url(ts.isSpreadElement(el) ? el.expression : el, a, prof + 1);
      return;
    }
    if (ts.isIdentifier(n)) {
      const vinculo = a.params.get(n.text);
      if (vinculo) { url(vinculo.expr, vinculo.amb, prof + 1); return; }
      for (const i of inicializadores(n.text, a)) {
        a.pilha.add(i);
        url(i, a, prof + 1);
        a.pilha.delete(i);
      }
      for (const c of a.mutacoes.get(n.text) ?? []) mutacao(c, a);
      return;
    }
    if (ts.isPropertyAccessExpression(n)) {
      const prop = propriedadeDe(n, a);
      if (prop) url(prop.expr, prop.amb, prof + 1);
      return;
    }
    if (ts.isCallExpression(n)) {
      const chamado = desembrulha(n.expression);
      if (ts.isIdentifier(chamado)) {
        for (const d of a.decl.get(chamado.text) ?? []) {
          if (!ehFuncao(d) || a.pilha.has(d)) continue;
          a.pilha.add(d);
          corpo(d, ambienteDaChamada(d, n.arguments, a), prof + 1);
          a.pilha.delete(d);
        }
      } else if (ts.isPropertyAccessExpression(chamado) && chamado.name.text === "toString") url(chamado.expression, a, prof + 1);
      else if (ts.isPropertyAccessExpression(chamado) && /^(set|append)$/.test(chamado.name.text)) mutacao(n, a);
      for (const arg of n.arguments) url(arg, a, prof + 1);
      return;
    }
    if (ts.isNewExpression(n)) { for (const arg of n.arguments ?? []) url(arg, a, prof + 1); return; }
    if (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) { corpo(n, a, prof + 1); return; }
  };
  url(raiz, amb, 0);
  return saida;
}

/** O link leva a outra página? Quais chaves avança e quais recua. */
function lerLink(expr: ts.Expression, trecho: string, amb: Ambiente): LinkDePagina | null {
  const valores = coletarValores(expr, amb);
  if (!valores.length) return null;
  const frente = new Set<string>(), tras = new Set<string>();
  for (const v of valores) {
    const s = v.literal ? "inicio" : v.expr ? sentidoFinal(classificar(v.expr, v.amb)) : "desconhecido";
    // Chave que não se lê (`p.set(k, v)` copiando os filtros num laço): só conta se o valor avança de fato.
    if (v.chave === "?" && s === "desconhecido") continue;
    if (s === "tras") tras.add(v.chave);
    else if (s === "frente" || s === "desconhecido") frente.add(v.chave);
  }
  return { trecho, frente: [...frente].sort(), tras: [...tras].sort() };
}

/** Links de página do arquivo (fora do <Paginacao>/<PaginacaoFila>) e se o arquivo mostra cada um. */
export function linksDePagina(fonte: string): { links: LinkDePagina[]; paginacao: boolean; paginacaoFila: boolean } {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const amb = ambienteDoArquivo(sf);
  const links: LinkDePagina[] = [];
  const lidos = new Set<ts.Node>();
  let paginacao = false, paginacaoFila = false;
  const ler = (expr: ts.Expression, trecho: ts.Node) => {
    lidos.add(expr);
    const l = lerLink(expr, normaliza(trecho.getText(sf)), amb);
    if (l) links.push(l);
  };
  const jaLido = (n: ts.Node) => { for (let p: ts.Node | undefined = n; p; p = p.parent) if (lidos.has(p)) return true; return false; };
  const visita = (n: ts.Node, naPaginacao: boolean) => {
    let dentro = naPaginacao;
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const tag = n.tagName.getText(sf);
      if (NAVEGADORES.has(tag)) { dentro = true; if (tag === PAGINACAO) paginacao = true; else paginacaoFila = true; }
      if (!dentro) {
        // `{...{ href }}` e `{...props}` com `const props = { href }`: a propriedade `href` do objeto é lida abaixo.
        for (const at of n.attributes.properties) {
          if (ts.isJsxAttribute(at) && at.name.getText(sf) === "href" && at.initializer) {
            const expr = ts.isJsxExpression(at.initializer) ? at.initializer.expression : at.initializer;
            if (expr) ler(expr, expr);
          }
        }
      }
    } else if (!dentro && ts.isPropertyAssignment(n) && textoDoNome(n.name, amb) === "href" && !jaLido(n)) ler(n.initializer, n.initializer);
    // Os atributos do <Paginacao> ficam com ele; os filhos de qualquer elemento voltam à regra.
    ts.forEachChild(n, (c) => visita(c, ts.isJsxElement(n) ? naPaginacao : dentro));
  };
  visita(sf, false);
  return { links, paginacao, paginacaoFila };
}

/** Chaves de página que o arquivo lê da URL: tipo do `searchParams`, `lerPagina(…)`, `.get("chave")`. */
export function chavesLidas(fonte: string): string[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const chaves = new Set<string>();
  const dosTipos = (t: ts.Node) => {
    if (ts.isPropertySignature(t) && (ts.isIdentifier(t.name) || ts.isStringLiteral(t.name)) && CHAVE.test(t.name.text)) chaves.add(t.name.text);
    ts.forEachChild(t, dosTipos);
  };
  const tipoDoSearchParams = (t: ts.Node) => {
    if (ts.isPropertySignature(t) && ts.isIdentifier(t.name) && t.name.text === "searchParams" && t.type) dosTipos(t.type);
    ts.forEachChild(t, tipoDoSearchParams);
  };
  const visita = (n: ts.Node) => {
    if (ts.isParameter(n) && n.type) {
      if (ts.isIdentifier(n.name) && n.name.text === "searchParams") dosTipos(n.type);
      // `({ searchParams }: { searchParams: Promise<{ cursor?: string }> })`
      else tipoDoSearchParams(n.type);
    }
    if (ts.isCallExpression(n)) {
      const nome = nomeDe(n.expression), [primeiro, segundo] = n.arguments;
      if (nome === "lerPagina") chaves.add(segundo && ehTexto(segundo) ? segundo.text : "pagina");
      // `lerNavegacao(q, "Pendencias")`: o cursor da fila, nos dois sentidos (`depoisX`/`antesX`).
      if (nome === "lerNavegacao") {
        const sufixo = segundo && ehTexto(segundo) ? segundo.text : segundo ? "?" : "";
        chaves.add(`depois${sufixo}`);
        chaves.add(`antes${sufixo}`);
      }
      if (nome === "get" && primeiro && ehTexto(primeiro) && CHAVE.test(primeiro.text)) chaves.add(primeiro.text);
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return [...chaves].sort();
}

/** Arquivos do projeto importados (./, ../, @/) e mostrados como componente JSX. */
function componentesMostrados(arquivo: string, fonte: string, lerFonte: LerFonte): string[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const importados = new Map<string, string>();
  const dir = arquivo.slice(0, arquivo.lastIndexOf("/"));
  const resolver = (spec: string): string | null => {
    let base: string;
    if (spec.startsWith("@/")) base = `src/${spec.slice(2)}`;
    else if (spec.startsWith("./") || spec.startsWith("../")) {
      const partes = dir.split("/");
      for (const p of spec.split("/")) {
        if (p === "..") partes.pop();
        else if (p !== ".") partes.push(p);
      }
      base = partes.join("/");
    } else return null;
    for (const fim of ["", ".tsx", ".ts", "/index.tsx", "/index.ts"]) if (/\.tsx?$/.test(base + fim) && lerFonte(base + fim) !== null) return base + fim;
    return null;
  };
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier) || !st.importClause || st.importClause.isTypeOnly) continue;
    const alvo = resolver(st.moduleSpecifier.text);
    if (!alvo) continue;
    if (st.importClause.name) importados.set(st.importClause.name.text, alvo);
    const nomes = st.importClause.namedBindings;
    if (nomes && ts.isNamedImports(nomes)) for (const el of nomes.elements) if (!el.isTypeOnly) importados.set(el.name.text, alvo);
  }
  const mostrados = new Set<string>();
  const visita = (n: ts.Node) => {
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && ts.isIdentifier(n.tagName)) {
      const alvo = importados.get(n.tagName.text);
      if (alvo) mostrados.add(alvo);
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return [...mostrados].sort();
}

/** O arquivo (ou um componente do projeto que ele mostra, até três níveis) mostra navegação de página. */
function temNavegacao(arquivo: string, lerFonte: LerFonte, nivel = 0, vistos = new Set<string>()): boolean {
  if (nivel > 3 || vistos.has(arquivo)) return false;
  vistos.add(arquivo);
  const fonte = lerFonte(arquivo);
  if (fonte === null) return false;
  const { links, paginacao, paginacaoFila } = linksDePagina(fonte);
  if (paginacao || paginacaoFila || links.length) return true;
  return componentesMostrados(arquivo, fonte, lerFonte).some((f) => temNavegacao(f, lerFonte, nivel + 1, vistos));
}

/** Casos do arquivo: links que só avançam (regra 1) e página lida sem navegação (regra 2). */
export function casosDoArquivo(arquivo: string, lerFonte: LerFonte): Caso[] {
  const fonte = lerFonte(arquivo);
  if (fonte === null) return [];
  const { links } = linksDePagina(fonte);
  // A chave recuada cobre a si mesma e, no cursor de duas chaves, o seu par (`antes` recua o que `depois` avança).
  const recuadas = new Set(links.flatMap((l) => l.tras.flatMap((c) => [c, PAR_DO_CURSOR(c) ?? c])));
  const casos: Caso[] = [];
  for (const l of links) {
    const faltam = l.frente.filter((c) => !recuadas.has(c));
    if (faltam.length) casos.push({ arquivo, regra: "so-para-frente", trecho: l.trecho, chaves: faltam });
  }
  const lidas = chavesLidas(fonte);
  if (lidas.length && !temNavegacao(arquivo, lerFonte)) casos.push({ arquivo, regra: "le-pagina-sem-navegacao", trecho: lidas.join(", "), chaves: lidas });
  return casos;
}

// Regra 3 — fila de trabalho por cursor (decisão de 10/10/2026). Fila é a lista de pendências que somem
// quando alguém age nelas: na página numerada, resolver itens da página 1 desloca a 2, e quem avança pula
// registros. Cada tela de FILAS (cópia literal) e cada consulta da fila:
//   - TELA (a page e os componentes do projeto que ela mostra, até três níveis): não usa página numerada —
//     identificador `lerPagina`/`janelaDaPagina`/`recorteDaPagina`/`faixaDaPagina`/`paginaAlemDoFim`/`Paginacao`
//     (inclusive como nome importado, renomeado ou lido por propriedade/colchete), nome `pagina`/`paginaX`/`page…`
//     (variável, propriedade, chave), texto `"pagina"`/`"paginaX"` e `pagina=` dentro de texto ou template
//     (URL montada à mão);
//   - TELA: mostra <PaginacaoFila> (na page ou num componente mostrado) e lê o cursor com `lerNavegacao` na page;
//   - CONSULTA (o corpo da função exportada da fila, no arquivo do servidor; helpers locais chamados não são
//     seguidos): lê por `lerPaginaDaFila` e não usa a janela numerada — os mesmos identificadores e nomes,
//     propriedade `skip` nem `OFFSET` em texto/template.
// Falha fechado: arquivo ou função que não se encontra é caso. Exceções: arquivo + trecho exato + motivo,
// conferidas contra a cópia literal ANCORAS_FILA; cada uma casa com exatamente um caso.

/** Identificadores da página numerada. */
const NUMERADA = new Set(["lerPagina", "janelaDaPagina", "recorteDaPagina", "faixaDaPagina", "paginaAlemDoFim", PAGINACAO]);
/** Nome de número de página (variável, propriedade, chave). */
const NOME_NUMERADO = /^(pagina|page)([A-Z]\w*)?$/;
/** Texto que é a chave numerada (`"pagina"`) ou que monta `pagina=` numa URL. */
const TEXTO_NUMERADO = /^pagina([A-Z]\w*)?$|(^|[?&])pagina([A-Z]\w*)?=/;

export type CasoFila = { arquivo: string; regra: "fila-numerada" | "fila-sem-cursor" | "consulta-numerada" | "consulta-sem-cursor"; trecho: string };

/** Usos de página numerada num nó (o arquivo inteiro ou o corpo de uma função). `servidor`: também `skip` e `OFFSET`. */
function usosNumerados(raiz: ts.Node, sf: ts.SourceFile, servidor: boolean): string[] {
  const achados: string[] = [];
  const marca = (n: ts.Node) => achados.push(normaliza(n.getText(sf)));
  const visita = (n: ts.Node) => {
    if (ts.isIdentifier(n) && (NUMERADA.has(n.text) || NOME_NUMERADO.test(n.text))) marca(n);
    else if (ehTexto(n) && (NUMERADA.has(n.text) || TEXTO_NUMERADO.test(n.text) || (servidor && /\bOFFSET\b/i.test(n.text)))) marca(n);
    else if ((ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) || ts.isJsxText(n)) && (TEXTO_NUMERADO.test(n.text.trim()) || /[?&]pagina([A-Z]\w*)?=/.test(n.text) || (servidor && /\bOFFSET\b/i.test(n.text)))) marca(n);
    else if (servidor && (ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) && ts.isIdentifier(n.name) && n.name.text === "skip") marca(n.name);
    ts.forEachChild(n, visita);
  };
  visita(raiz);
  return achados;
}

/** Chama `nome(…)` (direto ou por propriedade) em algum ponto do nó. */
function chama(raiz: ts.Node, nome: string): boolean {
  const visita = (n: ts.Node): true | undefined => (ts.isCallExpression(n) && nomeDe(n.expression) === nome) || ts.forEachChild(n, visita) ? true : undefined;
  return visita(raiz) === true;
}

/** A page e os componentes do projeto que ela mostra (até três níveis), sem repetir. */
function arquivosDaTela(arquivo: string, lerFonte: LerFonte, nivel = 0, vistos = new Set<string>()): string[] {
  if (nivel > 3 || vistos.has(arquivo)) return [];
  vistos.add(arquivo);
  const fonte = lerFonte(arquivo);
  if (fonte === null) return [];
  return [arquivo, ...componentesMostrados(arquivo, fonte, lerFonte).flatMap((f) => arquivosDaTela(f, lerFonte, nivel + 1, vistos))];
}

/** Casos da regra 3 numa tela de fila: página numerada na tela ou nos componentes dela; sem <PaginacaoFila> ou sem `lerNavegacao`. */
export function casosDaFila(arquivo: string, lerFonte: LerFonte): CasoFila[] {
  const fonte = lerFonte(arquivo);
  if (fonte === null) return [{ arquivo, regra: "fila-sem-cursor", trecho: "arquivo não encontrado" }];
  const casos: CasoFila[] = [];
  const telas = arquivosDaTela(arquivo, lerFonte);
  for (const f of telas) {
    const sf = ts.createSourceFile("x.tsx", lerFonte(f) ?? "", ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    for (const trecho of usosNumerados(sf, sf, false)) casos.push({ arquivo: f, regra: "fila-numerada", trecho });
  }
  if (!telas.some((f) => linksDePagina(lerFonte(f) ?? "").paginacaoFila)) casos.push({ arquivo, regra: "fila-sem-cursor", trecho: "<PaginacaoFila>" });
  if (!chama(ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), "lerNavegacao")) casos.push({ arquivo, regra: "fila-sem-cursor", trecho: "lerNavegacao" });
  return casos;
}

/** Casos da regra 3 na consulta da fila: a função exportada `funcao` do arquivo do servidor. */
export function casosDaConsulta(arquivo: string, funcao: string, lerFonte: LerFonte): CasoFila[] {
  const fonte = lerFonte(arquivo);
  const sf = fonte === null ? null : ts.createSourceFile("x.ts", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const acharCorpo = (n: ts.Node): ts.Node | undefined => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === funcao && n.body) return n.body;
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === funcao && n.initializer && ehFuncao(n.initializer) && n.initializer.body) return n.initializer.body;
    return ts.forEachChild(n, acharCorpo);
  };
  const corpo = sf ? acharCorpo(sf) : undefined;
  if (!sf || !corpo) return [{ arquivo, regra: "consulta-sem-cursor", trecho: `${funcao}: função não encontrada` }];
  const casos: CasoFila[] = usosNumerados(corpo, sf, true).map((trecho) => ({ arquivo, regra: "consulta-numerada" as const, trecho: `${funcao}: ${trecho}` }));
  if (!chama(corpo, "lerPaginaDaFila")) casos.push({ arquivo, regra: "consulta-sem-cursor", trecho: `${funcao}: lerPaginaDaFila` });
  return casos;
}
// </regra>

type Excecao = { arquivo: string; trecho: string; motivo: string };

/** Pendências: listas paginadas que ainda só andam para frente (fatia seguinte do item 4). */
const PENDENCIA = "pendência (fatia seguinte do item 4 de docs/43 §6): lista por cursor ainda só para frente; migrar a consulta para página numerada ou cursor nos dois sentidos";

export const EXCECOES_PAGINACAO: readonly Excecao[] = [
  { arquivo: "src/app/(app)/academico/avaliacoes/[alocacaoId]/extras/page.tsx", trecho: "`?${new URLSearchParams({ antesId: d.proximoId })}`", motivo: `${PENDENCIA}: extras de avaliação por antesId` },
  { arquivo: "src/app/(app)/academico/calendario/page.tsx", trecho: "`/academico/calendario?cursor=${encodeURIComponent(versoes[29].id)}`", motivo: `${PENDENCIA}: versões do calendário institucional por cursor` },
  { arquivo: "src/app/(app)/academico/recuperacoes/[realizacaoId]/page.tsx", trecho: "`/academico/recuperacoes/${encodeURIComponent(realizacaoId)}?antesVersao=${d.proximaAntesVersao}`", motivo: `${PENDENCIA}: versões da nota de recuperação por antesVersao` },
  { arquivo: "src/app/(app)/academico/recuperacoes/correcoes/[notaId]/page.tsx", trecho: "`?antesVersao=${d.proximaAntesVersao}`", motivo: `${PENDENCIA}: propostas de correção da nota de recuperação por antesVersao` },
  { arquivo: "src/app/(app)/academico/recuperacoes/planos/[propostaId]/prorrogacoes/page.tsx", trecho: "`/academico/recuperacoes/planos/${encodeURIComponent(propostaId)}/prorrogacoes?antesVersao=${d.proximaAntesVersao}`", motivo: `${PENDENCIA}: propostas de prorrogação do plano por antesVersao` },
  { arquivo: "src/app/(app)/academico/recuperacoes/planos/page.tsx", trecho: "`/academico/recuperacoes/planos?${new URLSearchParams({ alocacaoId, antesVersao: String(d.proximaAntesVersao) })}`", motivo: `${PENDENCIA}: propostas de plano de recuperação por antesVersao` },
  { arquivo: "src/app/(app)/academico/recuperacoes/reservas/[reservaId]/cancelamento/page.tsx", trecho: "`?${new URLSearchParams({ antesId: d.proximoAntesId })}`", motivo: `${PENDENCIA}: propostas de cancelamento da recuperação por antesId` },
  { arquivo: "src/app/(app)/academico/recuperacoes/tentativas/[itemReservaId]/agenda/page.tsx", trecho: "`?antesVersao=${d.proximaAntesVersao}`", motivo: `${PENDENCIA}: propostas de horário da tentativa por antesVersao` },
  { arquivo: "src/app/(app)/academico/recuperacoes/tentativas/[itemReservaId]/autorizacao/page.tsx", trecho: "`?${new URLSearchParams({ depoisId: d.proximoId })}`", motivo: `${PENDENCIA}: autorizações especiais da tentativa por depoisId` },
  { arquivo: "src/app/(app)/academico/recuperacoes/tentativas/[itemReservaId]/designacao/page.tsx", trecho: "`?antesVersao=${d.proximaAntesVersao}`", motivo: `${PENDENCIA}: designações do avaliador por antesVersao` },
  { arquivo: "src/app/(app)/academico/recuperacoes/tentativas/[itemReservaId]/designacao/propostas/page.tsx", trecho: "`?antesVersao=${d.proximaAntesVersao}`", motivo: `${PENDENCIA}: propostas de designação por antesVersao` },
  { arquivo: "src/app/(app)/academico/reposicoes/correcoes/[reposicaoId]/page.tsx", trecho: "url({ conclusaoVersao: conclusao ?? undefined, antesVersao: dado.proximaAntesVersao })", motivo: `${PENDENCIA}: correções da conclusão da reposição por antesVersao` },
  { arquivo: "src/app/(app)/academico/reposicoes/page.tsx", trecho: "`/academico/reposicoes?matriculaId=${encodeURIComponent(matriculaId)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : \"\"}&origemCursor=${encodeURIComponent(dado.proximoOrigemCursor)}`", motivo: `${PENDENCIA}: reposições e ausências de origem da matrícula, dois cursores (cursor e origemCursor)` },
  { arquivo: "src/app/(app)/academico/reposicoes/page.tsx", trecho: "`/academico/reposicoes?matriculaId=${encodeURIComponent(matriculaId)}&cursor=${encodeURIComponent(dado.proximoCursor)}`", motivo: `${PENDENCIA}: reposições e ausências de origem da matrícula, dois cursores (cursor e origemCursor)` },
  { arquivo: "src/app/(app)/academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/autorizacoes/page.tsx", trecho: "`?${new URLSearchParams({ depoisId: d.proximoId })}`", motivo: `${PENDENCIA}: autorizações especiais da segunda chamada por depoisId` },
  { arquivo: "src/app/(app)/academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/historico/page.tsx", trecho: "`${base}/historico?antesId=${encodeURIComponent(d.proximoId)}`", motivo: `${PENDENCIA}: histórico de reservas da segunda chamada por antesId` },
  { arquivo: "src/app/(app)/academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/page.tsx", trecho: "`/academico/segundas-chamadas/${encodeURIComponent(alocacaoId)}/${encodeURIComponent(codigoAvaliacao)}?antesId=${encodeURIComponent(r.dado.proximoId)}`", motivo: `${PENDENCIA}: propostas de segunda chamada por antesId` },
  { arquivo: "src/app/(app)/academico/segundas-chamadas/propostas/[propostaId]/agenda/page.tsx", trecho: "`/academico/segundas-chamadas/propostas/${encodeURIComponent(propostaId)}/agenda?antesId=${encodeURIComponent(d.proximoId)}`", motivo: `${PENDENCIA}: propostas de agenda inicial por antesId` },
  { arquivo: "src/app/(app)/academico/segundas-chamadas/propostas/[propostaId]/designacao/page.tsx", trecho: "`?depoisVersao=${d.proximaVersao}${busca ? `&busca=${encodeURIComponent(busca)}` : \"\"}`", motivo: `${PENDENCIA}: propostas de designação por depoisVersao` },
  { arquivo: "src/app/(app)/academico/segundas-chamadas/reservas/[reservaId]/cancelamento/page.tsx", trecho: "`?beforeId=${encodeURIComponent(d.proximoId)}`", motivo: `${PENDENCIA}: propostas de cancelamento da reserva por beforeId` },
  { arquivo: "src/app/(app)/academico/segundas-chamadas/reservas/[reservaId]/remarcacao/page.tsx", trecho: "`/academico/segundas-chamadas/reservas/${encodeURIComponent(reservaId)}/remarcacao?antesId=${encodeURIComponent(d.proximoId)}`", motivo: `${PENDENCIA}: propostas de remarcação por antesId` },
  { arquivo: "src/app/(app)/academico/segundas-chamadas/reservas/[reservaId]/substituicao/page.tsx", trecho: "`${base}?antesVersao=${d.proximaVersao}${substitutoId ? `&substitutoId=${encodeURIComponent(substitutoId)}` : \"\"}`", motivo: `${PENDENCIA}: propostas de substituição do professor por antesVersao` },
  { arquivo: "src/app/(app)/diario/encontros/page.tsx", trecho: "`/diario/encontros?cursor=${encodeURIComponent(r.dado.proximoCursor)}`", motivo: `${PENDENCIA}: encontros e cancelamentos por cursor` },
  { arquivo: "src/app/(app)/diario/page.tsx", trecho: "hrefDiario({ busca, antes: historico.proximo })", motivo: `${PENDENCIA}: histórico do diário por antes (com busca no servidor)` },
  { arquivo: "src/app/(app)/diario/reposicoes/page.tsx", trecho: "`/diario/reposicoes?cursor=${encodeURIComponent(r.dado.proximoCursor)}`", motivo: `${PENDENCIA}: reposições do docente por cursor` },
  { arquivo: "src/app/(app)/matriculas/[id]/fechamentos-horas/page.tsx", trecho: "`${base}&cursor=${encodeURIComponent(d.proximoCursor)}`", motivo: `${PENDENCIA}: rascunhos de fechamento de horas por cursor` },
  { arquivo: "src/app/(app)/matriculas/[id]/ocorrencias-financeiras/page.tsx", trecho: "`/matriculas/${id}/ocorrencias-financeiras?cursor=${encodeURIComponent(d.proximoCursor)}`", motivo: `${PENDENCIA}: encontros particulares com ocorrência financeira por cursor` },
];

/** Cópia literal das âncoras das exceções: mudar a lista sem mudar aqui (ou o contrário) falha. */
const ANCORAS: readonly string[] = [
  "src/app/(app)/academico/avaliacoes/[alocacaoId]/extras/page.tsx | `?${new URLSearchParams({ antesId: d.proximoId })}`",
  "src/app/(app)/academico/calendario/page.tsx | `/academico/calendario?cursor=${encodeURIComponent(versoes[29].id)}`",
  "src/app/(app)/academico/recuperacoes/[realizacaoId]/page.tsx | `/academico/recuperacoes/${encodeURIComponent(realizacaoId)}?antesVersao=${d.proximaAntesVersao}`",
  "src/app/(app)/academico/recuperacoes/correcoes/[notaId]/page.tsx | `?antesVersao=${d.proximaAntesVersao}`",
  "src/app/(app)/academico/recuperacoes/planos/[propostaId]/prorrogacoes/page.tsx | `/academico/recuperacoes/planos/${encodeURIComponent(propostaId)}/prorrogacoes?antesVersao=${d.proximaAntesVersao}`",
  "src/app/(app)/academico/recuperacoes/planos/page.tsx | `/academico/recuperacoes/planos?${new URLSearchParams({ alocacaoId, antesVersao: String(d.proximaAntesVersao) })}`",
  "src/app/(app)/academico/recuperacoes/reservas/[reservaId]/cancelamento/page.tsx | `?${new URLSearchParams({ antesId: d.proximoAntesId })}`",
  "src/app/(app)/academico/recuperacoes/tentativas/[itemReservaId]/agenda/page.tsx | `?antesVersao=${d.proximaAntesVersao}`",
  "src/app/(app)/academico/recuperacoes/tentativas/[itemReservaId]/autorizacao/page.tsx | `?${new URLSearchParams({ depoisId: d.proximoId })}`",
  "src/app/(app)/academico/recuperacoes/tentativas/[itemReservaId]/designacao/page.tsx | `?antesVersao=${d.proximaAntesVersao}`",
  "src/app/(app)/academico/recuperacoes/tentativas/[itemReservaId]/designacao/propostas/page.tsx | `?antesVersao=${d.proximaAntesVersao}`",
  "src/app/(app)/academico/reposicoes/correcoes/[reposicaoId]/page.tsx | url({ conclusaoVersao: conclusao ?? undefined, antesVersao: dado.proximaAntesVersao })",
  "src/app/(app)/academico/reposicoes/page.tsx | `/academico/reposicoes?matriculaId=${encodeURIComponent(matriculaId)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : \"\"}&origemCursor=${encodeURIComponent(dado.proximoOrigemCursor)}`",
  "src/app/(app)/academico/reposicoes/page.tsx | `/academico/reposicoes?matriculaId=${encodeURIComponent(matriculaId)}&cursor=${encodeURIComponent(dado.proximoCursor)}`",
  "src/app/(app)/academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/autorizacoes/page.tsx | `?${new URLSearchParams({ depoisId: d.proximoId })}`",
  "src/app/(app)/academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/historico/page.tsx | `${base}/historico?antesId=${encodeURIComponent(d.proximoId)}`",
  "src/app/(app)/academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/page.tsx | `/academico/segundas-chamadas/${encodeURIComponent(alocacaoId)}/${encodeURIComponent(codigoAvaliacao)}?antesId=${encodeURIComponent(r.dado.proximoId)}`",
  "src/app/(app)/academico/segundas-chamadas/propostas/[propostaId]/agenda/page.tsx | `/academico/segundas-chamadas/propostas/${encodeURIComponent(propostaId)}/agenda?antesId=${encodeURIComponent(d.proximoId)}`",
  "src/app/(app)/academico/segundas-chamadas/propostas/[propostaId]/designacao/page.tsx | `?depoisVersao=${d.proximaVersao}${busca ? `&busca=${encodeURIComponent(busca)}` : \"\"}`",
  "src/app/(app)/academico/segundas-chamadas/reservas/[reservaId]/cancelamento/page.tsx | `?beforeId=${encodeURIComponent(d.proximoId)}`",
  "src/app/(app)/academico/segundas-chamadas/reservas/[reservaId]/remarcacao/page.tsx | `/academico/segundas-chamadas/reservas/${encodeURIComponent(reservaId)}/remarcacao?antesId=${encodeURIComponent(d.proximoId)}`",
  "src/app/(app)/academico/segundas-chamadas/reservas/[reservaId]/substituicao/page.tsx | `${base}?antesVersao=${d.proximaVersao}${substitutoId ? `&substitutoId=${encodeURIComponent(substitutoId)}` : \"\"}`",
  "src/app/(app)/diario/encontros/page.tsx | `/diario/encontros?cursor=${encodeURIComponent(r.dado.proximoCursor)}`",
  "src/app/(app)/diario/page.tsx | hrefDiario({ busca, antes: historico.proximo })",
  "src/app/(app)/diario/reposicoes/page.tsx | `/diario/reposicoes?cursor=${encodeURIComponent(r.dado.proximoCursor)}`",
  "src/app/(app)/matriculas/[id]/fechamentos-horas/page.tsx | `${base}&cursor=${encodeURIComponent(d.proximoCursor)}`",
  "src/app/(app)/matriculas/[id]/ocorrencias-financeiras/page.tsx | `/matriculas/${id}/ocorrencias-financeiras?cursor=${encodeURIComponent(d.proximoCursor)}`",
];

/** Arquivos com "Próxima" e sem "Anterior" (critério da métrica 7.5) em que "Próxima" é texto de domínio, não paginação. */
const NAO_E_PAGINACAO: readonly { arquivo: string; motivo: string }[] = [
  { arquivo: "src/app/(app)/home/HomeProfessor.tsx", motivo: "\"Próxima aula experimental\": título do cartão da aula seguinte, não navegação de lista" },
  { arquivo: "src/app/(app)/matriculas/[id]/continuidade-mensal/PreviaContinuidadeMensal.tsx", motivo: "\"Próxima cobertura\": rótulo do período seguinte da continuidade, não navegação de lista" },
  { arquivo: "src/app/(app)/matriculas/[id]/contrato/aditivos/[propostaId]/page.tsx", motivo: "\"Próximas cobranças\": nome do domínio CONDICOES_FUTURAS do aditivo; a navegação das conferências fica em ParticipantesHistorico (<Paginacao>)" },
  { arquivo: "src/app/(app)/pipeline/KanbanBoard.tsx", motivo: "\"Próxima: {proximaAcao}\": próxima ação do lead no cartão do funil, não navegação de lista" },
];

/** O conjunto que a medição conta como "só para frente" depois desta PR (cópia literal). */
const SO_PARA_FRENTE_MEDIDOS: readonly string[] = [
  "src/app/(app)/home/HomeProfessor.tsx",
  "src/app/(app)/matriculas/[id]/continuidade-mensal/PreviaContinuidadeMensal.tsx",
  "src/app/(app)/matriculas/[id]/contrato/aditivos/[propostaId]/page.tsx",
  "src/app/(app)/pipeline/KanbanBoard.tsx",
];

/**
 * Das 28 telas que a #158 passou para <Paginacao>, as 16 que são LISTA ou HISTÓRICO (o item não sai da lista quando
 * alguém age nele): continuam com página numerada. As outras 12 são FILAS (abaixo).
 */
const MIGRADAS: readonly string[] = [
  "src/app/(app)/academico/equivalencias/page.tsx",
  "src/app/(app)/academico/grades/nova/page.tsx",
  "src/app/(app)/academico/indisponibilidades/page.tsx",
  "src/app/(app)/academico/recuperacoes/page.tsx",
  "src/app/(app)/academico/recuperacoes/planos/[propostaId]/autorizacao-reserva/page.tsx",
  "src/app/(app)/academico/recuperacoes/planos/[propostaId]/page.tsx",
  "src/app/(app)/academico/recuperacoes/planos/autorizacoes-preparacao/page.tsx",
  "src/app/(app)/academico/segundas-chamadas/agendas/page.tsx",
  "src/app/(app)/academico/segundas-chamadas/minhas/page.tsx",
  "src/app/(app)/alunos/[id]/academico/page.tsx",
  "src/app/(app)/configuracao/migracao/page.tsx",
  "src/app/(app)/diario/regularizacoes-gravacao/page.tsx",
  "src/app/(app)/financeiro/migracao/[linhaId]/page.tsx",
  "src/app/(app)/financeiro/migracao/page.tsx",
  "src/app/(app)/matriculas/[id]/autorizacoes-comunicacao/page.tsx",
  "src/app/(app)/matriculas/[id]/contrato/aditivos/ParticipantesHistorico.tsx",
];

type Fila = { tela: string; consulta: { arquivo: string; funcao: string } };

/**
 * Filas de trabalho (decisão de 10/10/2026): cursor nos dois sentidos, nunca página numerada. Cada tela com a função
 * do servidor que lê a fila (na de grades, a própria page consulta o banco).
 */
const FILAS: readonly Fila[] = [
  { tela: "src/app/(app)/academico/grades/page.tsx", consulta: { arquivo: "src/app/(app)/academico/grades/page.tsx", funcao: "GradesPage" } },
  { tela: "src/app/(app)/academico/page.tsx", consulta: { arquivo: "src/server/academico/consultas.ts", funcao: "listarFilaSolicitacoesAcademicas" } },
  { tela: "src/app/(app)/academico/recuperacoes/designadas/page.tsx", consulta: { arquivo: "src/server/avaliacoes/recuperacao-fila-docente.ts", funcao: "listarTentativasRecuperacaoDesignadas" } },
  { tela: "src/app/(app)/academico/segundas-chamadas/pendentes-agenda/page.tsx", consulta: { arquivo: "src/server/avaliacoes/segunda-chamada-fila-agenda.ts", funcao: "listarSegundasChamadasSemAgenda" } },
  { tela: "src/app/(app)/diario/excecoes-gravacao/page.tsx", consulta: { arquivo: "src/server/diario/excecao-consulta.ts", funcao: "listarExcecoesGravacao" } },
  { tela: "src/app/(app)/diario/pendencias/page.tsx", consulta: { arquivo: "src/server/diario/avisos-pendencias-diario.ts", funcao: "consultarAvisosDiario" } },
  { tela: "src/app/(app)/diario/regularizacoes/page.tsx", consulta: { arquivo: "src/server/diario/regularizacao-consultas.ts", funcao: "listarRegularizacoesAula" } },
  { tela: "src/app/(app)/financeiro/continuidade/page.tsx", consulta: { arquivo: "src/server/matricula/continuidade-fila.ts", funcao: "consultarFilaContinuidadeMensal" } },
  { tela: "src/app/(app)/financeiro/desistencias/page.tsx", consulta: { arquivo: "src/server/matricula/desistencia-financeiro-consulta.ts", funcao: "listarDesistenciasFinanceiras" } },
  { tela: "src/app/(app)/secretaria/avisos-agenda/page.tsx", consulta: { arquivo: "src/server/comunicacoes-agenda/consultas.ts", funcao: "consultarAvisosAlteracaoAgenda" } },
  { tela: "src/app/(app)/secretaria/desistencias/page.tsx", consulta: { arquivo: "src/server/matricula/desistencia-administrativa-fila.ts", funcao: "listarPendenciasAdministrativasDesistencia" } },
  { tela: "src/app/(app)/secretaria/envios-portal/page.tsx", consulta: { arquivo: "src/server/portal-aluno/fila-envios.ts", funcao: "consultarFilaEnviosPortalAluno" } },
];

/** Cópia literal das filas (tela | arquivo da consulta | função): mudar FILAS sem mudar aqui (ou o contrário) falha. */
const FILAS_LITERAL: readonly string[] = [
  "src/app/(app)/academico/grades/page.tsx | src/app/(app)/academico/grades/page.tsx | GradesPage",
  "src/app/(app)/academico/page.tsx | src/server/academico/consultas.ts | listarFilaSolicitacoesAcademicas",
  "src/app/(app)/academico/recuperacoes/designadas/page.tsx | src/server/avaliacoes/recuperacao-fila-docente.ts | listarTentativasRecuperacaoDesignadas",
  "src/app/(app)/academico/segundas-chamadas/pendentes-agenda/page.tsx | src/server/avaliacoes/segunda-chamada-fila-agenda.ts | listarSegundasChamadasSemAgenda",
  "src/app/(app)/diario/excecoes-gravacao/page.tsx | src/server/diario/excecao-consulta.ts | listarExcecoesGravacao",
  "src/app/(app)/diario/pendencias/page.tsx | src/server/diario/avisos-pendencias-diario.ts | consultarAvisosDiario",
  "src/app/(app)/diario/regularizacoes/page.tsx | src/server/diario/regularizacao-consultas.ts | listarRegularizacoesAula",
  "src/app/(app)/financeiro/continuidade/page.tsx | src/server/matricula/continuidade-fila.ts | consultarFilaContinuidadeMensal",
  "src/app/(app)/financeiro/desistencias/page.tsx | src/server/matricula/desistencia-financeiro-consulta.ts | listarDesistenciasFinanceiras",
  "src/app/(app)/secretaria/avisos-agenda/page.tsx | src/server/comunicacoes-agenda/consultas.ts | consultarAvisosAlteracaoAgenda",
  "src/app/(app)/secretaria/desistencias/page.tsx | src/server/matricula/desistencia-administrativa-fila.ts | listarPendenciasAdministrativasDesistencia",
  "src/app/(app)/secretaria/envios-portal/page.tsx | src/server/portal-aluno/fila-envios.ts | consultarFilaEnviosPortalAluno",
];

/** Exceções da regra 3: arquivo + trecho exato + motivo. Nenhuma hoje — o mecanismo fica para um caso que precise. */
const EXCECOES_FILA: readonly Excecao[] = [];
/** Cópia literal das âncoras das exceções da regra 3. */
const ANCORAS_FILA: readonly string[] = [];

// ---------------------------------------------------------------------------------------------------
// Fontes do projeto e autotestes
// ---------------------------------------------------------------------------------------------------

function listar(dir: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir).sort()) {
    const caminho = `${dir}/${nome}`;
    if (statSync(caminho).isDirectory()) saida.push(...listar(caminho));
    else saida.push(caminho);
  }
  return saida;
}

const lerDoDisco: LerFonte = (caminho) => (existsSync(caminho) && statSync(caminho).isFile() ? readFileSync(caminho, "utf8") : null);

/** Telas e componentes de produção (.tsx), fora os testes. */
const telas = () => RAIZES.flatMap((r) => listar(r)).filter((f) => f.endsWith(".tsx") && !ehTeste(f));

/** Leitor de fontes virtuais para os autotestes (caminho → fonte). */
const virtual = (arquivos: Record<string, string>): LerFonte => (caminho) => arquivos[caminho] ?? null;
const casos = (fonte: string, extras: Record<string, string> = {}) => casosDoArquivo("src/app/x/page.tsx", virtual({ "src/app/x/page.tsx": fonte, ...extras }));
const trechos = (fonte: string, extras: Record<string, string> = {}) => casos(fonte, extras).map((c) => `${c.regra}: ${c.trecho} [${c.chaves.join(", ")}]`);

describe("paginação nos dois sentidos — autotestes da trava (fonte virtual)", () => {
  it("link que só avança é acusado em cada forma de montar a URL", () => {
    expect(trechos("const x = <Link href={`/x?cursor=${encodeURIComponent(d.proximoCursor)}`}>Próxima</Link>;")).toEqual(["so-para-frente: `/x?cursor=${encodeURIComponent(d.proximoCursor)}` [cursor]"]);
    expect(trechos("const x = <Link href={\"/x?cursor=\" + encodeURIComponent(r.dado.proximoCursor)}>Mais</Link>;")).toEqual(["so-para-frente: \"/x?cursor=\" + encodeURIComponent(r.dado.proximoCursor) [cursor]"]);
    expect(trechos("const x = <Link href={`?${new URLSearchParams({ alocacaoId, depoisId: d.proximoId })}`}>Mais</Link>;")).toEqual(["so-para-frente: `?${new URLSearchParams({ alocacaoId, depoisId: d.proximoId })}` [depoisId]"]);
    expect(trechos("const x = <Link href={hrefLista(\"/x\", { busca, pagina: pagina + 1 })}>Mais</Link>;")).toEqual(["so-para-frente: hrefLista(\"/x\", { busca, pagina: pagina + 1 }) [pagina]"]);
    // Par solto, `.set("chave", valor)` na constante local e no corpo da função local.
    expect(trechos("const x = <Link href={`?${new URLSearchParams([[\"cursor\", d.proximoCursor]])}`}>Mais</Link>;")).toHaveLength(1);
    expect(trechos("const q = new URLSearchParams(); q.set(\"cursor\", d.proximoCursor);\nconst x = <Link href={`?${q}`}>Mais</Link>;")).toHaveLength(1);
    expect(trechos("function u() { const q = new URLSearchParams(); q.set(\"antesVersao\", String(d.proximaAntesVersao)); return `?${q.toString()}`; }\nconst x = <Link href={u()}>Mais</Link>;")).toHaveLength(1);
    // Espalhamento de filtros com a página no fim; chave numa expressão que resolve (ou não) para texto.
    expect(trechos("const x = <Link href={hrefLista(\"/x\", { ...filtros, pagina: r.pagina + 1 })}>Mais</Link>;")).toHaveLength(1);
    expect(trechos("const chave = \"cursor\";\nconst x = <Link href={`?${chave}=${d.proximo}`}>Mais</Link>;")).toEqual(["so-para-frente: `?${chave}=${d.proximo}` [cursor]"]);
    expect(trechos("const x = <Link href={`?${chaveDeFora}=${d.proximo}`}>Mais</Link>;")).toEqual(["so-para-frente: `?${chaveDeFora}=${d.proximo}` [?]"]);
    expect(trechos("const x = <Link href={hrefLista(\"/x\", { [campo]: d.proximo })}>Mais</Link>;")).toHaveLength(1);
  });

  it("a URL é seguida por constante, função e objeto locais, atributo espalhado e createElement", () => {
    expect(trechos("const proxima = `?pagina=${pagina + 1}`;\nconst x = <Link href={proxima}>Mais</Link>;")).toEqual(["so-para-frente: proxima [pagina]"]);
    expect(trechos("const href = (p: number) => hrefLista(\"/x\", { pagina: p });\nconst x = <Link href={href(pagina + 1)}>Mais</Link>;")).toEqual(["so-para-frente: href(pagina + 1) [pagina]"]);
    expect(trechos("function url(p: number) { return `?pagina=${p}`; }\nconst x = <a href={url(r.pagina + 1)}>Mais</a>;")).toHaveLength(1);
    expect(trechos("function hrefDiario(f: { antes?: string }) { return hrefLista(\"/d\", { antes: f.antes }); }\nconst x = <Link href={hrefDiario({ antes: historico.proximo })}>Mais</Link>;")).toHaveLength(1);
    expect(trechos("const links = { proxima: `?cursor=${d.proximoCursor}` };\nconst x = <Link href={links.proxima}>Mais</Link>;")).toHaveLength(1);
    expect(trechos("const x = <Link {...{ href: `?cursor=${d.proximoCursor}` }}>Mais</Link>;")).toEqual(["so-para-frente: `?cursor=${d.proximoCursor}` [cursor]"]);
    expect(trechos("const props = { href: `?cursor=${d.proximoCursor}` };\nconst x = <Link {...props}>Mais</Link>;")).toHaveLength(1);
    expect(trechos("const x = createElement(Link, { href: `?cursor=${d.proximoCursor}` }, \"Mais\");")).toHaveLength(1);
    expect(trechos("const x = cond ? <Link href={`?pagina=${pagina + 1}`}>Mais</Link> : null;")).toHaveLength(1);
    // A chave guardada numa constante com passo explícito avança.
    expect(trechos("const pagina = r.pagina + 1;\nconst x = <Link href={hrefLista(\"/x\", { pagina })}>Mais</Link>;")).toHaveLength(1);
  });

  it("valor que a trava não sabe ler conta como avanço (falha fechado)", () => {
    expect(trechos("const x = <Link href={`/x?cursor=${encodeURIComponent(versoes[29].id)}`}>Mais</Link>;")).toHaveLength(1);
    expect(trechos("const x = <Link href={`?antes=${ultimo.id}`}>Mais</Link>;")).toHaveLength(1);
    expect(trechos("const x = <Lista href={(p: number) => `?pagina=${p}`} />;")).toHaveLength(1);
    expect(trechos("const x = <Link href={`/x?cursor=`}>Mais</Link>;")).toHaveLength(1);
  });

  it("com o recuo da mesma chave no arquivo, não há caso", () => {
    expect(trechos("const x = <nav>{pagina > 1 && <Link href={`?pagina=${pagina - 1}`}>Anterior</Link>}<Link href={`?pagina=${pagina + 1}`}>Próxima</Link></nav>;")).toEqual([]);
    expect(trechos("const href = (p: number) => hrefLista(\"/x\", { pagina: p });\nconst x = <nav><Link href={href(pagina - 1)}>A</Link><Link href={href(pagina + 1)}>P</Link></nav>;")).toEqual([]);
    expect(trechos("const paginaAnterior = d.pagina > 1 ? d.pagina - 1 : null;\nconst x = <nav><Link href={`?pagina=${paginaAnterior}`}>Mais recentes</Link><Link href={`?pagina=${d.pagina + 1}`}>Mais antigos</Link></nav>;")).toEqual([]);
    expect(trechos("const x = <nav><Link href={`?cursor=${d.cursorAnterior}`}>A</Link><Link href={`?cursor=${d.proximoCursor}`}>P</Link></nav>;")).toEqual([]);
    // Manter a página de outro painel e voltar ao início não contam como avanço.
    expect(trechos("const x = <nav><Link href={`?paginaA=${paginaA - 1}&paginaB=${paginaB}`}>A</Link><Link href={`?paginaA=${paginaA + 1}&paginaB=${paginaB}`}>P</Link><Link href=\"?pagina=1\">Início</Link></nav>;")).toEqual([]);
    expect(trechos("const pagina = lerPagina(q);\nconst x = <nav><Link href={hrefLista(\"/x\", { pagina: pagina - 1 })}>A</Link><Link href={hrefLista(\"/x\", { pagina: pagina + 1 })}>P</Link><Link href={hrefLista(\"/x\", { pagina, ordem })}>Ordenar</Link></nav>;")).toEqual([]);
  });

  it("recuo de outra chave não cobre: duas listas no arquivo, uma só para frente", () => {
    const fonte = "const x = <nav><Link href={`?cursor=${d.cursorAnterior}`}>A</Link><Link href={`?cursor=${d.proximoCursor}`}>P</Link><Link href={`?pendenciaCursor=${d.proximoCursorPendencia}`}>P2</Link></nav>;";
    expect(trechos(fonte)).toEqual(["so-para-frente: `?pendenciaCursor=${d.proximoCursorPendencia}` [pendenciaCursor]"]);
  });

  it("<Paginacao> não é acusado, mas não cobre link de outra lista feito à mão", () => {
    expect(trechos("const x = <Paginacao pagina={pagina} temProxima={t} href={(p) => hrefLista(\"/x\", { pagina: p })} rotulo=\"Páginas\" />;")).toEqual([]);
    expect(trechos("const x = <><Paginacao pagina={pagina} temProxima={t} href={(p) => hrefLista(\"/x\", { pagina: p })} rotulo=\"Páginas\" /><Link href={`?cursor=${d.proximoCursor}`}>Mais</Link></>;")).toHaveLength(1);
  });

  it("dado lido por propriedade não é URL: o link de detalhe não vira link de página", () => {
    const fonte = "const d = (await listar({ cursor: q.cursor })).dado;\nconst x = <><Link href={`/m/${encodeURIComponent(d.id)}`}>Abrir</Link><a href=\"/financeiro\">Voltar</a><Link href={`?${new URLSearchParams({ modo })}`}>Modo</Link></>;";
    expect(linksDePagina(fonte).links).toEqual([]);
  });

  it("página lida da URL sem navegação nenhuma é acusada; com navegação no componente mostrado, não", () => {
    const pagina = "export default async function P({ searchParams }: { searchParams: Promise<{ antesVersao?: string }> }) { const { antesVersao } = await searchParams; return <Lista antes={antesVersao} />; }";
    expect(trechos(`import { Lista } from "./Lista";\n${pagina}`, { "src/app/x/Lista.tsx": "export function Lista() { return <ul />; }" })).toEqual(["le-pagina-sem-navegacao: antesVersao [antesVersao]"]);
    expect(trechos(`import { Lista } from "./Lista";\n${pagina}`, { "src/app/x/Lista.tsx": "export function Lista() { return <Paginacao pagina={1} temProxima href={h} rotulo=\"r\" />; }" })).toEqual([]);
    expect(trechos(`import { Lista } from "@/app/x/Lista";\n${pagina}`, { "src/app/x/Lista.tsx": "export function Lista() { return <Link href={`?antesVersao=${v - 1}`}>A</Link>; }" })).toEqual([]);
    expect(trechos("const pagina = lerPagina(await searchParams);\nconst x = <ul />;")).toEqual(["le-pagina-sem-navegacao: pagina [pagina]"]);
    expect(trechos("const q = useSearchParams(); const c = q.get(\"cursor\");\nconst x = <ul />;")).toEqual(["le-pagina-sem-navegacao: cursor [cursor]"]);
    expect(trechos("export default async function P(props: { searchParams: Promise<{ pagina?: string }> }) { return <ul />; }")).toEqual(["le-pagina-sem-navegacao: pagina [pagina]"]);
    // Import só de tipo não é componente mostrado.
    expect(trechos(`import type { Lista } from "./Lista";\n${pagina}`, { "src/app/x/Lista.tsx": "export function Lista() { return <Paginacao pagina={1} temProxima href={h} rotulo=\"r\" />; }" })).toHaveLength(1);
    // O cursor da fila também é página lida da URL; <PaginacaoFila> é navegação.
    expect(trechos("const nav = lerNavegacao(await searchParams);\nconst x = <ul />;")).toEqual(["le-pagina-sem-navegacao: antes, depois [antes, depois]"]);
    expect(trechos("const nav = lerNavegacao(q, \"Pendencias\");\nconst x = <PaginacaoFila anterior={a} proxima={p} href={h} rotulo=\"r\" />;")).toEqual([]);
  });

  it("cursor de duas chaves: recuar por `antes` cobre avançar por `depois` (e só o par da mesma lista)", () => {
    expect(trechos("const x = <nav><Link href={hrefLista(\"/x\", { antes: d.anterior })}>A</Link><Link href={hrefLista(\"/x\", { depois: d.proxima })}>P</Link></nav>;")).toEqual([]);
    expect(trechos("const x = <nav><Link href={`?antesPendencias=${d.anterior}`}>A</Link><Link href={`?depoisPendencias=${d.proxima}`}>P</Link></nav>;")).toEqual([]);
    // O recuo de outra lista não cobre: `antes` (avisos) não cobre `depoisPendencias`.
    expect(trechos("const x = <nav><Link href={`?antes=${d.anterior}`}>A</Link><Link href={`?depoisPendencias=${d.proxima}`}>P</Link></nav>;")).toEqual(["so-para-frente: `?depoisPendencias=${d.proxima}` [depoisPendencias]"]);
    // Só avançar por `depois`, sem recuo nenhum, continua acusado.
    expect(trechos("const x = <Link href={hrefLista(\"/x\", { depois: d.proxima })}>P</Link>;")).toEqual(["so-para-frente: hrefLista(\"/x\", { depois: d.proxima }) [depois]"]);
    // Os links do <PaginacaoFila> ficam com ele, como os do <Paginacao>.
    expect(trechos("const x = <PaginacaoFila anterior={a} proxima={p} href={(c) => `?depois=${c}`} rotulo=\"r\" />;")).toEqual([]);
  });
});

describe("filas por cursor — autotestes da regra 3 (fonte virtual)", () => {
  const TELA = "src/app/f/page.tsx";
  const NAV = "<PaginacaoFila anterior={d.anterior} proxima={d.proxima} href={(c) => hrefLista(\"/f\", c)} rotulo=\"Fila\" />";
  const bom = [
    "import { PaginacaoFila } from \"@/components/PaginacaoFila\";",
    "import { lerNavegacao } from \"@/lib/cursor-fila\";",
    "export default async function P({ searchParams }: { searchParams: Promise<ParametrosUrl> }) {",
    "  const nav = lerNavegacao(await searchParams);",
    "  const d = await listar(nav);",
    `  return <section>${NAV}</section>;`,
    "}",
  ].join("\n");
  const fila = (fonte: string, extras: Record<string, string> = {}) => casosDaFila(TELA, virtual({ [TELA]: fonte, "src/components/PaginacaoFila.tsx": "export function PaginacaoFila() { return null; }", ...extras }))
    .map((c) => `${c.regra}: ${c.arquivo === TELA ? "" : `${c.arquivo} | `}${c.trecho}`);
  const SERVIDOR = "src/server/f.ts";
  const consulta = (fonte: string) => casosDaConsulta(SERVIDOR, "listarFila", virtual({ [SERVIDOR]: fonte })).map((c) => `${c.regra}: ${c.trecho}`);

  it("tela de fila certa: cursor lido, <PaginacaoFila>, nada numerado", () => {
    expect(fila(bom)).toEqual([]);
  });

  it("página numerada na tela é acusada em cada forma", () => {
    expect(fila(bom.replace("lerNavegacao(await searchParams)", "lerPagina(await searchParams)"))).toEqual(["fila-numerada: lerPagina", "fila-sem-cursor: lerNavegacao"]);
    expect(fila(`${bom}\nconst y = <Paginacao pagina={1} temProxima={false} href={h} rotulo="r" />;`)).toEqual(["fila-numerada: Paginacao", "fila-numerada: pagina"]);
    expect(fila(`${bom}\nconst j = janelaDaPagina(2, 20), r = recorteDaPagina(l, 20);`)).toEqual(["fila-numerada: janelaDaPagina", "fila-numerada: recorteDaPagina"]);
    // Renomeado no import, lido por propriedade ou por colchete.
    expect(fila(`import { lerPagina as ler } from "@/lib/pagina-url";\n${bom}`)).toEqual(["fila-numerada: lerPagina"]);
    expect(fila(`import * as u from "@/lib/pagina-url";\n${bom}\nconst n = u.lerPagina(q);`)).toEqual(["fila-numerada: lerPagina"]);
    expect(fila(`${bom}\nconst n = u["lerPagina"](q);`)).toEqual(["fila-numerada: \"lerPagina\""]);
    // Nome e chave numerados, e a URL montada à mão.
    expect(fila(`${bom}\nconst paginaPendencias = 2;`)).toEqual(["fila-numerada: paginaPendencias"]);
    expect(fila(`${bom}\nconst h = hrefLista("/f", { pagina: 2 });`)).toEqual(["fila-numerada: pagina"]);
    expect(fila(`${bom}\nconst h = hrefLista("/f", { ["pagina"]: 2 });`)).toEqual(["fila-numerada: \"pagina\""]);
    expect(fila(`${bom}\nconst h = "/f?pagina=2";`)).toEqual(["fila-numerada: \"/f?pagina=2\""]);
    expect(fila(`${bom}\nconst h = \`/f?modo=x&pagina=\${n + 1}\`;`)).toEqual(["fila-numerada: `/f?modo=x&pagina=${"]);
  });

  it("componente mostrado pela tela também é conferido (até três níveis)", () => {
    const lista = "export function Lista() { return <Paginacao pagina={2} temProxima href={h} rotulo=\"r\" />; }";
    expect(fila(`import { Lista } from "./Lista";\n${bom.replace("<section>", "<section><Lista />")}`, { "src/app/f/Lista.tsx": lista }))
      .toEqual(["fila-numerada: src/app/f/Lista.tsx | Paginacao", "fila-numerada: src/app/f/Lista.tsx | pagina"]);
    // <PaginacaoFila> num componente mostrado vale como navegação da fila.
    const semNav = bom.replace(NAV, "<Navegacao />");
    expect(fila(`import { Navegacao } from "./Navegacao";\n${semNav}`, { "src/app/f/Navegacao.tsx": "import { PaginacaoFila } from \"@/components/PaginacaoFila\";\nexport function Navegacao() { return <PaginacaoFila anterior={null} proxima={null} href={h} rotulo=\"r\" />; }" })).toEqual([]);
  });

  it("tela de fila sem <PaginacaoFila> ou sem ler o cursor é acusada; arquivo ausente falha fechado", () => {
    expect(fila(bom.replace(NAV, "<ul />"))).toEqual(["fila-sem-cursor: <PaginacaoFila>"]);
    expect(fila(bom.replace("lerNavegacao(await searchParams)", "{ depois: q.depois }"))).toEqual(["fila-sem-cursor: lerNavegacao"]);
    expect(casosDaFila("src/app/nao/existe.tsx", virtual({}))).toEqual([{ arquivo: "src/app/nao/existe.tsx", regra: "fila-sem-cursor", trecho: "arquivo não encontrado" }]);
  });

  it("consulta da fila: lerPaginaDaFila e nada de janela numerada, skip ou OFFSET no corpo da função", () => {
    const ok = "export async function listarFila(input) { return lerPaginaDaFila(nav, 20, (l, take) => prisma.x.findMany({ where: corteDoId(l, \"asc\"), take }), (r) => r.id); }";
    expect(consulta(ok)).toEqual([]);
    expect(consulta("export async function listarFila(input) { const { skip, take } = janelaDaPagina(input.pagina, 20); return prisma.x.findMany({ skip, take }); }"))
      .toEqual(["consulta-numerada: listarFila: janelaDaPagina", "consulta-numerada: listarFila: pagina", "consulta-numerada: listarFila: skip", "consulta-sem-cursor: listarFila: lerPaginaDaFila"]);
    expect(consulta(ok.replace("take })", "take, skip: 20 })"))).toEqual(["consulta-numerada: listarFila: skip"]);
    expect(consulta(`${ok.slice(0, -1)} const r = await tx.$queryRaw\`SELECT 1 LIMIT \${t} OFFSET \${o}\`; }`)).toEqual(["consulta-numerada: listarFila: } OFFSET ${"]);
    // Helper local com janela numerada não é seguido (limite declarado); a função tem de existir.
    expect(consulta(`function aux() { return janelaDaPagina(1, 2); }\n${ok}`)).toEqual([]);
    expect(consulta("export async function outra() {}")).toEqual(["consulta-sem-cursor: listarFila: função não encontrada"]);
    expect(consulta("export const listarFila = async () => prisma.x.findMany({ skip: 0 });")).toEqual(["consulta-numerada: listarFila: skip", "consulta-sem-cursor: listarFila: lerPaginaDaFila"]);
  });
});

describe("paginação nos dois sentidos — telas", () => {
  const todosOsCasos = telas().flatMap((arquivo) => casosDoArquivo(arquivo, lerDoDisco));

  it("nenhuma lista paginada só anda para frente (ou é exceção ancorada: arquivo + trecho)", () => {
    const casadas = new Map<number, number>();
    const soltos: string[] = [];
    for (const c of todosOsCasos) {
      const i = EXCECOES_PAGINACAO.findIndex((e) => e.arquivo === c.arquivo && e.trecho === c.trecho);
      if (i >= 0) { casadas.set(i, (casadas.get(i) ?? 0) + 1); continue; }
      soltos.push(`${c.arquivo} | ${c.regra} | ${c.trecho} | chaves: ${c.chaves.join(", ")}`);
    }
    expect(soltos).toEqual([]);
    // Cada exceção casa com exatamente um caso: vencida (0) ou ampla demais (2+) falha.
    const fora = EXCECOES_PAGINACAO.map((e, i) => ({ vezes: casadas.get(i) ?? 0, e })).filter((x) => x.vezes !== 1).map((x) => `${x.vezes}× ${x.e.arquivo} | ${x.e.trecho}`);
    expect(fora).toEqual([]);
  });

  it("exceções: motivo dito e cópia literal das âncoras", () => {
    expect(EXCECOES_PAGINACAO.filter((e) => e.motivo.trim().length < 20)).toEqual([]);
    expect(EXCECOES_PAGINACAO.map((e) => `${e.arquivo} | ${e.trecho}`)).toEqual([...ANCORAS]);
  });

  it("a medição (scripts/medicao-ux, métrica 7.5) e a trava chegam ao mesmo conjunto", () => {
    const medidos = listar("src").filter((f) => f.endsWith(".tsx") && !ehTeste(f) && soParaFrente(readFileSync(f, "utf8")));
    expect(medidos).toEqual([...SO_PARA_FRENTE_MEDIDOS]);
    const comExcecao = new Set(EXCECOES_PAGINACAO.map((e) => e.arquivo));
    const naoPaginacao = new Set(NAO_E_PAGINACAO.map((n) => n.arquivo));
    // Cada arquivo medido é pendência ancorada aqui ou texto de domínio sem link de página.
    expect(medidos.filter((f) => !comExcecao.has(f) && !naoPaginacao.has(f))).toEqual([]);
    for (const { arquivo } of NAO_E_PAGINACAO) {
      expect(medidos, arquivo).toContain(arquivo);
      expect(linksDePagina(readFileSync(arquivo, "utf8")).links, arquivo).toEqual([]);
      expect(casosDoArquivo(arquivo, lerDoDisco), arquivo).toEqual([]);
    }
  });

  it("as telas migradas mostram <Paginacao> e nenhuma delas é exceção", () => {
    for (const arquivo of MIGRADAS) expect(linksDePagina(readFileSync(arquivo, "utf8")).paginacao, arquivo).toBe(true);
    expect(MIGRADAS.filter((f) => EXCECOES_PAGINACAO.some((e) => e.arquivo === f))).toEqual([]);
  });

  it("filas de trabalho: cursor nos dois sentidos na tela e na consulta, nunca página numerada (ou exceção ancorada)", () => {
    expect(FILAS.map((f) => `${f.tela} | ${f.consulta.arquivo} | ${f.consulta.funcao}`)).toEqual([...FILAS_LITERAL]);
    // Fila e lista são classificações exclusivas; as 28 telas da #158 estão numa das duas.
    expect(FILAS.filter((f) => MIGRADAS.includes(f.tela))).toEqual([]);
    expect(FILAS.length + MIGRADAS.length).toBe(28);
    const todos = FILAS.flatMap((f) => [...casosDaFila(f.tela, lerDoDisco), ...casosDaConsulta(f.consulta.arquivo, f.consulta.funcao, lerDoDisco)]);
    const casadas = new Map<number, number>();
    const soltos: string[] = [];
    for (const c of todos) {
      const i = EXCECOES_FILA.findIndex((e) => e.arquivo === c.arquivo && e.trecho === c.trecho);
      if (i >= 0) { casadas.set(i, (casadas.get(i) ?? 0) + 1); continue; }
      soltos.push(`${c.arquivo} | ${c.regra} | ${c.trecho}`);
    }
    expect(soltos).toEqual([]);
    expect(EXCECOES_FILA.map((e, i) => ({ vezes: casadas.get(i) ?? 0, e })).filter((x) => x.vezes !== 1).map((x) => `${x.vezes}× ${x.e.arquivo} | ${x.e.trecho}`)).toEqual([]);
    expect(EXCECOES_FILA.filter((e) => e.motivo.trim().length < 20)).toEqual([]);
    expect(EXCECOES_FILA.map((e) => `${e.arquivo} | ${e.trecho}`)).toEqual([...ANCORAS_FILA]);
  });
});
