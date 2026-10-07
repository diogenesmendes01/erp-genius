import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { EXCECOES_CAMPO, MAPA_CAMPOS, type ExcecaoCampo } from "./campos-mapa";

// Trava do Campo (docs/42-auditoria-frontend-ux.md, E1 e E7; §5.2 e §5.4): havia 0 aria-invalid para
// 619 `required` e 198 controles sem nome acessível. Agora rótulo, dica, erro e obrigatoriedade passam
// por <Campo> (src/components/Campo.tsx), que entrega id + aria-* ao controle por função:
// `<Campo rotulo="Nome" obrigatorio erro={…}>{(campo) => <input {...campo} />}</Campo>`.
//
// A migração é por ÁREA (AREAS_MIGRADAS, que só cresce). Nelas, pelo AST do TypeScript:
// - todo controle obrigatório — <input>/<select>/campo de texto longo, CampoTexto, CampoMoeda, CampoFuso
//   (obrigatório por padrão) ou componente local que repassa `id` — com `required` ou `aria-required`
//   (também por spread de objeto literal, `{...{ required: true }}`) passa pelo Campo; fora dele, só com
//   rótulo ligado E aria-invalid ligado a um valor (não constante);
// - o controle obrigatório ligado a um Campo pede `obrigatorio` no Campo (o asterisco do rótulo);
// - todo controle tem nome acessível: Campo, <label> com texto em volta, htmlFor ↔ id de um <label>
//   com texto, aria-label não vazio, aria-labelledby apontando para ids que existem no arquivo;
// - spread que a sintaxe não abre (`{...props}`) num controle não é verificável e é acusado.
// Em qualquer tela, todo <Campo> liga exatamente um controle (nativo, do design system ou componente
// local que repassa `id`) espalhando o parâmetro da função, sem reescrever id/aria-* por cima da
// ligação; rótulo e dica não são vazios e o erro vem de um valor (não de uma constante).
// Componentes renomeados no import (`import { CampoTexto as Texto }`) ou numa constante são seguidos.
//
// Exceções: ancoradas em arquivo + trecho exato (a tag de abertura, espaços normalizados) + motivo não
// vazio (src/app/campos-mapa.ts); cada uma tem de casar com exatamente um caso. O mesmo arquivo traz o
// manifesto de cada <Campo> de cada tela (rótulo · obrigatoriedade · controle · dica · expressão do
// erro): trocar um Campo por um controle solto, apagá-lo, tirar o `obrigatorio` ou religar o `erro` a
// outra coisa muda o mapa e falha aqui.

/** Áreas migradas: pasta e se as subpastas entram (rotas filhas são outras telas, migradas à parte). */
const AREAS_MIGRADAS: { pasta: string; subpastas: boolean }[] = [
  { pasta: "src/app/(app)/matriculas/nova", subpastas: true },
  { pasta: "src/app/(app)/alunos/[id]", subpastas: false },
];

const RAIZES = ["src/app", "src/components"];
const FONTE_DO_CAMPO = "src/components/Campo.tsx";
const NATIVOS = new Set(["input", "select", "textarea"]);
const DO_DESIGN_SYSTEM = new Set(["CampoTexto", "CampoMoeda", "CampoFuso"]);
/** Nomes que a trava segue quando renomeados no import ou numa constante. */
const CANONICOS = new Set(["Campo", ...DO_DESIGN_SYSTEM]);
/** Atributos que a ligação do Campo entrega — escritos à mão no controle, sobrescrevem a ligação. */
const DA_LIGACAO = ["id", "aria-required", "aria-invalid", "aria-describedby"];
/** `type` de <input> que não precisa de rótulo (não é campo de digitação/escolha). */
const TIPOS_SEM_ROTULO = ["hidden", "submit", "button", "reset", "image"];
/** Valores que desligam um atributo booleano ou deixam um texto vazio. */
const DESLIGADOS = new Set(["false", "{false}", "{undefined}", "{null}"]);

const normaliza = (t: string) => t.replace(/\s+/g, " ").trim();

type Elemento = ts.JsxElement | ts.JsxSelfClosingElement;
type Achado = { linha: number; trecho: string; problema: string };
type Valor = string | true | undefined;

const abertura = (n: Elemento) => (ts.isJsxElement(n) ? n.openingElement : n);
const ehElemento = (n: ts.Node): n is Elemento => ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n);

function desembrulha(e: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) || ts.isSatisfiesExpression(e)) e = e.expression;
  return e;
}

/** Contexto de um arquivo: a árvore e os nomes locais de Campo/CampoTexto/CampoMoeda/CampoFuso. */
type Contexto = { sf: ts.SourceFile; aliases: Map<string, string> };

function contexto(fonte: string, arquivo: string): Contexto {
  const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const aliases = new Map<string, string>();
  const canonico = (e: ts.Expression): string | undefined => {
    e = desembrulha(e);
    const nome = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : undefined;
    return nome === undefined ? undefined : aliases.get(nome) ?? (CANONICOS.has(nome) ? nome : undefined);
  };
  const visita = (n: ts.Node) => {
    if (ts.isImportSpecifier(n) && CANONICOS.has((n.propertyName ?? n.name).text)) aliases.set(n.name.text, (n.propertyName ?? n.name).text);
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      const alvo = canonico(n.initializer);
      if (alvo) aliases.set(n.name.text, alvo);
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return { sf, aliases };
}

/** Nome da tag, já resolvido para o canônico (`Texto` → `CampoTexto`, `DS.CampoTexto` → `CampoTexto`). */
function tagDe(n: Elemento, ctx: Contexto): string {
  const t = abertura(n).tagName;
  const nome = ts.isPropertyAccessExpression(t) ? t.name.text : t.getText(ctx.sf);
  return ctx.aliases.get(nome) ?? nome;
}

type Atributo = { nome: string; valor: ts.Expression | true };

/**
 * Atributos do elemento, inclusive os de spread de objeto literal (`{...{ required: true }}`), na ordem
 * (o último vence). `opacos`: spreads que a sintaxe não abre (`{...props}`).
 */
function atributos(n: Elemento): { lista: Atributo[]; opacos: ts.Expression[] } {
  const lista: Atributo[] = [];
  const opacos: ts.Expression[] = [];
  for (const a of abertura(n).attributes.properties) {
    if (ts.isJsxAttribute(a)) {
      const ini = a.initializer;
      lista.push({ nome: a.name.getText(), valor: !ini ? true : ts.isJsxExpression(ini) ? ini.expression ?? true : ini });
      continue;
    }
    const e = desembrulha(a.expression);
    if (!ts.isObjectLiteralExpression(e)) { opacos.push(e); continue; }
    for (const p of e.properties) {
      if (ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) lista.push({ nome: p.name.text, valor: p.initializer });
      else if (ts.isShorthandPropertyAssignment(p)) lista.push({ nome: p.name.text, valor: p.name });
      else opacos.push(e);
    }
  }
  return { lista, opacos };
}

const atributo = (n: Elemento, nome: string) => atributos(n).lista.filter((a) => a.nome === nome).at(-1);

/**
 * Valor de um atributo: undefined (ausente), true (só o nome), o texto de um literal (`x="a"`, `x={"a"}`,
 * `x={`a`}`) ou a expressão normalizada entre chaves (`{IDS.nome}`).
 */
function valor(n: Elemento, nome: string, sf: ts.SourceFile): Valor {
  const a = atributo(n, nome);
  if (!a) return undefined;
  if (a.valor === true) return true;
  const e = desembrulha(a.valor);
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
  return `{${normaliza(e.getText(sf))}}`;
}

/** `required`/`aria-required` presente e não desligado (`={false}`, `"false"`, `{undefined}`, `{null}`). */
const ligado = (v: Valor) => v !== undefined && !DESLIGADOS.has(v as string);

/**
 * A expressão lê algo da tela: tem um identificador que não é global (`Boolean`, `Math`, `undefined`,
 * `NaN`… são globais) nem nome de propriedade (`.random`, `{ chave: … }`). `Boolean(0)` e `1 < 0` não
 * leem nada; `Boolean(erros.nome)` lê `erros`.
 */
function leDaTela(e: ts.Node): boolean {
  let tem = false;
  const procura = (m: ts.Node) => {
    if (tem) return;
    if (ts.isIdentifier(m)) {
      const p = m.parent;
      const nomeDePropriedade = (ts.isPropertyAccessExpression(p) && p.name === m) || (ts.isPropertyAssignment(p) && p.name === m) || ts.isJsxAttribute(p);
      // Tag nativa (`<span>`) não lê nada; componente (`<PrecoTag />`) pode ler.
      const tagNativa = (ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p) || ts.isJsxClosingElement(p)) && /^[a-z]/.test(m.text);
      if (!nomeDePropriedade && !tagNativa && !(m.text in globalThis)) { tem = true; return; }
    }
    ts.forEachChild(m, procura);
  };
  procura(e);
  return tem;
}

/**
 * Texto de uma expressão que não lê nada da tela: literal de texto ou número, template e `+` entre eles.
 * Qualquer outra constante (`1 < 0`, `Boolean(0)`, `{false}`, `{null}`) não mostra texto: null.
 */
function textoConstante(e: ts.Expression): string | null {
  e = desembrulha(e);
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) || ts.isNumericLiteral(e)) return e.text;
  if (ts.isTemplateExpression(e)) {
    const partes = [e.head.text];
    for (const s of e.templateSpans) {
      const t = textoConstante(s.expression);
      if (t === null) return null;
      partes.push(t, s.literal.text);
    }
    return partes.join("");
  }
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const a = textoConstante(e.left), b = textoConstante(e.right);
    return a === null || b === null ? null : a + b;
  }
  if (ts.isJsxElement(e) || ts.isJsxFragment(e)) {
    // Elemento nativo constante (`<span>Texto</span>`): o texto dos filhos.
    return e.children.map((c) => ts.isJsxText(c) ? c.text : ts.isJsxExpression(c) && c.expression ? textoConstante(c.expression) ?? "" : ts.isJsxElement(c) ? textoConstante(c) ?? "" : "").join("");
  }
  return null;
}

/** A expressão não mostra texto nenhum: não lê a tela e o texto constante dela não tem letra nem número. */
const semTexto = (e: ts.Expression) => !leDaTela(e) && !/[\p{L}\p{N}]/u.test(textoConstante(e) ?? "");

/** Atributo de texto ausente, só o nome, ou sem texto (rótulo, dica, aria-label): `""`, `" "`, `{" " + ""}`, `{undefined}`. */
function vazio(n: Elemento, nome: string): boolean {
  const a = atributo(n, nome);
  return !a || a.valor === true || semTexto(a.valor);
}

/** O valor depende de algo da tela — não é constante (`{1 < 0}`, `{Boolean(0)}`, `"true"`). */
function dinamico(n: Elemento, nome: string): boolean {
  const a = atributo(n, nome);
  return !!a && a.valor !== true && leDaTela(a.valor);
}

/** O controle que o Campo liga: está na função filha do Campo e espalha o parâmetro dela. */
type Ligacao = { controle: Elemento | null; parametro: string | null; problema: string | null };

function ligacaoDoCampo(campo: ts.JsxElement, sf: ts.SourceFile): Ligacao {
  const filhos = campo.children.filter((c) => !(ts.isJsxText(c) && !c.getText(sf).trim()));
  const primeiro = filhos.length === 1 ? filhos[0] : undefined;
  const unico = primeiro && ts.isJsxExpression(primeiro) && primeiro.expression ? desembrulha(primeiro.expression) : undefined;
  const funcao = unico && (ts.isArrowFunction(unico) || ts.isFunctionExpression(unico)) ? unico : undefined;
  const parametro = funcao && funcao.parameters.length === 1 && ts.isIdentifier(funcao.parameters[0].name) ? funcao.parameters[0].name.text : undefined;
  if (!funcao || !parametro) return { controle: null, parametro: null, problema: "Campo sem função de ligação ({(campo) => …})" };
  const espalhaParametro = (n: Elemento) => abertura(n).attributes.properties.some((a) => ts.isJsxSpreadAttribute(a) && ts.isIdentifier(desembrulha(a.expression)) && (desembrulha(a.expression) as ts.Identifier).text === parametro);
  const ligados: Elemento[] = [];
  const procura = (n: ts.Node) => {
    if (ehElemento(n) && espalhaParametro(n)) ligados.push(n);
    ts.forEachChild(n, procura);
  };
  procura(funcao.body);
  if (ligados.length === 0) return { controle: null, parametro, problema: "Campo sem controle ligado (nenhum elemento espalha o parâmetro)" };
  if (ligados.length > 1) return { controle: null, parametro, problema: `Campo liga ${ligados.length} controles` };
  return { controle: ligados[0], parametro, problema: null };
}

/** Funções-componente que recebem `id` por props e o repassam ao controle nativo (SelectISO, …). */
function repassadores(ctx: Contexto): { nomes: Set<string>; internos: Set<ts.Node> } {
  const { sf } = ctx;
  const nomes = new Set<string>();
  const internos = new Set<ts.Node>();
  const visita = (n: ts.Node) => {
    if (ehElemento(n) && NATIVOS.has(tagDe(n, ctx)) && valor(n, "id", sf) === "{id}") {
      let f: ts.Node | undefined = n.parent;
      while (f && !ts.isFunctionLike(f)) f = f.parent;
      const props = f && ts.isFunctionLike(f) ? f.parameters[0]?.name : undefined;
      const recebeId = !!props && ts.isObjectBindingPattern(props) && props.elements.some((e) => (e.propertyName ?? e.name).getText(sf) === "id");
      const nome = f && ts.isFunctionDeclaration(f) ? f.name?.text : f && f.parent && ts.isVariableDeclaration(f.parent) && ts.isIdentifier(f.parent.name) ? f.parent.name.text : undefined;
      if (recebeId && nome && /^[A-Z]/.test(nome)) { nomes.add(nome); internos.add(n); }
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return { nomes, internos };
}

const ehCampo = (n: ts.Node, ctx: Contexto): n is Elemento => ehElemento(n) && tagDe(n, ctx) === "Campo";

/** Todo <Campo> do arquivo liga exatamente um controle, sem reescrever a ligação (vale em qualquer tela). */
export function camposMalLigados(fonte: string, arquivo = "x.tsx"): Achado[] {
  const ctx = contexto(fonte, arquivo);
  const { sf } = ctx;
  const { nomes: locais } = repassadores(ctx);
  const achados: Achado[] = [];
  const acusa = (n: ts.Node, problema: string) => achados.push({ linha: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, trecho: normaliza(n.getText(sf)), problema });
  const visita = (n: ts.Node) => {
    if (ehCampo(n, ctx) && ts.isJsxSelfClosingElement(n)) acusa(n, "Campo sem função de ligação ({(campo) => …})");
    if (ehCampo(n, ctx) && ts.isJsxElement(n)) {
      const tag = n.openingElement;
      const { lista, opacos } = atributos(n);
      if (opacos.length) acusa(tag, "spread no Campo (rótulo e obrigatoriedade não verificáveis)");
      if (!lista.some((a) => a.nome === "rotulo")) acusa(tag, "Campo sem rótulo");
      else if (vazio(n, "rotulo")) acusa(tag, "Campo com rótulo vazio");
      if (atributo(n, "dica") && vazio(n, "dica")) acusa(tag, "Campo com dica vazia ou desligada");
      if (atributo(n, "erro") && !dinamico(n, "erro")) acusa(tag, "Campo com erro constante (não vem da validação)");
      const { controle, parametro, problema } = ligacaoDoCampo(n, sf);
      if (problema) acusa(tag, problema);
      if (controle) {
        const alvo = tagDe(controle, ctx);
        if (!NATIVOS.has(alvo) && !DO_DESIGN_SYSTEM.has(alvo) && !locais.has(alvo)) acusa(abertura(controle), `Campo liga um elemento que não é controle: <${alvo}>`);
        const doControle = atributos(controle);
        for (const nome of DA_LIGACAO) if (doControle.lista.some((a) => a.nome === nome)) acusa(abertura(controle), `atributo da ligação escrito à mão: ${nome}`);
        if (doControle.opacos.some((e) => !(ts.isIdentifier(e) && e.text === parametro))) acusa(abertura(controle), "spread não verificável sobre a ligação");
      }
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return achados;
}

/** O <label> tem texto além do próprio controle (rótulo vazio em volta não nomeia nada). */
function rotuloComTexto(label: ts.JsxElement, ctx: Contexto, excluir: ts.Node | null): boolean {
  const contemJsx = (e: ts.Node): boolean => ts.isJsxElement(e) || ts.isJsxSelfClosingElement(e) || ts.isJsxFragment(e) || (ts.forEachChild(e, (c) => contemJsx(c) || undefined) ?? false);
  const visita = (c: ts.JsxChild): boolean => {
    if (c === excluir) return false;
    if (ts.isJsxText(c)) return /[\p{L}\p{N}]/u.test(c.text);
    // Expressão: só a que lê a tela ou tem texto constante (`{" "}` e `{""}` não nomeiam nada).
    if (ts.isJsxExpression(c)) return !!c.expression && !contemJsx(c.expression) && !semTexto(c.expression);
    if (ts.isJsxElement(c)) return !NATIVOS.has(tagDe(c, ctx)) && c.children.some(visita);
    if (ts.isJsxFragment(c)) return c.children.some(visita);
    return false;
  };
  return label.children.some(visita);
}

/** Nas áreas migradas: obrigatório passa pelo Campo; todo controle tem nome acessível. */
export function controlesForaDoCampo(fonte: string, arquivo = "x.tsx"): Achado[] {
  const ctx = contexto(fonte, arquivo);
  const { sf } = ctx;
  const achados: Achado[] = [];
  const acusa = (n: Elemento, problema: string) => {
    const tag = abertura(n);
    achados.push({ linha: sf.getLineAndCharacterOfPosition(tag.getStart(sf)).line + 1, trecho: normaliza(tag.getText(sf)), problema });
  };

  // Controles ligados a um Campo → o Campo; rótulos por htmlFor; ids do arquivo.
  const ligadoA = new Map<ts.Node, Elemento>();
  const rotulosPorAlvo = new Map<string, ts.JsxElement[]>();
  const porId = new Map<string, Elemento[]>();
  const coleta = (n: ts.Node) => {
    if (ehCampo(n, ctx) && ts.isJsxElement(n)) {
      const { controle } = ligacaoDoCampo(n, sf);
      if (controle) ligadoA.set(controle, n);
    }
    if (ehElemento(n)) {
      const id = valor(n, "id", sf);
      if (typeof id === "string") porId.set(id, [...(porId.get(id) ?? []), n]);
      const alvo = valor(n, "htmlFor", sf);
      if (typeof alvo === "string" && ts.isJsxElement(n)) rotulosPorAlvo.set(alvo, [...(rotulosPorAlvo.get(alvo) ?? []), n]);
    }
    ts.forEachChild(n, coleta);
  };
  coleta(sf);
  const { nomes: locais, internos } = repassadores(ctx);

  const labelEmVolta = (n: ts.Node): ts.JsxElement | null => {
    for (let p = n.parent; p; p = p.parent) if (ts.isJsxElement(p) && tagDe(p, ctx) === "label") return p;
    return null;
  };
  const ehTagDeControle = (el: Elemento) => {
    const t = tagDe(el, ctx);
    return NATIVOS.has(t) || DO_DESIGN_SYSTEM.has(t) || locais.has(t) || ligadoA.has(el);
  };
  const temRotulo = (n: Elemento) => {
    for (const nome of ["aria-label", "ariaLabel"]) if (!vazio(n, nome)) return true;
    // aria-labelledby: cada id citado tem de ser de outro elemento, que não seja controle e que tenha texto
    // (o próprio controle ou um campo vizinho não dão nome).
    const rotuladoPor = valor(n, "aria-labelledby", sf);
    if (typeof rotuladoPor === "string" && !vazio(n, "aria-labelledby")) {
      const alvos = rotuladoPor.startsWith("{") ? [rotuladoPor] : rotuladoPor.split(/\s+/).filter(Boolean);
      const nomeia = (el: Elemento) => el !== n && !ehTagDeControle(el) && ts.isJsxElement(el) && rotuloComTexto(el, ctx, null);
      if (alvos.length && alvos.every((alvo) => (porId.get(alvo) ?? []).some(nomeia))) return true;
    }
    const id = valor(n, "id", sf);
    if (typeof id === "string" && (rotulosPorAlvo.get(id) ?? []).some((l) => rotuloComTexto(l, ctx, null))) return true;
    const label = labelEmVolta(n);
    return !!label && rotuloComTexto(label, ctx, n);
  };

  const visita = (n: ts.Node) => {
    if (ehElemento(n) && !internos.has(n)) {
      const tag = tagDe(n, ctx);
      const ehControle = NATIVOS.has(tag) || DO_DESIGN_SYSTEM.has(tag) || locais.has(tag) || ligadoA.has(n);
      const tipo = valor(n, "type", sf);
      if (ehControle && !(tag === "input" && typeof tipo === "string" && TIPOS_SEM_ROTULO.includes(tipo))) {
        const campo = ligadoA.get(n);
        const required = valor(n, "required", sf);
        const obrigatorio = ligado(required) || ligado(valor(n, "aria-required", sf)) || (tag === "CampoFuso" && (required === undefined || ligado(required)));
        if (campo) {
          if (obrigatorio && !ligado(valor(campo, "obrigatorio", sf))) acusa(n, "obrigatório num Campo sem `obrigatorio`");
        } else {
          if (atributos(n).opacos.length) acusa(n, "atributos por spread não verificáveis");
          if (obrigatorio) {
            if (!(temRotulo(n) && dinamico(n, "aria-invalid"))) acusa(n, "obrigatório fora do Campo (sem rótulo e aria-invalid ligados)");
          } else if (!temRotulo(n)) {
            acusa(n, "sem nome acessível");
          }
        }
      }
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return achados;
}

/** Cada <Campo> do arquivo, na ordem: rótulo · obrigatoriedade · controle ligado [· dica] [· erro: expressão]. */
export function mapaDeCampos(fonte: string, arquivo = "x.tsx"): string[] {
  const ctx = contexto(fonte, arquivo);
  const { sf } = ctx;
  const itens: string[] = [];
  const semChaves = (v: string) => v.replace(/^\{/, "").replace(/\}$/, "");
  const visita = (n: ts.Node) => {
    if (ehCampo(n, ctx) && ts.isJsxElement(n)) {
      const rotulo = valor(n, "rotulo", sf);
      const obrig = valor(n, "obrigatorio", sf);
      const obrigatoriedade = obrig === undefined || obrig === "{false}" ? "opcional"
        : obrig === true || obrig === "{true}" ? "obrigatório"
          : `obrigatório se ${semChaves(obrig)}`;
      const { controle } = ligacaoDoCampo(n, sf);
      const partes = [rotulo === true || rotulo === undefined ? "(sem rótulo)" : rotulo, obrigatoriedade, controle ? tagDe(controle, ctx) : "(sem controle)"];
      if (atributo(n, "dica")) partes.push("dica");
      const erro = valor(n, "erro", sf);
      if (erro !== undefined) partes.push(`erro: ${erro === true ? "(sem valor)" : semChaves(erro)}`);
      itens.push(partes.join(" · "));
    }
    if (ehCampo(n, ctx) && ts.isJsxSelfClosingElement(n)) itens.push("(sem controle)");
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return itens;
}

type Tela = { arquivo: string; fonte: string };
type AchadoDaTela = Achado & { arquivo: string };

function telas(): Tela[] {
  const saida: Tela[] = [];
  for (const raiz of RAIZES) for (const f of readdirSync(raiz, { recursive: true }) as string[]) {
    if (!f.endsWith(".tsx") || f.includes(".test.")) continue;
    const arquivo = join(raiz, f).split("\\").join("/");
    saida.push({ arquivo, fonte: readFileSync(arquivo, "utf8") });
  }
  return saida;
}

export function naArea(arquivo: string, areas = AREAS_MIGRADAS): boolean {
  return areas.some(({ pasta, subpastas }) => {
    if (!arquivo.startsWith(`${pasta}/`)) return false;
    return subpastas || !arquivo.slice(pasta.length + 1).includes("/");
  });
}

/** Os achados de todas as telas: as regras de área nas migradas; a de ligação do Campo em todas. */
export function achadosDasTelas(lista: Tela[]): AchadoDaTela[] {
  return [
    ...lista.filter(({ arquivo }) => naArea(arquivo)).flatMap(({ arquivo, fonte }) => controlesForaDoCampo(fonte, arquivo).map((a) => ({ arquivo, ...a }))),
    ...lista.filter(({ arquivo }) => arquivo !== FONTE_DO_CAMPO).flatMap(({ arquivo, fonte }) => camposMalLigados(fonte, arquivo).map((a) => ({ arquivo, ...a }))),
  ];
}

/**
 * Aplica as exceções: casam por arquivo + trecho EXATOS. Devolve o que sobrou (pendentes) e as exceções
 * com problema (soltas): vencida (0 casos), ampla demais (2+) ou sem motivo.
 */
export function aplicarExcecoes(achados: AchadoDaTela[], excecoes: readonly ExcecaoCampo[]): { pendentes: string[]; soltas: string[] } {
  const casadas = new Map<number, number>();
  const pendentes: string[] = [];
  for (const a of achados) {
    const i = excecoes.findIndex((e) => e.arquivo === a.arquivo && e.trecho === a.trecho);
    if (i >= 0) { casadas.set(i, (casadas.get(i) ?? 0) + 1); continue; }
    pendentes.push(`${a.arquivo}:${a.linha} ${a.problema} | ${a.trecho.slice(0, 140)}`);
  }
  const soltas = excecoes.flatMap((e, i) => {
    const vezes = casadas.get(i) ?? 0;
    return [
      ...(vezes !== 1 ? [`${vezes}× ${e.arquivo} | ${e.trecho.slice(0, 80)}`] : []),
      ...(!e.motivo.trim() ? [`sem motivo: ${e.arquivo} | ${e.trecho.slice(0, 80)}`] : []),
    ];
  });
  return { pendentes, soltas };
}

describe("detector do Campo (autoteste)", () => {
  const fonteDe = (corpo: string, cabeca = "") => `${cabeca}\nexport function T({ v, e, c }: any) { return (<>${corpo}</>); }`;
  const fora = (corpo: string, cabeca = "") => controlesForaDoCampo(fonteDe(corpo, cabeca)).map((a) => a.problema);
  const mal = (corpo: string, cabeca = "") => camposMalLigados(fonteDe(corpo, cabeca)).map((a) => a.problema);
  const OBRIG_FORA = "obrigatório fora do Campo (sem rótulo e aria-invalid ligados)";

  it("as listas fechadas da trava são exatamente estas (cópia literal; os testes abaixo percorrem a cópia)", () => {
    expect(DA_LIGACAO).toEqual(["id", "aria-required", "aria-invalid", "aria-describedby"]);
    expect(TIPOS_SEM_ROTULO).toEqual(["hidden", "submit", "button", "reset", "image"]);
    expect([...NATIVOS]).toEqual(["input", "select", "textarea"]);
    expect([...DO_DESIGN_SYSTEM]).toEqual(["CampoTexto", "CampoMoeda", "CampoFuso"]);
    expect(AREAS_MIGRADAS).toEqual([
      { pasta: "src/app/(app)/matriculas/nova", subpastas: true },
      { pasta: "src/app/(app)/alunos/[id]", subpastas: false },
    ]);
  });

  it("obrigatório (required, aria-required, CampoFuso por padrão) fora do Campo é acusado", () => {
    expect(fora('<input required value={v} />')).toEqual([OBRIG_FORA]);
    expect(fora('<select aria-required="true" value={v} />')).toEqual([OBRIG_FORA]);
    expect(fora('<CampoTexto required={c} value={v} />')).toEqual([OBRIG_FORA]);
    expect(fora('<CampoMoeda required value={v} onChange={c} className="x" />')).toEqual([OBRIG_FORA]);
    expect(fora('<CampoFuso padrao="" className="x" />')).toEqual([OBRIG_FORA]);
    // Rótulo sem aria-invalid ainda não basta.
    expect(fora('<label htmlFor="a">A</label><input id="a" required />')).toEqual([OBRIG_FORA]);
    expect(fora('<label>A <input required /></label>')).toEqual([OBRIG_FORA]);
  });

  it("todo tipo de <input> que não está na lista de isentos é conferido (a lista isenta é só a cópia literal)", () => {
    const conferidos = ["text", "date", "email", "number", "tel", "password", "search", "url", "time", "datetime-local", "month", "week", "file", "checkbox", "radio", "color", "range"];
    for (const tipo of conferidos) {
      expect(fora(`<input type="${tipo}" required />`), tipo).toEqual([OBRIG_FORA]);
      expect(fora(`<input type="${tipo}" />`), tipo).toEqual(["sem nome acessível"]);
    }
    for (const tipo of ["hidden", "submit", "button", "reset", "image"]) {
      expect(fora(`<input type="${tipo}" required />`), tipo).toEqual([]);
    }
  });

  it("fora do Campo, obrigatório com rótulo E aria-invalid ligados passa; desligado não é obrigatório", () => {
    expect(fora('<label htmlFor="a">A</label><input id="a" required aria-invalid={!!e} />')).toEqual([]);
    expect(fora('<input aria-label="A" required aria-invalid={!!e} />')).toEqual([]);
    expect(fora('<label>A <input required aria-invalid={!!e} /></label>')).toEqual([]);
    for (const desligado of ["{false}", '"false"', "{undefined}", "{null}"]) {
      expect(fora(`<input aria-label="A" required=${desligado} />`), desligado).toEqual([]);
    }
    expect(fora('<CampoFuso padrao="" required={false} ariaLabel="Fuso" className="x" />')).toEqual([]);
  });

  it("B5 — evasões: required por spread de objeto, import renomeado, aria-invalid constante", () => {
    // E1: required por spread de objeto literal.
    expect(fora('<input aria-label="Evasão" {...{ required: true }} />')).toEqual([OBRIG_FORA]);
    expect(fora('<input aria-label="Evasão" {...{ "aria-required": "true" }} />')).toEqual([OBRIG_FORA]);
    // E4: componente do design system renomeado no import ou numa constante.
    expect(fora('<Texto required value={v} />', 'import { CampoTexto as Texto } from "@/components/CampoTexto";')).toEqual([OBRIG_FORA]);
    expect(fora('<Moeda value={v} onChange={c} className="x" />', 'import { CampoMoeda } from "@/components/CampoMoeda"; const Moeda = CampoMoeda;')).toEqual(["sem nome acessível"]);
    expect(fora('<DS.CampoFuso padrao="" className="x" />', 'import * as DS from "@/components/CampoFuso";')).toEqual([OBRIG_FORA]);
    // E12: aria-invalid que nunca liga (sem nenhum valor da tela).
    for (const constante of ["{1 < 0}", "{false}", "{true}", '"true"', "{undefined}"]) {
      expect(fora(`<input aria-label="Q" required aria-invalid=${constante} />`), constante).toEqual([OBRIG_FORA]);
    }
    expect(fora('<input aria-label="Q" required aria-invalid={erros.q !== undefined} />')).toEqual([]);
  });

  it("B5 — nome acessível de verdade: aria-label não vazio, labelledby para id existente, <label> com texto", () => {
    // E7: aria-label vazio.
    for (const vazioRotulo of ['""', '" "', '{""}', "{undefined}"]) expect(fora(`<input aria-label=${vazioRotulo} />`), vazioRotulo).toEqual(["sem nome acessível"]);
    expect(fora("<input aria-label={rotulo} />")).toEqual([]);
    // E8: aria-labelledby órfão (todos os ids têm de existir).
    expect(fora('<select aria-labelledby="nao-existe" />')).toEqual(["sem nome acessível"]);
    expect(fora('<h2 id="t">T</h2><select aria-labelledby="t outro" />')).toEqual(["sem nome acessível"]);
    expect(fora('<h2 id="t">T</h2><p id="u">U</p><select aria-labelledby="t u" />')).toEqual([]);
    expect(fora("<h2 id={ids.t}>T</h2><select aria-labelledby={ids.t} />")).toEqual([]);
    expect(fora('<select aria-labelledby="" />')).toEqual(["sem nome acessível"]);
    // E13: <label> vazio em volta, ou htmlFor de um <label> vazio.
    expect(fora("<label><input /></label>")).toEqual(["sem nome acessível"]);
    expect(fora('<label className="x">  <input type="checkbox" />  </label>')).toEqual(["sem nome acessível"]);
    expect(fora('<label htmlFor="a"></label><input id="a" />')).toEqual(["sem nome acessível"]);
    expect(fora('<label htmlFor="a"><span /></label><input id="a" />')).toEqual(["sem nome acessível"]);
    expect(fora('<label htmlFor="a"><span>A</span></label><input id="a" />')).toEqual([]);
    expect(fora("<label>{rotulo} <input /></label>")).toEqual([]);
  });

  it("R2 B2 — EV6: aria-invalid com função ou objeto global e nada da tela não liga (Boolean(0), Math…)", () => {
    for (const constante of ["{Boolean(0)}", "{Number(1) > 2}", "{Math.random() > 2}", '{String(1) === "x"}', "{isNaN(1)}", "{Boolean(undefined)}"]) {
      expect(fora(`<input aria-label="Q" required aria-invalid=${constante} />`), constante).toEqual([OBRIG_FORA]);
      expect(mal(`<Campo rotulo="A" erro=${constante}>{(campo) => <input {...campo} />}</Campo>`), constante).toEqual(["Campo com erro constante (não vem da validação)"]);
    }
    for (const daTela of ["{Boolean(erros.nome)}", "{Math.max(0, falhas) > 0}", "{String(estado) === \"erro\"}"]) {
      expect(fora(`<input aria-label="Q" required aria-invalid=${daTela} />`), daTela).toEqual([]);
    }
    // Nome de propriedade não é o que se lê: `{ chave: 1 }.chave` não lê nada da tela.
    expect(fora('<input aria-label="Q" required aria-invalid={({ erro: 1 }).erro > 2} />')).toEqual([OBRIG_FORA]);
  });

  it("R2 B2 — EV7: <label> com expressão sem texto em volta não nomeia ({\" \"}, {\"\"}, template vazio, concatenação vazia)", () => {
    for (const semTexto of ['{" "}', '{""}', "{`  `}", '{" " + ""}', "{false}", "{null}", "{1 < 0}", "{Boolean(0)}"]) {
      expect(fora(`<label>${semTexto}<input /></label>`), semTexto).toEqual(["sem nome acessível"]);
      expect(fora(`<label htmlFor="a">${semTexto}</label><input id="a" />`), semTexto).toEqual(["sem nome acessível"]);
    }
    for (const comTexto of ['{"Nome"}', "{`Nome ${sufixo}`}", "{rotulo}", '{"Nome " + sufixo}', "{2}"]) {
      expect(fora(`<label>${comTexto}<input /></label>`), comTexto).toEqual([]);
    }
    // aria-label e rótulo do Campo: a mesma regra.
    expect(fora('<input aria-label={" " + ""} />')).toEqual(["sem nome acessível"]);
    expect(mal('<Campo rotulo={" " + ""}>{(campo) => <input {...campo} />}</Campo>')).toEqual(["Campo com rótulo vazio"]);
    expect(mal('<Campo rotulo="A" dica={<span className="x" />}>{(campo) => <input {...campo} />}</Campo>')).toEqual(["Campo com dica vazia ou desligada"]);
    expect(mal('<Campo rotulo="A" dica={<span className="x">Formato</span>}>{(campo) => <input {...campo} />}</Campo>')).toEqual([]);
  });

  it("R2 B2 — EV12: aria-labelledby que aponta para o próprio controle, outro controle ou elemento sem texto não nomeia", () => {
    expect(fora('<input id="ev12" aria-labelledby="ev12" />')).toEqual(["sem nome acessível"]);
    expect(fora("<input id={ids.a} aria-labelledby={ids.a} />")).toEqual(["sem nome acessível"]);
    // Outro controle (mesmo com nome próprio) não é rótulo.
    expect(fora('<label htmlFor="a">A</label><input id="a" /><select aria-labelledby="a" />')).toEqual(["sem nome acessível"]);
    expect(fora('<CampoTexto id="a" aria-label="A" /><select aria-labelledby="a" />')).toEqual(["sem nome acessível"]);
    // Alvo sem texto.
    expect(fora('<span id="t" /><select aria-labelledby="t" />')).toEqual(["sem nome acessível"]);
    expect(fora('<h2 id="t">{" "}</h2><select aria-labelledby="t" />')).toEqual(["sem nome acessível"]);
    // Um alvo bom e um ruim: todos têm de nomear.
    expect(fora('<h2 id="t">T</h2><select id="s" aria-labelledby="t s" />')).toEqual(["sem nome acessível"]);
    expect(fora('<h2 id="t"><span>Título</span></h2><select aria-labelledby="t" />')).toEqual([]);
  });

  it("dentro do Campo: passa; obrigatório pede `obrigatorio` no Campo", () => {
    expect(fora('<Campo rotulo="A" obrigatorio>{(campo) => <input {...campo} required />}</Campo>')).toEqual([]);
    expect(fora('<Campo rotulo="A" obrigatorio={c}>{(campo) => <CampoFuso {...campo} padrao="" className="x" />}</Campo>')).toEqual([]);
    expect(fora('<Campo rotulo="A">{(campo) => <input {...campo} required />}</Campo>')).toEqual(["obrigatório num Campo sem `obrigatorio`"]);
    expect(fora('<Campo rotulo="A" obrigatorio={false}>{(campo) => <CampoFuso {...campo} padrao="" className="x" />}</Campo>')).toEqual(["obrigatório num Campo sem `obrigatorio`"]);
    // E14: required por spread de objeto num Campo sem `obrigatorio`.
    expect(fora('<Campo rotulo="Req">{(campo) => <input {...campo} {...{ required: true }} />}</Campo>')).toEqual(["obrigatório num Campo sem `obrigatorio`"]);
    // Campo renomeado no import continua sendo o Campo.
    expect(fora('<C rotulo="A">{(campo) => <input {...campo} required />}</C>', 'import { Campo as C } from "@/components/Campo";')).toEqual(["obrigatório num Campo sem `obrigatorio`"]);
    // Controle opcional ligado: o nome vem do rótulo do Campo.
    expect(fora('<Campo rotulo="A">{(campo) => <select {...campo} value={v} />}</Campo>')).toEqual([]);
    // Elemento que só está DENTRO do Campo, sem espalhar a ligação, não está ligado.
    expect(fora('<Campo rotulo="A">{(campo) => <><input {...campo} /><input required /></>}</Campo>')).toEqual([OBRIG_FORA]);
  });

  it("nome acessível de todo controle: Campo, <label> em volta, htmlFor ↔ id, aria-label/labelledby", () => {
    expect(fora("<input value={v} />")).toEqual(["sem nome acessível"]);
    expect(fora('<label htmlFor="b">B</label><input id="a" />')).toEqual(["sem nome acessível"]);
    expect(fora('<label htmlFor="a">A</label><input id="a" />')).toEqual([]);
    expect(fora("<label htmlFor={ids.a}>A</label><input id={ids.a} />")).toEqual([]);
    expect(fora('<label className="x"><input type="checkbox" /> A</label>')).toEqual([]);
    expect(fora('<h2 id="t">T</h2><select aria-labelledby="t" />')).toEqual([]);
    expect(fora('<input type="hidden" name="x" value={v} />')).toEqual([]);
    expect(fora('<CampoMoeda value={v} onChange={c} className="x" />')).toEqual(["sem nome acessível"]);
    expect(fora('<CampoMoeda ariaLabel="Valor" value={v} onChange={c} className="x" />')).toEqual([]);
  });

  it("spread que a sintaxe não abre, num controle fora do Campo, não é verificável", () => {
    expect(fora('<input aria-label="A" {...resto} />')).toEqual(["atributos por spread não verificáveis"]);
    expect(fora('<input {...resto} />')).toEqual(["atributos por spread não verificáveis", "sem nome acessível"]);
  });

  it("componente local que repassa `id` é conferido em cada uso (e não por dentro)", () => {
    const cabeca = "function SelectX({ id, ...resto }: any) { return <select id={id} {...resto} />; }";
    expect(fora("<SelectX value={v} />", cabeca)).toEqual(["sem nome acessível"]);
    expect(fora("<SelectX aria-required value={v} />", cabeca)).toEqual([OBRIG_FORA]);
    expect(fora('<Campo rotulo="País" obrigatorio>{(campo) => <SelectX {...campo} value={v} />}</Campo>', cabeca)).toEqual([]);
  });

  it("todo Campo liga exatamente um controle, sem reescrever a ligação", () => {
    expect(mal('<Campo rotulo="A" erro={e.a}>{(campo) => <input {...campo} />}</Campo>')).toEqual([]);
    expect(mal('<Campo rotulo="A">{function (campo) { return <input {...campo} />; }}</Campo>')).toEqual([]);
    expect(mal('<Campo rotulo="A"><input /></Campo>')).toEqual(["Campo sem função de ligação ({(campo) => …})"]);
    expect(mal('<Campo rotulo="A" />')).toEqual(["Campo sem função de ligação ({(campo) => …})"]);
    expect(mal('<Campo rotulo="A">{({ id }) => <input id={id} />}</Campo>')).toEqual(["Campo sem função de ligação ({(campo) => …})"]);
    expect(mal('<Campo rotulo="A">{(campo) => <input id={campo.id} />}</Campo>')).toEqual(["Campo sem controle ligado (nenhum elemento espalha o parâmetro)"]);
    expect(mal('<Campo rotulo="A">{(campo) => <><input {...campo} /><select {...campo} /></>}</Campo>')).toEqual(["Campo liga 2 controles"]);
    expect(mal('<Campo {...v}>{(campo) => <input {...campo} />}</Campo>')).toEqual(["spread no Campo (rótulo e obrigatoriedade não verificáveis)", "Campo sem rótulo"]);
  });

  it("cada atributo da ligação reescrito à mão é acusado — direto ou por spread de objeto (C1/E6)", () => {
    for (const nome of ["id", "aria-required", "aria-invalid", "aria-describedby"]) {
      expect(mal(`<Campo rotulo="A">{(campo) => <input {...campo} ${nome}={v} />}</Campo>`), nome).toEqual([`atributo da ligação escrito à mão: ${nome}`]);
      expect(mal(`<Campo rotulo="A">{(campo) => <input {...campo} {...{ "${nome}": v }} />}</Campo>`), nome).toEqual([`atributo da ligação escrito à mão: ${nome}`]);
    }
    expect(mal('<Campo rotulo="A">{(campo) => <input {...campo} {...outro} />}</Campo>')).toEqual(["spread não verificável sobre a ligação"]);
  });

  it("C1 — o Campo liga um controle de verdade: nem <span>, nem componente local que descarta o id", () => {
    expect(mal('<Campo rotulo="A">{(campo) => <span {...campo} />}</Campo>')).toEqual(["Campo liga um elemento que não é controle: <span>"]);
    const mudo = "function Mudo(_: any) { return <input aria-label=\"x\" />; }";
    expect(mal('<Campo rotulo="Mudo">{(campo) => <Mudo {...campo} />}</Campo>', mudo)).toEqual(["Campo liga um elemento que não é controle: <Mudo>"]);
    const repassa = "function Repassa({ id, ...resto }: any) { return <select id={id} {...resto} />; }";
    expect(mal('<Campo rotulo="A">{(campo) => <Repassa {...campo} />}</Campo>', repassa)).toEqual([]);
    expect(mal('<Campo rotulo="A">{(campo) => <Texto {...campo} />}</Campo>', 'import { CampoTexto as Texto } from "@/components/CampoTexto";')).toEqual([]);
  });

  it("C1/B2/B3 — rótulo e dica não vazios; o erro vem da validação, não de uma constante", () => {
    for (const vazioRotulo of ['""', '" "', "{undefined}", "{null}"]) {
      expect(mal(`<Campo rotulo=${vazioRotulo}>{(campo) => <input {...campo} />}</Campo>`), vazioRotulo).toEqual(["Campo com rótulo vazio"]);
    }
    for (const vazioDica of ['""', "{undefined}", "{null}", "{false}"]) {
      expect(mal(`<Campo rotulo="A" dica=${vazioDica}>{(campo) => <input {...campo} />}</Campo>`), vazioDica).toEqual(["Campo com dica vazia ou desligada"]);
    }
    expect(mal('<Campo rotulo="A" dica={`Dia ${d}`}>{(campo) => <input {...campo} />}</Campo>')).toEqual([]);
    for (const constante of ["{undefined}", "{null}", '"Informe."', "{false}"]) {
      expect(mal(`<Campo rotulo="A" erro=${constante}>{(campo) => <input {...campo} />}</Campo>`), constante).toEqual(["Campo com erro constante (não vem da validação)"]);
    }
    expect(mal('<Campo rotulo="A" erro={t ? "Informe." : null}>{(campo) => <input {...campo} />}</Campo>')).toEqual([]);
  });

  it("mapa: rótulo, obrigatoriedade, controle, dica e a expressão do erro de cada Campo, na ordem", () => {
    expect(mapaDeCampos([
      '<><Campo id="a" rotulo="Nome" obrigatorio erro={e.nome}>{(c) => <input {...c} />}</Campo>',
      '<Campo rotulo={t ? "Empresa" : "Responsável"} obrigatorio={p !== "ALUNO"} dica="Ajuda">{(c) => <SelectISO {...c} />}</Campo>',
      '<Campo rotulo="Obs">{(c) => <Texto {...c} />}</Campo><Campo rotulo="X"><input /></Campo></>',
    ].join(""), "x.tsx")).toEqual([
      "Nome · obrigatório · input · erro: e.nome",
      '{t ? "Empresa" : "Responsável"} · obrigatório se p !== "ALUNO" · SelectISO · dica',
      "Obs · opcional · Texto",
      "X · opcional · (sem controle)",
    ]);
    // Religar o erro a outra coisa (ou desligá-lo) muda o mapa.
    expect(mapaDeCampos('<Campo rotulo="Nome" erro={undefined}>{(c) => <input {...c} />}</Campo>')).toEqual(["Nome · opcional · input · erro: undefined"]);
  });

  it("áreas: arquivo novo na pasta entra; subpasta só quando a área a inclui", () => {
    expect(naArea("src/app/(app)/alunos/[id]/FichaAluno.tsx")).toBe(true);
    expect(naArea("src/app/(app)/alunos/[id]/NovoPainel.tsx")).toBe(true);
    expect(naArea("src/app/(app)/alunos/[id]/financeiro/FichaFinanceira.tsx")).toBe(false);
    expect(naArea("src/app/(app)/alunos/[id]-copia/X.tsx")).toBe(false);
    expect(naArea("src/app/(app)/matriculas/nova/MatriculaFormulario.tsx")).toBe(true);
    expect(naArea("src/app/(app)/matriculas/nova/passos/Passo3.tsx")).toBe(true);
    // A pasta casa inteira: `nova-copia/` e `[id]-copia.tsx` não são `nova/` nem `[id]/`.
    expect(naArea("src/app/(app)/matriculas/nova-copia/X.tsx")).toBe(false);
    expect(naArea("src/app/(app)/alunos/[id]-copia.tsx")).toBe(false);
    expect(naArea("src/app/(app)/matriculas/[id]/page.tsx")).toBe(false);
  });

  it("telas: a regra de área só nas migradas; a de ligação do Campo em qualquer tela (menos a fonte)", () => {
    const sem = "export function A() { return <input />; }";
    const malLigado = 'export function B() { return <Campo rotulo="A"><input /></Campo>; }';
    const achados = achadosDasTelas([
      { arquivo: "src/app/(app)/alunos/[id]/NovoPainel.tsx", fonte: sem },
      { arquivo: "src/app/(app)/leads/Lista.tsx", fonte: sem },
      { arquivo: "src/app/(app)/leads/Formulario.tsx", fonte: malLigado },
      { arquivo: FONTE_DO_CAMPO, fonte: malLigado },
    ]);
    expect(achados.map((a) => `${a.arquivo} ${a.problema}`)).toEqual([
      "src/app/(app)/alunos/[id]/NovoPainel.tsx sem nome acessível",
      "src/app/(app)/leads/Formulario.tsx Campo sem função de ligação ({(campo) => …})",
    ]);
  });

  it("exceções: casam pelo trecho exato, uma vez cada, e precisam de motivo", () => {
    const achado = (trecho: string): AchadoDaTela => ({ arquivo: "a.tsx", linha: 1, trecho, problema: "p" });
    const exc = (trecho: string, motivo = "motivo"): ExcecaoCampo => ({ arquivo: "a.tsx", trecho, motivo });
    expect(aplicarExcecoes([achado("<input required />")], [exc("<input required />")])).toEqual({ pendentes: [], soltas: [] });
    // Trecho parcial não casa: o achado fica pendente e a exceção, vencida.
    const parcial = aplicarExcecoes([achado("<input required />")], [exc("<input")]);
    expect(parcial.pendentes).toHaveLength(1);
    expect(parcial.soltas).toEqual(["0× a.tsx | <input"]);
    // Outro arquivo não casa.
    expect(aplicarExcecoes([achado("<x />")], [{ arquivo: "b.tsx", trecho: "<x />", motivo: "m" }]).soltas).toEqual(["0× b.tsx | <x />"]);
    // Ampla demais: casa dois casos.
    expect(aplicarExcecoes([achado("<x />"), achado("<x />")], [exc("<x />")]).soltas).toEqual(["2× a.tsx | <x />"]);
    // Sem motivo.
    expect(aplicarExcecoes([achado("<x />")], [exc("<x />", "  ")]).soltas).toEqual(["sem motivo: a.tsx | <x />"]);
  });
});

describe("Campo nas telas", () => {
  const todas = telas();
  const migradas = todas.filter(({ arquivo }) => naArea(arquivo));

  it("a varredura acha as áreas migradas (não passa vazia por erro de caminho)", () => {
    for (const { pasta } of AREAS_MIGRADAS) expect(migradas.some(({ arquivo }) => arquivo.startsWith(`${pasta}/`)), pasta).toBe(true);
    expect(migradas.map(({ arquivo }) => arquivo)).toContain("src/app/(app)/matriculas/nova/MatriculaFormulario.tsx");
    expect(migradas.map(({ arquivo }) => arquivo)).toContain("src/app/(app)/alunos/[id]/FichaAluno.tsx");
    // Rota filha de /alunos/[id] é outra tela: entra quando for migrada.
    expect(migradas.map(({ arquivo }) => arquivo)).not.toContain("src/app/(app)/alunos/[id]/financeiro/FichaFinanceira.tsx");
  });

  it("nas áreas migradas, obrigatório passa pelo Campo e todo controle tem nome; todo Campo liga bem (ou exceção ancorada)", () => {
    const { pendentes, soltas } = aplicarExcecoes(achadosDasTelas(todas), EXCECOES_CAMPO);
    expect(pendentes).toEqual([]);
    expect(soltas).toEqual([]);
  });

  it("cada tela tem exatamente os Campos do manifesto (trocar, apagar ou tirar erro/obrigatório aparece aqui)", () => {
    const real: Record<string, string[]> = {};
    for (const { arquivo, fonte } of todas) {
      const itens = mapaDeCampos(fonte, arquivo);
      if (itens.length && arquivo !== FONTE_DO_CAMPO) real[arquivo] = itens;
    }
    expect(real).toEqual(MAPA_CAMPOS);
  });

  it("o wrapper local de /matriculas/nova não volta (o Campo é o compartilhado)", () => {
    const fonte = migradas.find(({ arquivo }) => arquivo.endsWith("/MatriculaFormulario.tsx"))!.fonte;
    expect(fonte).not.toMatch(/function Campo\b/);
    expect(fonte).toMatch(/import \{[^}]*\bCampo\b[^}]*\} from "@\/components\/Campo"/);
  });
});
