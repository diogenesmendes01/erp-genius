import ts from "typescript";

// Leitura usada pela trava src/app/identificacao-registro.test.ts (docs/43-medicao-auditoria-ux.md §6 item 7).
//
// 1. ID CRU NA TELA. Um id interno de registro (`.id`, `*Id`, `ids`) não é texto para a pessoa: "Solicitação
//    cm1x…", "<td>{item.cobrancaId}</td>". Pelo AST, em cada POSIÇÃO DE TEXTO — filho JSX (`{…}`), atributo de
//    texto de elemento nativo (children, aria-label, placeholder, alt), filho passado a createElement/jsx — e em
//    cada PROP de componente (atributo que não tem nome de id nem é livre: key, href, value…), o valor é seguido:
//    `??`, `||`, `&&` (o lado direito), `+`, ternário, template, array, objeto literal (menos chave com nome de id),
//    `String(x)` e métodos que devolvem o próprio texto (`slice`, `toUpperCase`, `split`, `join`…), `.map`/`.flatMap`
//    (o que o callback devolve), constante e `let` (com as atribuições), desestruturação (`{ cobrancaId: ref }` faz
//    de `ref` um id), parâmetro de iteração (ligado à lista), função local (o que ela devolve, com cada parâmetro
//    ligado ao argumento da chamada e ao valor padrão). Um id que chega à posição é achado `texto` (ou `prop`).
//    Id passado a função que a leitura não segue (importada, método, `new`, template marcado) é achado `opaco`
//    (falha fechada: a função pode imprimi-lo). Arquivo que não analisa é achado `opaco`.
//    Fora do alcance (declarado): propriedade de objeto montado noutro ponto com outro nome (`linha.texto`),
//    spread de identificador (`{...props}`) e o que o componente filho faz com uma prop de id (é lido no
//    arquivo dele, pelo nome).
// 2. IDENTIFICAÇÃO DO REGISTRO. Sinais de que a tela diz de quem é o registro: um componente Identificacao*
//    (também renomeado no import) ou um <h1> com valor dinâmico que não seja id cru. Os elementos JSX (texto
//    normalizado) servem de âncora às exceções.

/** Nome de id de registro: `id`, `ids`, `cobrancaId`, `creditoIds`… (camelCase: `paid`/`valid` não). */
export const NOME_DE_ID = /^(?:id|ids)$|Ids?$/;
/** Métodos que devolvem (um pedaço d)o próprio valor: o id continua id. */
export const METODOS_TRANSPARENTES = ["toString", "toUpperCase", "toLowerCase", "toLocaleUpperCase", "toLocaleLowerCase", "trim", "trimStart", "trimEnd", "slice", "substring", "substr", "padStart", "padEnd", "split", "at", "concat", "join", "replace", "replaceAll", "normalize", "repeat", "valueOf"];
/** Funções globais que só convertem o valor em texto. */
export const FUNCOES_TRANSPARENTES = ["String"];
/** Iteradores cujo callback devolve o que é impresso. */
export const ITERADORES_DE_VALOR = ["map", "flatMap"];
/** Iteradores cujo primeiro parâmetro do callback é um elemento da lista (o parâmetro fica ligado a ela). */
export const ITERADORES_DE_ELEMENTO = ["map", "flatMap", "filter", "find", "findLast", "some", "every", "forEach", "reduce", "sort", "toSorted"];
/** Atributos de elemento nativo que são texto lido pela pessoa (o `title` é o lugar do id secundário). */
export const ATRIBUTOS_DE_TEXTO_NATIVO = ["children", "aria-label", "aria-description", "aria-valuetext", "placeholder", "alt"];
/** Props de componente que não são texto (destino, chave, nome e valor de controle, título secundário). */
export const PROPS_LIVRES = ["key", "href", "value", "defaultValue", "name", "htmlFor", "className", "title", "action", "formAction", "type", "target", "rel", "src"];
/** Prop (ou chave de objeto de props) que é destino de link: `reprepararHref`, `alunoHref`. */
export const PROP_DE_DESTINO = /(?:^h|H)ref$/;
/** Métodos de busca por chave: devolvem o valor guardado (nome, rótulo), não a chave. */
export const METODOS_DE_BUSCA = ["get", "has"];
/** Fábricas de elemento: (tag, props, ...filhos). */
export const FABRICAS_DE_ELEMENTO = ["createElement", "jsx", "jsxs", "jsxDEV"];
const PROFUNDIDADE_MAXIMA = 14;

export type TipoAchadoId = "texto" | "prop" | "opaco";
export type AchadoId = { arquivo: string; tipo: TipoAchadoId; trecho: string; alvo: string };

const normaliza = (t: string) => t.replace(/\s+/g, " ").trim();

function desembrulha(e: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) || ts.isSatisfiesExpression(e) || ts.isTypeAssertionExpression(e) || ts.isAwaitExpression(e)) e = e.expression;
  return e;
}

type Funcao = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction;
type Contexto = {
  sf: ts.SourceFile;
  /** Valores de cada nome do arquivo (constante, let e atribuições, parâmetro de iteração). */
  valores: Map<string, ts.Expression[]>;
  /** Nomes que vêm de uma propriedade com nome de id (`{ cobrancaId: ref }`). */
  ligadosAId: Set<string>;
  /** Funções locais pelo nome. */
  funcoes: Map<string, Funcao>;
};
/** Parâmetro da função local seguida → os valores que ele recebe, cada um lido nas ligações de quem chamou. */
type Ligacoes = Map<string, { valor: ts.Expression; ligacoes: Ligacoes }[]>;
type Alcance = { ids: ts.Node[]; opacos: ts.Node[] };
const vazio = (): Alcance => ({ ids: [], opacos: [] });
const junta = (...partes: Alcance[]): Alcance => ({ ids: partes.flatMap((p) => p.ids), opacos: partes.flatMap((p) => p.opacos) });

/** Nome de id, prop livre ou de destino: o valor dela não é texto. */
const propLivre = (nome: string) => NOME_DE_ID.test(nome) || PROPS_LIVRES.includes(nome) || PROP_DE_DESTINO.test(nome);

const nomeDePropriedade = (n: ts.PropertyName | undefined): string | null =>
  !n ? null : ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n) || ts.isPrivateIdentifier(n) ? n.text : null;

function contexto(sf: ts.SourceFile): Contexto {
  const valores = new Map<string, ts.Expression[]>(), ligadosAId = new Set<string>(), funcoes = new Map<string, Funcao>();
  const adiciona = (nome: string, valor: ts.Expression) => { valores.set(nome, [...(valores.get(nome) ?? []), valor]); };
  const padrao = (p: ts.BindingName, origem: ts.Expression | undefined) => {
    if (ts.isIdentifier(p)) { if (origem) adiciona(p.text, origem); return; }
    for (const el of p.elements) {
      if (ts.isOmittedExpression(el)) continue;
      const chave = ts.isObjectBindingPattern(p) ? nomeDePropriedade(el.propertyName) ?? (ts.isIdentifier(el.name) ? el.name.text : null) : null;
      if (chave !== null && NOME_DE_ID.test(chave)) {
        const marca = (b: ts.BindingName) => { if (ts.isIdentifier(b)) ligadosAId.add(b.text); else for (const x of b.elements) if (!ts.isOmittedExpression(x)) marca(x.name); };
        marca(el.name);
        continue;
      }
      // Elemento de array desestruturado vem da lista; propriedade sem nome de id, de um campo que não é id.
      padrao(el.name, ts.isArrayBindingPattern(p) ? origem : undefined);
      if (el.initializer) padrao(el.name, el.initializer);
    }
  };
  const visita = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n)) {
      padrao(n.name, n.initializer);
      if (ts.isIdentifier(n.name) && n.initializer) {
        const f = desembrulha(n.initializer);
        if (ts.isArrowFunction(f) || ts.isFunctionExpression(f)) funcoes.set(n.name.text, f);
      }
    }
    if (ts.isParameter(n) && !ts.isIdentifier(n.name)) padrao(n.name, undefined);
    if (ts.isFunctionDeclaration(n) && n.name) funcoes.set(n.name.text, n);
    if (ts.isBinaryExpression(n) && n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
      const alvo = desembrulha(n.left);
      if (ts.isIdentifier(alvo)) adiciona(alvo.text, n.right);
    }
    if (ts.isCallExpression(n)) {
      const c = desembrulha(n.expression);
      const f = n.arguments[0] ? desembrulha(n.arguments[0]) : undefined;
      if (ts.isPropertyAccessExpression(c) && ITERADORES_DE_ELEMENTO.includes(c.name.text) && f && (ts.isArrowFunction(f) || ts.isFunctionExpression(f))) {
        const p = f.parameters[c.name.text === "reduce" ? 1 : 0];
        if (p) padrao(p.name, c.expression);
      }
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return { sf, valores, ligadosAId, funcoes };
}

/** O que a função devolve: o corpo-expressão ou cada `return` (sem entrar em função aninhada). */
function retornos(f: Funcao): ts.Expression[] {
  if (!f.body) return [];
  if (!ts.isBlock(f.body)) return [f.body];
  const saida: ts.Expression[] = [];
  const visita = (n: ts.Node) => {
    if (ts.isReturnStatement(n) && n.expression) saida.push(n.expression);
    if (!ts.isFunctionLike(n)) ts.forEachChild(n, visita);
  };
  ts.forEachChild(f.body, visita);
  return saida;
}

/** `vistos`: nomes e funções em expansão neste caminho (`x = x + y` e recursão não dão volta). */
function alcance(e: ts.Expression, ctx: Contexto, ligacoes: Ligacoes, profundidade: number, vistos: Set<string | ts.Node>): Alcance {
  if (profundidade > PROFUNDIDADE_MAXIMA) return { ids: [], opacos: [e] };
  const segue = (x: ts.Expression, l: Ligacoes = ligacoes) => alcance(x, ctx, l, profundidade + 1, vistos);
  // `await consultar(id)` devolve dado novo (o id que o dado traz é lido pelo nome do campo); o resto do
  // `await` (de valor local) é seguido.
  const semParenteses = (x: ts.Expression): ts.Expression => (ts.isParenthesizedExpression(x) ? semParenteses(x.expression) : x);
  const aguardado = semParenteses(e);
  if (ts.isAwaitExpression(aguardado)) {
    const chamada = desembrulha(aguardado.expression);
    const alvo = ts.isCallExpression(chamada) ? desembrulha(chamada.expression) : null;
    if (alvo && !(ts.isIdentifier(alvo) && ctx.funcoes.has(alvo.text))) return vazio();
  }
  e = desembrulha(e);
  if (ts.isIdentifier(e)) {
    if (NOME_DE_ID.test(e.text) || ctx.ligadosAId.has(e.text)) return { ids: [e], opacos: [] };
    const ligados = ligacoes.get(e.text);
    if (ligados) return junta(...ligados.map((x) => segue(x.valor, x.ligacoes)));
    if (vistos.has(e.text)) return vazio();
    vistos.add(e.text);
    const r = junta(...(ctx.valores.get(e.text) ?? []).map((x) => segue(x, new Map())));
    vistos.delete(e.text);
    return r;
  }
  if (ts.isPropertyAccessExpression(e)) return NOME_DE_ID.test(e.name.text) ? { ids: [e], opacos: [] } : vazio();
  if (ts.isElementAccessExpression(e)) {
    const a = desembrulha(e.argumentExpression);
    if ((ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) && NOME_DE_ID.test(a.text)) return { ids: [e], opacos: [] };
    return segue(e.expression);
  }
  if (ts.isBinaryExpression(e)) {
    const k = e.operatorToken.kind;
    if (k === ts.SyntaxKind.QuestionQuestionToken || k === ts.SyntaxKind.BarBarToken || k === ts.SyntaxKind.PlusToken) return junta(segue(e.left), segue(e.right));
    if (k === ts.SyntaxKind.AmpersandAmpersandToken || k === ts.SyntaxKind.CommaToken) return segue(e.right);
    if (k >= ts.SyntaxKind.FirstAssignment && k <= ts.SyntaxKind.LastAssignment) return segue(e.right);
    return vazio();
  }
  if (ts.isConditionalExpression(e)) return junta(segue(e.whenTrue), segue(e.whenFalse));
  if (ts.isTemplateExpression(e)) return junta(...e.templateSpans.map((s) => segue(s.expression)));
  if (ts.isArrayLiteralExpression(e)) return junta(...e.elements.map((x) => segue(ts.isSpreadElement(x) ? x.expression : x)));
  if (ts.isSpreadElement(e)) return segue(e.expression);
  if (ts.isObjectLiteralExpression(e)) {
    return junta(...e.properties.map((p) => {
      if (ts.isSpreadAssignment(p)) return segue(p.expression);
      const nome = nomeDePropriedade(p.name);
      if (nome !== null && propLivre(nome)) return vazio();
      if (ts.isPropertyAssignment(p)) return segue(p.initializer);
      if (ts.isShorthandPropertyAssignment(p)) return segue(p.name);
      return vazio();
    }));
  }
  if (ts.isTaggedTemplateExpression(e)) {
    const t = e.template;
    const r = ts.isTemplateExpression(t) ? junta(...t.templateSpans.map((s) => segue(s.expression))) : vazio();
    return r.ids.length || r.opacos.length ? { ids: [], opacos: [e] } : vazio();
  }
  if (ts.isNewExpression(e)) {
    const r = junta(...(e.arguments ?? []).map((x) => segue(x)));
    return r.ids.length || r.opacos.length ? { ids: [], opacos: [e] } : vazio();
  }
  if (ts.isCallExpression(e)) {
    const c = desembrulha(e.expression);
    const args = () => junta(...e.arguments.map((x) => segue(ts.isSpreadElement(x) ? x.expression : x)));
    if (ts.isIdentifier(c) && FUNCOES_TRANSPARENTES.includes(c.text)) return args();
    if (ts.isPropertyAccessExpression(c) && METODOS_DE_BUSCA.includes(c.name.text)) return vazio();
    if (ts.isPropertyAccessExpression(c) && METODOS_TRANSPARENTES.includes(c.name.text)) return c.name.text === "concat" ? junta(segue(c.expression), args()) : segue(c.expression);
    if (ts.isPropertyAccessExpression(c) && ITERADORES_DE_VALOR.includes(c.name.text) && e.arguments[0]) {
      const f = desembrulha(e.arguments[0]);
      if (ts.isArrowFunction(f) || ts.isFunctionExpression(f)) return junta(...retornos(f).map((x) => segue(x)));
    }
    if (ts.isIdentifier(c) && ctx.funcoes.has(c.text)) {
      const f = ctx.funcoes.get(c.text)!;
      if (vistos.has(f)) return vazio();
      const novas: Ligacoes = new Map(ligacoes);
      f.parameters.forEach((p, i) => {
        if (!ts.isIdentifier(p.name)) return;
        const arg = e.arguments[i];
        novas.set(p.name.text, [
          ...(arg ? [{ valor: ts.isSpreadElement(arg) ? arg.expression : arg, ligacoes }] : []),
          ...(p.initializer ? [{ valor: p.initializer, ligacoes }] : []),
        ]);
      });
      vistos.add(f);
      const r = junta(...retornos(f).map((x) => segue(x, novas)));
      vistos.delete(f);
      return r;
    }
    const r = args();
    return r.ids.length || r.opacos.length ? { ids: [], opacos: [e] } : vazio();
  }
  return vazio();
}

const ehNativo = (tag: string) => /^[a-z][\w-]*$/.test(tag);

/** Achados de id cru no fonte (ver o cabeçalho). */
export function idsCrusNaTela(fonte: string, arquivo = "virtual.tsx"): AchadoId[] {
  const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const diagnosticos = (sf as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];
  if (diagnosticos.length) return [{ arquivo, tipo: "opaco", trecho: "arquivo não analisa", alvo: ts.flattenDiagnosticMessageText(diagnosticos[0]!.messageText, " ") }];
  const ctx = contexto(sf);
  const achados: AchadoId[] = [];
  const confere = (valor: ts.Expression, posicao: ts.Node, tipo: "texto" | "prop") => {
    const r = alcance(valor, ctx, new Map(), 0, new Set<string | ts.Node>());
    for (const n of r.ids) achados.push({ arquivo, tipo, trecho: normaliza(posicao.getText(sf)), alvo: normaliza(n.getText(sf)) });
    // Numa prop, o que a função devolve vai para o componente, que é lido no arquivo dele: só o id direto acusa.
    if (tipo === "texto") for (const n of r.opacos) achados.push({ arquivo, tipo: "opaco", trecho: normaliza(posicao.getText(sf)), alvo: normaliza(n.getText(sf)) });
  };
  const atributo = (tag: string, nome: string, valor: ts.Expression, posicao: ts.Node) => {
    if (ehNativo(tag)) { if (ATRIBUTOS_DE_TEXTO_NATIVO.includes(nome)) confere(valor, posicao, "texto"); return; }
    if (nome === "children") { confere(valor, posicao, "texto"); return; }
    if (propLivre(nome)) return;
    confere(valor, posicao, "prop");
  };
  const objetoDeProps = (tag: string, objeto: ts.ObjectLiteralExpression) => {
    for (const p of objeto.properties) {
      if (ts.isSpreadAssignment(p)) { const o = desembrulha(p.expression); if (ts.isObjectLiteralExpression(o)) objetoDeProps(tag, o); continue; }
      const nome = nomeDePropriedade(p.name);
      if (nome === null) continue;
      if (ts.isPropertyAssignment(p)) atributo(tag, nome, p.initializer, p);
      else if (ts.isShorthandPropertyAssignment(p)) atributo(tag, nome, p.name, p);
    }
  };
  const visita = (n: ts.Node) => {
    if (ts.isJsxExpression(n) && n.expression && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))) confere(n.expression, n, "texto");
    if (ts.isJsxAttribute(n)) {
      const tag = n.parent.parent.tagName.getText(sf), nome = n.name.getText(sf), ini = n.initializer;
      if (ini && ts.isJsxExpression(ini) && ini.expression) atributo(tag, nome, ini.expression, n);
    }
    if (ts.isJsxSpreadAttribute(n)) {
      const o = desembrulha(n.expression);
      if (ts.isObjectLiteralExpression(o)) objetoDeProps(n.parent.parent.tagName.getText(sf), o);
    }
    if (ts.isCallExpression(n)) {
      const c = desembrulha(n.expression);
      const nome = ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : "";
      if (FABRICAS_DE_ELEMENTO.includes(nome) && n.arguments.length > 0) {
        const t = desembrulha(n.arguments[0]!), tag = ts.isStringLiteral(t) ? t.text : t.getText(sf);
        const props = n.arguments[1] ? desembrulha(n.arguments[1]) : undefined;
        if (props && ts.isObjectLiteralExpression(props)) objetoDeProps(tag, props);
        for (const filho of n.arguments.slice(2)) confere(ts.isSpreadElement(filho) ? filho.expression : filho, filho, "texto");
      }
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return achados;
}

export type SinaisDeIdentificacao = {
  /** Componentes Identificacao* usados (nome original, mesmo renomeado no import). */
  componentes: string[];
  /** <h1> do arquivo: texto normalizado e se nomeia o registro com um valor (que não seja id cru). */
  h1: { texto: string; dinamico: boolean }[];
  /** Texto normalizado de cada elemento JSX (âncora das exceções). */
  elementos: string[];
  /** Imports relativos (componentes locais da tela). */
  locais: string[];
  /** O arquivo não analisa (falha fechada). */
  quebrado: boolean;
};

export function sinaisDeIdentificacao(fonte: string, arquivo = "virtual.tsx"): SinaisDeIdentificacao {
  const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const quebrado = ((sf as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? []).length > 0;
  const ctx = contexto(sf);
  const apelidos = new Map<string, string>();
  const saida: SinaisDeIdentificacao = { componentes: [], h1: [], elementos: [], locais: [], quebrado };
  const visita = (n: ts.Node) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && n.moduleSpecifier.text.startsWith(".")) saida.locais.push(n.moduleSpecifier.text);
    if (ts.isImportSpecifier(n)) apelidos.set(n.name.text, (n.propertyName ?? n.name).text);
    ts.forEachChild(n, visita);
  };
  visita(sf);
  const jsx = (n: ts.Node) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const tag = n.tagName.getText(sf), original = apelidos.get(tag) ?? tag;
      if (/^Identificacao[A-Z]/.test(original)) saida.componentes.push(original);
    }
    if (ts.isJsxElement(n)) {
      saida.elementos.push(normaliza(n.getText(sf)));
      if (n.openingElement.tagName.getText(sf) === "h1") {
        const valores = n.children.filter((c): c is ts.JsxExpression => ts.isJsxExpression(c) && !!c.expression).map((c) => c.expression!);
        const dinamico = valores.some((v) => {
          const d = desembrulha(v);
          if (ts.isStringLiteral(d) || ts.isNoSubstitutionTemplateLiteral(d) || ts.isNumericLiteral(d)) return false;
          const r = alcance(v, ctx, new Map(), 0, new Set<string | ts.Node>());
          return r.ids.length === 0 && r.opacos.length === 0;
        });
        saida.h1.push({ texto: normaliza(n.getText(sf)), dinamico });
      }
    }
    if (ts.isJsxSelfClosingElement(n)) saida.elementos.push(normaliza(n.getText(sf)));
    ts.forEachChild(n, jsx);
  };
  jsx(sf);
  return saida;
}
