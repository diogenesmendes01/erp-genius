import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import config from "../../tailwind.config";
import { BASE_BOTAO, TAMANHOS_BOTAO, VARIANTES_BOTAO, type TamanhoBotao, type VarianteBotao } from "@/components/Botao";
import { paresDeContraste, paresTexto, reprovados, reprovadosSolidos, semComentarios } from "./contraste-nucleo";
import { EXCECOES_CONTRASTE, FUNDOS_DA_MARCA_SEM_TEXTO, SUPERFICIES, SUPERFICIES_DA_SELECAO } from "./contraste-mapa";

const SHADES = ["500", "600"];
const SOLIDOS_DA_MARCA = ["brand-solid", "success"];

const CSS = readFileSync("src/app/globals.css", "utf-8");
const CORES = (config.theme?.extend?.colors ?? {}) as Record<string, string | Record<string, string>>;

describe("contraste: tokens do globals.css nos dois temas (docs/43 §6 item 5)", () => {
  it("texto de cada fundo sólido ≥ 4,5:1 (par do mapa); --border-control e --brand-solid ≥ 3:1 sobre as superfícies, nos dois temas", () => {
    expect(reprovadosSolidos()).toEqual([]);
    const pares = paresDeContraste(CSS, SUPERFICIES, [], CORES.white as string, SUPERFICIES_DA_SELECAO);
    expect(pares).toHaveLength(2 * (SUPERFICIES.length + SUPERFICIES_DA_SELECAO.length));
    expect(pares.filter((p) => p.par.startsWith("--brand-solid/")).map((p) => `${p.tema} ${p.par}`)).toEqual(
      (["claro", "escuro"] as const).flatMap((tema) => SUPERFICIES_DA_SELECAO.map((s) => `${tema} --brand-solid/${s}`)),
    );
    expect(reprovados(pares)).toEqual([]);
  });

  it("balões e autores da thread passam 4,5:1 nos dois temas", () => {
    expect(reprovados([
      ...paresTexto("--text-primary", ["--bubble-ia", "--bubble-note", "--entry", "--entry-accent"], 4.5),
      ...paresTexto("--text-secondary", ["--bubble-ia", "--bubble-note", "--entry", "--entry-accent"], 4.5),
      ...paresTexto("--ai-text", ["--bubble-ia"], 4.5),
      ...paresTexto("--warning-text", ["--bubble-note"], 4.5),
      ...paresTexto("--brand-strong", ["--entry-accent"], 4.5),
    ])).toEqual([]);
  });

});

const MARCA = "\u0000";
const LIMITE = 512;

const M_BRANCO = "fundo que inverte no escuro com texto branco";
const M_DESCONHECIDO = "fundo da marca com classe que não se sabe daqui (pode trazer texto branco)";
const M_COMPONENTE = "fundo da marca passado a componente (ele pode pôr texto branco)";
const M_FORA = "fundo da marca fora de className analisável";

const FUNDO = new RegExp(`^bg-(?:brand-(?:${SHADES.join("|")})|\\[(?:var\\(\\s*)?--brand\\s*\\)?\\])(?:/\\S+)?$`);
const SOLIDO = /^bg-(?:brand-solid|success|\[(?:var\(\s*)?--(?:brand|success)-solid\s*\)?\])(?:\/\S+)?$/;
const BRANCO = /^text-(?:white|\[(?:#fff(?:fff)?|white)\])(?:\/\S+)?$/i;
const AMOSTRAS_FUNDO = [...SHADES.map((s) => `bg-brand-${s}`), "bg-[var(--brand)]", "bg-[--brand]"];
const AMOSTRAS_SOLIDO = [...SOLIDOS_DA_MARCA.map((s) => `bg-${s}`), "bg-[var(--brand-solid)]", "bg-[var(--success-solid)]", "bg-[--brand-solid]"];
const AMOSTRAS_BRANCO = ["text-white", "text-[#fff]", "text-[white]"];
const JUNTORES = new Set(["cn", "clsx", "classNames", "cx", "twMerge", "twJoin"]);
const REPASSAM_CLASSE = new Set(["Link"]);
const ATRIBUTOS_DE_CLASSE = new Set(["className", "class"]);
const MESMO_TEXTO = new Set(["trim", "trimStart", "trimEnd", "toString", "valueOf"]);
const COMPARACOES: ts.SyntaxKind[] = [
  ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.LessThanToken, ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.LessThanEqualsToken, ts.SyntaxKind.GreaterThanEqualsToken,
  ts.SyntaxKind.InstanceOfKeyword, ts.SyntaxKind.InKeyword,
];
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function utilitario(classe: string): string {
  let prof = 0;
  let inicio = 0;
  for (let i = 0; i < classe.length; i++) {
    const c = classe[i];
    if (c === "[") prof++;
    else if (c === "]") prof = Math.max(0, prof - 1);
    else if (c === ":" && prof === 0) inicio = i + 1;
  }
  return classe.slice(inicio).replace(/^!|!$/g, "");
}

type Papel = "fundo" | "solido" | "branco" | "desconhecido";

function papeisDa(classe: string): Papel[] {
  const u = utilitario(classe);
  const papeis: Papel[] = classe.includes(MARCA) ? ["desconhecido"] : [];
  if (!u.includes(MARCA)) {
    if (FUNDO.test(u)) papeis.push("fundo");
    if (SOLIDO.test(u)) papeis.push("solido");
    if (BRANCO.test(u)) papeis.push("branco");
    return papeis;
  }
  if (!u.split(MARCA).join("")) return papeis;
  const re = new RegExp(`^${u.split(MARCA).map(escapar).join("[\\s\\S]*")}$`);
  if (AMOSTRAS_FUNDO.some((a) => re.test(a))) papeis.push("fundo");
  if (AMOSTRAS_SOLIDO.some((a) => re.test(a))) papeis.push("solido");
  if (AMOSTRAS_BRANCO.some((a) => re.test(a))) papeis.push("branco");
  return papeis;
}

const classesDe = (alternativa: string) => alternativa.split(/\s+/).filter(Boolean);
function motivoDa(alternativa: string): string | null {
  const p = new Set(classesDe(alternativa).flatMap(papeisDa));
  if ((p.has("fundo") || p.has("solido")) && p.has("branco")) return M_BRANCO;
  if (p.has("fundo") && p.has("desconhecido")) return M_DESCONHECIDO;
  return null;
}
const temFundo = (alternativa: string) => classesDe(alternativa).some((c) => papeisDa(c).includes("fundo"));
const legivel = (alternativa: string) => alternativa.split(MARCA).join("\u2026").replace(/\s+/g, " ").trim();

function limitar(xs: string[]): string[] {
  const unicos = [...new Set(xs)];
  return unicos.length > LIMITE ? [unicos.join(" ")] : unicos;
}
function produto(a: string[], b: string[]): string[] {
  if (a.length * b.length > LIMITE) return [`${a.join(" ")}${b.join(" ")}`];
  return limitar(a.flatMap((x) => b.map((y) => x + y)));
}
function juntar(partes: string[][], separador: string[]): string[] {
  let acc = [""];
  partes.forEach((p, i) => {
    acc = produto(i > 0 ? produto(acc, separador) : acc, p);
  });
  return acc;
}
function adicionar<T>(mapa: Map<string, T[]>, nome: string, valor: T): void {
  const lista = mapa.get(nome);
  if (lista) lista.push(valor);
  else mapa.set(nome, [valor]);
}
function semEmbrulho(e: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) || ts.isSatisfiesExpression(e) || ts.isTypeAssertionExpression(e)) e = e.expression;
  return e;
}
function nomeDaPropriedade(nome: ts.PropertyName): string | null {
  if (ts.isIdentifier(nome) || ts.isStringLiteral(nome) || ts.isNumericLiteral(nome) || ts.isNoSubstitutionTemplateLiteral(nome) || ts.isPrivateIdentifier(nome)) return nome.text;
  if (ts.isComputedPropertyName(nome)) {
    const e = semEmbrulho(nome.expression);
    return ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) ? e.text : null;
  }
  return null;
}
const ehModuloDoBotao = (especificador: string) => especificador === "@/components/Botao" || /(?:^|\/)Botao(?:\.tsx?)?$/.test(especificador);

const VARIANTES = Object.keys(VARIANTES_BOTAO) as VarianteBotao[];
const TAMANHOS = Object.keys(TAMANHOS_BOTAO) as TamanhoBotao[];
function possiveis<T extends string>(e: ts.Expression | undefined, todos: readonly T[], padrao: T): T[] {
  if (!e) return [padrao];
  const x = semEmbrulho(e);
  if (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)) return (todos as readonly string[]).includes(x.text) ? [x.text as T] : [...todos];
  if (ts.isIdentifier(x) && x.text === "undefined") return [padrao];
  if (ts.isConditionalExpression(x)) return [...new Set([...possiveis(x.whenTrue, todos, padrao), ...possiveis(x.whenFalse, todos, padrao)])];
  return [...todos];
}
const classesDoBotao = (variantes: readonly VarianteBotao[], tamanhos: readonly TamanhoBotao[]) =>
  variantes.flatMap((v) => tamanhos.map((t) => `${BASE_BOTAO} ${VARIANTES_BOTAO[v]} ${TAMANHOS_BOTAO[t]}`));
function classesDaChamadaDoBotao(arg: ts.Expression | undefined): string[] {
  if (!arg) return classesDoBotao(["primario"], ["md"]);
  const x = semEmbrulho(arg);
  if (!ts.isObjectLiteralExpression(x) || !x.properties.every(ts.isPropertyAssignment)) return classesDoBotao(VARIANTES, TAMANHOS);
  const valor = (nome: string) => x.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && nomeDaPropriedade(p.name) === nome)?.initializer;
  return classesDoBotao(possiveis(valor("variante"), VARIANTES, "primario"), possiveis(valor("tamanho"), TAMANHOS, "md"));
}

type FuncaoLocal = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | ts.MethodDeclaration;
export type Ofensa = { local: string; motivo: string; trecho: string };

const tipoDeScript = (arquivo: string) => (/\.[cm]?ts$/.test(arquivo) ? ts.ScriptKind.TS : /\.tsx$/.test(arquivo) ? ts.ScriptKind.TSX : ts.ScriptKind.JSX);

export function contrasteNoFonte(fonte: string, arquivo = "x.tsx"): { ofensas: Ofensa[]; fundos: string[] } {
  const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, tipoDeScript(arquivo));
  const K = ts.SyntaxKind;
  const linha = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  const valores = new Map<string, (ts.Expression | null)[]>();
  const compostos = new Map<string, ts.Expression[]>();
  const funcoes = new Map<string, FuncaoLocal[]>();
  const nomesBotao = new Set<string>();
  const nomesBotaoClasses = new Set<string>();
  const espacosBotao = new Set<string>();
  const coletar = (n: ts.Node) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      const doBotao = ehModuloDoBotao(n.moduleSpecifier.text);
      const c = n.importClause;
      if (c?.name) adicionar(valores, c.name.text, null);
      const nb = c?.namedBindings;
      if (nb && ts.isNamespaceImport(nb)) {
        adicionar(valores, nb.name.text, null);
        if (doBotao) espacosBotao.add(nb.name.text);
      }
      if (nb && ts.isNamedImports(nb)) {
        for (const s of nb.elements) {
          adicionar(valores, s.name.text, null);
          const original = (s.propertyName ?? s.name).text;
          if (doBotao && original === "Botao") nomesBotao.add(s.name.text);
          if (doBotao && original === "botaoClasses") nomesBotaoClasses.add(s.name.text);
        }
      }
    } else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) {
      const ini = n.initializer ? semEmbrulho(n.initializer) : undefined;
      if (ini && (ts.isArrowFunction(ini) || ts.isFunctionExpression(ini))) adicionar(funcoes, n.name.text, ini);
      else adicionar(valores, n.name.text, n.initializer ?? null);
    } else if ((ts.isBindingElement(n) || ts.isParameter(n)) && ts.isIdentifier(n.name)) {
      adicionar(valores, n.name.text, null);
      if (n.initializer) adicionar(valores, n.name.text, n.initializer);
    } else if (ts.isFunctionDeclaration(n) && n.name) {
      adicionar(funcoes, n.name.text, n);
    } else if (ts.isBinaryExpression(n) && ts.isIdentifier(n.left)) {
      const op = n.operatorToken.kind;
      if (op === K.PlusEqualsToken) adicionar(compostos, n.left.text, n.right);
      else if (op === K.EqualsToken || op === K.BarBarEqualsToken || op === K.QuestionQuestionEqualsToken || op === K.AmpersandAmpersandEqualsToken) adicionar(valores, n.left.text, n.right);
    }
    ts.forEachChild(n, coletar);
  };
  coletar(sf);

  const alcancados = new Set<ts.Node>();
  const memo = new Map<ts.Node, string[]>();
  const emCurso = new Set<ts.Node>();

  const valorDoNome = (nome: string): string[] => {
    if (nome === "undefined") return [""];
    const vs = valores.get(nome);
    const fs = funcoes.get(nome);
    if (!vs && !fs) return [MARCA];
    let r: string[] = [];
    for (const v of vs ?? []) r.push(...(v ? alts(v) : [MARCA]));
    if (fs) r.push(MARCA);
    for (const rhs of compostos.get(nome) ?? []) r = limitar([...r, ...produto(r, alts(rhs))]);
    return limitar(r);
  };
  const objetosDe = (e: ts.Expression, prof = 0): ts.ObjectLiteralExpression[] | null => {
    const x = semEmbrulho(e);
    if (ts.isObjectLiteralExpression(x)) return [x];
    if (!ts.isIdentifier(x) || prof > 20) return null;
    const vs = valores.get(x.text);
    if (!vs?.length) return null;
    const r: ts.ObjectLiteralExpression[] = [];
    for (const v of vs) {
      const o = v ? objetosDe(v, prof + 1) : null;
      if (!o) return null;
      r.push(...o);
    }
    return r;
  };
  const listaDe = (e: ts.Expression, prof = 0): string[][] | null => {
    const x = semEmbrulho(e);
    if (ts.isArrayLiteralExpression(x)) return x.elements.map((el) => (ts.isSpreadElement(el) ? [MARCA] : alts(el)));
    if (prof > 20) return null;
    if (ts.isCallExpression(x) && ts.isPropertyAccessExpression(x.expression) && x.expression.name.text === "filter") {
      const base = listaDe(x.expression.expression, prof + 1);
      return base ? base.map((el) => [...el, ""]) : null;
    }
    if (ts.isIdentifier(x)) {
      const vs = valores.get(x.text);
      if (vs?.length === 1 && vs[0]) return listaDe(vs[0], prof + 1);
    }
    return null;
  };
  const valoresDoObjeto = (o: ts.ObjectLiteralExpression): string[] =>
    limitar(
      o.properties.flatMap((p) => {
        if (ts.isPropertyAssignment(p)) {
          const v = semEmbrulho(p.initializer);
          return ts.isObjectLiteralExpression(v) ? valoresDoObjeto(v) : alts(p.initializer);
        }
        if (ts.isShorthandPropertyAssignment(p)) return valorDoNome(p.name.text);
        return [MARCA];
      }),
    );
  const retornosDe = (fn: FuncaoLocal): string[] => {
    if (!fn.body) return [MARCA];
    if (!ts.isBlock(fn.body)) return alts(fn.body);
    const rs: string[] = [];
    const andar = (n: ts.Node) => {
      if (ts.isFunctionLike(n)) return;
      if (ts.isReturnStatement(n)) rs.push(...(n.expression ? alts(n.expression) : [""]));
      ts.forEachChild(n, andar);
    };
    ts.forEachChild(fn.body, andar);
    return rs.length ? limitar(rs) : [""];
  };
  const metodosLocais = (alvo: ts.PropertyAccessExpression): FuncaoLocal[] =>
    (objetosDe(alvo.expression) ?? []).flatMap((o) =>
      o.properties.flatMap((p): FuncaoLocal[] => {
        if (ts.isSpreadAssignment(p) || nomeDaPropriedade(p.name) !== alvo.name.text) return [];
        if (ts.isMethodDeclaration(p)) return [p];
        if (ts.isPropertyAssignment(p)) {
          const f = semEmbrulho(p.initializer);
          return ts.isArrowFunction(f) || ts.isFunctionExpression(f) ? [f] : [];
        }
        if (ts.isShorthandPropertyAssignment(p)) return funcoes.get(p.name.text) ?? [];
        return [];
      }),
    );
  const chaveDeClasse = (p: ts.ObjectLiteralElementLike): string[] => {
    if (ts.isSpreadAssignment(p)) return [MARCA];
    if (ts.isShorthandPropertyAssignment(p)) return [p.name.text];
    if (ts.isStringLiteral(p.name) || ts.isNoSubstitutionTemplateLiteral(p.name)) {
      alcancados.add(p.name);
      return [p.name.text];
    }
    if (ts.isComputedPropertyName(p.name)) return alts(p.name.expression);
    const nome = nomeDaPropriedade(p.name);
    return nome === null ? [MARCA] : [nome];
  };
  const argumentoDeJuntor = (a: ts.Expression): string[] => {
    const e = semEmbrulho(a);
    if (ts.isObjectLiteralExpression(e)) return juntar(e.properties.map((p) => [...chaveDeClasse(p), ""]), [" "]);
    if (ts.isArrayLiteralExpression(e)) return juntar(e.elements.map((x) => (ts.isSpreadElement(x) ? [MARCA] : argumentoDeJuntor(x))), [" "]);
    return alts(e);
  };
  const ehBotaoClassesExterno = (alvo: ts.Expression) =>
    (ts.isIdentifier(alvo) && nomesBotaoClasses.has(alvo.text)) ||
    (ts.isPropertyAccessExpression(alvo) && ts.isIdentifier(alvo.expression) && espacosBotao.has(alvo.expression.text) && alvo.name.text === "botaoClasses");
  const ehBotaoJsx = (tag: string) => nomesBotao.has(tag) || [...espacosBotao].some((ns) => tag === `${ns}.Botao`);

  const daChamada = (n: ts.CallExpression): string[] => {
    const alvo = semEmbrulho(n.expression);
    if (ehBotaoClassesExterno(alvo)) return classesDaChamadaDoBotao(n.arguments[0]);
    if (ts.isIdentifier(alvo) && JUNTORES.has(alvo.text)) return juntar(n.arguments.map(argumentoDeJuntor), [" "]);
    if (ts.isPropertyAccessExpression(alvo)) {
      const metodo = alvo.name.text;
      if (metodo === "join") {
        const lista = listaDe(alvo.expression);
        if (lista) return juntar(lista, n.arguments[0] ? alts(n.arguments[0]) : [","]);
      }
      if (MESMO_TEXTO.has(metodo) && n.arguments.length === 0) return alts(alvo.expression);
      if (metodo === "concat") return n.arguments.reduce<string[]>((acc, a) => produto(acc, alts(a)), alts(alvo.expression));
      const fs = metodosLocais(alvo);
      return fs.length ? limitar(fs.flatMap(retornosDe)) : [MARCA];
    }
    if (ts.isIdentifier(alvo)) {
      const fs = funcoes.get(alvo.text);
      if (fs) return limitar(fs.flatMap(retornosDe));
    }
    return [MARCA];
  };
  const daPropriedade = (n: ts.PropertyAccessExpression): string[] => {
    const os = objetosDe(n.expression);
    if (!os) return [MARCA];
    const r: string[] = [];
    for (const o of os) {
      const p = o.properties.find((q) => !ts.isSpreadAssignment(q) && nomeDaPropriedade(q.name) === n.name.text);
      if (p && ts.isPropertyAssignment(p)) {
        const v = semEmbrulho(p.initializer);
        r.push(...(ts.isObjectLiteralExpression(v) ? [MARCA] : alts(p.initializer)));
      } else if (p && ts.isShorthandPropertyAssignment(p)) r.push(...valorDoNome(p.name.text));
      else r.push(...valoresDoObjeto(o));
    }
    return limitar(r);
  };
  const doIndice = (n: ts.ElementAccessExpression): string[] => {
    const os = objetosDe(n.expression);
    if (os) return limitar(os.flatMap(valoresDoObjeto));
    const lista = listaDe(n.expression);
    return lista ? limitar(lista.flat()) : [MARCA];
  };

  const calcular = (n: ts.Node): string[] => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      alcancados.add(n);
      return [n.text];
    }
    if (ts.isTemplateExpression(n)) {
      alcancados.add(n.head);
      let acc = [n.head.text];
      for (const s of n.templateSpans) {
        alcancados.add(s.literal);
        acc = produto(produto(acc, alts(s.expression)), [s.literal.text]);
      }
      return acc;
    }
    if (ts.isJsxExpression(n)) return n.expression ? alts(n.expression) : [""];
    if (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isNonNullExpression(n) || ts.isSatisfiesExpression(n) || ts.isTypeAssertionExpression(n)) return alts(n.expression);
    if (ts.isConditionalExpression(n)) return [...alts(n.whenTrue), ...alts(n.whenFalse)];
    if (ts.isBinaryExpression(n)) {
      const op = n.operatorToken.kind;
      if (op === K.PlusToken) return produto(alts(n.left), alts(n.right));
      if (op === K.AmpersandAmpersandToken) return [...alts(n.right), ""];
      if (op === K.BarBarToken || op === K.QuestionQuestionToken) return [...alts(n.left), ...alts(n.right)];
      if (op === K.CommaToken) return alts(n.right);
      if (COMPARACOES.includes(op)) return [""];
      return [MARCA];
    }
    if (n.kind === K.TrueKeyword || n.kind === K.FalseKeyword || n.kind === K.NullKeyword) return [""];
    if (ts.isNumericLiteral(n)) return [n.text];
    if (ts.isIdentifier(n)) return valorDoNome(n.text);
    if (ts.isCallExpression(n)) return daChamada(n);
    if (ts.isPropertyAccessExpression(n)) return daPropriedade(n);
    if (ts.isElementAccessExpression(n)) return doIndice(n);
    return [MARCA];
  };
  function alts(n: ts.Node): string[] {
    const pronto = memo.get(n);
    if (pronto) return pronto;
    if (emCurso.has(n)) return [MARCA];
    emCurso.add(n);
    const r = limitar(calcular(n));
    emCurso.delete(n);
    memo.set(n, r);
    return r;
  }

  const ofensas: Ofensa[] = [];
  const fundos = new Set<string>();
  const vistas = new Set<string>();
  const acusar = (local: string, motivo: string, trecho: string) => {
    const chave = `${local}|${motivo}|${trecho}`;
    if (vistas.has(chave)) return;
    vistas.add(chave);
    ofensas.push({ local, motivo, trecho });
  };
  const registrar = (local: string, alternativas: string[]) => {
    for (const a of alternativas) {
      const motivo = motivoDa(a);
      if (motivo) acusar(local, motivo, legivel(a));
      else if (temFundo(a)) fundos.add(legivel(a));
    }
  };
  const visitar = (n: ts.Node) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const tag = n.tagName.getText(sf);
      const local = `<${tag}> linha ${linha(n)}`;
      for (const p of n.attributes.properties) {
        if (!ts.isJsxAttribute(p) || !p.initializer || !ATRIBUTOS_DE_CLASSE.has(p.name.getText(sf))) continue;
        const classes = alts(p.initializer);
        if (ehBotaoJsx(tag)) {
          const atributos = n.attributes.properties;
          const espalha = atributos.some(ts.isJsxSpreadAttribute);
          const valor = <T extends string>(nome: string, todos: readonly T[], padrao: T): T[] => {
            if (espalha) return [...todos];
            const a = atributos.find((q): q is ts.JsxAttribute => ts.isJsxAttribute(q) && q.name.getText(sf) === nome);
            if (!a) return [padrao];
            if (a.initializer && ts.isStringLiteral(a.initializer)) return possiveis(a.initializer, todos, padrao);
            if (a.initializer && ts.isJsxExpression(a.initializer) && a.initializer.expression) return possiveis(a.initializer.expression, todos, padrao);
            return [...todos];
          };
          registrar(local, produto(classesDoBotao(valor("variante", VARIANTES, "primario"), valor("tamanho", TAMANHOS, "md")), produto([" "], classes)));
          continue;
        }
        registrar(local, classes);
        if (/^[A-Z]|\./.test(tag) && !REPASSAM_CLASSE.has(tag)) for (const a of classes) if (temFundo(a)) acusar(local, M_COMPONENTE, legivel(a));
      }
    } else if (ts.isPropertyAssignment(n)) {
      const nome = nomeDaPropriedade(n.name);
      if (nome !== null && ATRIBUTOS_DE_CLASSE.has(nome)) registrar(`${nome}: linha ${linha(n)}`, alts(n.initializer));
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);

  const operandoColado = (n: ts.Node) => {
    let p = n.parent;
    while (p && ts.isParenthesizedExpression(p)) p = p.parent;
    if (!p) return false;
    if (ts.isBinaryExpression(p)) return p.operatorToken.kind === K.PlusToken || p.operatorToken.kind === K.PlusEqualsToken;
    if (ts.isPropertyAccessExpression(p)) return true;
    return ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) && p.expression.name.text === "concat";
  };
  const relevante = (n: ts.LiteralLikeNode) => {
    const colado = operandoColado(n);
    const coladoInicio = ts.isTemplateMiddle(n) || ts.isTemplateTail(n) || colado;
    const coladoFim = ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || colado;
    const partes = n.text.split(/\s+/);
    return partes.some((t, i) => {
      if (!t) return false;
      if (/--brand(?![\w-])/.test(t)) return true;
      const u = utilitario(t);
      if (FUNDO.test(u)) return true;
      if (SOLIDO.test(u) && partes.some((x) => BRANCO.test(utilitario(x)))) return true;
      const ponta = (i === 0 && coladoInicio) || (i === partes.length - 1 && coladoFim) || /[-[(:]$/.test(t);
      return ponta && /bg-|brand/.test(t) && AMOSTRAS_FUNDO.some((a) => a.includes(u));
    });
  };
  const conferir = (n: ts.Node) => {
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) && !alcancados.has(n) && relevante(n)) {
      acusar(`literal linha ${linha(n)}`, M_FORA, n.text.replace(/\s+/g, " ").trim());
    }
    ts.forEachChild(n, conferir);
  };
  conferir(sf);

  return { ofensas, fundos: [...fundos] };
}

export function contrasteNoCss(css: string): string[] {
  const texto = semComentarios(css);
  const achados: string[] = [];
  for (const m of texto.matchAll(/@apply\s+([^;{}]+)/g)) {
    if (temFundo(m[1]) || motivoDa(m[1])) achados.push(`@apply ${m[1].trim()}: ${motivoDa(m[1]) ?? "fundo da marca"}`);
  }
  for (const m of texto.matchAll(/(?:^|[;{\s])(background(?:-color)?|--[\w-]+)\s*:\s*([^;{}]*var\(\s*--brand\s*\)[^;{}]*)/g)) {
    achados.push(`${m[1]}: ${m[2].trim()}`);
  }
  return achados;
}

export function aplicarExcecoes<O extends { arquivo: string; trecho: string }>(achadas: O[], excecoes: readonly { arquivo: string; trecho: string }[]) {
  const casa = (e: { arquivo: string; trecho: string }, o: O) => e.arquivo === o.arquivo && e.trecho === o.trecho;
  return {
    restantes: achadas.filter((o) => !excecoes.some((e) => casa(e, o))),
    problemas: excecoes.filter((e) => achadas.filter((o) => casa(e, o)).length !== 1).map((e) => `${e.arquivo}: exceção sem ofensa única: ${e.trecho}`),
  };
}

describe("contraste: bg-brand-500|600 nunca com text-white (docs/43 §6 item 5)", () => {
  it("Botao primário usa text-on-brand", () => {
    expect(VARIANTES_BOTAO.primario).toContain("text-on-brand");
    expect(VARIANTES_BOTAO.primario).not.toContain("text-white");
  });

  it("varredura do src: nenhuma ofensa; os fundos da marca sem texto são só os da lista fechada", () => {
    const EXTENSOES = /\.(?:tsx?|jsx?|mjs|cjs|mts|cts)$/;
    const TESTE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
    const DADOS_DA_TRAVA = new Set(["src/app/contraste-mapa.ts"]);
    const arquivos = (readdirSync("src", { recursive: true }) as string[]).map((f) => join("src", f).split("\\").join("/"));
    const fontes = arquivos.filter((f) => EXTENSOES.test(f) && !TESTE.test(f) && !DADOS_DA_TRAVA.has(f));
    expect(fontes.length).toBeGreaterThan(1000);
    for (const f of ["src/components/SubTabs.tsx", "src/app/(app)/financeiro/BarraAbasFinanceiro.tsx", "src/app/(app)/home/HomeGerente.tsx"]) expect(fontes).toContain(f);

    const resultados = fontes.map((arquivo) => ({ arquivo, ...contrasteNoFonte(readFileSync(arquivo, "utf-8"), arquivo) }));
    const achadas = resultados.flatMap(({ arquivo, ofensas }) => ofensas.map((o) => ({ arquivo, ...o })));
    const { restantes, problemas } = aplicarExcecoes(achadas, EXCECOES_CONTRASTE);
    expect(restantes.map((o) => `${o.arquivo} ${o.local}: ${o.motivo}: "${o.trecho}"`)).toEqual([]);
    expect(problemas).toEqual([]);
    expect(resultados.flatMap(({ arquivo, fundos }) => fundos.map((trecho) => ({ arquivo, trecho })))).toEqual(FUNDOS_DA_MARCA_SEM_TEXTO.map(({ arquivo, trecho }) => ({ arquivo, trecho })));

    const folhas = arquivos.filter((f) => f.endsWith(".css"));
    expect(folhas).toContain("src/app/globals.css");
    expect(folhas.flatMap((f) => contrasteNoCss(readFileSync(f, "utf-8")).map((a) => `${f}: ${a}`))).toEqual([]);
  }, 120_000);
});
