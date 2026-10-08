import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import * as MENSAGENS from "@/lib/mensagens";

// Trava do feedback separado (docs/43-medicao-auditoria-ux.md §6 item 2; docs/42-auditoria-frontend-ux.md E3).
// Havia ~50 formulários com UMA mensagem para sucesso e erro — `setMensagem(r.ok ? "Salvo." : r.erro)`
// mostrado num <MensagemStatus> (role="status", sem cor): o erro não era anunciado como alerta nem
// pintado de erro, e "Resultado não confirmado" saía igual a "Salvo". Agora o erro vai para role="alert"
// e o sucesso para role="status" (useAcaoCliente + FeedbackAcao). E `window.location.reload()` deu lugar
// a mensagem + router.refresh().
//
// Pelo AST do TypeScript, em todo arquivo de produção de src/app e src/components:
// A. ESTADO DE MENSAGEM não recebe erro. É estado de mensagem o `useState` cujo nome está na lista
//    PALAVRAS_DE_MENSAGEM ou cujo valor aparece numa região de status (B). Cada chamada do setter é
//    seguida pelo fluxo do valor — ternário, `&&`/`||`/`??`/`+`, template, constante e `let` (com as
//    atribuições), desestruturação, função local (o que ela devolve), parâmetro de função local (cada
//    chamada dela no arquivo) — e acusa erro (`.erro`/`.message`/`.falha`, constante MSG_*INCERT*,
//    variável de catch, nome de erro, texto que começa como erro) e o que não dá para seguir (prop do
//    componente, parâmetro de função anônima, função passada adiante, setter passado como valor).
// B. REGIÃO DE STATUS não recebe erro: <MensagemStatus texto/progresso>, <FeedbackAcao sucesso/progresso>
//    (também renomeados no import, por namespace, por constante ou por createElement), filhos de elemento
//    com role="status"/aria-live="polite". Spread de props e uso do componente como valor falham fechado.
// C. O sucesso passado a `.executar(acao, sucesso)` (useAcaoCliente) não é erro.
// D. Nada recarrega a página: `.reload`, `{ reload }`, `history.go`, atribuição a `location`/`location.href`,
//    `location.assign`/`location.replace`.
// E. Arquivo que não analisa (erro de sintaxe) e `useState` sem desestruturar falham fechado.
//
// Exceções: arquivo + trecho exato (espaços normalizados) + motivo; cada uma casa com exatamente um achado,
// e a lista é comparada com uma cópia literal (acrescentar exceção exige mexer nos dois lugares).

const RAIZES = ["src/app", "src/components"];

/** Palavras que fazem de um estado uma mensagem para a pessoa (nome inteiro, prefixo camelCase ou sufixo). */
export const PALAVRAS_DE_MENSAGEM = ["mensagem", "msg", "aviso", "nota", "sucesso", "feito", "retorno", "feedback", "resultado", "ok"];
/** Palavras de estado/identificador de erro (vai para role="alert"). */
export const PALAVRAS_DE_ERRO = ["erro", "error", "falha", "alerta"];
/** Propriedades que carregam erro: r.erro, e.message, x.falha… */
export const PROPRIEDADES_DE_ERRO = ["erro", "error", "message", "falha"];
/** Começo de texto que é de erro (comparado sem caixa e sem acento). */
export const PREFIXOS_DE_ERRO = ["nao foi possivel", "falha", "erro", "resultado nao confirmado"];
/** Constante de resultado incerto (src/lib/mensagens.ts). */
export const CONSTANTE_DE_INCERTEZA = /^MSG_\w*INCERT/;
/** Componentes de região polite e as props que vão para ela. */
export const REGIOES_DE_STATUS: Record<string, readonly string[]> = { MensagemStatus: ["texto", "progresso"], FeedbackAcao: ["sucesso", "progresso"] };
/** Fábricas de elemento que recebem o componente como primeiro argumento. */
export const FABRICAS_DE_ELEMENTO = ["createElement", "jsx", "jsxs", "jsxDEV"];
/** Passos de valor seguidos antes de desistir (falha fechada). */
const PROFUNDIDADE_MAXIMA = 12;

const capital = (p: string) => p[0].toUpperCase() + p.slice(1);
/** Chave própria do mapa de regiões (`"toString" in {}` é true; aqui não). */
const ehRegiao = (nome: string) => Object.prototype.hasOwnProperty.call(REGIOES_DE_STATUS, nome);
const ESTADO_DE_MENSAGEM = new RegExp(`^(?:${PALAVRAS_DE_MENSAGEM.join("|")})(?:[A-Z]\\w*)?$|(?:${PALAVRAS_DE_MENSAGEM.map(capital).join("|")})$`);
const NOME_DE_ERRO = new RegExp(PALAVRAS_DE_ERRO.join("|"), "i");
const PROPRIEDADE_DE_ERRO = new RegExp(PROPRIEDADES_DE_ERRO.join("|"), "i");
const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const textoDeErro = (t: string) => { const s = semAcento(t).trim(); return PREFIXOS_DE_ERRO.some((p) => s.startsWith(p)); };
const normaliza = (t: string) => t.replace(/\s+/g, " ").trim();

export type Achado = { arquivo: string; trecho: string; problema: string };
type Veredito = { tipo: "erro" | "opaco"; motivo: string } | null;

function desembrulha(e: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) || ts.isSatisfiesExpression(e) || ts.isAwaitExpression(e) || ts.isTypeAssertionExpression(e)) e = e.expression;
  return e;
}

// ---------------------------------------------------------------------------------------------------
// Escopo: a declaração de um nome, procurada de dentro para fora (bloco, função, catch, for, arquivo).
// ---------------------------------------------------------------------------------------------------
type Funcao = ts.SignatureDeclaration & { body?: ts.Node };
type Declaracao =
  | { tipo: "variavel"; no: ts.VariableDeclaration; nome: ts.Identifier; elemento: ts.BindingElement | null; escopo: ts.Node }
  | { tipo: "parametro"; funcao: Funcao; indice: number; nome: ts.Identifier; elemento: ts.BindingElement | null }
  | { tipo: "funcao"; no: ts.FunctionDeclaration | ts.FunctionExpression }
  | { tipo: "catch"; nome: ts.Identifier }
  | { tipo: "import"; nome: ts.Identifier };

/** O identificador com esse nome dentro do padrão de ligação (e o BindingElement dele, se desestruturado). */
function ligacaoEm(padrao: ts.BindingName, nome: string): { id: ts.Identifier; elemento: ts.BindingElement | null } | null {
  if (ts.isIdentifier(padrao)) return padrao.text === nome ? { id: padrao, elemento: null } : null;
  for (const el of padrao.elements) {
    if (ts.isOmittedExpression(el)) continue;
    if (ts.isIdentifier(el.name)) { if (el.name.text === nome) return { id: el.name, elemento: el }; continue; }
    const dentro = ligacaoEm(el.name, nome);
    if (dentro) return dentro;
  }
  return null;
}

function declaracoesDoBloco(declaracoes: readonly ts.Statement[], nome: string, escopo: ts.Node): Declaracao | null {
  for (const s of declaracoes) {
    if (ts.isVariableStatement(s)) for (const d of s.declarationList.declarations) {
      const l = ligacaoEm(d.name, nome);
      if (l) return { tipo: "variavel", no: d, nome: l.id, elemento: l.elemento, escopo };
    }
    if (ts.isFunctionDeclaration(s) && s.name?.text === nome) return { tipo: "funcao", no: s };
    if (ts.isImportDeclaration(s) && s.importClause) {
      const c = s.importClause;
      if (c.name?.text === nome) return { tipo: "import", nome: c.name };
      const nb = c.namedBindings;
      if (nb && ts.isNamespaceImport(nb) && nb.name.text === nome) return { tipo: "import", nome: nb.name };
      if (nb && ts.isNamedImports(nb)) for (const e of nb.elements) if (e.name.text === nome) return { tipo: "import", nome: e.name };
    }
  }
  return null;
}

export function resolver(id: ts.Identifier): Declaracao | null {
  const nome = id.text;
  for (let n: ts.Node | undefined = id.parent; n; n = n.parent) {
    if (ts.isSourceFile(n) || ts.isBlock(n) || ts.isModuleBlock(n) || ts.isCaseClause(n) || ts.isDefaultClause(n)) {
      const d = declaracoesDoBloco(n.statements, nome, n);
      if (d) return d;
    }
    if (ts.isCatchClause(n) && n.variableDeclaration) {
      const l = ligacaoEm(n.variableDeclaration.name, nome);
      if (l) return { tipo: "catch", nome: l.id };
    }
    if ((ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n)) && n.initializer && ts.isVariableDeclarationList(n.initializer)) {
      for (const d of n.initializer.declarations) {
        const l = ligacaoEm(d.name, nome);
        if (l) return { tipo: "variavel", no: d, nome: l.id, elemento: l.elemento, escopo: n };
      }
    }
    if (ts.isFunctionLike(n)) {
      const f = n as Funcao;
      for (const [indice, p] of f.parameters.entries()) {
        const l = ligacaoEm(p.name, nome);
        if (l) return { tipo: "parametro", funcao: f, indice, nome: l.id, elemento: l.elemento };
      }
      if (ts.isFunctionExpression(n) && n.name?.text === nome) return { tipo: "funcao", no: n };
    }
  }
  return null;
}

/** Nó que identifica a declaração (para comparar duas resoluções). */
const alvoDe = (d: Declaracao | null): ts.Node | null => (!d ? null : d.tipo === "funcao" ? d.no : d.nome);

/** Identificador em posição de nome (propriedade, atributo, declaração) — não é leitura de valor. */
function ehNome(n: ts.Identifier): boolean {
  const p = n.parent;
  return (ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isPropertyAssignment(p) && p.name === n) || ts.isJsxAttribute(p)
    || (ts.isBindingElement(p) && (p.propertyName === n || p.name === n)) || (ts.isVariableDeclaration(p) && p.name === n)
    || (ts.isParameter(p) && p.name === n) || ((ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isMethodDeclaration(p)) && p.name === n)
    || ts.isImportSpecifier(p) || ts.isImportClause(p) || ts.isNamespaceImport(p) || ts.isPropertySignature(p) || ts.isTypeReferenceNode(p)
    || (ts.isQualifiedName(p)) || ts.isJsxClosingElement(p) || ts.isLabeledStatement(p);
}

/**
 * Nome pelo qual a função é chamada no arquivo: o da declaração, ou o da constante que a recebe
 * (`const nome = () => …`, `const nome = function interno() {…}`). Função passada direto como argumento
 * (mesmo nomeada, `p.then(function f(t) {…})`) não tem chamador visível: null (anônima).
 */
function nomeDaFuncao(f: ts.Node): ts.Identifier | null {
  if (ts.isFunctionDeclaration(f)) return f.name ?? null;
  const p = f.parent;
  if (p && ts.isVariableDeclaration(p) && p.initializer === f && ts.isIdentifier(p.name)) return p.name;
  return null;
}

/** Componente React: função cujo nome começa por maiúscula (o primeiro parâmetro são as props). */
const ehComponente = (f: ts.Node) => { const n = nomeDaFuncao(f); return !!n && /^[A-Z]/.test(n.text); };

/** Função local por trás de um callee (`f(…)` com `function f` ou `const f = () => …`). */
function funcaoLocal(callee: ts.Expression): Funcao | null {
  const e = desembrulha(callee);
  if (!ts.isIdentifier(e)) return null;
  const d = resolver(e);
  if (d?.tipo === "funcao") return d.no;
  if (d?.tipo === "variavel" && !d.elemento && d.no.initializer) {
    const i = desembrulha(d.no.initializer);
    if (ts.isArrowFunction(i) || ts.isFunctionExpression(i)) return i;
  }
  return null;
}

/** Expressões devolvidas por uma função (corpo conciso ou `return`s que não estão em funções internas). */
function retornos(f: Funcao): ts.Expression[] {
  const corpo = f.body;
  if (!corpo) return [];
  if (!ts.isBlock(corpo)) return [corpo as ts.Expression];
  const saida: ts.Expression[] = [];
  const visita = (n: ts.Node) => {
    if (n !== corpo && ts.isFunctionLike(n)) return;
    if (ts.isReturnStatement(n) && n.expression) saida.push(n.expression);
    ts.forEachChild(n, visita);
  };
  visita(corpo);
  return saida;
}

/** Todas as leituras do nome que resolvem para a mesma declaração (menos a própria declaração). */
function referencias(sf: ts.SourceFile, alvo: ts.Node, nome: string): ts.Identifier[] {
  const saida: ts.Identifier[] = [];
  const visita = (n: ts.Node) => {
    if (ts.isIdentifier(n) && n.text === nome && n !== alvo && !ehNome(n) && alvoDe(resolver(n)) === alvo) saida.push(n);
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return saida;
}

/** O identificador na raiz de `a.b[c].d` (null se a raiz não é um nome). */
function raizDe(e: ts.Expression): ts.Identifier | null {
  let x = desembrulha(e);
  while (ts.isPropertyAccessExpression(x) || ts.isElementAccessExpression(x) || ts.isCallExpression(x)) x = desembrulha(x.expression);
  return ts.isIdentifier(x) ? x : null;
}

/** O nome vem das props de um componente (primeiro parâmetro, direto, desestruturado ou `const { a } = props`)? */
function ehDasProps(id: ts.Identifier, profundidade = 0): boolean {
  const d = resolver(id);
  if (!d || profundidade > PROFUNDIDADE_MAXIMA) return false;
  if (d.tipo === "parametro") return d.indice === 0 && ehComponente(d.funcao);
  if (d.tipo === "variavel" && d.no.initializer) {
    const r = raizDe(d.no.initializer);
    return !!r && ehDasProps(r, profundidade + 1);
  }
  return false;
}

// ---------------------------------------------------------------------------------------------------
// O valor pode ser erro? Leitura sintática (qualquer ponto da expressão) + fluxo do valor.
// ---------------------------------------------------------------------------------------------------
function erroSintatico(raiz: ts.Node): string | null {
  let achado: string | null = null;
  const visita = (n: ts.Node): void => {
    if (achado) return;
    if (ts.isPropertyAccessExpression(n) && PROPRIEDADE_DE_ERRO.test(n.name.text)) { achado = `lê .${n.name.text}`; return; }
    if (ts.isElementAccessExpression(n)) {
      const a = desembrulha(n.argumentExpression);
      if (ts.isStringLiteralLike(a) && PROPRIEDADE_DE_ERRO.test(a.text)) { achado = `lê ["${a.text}"]`; return; }
    }
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isJsxText(n)) && textoDeErro(n.text)) {
      achado = `texto de erro "${normaliza(n.text).slice(0, 40)}"`; return;
    }
    if (ts.isIdentifier(n) && !ehNome(n)) {
      if (CONSTANTE_DE_INCERTEZA.test(n.text)) { achado = `usa ${n.text}`; return; }
      if (NOME_DE_ERRO.test(n.text)) { achado = `usa ${n.text}`; return; }
      if (resolver(n)?.tipo === "catch") { achado = `usa a variável do catch (${n.text})`; return; }
    }
    ts.forEachChild(n, visita);
  };
  visita(raiz);
  return achado;
}

/**
 * O valor pode ser erro (veredito "erro") ou não dá para seguir de onde ele vem ("opaco")? `soErro`: o
 * valor é só um PEDAÇO do texto (interpolação, concatenação, retorno de função local que monta o texto) —
 * aí dado de origem desconhecida (número, nome, data) é normal e só o erro acusa.
 */
export function verificar(e: ts.Expression, prof = 0, vistos = new Set<ts.Node>(), soErro = false): Veredito {
  const opaco = (motivo: string): Veredito => (soErro ? null : { tipo: "opaco", motivo });
  if (prof > PROFUNDIDADE_MAXIMA) return opaco("cadeia de valores longa demais");
  if (vistos.has(e)) return null;
  vistos.add(e);
  const sint = erroSintatico(e);
  if (sint) return { tipo: "erro", motivo: sint };
  const seguir = (x: ts.Expression, pedaco = soErro) => verificar(x, prof + 1, vistos, pedaco);
  const x = desembrulha(e);
  if (ts.isConditionalExpression(x)) return seguir(x.whenTrue) ?? seguir(x.whenFalse);
  if (ts.isBinaryExpression(x)) {
    const op = x.operatorToken.kind;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.CommaToken) return seguir(x.right);
    if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) return seguir(x.left) ?? seguir(x.right);
    if (op === ts.SyntaxKind.PlusToken) return seguir(x.left, true) ?? seguir(x.right, true);
    return null;
  }
  if (ts.isTemplateExpression(x)) {
    for (const s of x.templateSpans) { const v = seguir(s.expression, true); if (v) return v; }
    return null;
  }
  if (ts.isIdentifier(x)) return identificador(x, seguir, opaco);
  if (ts.isPropertyAccessExpression(x) || ts.isElementAccessExpression(x)) {
    const r = raizDe(x);
    return r && ehDasProps(r) ? opaco(`${r.text} vem das props do componente`) : null;
  }
  if (ts.isCallExpression(x)) {
    const f = funcaoLocal(x.expression);
    if (!f) return null;
    for (const r of retornos(f)) { const v = seguir(r, true); if (v) return v; }
    return null;
  }
  if (ts.isArrowFunction(x) || ts.isFunctionExpression(x)) {
    for (const r of retornos(x)) { const v = seguir(r, true); if (v) return v; }
    return null;
  }
  return null;
}

function identificador(id: ts.Identifier, seguir: (x: ts.Expression, pedaco?: boolean) => Veredito, opaco: (motivo: string) => Veredito): Veredito {
  if (id.text === "undefined") return null;
  const d = resolver(id);
  if (!d || d.tipo === "funcao" || d.tipo === "import") return null;
  if (d.tipo === "catch") return { tipo: "erro", motivo: `usa a variável do catch (${id.text})` };
  if (d.elemento) {
    // Desestruturado: a chave diz o que é (`{ erro: t }`); chave computada não é verificável.
    const chave = d.elemento.propertyName ?? d.elemento.name;
    if (ts.isComputedPropertyName(chave)) return opaco(`${id.text} vem de chave computada`);
    if ((ts.isIdentifier(chave) || ts.isStringLiteral(chave)) && PROPRIEDADE_DE_ERRO.test(chave.text)) return { tipo: "erro", motivo: `${id.text} é o campo "${chave.text}"` };
  }
  if (d.tipo === "variavel") {
    if (d.elemento) {
      // `const [a] = r.erro.split(…)`: o que se desestrutura também é lido (só o erro conta).
      const v = d.no.initializer ? seguir(d.no.initializer, true) : null;
      if (v) return v;
      const r = d.no.initializer ? raizDe(d.no.initializer) : null;
      return r && ehDasProps(r) ? opaco(`${id.text} vem das props do componente`) : null;
    }
    const fontes: ts.Expression[] = d.no.initializer ? [d.no.initializer] : [];
    const visita = (n: ts.Node) => {
      if (ts.isBinaryExpression(n) && ts.isIdentifier(n.left) && n.left.text === id.text && n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
        && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment && alvoDe(resolver(n.left)) === d.nome) fontes.push(n.right);
      ts.forEachChild(n, visita);
    };
    visita(d.escopo);
    if (fontes.length === 0) return opaco(`${id.text} sem valor verificável`);
    for (const f of fontes) { const v = seguir(f); if (v) return v; }
    return null;
  }
  // Parâmetro.
  if (ehComponente(d.funcao)) return opaco(`${id.text} é prop do componente`);
  if (d.elemento) return opaco(`${id.text} vem de parâmetro desestruturado`);
  const nome = nomeDaFuncao(d.funcao);
  if (!nome) return opaco(`${id.text} é parâmetro de função anônima`);
  // Alvo da resolução dos chamadores: a declaração da função, ou o nome da constante que a recebe.
  const alvo: ts.Node = ts.isFunctionDeclaration(d.funcao) ? d.funcao : nome;
  for (const u of referencias(id.getSourceFile(), alvo, nome.text)) {
    const p = u.parent;
    if (!(ts.isCallExpression(p) && p.expression === u)) return opaco(`${nome.text} é passada adiante; o parâmetro ${id.text} não é verificável`);
    if (p.arguments.slice(0, d.indice + 1).some((a) => ts.isSpreadElement(a))) return opaco(`${nome.text} é chamada com spread`);
    const arg = p.arguments[d.indice];
    if (arg) { const v = seguir(arg); if (v) return v; }
  }
  return null;
}

/** Identificadores em posição de VALOR (ramos do ternário, operandos de `&&`/`||`/`??`/`+`, interpolações). */
function identificadoresDeValor(e: ts.Expression, saida: ts.Identifier[] = []): ts.Identifier[] {
  const x = desembrulha(e);
  if (ts.isConditionalExpression(x)) { identificadoresDeValor(x.whenTrue, saida); identificadoresDeValor(x.whenFalse, saida); }
  else if (ts.isBinaryExpression(x)) {
    const op = x.operatorToken.kind;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.CommaToken) identificadoresDeValor(x.right, saida);
    else if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.PlusToken) { identificadoresDeValor(x.left, saida); identificadoresDeValor(x.right, saida); }
  } else if (ts.isTemplateExpression(x)) for (const s of x.templateSpans) identificadoresDeValor(s.expression, saida);
  else if (ts.isIdentifier(x)) saida.push(x);
  return saida;
}

// ---------------------------------------------------------------------------------------------------
// A análise de um arquivo.
// ---------------------------------------------------------------------------------------------------
type EstadoUseState = { valor: ts.Identifier | null; setter: ts.Identifier | null; no: ts.CallExpression };

const ehUseState = (n: ts.Node): n is ts.CallExpression => ts.isCallExpression(n) && (() => {
  const c = desembrulha(n.expression);
  return (ts.isIdentifier(c) && c.text === "useState") || (ts.isPropertyAccessExpression(c) && c.name.text === "useState");
})();

export function analisar(fonte: string, arquivo = "virtual.tsx"): Achado[] {
  const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, arquivo.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.TSX);
  const diagnosticos = (sf as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];
  if (diagnosticos.length) return [{ arquivo, trecho: "(arquivo)", problema: "não foi possível analisar o arquivo (erro de sintaxe): falha fechada" }];
  const achados: Achado[] = [];
  const vistosTrecho = new Set<string>();
  const acusa = (no: ts.Node, problema: string) => {
    const trecho = normaliza(no.getText(sf));
    const chave = `${no.pos}:${trecho}`;
    if (vistosTrecho.has(chave)) return;
    vistosTrecho.add(chave);
    achados.push({ arquivo, trecho, problema });
  };

  // Nomes locais dos componentes de região de status (import renomeado, namespace, constante).
  const aliases = new Map<string, string>();
  const canonico = (e: ts.Node): string | null => {
    if (ts.isIdentifier(e)) return aliases.get(e.text) ?? null;
    if (ts.isPropertyAccessExpression(e)) return ehRegiao(e.name.text) ? e.name.text : null;
    if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e)) return canonico(e.expression);
    return null;
  };
  const coletaAliases = (n: ts.Node) => {
    if (ts.isImportSpecifier(n) && ehRegiao((n.propertyName ?? n.name).text)) aliases.set(n.name.text, (n.propertyName ?? n.name).text);
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      const c = canonico(n.initializer);
      if (c) aliases.set(n.name.text, c);
    }
    ts.forEachChild(n, coletaAliases);
  };
  coletaAliases(sf);
  coletaAliases(sf); // segunda passada: constante de constante

  // Expressões que vão para uma região de status (para B e para marcar estados de mensagem).
  const regioes: { no: ts.Node; expr: ts.Expression | null; soErro: boolean }[] = [];
  const atributoDe = (props: readonly string[], a: ts.JsxAttributeLike) => {
    if (ts.isJsxSpreadAttribute(a)) { regioes.push({ no: a, expr: null, soErro: false }); return; }
    const nome = a.name.getText(sf);
    if (!props.includes(nome) || !a.initializer) return;
    const ini = a.initializer;
    const expr = ts.isJsxExpression(ini) ? ini.expression ?? null : ts.isStringLiteral(ini) ? ini : null;
    if (expr) regioes.push({ no: a, expr, soErro: false });
  };
  const literalDoAtributo = (attrs: ts.JsxAttributes, nome: string) => {
    for (const a of attrs.properties) {
      if (!ts.isJsxAttribute(a) || a.name.getText(sf) !== nome || !a.initializer) continue;
      if (ts.isStringLiteral(a.initializer)) return a.initializer.text;
      if (ts.isJsxExpression(a.initializer) && a.initializer.expression && ts.isStringLiteralLike(a.initializer.expression)) return a.initializer.expression.text;
    }
    return null;
  };
  const coletaRegioes = (n: ts.Node) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const c = canonico(n.tagName);
      if (c) for (const a of n.attributes.properties) atributoDe(REGIOES_DE_STATUS[c], a);
      const nativo = ts.isIdentifier(n.tagName) && /^[a-z]/.test(n.tagName.text);
      if (nativo && ts.isJsxOpeningElement(n) && (literalDoAtributo(n.attributes, "role") === "status" || literalDoAtributo(n.attributes, "aria-live") === "polite")) {
        for (const filho of (n.parent as ts.JsxElement).children) if (ts.isJsxExpression(filho) && filho.expression) regioes.push({ no: filho, expr: filho.expression, soErro: true });
      }
    }
    if (ts.isCallExpression(n) && n.arguments.length > 0) {
      const callee = desembrulha(n.expression);
      const nomeCallee = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : "";
      const c = FABRICAS_DE_ELEMENTO.includes(nomeCallee) ? canonico(n.arguments[0]) : null;
      if (c) {
        const props = n.arguments[1] ? desembrulha(n.arguments[1]) : null;
        if (!props) { /* sem props: nada vai para a região */ }
        else if (!ts.isObjectLiteralExpression(props)) regioes.push({ no: n, expr: null, soErro: false });
        else for (const p of props.properties) {
          if (ts.isSpreadAssignment(p)) regioes.push({ no: p, expr: null, soErro: false });
          else if (ts.isPropertyAssignment(p) && REGIOES_DE_STATUS[c].includes(p.name.getText(sf).replace(/^["']|["']$/g, ""))) regioes.push({ no: p, expr: p.initializer, soErro: false });
          else if (ts.isShorthandPropertyAssignment(p) && REGIOES_DE_STATUS[c].includes(p.name.text)) regioes.push({ no: p, expr: p.name, soErro: false });
          else if (!ts.isPropertyAssignment(p) && !ts.isShorthandPropertyAssignment(p)) regioes.push({ no: p, expr: null, soErro: false });
        }
      }
    }
    ts.forEachChild(n, coletaRegioes);
  };
  coletaRegioes(sf);

  // B — região de status.
  for (const r of regioes) {
    if (!r.expr) { acusa(r.no, "props da região de status não verificáveis (spread ou objeto opaco): falha fechada"); continue; }
    const v = verificar(r.expr);
    if (v?.tipo === "erro") acusa(r.no, `região de status (role="status") recebe erro (${v.motivo}) — erro vai para role="alert" (FeedbackAcao erro)`);
    else if (v?.tipo === "opaco" && !r.soErro) acusa(r.no, `região de status recebe valor não verificável (${v.motivo})`);
  }

  // Componente de região usado como valor (fora de tag JSX, import, alias e fábrica de elemento).
  const usoComoValor = (n: ts.Node) => {
    if ((ts.isIdentifier(n) && aliases.has(n.text)) || (ts.isPropertyAccessExpression(n) && ehRegiao(n.name.text) && ts.isIdentifier(n.expression) && resolver(n.expression)?.tipo === "import")) {
      const p = n.parent;
      const ok = (ts.isIdentifier(n) && ehNome(n)) || ((ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p) || ts.isJsxClosingElement(p)) && p.tagName === n)
        || (ts.isVariableDeclaration(p) && p.initializer === n && ts.isIdentifier(p.name) && aliases.has(p.name.text))
        || (ts.isCallExpression(p) && p.arguments[0] === n && FABRICAS_DE_ELEMENTO.includes((() => { const c = desembrulha(p.expression); return ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : ""; })()))
        || ts.isExportSpecifier(p) || (ts.isPropertyAccessExpression(n) && ts.isPropertyAccessExpression(p) && p.expression === n);
      if (!ok) acusa(p, `${canonico(n)} usado como valor: o que ele recebe não é verificável (falha fechada)`);
      if (ts.isPropertyAccessExpression(n)) return;
    }
    ts.forEachChild(n, usoComoValor);
  };
  usoComoValor(sf);

  // A — estados de mensagem.
  const estados: EstadoUseState[] = [];
  const coletaEstados = (n: ts.Node) => {
    if (ehUseState(n)) {
      let p: ts.Node = n.parent;
      while (ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isNonNullExpression(p)) p = p.parent;
      if (ts.isVariableDeclaration(p) && ts.isArrayBindingPattern(p.name)) {
        const [v, s] = p.name.elements;
        const setter = s && !ts.isOmittedExpression(s) ? s : null;
        if (setter && !ts.isIdentifier(setter.name)) acusa(p, "setter do useState desestruturado de forma não verificável: falha fechada");
        else estados.push({ valor: v && !ts.isOmittedExpression(v) && ts.isIdentifier(v.name) ? v.name : null, setter: setter ? setter.name as ts.Identifier : null, no: n });
      } else acusa(n, "useState sem desestruturar [valor, setter]: o setter não é verificável (falha fechada)");
    }
    ts.forEachChild(n, coletaEstados);
  };
  coletaEstados(sf);

  // Estado cujo VALOR vai para a região (não a condição: `{salvo ? "Salvo." : null}` não faz de `salvo` mensagem).
  const naRegiao = new Set<ts.Node>();
  for (const r of regioes) if (r.expr) for (const id of identificadoresDeValor(r.expr)) {
    const a = alvoDe(resolver(id));
    if (a) naRegiao.add(a);
  }

  for (const e of estados) {
    if (!e.setter) continue;
    const nomeDoValor = e.valor?.text ?? e.setter.text.replace(/^set/, "").replace(/^./, (c) => c.toLowerCase());
    if (NOME_DE_ERRO.test(nomeDoValor)) continue; // estado de erro: vai para role="alert"
    const deMensagem = ESTADO_DE_MENSAGEM.test(nomeDoValor) || (!!e.valor && naRegiao.has(e.valor));
    if (!deMensagem) continue;
    for (const u of referencias(sf, e.setter, e.setter.text)) {
      const p = u.parent;
      if (ts.isCallExpression(p) && p.expression === u) {
        for (const arg of p.arguments) {
          const v = verificar(arg);
          if (v?.tipo === "erro") { acusa(p, `estado de mensagem "${nomeDoValor}" recebe erro (${v.motivo}) — use useAcaoCliente + FeedbackAcao (erro em role="alert")`); break; }
          if (v?.tipo === "opaco") { acusa(p, `estado de mensagem "${nomeDoValor}" recebe valor não verificável (${v.motivo})`); break; }
        }
      } else acusa(ts.isJsxExpression(p) ? p.parent : p, `setter do estado de mensagem "${nomeDoValor}" usado como valor: o que ele recebe não é verificável (falha fechada)`);
    }
  }

  // C — sucesso do executar (useAcaoCliente).
  const coletaExecutar = (n: ts.Node) => {
    if (ts.isCallExpression(n) && n.arguments.length >= 2) {
      const c = desembrulha(n.expression);
      if (ts.isPropertyAccessExpression(c) && c.name.text === "executar") {
        const v = verificar(n.arguments[1]);
        if (v) acusa(n, v.tipo === "erro" ? `sucesso do executar recebe erro (${v.motivo})` : `sucesso do executar não verificável (${v.motivo})`);
      }
    }
    ts.forEachChild(n, coletaExecutar);
  };
  coletaExecutar(sf);

  // D — recarga da página.
  const ultimoNome = (e: ts.Expression): string | null => {
    const x = desembrulha(e);
    if (ts.isIdentifier(x)) return x.text;
    if (ts.isPropertyAccessExpression(x)) return x.name.text;
    if (ts.isElementAccessExpression(x)) { const a = desembrulha(x.argumentExpression); return ts.isStringLiteralLike(a) ? a.text : null; }
    return null;
  };
  /** A expressão lê `location` (o destino é a própria página: recarga disfarçada de navegação). */
  const leLocation = (e: ts.Node): boolean => {
    let tem = false;
    const visita = (m: ts.Node) => {
      if (tem) return;
      if ((ts.isIdentifier(m) && m.text === "location") || (ts.isPropertyAccessExpression(m) && m.name.text === "location")) { tem = true; return; }
      if (ts.isElementAccessExpression(m)) { const a = desembrulha(m.argumentExpression); if (ts.isStringLiteralLike(a) && a.text === "location") { tem = true; return; } }
      ts.forEachChild(m, visita);
    };
    visita(e);
    return tem;
  };
  const coletaRecarga = (n: ts.Node) => {
    if (ts.isPropertyAccessExpression(n) && n.name.text === "reload") acusa(n, "recarrega a página (.reload): use mensagem + router.refresh()");
    if (ts.isElementAccessExpression(n)) { const a = desembrulha(n.argumentExpression); if (ts.isStringLiteralLike(a) && a.text === "reload") acusa(n, "recarrega a página ([\"reload\"]): use mensagem + router.refresh()"); }
    if (ts.isBindingElement(n) && ((n.propertyName && ts.isIdentifier(n.propertyName) && n.propertyName.text === "reload") || (!n.propertyName && ts.isIdentifier(n.name) && n.name.text === "reload"))) acusa(n, "recarrega a página ({ reload }): use mensagem + router.refresh()");
    if (ts.isCallExpression(n)) {
      const c = desembrulha(n.expression);
      if (ts.isPropertyAccessExpression(c) && c.name.text === "go" && ultimoNome(c.expression) === "history") acusa(n, "recarrega a página (history.go): use mensagem + router.refresh()");
      // `location.assign("/outra")` navega; `location.assign(location.href)` recarrega a mesma página.
      if (ts.isPropertyAccessExpression(c) && ["assign", "replace"].includes(c.name.text) && ultimoNome(c.expression) === "location" && n.arguments.some(leLocation)) {
        acusa(n, `recarrega a página (location.${c.name.text} para a própria página): use mensagem + router.refresh()`);
      }
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const alvo = desembrulha(n.left);
      const nome = ultimoNome(alvo);
      const doLocation = nome === "location" || (nome === "href" && (ts.isPropertyAccessExpression(alvo) || ts.isElementAccessExpression(alvo)) && ultimoNome(alvo.expression) === "location");
      if (doLocation && leLocation(n.right)) acusa(n, "atribuir a própria location recarrega a página: use mensagem + router.refresh()");
    }
    ts.forEachChild(n, coletaRecarga);
  };
  coletaRecarga(sf);

  return achados;
}

// ---------------------------------------------------------------------------------------------------
// Exceções (arquivo + trecho exato + motivo) e a varredura.
// ---------------------------------------------------------------------------------------------------
export type Excecao = { arquivo: string; trecho: string; motivo: string };

const PR_PARALELA = "pendência: a PR paralela do ConfirmarAcao (docs/43 §6 item 1) mexe neste arquivo; migrar para useAcaoCliente + FeedbackAcao depois do merge dela";

export const EXCECOES: Excecao[] = [
  {
    arquivo: "src/components/FeedbackAcao.tsx",
    trecho: "texto={sucesso}",
    motivo: "é o par erro/sucesso: o erro sai no <p role=\"alert\"> logo acima; a região polite recebe só a prop `sucesso`, cujo conteúdo esta trava confere em cada tela que usa o FeedbackAcao",
  },
  {
    arquivo: "src/components/FeedbackAcao.tsx",
    trecho: "progresso={progresso}",
    motivo: "texto de progresso (\"Processando…\") repassado à mesma região polite; cada tela que passa `progresso` é conferida por esta trava",
  },
  {
    arquivo: "src/app/(app)/inbox/InboxCliente.tsx",
    trecho: "onNota={setNota}",
    motivo: "o painel da conversa recebe onErro e onNota separados: onNota só recebe textos de sucesso (run(…, msg), NOTA_POR_STATUS) e o erro vai por onErro para role=\"alert\"",
  },
  {
    arquivo: "src/app/(app)/academico/reposicoes/correcoes/[reposicaoId]/CorrecoesConclusaoReposicao.tsx",
    trecho: "texto={correcao.impedimentoAprovacao}",
    motivo: "impedimento calculado no servidor (regra de negócio) mostrado como aviso antes da decisão; não é resultado de ação nem erro de transporte",
  },
  {
    arquivo: "src/app/(app)/matriculas/[id]/condicoes-horas/CondicoesHoras.tsx",
    trecho: "texto={d.impedimento}",
    motivo: "impedimento calculado no servidor (regra de negócio) mostrado como aviso antes da preparação; não é resultado de ação nem erro de transporte",
  },
  {
    arquivo: "src/app/(app)/matriculas/[id]/continuidade-mensal/CondicoesContinuidadeMensal.tsx",
    trecho: "texto={d.impedimento}",
    motivo: "impedimento calculado no servidor (regra de negócio) mostrado como aviso antes da preparação; não é resultado de ação nem erro de transporte",
  },
  {
    arquivo: "src/app/(app)/financeiro/acertos-vencimento/[matriculaId]/[propostaId]/page.tsx",
    trecho: "{p.reconciliacaoAcesso.erro}",
    motivo: "estado persistido do job de reconciliação de acesso (tentativas e último erro gravados no servidor), lido na carga da página junto do andamento; não é resultado de ação do operador",
  },
  {
    arquivo: "src/app/login/page.tsx",
    trecho: "{errors.email?.message}",
    motivo: "erro de validação do campo (react-hook-form) ligado ao input por aria-describedby; região polite sempre montada para não interromper a digitação a cada tecla",
  },
  {
    arquivo: "src/app/login/page.tsx",
    trecho: "{errors.senha?.message}",
    motivo: "erro de validação do campo (react-hook-form) ligado ao input por aria-describedby; região polite sempre montada para não interromper a digitação a cada tecla",
  },
  { arquivo: "src/app/(app)/matriculas/[id]/desistencia/financeiro/AcertoContratualFormularios.tsx", trecho: "setMensagem(r.erro ?? \"Não foi possível concluir a operação.\")", motivo: PR_PARALELA },
  { arquivo: "src/app/(app)/matriculas/[id]/desistencia/financeiro/AcertoContratualFormularios.tsx", trecho: "setMensagem(sucesso)", motivo: PR_PARALELA },
  { arquivo: "src/app/(app)/matriculas/[id]/desistencia/financeiro/AcertoContratualFormularios.tsx", trecho: "setMensagem(MSG_RESULTADO_INCERTO)", motivo: PR_PARALELA },
  { arquivo: "src/app/(app)/matriculas/[id]/desistencia/financeiro/ReconferenciaDeltaFormularios.tsx", trecho: "setMensagem(resultado.erro ?? \"Não foi possível concluir a operação.\")", motivo: PR_PARALELA },
  { arquivo: "src/app/(app)/matriculas/[id]/desistencia/financeiro/ReconferenciaDeltaFormularios.tsx", trecho: "setMensagem(MSG_RESULTADO_INCERTO)", motivo: PR_PARALELA },
  { arquivo: "src/app/(app)/matriculas/[id]/fechamentos-horas/EmitirFechamento.tsx", trecho: "setMensagem(r.ok ? \"Cobrança emitida. Consulte o registro abaixo; isso não confirma pagamento.\" : r.erro)", motivo: PR_PARALELA },
  { arquivo: "src/app/(app)/matriculas/[id]/fechamentos-horas/EmitirFechamento.tsx", trecho: "setMensagem(MSG_RESULTADO_INCERTO_SEM_CHAVE)", motivo: PR_PARALELA },
];

export function conferirExcecoes(achados: Achado[], excecoes: Excecao[]): { semExcecao: string[]; soltas: string[] } {
  const casa = (a: Achado, e: Excecao) => a.arquivo === e.arquivo && a.trecho === normaliza(e.trecho);
  return {
    semExcecao: achados.filter((a) => !excecoes.some((e) => casa(a, e))).map((a) => `${a.arquivo}: ${a.trecho} — ${a.problema}`),
    soltas: excecoes.filter((e) => achados.filter((a) => casa(a, e)).length !== 1).map((e) => `${e.arquivo}: ${e.trecho}`),
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

/** Componentes migrados nesta trava (docs/43 §6 item 2): useAcaoCliente + FeedbackAcao com erro e sucesso. */
export const MIGRADOS = [
  "src/app/(app)/academico/avaliacoes/[alocacaoId]/[codigo]/Formularios.tsx",
  "src/app/(app)/academico/avaliacoes/[alocacaoId]/[codigo]/designacao/Formulario.tsx",
  "src/app/(app)/academico/correcoes/[lancamentoId]/Formularios.tsx",
  "src/app/(app)/academico/equivalencias/[propostaId]/AcoesEquivalencia.tsx",
  "src/app/(app)/academico/modalidades/[id]/quantidade/propostas/[propostaId]/DecidirQuantidadeAulas.tsx",
  "src/app/(app)/academico/recuperacoes/planos/AutorizarPreparacao.tsx",
  "src/app/(app)/academico/recuperacoes/planos/[propostaId]/autorizacao-reserva/Formulario.tsx",
  "src/app/(app)/academico/recuperacoes/tentativas/[itemReservaId]/autorizacao/Formulario.tsx",
  "src/app/(app)/academico/regras/turmas/[turmaId]/Formularios.tsx",
  "src/app/(app)/academico/regras/turmas/[turmaId]/historica/ConferenciaRegraHistorica.tsx",
  "src/app/(app)/academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/FormularioOcorrencia.tsx",
  "src/app/(app)/academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/SegundaChamadaPainel.tsx",
  "src/app/(app)/academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/autorizacoes/Formulario.tsx",
  "src/app/(app)/academico/segundas-chamadas/minhas/[reservaId]/Formulario.tsx",
  "src/app/(app)/academico/segundas-chamadas/propostas/[propostaId]/designacao/Formulario.tsx",
  "src/app/(app)/alunos/[id]/movimentacoes/DecisaoAcerto.tsx",
  "src/app/(app)/alunos/[id]/movimentacoes/EfetivarAcerto.tsx",
  "src/app/(app)/alunos/[id]/movimentacoes/RecomposicaoPainel.tsx",
  "src/app/(app)/configuracao/migracao/[loteId]/AplicarCadastroMigracao.tsx",
  "src/app/(app)/configuracao/migracao/[loteId]/EnsaioVinculoMigracao.tsx",
  "src/app/(app)/configuracao/operacao/PrazosEntregaReposicaoFormulario.tsx",
  "src/app/(app)/configuracao/operacao/PrazosPortalFormulario.tsx",
  "src/app/(app)/configuracao/operacao/avisos-diario/AvisosDiarioFormulario.tsx",
  "src/app/(app)/diario/encontros/[id]/OcorrenciaParticular.tsx",
  "src/app/(app)/financeiro/acertos-cobertura/ImpactosCoberturaFormulario.tsx",
  "src/app/(app)/financeiro/acertos-cobertura/ImpactosCoberturaOperacao.tsx",
  "src/app/(app)/financeiro/acertos-taxa/DecisaoTaxa.tsx",
  "src/app/(app)/financeiro/acertos-taxa/ImpactosTaxaOperacao.tsx",
  "src/app/(app)/financeiro/acertos-vencimento/[matriculaId]/[propostaId]/Formulario.tsx",
  "src/app/(app)/matriculas/[id]/autorizacoes-comunicacao/AutorizacoesFormulario.tsx",
  "src/app/(app)/matriculas/[id]/condicoes-horas/CondicoesHoras.tsx",
  "src/app/(app)/matriculas/[id]/continuidade-mensal/CondicoesContinuidadeMensal.tsx",
  "src/app/(app)/matriculas/[id]/contrato/ConferirAceite.tsx",
  "src/app/(app)/matriculas/[id]/contrato/aditivos/AcertoTaxaFormulario.tsx",
  "src/app/(app)/matriculas/[id]/contrato/aditivos/AssinaturaFormulario.tsx",
  "src/app/(app)/matriculas/[id]/contrato/aditivos/CondicoesFormalizadasFormulario.tsx",
  "src/app/(app)/matriculas/[id]/contrato/aditivos/ConferenciaFinalFormulario.tsx",
  "src/app/(app)/matriculas/[id]/contrato/aditivos/Formularios.tsx",
  "src/app/(app)/matriculas/[id]/contrato/aditivos/ImpactosTaxaFormulario.tsx",
  "src/app/(app)/matriculas/[id]/contrato/aditivos/OriginalFormulario.tsx",
  "src/app/(app)/matriculas/[id]/contrato/aditivos/ParticipantesFormulario.tsx",
  "src/app/(app)/matriculas/[id]/contrato/aditivos/ProcessoFormulario.tsx",
  "src/app/(app)/matriculas/[id]/contrato/aditivos/[propostaId]/alcadas/Formulario.tsx",
  "src/app/(app)/matriculas/[id]/contrato/aditivos/agenda/ConferenciaAgendaFormulario.tsx",
  "src/app/(app)/matriculas/[id]/desistencia/EfetivacaoFormulario.tsx",
  "src/app/(app)/matriculas/[id]/desistencia/PedidoFormulario.tsx",
  "src/app/(app)/matriculas/[id]/desistencia/administracao/DecisaoFormulario.tsx",
  "src/app/(app)/matriculas/[id]/desistencia/financeiro/Formularios.tsx",
  "src/app/(app)/matriculas/[id]/fechamentos-horas/DecidirFechamento.tsx",
  "src/app/(app)/matriculas/[id]/fechamentos-horas/PrepararFechamento.tsx",
  "src/app/(app)/matriculas/[id]/nova-reserva/Formulario.tsx",
  "src/app/(app)/matriculas/[id]/ocorrencias-financeiras/ConferenciaHoras.tsx",
  "src/app/(app)/secretaria/avisos-agenda/ReconferirPendencia.tsx",
  "src/app/(app)/secretaria/envios-portal/ConciliacaoEnvio.tsx",
  "src/app/(app)/secretaria/reservas/ConferirReserva.tsx",
  "src/app/(app)/secretaria/reservas/[id]/Formularios.tsx",
];

describe("feedback separado: erro em role=\"alert\", sucesso em role=\"status\" (docs/43 §6 item 2)", () => {
  const arquivos = arquivosDeProducao();
  const achados = arquivos.flatMap(({ arquivo, fonte }) => analisar(fonte, arquivo));

  it("a varredura acha os arquivos (não passa vazia por erro de caminho) e inclui src/components", () => {
    expect(arquivos.length).toBeGreaterThan(300);
    expect(arquivos.map((a) => a.arquivo)).toEqual(expect.arrayContaining(["src/components/FeedbackAcao.tsx", "src/components/MensagemStatus.tsx", ...MIGRADOS]));
  });

  it("nenhum estado de mensagem recebe erro, nenhuma região de status mostra erro, nada recarrega a página — exceções ancoradas", () => {
    expect(conferirExcecoes(achados, EXCECOES)).toEqual({ semExcecao: [], soltas: [] });
  });

  it("cada exceção tem motivo de verdade", () => {
    for (const e of EXCECOES) expect(e.motivo.trim().length, `${e.arquivo}: ${e.trecho}`).toBeGreaterThan(30);
  });

  it("a lista de exceções é a combinada (cópia literal: acrescentar exceção exige mexer aqui também)", () => {
    expect(EXCECOES.map((e) => `${e.arquivo} :: ${e.trecho}`)).toEqual([
      "src/components/FeedbackAcao.tsx :: texto={sucesso}",
      "src/components/FeedbackAcao.tsx :: progresso={progresso}",
      "src/app/(app)/inbox/InboxCliente.tsx :: onNota={setNota}",
      "src/app/(app)/academico/reposicoes/correcoes/[reposicaoId]/CorrecoesConclusaoReposicao.tsx :: texto={correcao.impedimentoAprovacao}",
      "src/app/(app)/matriculas/[id]/condicoes-horas/CondicoesHoras.tsx :: texto={d.impedimento}",
      "src/app/(app)/matriculas/[id]/continuidade-mensal/CondicoesContinuidadeMensal.tsx :: texto={d.impedimento}",
      "src/app/(app)/financeiro/acertos-vencimento/[matriculaId]/[propostaId]/page.tsx :: {p.reconciliacaoAcesso.erro}",
      "src/app/login/page.tsx :: {errors.email?.message}",
      "src/app/login/page.tsx :: {errors.senha?.message}",
      "src/app/(app)/matriculas/[id]/desistencia/financeiro/AcertoContratualFormularios.tsx :: setMensagem(r.erro ?? \"Não foi possível concluir a operação.\")",
      "src/app/(app)/matriculas/[id]/desistencia/financeiro/AcertoContratualFormularios.tsx :: setMensagem(sucesso)",
      "src/app/(app)/matriculas/[id]/desistencia/financeiro/AcertoContratualFormularios.tsx :: setMensagem(MSG_RESULTADO_INCERTO)",
      "src/app/(app)/matriculas/[id]/desistencia/financeiro/ReconferenciaDeltaFormularios.tsx :: setMensagem(resultado.erro ?? \"Não foi possível concluir a operação.\")",
      "src/app/(app)/matriculas/[id]/desistencia/financeiro/ReconferenciaDeltaFormularios.tsx :: setMensagem(MSG_RESULTADO_INCERTO)",
      "src/app/(app)/matriculas/[id]/fechamentos-horas/EmitirFechamento.tsx :: setMensagem(r.ok ? \"Cobrança emitida. Consulte o registro abaixo; isso não confirma pagamento.\" : r.erro)",
      "src/app/(app)/matriculas/[id]/fechamentos-horas/EmitirFechamento.tsx :: setMensagem(MSG_RESULTADO_INCERTO_SEM_CHAVE)",
    ]);
  });

  it("os componentes migrados seguem no padrão: useAcaoCliente + <FeedbackAcao erro={…} sucesso={…}>", () => {
    for (const arquivo of MIGRADOS) {
      const fonte = readFileSync(arquivo, "utf8");
      expect(fonte, arquivo).toMatch(/\buseAcaoCliente\(/);
      expect(fonte, arquivo).toMatch(/<FeedbackAcao\b[^>]*\berro=\{[^}]+\}[^>]*\bsucesso=\{[^}]+\}/);
    }
  });
});

// ---------------------------------------------------------------------------------------------------
// Autotestes em fonte virtual: cada evasão é acusada; as formas certas passam.
// ---------------------------------------------------------------------------------------------------
const IMPORTS = 'import { MensagemStatus } from "@/components/MensagemStatus";\nimport { FeedbackAcao } from "@/components/FeedbackAcao";\nimport { MSG_RESULTADO_INCERTO, MSG_RESULTADO_INCERTO_SEM_CHAVE, MSG_DECISAO_INCERTA } from "@/lib/mensagens";\n';
/** Um componente com um estado `mensagem` e o corpo/JSX dados. */
const tela = (corpo: string, jsx = "<MensagemStatus texto={mensagem} />", estado = "mensagem") =>
  `${IMPORTS}export function Tela({ r }: { r: { ok: boolean; erro?: string } }) {\n  const [${estado}, set${capital(estado)}] = useState("");\n  const [erro, setErro] = useState<string | null>(null);\n  ${corpo}\n  return <div>${jsx}</div>;\n}\n`;
const problemas = (fonte: string) => analisar(fonte).map((a) => a.problema);
const trechos = (fonte: string) => analisar(fonte).map((a) => a.trecho);

describe("autoteste: estado de mensagem (A)", () => {
  it("E1 — ternário no setter (sucesso : erro) acusa", () => {
    expect(trechos(tela('async function s() { setMensagem(r.ok ? "Salvo." : r.erro ?? ""); }'))).toEqual(['setMensagem(r.ok ? "Salvo." : r.erro ?? "")']);
  });
  it("E2 — erro e sucesso em chamadas separadas: acusa a do erro", () => {
    expect(trechos(tela('async function s() { if (!r.ok) setMensagem(r.erro ?? ""); else setMensagem("Salvo."); }'))).toEqual(['setMensagem(r.erro ?? "")']);
  });
  it("E3 — constante de resultado incerto (as três de src/lib/mensagens) acusa", () => {
    for (const c of ["MSG_RESULTADO_INCERTO", "MSG_RESULTADO_INCERTO_SEM_CHAVE", "MSG_DECISAO_INCERTA"]) {
      expect(trechos(tela(`async function s() { try { await f(); } catch { setMensagem(${c}); } }`)), c).toEqual([`setMensagem(${c})`]);
    }
  });
  it("E3b — toda constante de incerteza exportada por src/lib/mensagens casa com o padrão", () => {
    const incertas = Object.keys(MENSAGENS).filter((k) => /INCERT/.test(k));
    expect(incertas.length).toBeGreaterThanOrEqual(3);
    for (const k of incertas) expect(CONSTANTE_DE_INCERTEZA.test(k), k).toBe(true);
  });
  it("E4 — variável do catch e e.message acusam", () => {
    expect(trechos(tela("async function s() { try { await f(); } catch (e) { setMensagem(String(e)); } }"))).toEqual(["setMensagem(String(e))"]);
    expect(trechos(tela("async function s() { try { await f(); } catch (x) { setMensagem(x instanceof Error ? x.message : \"\"); } }"))).toHaveLength(1);
  });
  it("E5 — texto que começa como erro acusa (cada prefixo da lista, com e sem acento)", () => {
    for (const t of ["Não foi possível salvar.", "Nao foi possivel salvar.", "Falha ao salvar.", "Erro inesperado.", "Resultado não confirmado. Recarregue."]) {
      expect(trechos(tela(`function s() { setMensagem("${t}"); }`)), t).toEqual([`setMensagem("${t}")`]);
      expect(trechos(tela(`function s(n: number) { setMensagem(\`${t} (\${n})\`); }`)), `template ${t}`).toHaveLength(1);
    }
  });
  it("E6 — intermediário: const, let com atribuição, desestruturação e função local acusam", () => {
    expect(trechos(tela('function s() { const t = r.ok ? "Salvo." : r.erro ?? ""; setMensagem(t); }'))).toEqual(["setMensagem(t)"]);
    expect(trechos(tela('function s() { let t = "Salvo."; if (!r.ok) t = r.erro ?? ""; setMensagem(t); }'))).toEqual(["setMensagem(t)"]);
    expect(trechos(tela('function s() { const { erro: t } = r; setMensagem(t ?? ""); }'))).toEqual(['setMensagem(t ?? "")']);
    expect(trechos(tela('const texto = (x: { ok: boolean; erro?: string }) => (x.ok ? "Salvo." : x.erro ?? ""); function s() { setMensagem(texto(r)); }'))).toEqual(["setMensagem(texto(r))"]);
  });
  it("E7 — helper com parâmetro: cada chamada é seguida; chamada com erro acusa, só sucessos passam", () => {
    expect(trechos(tela('function avisar(t: string) { setMensagem(t); } function s() { avisar("Salvo."); avisar(r.erro ?? ""); }'))).toEqual(["setMensagem(t)"]);
    expect(trechos(tela('function avisar(t: string) { setMensagem(t); } function s() { avisar("Salvo."); avisar(r.ok ? "Aprovado." : "Rejeitado."); }'))).toEqual([]);
    expect(trechos(tela('const avisar = async (t: string) => { setMensagem(t); }; function s() { void avisar("Salvo."); }'))).toEqual([]);
  });
  it("E8 — helper passado adiante, callback anônimo e parâmetro desestruturado falham fechado", () => {
    expect(problemas(tela('function avisar(t: string) { setMensagem(t); }', "<Filho onAviso={avisar} />"))).toEqual([expect.stringMatching(/passada adiante/)]);
    expect(problemas(tela("function s(p: Promise<string>) { void p.then((t) => setMensagem(t)); }"))).toEqual([expect.stringMatching(/função anônima/)]);
    expect(problemas(tela("function avisar({ t }: { t: string }) { setMensagem(t); } avisar({ t: \"x\" });"))).toEqual([expect.stringMatching(/desestruturado/)]);
  });
  it("E9 — setter de mensagem passado como valor ou com outro nome falha fechado", () => {
    expect(trechos(tela("", "<Filho onMensagem={setMensagem} />"))).toEqual(["onMensagem={setMensagem}"]);
    expect(trechos(tela("function s(p: Promise<string>) { void p.then(setMensagem); }"))).toEqual(["p.then(setMensagem)"]);
    expect(trechos(tela("const s = setMensagem; function t() { s(r.erro ?? \"\"); }"))).toEqual(["s = setMensagem"]);
  });
  it("E10 — updater funcional com erro acusa", () => {
    expect(trechos(tela('function s() { setMensagem(() => r.erro ?? ""); }'))).toEqual(['setMensagem(() => r.erro ?? "")']);
  });
  it("E11 — estado com nome qualquer vira estado de mensagem quando vai para a região de status", () => {
    expect(trechos(tela('function s() { setTexto(r.erro ?? ""); }', "<MensagemStatus texto={texto} />", "texto"))).toEqual(['setTexto(r.erro ?? "")']);
    expect(trechos(tela('function s() { setTexto(r.erro ?? ""); }', "<p>{texto}</p>", "texto"))).toEqual([]); // fora de região de status, não é mensagem
    // A condição do ternário não é o valor anunciado: `salvo` não vira estado de mensagem.
    expect(trechos(tela("", '<MensagemStatus texto={salvo ? "Salvo." : null} /><Campo onChange={setSalvo} />', "salvo"))).toEqual([]);
    // Interpolação: dado de origem desconhecida no meio do texto passa; erro no meio do texto acusa.
    expect(trechos(tela("function s(n: number) { setMensagem(`Versão ${n} registrada.`); }"))).toEqual([]);
    expect(trechos(tela("function s() { setMensagem(`Versão: ${r.erro}`); }"))).toEqual(["setMensagem(`Versão: ${r.erro}`)"]);
  });
  it("E12 — useState sem desestruturar falha fechado", () => {
    expect(problemas(`export function T() { const estado = useState(""); estado[1]("x"); return null; }`)).toEqual([expect.stringMatching(/sem desestruturar/)]);
  });
  it("lista fechada de palavras de mensagem: cada uma (inteira, prefixo e sufixo) faz o estado ser de mensagem", () => {
    const PALAVRAS = ["mensagem", "msg", "aviso", "nota", "sucesso", "feito", "retorno", "feedback", "resultado", "ok"];
    expect(PALAVRAS_DE_MENSAGEM).toEqual(PALAVRAS);
    for (const p of PALAVRAS) for (const nome of [p, `${p}Lote`, `ultimo${capital(p)}`]) {
      expect(trechos(tela(`function s() { set${capital(nome)}(r.erro ?? ""); }`, "<p />", nome)), nome).toEqual([`set${capital(nome)}(r.erro ?? "")`]);
    }
    // Vizinhos que não são mensagem: notas (lista de notas), status de filtro.
    for (const nome of ["notas", "statusFiltro"]) expect(trechos(tela(`function s() { set${capital(nome)}(r.erro ?? ""); }`, "<p />", nome)), nome).toEqual([]);
  });
  it("lista fechada de palavras de erro: estado de erro pode receber erro; na região de status, acusa", () => {
    const PALAVRAS = ["erro", "error", "falha", "alerta"];
    expect(PALAVRAS_DE_ERRO).toEqual(PALAVRAS);
    for (const p of PALAVRAS) {
      const nome = `${p}Envio`;
      expect(trechos(tela(`function s() { set${capital(nome)}(r.erro ?? ""); }`, "<p />", nome)), nome).toEqual([]);
      expect(trechos(tela("", `<MensagemStatus texto={${nome}} />`, nome)), `${nome} na região`).toEqual([`texto={${nome}}`]);
    }
  });
  it("lista fechada de propriedades de erro: ler cada uma acusa", () => {
    const PROPS = ["erro", "error", "message", "falha"];
    expect(PROPRIEDADES_DE_ERRO).toEqual(PROPS);
    for (const p of PROPS) {
      expect(trechos(tela(`function s(x: Record<string, string>) { setMensagem(x.${p}); }`)), p).toEqual([`setMensagem(x.${p})`]);
      expect(trechos(tela(`function s(x: Record<string, string>) { setMensagem(x["${p}"]); }`)), `["${p}"]`).toEqual([`setMensagem(x["${p}"])`]);
    }
  });
  it("lista fechada de prefixos de erro (comparados sem acento e sem caixa)", () => {
    const PREFIXOS = ["nao foi possivel", "falha", "erro", "resultado nao confirmado"];
    expect(PREFIXOS_DE_ERRO).toEqual(PREFIXOS);
    for (const p of PREFIXOS) expect(trechos(tela(`function s() { setMensagem("${p.toUpperCase()} x"); }`)), p).toHaveLength(1);
  });
  it("controle: as formas certas passam", () => {
    expect(analisar(tela('async function s() { if (!r.ok) { setErro(r.erro ?? ""); return; } setMensagem("Salvo."); }'))).toEqual([]);
    expect(analisar(tela('function s(d: { repetida: boolean }) { setMensagem(d.repetida ? "Já registrada." : "Registrada."); setMensagem(""); setMensagem(null as unknown as string); }'))).toEqual([]);
    expect(analisar(tela('function s(v: number) { setMensagem(`Rascunho versão ${v} salvo.`); }'))).toEqual([]);
  });
});

describe("autoteste: região de status (B) e sucesso do executar (C)", () => {
  // `acao` é local (useAcaoCliente), não prop: valor vindo das props do componente falha fechado (E16).
  const reg = (jsx: string, extra = "") => `${IMPORTS}${extra}export function T({ r }: { r: { ok: boolean; erro?: string } }) { const acao = useAcaoCliente({ idempotente: true }); return <div>${jsx}</div>; }\n`;
  it("E13 — erro direto na região: MensagemStatus texto/progresso e FeedbackAcao sucesso/progresso", () => {
    expect(trechos(reg("<MensagemStatus texto={r.erro} />"))).toEqual(["texto={r.erro}"]);
    expect(trechos(reg('<MensagemStatus texto={r.ok ? "Salvo." : r.erro} />'))).toEqual(['texto={r.ok ? "Salvo." : r.erro}']);
    expect(trechos(reg('<MensagemStatus texto={null} progresso={r.erro} />'))).toEqual(["progresso={r.erro}"]);
    expect(trechos(reg("<FeedbackAcao erro={null} sucesso={acao.erro} />"))).toEqual(["sucesso={acao.erro}"]);
    expect(trechos(reg("<FeedbackAcao erro={null} progresso={MSG_RESULTADO_INCERTO} />"))).toEqual(["progresso={MSG_RESULTADO_INCERTO}"]);
    expect(trechos(reg('<MensagemStatus texto="Não foi possível salvar." />'))).toEqual(['texto="Não foi possível salvar."']);
  });
  it("lista fechada de regiões: cada componente e cada prop da região acusam", () => {
    expect(REGIOES_DE_STATUS).toEqual({ MensagemStatus: ["texto", "progresso"], FeedbackAcao: ["sucesso", "progresso"] });
    const COPIA: [string, string][] = [["MensagemStatus", "texto"], ["MensagemStatus", "progresso"], ["FeedbackAcao", "sucesso"], ["FeedbackAcao", "progresso"]];
    for (const [c, p] of COPIA) expect(trechos(reg(`<${c} erro={null} ${p}={r.erro} />`)), `${c}.${p}`).toEqual([`${p}={r.erro}`]);
    // `erro` do FeedbackAcao é o lugar do erro: passa.
    expect(analisar(reg("<FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />"))).toEqual([]);
  });
  it("E14 — componente renomeado no import, por namespace e por constante", () => {
    const sem = (s: string) => s.replace(IMPORTS, "");
    expect(trechos(sem(reg("<Status texto={r.erro} />", 'import { MensagemStatus as Status } from "@/components/MensagemStatus";\n')))).toEqual(["texto={r.erro}"]);
    expect(trechos(sem(reg("<M.MensagemStatus texto={r.erro} />", 'import * as M from "@/components/MensagemStatus";\n')))).toEqual(["texto={r.erro}"]);
    expect(trechos(reg("<S texto={r.erro} />", "const S = MensagemStatus;\n"))).toEqual(["texto={r.erro}"]);
    expect(trechos(sem(reg("<F erro={null} sucesso={r.erro} />", 'import { FeedbackAcao as F } from "@/components/FeedbackAcao";\n')))).toEqual(["sucesso={r.erro}"]);
  });
  it("E15 — spread de props, createElement e uso como valor falham fechado (ou acusam o erro)", () => {
    expect(problemas(reg("<MensagemStatus {...acao} texto={null} />"))).toEqual([expect.stringMatching(/não verificáveis/)]);
    expect(trechos(reg("{createElement(MensagemStatus, { texto: r.erro })}", 'import { createElement } from "react";\n'))).toEqual(["texto: r.erro"]);
    expect(problemas(reg("{createElement(MensagemStatus, acao as never)}", 'import { createElement } from "react";\n'))).toEqual([expect.stringMatching(/não verificáveis/)]);
    expect(problemas(reg("<Filho componente={MensagemStatus} />"))).toEqual([expect.stringMatching(/usado como valor/)]);
  });
  it("E16 — região repassada por prop (componente envelope) falha fechado", () => {
    expect(problemas(`${IMPORTS}function Aviso({ t }: { t: string }) { return <MensagemStatus texto={t} />; }\n`)).toEqual([expect.stringMatching(/prop do componente/)]);
    expect(problemas(`${IMPORTS}function Aviso(p: { t: string }) { return <MensagemStatus texto={p.t} />; }\n`)).toEqual([expect.stringMatching(/props do componente/)]);
    expect(problemas(`${IMPORTS}function Aviso(props: { t: string }) { const { t } = props; return <MensagemStatus texto={t} />; }\n`)).toEqual([expect.stringMatching(/props do componente/)]);
  });
  it("E17 — elemento nativo com role=\"status\"/aria-live=\"polite\" com erro acusa", () => {
    expect(trechos(reg('<p role="status">{r.erro}</p>'))).toEqual(["{r.erro}"]);
    expect(trechos(reg('<div aria-live="polite">{MSG_DECISAO_INCERTA}</div>'))).toEqual(["{MSG_DECISAO_INCERTA}"]);
    expect(analisar(reg('<p role="alert">{r.erro}</p>'))).toEqual([]);
  });
  it("E18 — sucesso do executar com erro acusa; texto e função de sucesso passam", () => {
    const ex = (sucesso: string) => `${IMPORTS}export function T({ r }: { r: { ok: boolean; erro?: string } }) { const acao = useAcaoCliente({ idempotente: true }); const s = () => acao.executar(async () => ({ ok: true as const }), ${sucesso}); return <button onClick={s}>Salvar</button>; }\n`;
    expect(problemas(ex("r.erro ?? \"\""))).toEqual([expect.stringMatching(/sucesso do executar recebe erro/)]);
    expect(problemas(ex('(d) => (d as { erro?: string })?.erro ?? "Salvo."'))).toEqual([expect.stringMatching(/sucesso do executar recebe erro/)]);
    expect(analisar(ex('"Salvo."'))).toEqual([]);
    expect(analisar(ex('(d) => ((d as { repetida?: boolean })?.repetida ? "Já registrada." : "Registrada.")'))).toEqual([]);
  });
  it("controle: acao.sucesso, aviso estático e prop de dado que não é props do componente passam", () => {
    expect(analisar(`${IMPORTS}export function T() { const acao = useAcaoCliente({ idempotente: false }); return <><MensagemStatus texto={acao.sucesso} /><FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} /></>; }\n`)).toEqual([]);
    expect(analisar(`${IMPORTS}export function T({ obsoleta }: { obsoleta: boolean }) { return <MensagemStatus texto={obsoleta ? "A proposta mudou." : null} />; }\n`)).toEqual([]);
    expect(analisar(`${IMPORTS}export function T({ lista }: { lista: { id: string; aviso: string }[] }) { return <>{lista.map((i) => <MensagemStatus key={i.id} texto={i.aviso} />)}</>; }\n`)).toEqual([]);
  });
});

describe("autoteste: recarga da página (D) e falha fechada (E)", () => {
  it("E19 — cada forma de recarregar acusa", () => {
    const FORMAS = [
      "window.location.reload();",
      "location.reload();",
      "globalThis.location.reload();",
      "document.location.reload();",
      'window["location"]["reload"]();',
      "const { reload } = window.location; reload();",
      "const { reload: r } = location; r();",
      "history.go(0);",
      "window.history.go(0);",
      "window.location.href = window.location.href;",
      "location.href = location.href;",
      "window.location = window.location;",
      "location.assign(location.href);",
      "window.location.replace(window.location.href);",
    ];
    for (const f of FORMAS) expect(analisar(`export function T() { const s = () => { ${f} }; return <button onClick={s}>Ok</button>; }\n`).length, f).toBeGreaterThan(0);
  });
  it("controle: router.refresh(), router.replace(…) e navegação para OUTRA página passam", () => {
    expect(analisar('export function T({ router }: { router: { refresh(): void; replace(h: string): void } }) { const s = () => { router.refresh(); router.replace("/x"); }; return <button onClick={s}>Ok</button>; }\n')).toEqual([]);
    expect(analisar('export function T({ id }: { id: string }) { const s = () => { location.assign(`/academico/${id}`); window.location.href = "/login"; }; return <button onClick={s}>Ok</button>; }\n')).toEqual([]);
  });
  it("E20 — arquivo que não analisa falha fechado", () => {
    expect(analisar("export function T( { return <div>; }")).toEqual([{ arquivo: "virtual.tsx", trecho: "(arquivo)", problema: expect.stringMatching(/falha fechada/) }]);
  });
  it("conferirExcecoes: achado sem exceção acusa; exceção sem alvo, com alvo trocado ou ambígua fica solta", () => {
    const a = { arquivo: "x.tsx", trecho: "texto={erro}", problema: "p" };
    const e = { arquivo: "x.tsx", trecho: "texto={erro}", motivo: "m" };
    expect(conferirExcecoes([a], [])).toEqual({ semExcecao: ["x.tsx: texto={erro} — p"], soltas: [] });
    expect(conferirExcecoes([a], [e])).toEqual({ semExcecao: [], soltas: [] });
    expect(conferirExcecoes([], [e])).toEqual({ semExcecao: [], soltas: ["x.tsx: texto={erro}"] });
    expect(conferirExcecoes([{ ...a, arquivo: "y.tsx" }], [e])).toEqual({ semExcecao: ["y.tsx: texto={erro} — p"], soltas: ["x.tsx: texto={erro}"] });
    expect(conferirExcecoes([a, { ...a, problema: "q" }], [e]).soltas).toEqual(["x.tsx: texto={erro}"]); // ambígua
  });
});
