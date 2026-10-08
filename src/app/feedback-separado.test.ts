import { readdirSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import * as MENSAGENS from "@/lib/mensagens";
import * as ACAO_CLIENTE from "@/lib/acao-cliente";

// Trava do feedback separado (docs/43-medicao-auditoria-ux.md §6 item 2; docs/42-auditoria-frontend-ux.md E3).
// Havia ~50 formulários com UMA mensagem para sucesso e erro — `setMensagem(r.ok ? "Salvo." : r.erro)`
// mostrado num <MensagemStatus> (role="status", sem cor): o erro não era anunciado como alerta nem
// pintado de erro, e "Resultado não confirmado" saía igual a "Salvo". Agora o erro vai para role="alert"
// e o sucesso para role="status" (useAcaoCliente + FeedbackAcao). E `window.location.reload()` deu lugar
// a mensagem + router.refresh().
//
// Pelo AST do TypeScript, em todo arquivo de produção de src/app e src/components:
// A. ESTADO DE MENSAGEM não recebe erro. É estado de mensagem o `useState` cujo nome está na lista
//    PALAVRAS_DE_MENSAGEM ou cujo valor aparece numa região de status (B); e também o callback recebido
//    por prop com nome `on<Palavra>` (onNota, onFeito…), que é o setter visto do lado do filho. Cada
//    chamada é seguida pelo fluxo do valor — ternário, `&&`/`||`/`??`/`+`, template, constante e `let`
//    (com as atribuições, inclusive por desestruturação), desestruturação, campo de objeto local (o objeto
//    literal de onde ele vem), função local (o que ela devolve), função de fora (os argumentos e o objeto
//    do método: `String(e)` não lava nada), parâmetro de função local (o valor padrão e cada chamada dela
//    no arquivo) — e acusa erro (`.erro`/`.message`/`.falha`, `.mensagem` de um desfecho do executor,
//    constante MSG_*INCERT*, variável de catch e parâmetro de `.catch`, nome de erro, texto que começa
//    como erro) e o que não dá para seguir (prop do componente, parâmetro de função anônima, função
//    passada adiante, setter/callback de mensagem passado como valor a algo que não é `on<Palavra>`).
//    O desfecho do executor (`.mensagem`) é reconhecido pela ORIGEM da ligação: import do módulo pelo caminho
//    resolvido (alias ou relativo, qualquer nome local), namespace (`AC.x`/`AC["x"]`), `.executar`, `{ executar }`
//    de `useAcaoCliente(…)`, `criarExecutor(…)`, alias, `.call`/`.apply`/`.bind`, atribuições do `let`, o que
//    uma função local devolve e o `.then` do executor; `.mensagem` de parâmetro de callback anônimo de origem
//    desconhecida falha fechado. Mutação por método (`push`, `set`…) é fonte do valor; arrays são seguidos e o
//    parâmetro de iterador (`map`…) fica ligado ao receptor. Componente embrulhado em memo/forwardRef continua
//    componente, e `on<Palavra>` desestruturado de qualquer parâmetro é conferido.
// B. REGIÃO DE STATUS não recebe erro: <MensagemStatus texto/progresso>, <FeedbackAcao sucesso/progresso>
//    (também renomeados no import, por namespace, por constante, por createElement e por cloneElement),
//    e tudo o que está dentro de região nativa — role com algum token status/log (literal, constante ou ternário),
//    aria-live polite, <output> — em qualquer profundidade (inclusive JSX dentro de uma expressão e
//    children={…} e dangerouslySetInnerHTML), menos dentro de um role="alert". Papel não literal ou spread opaco num
//    elemento nativo: tratado como região (falha fechada). Spread de props e uso do componente como valor
//    falham fechado.
// C. O sucesso passado a `.executar(acao, sucesso)` (useAcaoCliente) não é erro.
// D. Nada recarrega a página: `.reload`, `{ reload }`, `history.go` (também por alias e `{ go }`),
//    qualquer atribuição (inclusive composta) a `location` ou a um campo dela — salvo destino literal que
//    não lê a própria página —, `location.assign/replace` com a própria página (`location…`, `document.URL`),
//    `window.open` da própria página na mesma janela. Destino literal só é navegação se for absoluto (`/…` ou
//    URL). Campo computado de location/history/window/self/top/parent/frames, location passada como valor,
//    window.open por `.call`/`.apply`/`.bind` ou como valor e objeto de janela passado a mutador de objeto ou
//    espalhado falham fechado.
// E. Arquivo que não analisa (erro de sintaxe) e `useState` sem desestruturar falham fechado.
//
// Exceções: arquivo + TIPO do achado (erro × opaco) + trecho exato (espaços normalizados) + motivo; a do
// tipo erro lista também as FONTES de erro que aceita (o achado leva todas as do fluxo): uma fonte nova no
// mesmo trecho não casa. Cada uma casa com exatamente um achado, e a lista é comparada com uma cópia
// literal (acrescentar exceção exige mexer nos dois lugares).

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
/** Funções que devolvem um DesfechoAcao (src/lib/acao-cliente.ts): o `.mensagem` dele é erro ou incerto. */
export const FUNCOES_DO_EXECUTOR = ["executar", "executarAcaoCliente"];
/** Campos lidos de `document` que são a própria página. */
export const CAMPOS_DA_PROPRIA_PAGINA = ["URL", "documentURI", "baseURI", "location"];
/** Módulo do executor, pelo caminho RESOLVIDO (`@/lib/acao-cliente` ou relativo que chegue a ele): vale o nome original do import. */
export const MODULO_DO_EXECUTOR = "src/lib/acao-cliente";
/** Fábricas do módulo do executor: `criarExecutor(…)` devolve o executor; `useAcaoCliente(…)` devolve `{ executar }`. */
export const FABRICAS_DO_EXECUTOR = ["criarExecutor"];
export const GANCHOS_DO_EXECUTOR = ["useAcaoCliente"];
/** Invocação indireta de função: `f.call(…)`/`f.apply(…)` chamam f; `f.bind(…)` devolve f. */
export const METODOS_DE_INVOCACAO = ["call", "apply", "bind"];
/** Métodos que põem valor dentro da variável (a fonte do valor é o argumento). */
export const MUTADORES = ["push", "unshift", "splice", "fill", "set", "add"];
/** Iteradores cujo callback recebe os elementos do receptor (o parâmetro fica ligado a ele). */
export const ITERADORES = ["map", "flatMap", "filter", "reduce"];
/** Atributos de elemento nativo que são conteúdo dele. */
export const ATRIBUTOS_DE_CONTEUDO = ["children", "dangerouslySetInnerHTML"];
/** Funções que mexem num objeto passado como primeiro argumento (`Object.assign(window, …)`). */
export const MUTADORES_DE_OBJETO = ["assign", "set", "defineProperty", "defineProperties"];
/** Papéis ARIA de região polite (role="status" e role="log" têm aria-live="polite" implícito). */
export const PAPEIS_POLITE = ["status", "log"];
/** Elementos nativos que já são região polite sem atributo (`<output>` tem role="status" implícito). */
export const ELEMENTOS_POLITE = ["output"];
/** Alvos do window.open que trocam a própria página (os outros abrem outra janela). */
export const ALVOS_DA_PROPRIA_JANELA = ["_self", "_top", "_parent"];
/** Objetos de janela: donde sai o window.open (`open(…)` solto também conta) e que não podem ir como valor a um mutador. */
export const OBJETOS_DA_JANELA = ["window", "globalThis", "self", "top", "parent", "frames"];
/** Objetos globais cujo campo computado pode ser a recarga (`location[x]()`), e por isso falham fechado. */
export const OBJETOS_DE_NAVEGACAO = ["location", "history", "window", "globalThis", "document", "self", "top", "parent", "frames"];
/** Embrulhos de componente: a função passada a eles continua sendo o componente (props no 1º parâmetro). */
export const EMBRULHOS_DE_COMPONENTE = ["memo", "forwardRef"];
/** Passos de valor seguidos antes de desistir (falha fechada). */
const PROFUNDIDADE_MAXIMA = 12;

const capital = (p: string) => p[0].toUpperCase() + p.slice(1);
/** Chave própria do mapa de regiões (`"toString" in {}` é true; aqui não). */
const ehRegiao = (nome: string) => Object.prototype.hasOwnProperty.call(REGIOES_DE_STATUS, nome);
const ESTADO_DE_MENSAGEM = new RegExp(`^(?:${PALAVRAS_DE_MENSAGEM.join("|")})(?:[A-Z]\\w*)?$|(?:${PALAVRAS_DE_MENSAGEM.map(capital).join("|")})$`);
/** Callback de mensagem recebido por prop: `on` + palavra de mensagem (onNota, onFeito, onMensagemLote…). */
const CALLBACK_DE_MENSAGEM = new RegExp(`^on(?:${PALAVRAS_DE_MENSAGEM.map(capital).join("|")})(?:[A-Z]\\w*)?$`);
const NOME_DE_ERRO = new RegExp(PALAVRAS_DE_ERRO.join("|"), "i");
const PROPRIEDADE_DE_ERRO = new RegExp(PROPRIEDADES_DE_ERRO.join("|"), "i");
const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const textoDeErro = (t: string) => { const s = semAcento(t).trim(); return PREFIXOS_DE_ERRO.some((p: string) => s.startsWith(p)); };
const normaliza = (t: string) => t.replace(/\s+/g, " ").trim();

/** `erro`: o valor pode ser erro (ou recarrega a página); `opaco`: não dá para provar que não é (falha fechada). */
export type TipoAchado = "erro" | "opaco";
/**
 * `fontes`: num achado `erro`, TODAS as fontes de erro achadas no fluxo do valor (o texto de cada nó), em
 * ordem; a exceção do tipo `erro` lista as fontes que aceita, e uma fonte nova no mesmo trecho não casa.
 */
export type Achado = { arquivo: string; trecho: string; tipo: TipoAchado; problema: string; fontes: string[] };
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
  // `const Thread = memo(function Thread(…) {…})`, `forwardRef((…) => …)`, `React.memo(forwardRef(…))`:
  // o embrulho não tira o nome — é o da constante que recebe a chamada (ou o da própria expressão).
  let alvo: ts.Node = f;
  let p = f.parent;
  while (p && ts.isCallExpression(p) && p.arguments[0] === alvo && EMBRULHOS_DE_COMPONENTE.includes(nomeDoCallee(p.expression))) { alvo = p; p = p.parent; }
  if (p && ts.isVariableDeclaration(p) && p.initializer === alvo && ts.isIdentifier(p.name)) return p.name;
  if (alvo !== f && ts.isFunctionExpression(f) && f.name) return f.name;
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
type FonteDeErro = { no: ts.Node; motivo: string };
/**
 * Todas as fontes de erro que aparecem na expressão, em pré-ordem (a primeira é a de sempre; as outras
 * servem para a exceção do tipo `erro` saber exatamente o que aceita).
 */
function errosSintaticos(raiz: ts.Node): FonteDeErro[] {
  const achados: FonteDeErro[] = [];
  const visita = (n: ts.Node): void => {
    if (ts.isPropertyAccessExpression(n) && PROPRIEDADE_DE_ERRO.test(n.name.text)) achados.push({ no: n, motivo: `lê .${n.name.text}` });
    if (ts.isElementAccessExpression(n)) {
      const a = desembrulha(n.argumentExpression);
      if (ts.isStringLiteralLike(a) && PROPRIEDADE_DE_ERRO.test(a.text)) achados.push({ no: n, motivo: `lê ["${a.text}"]` });
    }
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isJsxText(n)) && textoDeErro(n.text)) {
      achados.push({ no: n, motivo: `texto de erro "${normaliza(n.text).slice(0, 40)}"` });
    }
    if (ts.isIdentifier(n) && !ehNome(n)) {
      if (CONSTANTE_DE_INCERTEZA.test(n.text)) achados.push({ no: n, motivo: `usa ${n.text}` });
      else if (NOME_DE_ERRO.test(n.text)) achados.push({ no: n, motivo: `usa ${n.text}` });
      else if (resolver(n)?.tipo === "catch") achados.push({ no: n, motivo: `usa a variável do catch (${n.text})` });
    }
    ts.forEachChild(n, visita);
  };
  visita(raiz);
  return achados;
}

/** Campo lido em `a.b` / `a["b"]` (null quando o índice é computado). */
function campoLido(x: ts.PropertyAccessExpression | ts.ElementAccessExpression): string | null {
  if (ts.isPropertyAccessExpression(x)) return x.name.text;
  const a = desembrulha(x.argumentExpression);
  return ts.isStringLiteralLike(a) ? a.text : null;
}

/** Nome de uma chave de objeto (`a`, `"a"`); null quando computada. */
function nomeDaChave(p: ts.PropertyName): string | null {
  return ts.isIdentifier(p) || ts.isStringLiteral(p) || ts.isNumericLiteral(p) ? p.text : null;
}

/** Caminho resolvido de um import: `@/x` → `src/x`; relativo → a partir do arquivo; sem extensão nem `/index`. */
export function caminhoDoModulo(especificador: string, arquivo: string): string {
  const base = arquivo.split("\\").join("/");
  const r = especificador.startsWith("@/") ? `src/${especificador.slice(2)}`
    : especificador.startsWith(".") ? posix.normalize(posix.join(posix.dirname(base), especificador)) : especificador;
  return r.replace(/\.(tsx?|jsx?)$/, "").replace(/\/index$/, "");
}

/** O identificador é um import do módulo do executor com um destes nomes ORIGINAIS ("*" para namespace)? */
function importDoExecutor(id: ts.Identifier, nomes: readonly string[]): boolean {
  const d = resolver(id);
  if (d?.tipo !== "import") return false;
  const esp = d.nome.parent;
  let decl: ts.Node | undefined, original: string;
  if (ts.isImportSpecifier(esp)) { decl = esp.parent.parent.parent; original = (esp.propertyName ?? esp.name).text; }
  else if (ts.isNamespaceImport(esp)) { decl = esp.parent.parent; original = "*"; }
  else return false;
  return !!decl && ts.isImportDeclaration(decl) && ts.isStringLiteral(decl.moduleSpecifier)
    && caminhoDoModulo(decl.moduleSpecifier.text, id.getSourceFile().fileName) === MODULO_DO_EXECUTOR && nomes.includes(original);
}

/** A expressão nomeia uma função do módulo do executor (import, namespace `AC.x`/`AC["x"]`, ou nome livre em fonte virtual)? */
function funcaoDoModulo(e: ts.Expression, nomes: readonly string[]): boolean {
  const x = desembrulha(e);
  if (ts.isIdentifier(x)) return resolver(x) ? importDoExecutor(x, nomes) : nomes.includes(x.text);
  if (ts.isPropertyAccessExpression(x) || ts.isElementAccessExpression(x)) {
    const campo = campoLido(x), obj = desembrulha(x.expression);
    return !!campo && nomes.includes(campo) && ts.isIdentifier(obj) && (resolver(obj) ? importDoExecutor(obj, ["*"]) : true);
  }
  return false;
}

/** A expressão é o resultado de `useAcaoCliente(…)` (direto ou numa constante)? */
function resultadoDoGancho(e: ts.Expression, prof = 0): boolean {
  if (prof > PROFUNDIDADE_MAXIMA) return false;
  const x = desembrulha(e);
  if (ts.isCallExpression(x)) return funcaoDoModulo(x.expression, GANCHOS_DO_EXECUTOR);
  if (ts.isIdentifier(x)) {
    const d = resolver(x);
    return d?.tipo === "variavel" && !d.elemento && !!d.no.initializer && resultadoDoGancho(d.no.initializer, prof + 1);
  }
  return false;
}

/**
 * A expressão É uma função executora (devolve DesfechoAcao)? Pela ORIGEM da ligação, não pelo nome:
 * import do módulo (qualquer nome local, caminho resolvido), namespace, `.executar` de qualquer objeto,
 * `{ executar }` (renomeado ou não) desestruturado de `useAcaoCliente(…)`, `criarExecutor(…)`, alias `const`/`let`
 * e `f.bind(…)`.
 */
function ehExecutor(e: ts.Expression, prof = 0): boolean {
  if (prof > PROFUNDIDADE_MAXIMA) return false;
  const x = desembrulha(e);
  if (ts.isPropertyAccessExpression(x) || ts.isElementAccessExpression(x)) {
    return campoLido(x) === "executar" || funcaoDoModulo(x, FUNCOES_DO_EXECUTOR);
  }
  if (ts.isCallExpression(x)) {
    const c = desembrulha(x.expression);
    if ((ts.isPropertyAccessExpression(c) || ts.isElementAccessExpression(c)) && campoLido(c) === "bind") return ehExecutor(c.expression, prof + 1);
    return funcaoDoModulo(c, FABRICAS_DO_EXECUTOR);
  }
  if (!ts.isIdentifier(x)) return false;
  const d = resolver(x);
  if (!d || d.tipo === "import") return funcaoDoModulo(x, FUNCOES_DO_EXECUTOR);
  if (d.tipo !== "variavel") return false;
  if (d.elemento) {
    const chave = d.elemento.propertyName ?? d.elemento.name;
    return ts.isIdentifier(chave) && chave.text === "executar" && !!d.no.initializer && resultadoDoGancho(d.no.initializer, prof + 1);
  }
  return origensDe(d, x.text).fontes.some((f: ts.Expression) => ehExecutor(f, prof + 1));
}

/**
 * O valor vem de uma chamada a um executor — um DesfechoAcao, cujo `.mensagem` é erro ou incerto? Segue a
 * chamada (direta, `f.call`/`f.apply`, função local que devolve o desfecho) e as origens da variável (`let`).
 */
function vemDoExecutor(e: ts.Expression, prof = 0): boolean {
  if (prof > PROFUNDIDADE_MAXIMA) return false;
  const x = desembrulha(e);
  if (ts.isCallExpression(x)) {
    const c = desembrulha(x.expression);
    const indireta = (ts.isPropertyAccessExpression(c) || ts.isElementAccessExpression(c)) && ["call", "apply"].includes(campoLido(c) ?? "");
    const alvo = indireta ? (c as ts.PropertyAccessExpression | ts.ElementAccessExpression).expression : c;
    if (ehExecutor(alvo, prof + 1)) return true;
    const f = funcaoLocal(alvo);
    return !!f && retornos(f).some((r: ts.Expression) => vemDoExecutor(r, prof + 1));
  }
  if (ts.isIdentifier(x)) {
    const d = resolver(x);
    if (d?.tipo !== "variavel" || d.elemento) return false;
    return origensDe(d, x.text).fontes.some((f: ts.Expression) => vemDoExecutor(f, prof + 1)); // inicializador e atribuições do `let`
  }
  return false;
}

type Variavel = Extract<Declaracao, { tipo: "variavel" }>;
/** Marca de alvo com chave computada numa atribuição por desestruturação (`({ [k]: t } = r)`). */
const CHAVE_COMPUTADA = Symbol("chave computada");

/**
 * De onde vem o valor de uma variável local: o inicializador e cada atribuição (`t = …`, `t += …`) são
 * `fontes`; numa atribuição por desestruturação (`({ erro: t } = r)`, `[t] = lista`) a fonte é só um pedaço
 * do lado direito e a chave diz o que é.
 */
function origensDe(d: Variavel, nome: string) {
  const fontes: ts.Expression[] = d.no.initializer ? [d.no.initializer] : [];
  const pedacos: ts.Expression[] = [];
  const chaves: (string | typeof CHAVE_COMPUTADA)[] = [];
  const alvosNoPadrao = (padrao: ts.Expression, chave: string | null | typeof CHAVE_COMPUTADA): (string | null | typeof CHAVE_COMPUTADA)[] => {
    const p = desembrulha(padrao);
    if (ts.isIdentifier(p)) return p.text === nome && alvoDe(resolver(p)) === d.nome ? [chave] : [];
    if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.EqualsToken) return alvosNoPadrao(p.left, chave); // `{ a: t = padrão }`
    if (ts.isObjectLiteralExpression(p)) return p.properties.flatMap((q: ts.ObjectLiteralElementLike): (string | null | typeof CHAVE_COMPUTADA)[] => {
      if (ts.isPropertyAssignment(q)) return alvosNoPadrao(q.initializer, nomeDaChave(q.name) ?? CHAVE_COMPUTADA);
      if (ts.isShorthandPropertyAssignment(q)) return q.name.text === nome && alvoDe(resolver(q.name)) === d.nome ? [q.name.text] : [];
      if (ts.isSpreadAssignment(q)) return alvosNoPadrao(q.expression, null);
      return [];
    });
    if (ts.isArrayLiteralExpression(p)) return p.elements.flatMap((el: ts.Expression) => alvosNoPadrao(ts.isSpreadElement(el) ? el.expression : el, null));
    return [];
  };
  const visita = (n: ts.Node) => {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
      const esq = desembrulha(n.left);
      if (ts.isIdentifier(esq)) { if (esq.text === nome && alvoDe(resolver(esq)) === d.nome) fontes.push(n.right); }
      else for (const chave of alvosNoPadrao(esq, null)) { pedacos.push(n.right); if (chave !== null) chaves.push(chave); }
    }
    // Mutação por método (`avisos.push(r.erro)`, `mapa.set(k, v)`…): o argumento também é pedaço do valor.
    if (ts.isCallExpression(n)) {
      const c = desembrulha(n.expression);
      if ((ts.isPropertyAccessExpression(c) || ts.isElementAccessExpression(c)) && MUTADORES.includes(campoLido(c) ?? "")) {
        const obj = desembrulha(c.expression);
        if (ts.isIdentifier(obj) && obj.text === nome && alvoDe(resolver(obj)) === d.nome) {
          for (const a of n.arguments) pedacos.push(ts.isSpreadElement(a) ? a.expression : a);
        }
      }
    }
    ts.forEachChild(n, visita);
  };
  visita(d.escopo);
  return { fontes, pedacos, chaves };
}

/** O campo `campo` do valor `fonte`: no objeto literal, ou no que uma função local devolve (null: não achou). */
function campoDe(fonte: ts.Expression, campo: string, prof = 0): ts.Expression | null | undefined {
  if (prof > PROFUNDIDADE_MAXIMA) return undefined;
  const o = desembrulha(fonte);
  if (ts.isObjectLiteralExpression(o)) {
    for (const q of o.properties) {
      if (ts.isPropertyAssignment(q) && nomeDaChave(q.name) === campo) return q.initializer;
      if (ts.isShorthandPropertyAssignment(q) && q.name.text === campo) return q.name;
    }
    return null;
  }
  if (ts.isCallExpression(o)) {
    const f = funcaoLocal(o.expression);
    if (!f) return undefined;
    const achados = retornos(f).map((r: ts.Expression) => campoDe(r, campo, prof + 1));
    return achados.find((a: ts.Expression | null | undefined) => !!a) ?? (achados.some((a: ts.Expression | null | undefined) => a === undefined) ? undefined : null);
  }
  return undefined;
}

/** Função passada como argumento de `.catch(f)` ou como segundo de `.then(ok, f)`: o parâmetro é o erro. */
function ehTratadorDeFalha(f: ts.Node): boolean {
  const p = f.parent;
  if (!p || !ts.isCallExpression(p)) return false;
  const c = desembrulha(p.expression);
  if (!ts.isPropertyAccessExpression(c)) return false;
  return (c.name.text === "catch" && p.arguments[0] === f) || (c.name.text === "then" && p.arguments[1] === f);
}

/**
 * Estado de uma verificação: os nós já vistos (contra ciclo) e, no modo coleta, a lista onde entram TODAS as
 * fontes de erro do fluxo (o texto de cada nó). No modo coleta nenhum veredito interrompe a busca.
 */
type Ctx = { vistos: Set<ts.Node>; fontes: string[] | null };
const novoCtx = (coleta = false): Ctx => ({ vistos: new Set<ts.Node>(), fontes: coleta ? [] : null });

/** As fontes de erro do valor, todas (para ancorar a exceção do tipo `erro`). */
export function fontesDeErro(e: ts.Expression): string[] {
  const ctx = novoCtx(true);
  verificar(e, 0, ctx);
  return ctx.fontes ?? [];
}

/** Expressões de dentro de um JSX (atributos e filhos, em qualquer profundidade), menos o que está num role="alert". */
function expressoesDoJsx(x: ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment): { expr: ts.Expression; pedaco: boolean }[] {
  const saida: { expr: ts.Expression; pedaco: boolean }[] = [];
  const abertura = ts.isJsxElement(x) ? x.openingElement : ts.isJsxSelfClosingElement(x) ? x : null;
  if (abertura) {
    for (const a of abertura.attributes.properties) {
      if (ts.isJsxAttribute(a) && a.name.getText() === "role" && a.initializer && ts.isStringLiteral(a.initializer) && a.initializer.text === "alert") return [];
    }
    for (const a of abertura.attributes.properties) {
      if (ts.isJsxSpreadAttribute(a)) saida.push({ expr: a.expression, pedaco: true });
      else if (a.initializer && ts.isJsxExpression(a.initializer) && a.initializer.expression) saida.push({ expr: a.initializer.expression, pedaco: true });
    }
  }
  if (!ts.isJsxSelfClosingElement(x)) for (const f of x.children) {
    if (ts.isJsxExpression(f) && f.expression) saida.push({ expr: f.expression, pedaco: false });
    else if (ts.isJsxElement(f) || ts.isJsxSelfClosingElement(f) || ts.isJsxFragment(f)) saida.push({ expr: f, pedaco: false });
  }
  return saida;
}

/**
 * O valor pode ser erro (veredito "erro") ou não dá para seguir de onde ele vem ("opaco")? `soErro`: o
 * valor é só um PEDAÇO do texto (interpolação, concatenação, retorno de função local que monta o texto,
 * objeto de onde se lê um campo) — aí dado de origem desconhecida (número, nome, data) é normal e só o
 * erro acusa.
 */
export function verificar(e: ts.Expression, prof = 0, ctx: Ctx = novoCtx(), soErro = false): Veredito {
  const opaco = (motivo: string): Veredito => (soErro || ctx.fontes ? null : { tipo: "opaco", motivo });
  /** Erro achado no nó `no`: no modo coleta, anota e segue procurando; senão, é o veredito. */
  const erro = (no: ts.Node, motivo: string): Veredito => {
    if (!ctx.fontes) return { tipo: "erro", motivo };
    const t = normaliza(no.getText());
    if (!ctx.fontes.includes(t)) ctx.fontes.push(t);
    return null;
  };
  if (prof > PROFUNDIDADE_MAXIMA) return opaco("cadeia de valores longa demais");
  if (ctx.vistos.has(e)) return null;
  ctx.vistos.add(e);
  for (const s of errosSintaticos(e)) { const v = erro(s.no, s.motivo); if (v) return v; }
  const seguir = (x: ts.Expression, pedaco = soErro) => verificar(x, prof + 1, ctx, pedaco);
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
  // JSX dentro do valor (`{x && <span>{x}</span>}`): cada expressão de dentro é seguida, como na região.
  if (ts.isJsxElement(x) || ts.isJsxSelfClosingElement(x) || ts.isJsxFragment(x)) {
    for (const s of expressoesDoJsx(x)) { const v = seguir(s.expr, s.pedaco || soErro); if (v) return v; }
    return null;
  }
  // Array (`[detalhe]`, `[...lista]`): cada elemento é seguido.
  if (ts.isArrayLiteralExpression(x)) {
    for (const el of x.elements) { const v = seguir(ts.isSpreadElement(el) ? el.expression : el); if (v) return v; }
    return null;
  }
  if (ts.isIdentifier(x)) return identificador(x, seguir, opaco, erro);
  if (ts.isPropertyAccessExpression(x) || ts.isElementAccessExpression(x)) {
    const r = raizDe(x);
    if (r && ehDasProps(r)) return opaco(`${r.text} vem das props do componente`);
    const campo = campoLido(x);
    if (campo === "mensagem" && vemDoExecutor(x.expression)) { const v = erro(x, "lê .mensagem de um desfecho do executor (erro ou incerto)"); if (v) return v; }
    // `.mensagem` de parâmetro de callback anônimo (`.then((d) => d.mensagem)`): o desfecho chega por parâmetro.
    // Recebido de um executor, é erro; de onde não dá para saber, falha fechado — mesmo como pedaço. O dado de
    // sucesso do `.executar(acao, (dado) => …)` é exceção: é o dado da action, não o desfecho.
    if (campo === "mensagem") {
      const raizDoCampo = desembrulha(x.expression);
      const d = ts.isIdentifier(raizDoCampo) ? resolver(raizDoCampo) : null;
      if (d?.tipo === "parametro" && !nomeDaFuncao(d.funcao)) {
        const chamada = d.funcao.parent;
        const callee = chamada && ts.isCallExpression(chamada) ? desembrulha(chamada.expression) : null;
        const nomeCallee = callee && (ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee)) ? campoLido(callee) : null;
        const dadoDoSucesso = nomeCallee === "executar" && (chamada as ts.CallExpression).arguments[1] === d.funcao;
        // Callback de iterador (`lista.map((m) => m.mensagem)`): o parâmetro é elemento do receptor, seguido abaixo.
        if (!dadoDoSucesso && !ITERADORES.includes(nomeCallee ?? "")) {
          const receptor = callee && (ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee)) ? callee.expression : null;
          if (nomeCallee === "then" && receptor && vemDoExecutor(receptor)) { const v = erro(x, "lê .mensagem do desfecho recebido no .then do executor"); if (v) return v; }
          else if (!ctx.fontes) return { tipo: "opaco", motivo: `.mensagem de parâmetro de callback anônimo (${raizDoCampo.getText()}): falha fechada` };
        }
      }
    }
    // Campo de objeto local: segue de onde a raiz vem (o objeto literal, o que a função local devolve).
    const alvo = desembrulha(x.expression);
    if (ts.isIdentifier(alvo)) {
      const d = resolver(alvo);
      if (d?.tipo === "variavel" && !d.elemento) {
        const { fontes, pedacos } = origensDe(d, alvo.text);
        for (const f of fontes) {
          const valor = campo === null ? undefined : campoDe(f, campo);
          const v = valor ? seguir(valor) : seguir(f, true);
          if (v) return v;
        }
        for (const f of pedacos) { const v = seguir(f, true); if (v) return v; }
        return null;
      }
    }
    return r ? seguir(r, true) : null;
  }
  if (ts.isCallExpression(x)) {
    const f = funcaoLocal(x.expression);
    if (f) {
      for (const r of retornos(f)) { const v = seguir(r, true); if (v) return v; }
      return null;
    }
    // Função de fora (`String(e)`, `partes.join(" ")`): o valor sai dos argumentos e do objeto do método.
    const c = desembrulha(x.expression);
    if (ts.isPropertyAccessExpression(c) || ts.isElementAccessExpression(c)) { const v = seguir(c.expression, true); if (v) return v; }
    for (const a of x.arguments) { const v = seguir(ts.isSpreadElement(a) ? a.expression : a); if (v) return v; }
    return null;
  }
  if (ts.isArrowFunction(x) || ts.isFunctionExpression(x)) {
    for (const r of retornos(x)) { const v = seguir(r, true); if (v) return v; }
    return null;
  }
  return null;
}

function identificador(
  id: ts.Identifier,
  seguir: (x: ts.Expression, pedaco?: boolean) => Veredito,
  opaco: (motivo: string) => Veredito,
  erro: (no: ts.Node, motivo: string) => Veredito,
): Veredito {
  if (id.text === "undefined") return null;
  const d = resolver(id);
  if (!d || d.tipo === "funcao" || d.tipo === "import") return null;
  if (d.tipo === "catch") return erro(id, `usa a variável do catch (${id.text})`);
  if (d.elemento) {
    // Desestruturado: a chave diz o que é (`{ erro: t }`); chave computada não é verificável; valor padrão também conta.
    const chave = d.elemento.propertyName ?? d.elemento.name;
    if (ts.isComputedPropertyName(chave)) return opaco(`${id.text} vem de chave computada`);
    if ((ts.isIdentifier(chave) || ts.isStringLiteral(chave)) && PROPRIEDADE_DE_ERRO.test(chave.text)) return erro(id, `${id.text} é o campo "${chave.text}"`);
    if (ts.isIdentifier(chave) && chave.text === "mensagem" && d.tipo === "variavel" && d.no.initializer && vemDoExecutor(d.no.initializer)) {
      return erro(id, `${id.text} é o .mensagem de um desfecho do executor`);
    }
    if (d.elemento.initializer) { const v = seguir(d.elemento.initializer); if (v) return v; }
  }
  if (d.tipo === "variavel") {
    if (d.elemento) {
      // `const [a] = r.erro.split(…)`: o que se desestrutura também é lido (só o erro conta).
      const v = d.no.initializer ? seguir(d.no.initializer, true) : null;
      if (v) return v;
      const r = d.no.initializer ? raizDe(d.no.initializer) : null;
      return r && ehDasProps(r) ? opaco(`${id.text} vem das props do componente`) : null;
    }
    const { fontes, pedacos, chaves } = origensDe(d, id.text);
    if (chaves.includes(CHAVE_COMPUTADA)) return opaco(`${id.text} recebe valor por chave computada`);
    const chaveDeErro = chaves.find((c: string | typeof CHAVE_COMPUTADA): c is string => typeof c === "string" && PROPRIEDADE_DE_ERRO.test(c));
    if (chaveDeErro) { const v = erro(id, `${id.text} recebe o campo "${chaveDeErro}" por desestruturação`); if (v) return v; }
    if (fontes.length === 0 && pedacos.length === 0) return opaco(`${id.text} sem valor verificável`);
    for (const f of fontes) { const v = seguir(f); if (v) return v; }
    for (const f of pedacos) { const v = seguir(f, true); if (v) return v; }
    return null;
  }
  // Parâmetro: o valor padrão conta sempre (a chamada sem o argumento usa ele).
  const parametro = d.funcao.parameters[d.indice];
  if (parametro?.initializer) { const v = seguir(parametro.initializer); if (v) return v; }
  if (ehTratadorDeFalha(d.funcao)) return erro(id, `${id.text} é o erro recebido por .catch/.then`);
  // Função que é o valor de um atributo on<Palavra> (`onFeito={(msg) => …}`): quem a chama é o filho, e lá a chamada é conferida.
  if (vaiParaCallbackDeMensagem(d.funcao)) return null;
  // Callback de iterador (`lista.map((t) => …)`): o parâmetro é um elemento do receptor.
  const chamadaDoIterador = d.funcao.parent;
  if (chamadaDoIterador && ts.isCallExpression(chamadaDoIterador) && chamadaDoIterador.arguments[0] === d.funcao) {
    const c = desembrulha(chamadaDoIterador.expression);
    if ((ts.isPropertyAccessExpression(c) || ts.isElementAccessExpression(c)) && ITERADORES.includes(campoLido(c) ?? "")) return seguir(c.expression);
  }
  if (ehComponente(d.funcao)) return opaco(`${id.text} é prop do componente`);
  if (d.elemento) return opaco(`${id.text} vem de parâmetro desestruturado`);
  const nome = nomeDaFuncao(d.funcao);
  if (!nome) return opaco(`${id.text} é parâmetro de função anônima`);
  // Alvo da resolução dos chamadores: a declaração da função, ou o nome da constante que a recebe.
  const alvo: ts.Node = ts.isFunctionDeclaration(d.funcao) ? d.funcao : nome;
  for (const u of referencias(id.getSourceFile(), alvo, nome.text)) {
    const p = u.parent;
    if (vaiParaCallbackDeMensagem(u)) continue; // `onNota={avisar}`: quem chama é o filho, conferido lá
    if (!(ts.isCallExpression(p) && p.expression === u)) return opaco(`${nome.text} é passada adiante; o parâmetro ${id.text} não é verificável`);
    if (p.arguments.slice(0, d.indice + 1).some((a: ts.Expression) => ts.isSpreadElement(a))) return opaco(`${nome.text} é chamada com spread`);
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

/** Texto literal (string ou template). */
const ehTextoLiteral = (e: ts.Expression): boolean => { const x = desembrulha(e); return ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x) || ts.isTemplateExpression(x); };
/**
 * Destino que é NAVEGAÇÃO para outro lugar: caminho absoluto (`/…`) ou URL com esquema. Vazio, `?…`, `#…`, `.`,
 * `./` e relativos podem ser a própria página — falham fechado.
 */
export function destinoAbsoluto(e: ts.Expression): boolean {
  const x = desembrulha(e);
  const inicio = ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x) ? x.text : ts.isTemplateExpression(x) ? x.head.text : null;
  return inicio !== null && /^(\/|[a-z][a-z0-9+.-]*:)/i.test(inicio);
}

/** Nome de um callee (`f(…)` → "f", `a.f(…)` → "f"). */
function nomeDoCallee(e: ts.Expression): string {
  const c = desembrulha(e);
  return ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : "";
}

/** O nó é o valor de um atributo JSX `on<Palavra>` (`onNota={…}`)? Então quem o chama é o filho, conferido lá. */
function vaiParaCallbackDeMensagem(n: ts.Node): boolean {
  const p = n.parent;
  return !!p && ts.isJsxExpression(p) && !!p.parent && ts.isJsxAttribute(p.parent) && CALLBACK_DE_MENSAGEM.test(p.parent.name.getText());
}

export function analisar(fonte: string, arquivo = "virtual.tsx"): Achado[] {
  const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, arquivo.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.TSX);
  const diagnosticos = (sf as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];
  if (diagnosticos.length) return [{ arquivo, trecho: "(arquivo)", tipo: "opaco", problema: "não foi possível analisar o arquivo (erro de sintaxe): falha fechada", fontes: [] }];
  const achados: Achado[] = [];
  const vistosTrecho = new Set<string>();
  const acusa = (no: ts.Node, tipo: TipoAchado, problema: string, fontes: string[] = []) => {
    const trecho = normaliza(no.getText(sf));
    const chave = `${no.pos}:${tipo}:${trecho}`;
    if (vistosTrecho.has(chave)) return;
    vistosTrecho.add(chave);
    achados.push({ arquivo, trecho, tipo, problema, fontes });
  };
  /** Acusa um veredito (erro ou opaco) do valor `expr`; no erro, com TODAS as fontes dele (para a exceção casar exatamente). */
  const acusaVeredito = (no: ts.Node, v: Veredito, expr: ts.Expression, seErro: (motivo: string) => string, seOpaco: (motivo: string) => string) => {
    if (v?.tipo === "erro") acusa(no, "erro", seErro(v.motivo), fontesDeErro(expr));
    else if (v?.tipo === "opaco") acusa(no, "opaco", seOpaco(v.motivo));
  };

  // Nomes locais dos componentes de região de status (import renomeado, namespace, constante).
  const aliases = new Map<string, string>();
  const canonico = (e: ts.Node): string | null => {
    if (ts.isIdentifier(e)) return aliases.get(e.text) ?? null;
    if (ts.isPropertyAccessExpression(e)) return ehRegiao(e.name.text) ? e.name.text : null;
    if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e)) return canonico(e.expression);
    return null;
  };
  /** Componente de região de um ELEMENTO (`<MensagemStatus …/>`, direto ou numa constante): para cloneElement. */
  const canonicoDoElemento = (e: ts.Expression, prof = 0): { tag: string; atributos: ts.JsxAttributes } | null => {
    const x = desembrulha(e);
    if (ts.isJsxSelfClosingElement(x) || ts.isJsxElement(x)) {
      const abertura = ts.isJsxElement(x) ? x.openingElement : x;
      const tag = canonico(abertura.tagName);
      return tag ? { tag, atributos: abertura.attributes } : null;
    }
    if (ts.isIdentifier(x) && prof < PROFUNDIDADE_MAXIMA) {
      const d = resolver(x);
      if (d?.tipo === "variavel" && !d.elemento && d.no.initializer) return canonicoDoElemento(d.no.initializer, prof + 1);
    }
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
  // `presumida`: região nativa por papel não literal (spread/expressão opaca) — confere o erro, mas não faz de um
  // estado "estado de mensagem" (o elemento pode nem ser região).
  const regioes: { no: ts.Node; expr: ts.Expression | null; soErro: boolean; presumida?: boolean }[] = [];
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
  /**
   * Valores possíveis de um atributo: literal, ternário/`&&`/`||`/`??` de literais, constante, spread de objeto
   * literal. null quando não dá para saber (expressão opaca, spread opaco): aí o elemento é tratado como região.
   */
  const valoresDe = (e: ts.Expression, prof = 0): string[] | null => {
    if (prof > PROFUNDIDADE_MAXIMA) return null;
    const x = desembrulha(e);
    if (ts.isStringLiteralLike(x)) return [x.text];
    if (x.kind === ts.SyntaxKind.NullKeyword || x.kind === ts.SyntaxKind.FalseKeyword || (ts.isIdentifier(x) && x.text === "undefined")) return [];
    if (ts.isConditionalExpression(x)) { const a = valoresDe(x.whenTrue, prof + 1), b = valoresDe(x.whenFalse, prof + 1); return a && b ? [...a, ...b] : null; }
    if (ts.isBinaryExpression(x) && x.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return valoresDe(x.right, prof + 1);
    if (ts.isBinaryExpression(x) && (x.operatorToken.kind === ts.SyntaxKind.BarBarToken || x.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) {
      const a = valoresDe(x.left, prof + 1), b = valoresDe(x.right, prof + 1);
      return a && b ? [...a, ...b] : null;
    }
    if (ts.isIdentifier(x)) {
      const d = resolver(x);
      return d?.tipo === "variavel" && !d.elemento && d.no.initializer ? valoresDe(d.no.initializer, prof + 1) : null;
    }
    return null;
  };
  const valoresDoAtributo = (attrs: ts.JsxAttributes, nome: string): string[] | null => {
    const saida: string[] = [];
    for (const a of attrs.properties) {
      if (ts.isJsxSpreadAttribute(a)) {
        const o = desembrulha(a.expression);
        if (!ts.isObjectLiteralExpression(o)) return null; // spread opaco: pode trazer o atributo
        for (const q of o.properties) {
          if (ts.isSpreadAssignment(q) || (ts.isPropertyAssignment(q) && nomeDaChave(q.name) === null)) return null;
          if (ts.isPropertyAssignment(q) && nomeDaChave(q.name) === nome) { const v = valoresDe(q.initializer); if (!v) return null; saida.push(...v); }
          if (ts.isShorthandPropertyAssignment(q) && q.name.text === nome) { const v = valoresDe(q.name); if (!v) return null; saida.push(...v); }
        }
        continue;
      }
      if (a.name.getText(sf) !== nome || !a.initializer) continue;
      if (ts.isStringLiteral(a.initializer)) saida.push(a.initializer.text);
      else if (ts.isJsxExpression(a.initializer) && a.initializer.expression) { const v = valoresDe(a.initializer.expression); if (!v) return null; saida.push(...v); }
    }
    return saida;
  };
  /**
   * Elemento nativo que é região polite ("certa": <output>, role status/log, aria-live polite) ou pode ser
   * ("presumida": role/aria-live não literal ou spread opaco — falha fechada: o conteúdo é conferido).
   */
  const regiaoNativa = (n: ts.JsxOpeningElement | ts.JsxSelfClosingElement): "certa" | "presumida" | null => {
    if (!ts.isIdentifier(n.tagName) || !/^[a-z]/.test(n.tagName.text)) return null;
    // `role` é lista de tokens separados por espaço (o navegador usa o primeiro papel que conhece): fechado — basta
    // um token polite para ser região.
    const papeis = valoresDoAtributo(n.attributes, "role")?.flatMap((v: string) => v.split(/\s+/).filter(Boolean)) ?? null;
    const vivo = valoresDoAtributo(n.attributes, "aria-live")?.flatMap((v: string) => v.split(/\s+/).filter(Boolean)) ?? null;
    if (ELEMENTOS_POLITE.includes(n.tagName.text) || papeis?.some((v: string) => PAPEIS_POLITE.includes(v)) || vivo?.includes("polite")) return "certa";
    if (papeis?.includes("alert")) return null;
    return papeis === null || vivo === null ? "presumida" : null;
  };
  /** Atributos que são conteúdo (`children={…}`, `dangerouslySetInnerHTML`) também vão para a região. */
  const htmlDaRegiao = (attrs: ts.JsxAttributes, presumida: boolean) => {
    for (const a of attrs.properties) {
      if (ts.isJsxAttribute(a) && ATRIBUTOS_DE_CONTEUDO.includes(a.name.getText(sf)) && a.initializer && ts.isJsxExpression(a.initializer) && a.initializer.expression) {
        regioes.push({ no: a, expr: a.initializer.expression, soErro: true, presumida });
      }
    }
  };
  /** Tudo o que está dentro da região nativa, em qualquer profundidade — menos dentro de um role="alert". */
  const conteudoDaRegiao = (filhos: readonly ts.JsxChild[], presumida: boolean) => {
    for (const f of filhos) {
      if (ts.isJsxExpression(f) && f.expression) regioes.push({ no: f, expr: f.expression, soErro: true, presumida });
      else if (ts.isJsxText(f) && textoDeErro(f.text)) acusa(f, "erro", `texto de erro "${normaliza(f.text).slice(0, 40)}" dentro de região de status — erro vai para role="alert"`, [normaliza(f.text)]);
      else if (ts.isJsxElement(f) && literalDoAtributo(f.openingElement.attributes, "role") !== "alert") { htmlDaRegiao(f.openingElement.attributes, presumida); conteudoDaRegiao(f.children, presumida); }
      else if (ts.isJsxSelfClosingElement(f) && literalDoAtributo(f.attributes, "role") !== "alert") htmlDaRegiao(f.attributes, presumida);
      else if (ts.isJsxFragment(f)) conteudoDaRegiao(f.children, presumida);
    }
  };
  /** Props passadas por fábrica (createElement/jsx) ou por cloneElement a um componente de região. */
  const propsDaFabrica = (no: ts.Node, tag: string, propsArg: ts.Expression | undefined) => {
    const props = propsArg ? desembrulha(propsArg) : null;
    if (!props) return;
    if (!ts.isObjectLiteralExpression(props)) { regioes.push({ no, expr: null, soErro: false }); return; }
    for (const p of props.properties) {
      if (ts.isSpreadAssignment(p)) regioes.push({ no: p, expr: null, soErro: false });
      else if (ts.isPropertyAssignment(p)) { if (REGIOES_DE_STATUS[tag].includes(nomeDaChave(p.name) ?? "")) regioes.push({ no: p, expr: p.initializer, soErro: false }); else if (!nomeDaChave(p.name)) regioes.push({ no: p, expr: null, soErro: false }); }
      else if (ts.isShorthandPropertyAssignment(p)) { if (REGIOES_DE_STATUS[tag].includes(p.name.text)) regioes.push({ no: p, expr: p.name, soErro: false }); }
      else regioes.push({ no: p, expr: null, soErro: false });
    }
  };
  const coletaRegioes = (n: ts.Node) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const c = canonico(n.tagName);
      if (c) for (const a of n.attributes.properties) atributoDe(REGIOES_DE_STATUS[c], a);
      const regiao = regiaoNativa(n);
      if (regiao) {
        if (ts.isJsxOpeningElement(n)) conteudoDaRegiao((n.parent as ts.JsxElement).children, regiao === "presumida");
        htmlDaRegiao(n.attributes, regiao === "presumida");
      }
    }
    if (ts.isCallExpression(n) && n.arguments.length > 0) {
      const nomeCallee = nomeDoCallee(n.expression);
      const c = FABRICAS_DE_ELEMENTO.includes(nomeCallee) ? canonico(n.arguments[0]) : null;
      if (c) propsDaFabrica(n, c, n.arguments[1]);
      if (nomeCallee === "cloneElement") {
        const el = canonicoDoElemento(n.arguments[0]);
        if (el) propsDaFabrica(n, el.tag, n.arguments[1]);
      }
    }
    ts.forEachChild(n, coletaRegioes);
  };
  coletaRegioes(sf);

  // B — região de status.
  for (const r of regioes) {
    if (!r.expr) { acusa(r.no, "opaco", "props da região de status não verificáveis (spread ou objeto opaco): falha fechada"); continue; }
    const v = verificar(r.expr);
    if (v?.tipo === "erro") acusa(r.no, "erro", `região de status (role="status") recebe erro (${v.motivo}) — erro vai para role="alert" (FeedbackAcao erro)`, fontesDeErro(r.expr));
    else if (v?.tipo === "opaco" && !r.soErro) acusa(r.no, "opaco", `região de status recebe valor não verificável (${v.motivo})`);
  }

  // Componente de região usado como valor (fora de tag JSX, import, alias e fábrica de elemento).
  const usoComoValor = (n: ts.Node) => {
    if ((ts.isIdentifier(n) && aliases.has(n.text)) || (ts.isPropertyAccessExpression(n) && ehRegiao(n.name.text) && ts.isIdentifier(n.expression) && resolver(n.expression)?.tipo === "import")) {
      const p = n.parent;
      const ok = (ts.isIdentifier(n) && ehNome(n)) || ((ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p) || ts.isJsxClosingElement(p)) && p.tagName === n)
        || (ts.isVariableDeclaration(p) && p.initializer === n && ts.isIdentifier(p.name) && aliases.has(p.name.text))
        || (ts.isCallExpression(p) && p.arguments[0] === n && FABRICAS_DE_ELEMENTO.includes(nomeDoCallee(p.expression)))
        || ts.isExportSpecifier(p) || (ts.isPropertyAccessExpression(n) && ts.isPropertyAccessExpression(p) && p.expression === n);
      if (!ok) acusa(p, "opaco", `${canonico(n)} usado como valor: o que ele recebe não é verificável (falha fechada)`);
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
        if (setter && !ts.isIdentifier(setter.name)) acusa(p, "opaco", "setter do useState desestruturado de forma não verificável: falha fechada");
        else estados.push({ valor: v && !ts.isOmittedExpression(v) && ts.isIdentifier(v.name) ? v.name : null, setter: setter ? setter.name as ts.Identifier : null, no: n });
      } else acusa(n, "opaco", "useState sem desestruturar [valor, setter]: o setter não é verificável (falha fechada)");
    }
    ts.forEachChild(n, coletaEstados);
  };
  coletaEstados(sf);

  // Estado cujo VALOR vai para a região (não a condição: `{salvo ? "Salvo." : null}` não faz de `salvo` mensagem).
  const naRegiao = new Set<ts.Node>();
  for (const r of regioes) if (r.expr && !r.presumida) for (const id of identificadoresDeValor(r.expr)) {
    const a = alvoDe(resolver(id));
    if (a) naRegiao.add(a);
  }

  /** Cada chamada do setter/callback tem os argumentos conferidos; outro uso como valor falha fechado. */
  const confereChamadas = (usos: ts.Node[], rotulo: string) => {
    for (const u of usos) {
      const p = u.parent;
      if (ts.isCallExpression(p) && p.expression === u) {
        for (const arg of p.arguments) {
          const v = verificar(arg);
          if (v) { acusaVeredito(p, v, arg, (m: string) => `${rotulo} recebe erro (${m}) — use useAcaoCliente + FeedbackAcao (erro em role="alert")`, (m: string) => `${rotulo} recebe valor não verificável (${m})`); break; }
        }
      } else if (!vaiParaCallbackDeMensagem(u)) {
        acusa(ts.isJsxExpression(p) ? p.parent : p, "opaco", `${rotulo} usado como valor: o que ele recebe não é verificável (falha fechada; só pode ir para um atributo on<Palavra>, conferido no filho)`);
      }
    }
  };

  for (const e of estados) {
    if (!e.setter) continue;
    const nomeDoValor = e.valor?.text ?? e.setter.text.replace(/^set/, "").replace(/^./, (c: string) => c.toLowerCase());
    if (NOME_DE_ERRO.test(nomeDoValor)) continue; // estado de erro: vai para role="alert"
    const deMensagem = ESTADO_DE_MENSAGEM.test(nomeDoValor) || (!!e.valor && naRegiao.has(e.valor));
    if (!deMensagem) continue;
    confereChamadas(referencias(sf, e.setter, e.setter.text), `estado de mensagem "${nomeDoValor}"`);
  }

  // A — callback de mensagem recebido por prop (onNota, onFeito…): o setter visto do lado do filho.
  const coletaCallbacks = (n: ts.Node) => {
    if (ts.isBindingElement(n) && ts.isIdentifier(n.name)) {
      const chave = n.propertyName ?? n.name;
      // Das props do componente — ou de QUALQUER parâmetro desestruturado (função em memo/forwardRef, helper):
      // um `on<Palavra>` recebido de fora é o setter de outro componente.
      if ((ts.isIdentifier(chave) || ts.isStringLiteral(chave)) && CALLBACK_DE_MENSAGEM.test(chave.text) && (ehDasProps(n.name) || resolver(n.name)?.tipo === "parametro")) {
        confereChamadas(referencias(sf, n.name, n.name.text), `callback de mensagem "${chave.text}"`);
      }
    }
    if (ts.isPropertyAccessExpression(n) && CALLBACK_DE_MENSAGEM.test(n.name.text)) {
      const r = raizDe(n.expression);
      if (r && ehDasProps(r)) confereChamadas([n], `callback de mensagem "${n.name.text}"`);
    }
    ts.forEachChild(n, coletaCallbacks);
  };
  coletaCallbacks(sf);

  // C — sucesso do executar (useAcaoCliente).
  const coletaExecutar = (n: ts.Node) => {
    if (ts.isCallExpression(n) && n.arguments.length >= 2) {
      const c = desembrulha(n.expression);
      if (ts.isPropertyAccessExpression(c) && c.name.text === "executar") {
        acusaVeredito(n, verificar(n.arguments[1]), n.arguments[1], (m: string) => `sucesso do executar recebe erro (${m})`, (m: string) => `sucesso do executar não verificável (${m})`);
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
  /** A expressão é `nome` (window.location, location, `const l = window.location`, `const { location: l } = window`)? */
  const apontaPara = (e: ts.Expression, nome: string, prof = 0): boolean => {
    if (prof > PROFUNDIDADE_MAXIMA) return false;
    const x = desembrulha(e);
    if (ultimoNome(x) === nome) return true;
    if (ts.isIdentifier(x)) {
      const d = resolver(x);
      if (d?.tipo === "variavel" && d.no.initializer) {
        if (!d.elemento) return apontaPara(d.no.initializer, nome, prof + 1);
        const chave = d.elemento.propertyName ?? d.elemento.name;
        return ts.isIdentifier(chave) && chave.text === nome;
      }
    }
    return false;
  };
  /** A expressão lê a própria página: `location` (ou alias), `document.URL`/`documentURI`/`baseURI`/`document.location`. */
  const leAPropriaPagina = (e: ts.Node): boolean => {
    let tem = false;
    const visita = (m: ts.Node) => {
      if (tem) return;
      if ((ts.isIdentifier(m) || ts.isPropertyAccessExpression(m) || ts.isElementAccessExpression(m)) && apontaPara(m, "location")) { tem = true; return; }
      if ((ts.isPropertyAccessExpression(m) || ts.isElementAccessExpression(m)) && CAMPOS_DA_PROPRIA_PAGINA.includes(ultimoNome(m) ?? "") && apontaPara(m.expression, "document")) { tem = true; return; }
      ts.forEachChild(m, visita);
    };
    visita(e);
    return tem;
  };
  /** Destino literal (texto ou template) que não lê a própria página: é navegação, não recarga. */
  const destinoLiteral = (e: ts.Expression) => {
    const x = desembrulha(e);
    return (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x) || ts.isTemplateExpression(x)) && !leAPropriaPagina(x) && destinoAbsoluto(x);
  };
  /** Pai efetivo (sobe por parênteses, `as`, `!`). */
  const paiEfetivo = (m: ts.Node): { pai: ts.Node; filho: ts.Node } => {
    let filho = m, pai = m.parent;
    while (pai && (ts.isParenthesizedExpression(pai) || ts.isAsExpression(pai) || ts.isNonNullExpression(pai) || ts.isSatisfiesExpression(pai))) { filho = pai; pai = pai.parent; }
    return { pai, filho };
  };
  /** location (ou alias) usada como VALOR — passada a função, espalhada, guardada em objeto: o que se faz com ela não é verificável. */
  const locationComoValor = (m: ts.Node): boolean => {
    const ehLocation = (ts.isIdentifier(m) && !ehNome(m)) || ts.isPropertyAccessExpression(m);
    if (!ehLocation || !apontaPara(m as ts.Expression, "location")) return false;
    const { pai, filho } = paiEfetivo(m);
    if ((ts.isPropertyAccessExpression(pai) || ts.isElementAccessExpression(pai)) && pai.expression === filho) return false; // leitura de campo
    if (ts.isVariableDeclaration(pai) && pai.initializer === filho) return false; // alias (seguido por apontaPara)
    if (ts.isTypeOfExpression(pai)) return false;
    if (ts.isBinaryExpression(pai)) {
      const op = pai.operatorToken.kind;
      if (op >= ts.SyntaxKind.FirstAssignment && op <= ts.SyntaxKind.LastAssignment && pai.left === filho) return false; // alvo: regra da atribuição
      if ([ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(op)) return false;
    }
    return true;
  };
  /** window.open (do objeto de janela ou `open` global) — para o pegar também por `.call`/`.apply`/`.bind` ou como valor. */
  const ehOpenDaJanela = (m: ts.Node): boolean =>
    (ts.isIdentifier(m) && m.text === "open" && !ehNome(m) && !resolver(m))
    || ((ts.isPropertyAccessExpression(m) || ts.isElementAccessExpression(m)) && campoLido(m) === "open" && OBJETOS_DA_JANELA.some((o: string) => apontaPara(m.expression, o)));
  /** Objeto de janela (window, self…) — passado a um mutador de objeto ou espalhado, falha fechado. */
  const ehObjetoDeJanela = (m: ts.Node): boolean =>
    ((ts.isIdentifier(m) && !ehNome(m)) || ts.isPropertyAccessExpression(m)) && OBJETOS_DA_JANELA.some((o: string) => apontaPara(m as ts.Expression, o));
  const coletaRecarga = (n: ts.Node) => {
    if (ehOpenDaJanela(n)) {
      const { pai, filho } = paiEfetivo(n);
      if (!(ts.isCallExpression(pai) && pai.expression === filho)) acusa(n, "opaco", "window.open por .call/.apply/.bind ou como valor: o destino não é verificável — falha fechada");
    }
    if (ehObjetoDeJanela(n)) {
      const { pai, filho } = paiEfetivo(n);
      const mutado = ts.isCallExpression(pai) && pai.arguments[0] === filho && MUTADORES_DE_OBJETO.includes(nomeDoCallee(pai.expression));
      if (mutado || ts.isSpreadElement(pai) || ts.isSpreadAssignment(pai)) acusa(n, "opaco", "objeto de janela passado a um mutador de objeto (Object.assign, Reflect.set, defineProperty) ou espalhado: falha fechada");
    }
    if (locationComoValor(n)) acusa(n, "opaco", "location usada como valor (argumento, spread, objeto…): o que se faz com ela não é verificável — falha fechada");
    if (ts.isElementAccessExpression(n)) {
      const a = desembrulha(n.argumentExpression);
      if (!ts.isStringLiteralLike(a) && !ts.isNumericLiteral(a) && OBJETOS_DE_NAVEGACAO.some((o: string) => apontaPara(n.expression, o))) {
        acusa(n, "opaco", "campo computado de objeto de navegação (location/history/window…): pode ser a recarga — falha fechada");
      }
    }
    if (ts.isCallExpression(n) && nomeDoCallee(n.expression) === "open") {
      const c = desembrulha(n.expression);
      const daJanela = ts.isIdentifier(c) ? !resolver(c) : ts.isPropertyAccessExpression(c) && OBJETOS_DA_JANELA.some((o: string) => apontaPara(c.expression, o));
      const [destino, alvoJanela] = n.arguments;
      const alvo = alvoJanela ? desembrulha(alvoJanela) : null;
      const propriaJanela = !!alvo && (!ts.isStringLiteralLike(alvo) || ALVOS_DA_PROPRIA_JANELA.includes(alvo.text));
      if (daJanela && destino && propriaJanela) {
        if (leAPropriaPagina(destino) || (ehTextoLiteral(destino) && !destinoAbsoluto(destino))) acusa(n, "erro", "recarrega a página (window.open da própria página, ou de destino não absoluto, na mesma janela): use mensagem + router.refresh()");
        else if (!ehTextoLiteral(destino)) acusa(n, "opaco", "window.open na mesma janela com destino não literal: falha fechada");
      }
    }
    if (ts.isPropertyAccessExpression(n) && n.name.text === "reload") acusa(n, "erro", "recarrega a página (.reload): use mensagem + router.refresh()");
    if (ts.isElementAccessExpression(n)) { const a = desembrulha(n.argumentExpression); if (ts.isStringLiteralLike(a) && a.text === "reload") acusa(n, "erro", "recarrega a página ([\"reload\"]): use mensagem + router.refresh()"); }
    if (ts.isBindingElement(n)) {
      const chave = n.propertyName ?? n.name;
      const nomeChave = ts.isIdentifier(chave) || ts.isStringLiteral(chave) ? chave.text : null;
      if (nomeChave === "reload") acusa(n, "erro", "recarrega a página ({ reload }): use mensagem + router.refresh()");
      const decl = n.parent?.parent;
      if (nomeChave === "go" && decl && ts.isVariableDeclaration(decl) && decl.initializer && apontaPara(decl.initializer, "history")) acusa(n, "erro", "recarrega a página ({ go } de history): use mensagem + router.refresh()");
    }
    if (ts.isCallExpression(n)) {
      const c = desembrulha(n.expression);
      if (ts.isPropertyAccessExpression(c) && c.name.text === "go" && apontaPara(c.expression, "history")) acusa(n, "erro", "recarrega a página (history.go): use mensagem + router.refresh()");
      // `location.assign("/outra")` navega; `location.assign(location.href)`/`(document.URL)` recarrega a mesma página.
      if (ts.isPropertyAccessExpression(c) && ["assign", "replace"].includes(c.name.text) && apontaPara(c.expression, "location")) {
        const [destino] = n.arguments;
        if (!destino || leAPropriaPagina(destino) || (ehTextoLiteral(destino) && !destinoAbsoluto(destino))) acusa(n, "erro", `recarrega a página (location.${c.name.text} para a própria página ou destino não absoluto): use mensagem + router.refresh()`);
        else if (!ehTextoLiteral(destino)) acusa(n, "opaco", `location.${c.name.text} com destino não literal: falha fechada`);
      }
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
      const alvo = desembrulha(n.left);
      const naLocation = apontaPara(alvo, "location") || ((ts.isPropertyAccessExpression(alvo) || ts.isElementAccessExpression(alvo)) && apontaPara(alvo.expression, "location"));
      const navegacao = n.operatorToken.kind === ts.SyntaxKind.EqualsToken && destinoLiteral(n.right);
      if (naLocation && !navegacao) acusa(n, "erro", "atribuição a location (ou a um campo dela) que não é destino literal recarrega a página: use mensagem + router.refresh()");
    }
    ts.forEachChild(n, coletaRecarga);
  };
  coletaRecarga(sf);

  return achados;
}

// ---------------------------------------------------------------------------------------------------
// Exceções (arquivo + tipo + trecho exato + motivo) e a varredura.
// ---------------------------------------------------------------------------------------------------
/** `fontes` (obrigatório no tipo `erro`): as fontes de erro que a exceção aceita; uma fonte nova no trecho não casa. */
export type Excecao = { arquivo: string; tipo: TipoAchado; trecho: string; motivo: string; fontes?: string[] };

export const EXCECOES: Excecao[] = [
  {
    arquivo: "src/components/FeedbackAcao.tsx",
    tipo: "opaco",
    trecho: "texto={sucesso}",
    motivo: "é o par erro/sucesso: o erro sai no <p role=\"alert\"> logo acima; a região polite recebe só a prop `sucesso`, cujo conteúdo esta trava confere em cada tela que usa o FeedbackAcao",
  },
  {
    arquivo: "src/components/FeedbackAcao.tsx",
    tipo: "opaco",
    trecho: "progresso={progresso}",
    motivo: "texto de progresso (\"Processando…\") repassado à mesma região polite; cada tela que passa `progresso` é conferida por esta trava",
  },
  {
    arquivo: "src/app/(app)/academico/reposicoes/correcoes/[reposicaoId]/CorrecoesConclusaoReposicao.tsx",
    tipo: "opaco",
    trecho: "texto={correcao.impedimentoAprovacao}",
    motivo: "impedimento calculado no servidor (regra de negócio) mostrado como aviso antes da decisão; não é resultado de ação nem erro de transporte",
  },
  {
    arquivo: "src/app/(app)/matriculas/[id]/condicoes-horas/CondicoesHoras.tsx",
    tipo: "opaco",
    trecho: "texto={d.impedimento}",
    motivo: "impedimento calculado no servidor (regra de negócio) mostrado como aviso antes da preparação; não é resultado de ação nem erro de transporte",
  },
  {
    arquivo: "src/app/(app)/matriculas/[id]/continuidade-mensal/CondicoesContinuidadeMensal.tsx",
    tipo: "opaco",
    trecho: "texto={d.impedimento}",
    motivo: "impedimento calculado no servidor (regra de negócio) mostrado como aviso antes da preparação; não é resultado de ação nem erro de transporte",
  },
  {
    arquivo: "src/app/(app)/financeiro/acertos-vencimento/[matriculaId]/[propostaId]/page.tsx",
    tipo: "erro",
    trecho: "{p.reconciliacaoAcesso.erro}",
    fontes: ["p.reconciliacaoAcesso.erro"],
    motivo: "estado persistido do job de reconciliação de acesso (tentativas e último erro gravados no servidor), lido na carga da página junto do andamento; não é resultado de ação do operador",
  },
  {
    arquivo: "src/app/login/page.tsx",
    tipo: "erro",
    trecho: "{errors.email?.message}",
    fontes: ["errors.email?.message", "errors"],
    motivo: "erro de validação do campo (react-hook-form) ligado ao input por aria-describedby; região polite sempre montada para não interromper a digitação a cada tecla",
  },
  {
    arquivo: "src/app/login/page.tsx",
    tipo: "erro",
    trecho: "{errors.senha?.message}",
    fontes: ["errors.senha?.message", "errors"],
    motivo: "erro de validação do campo (react-hook-form) ligado ao input por aria-describedby; região polite sempre montada para não interromper a digitação a cada tecla",
  },
];

/**
 * Casa por arquivo + tipo + trecho — e, no tipo `erro`, cada fonte de erro achada tem de estar entre as que a
 * exceção aceita: a exceção de um valor "opaco" não isenta um erro, e a de um erro não isenta um erro NOVO.
 */
export function conferirExcecoes(achados: Achado[], excecoes: Excecao[]): { semExcecao: string[]; soltas: string[] } {
  const casa = (a: Achado, e: Excecao) => a.arquivo === e.arquivo && a.tipo === e.tipo && a.trecho === normaliza(e.trecho)
    && (e.tipo !== "erro" || a.fontes.every((f: string) => (e.fontes ?? []).includes(f)));
  return {
    semExcecao: achados.filter((a: Achado) => !excecoes.some((e: Excecao) => casa(a, e))).map((a: Achado) => `${a.arquivo}: [${a.tipo}] ${a.trecho} — ${a.problema}`),
    soltas: excecoes.filter((e: Excecao) => achados.filter((a: Achado) => casa(a, e)).length !== 1).map((e: Excecao) => `${e.arquivo}: [${e.tipo}] ${e.trecho}`),
  };
}

/** Os <FeedbackAcao> do arquivo que recebem `erro` E `sucesso` (pelo AST: a ordem dos atributos não importa). */
export function feedbacksCompletos(fonte: string, arquivo = "virtual.tsx"): number {
  const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let total = 0;
  const visita = (n: ts.Node) => {
    if ((ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) && n.tagName.getText(sf) === "FeedbackAcao") {
      const nomes = n.attributes.properties.filter(ts.isJsxAttribute).map((a: ts.JsxAttribute) => a.name.getText(sf));
      if (nomes.includes("erro") && nomes.includes("sucesso")) total++;
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return total;
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
  "src/app/(app)/matriculas/[id]/desistencia/financeiro/AcertoContratualFormularios.tsx",
  "src/app/(app)/matriculas/[id]/desistencia/financeiro/Formularios.tsx",
  "src/app/(app)/matriculas/[id]/fechamentos-horas/DecidirFechamento.tsx",
  "src/app/(app)/matriculas/[id]/fechamentos-horas/EmitirFechamento.tsx",
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
  const achados = arquivos.flatMap(({ arquivo, fonte }: { arquivo: string; fonte: string }) => analisar(fonte, arquivo));

  it("a varredura acha os arquivos (não passa vazia por erro de caminho) e inclui src/components", () => {
    expect(arquivos.length).toBeGreaterThan(300);
    expect(arquivos.map((a: { arquivo: string }) => a.arquivo)).toEqual(expect.arrayContaining(["src/components/FeedbackAcao.tsx", "src/components/MensagemStatus.tsx", ...MIGRADOS]));
  });

  it("nenhum estado de mensagem recebe erro, nenhuma região de status mostra erro, nada recarrega a página — exceções ancoradas", () => {
    expect(conferirExcecoes(achados, EXCECOES)).toEqual({ semExcecao: [], soltas: [] });
  });

  it("cada exceção tem motivo de verdade; a do tipo erro lista as fontes que aceita (e só ela)", () => {
    for (const e of EXCECOES) expect(e.motivo.trim().length, `${e.arquivo}: ${e.trecho}`).toBeGreaterThan(30);
    for (const e of EXCECOES) expect(e.tipo === "erro" ? (e.fontes ?? []).length > 0 : e.fontes === undefined, `${e.arquivo}: ${e.trecho}`).toBe(true);
  });

  it("as fontes aceitas por exceção do tipo erro são as combinadas (cópia literal)", () => {
    expect(EXCECOES.filter((e: Excecao) => e.tipo === "erro").map((e: Excecao) => `${e.trecho} :: ${(e.fontes ?? []).join(" | ")}`)).toEqual([
      "{p.reconciliacaoAcesso.erro} :: p.reconciliacaoAcesso.erro",
      "{errors.email?.message} :: errors.email?.message | errors",
      "{errors.senha?.message} :: errors.senha?.message | errors",
    ]);
  });

  it("a lista de exceções é a combinada (cópia literal: acrescentar exceção exige mexer aqui também)", () => {
    expect(EXCECOES.map((e: Excecao) => `${e.arquivo} :: ${e.tipo} :: ${e.trecho}`)).toEqual([
      "src/components/FeedbackAcao.tsx :: opaco :: texto={sucesso}",
      "src/components/FeedbackAcao.tsx :: opaco :: progresso={progresso}",
      "src/app/(app)/academico/reposicoes/correcoes/[reposicaoId]/CorrecoesConclusaoReposicao.tsx :: opaco :: texto={correcao.impedimentoAprovacao}",
      "src/app/(app)/matriculas/[id]/condicoes-horas/CondicoesHoras.tsx :: opaco :: texto={d.impedimento}",
      "src/app/(app)/matriculas/[id]/continuidade-mensal/CondicoesContinuidadeMensal.tsx :: opaco :: texto={d.impedimento}",
      "src/app/(app)/financeiro/acertos-vencimento/[matriculaId]/[propostaId]/page.tsx :: erro :: {p.reconciliacaoAcesso.erro}",
      "src/app/login/page.tsx :: erro :: {errors.email?.message}",
      "src/app/login/page.tsx :: erro :: {errors.senha?.message}",
    ]);
  });

  it("os componentes migrados seguem no padrão: useAcaoCliente + <FeedbackAcao> com erro E sucesso (qualquer ordem)", () => {
    for (const arquivo of MIGRADOS) {
      const fonte = readFileSync(arquivo, "utf8");
      expect(fonte, arquivo).toMatch(/\buseAcaoCliente\(/);
      expect(feedbacksCompletos(fonte, arquivo), arquivo).toBeGreaterThan(0);
    }
  });

  it("feedbacksCompletos (autoteste): a ordem dos atributos não importa; sem `sucesso` (ou sem `erro`) não conta", () => {
    expect(feedbacksCompletos("const a = <FeedbackAcao erro={x.erro} sucesso={x.sucesso} />;")).toBe(1);
    expect(feedbacksCompletos("const a = <FeedbackAcao sucesso={x.sucesso} className=\"mt-2\" erro={x.erro} />;")).toBe(1);
    expect(feedbacksCompletos("const a = <FeedbackAcao erro={x.erro} />;")).toBe(0);
    expect(feedbacksCompletos("const a = <FeedbackAcao sucesso={x.sucesso} />;")).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------
// Autotestes em fonte virtual: cada evasão é acusada; as formas certas passam.
// ---------------------------------------------------------------------------------------------------
const IMPORTS = 'import { MensagemStatus } from "@/components/MensagemStatus";\nimport { FeedbackAcao } from "@/components/FeedbackAcao";\nimport { MSG_RESULTADO_INCERTO, MSG_RESULTADO_INCERTO_SEM_CHAVE, MSG_DECISAO_INCERTA } from "@/lib/mensagens";\n';
/** Um componente com um estado `mensagem` e o corpo/JSX dados. */
const tela = (corpo: string, jsx = "<MensagemStatus texto={mensagem} />", estado = "mensagem") =>
  `${IMPORTS}export function Tela({ r }: { r: { ok: boolean; erro?: string } }) {\n  const [${estado}, set${capital(estado)}] = useState("");\n  const [erro, setErro] = useState<string | null>(null);\n  ${corpo}\n  return <div>${jsx}</div>;\n}\n`;
const problemas = (fonte: string) => analisar(fonte).map((a: Achado) => a.problema);
const trechos = (fonte: string) => analisar(fonte).map((a: Achado) => a.trecho);

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
    const incertas = Object.keys(MENSAGENS).filter((k: string) => /INCERT/.test(k));
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
    expect(problemas(tela('function avisar(t: string) { setMensagem(t); }', "<Filho onClick={avisar} />"))).toEqual([expect.stringMatching(/passada adiante/)]);
    // Para um atributo on<Palavra> pode: quem chama é o filho, e a chamada lá é conferida (E29).
    expect(analisar(tela('function avisar(t: string) { setMensagem(t); }', "<Filho onAviso={avisar} />"))).toEqual([]);
    expect(problemas(tela("function s(p: Promise<string>) { void p.then((t) => setMensagem(t)); }"))).toEqual([expect.stringMatching(/função anônima/)]);
    expect(problemas(tela("function avisar({ t }: { t: string }) { setMensagem(t); } avisar({ t: \"x\" });"))).toEqual([expect.stringMatching(/desestruturado/)]);
  });
  it("E9 — setter de mensagem passado como valor ou com outro nome falha fechado (só um atributo on<Palavra> pode recebê-lo)", () => {
    expect(trechos(tela("", "<Filho onTexto={setMensagem} />"))).toEqual(["onTexto={setMensagem}"]);
    expect(analisar(tela("", "<Filho onMensagem={setMensagem} />"))).toEqual([]);
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
    expect(analisar("export function T( { return <div>; }")).toEqual([{ arquivo: "virtual.tsx", trecho: "(arquivo)", tipo: "opaco", problema: expect.stringMatching(/falha fechada/), fontes: [] }]);
  });
  it("conferirExcecoes: achado sem exceção acusa; exceção sem alvo, com alvo trocado, de outro tipo ou ambígua fica solta", () => {
    const a: Achado = { arquivo: "x.tsx", trecho: "texto={erro}", tipo: "opaco", problema: "p", fontes: [] };
    const e: Excecao = { arquivo: "x.tsx", trecho: "texto={erro}", tipo: "opaco", motivo: "m" };
    expect(conferirExcecoes([a], [])).toEqual({ semExcecao: ["x.tsx: [opaco] texto={erro} — p"], soltas: [] });
    expect(conferirExcecoes([a], [e])).toEqual({ semExcecao: [], soltas: [] });
    expect(conferirExcecoes([], [e])).toEqual({ semExcecao: [], soltas: ["x.tsx: [opaco] texto={erro}"] });
    expect(conferirExcecoes([{ ...a, arquivo: "y.tsx" }], [e])).toEqual({ semExcecao: ["y.tsx: [opaco] texto={erro} — p"], soltas: ["x.tsx: [opaco] texto={erro}"] });
    expect(conferirExcecoes([a, { ...a, problema: "q" }], [e]).soltas).toEqual(["x.tsx: [opaco] texto={erro}"]); // ambígua
    // R1 da #153 (B4b): a exceção de um valor opaco não isenta um ERRO que passe a sair no mesmo trecho.
    expect(conferirExcecoes([{ ...a, tipo: "erro" }], [e])).toEqual({ semExcecao: ["x.tsx: [erro] texto={erro} — p"], soltas: ["x.tsx: [opaco] texto={erro}"] });
    // R2 da #153 (B6): a exceção do tipo erro aceita só as fontes listadas; uma fonte nova no trecho não casa.
    const comFonte: Excecao = { ...e, tipo: "erro", fontes: ["d.falhas"] };
    expect(conferirExcecoes([{ ...a, tipo: "erro", fontes: ["d.falhas"] }], [comFonte])).toEqual({ semExcecao: [], soltas: [] });
    expect(conferirExcecoes([{ ...a, tipo: "erro", fontes: ["d.falhas", "MSG_RESULTADO_INCERTO_SEM_CHAVE"] }], [comFonte]))
      .toEqual({ semExcecao: ["x.tsx: [erro] texto={erro} — p"], soltas: ["x.tsx: [erro] texto={erro}"] });
  });
});

// ---------------------------------------------------------------------------------------------------
// R1 da #153: evasões que sobreviviam (L1–L12, X1, C2 da revisão). Uma fonte virtual por forma; as
// listas novas (funções do executor, campos da própria página) são comparadas com cópias literais.
// ---------------------------------------------------------------------------------------------------
describe("R1 da #153 — B1: o fluxo do valor é seguido de verdade", () => {
  it("E21 (L1) — .mensagem de um desfecho do executor é erro ou incerto: direto, por acao.executar e desestruturado", () => {
    expect(trechos(tela('async function s() { const d = await executarAcaoCliente(() => f(), { idempotente: true }); if (d.tipo !== "ok") { setMensagem(d.mensagem); return; } setMensagem("Salvo."); }')))
      .toEqual(["setMensagem(d.mensagem)"]);
    expect(trechos(tela("async function s(acao: Acao) { const d = await acao.executar(() => f()); if (d && d.tipo !== \"ok\") setMensagem(d.mensagem); }")))
      .toEqual(["setMensagem(d.mensagem)"]);
    expect(trechos(tela("async function s() { const d = await executarAcaoCliente(() => f(), { idempotente: false }); const { mensagem: m } = d as { mensagem: string }; setMensagem(m); }")))
      .toEqual(["setMensagem(m)"]);
    // Controle: `.mensagem` de outro objeto (não é desfecho do executor) é dado.
    expect(analisar(tela('async function s() { const d = await consultar(); setMensagem(d.mensagem ?? ""); }'))).toEqual([]);
  });
  it("lista fechada de funções do executor: o .mensagem do que cada uma devolve acusa", () => {
    const FUNCOES = ["executar", "executarAcaoCliente"];
    expect(FUNCOES_DO_EXECUTOR).toEqual(FUNCOES);
    for (const f of FUNCOES) expect(trechos(tela(`async function s() { const d = await ${f}(() => g()); setMensagem(d.mensagem); }`)), f).toEqual(["setMensagem(d.mensagem)"]);
  });
  it("E22 (L2) — função de fora não lava a variável do catch: String(alias), String(e), JSON.stringify(e)", () => {
    expect(trechos(tela("async function s() { try { await f(); } catch (e) { const causa = e; setMensagem(String(causa)); } }"))).toEqual(["setMensagem(String(causa))"]);
    expect(trechos(tela("async function s() { try { await f(); } catch (e) { setMensagem(JSON.stringify(e)); } }"))).toEqual(["setMensagem(JSON.stringify(e))"]);
    expect(trechos(tela("async function s() { try { await f(); } catch (e) { const partes = [e]; setMensagem(partes.join(\" \")); } }"))).toEqual(['setMensagem(partes.join(" "))']);
  });
  it("E23 (L3) — parâmetro de .catch(f) e de .then(ok, f) é o erro; parâmetro de callback anônimo falha fechado mesmo dentro de String()", () => {
    expect(trechos(tela("async function s() { await f().catch((e) => { setMensagem(String(e)); throw e; }); }"))).toEqual(["setMensagem(String(e))"]);
    expect(problemas(tela("async function s() { await f().catch((e) => { setMensagem(String(e)); throw e; }); }"))).toEqual([expect.stringMatching(/\.catch\/\.then/)]);
    expect(trechos(tela("function s() { void f().then(() => undefined, (motivo) => setMensagem(String(motivo))); }"))).toEqual(["setMensagem(String(motivo))"]);
    expect(problemas(tela("function s(p: Promise<string>) { void p.then((t) => setMensagem(String(t))); }"))).toEqual([expect.stringMatching(/função anônima/)]);
  });
  it("E24 (L4) — campo de objeto local: o objeto literal (ou o que a função local devolve) é seguido", () => {
    expect(trechos(tela("function s() { if (!r.ok) { const saida = { texto: r.erro ?? \"\" }; setMensagem(saida.texto); return; } }"))).toEqual(["setMensagem(saida.texto)"]);
    expect(trechos(tela("function s() { const montar = () => ({ texto: r.erro ?? \"\" }); setMensagem(montar().texto); }"))).toEqual(["setMensagem(montar().texto)"]);
    expect(trechos(tela("function s() { let saida = { texto: \"Salvo.\" }; saida = { texto: r.erro ?? \"\" }; setMensagem(saida.texto); }"))).toEqual(["setMensagem(saida.texto)"]);
    // Controle: o campo certo do objeto é sucesso, mesmo que outro campo seja erro.
    expect(analisar(tela("function s() { const saida = { texto: \"Salvo.\", detalhe: r.erro }; setMensagem(saida.texto); }"))).toEqual([]);
  });
  it("E25 (L5) — atribuição por desestruturação ao let: a chave diz o que é; array e chave computada também", () => {
    expect(trechos(tela("function s() { let t = \"\"; ({ erro: t } = r as { erro: string }); setMensagem(t); }"))).toEqual(["setMensagem(t)"]);
    expect(trechos(tela("function s() { let u = \"\"; [u] = [r.erro ?? \"\"]; setMensagem(u); }"))).toEqual(["setMensagem(u)"]);
    expect(problemas(tela("function s(k: string) { let t = \"\"; ({ [k]: t } = r as Record<string, string>); setMensagem(t); }"))).toEqual([expect.stringMatching(/chave computada/)]);
  });
  it("E26 (L6) — valor padrão do parâmetro conta (a chamada sem o argumento usa ele)", () => {
    expect(trechos(tela("function avisar(t: string = MSG_RESULTADO_INCERTO) { setMensagem(t); } function s() { avisar(); }"))).toEqual(["setMensagem(t)"]);
    expect(trechos(tela("const avisar = (t = \"Falha ao salvar.\") => setMensagem(t); function s() { avisar(); }"))).toEqual(["setMensagem(t)"]);
    expect(trechos(tela("function avisar({ t = r.erro ?? \"\" }: { t?: string }) { setMensagem(t); } avisar({});"))).toEqual(["setMensagem(t)"]);
  });
});

describe("R1 da #153 — B2: tudo dentro de role=\"status\"/aria-live=\"polite\" é região", () => {
  const reg = (jsx: string) => `${IMPORTS}export function T({ r }: { r: { ok: boolean; erro?: string } }) { const erro = r.erro; return <div>${jsx}</div>; }\n`;
  it("E27 (L7) — expressão em elemento aninhado e texto fixo de erro acusam; dentro de role=\"alert\" não", () => {
    expect(trechos(reg('<p role="status" className="text-red-700"><span>{erro}</span></p>'))).toEqual(["{erro}"]);
    expect(trechos(reg('<div aria-live="polite"><p><strong>{r.erro}</strong></p></div>'))).toEqual(["{r.erro}"]);
    expect(trechos(reg('<p role="status"><strong>Falha ao salvar.</strong></p>'))).toEqual(["Falha ao salvar."]);
    expect(trechos(reg('<p role="status">Não foi possível registrar.</p>'))).toEqual(["Não foi possível registrar."]);
    expect(trechos(reg('<p role="status"><>{erro}</></p>'))).toEqual(["{erro}"]);
    expect(analisar(reg('<div role="status"><p role="alert">{erro}</p></div>'))).toEqual([]);
    expect(analisar(reg('<p role="status"><span>Salvo.</span></p>'))).toEqual([]);
  });
});

describe("R1 da #153 — B3: variantes de recarga", () => {
  const acusa = (f: string) => analisar(`export function T() { const s = () => { ${f} }; return <button onClick={s}>Ok</button>; }\n`).map((a: Achado) => a.tipo);
  it("E28 (L9–L12) — campo qualquer da location, document.URL, atribuição composta, alias de history e de location", () => {
    const FORMAS = [
      "window.location.search = window.location.search;", // L9
      "window.location.href = document.URL;", // L10
      "const h = window.history; h.go(0);", // L11
      'window.location.href += "";', // L12
      "const { go } = window.history; go(0);",
      "const { go: ir } = history; ir(0);",
      "const l = window.location; l.href = l.href;",
      "const { location: l } = window; l.hash = l.hash;",
      "location.assign(document.URL);",
      "window.location.replace(document.documentURI);",
      "location.href = String(location);",
    ];
    for (const f of FORMAS) expect(acusa(f), f).toContain("erro");
  });
  it("lista fechada de campos da própria página em document: cada um acusa", () => {
    const CAMPOS = ["URL", "documentURI", "baseURI", "location"];
    expect(CAMPOS_DA_PROPRIA_PAGINA).toEqual(CAMPOS);
    // Por location.assign (que só acusa quando o destino lê a própria página), não por atribuição — esta
    // acusa qualquer destino não literal e não provaria o item da lista.
    for (const c of CAMPOS) expect(acusa(`location.assign(document.${c});`), c).toContain("erro");
    // R3: destino não literal no location.assign falha fechado (opaco) — não é a própria página, mas não dá para saber.
    expect(acusa("location.assign(document.title);")).toEqual(["opaco"]);
  });
  it("controle: destino literal (texto ou template) para outra página continua permitido", () => {
    expect(acusa('window.location.href = "/login";')).toEqual([]);
    expect(acusa("window.location.href = \"https://exemplo.com/sair\";")).toEqual([]); // R3: só destino absoluto é navegação
    expect(acusa("const id = \"1\"; location.assign(`/alunos/${id}`);")).toEqual([]);
  });
});

describe("R1 da #153 — B4: callback de mensagem recebido por prop (on<Palavra>) é conferido no filho", () => {
  const filho = (corpo: string, assinatura = "{ onNota }: { onNota: (m: string | null) => void }") =>
    `${IMPORTS}export function Filho(${assinatura}) { const s = async () => { const r = await f(); ${corpo} }; return <button onClick={s}>Ok</button>; }\n`;
  it("E29 (X1) — erro por onNota acusa: direto, renomeado, por props.onNota e por helper", () => {
    expect(trechos(filho('if (!r.ok) return onNota(r.erro ?? ""); onNota("Salvo.");'))).toEqual(['onNota(r.erro ?? "")']);
    expect(trechos(filho('if (!r.ok) return avisar(r.erro ?? "");', "{ onNota: avisar }: { onNota: (m: string) => void }"))).toEqual(['avisar(r.erro ?? "")']);
    expect(trechos(filho('if (!r.ok) props.onNota(r.erro ?? "");', "props: { onNota: (m: string) => void }"))).toEqual(['props.onNota(r.erro ?? "")']);
    expect(trechos(filho('const run = (msg: string) => onNota(msg); if (!r.ok) run(r.erro ?? "");'))).toEqual(["onNota(msg)"]);
  });
  it("E29 — o callback passado a algo que não é on<Palavra> falha fechado; repassado a on<Palavra>, não", () => {
    expect(problemas(`${IMPORTS}export function Filho({ onNota }: { onNota: (m: string) => void }) { return <Neto onClick={onNota} />; }\n`)).toEqual([expect.stringMatching(/usado como valor/)]);
    expect(analisar(`${IMPORTS}export function Filho({ onNota }: { onNota: (m: string) => void }) { return <Neto onNota={onNota} />; }\n`)).toEqual([]);
    // No pai: o setter vai para on<Palavra>, direto ou por função; o argumento é conferido no filho.
    expect(analisar(`${IMPORTS}export function Pai() { const [nota, setNota] = useState<string | null>(null); return <><MensagemStatus texto={nota} /><Filho onNota={setNota} /><Filho onNota={(m) => setNota(m)} /></>; }\n`)).toEqual([]);
  });
  it("lista fechada: cada palavra de mensagem vira callback on<Palavra> conferido", () => {
    for (const p of ["mensagem", "msg", "aviso", "nota", "sucesso", "feito", "retorno", "feedback", "resultado", "ok"]) {
      const nome = `on${capital(p)}`;
      expect(trechos(filho(`if (!r.ok) ${nome}(r.erro ?? "");`, `{ ${nome} }: { ${nome}: (m: string) => void }`)), nome).toEqual([`${nome}(r.erro ?? "")`]);
    }
  });
});

describe("R1 da #153 — C2: cloneElement de um componente de região", () => {
  const imp = 'import { cloneElement } from "react";\n';
  it("E30 — cloneElement(<MensagemStatus/>, { texto: erro }) acusa, direto ou por constante", () => {
    expect(trechos(`${IMPORTS}${imp}export function T({ r }: { r: { erro?: string } }) { return <div>{cloneElement(<MensagemStatus texto={null} />, { texto: r.erro })}</div>; }\n`)).toEqual(["texto: r.erro"]);
    expect(trechos(`${IMPORTS}${imp}export function T({ r }: { r: { erro?: string } }) { const base = <MensagemStatus texto={null} />; return <div>{cloneElement(base, { texto: r.erro })}</div>; }\n`)).toEqual(["texto: r.erro"]);
    expect(analisar(`${IMPORTS}${imp}export function T() { return <div>{cloneElement(<MensagemStatus texto={null} />, { texto: "Salvo." })}</div>; }\n`)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
// R2 da #153: evasões que sobreviviam (L14–L16, L19–L25, L26/L28/L33, X8, EX1). Uma fonte virtual por
// forma; as listas novas são comparadas com cópias literais, com um caso por item.
// ---------------------------------------------------------------------------------------------------
describe("R2 da #153 — B1: desfecho do executor reconhecido pelo import, pelo let e pela função local", () => {
  it("E31 (L14) — `let d; d = await executarAcaoCliente(…)`: as atribuições do let contam", () => {
    expect(trechos(tela('async function s() { let d; d = await executarAcaoCliente(() => f(), { idempotente: true }); if (d.tipo !== "ok") { setMensagem(d.mensagem); return; } }')))
      .toEqual(["setMensagem(d.mensagem)"]);
  });
  it("E32 (L15) — função local que devolve o desfecho: `const rodar = () => executarAcaoCliente(…)`", () => {
    expect(trechos(tela('async function s() { const rodar = () => executarAcaoCliente(() => f(), { idempotente: true }); const d = await rodar(); if (d.tipo !== "ok") setMensagem(d.mensagem); }')))
      .toEqual(["setMensagem(d.mensagem)"]);
    expect(trechos(tela('async function rodar() { return await executarAcaoCliente(() => f(), { idempotente: false }); } async function s() { const d = await rodar(); if (d.tipo !== "ok") setMensagem(d.mensagem); }')))
      .toEqual(["setMensagem(d.mensagem)"]);
  });
  it("E33 (L16) — import renomeado e por namespace do módulo do executor; o mesmo nome vindo de outro módulo é dado", () => {
    const renomeado = 'import { executarAcaoCliente as rodarAcao } from "@/lib/acao-cliente";\n';
    expect(trechos(renomeado + tela('async function s() { const d = await rodarAcao(() => f(), { idempotente: true }); if (d.tipo !== "ok") setMensagem(d.mensagem); }')))
      .toEqual(["setMensagem(d.mensagem)"]);
    const namespace = 'import * as AC from "@/lib/acao-cliente";\n';
    expect(trechos(namespace + tela('async function s() { const d = await AC.executarAcaoCliente(() => f(), { idempotente: true }); if (d.tipo !== "ok") setMensagem(d.mensagem); }')))
      .toEqual(["setMensagem(d.mensagem)"]);
    const outro = 'import { executarAcaoCliente } from "@/lib/outra-coisa";\n';
    expect(analisar(outro + tela('async function s() { const d = await executarAcaoCliente(); setMensagem(d.mensagem ?? ""); }'))).toEqual([]);
  });
  it("módulo do executor (cópia literal) e funções da lista exportadas por ele de verdade", () => {
    expect(MODULO_DO_EXECUTOR).toBe("src/lib/acao-cliente"); // R3: caminho resolvido (alias ou relativo)
    // `executar` é o método do useAcaoCliente; as demais são exportações do módulo.
    for (const f of FUNCOES_DO_EXECUTOR.filter((n: string) => n !== "executar")) expect(Object.keys(ACAO_CLIENTE), f).toContain(f);
  });
});

describe("R2 da #153 — B2: região polite por constante, implícita, não literal e JSX dentro da expressão", () => {
  const reg = (jsx: string, corpo = "", antes = "") => `${antes}${IMPORTS}export function T({ r, papel }: { r: { ok: boolean; erro?: string }; papel: () => string }) { const erro = r.erro; ${corpo} return <div>${jsx}</div>; }\n`;
  it("E34 (L19) — role por constante e por ternário de literais", () => {
    expect(trechos(reg("<p role={PAPEL}>{erro}</p>", "", 'const PAPEL = "status";\n'))).toEqual(["{erro}"]);
    expect(trechos(reg('<p role={r.ok ? "status" : "alert"}>{erro}</p>'))).toEqual(["{erro}"]);
  });
  it("E35 — role/aria-live não literal e spread opaco: o elemento é tratado como região (falha fechada)", () => {
    expect(trechos(reg("<p role={papel()}>{erro}</p>"))).toEqual(["{erro}"]);
    expect(trechos(reg("<p aria-live={papel()}>{erro}</p>"))).toEqual(["{erro}"]);
    expect(trechos(reg("<p {...(r as object)}>{erro}</p>"))).toEqual(["{erro}"]);
    expect(trechos(reg('<p {...{ role: "status" }}>{erro}</p>'))).toEqual(["{erro}"]); // L20: spread de objeto literal
    // Controles: papel que só pode ser alerta/diálogo, e campo sem conteúdo, não são região.
    expect(analisar(reg('<p role={r.ok ? undefined : "alert"}>{erro}</p>'))).toEqual([]);
    expect(analisar(reg('<p role={r.ok ? "dialog" : undefined}>{erro}</p>'))).toEqual([]);
    expect(analisar(reg("<input {...(r as object)} />"))).toEqual([]);
  });
  it("E36 (L21, L23) — região implícita: <output> e role=\"log\"", () => {
    expect(trechos(reg('<output className="block text-red-700">{erro}</output>'))).toEqual(["{erro}"]);
    expect(trechos(reg('<p role="log">{erro}</p>'))).toEqual(["{erro}"]);
  });
  it("lista fechada de papéis e elementos polite: cada item vira região", () => {
    const PAPEIS = ["status", "log"];
    const ELEMENTOS = ["output"];
    expect(PAPEIS_POLITE).toEqual(PAPEIS);
    expect(ELEMENTOS_POLITE).toEqual(ELEMENTOS);
    for (const p of PAPEIS) expect(trechos(reg(`<div role="${p}">{erro}</div>`)), p).toEqual(["{erro}"]);
    for (const el of ELEMENTOS) expect(trechos(reg(`<${el}>{erro}</${el}>`)), el).toEqual(["{erro}"]);
  });
  it("E37 (L25) — JSX dentro da expressão da região: `{x ? <span>{x}</span> : null}` e `{x && <b>{x}</b>}`", () => {
    expect(trechos(reg('<p role="status">{detalhe ? <span>{detalhe}</span> : null}</p>', "const detalhe = erro;"))).toEqual(["{detalhe ? <span>{detalhe}</span> : null}"]);
    expect(trechos(reg('<p role="status">{r.ok && <b className="x">{detalhe}</b>}</p>', "const detalhe = erro;"))).toEqual(['{r.ok && <b className="x">{detalhe}</b>}']);
    expect(analisar(reg('<p role="status">{r.ok ? <span>Salvo.</span> : null}</p>'))).toEqual([]);
  });
  it("E38 (L24) — dangerouslySetInnerHTML na região (no elemento e aninhado)", () => {
    expect(trechos(reg('<p role="status" dangerouslySetInnerHTML={{ __html: erro ?? "" }} />'))).toEqual(['dangerouslySetInnerHTML={{ __html: erro ?? "" }}']);
    expect(trechos(reg('<div role="status"><span dangerouslySetInnerHTML={{ __html: erro ?? "" }} /></div>'))).toEqual(['dangerouslySetInnerHTML={{ __html: erro ?? "" }}']);
  });
});

describe("R2 da #153 — B3: recarga por campo computado, window.open e location como valor", () => {
  const tiposDe = (f: string) => analisar(`export function T({ k }: { k: string }) { const s = () => { ${f} }; return <button onClick={s}>Ok</button>; }\n`).map((a: Achado) => a.tipo);
  it("E39 (L26) — campo computado em objeto de navegação falha fechado", () => {
    expect(tiposDe('window.location[("re" + "load") as "reload"]();')).toContain("opaco");
    expect(tiposDe("history[k](0);")).toContain("opaco");
  });
  it("lista fechada de objetos de navegação: campo computado em cada um falha fechado", () => {
    const OBJETOS = ["location", "history", "window", "globalThis", "document", "self", "top", "parent", "frames"];
    expect(OBJETOS_DE_NAVEGACAO).toEqual(OBJETOS);
    for (const o of OBJETOS) expect(tiposDe(`${o}[k];`), o).toEqual(["opaco"]);
    expect(tiposDe('window["location"].hash;')).toEqual([]); // chave literal: é o campo nomeado, conferido pelas outras regras
  });
  it("E40 (L28) — window.open da própria página na mesma janela recarrega", () => {
    expect(tiposDe('window.open(window.location.href, "_self");')).toContain("erro");
    expect(tiposDe('open(document.URL, "_top");')).toContain("erro");
    expect(tiposDe("window.open(location.href, k);")).toContain("erro"); // alvo não literal
    expect(tiposDe("window.open(location.href);")).toEqual([]); // nova janela
    expect(tiposDe('window.open("/relatorio", "_self");')).toEqual([]); // outra página
  });
  it("listas fechadas de alvos da própria janela e de objetos da janela: cada item acusa", () => {
    const ALVOS = ["_self", "_top", "_parent"];
    const JANELAS = ["window", "globalThis", "self", "top", "parent", "frames"];
    expect(ALVOS_DA_PROPRIA_JANELA).toEqual(ALVOS);
    expect(OBJETOS_DA_JANELA).toEqual(JANELAS);
    for (const a of ALVOS) expect(tiposDe(`window.open(location.href, "${a}");`), a).toContain("erro");
    for (const j of JANELAS) expect(tiposDe(`${j}.open(location.href, "_self");`), j).toContain("erro");
    expect(tiposDe('window.open(location.href, "_blank");')).toEqual([]);
  });
  it("E41 (L33) — location (ou alias) passada como valor falha fechado", () => {
    expect(tiposDe("Object.assign(window.location, { href: window.location.href });")).toContain("opaco");
    expect(tiposDe('Reflect.set(location, "href", location.href);')).toContain("opaco");
    expect(tiposDe('const l = window.location; Object.defineProperty(l, "href", { value: l.href });')).toContain("opaco");
    expect(tiposDe("const lugares = [window.location];")).toContain("opaco");
    // Controles: leitura de campo, alias, typeof e comparação passam.
    expect(tiposDe('const p = new URLSearchParams(window.location.search); const l = window.location; const t = typeof location; const igual = l === window.location; void [p, t, igual, l.hash];')).toEqual([]);
  });
});

describe("R2 da #153 — B4: componente em memo/forwardRef e on<Palavra> de qualquer parâmetro", () => {
  const fonte = (definicao: string) => `${IMPORTS}import { memo, forwardRef } from "react";\n${definicao}\n`;
  const corpo = 'const s = async () => { const r = await f(); if (!r.ok) return onNota(r.erro ?? ""); onNota("Salvo."); }; return <button onClick={s}>Ok</button>;';
  it("E42 (X8) — filho em memo (função nomeada e arrow), em forwardRef e em React.memo: o onNota é conferido", () => {
    expect(trechos(fonte(`export const Filho = memo(function Filho({ onNota }: { onNota: (m: string) => void }) { ${corpo} });`))).toEqual(['onNota(r.erro ?? "")']);
    expect(trechos(fonte(`export const Filho = memo(({ onNota }: { onNota: (m: string) => void }) => { ${corpo} });`))).toEqual(['onNota(r.erro ?? "")']);
    expect(trechos(fonte(`export const Filho = forwardRef(function Filho({ onNota }: { onNota: (m: string) => void }, ref) { void ref; ${corpo} });`))).toEqual(['onNota(r.erro ?? "")']);
    expect(trechos(fonte(`export const Filho = React.memo(forwardRef(({ onNota }: { onNota: (m: string) => void }) => { ${corpo} }));`))).toEqual(['onNota(r.erro ?? "")']);
  });
  it("E43 — on<Palavra> desestruturado de qualquer parâmetro (helper, função passada adiante) é conferido", () => {
    expect(trechos(fonte('function avisar({ onAviso }: { onAviso: (m: string) => void }, r: { erro?: string }) { onAviso(r.erro ?? ""); }'))).toEqual(['onAviso(r.erro ?? "")']);
    expect(trechos(fonte('export const lista = [1].map(({ onAviso }: { onAviso: (m: string) => void }) => onAviso(MSG_RESULTADO_INCERTO));'))).toEqual(["onAviso(MSG_RESULTADO_INCERTO)"]);
  });
  it("lista fechada de embrulhos: a função dentro de cada um continua componente (prop é prop)", () => {
    const EMBRULHOS = ["memo", "forwardRef"];
    expect(EMBRULHOS_DE_COMPONENTE).toEqual(EMBRULHOS);
    for (const w of EMBRULHOS) {
      expect(problemas(fonte(`export const C = ${w}(function C({ t }: { t: string }) { return <MensagemStatus texto={t} />; });`)), w).toEqual([expect.stringMatching(/prop do componente/)]);
    }
  });
});

describe("R2 da #153 — B6: o achado do tipo erro leva todas as fontes; a exceção aceita só as listadas", () => {
  it("E44 (EX1) — uma segunda fonte de erro no mesmo trecho aparece nas fontes do achado", () => {
    const lote = (extra: string) => tela(`function s(d: { falhas: number }) { const partes = [d.falhas ? \`\${d.falhas} falhou\` : null${extra}].filter(Boolean); setMensagem(\`Lote: \${partes.join(" ")}.\`); }`);
    expect(analisar(lote("")).map((a: Achado) => a.fontes)).toEqual([["d.falhas"]]);
    expect(analisar(lote(", d.falhas ? MSG_RESULTADO_INCERTO_SEM_CHAVE : null")).map((a: Achado) => a.fontes)).toEqual([["d.falhas", "MSG_RESULTADO_INCERTO_SEM_CHAVE"]]);
  });
  it("fontesDeErro segue o fluxo inteiro (não para na primeira): const, ternário e campo de objeto", () => {
    const sf = ts.createSourceFile("v.tsx", 'const r = { erro: "x" }; const t = r.erro; const v = cond ? t : MSG_DECISAO_INCERTA;', ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const ultima = sf.statements[2] as ts.VariableStatement;
    expect(fontesDeErro(ultima.declarationList.declarations[0].initializer!)).toEqual(["MSG_DECISAO_INCERTA", "r.erro"]);
  });
});

// ---------------------------------------------------------------------------------------------------
// R3 da #153: evasões que sobreviviam (N1–N14, NA1, EX3). Uma fonte virtual por forma, com a forma da
// revisão; as listas novas são comparadas com cópias literais, com um caso por item.
// ---------------------------------------------------------------------------------------------------
describe("R3 da #153 — B1: executor reconhecido pela origem da ligação", () => {
  const doModulo = (nomes: string) => `import { ${nomes} } from "@/lib/acao-cliente";\n`;
  const desfecho = 'if (d && d.tipo !== "ok") { setMensagem(d.mensagem); return; }';
  it("E45 (N1) — `const { executar } = useAcaoCliente(…)`, renomeado e por constante intermediária", () => {
    expect(trechos(doModulo("useAcaoCliente") + tela(`async function s() { const { executar } = useAcaoCliente({ idempotente: true }); const d = await executar(() => f()); ${desfecho} }`))).toEqual(["setMensagem(d.mensagem)"]);
    expect(trechos(doModulo("useAcaoCliente") + tela(`async function s() { const { executar: rodar } = useAcaoCliente({ idempotente: true }); const d = await rodar(() => f()); ${desfecho} }`))).toEqual(["setMensagem(d.mensagem)"]);
    expect(trechos(doModulo("useAcaoCliente") + tela(`async function s() { const acao = useAcaoCliente({ idempotente: true }); const { executar } = acao; const d = await executar(() => f()); ${desfecho} }`))).toEqual(["setMensagem(d.mensagem)"]);
    // Controle: `{ executar }` de outra coisa (não do gancho do módulo) é dado.
    expect(analisar('import { useOutraCoisa } from "@/lib/outra";\n' + tela(`async function s() { const { executar } = useOutraCoisa(); const d = await executar(); setMensagem(d.mensagem ?? ""); }`))).toEqual([]);
  });
  it("E46 (N2) — `criarExecutor(…)` devolve o executor", () => {
    expect(trechos(doModulo("criarExecutor") + tela(`async function s() { const rodar = criarExecutor({ setOcupado: () => {}, setErro: () => {}, setSucesso: () => {} }, { idempotente: true }); const d = await rodar(() => f()); ${desfecho} }`))).toEqual(["setMensagem(d.mensagem)"]);
  });
  it("E47 (N3) — colchete literal sobre o namespace", () => {
    expect(trechos('import * as AC from "@/lib/acao-cliente";\n' + tela(`async function s() { const d = await AC["executarAcaoCliente"](() => f(), { idempotente: true }); ${desfecho} }`))).toEqual(["setMensagem(d.mensagem)"]);
  });
  it("E48 (N4) — alias `const` de um executor", () => {
    expect(trechos(doModulo("executarAcaoCliente") + tela(`async function s() { const rodar = executarAcaoCliente; const d = await rodar(() => f(), { idempotente: true }); ${desfecho} }`))).toEqual(["setMensagem(d.mensagem)"]);
  });
  it("E49 (N5) — `.call`, `.apply` e `.bind` (lista fechada de invocação indireta)", () => {
    const METODOS = ["call", "apply", "bind"];
    expect(METODOS_DE_INVOCACAO).toEqual(METODOS);
    expect(trechos(doModulo("executarAcaoCliente") + tela(`async function s() { const d = await executarAcaoCliente.call(null, () => f(), { idempotente: true }); ${desfecho} }`))).toEqual(["setMensagem(d.mensagem)"]);
    expect(trechos(doModulo("executarAcaoCliente") + tela(`async function s() { const d = await executarAcaoCliente.apply(null, [() => f(), { idempotente: true }]); ${desfecho} }`))).toEqual(["setMensagem(d.mensagem)"]);
    expect(trechos(doModulo("executarAcaoCliente") + tela(`async function s() { const rodar = executarAcaoCliente.bind(null); const d = await rodar(() => f(), { idempotente: true }); ${desfecho} }`))).toEqual(["setMensagem(d.mensagem)"]);
  });
  it("E50 (N6) — o import vale pelo caminho resolvido: relativo que chega a src/lib/acao-cliente", () => {
    const arquivo = "src/app/(app)/academico/indisponibilidades/SolicitarAusencia.tsx";
    const relativo = (caminho: string) => `import { executarAcaoCliente } from "${caminho}";\n` + tela(`async function s() { const d = await executarAcaoCliente(() => f(), { idempotente: true }); ${desfecho} }`);
    expect(analisar(relativo("../../../../lib/acao-cliente"), arquivo).map((a: Achado) => a.trecho)).toEqual(["setMensagem(d.mensagem)"]);
    expect(analisar(relativo("../../../../lib/acao-cliente.ts"), arquivo).map((a: Achado) => a.trecho)).toEqual(["setMensagem(d.mensagem)"]);
    expect(analisar(relativo("../../../../lib/outra-coisa"), arquivo)).toEqual([]);
    expect(caminhoDoModulo("../../../../lib/acao-cliente", arquivo)).toBe("src/lib/acao-cliente");
    expect(caminhoDoModulo("@/lib/acao-cliente", arquivo)).toBe("src/lib/acao-cliente");
  });
  it("lista fechada de fábricas e ganchos do executor: exportados de verdade pelo módulo", () => {
    expect(FABRICAS_DO_EXECUTOR).toEqual(["criarExecutor"]);
    expect(GANCHOS_DO_EXECUTOR).toEqual(["useAcaoCliente"]);
    for (const f of [...FABRICAS_DO_EXECUTOR, ...GANCHOS_DO_EXECUTOR]) expect(Object.keys(ACAO_CLIENTE), f).toContain(f);
  });
  it("E51 (N7) — `.mensagem` de parâmetro de callback anônimo: do `.then` do executor é erro; de origem desconhecida falha fechado, mesmo como pedaço", () => {
    expect(trechos(doModulo("executarAcaoCliente") + tela('function s() { void executarAcaoCliente(() => f(), { idempotente: true }).then((d) => { if (d.tipo !== "ok") { setMensagem(d.mensagem); } }); }')))
      .toEqual(["setMensagem(d.mensagem)"]);
    expect(problemas(tela("function s(p: Promise<{ mensagem: string }>) { void p.then((d) => setMensagem(d.mensagem)); }"))).toEqual([expect.stringMatching(/callback anônimo/)]);
    expect(problemas(tela("function s(p: Promise<{ mensagem: string }>) { void p.then((d) => setMensagem(`Aviso: ${d.mensagem}`)); }"))).toEqual([expect.stringMatching(/callback anônimo/)]);
    // Controles: o dado de sucesso do `.executar(acao, (dado) => …)` e o elemento de um iterador são dado.
    expect(analisar(tela('function s(acao: { executar: (a: unknown, b: unknown) => void }) { acao.executar(() => f(), (dado: { mensagem?: string }) => dado?.mensagem ?? "Salvo."); }'))).toEqual([]);
    expect(analisar(tela('function s(lista: { mensagem: string }[]) { setMensagem(lista.map((m) => m.mensagem).join(" ")); }'))).toEqual([]);
  });
  it("E52 (NA1) — mutação por método conta como fonte: cada mutador da lista fechada", () => {
    expect(trechos(tela('function s() { if (!r.ok) { const avisos: string[] = []; avisos.push(r.erro ?? ""); setMensagem(avisos.join(" ")); return; } }'))).toEqual(['setMensagem(avisos.join(" "))']);
    const MUTA = ["push", "unshift", "splice", "fill", "set", "add"];
    expect(MUTADORES).toEqual(MUTA);
    for (const m of MUTA) expect(trechos(tela(`function s(caixa: { ${m}: (...a: unknown[]) => void }) { const lista = caixa; lista.${m}(r.erro ?? ""); setMensagem(String(lista)); }`)), m).toEqual(["setMensagem(String(lista))"]);
  });
});

describe("R3 da #153 — B2: tokens de role, children e iteradores", () => {
  const reg = (jsx: string, corpo = "") => `${IMPORTS}export function T({ r }: { r: { ok: boolean; erro?: string } }) { const erro = r.erro; ${corpo} return <div>${jsx}</div>; }\n`;
  it("E53 (N8) — role é lista de tokens: basta um token polite", () => {
    expect(trechos(reg('<p role="aviso status">{erro}</p>'))).toEqual(["{erro}"]);
    expect(trechos(reg('<p role={"note log"}>{erro}</p>'))).toEqual(["{erro}"]);
    expect(analisar(reg('<p role="note alert">{erro}</p>'))).toEqual([]);
  });
  it("E54 (N9b) — `children={…}` em elemento nativo é conteúdo da região (lista fechada de atributos de conteúdo)", () => {
    expect(trechos(reg('<p role="status" className="text-red-700" children={erro} />'))).toEqual(["children={erro}"]);
    const ATRIBUTOS = ["children", "dangerouslySetInnerHTML"];
    expect(ATRIBUTOS_DE_CONTEUDO).toEqual(ATRIBUTOS);
    for (const a of ATRIBUTOS) expect(trechos(reg(`<div role="status"><span ${a}={erro} /></div>`)), a).toEqual([`${a}={erro}`]);
  });
  it("E55 (N10) — array e spread são seguidos; o parâmetro do iterador fica ligado ao receptor", () => {
    expect(trechos(reg('<p role="status">{avisos.map((t) => <span key={t}>{t}</span>)}</p>', "const detalhe = erro; const avisos = detalhe ? [detalhe] : [];")))
      .toEqual(["{avisos.map((t) => <span key={t}>{t}</span>)}"]);
    expect(trechos(reg('<p role="status">{[...avisos]}</p>', "const avisos = [erro];"))).toEqual(["{[...avisos]}"]);
    const ITER = ["map", "flatMap", "filter", "reduce"];
    expect(ITERADORES).toEqual(ITER);
    for (const it2 of ITER) {
      expect(trechos(tela(`function s() { const lista = [r.erro ?? ""]; lista.${it2}((t: string) => { setMensagem(t); return t; }); }`)), it2).toEqual(["setMensagem(t)"]);
    }
    expect(analisar(reg('<p role="status">{itens.map((t) => <span key={t}>{t}</span>)}</p>', 'const itens = ["Salvo."];'))).toEqual([]);
  });
});

describe("R3 da #153 — B3: open indireto, destino não absoluto, janela como valor", () => {
  const tiposDe = (f: string) => analisar(`export function T({ k }: { k: string }) { const s = () => { ${f} }; return <button onClick={s}>Ok</button>; }\n`).map((a: Achado) => a.tipo);
  it("E56 (N11) — window.open por .call/.apply/.bind ou como valor falha fechado", () => {
    expect(tiposDe('window.open.call(window, window.location.href, "_self");')).toContain("opaco");
    expect(tiposDe('window.open.apply(window, [location.href, "_self"]);')).toContain("opaco");
    expect(tiposDe('const abrir = window.open.bind(window); abrir(location.href, "_self");')).toContain("opaco");
    expect(tiposDe("const abrir = window.open;")).toEqual(["opaco"]);
    expect(tiposDe('window.open("/relatorio", "_blank");')).toEqual([]);
  });
  it("E57 (N12) — destino literal só é navegação se for absoluto: vazio, ?, #, ., ./ e relativo falham", () => {
    for (const t of ["", "?", "?x=1", "#topo", ".", "./", "pagina"]) {
      expect(tiposDe(`window.open("${t}", "_self");`), `open ${t}`).toContain("erro");
      expect(tiposDe(`location.href = "${t}";`), `href ${t}`).toContain("erro");
      expect(tiposDe(`location.assign("${t}");`), `assign ${t}`).toContain("erro");
    }
    for (const t of ["/inicio", "https://exemplo.com/x", "mailto:a@b.c"]) expect(tiposDe(`location.assign("${t}");`), t).toEqual([]);
    expect(destinoAbsoluto(ts.factory.createStringLiteral("/x"))).toBe(true);
    expect(destinoAbsoluto(ts.factory.createStringLiteral("?"))).toBe(false);
  });
  it("E58 (N13) — campo computado em self/top/parent/frames falha fechado", () => {
    expect(tiposDe('self[("loca" + "tion") as "location"][("re" + "load") as "reload"]();')).toContain("opaco");
    for (const o of ["self", "top", "parent", "frames"]) expect(tiposDe(`${o}[k];`), o).toEqual(["opaco"]);
  });
  it("E59 (N14) — objeto de janela passado a mutador de objeto ou espalhado falha fechado (lista fechada de mutadores)", () => {
    expect(tiposDe("Object.assign(window, { location: window.location.href });")).toContain("opaco");
    expect(tiposDe('Reflect.set(globalThis, "location", "/x");')).toContain("opaco");
    expect(tiposDe('Object.defineProperty(self, "location", { value: "?" });')).toContain("opaco");
    expect(tiposDe("const copia = { ...window };")).toContain("opaco");
    const MUT = ["assign", "set", "defineProperty", "defineProperties"];
    expect(MUTADORES_DE_OBJETO).toEqual(MUT);
    for (const m of MUT) expect(tiposDe(`Reflect.${m}(window, {});`), m).toEqual(["opaco"]);
    expect(tiposDe('window.addEventListener("x", () => undefined); const t = typeof window;')).toEqual([]);
  });
});

describe("R3 da #153 — B6: fonte por push no trecho isento", () => {
  it("E44b (EX3) — `partes.push(MSG_…)` entra nas fontes do achado, e a exceção que aceitava só d.falhas não casa", () => {
    const lote = (push: string) => tela(`function s(d: { falhas: number }) { const partes = [d.falhas ? \`\${d.falhas} falhou\` : null].filter(Boolean); ${push} setMensagem(\`Lote: \${partes.join(" ")}.\`); }`);
    const achados = analisar(lote("if (d.falhas) partes.push(MSG_RESULTADO_INCERTO_SEM_CHAVE);"));
    expect(achados.map((a: Achado) => a.fontes)).toEqual([["d.falhas", "MSG_RESULTADO_INCERTO_SEM_CHAVE"]]);
    const excecao: Excecao = { arquivo: "virtual.tsx", tipo: "erro", trecho: achados[0].trecho, fontes: ["d.falhas"], motivo: "resumo do lote com contagem de falhas" };
    expect(conferirExcecoes(achados, [excecao]).semExcecao).toHaveLength(1);
    expect(conferirExcecoes(analisar(lote("")), [excecao])).toEqual({ semExcecao: [], soltas: [] });
  });
});
