import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import config from "../../tailwind.config";
import { BASE_BOTAO, TAMANHOS_BOTAO, VARIANTES_BOTAO, type TamanhoBotao, type VarianteBotao } from "@/components/Botao";
import { contraste, corSobre, hexParaRgb } from "../../scripts/medicao-ux/nucleo.mjs";
import { EXCECOES_CONTRASTE, FUNDOS_DA_MARCA_SEM_TEXTO, FUNDOS_SOLIDOS, SHADES_FUNDO_DA_MARCA, SUPERFICIES } from "./contraste-mapa";

// Trava de contraste (docs/43-medicao-auditoria-ux.md §6 item 5; docs/42 §7.4 "pares de token reprovando AA").
//
// 1. Tokens. Os contrastes viram teste: os valores reais de :root (claro) e .dark (escuro, herdando o claro)
//    do globals.css entram na razão WCAG 2.x (a mesma função do scripts/medicao-ux/nucleo.mjs) e:
//    - texto branco (o `white` do tailwind.config.ts) sobre cada fundo sólido — inclusive --brand-solid —
//      tem ≥ 4,5:1 (1.4.3);
//    - --border-control (gray-300) sobre cada superfície (página, cartão, sutil, neutro) tem ≥ 3:1 (1.4.11).
//    A cor com alfa é composta sobre o fundo; vale o menor valor entre a composição exata e a de 8 bits
//    (o que o navegador pinta). Falha fechada: token declarado fora dos blocos `:root`/`.dark` de topo (num
//    @media, num `:root, .dark`, num `html.dark`), valor que a conta não lê (hsl, nome, var(), color-mix,
//    !important) ou token ausente é erro, não aprovação.
//
// 2. bg-brand-500|600 nunca com text-white no mesmo elemento. --brand clareia no escuro (#6b6ef5) e o branco
//    sobre ele dá 4,06:1. Pela árvore sintática do TypeScript, cada className/class de JSX (e cada
//    propriedade `className` de objeto, como em createElement) vira o conjunto de classes possíveis em cada
//    estado: literal, template, `+`, ternário, `&&`/`||`/`??`, cn/clsx/classNames/cx/twMerge/twJoin (com
//    objeto e lista), `[…].filter(…).join(…)`, constante e reatribuição do arquivo (inclusive `+=`), função e
//    método locais (pelo que devolvem), objeto local por propriedade ou índice, botaoClasses e <Botao>
//    (pelas variantes de src/components/Botao.tsx, também importados com outro nome ou por namespace). A
//    classe vale com qualquer variante (`hover:`, `dark:`, `file:`, `[&>a]:`, `data-[x]:`, `!`), com
//    opacidade (`/90`) e em valor arbitrário (`bg-[var(--brand)]`, `text-[#fff]`, `text-[white]`).
//    Acusa, falhando fechado:
//    - fundo da marca e texto branco no mesmo estado;
//    - fundo da marca junto de classe que não se sabe daqui (prop, import, chamada externa, pedaço montado
//      em tempo de execução — `bg-brand-${x}` conta como fundo possível);
//    - fundo da marca passado a componente (ele pode acrescentar text-white por dentro), salvo `Link`, que
//      repassa a classe ao <a> sem acrescentar nada;
//    - fundo da marca (ou pedaço que o monta, ou `var(--brand)`) em literal que nenhum className analisado
//      alcança: prop com outro nome, `style`, objeto exportado, argumento de função externa;
//    - no CSS, `@apply` com fundo da marca e `background`/token apontando para var(--brand).
//    Os fundos da marca que sobram (sem texto) formam uma lista fechada no mapa: um uso novo entra lá com
//    motivo ou usa bg-brand-solid. Exceções: arquivo + trecho exato + motivo, cada uma casando com
//    exatamente uma ofensa.
//    Fora do alcance (declarado): texto branco HERDADO do pai (`<div text-white><span bg-brand-600>`) e
//    classe montada letra a letra fora de className.
//
// As listas fechadas do mapa (src/app/contraste-mapa.ts) são comparadas a uma cópia literal aqui e ao que
// o tailwind.config.ts e o globals.css dizem; a verificação percorre a CÓPIA.

/** Cópias literais das listas fechadas de src/app/contraste-mapa.ts. */
const COPIA_SHADES = ["500", "600"];
const COPIA_SUPERFICIES = ["--bg-page", "--neutral-muted", "--surface", "--surface-muted"];
const COPIA_SOLIDOS = ["--ai-solid", "--brand-solid", "--danger-solid", "--success-solid"];
const COPIA_FUNDOS_SEM_TEXTO = [{ arquivo: "src/app/(app)/home/HomeVendedor.tsx", trecho: "h-full bg-brand-600" }];
const COPIA_EXCECOES: { arquivo: string; trecho: string }[] = [];

// ---------------------------------------------------------------------------------------------------
// 1. Tokens
// ---------------------------------------------------------------------------------------------------

type Tema = "claro" | "escuro";
type Rgb = number[];

const semComentarios = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Tokens de `:root` (claro) e `.dark` (escuro, herdando o claro), lidos bloco a bloco. Falha fechada: uma
 * declaração `--x:` em qualquer outro contexto (aninhada num @media, seletor composto, `html.dark`) é erro.
 */
export function temasDoCss(css: string): Record<Tema, Record<string, string>> {
  const texto = semComentarios(css);
  const claro: Record<string, string> = {};
  const escuro: Record<string, string> = {};
  const fora: string[] = [];
  const pilha: string[] = [];
  let inicio = 0;
  const declaracao = (fim: number) => {
    const m = texto.slice(inicio, fim).trim().match(/^(--[\w-]+)\s*:\s*([\s\S]*\S)$/);
    if (!m) return;
    const contexto = pilha.join(" > ");
    if (contexto === ":root") claro[m[1]] = m[2];
    else if (contexto === ".dark") escuro[m[1]] = m[2];
    else fora.push(`${m[1]} em "${contexto || "(fora de bloco)"}"`);
  };
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === "{") {
      pilha.push(texto.slice(inicio, i).trim().replace(/\s+/g, " "));
      inicio = i + 1;
    } else if (c === "}") {
      declaracao(i);
      pilha.pop();
      inicio = i + 1;
    } else if (c === ";") {
      declaracao(i);
      inicio = i + 1;
    }
  }
  if (fora.length) throw new Error(`token declarado fora de :root/.dark: ${fora.join("; ")}`);
  return { claro, escuro: { ...claro, ...escuro } };
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+|1\.0*)\s*)?\)$/;

/** Razão WCAG de uma cor (hex ou rgb/rgba, composta sobre o fundo) sobre um fundo opaco em hex. */
export function razao(frente: string, fundo: string): number {
  if (!HEX.test(fundo)) throw new Error(`fundo não é cor opaca em hex: ${fundo}`);
  const f: Rgb = hexParaRgb(fundo);
  if (HEX.test(frente)) return contraste(hexParaRgb(frente), f);
  if (!RGB.test(frente)) throw new Error(`valor de cor não suportado: ${frente}`);
  const composta = corSobre(frente, f);
  return Math.min(contraste(composta, f), contraste(composta.map(Math.round), f));
}

const token = (T: Record<string, string>, nome: string): string => {
  const v = T[nome];
  if (v === undefined) throw new Error(`token ausente: ${nome}`);
  return v;
};

type Par = { tema: Tema; par: string; valor: number; minimo: number };

/** Texto branco sobre cada fundo sólido (≥ 4,5) e --border-control sobre cada superfície (≥ 3), nos dois temas. */
export function paresDeContraste(css: string, superficies: readonly string[], solidos: readonly string[], branco: string): Par[] {
  const temas = temasDoCss(css);
  const pares: Par[] = [];
  for (const tema of ["claro", "escuro"] as const) {
    const T = temas[tema];
    for (const s of solidos) pares.push({ tema, par: `${branco}/${s}`, valor: razao(branco, token(T, s)), minimo: 4.5 });
    for (const s of superficies) pares.push({ tema, par: `--border-control/${s}`, valor: razao(token(T, "--border-control"), token(T, s)), minimo: 3 });
  }
  return pares;
}
const reprovados = (pares: Par[]) =>
  pares.filter((p) => !(p.valor >= p.minimo)).map((p) => `${p.tema} ${p.par} ${p.valor.toFixed(3)}:1 < ${p.minimo}:1`);

const CSS = readFileSync("src/app/globals.css", "utf-8");
const CORES = (config.theme?.extend?.colors ?? {}) as Record<string, string | Record<string, string>>;

/** Entradas do mapa de cores ("nome" ou "nome.shade") cujo valor é exatamente `valor`. */
const entradasCom = (valor: string) =>
  Object.entries(CORES)
    .flatMap(([nome, v]) => (typeof v === "string" ? (v === valor ? [nome] : []) : Object.entries(v).filter(([, x]) => x === valor).map(([shade]) => `${nome}.${shade}`)))
    .sort();
const varDe = (v: string | Record<string, string> | undefined): string => {
  const m = typeof v === "string" ? v.match(/^var\((--[\w-]+)\)$/) : null;
  if (!m) throw new Error(`cor do config sem token: ${JSON.stringify(v)}`);
  return m[1];
};

describe("contraste: tokens do globals.css nos dois temas (docs/43 §6 item 5)", () => {
  it("listas fechadas: mapa = cópia literal = o que o tailwind.config.ts e o globals.css dizem", () => {
    expect([...SHADES_FUNDO_DA_MARCA]).toEqual(COPIA_SHADES);
    expect([...SUPERFICIES]).toEqual(COPIA_SUPERFICIES);
    expect([...FUNDOS_SOLIDOS]).toEqual(COPIA_SOLIDOS);
    expect(FUNDOS_DA_MARCA_SEM_TEXTO.map(({ arquivo, trecho }) => ({ arquivo, trecho }))).toEqual(COPIA_FUNDOS_SEM_TEXTO);
    expect(EXCECOES_CONTRASTE.map(({ arquivo, trecho }) => ({ arquivo, trecho }))).toEqual(COPIA_EXCECOES);
    for (const { motivo } of [...FUNDOS_DA_MARCA_SEM_TEXTO, ...EXCECOES_CONTRASTE]) expect(motivo.trim().length).toBeGreaterThan(20);

    // Toda cor do config que aponta para --brand (em qualquer nome) é uma das shades proibidas com text-white.
    expect(entradasCom("var(--brand)")).toEqual(COPIA_SHADES.map((s) => `brand.${s}`));
    // A borda de controle é só o gray-300.
    expect(entradasCom("var(--border-control)")).toEqual(["gray.300"]);
    // Superfícies: cartão, sutil, gray-50/100 do config e o fundo do body no globals.css.
    const cinzas = CORES.gray as Record<string, string>;
    const body = semComentarios(CSS).match(/\bbody\s*\{[^}]*background-color:\s*var\((--[\w-]+)\)/)?.[1];
    expect([...new Set([varDe(CORES.surface), varDe(CORES["surface-muted"]), varDe(cinzas["50"]), varDe(cinzas["100"]), body])].sort()).toEqual(COPIA_SUPERFICIES);
    // Fundos sólidos: todo token *-solid do globals.css, cada um com uma cor no config.
    const solidos = Object.keys(temasDoCss(CSS).claro).filter((t) => t.endsWith("-solid")).sort();
    expect(solidos).toEqual(COPIA_SOLIDOS);
    for (const s of COPIA_SOLIDOS) expect(entradasCom(`var(${s})`), s).toHaveLength(1);
    expect(entradasCom("var(--brand-solid)")).toEqual(["brand-solid"]);
    // O texto branco é branco de verdade.
    expect(CORES.white).toBe("#ffffff");
  });

  it("texto branco ≥ 4,5:1 sobre cada fundo sólido e --border-control ≥ 3:1 sobre cada superfície, nos dois temas", () => {
    const pares = paresDeContraste(CSS, COPIA_SUPERFICIES, COPIA_SOLIDOS, CORES.white as string);
    expect(pares).toHaveLength(2 * (COPIA_SOLIDOS.length + COPIA_SUPERFICIES.length));
    expect(reprovados(pares)).toEqual([]);
  });

  it("autoteste da conta: os valores antigos reprovam com os números do docs/43; formas que a conta não lê são erro", () => {
    const antigo = `:root {
  --bg-page: #fafaf7;
  --surface: #ffffff;
  --surface-muted: #f4f4f0;
  --border-control: rgba(0, 0, 0, 0.42);
  --brand-solid: #4338ca;
  --brand: #4338ca;
}
.dark {
  --bg-page: #1b1b1a;
  --surface: #242422;
  --surface-muted: #2b2b29;
  --border-control: rgba(255, 255, 255, 0.34);
  --brand: #6b6ef5;
}`;
    // 2,996 e 2,991 na composição exata (docs/43); 2,979 e 2,989 na de 8 bits, que é a que vale (a menor).
    expect(reprovados(paresDeContraste(antigo, ["--surface", "--surface-muted"], ["--brand-solid", "--brand"], "#ffffff"))).toEqual([
      "claro --border-control/--surface-muted 2.979:1 < 3:1",
      "escuro #ffffff/--brand 4.059:1 < 4.5:1",
      "escuro --border-control/--surface-muted 2.989:1 < 3:1",
    ]);
    expect(contraste(corSobre("rgba(0, 0, 0, 0.42)", hexParaRgb("#f4f4f0")), hexParaRgb("#f4f4f0"))).toBeCloseTo(2.996, 3);
    // O escuro herda do claro o que não redefine (--brand-solid acima).
    expect(temasDoCss(antigo).escuro["--brand-solid"]).toBe("#4338ca");
    // Última declaração sem ponto e vírgula também é lida; comentário com declaração não conta.
    expect(temasDoCss(":root {\n  /* --x: #000000; */\n  --y: #ffffff\n}").claro).toEqual({ "--y": "#ffffff" });
    // Redefinir fora dos blocos de topo escaparia da conta: erro.
    expect(() => temasDoCss(`${antigo}\n@media (prefers-color-scheme: dark) {\n  .dark {\n    --border-control: rgba(255, 255, 255, 0.2);\n  }\n}`)).toThrow(/fora de :root\/\.dark/);
    expect(() => temasDoCss(":root, .dark {\n  --border-control: #000000;\n}")).toThrow(/fora de :root\/\.dark/);
    expect(() => temasDoCss("html.dark {\n  --brand-solid: #6b6ef5;\n}")).toThrow(/fora de :root\/\.dark/);
    // Valor que a conta não lê: erro, não aprovação.
    for (const valor of ["hsl(0 0% 0% / 0.44)", "black", "var(--x)", "color-mix(in srgb, #000 44%, transparent)", "rgba(0, 0, 0, 0.44) !important", "rgb(0 0 0 / 44%)"]) {
      expect(() => razao(valor, "#ffffff"), valor).toThrow(/não suportado/);
    }
    expect(() => razao("#000000", "rgba(0, 0, 0, 0.5)")).toThrow(/fundo não é cor opaca/);
    expect(() => token({}, "--surface")).toThrow(/token ausente/);
    // NaN não passa.
    expect(reprovados([{ tema: "claro", par: "x", valor: Number.NaN, minimo: 3 }])).toEqual(["claro x NaN:1 < 3:1"]);
  });
});

// ---------------------------------------------------------------------------------------------------
// 2. bg-brand-500|600 com text-white
// ---------------------------------------------------------------------------------------------------

/** Pedaço de classe que não se sabe daqui (prop, import, chamada externa). */
const MARCA = "\u0000";
/** Acima disso as alternativas viram uma só, com todas as classes juntas (mais estrito, nunca mais frouxo). */
const LIMITE = 512;

const M_BRANCO = "fundo da marca (clareia no escuro) com texto branco";
const M_DESCONHECIDO = "fundo da marca com classe que não se sabe daqui (pode trazer texto branco)";
const M_COMPONENTE = "fundo da marca passado a componente (ele pode pôr texto branco)";
const M_FORA = "fundo da marca fora de className analisável";

const FUNDO = new RegExp(`^bg-(?:brand-(?:${COPIA_SHADES.join("|")})|\\[(?:var\\(\\s*)?--brand\\s*\\)?\\])(?:/\\S+)?$`);
const BRANCO = /^text-(?:white|\[(?:#fff(?:fff)?|white)\])(?:\/\S+)?$/i;
const AMOSTRAS_FUNDO = [...COPIA_SHADES.map((s) => `bg-brand-${s}`), "bg-[var(--brand)]", "bg-[--brand]"];
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

/** Utilitário sem as variantes (`hover:`, `[&>a]:`, `data-[x=y]:`) e sem o `!`. */
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

type Papel = "fundo" | "branco" | "desconhecido";

/** O que uma classe pode ser. Pedaço desconhecido colado (`bg-brand-${x}`) vale por tudo que poderia formar. */
function papeisDa(classe: string): Papel[] {
  const u = utilitario(classe);
  const papeis: Papel[] = classe.includes(MARCA) ? ["desconhecido"] : [];
  if (!u.includes(MARCA)) {
    if (FUNDO.test(u)) papeis.push("fundo");
    if (BRANCO.test(u)) papeis.push("branco");
    return papeis;
  }
  if (!u.split(MARCA).join("")) return papeis;
  const re = new RegExp(`^${u.split(MARCA).map(escapar).join("[\\s\\S]*")}$`);
  if (AMOSTRAS_FUNDO.some((a) => re.test(a))) papeis.push("fundo");
  if (AMOSTRAS_BRANCO.some((a) => re.test(a))) papeis.push("branco");
  return papeis;
}

const classesDe = (alternativa: string) => alternativa.split(/\s+/).filter(Boolean);
function motivoDa(alternativa: string): string | null {
  const p = new Set(classesDe(alternativa).flatMap(papeisDa));
  if (p.has("fundo") && p.has("branco")) return M_BRANCO;
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
/** Valores possíveis de variante/tamanho: literal, ternário de literais; o resto vale por todos. */
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
/** Argumento de botaoClasses(...): objeto literal só com `chave: valor`; qualquer outra forma vale por todas. */
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

/**
 * Ofensas de um fonte e os fundos da marca que sobram sem ofensa (alternativas legíveis, para a lista
 * fechada). Ver o cabeçalho.
 */
export function contrasteNoFonte(fonte: string, arquivo = "x.tsx"): { ofensas: Ofensa[]; fundos: string[] } {
  const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, tipoDeScript(arquivo));
  const K = ts.SyntaxKind;
  const linha = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  // Nomes do arquivo: valores (null = não se sabe: parâmetro, import, desestruturação), `+=`, funções e o Botao.
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
      if (ts.isFunctionLike(n)) return; // os returns de função aninhada são dela
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
  /** Classe de cada chave de um objeto de cn/clsx (`{ "a b": cond }`): presente ou não. */
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
      else r.push(...valoresDoObjeto(o)); // não achou (ou veio de spread): vale por todas
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
      if (COMPARACOES.includes(op)) return [""]; // booleano: não vira classe
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
          // <Botao>: botaoClasses({ variante, tamanho }) + " " + className (src/components/Botao.tsx).
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

  // Literal que nenhum className alcançou e que traz fundo da marca (ou um pedaço que o monta).
  const operandoColado = (n: ts.Node) => {
    let p = n.parent;
    while (p && ts.isParenthesizedExpression(p)) p = p.parent;
    if (!p) return false;
    if (ts.isBinaryExpression(p)) return p.operatorToken.kind === K.PlusToken || p.operatorToken.kind === K.PlusEqualsToken;
    if (ts.isPropertyAccessExpression(p)) return true; // "bg-brand-".concat(x), .replace(…)
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

/** CSS: `@apply` com fundo da marca; `background`/token que aponta para var(--brand). */
export function contrasteNoCss(css: string): string[] {
  const texto = semComentarios(css);
  const achados: string[] = [];
  for (const m of texto.matchAll(/@apply\s+([^;{}]+)/g)) {
    if (temFundo(m[1])) achados.push(`@apply ${m[1].trim()}: ${motivoDa(m[1]) ?? "fundo da marca"}`);
  }
  for (const m of texto.matchAll(/(?:^|[;{\s])(background(?:-color)?|--[\w-]+)\s*:\s*([^;{}]*var\(\s*--brand\s*\)[^;{}]*)/g)) {
    achados.push(`${m[1]}: ${m[2].trim()}`);
  }
  return achados;
}

/** Exceções por arquivo + trecho exato; cada uma tem de casar com exatamente uma ofensa. */
export function aplicarExcecoes<O extends { arquivo: string; trecho: string }>(achadas: O[], excecoes: readonly { arquivo: string; trecho: string }[]) {
  const casa = (e: { arquivo: string; trecho: string }, o: O) => e.arquivo === o.arquivo && e.trecho === o.trecho;
  return {
    restantes: achadas.filter((o) => !excecoes.some((e) => casa(e, o))),
    problemas: excecoes.filter((e) => achadas.filter((o) => casa(e, o)).length !== 1).map((e) => `${e.arquivo}: exceção sem ofensa única: ${e.trecho}`),
  };
}

const motivos = (fonte: string) => contrasteNoFonte(fonte).ofensas.map((o) => o.motivo);
const IMPORTA_BOTAO = 'import { Botao, botaoClasses } from "@/components/Botao";\n';

describe("contraste: bg-brand-500|600 nunca com text-white (docs/43 §6 item 5)", () => {
  it("o detector de classe: variantes, opacidade, valor arbitrário e pedaço desconhecido", () => {
    for (const a of AMOSTRAS_FUNDO) expect(FUNDO.test(a), a).toBe(true);
    for (const a of AMOSTRAS_BRANCO) expect(BRANCO.test(a), a).toBe(true);
    for (const c of ["bg-brand-solid", "bg-brand-50", "bg-brand-700", "bg-[var(--brand-solid)]", "border-brand-600", "text-brand-600"]) expect(FUNDO.test(c), c).toBe(false);
    expect(utilitario("data-[on=1]:hover:!bg-brand-600")).toBe("bg-brand-600");
    expect(utilitario("[&>span]:bg-brand-600")).toBe("bg-brand-600");
    expect(utilitario("bg-[url(http://x)]")).toBe("bg-[url(http://x)]");
    expect(papeisDa(`bg-brand-${MARCA}`)).toEqual(["desconhecido", "fundo"]);
    expect(papeisDa(`text-${MARCA}`)).toEqual(["desconhecido", "branco"]);
    expect(papeisDa(`${MARCA}:bg-brand-600`)).toEqual(["desconhecido", "fundo"]);
    expect(papeisDa(MARCA)).toEqual(["desconhecido"]);
    expect(papeisDa(`border-${MARCA}-600`)).toEqual(["desconhecido"]);
  });

  it("acusa cada forma: atributo, template, concatenação, ternário, cn/clsx, lista, constante, função, objeto, reatribuição", () => {
    expect(contrasteNoFonte('<span className="rounded bg-brand-600 px-2 text-white">x</span>').ofensas).toEqual([
      { local: "<span> linha 1", motivo: M_BRANCO, trecho: "rounded bg-brand-600 px-2 text-white" },
    ]);
    expect(motivos("<span className={`bg-brand-500 ${tam} text-white`}>x</span>")).toEqual([M_BRANCO]);
    // A forma antiga da BarraAbasFinanceiro, da SubTabs e da FichaLead.
    expect(contrasteNoFonte('<Link className={"rounded-md px-3 " + (ativa ? "bg-brand-600 font-medium text-white" : "text-gray-600")}>x</Link>').ofensas.map((o) => o.trecho)).toEqual([
      "rounded-md px-3 bg-brand-600 font-medium text-white",
    ]);
    expect(motivos('<a className={cn("px-2", { "bg-brand-600 text-white": ativo })}>x</a>')).toEqual([M_BRANCO]);
    expect(motivos('<a className={clsx(ativo && "bg-brand-600", "text-white")}>x</a>')).toEqual([M_BRANCO]);
    expect(motivos('<a className={classNames(["bg-brand-600", ["text-white"]])}>x</a>')).toEqual([M_BRANCO]);
    expect(motivos('<a className={["bg-brand-600", ok && "text-white"].filter(Boolean).join(" ")}>x</a>')).toEqual([M_BRANCO]);
    expect(motivos('const ATIVA = "bg-brand-600 text-white";\nconst r = <a className={ATIVA}>x</a>;')).toEqual([M_BRANCO]);
    expect(motivos('function estilo(on: boolean) { if (on) { return "bg-brand-600 text-white"; } return "border"; }\nconst r = <button className={estilo(x)}>x</button>;')).toEqual([M_BRANCO]);
    expect(motivos('const estilo = (on: boolean) => (on ? "bg-brand-500 text-white" : "");\nconst r = <button className={estilo(x)}>x</button>;')).toEqual([M_BRANCO]);
    expect(motivos('const E = { on: "bg-brand-600 text-white", off: "border" };\nconst r = <a className={E[k]}>x</a>;')).toEqual([M_BRANCO]);
    expect(motivos('const E = { on: "bg-brand-600 text-white", off: "border" };\nconst r = <a className={E.on}>x</a>;')).toEqual([M_BRANCO]);
    expect(motivos('const E = { on() { return "bg-brand-600 text-white"; } };\nconst r = <a className={E.on()}>x</a>;')).toEqual([M_BRANCO]);
    expect(motivos('let c = "px-2";\nif (x) c = "bg-brand-600 text-white";\nconst r = <i className={c} />;')).toEqual([M_BRANCO]);
    expect(motivos('let c = "bg-brand-600";\nc += " text-white";\nconst r = <i className={c} />;')).toEqual([M_BRANCO]);
    expect(motivos('const r = <i className={("bg-brand-600 text-white" as string)} />;')).toEqual([M_BRANCO]);
    expect(motivos('const r = <i className={"bg-brand-600".concat(" text-white")} />;')).toEqual([M_BRANCO]);
    expect(motivos('const r = createElement("span", { className: "bg-brand-600 text-white" }, "x");')).toEqual([M_BRANCO]);
  });

  it("acusa com variante, opacidade e valor arbitrário", () => {
    for (const classes of [
      "hover:bg-brand-600 text-white",
      "dark:bg-brand-500 text-white",
      "!bg-brand-600 text-white",
      "bg-brand-600/90 text-white/80",
      "file:bg-brand-600 file:text-white",
      "[&>span]:bg-brand-600 text-white",
      "data-[on=1]:bg-brand-600 text-white",
      "bg-[var(--brand)] text-white",
      "bg-[--brand] text-[#fff]",
      "bg-brand-600 text-[white]",
    ]) {
      expect(motivos(`<i className="${classes}" />`), classes).toEqual([M_BRANCO]);
    }
  });

  it("acusa por botaoClasses e <Botao>, também com outro nome ou por namespace", () => {
    expect(motivos(`${IMPORTA_BOTAO}const r = <button className={\`\${botaoClasses()} bg-brand-600\`}>x</button>;`)).toEqual([M_BRANCO]);
    expect(motivos(`${IMPORTA_BOTAO}const r = <Botao className="bg-brand-600">x</Botao>;`)).toEqual([M_BRANCO]);
    // Variante que não se sabe: vale por todas — primário e perigo têm text-white.
    expect(motivos(`${IMPORTA_BOTAO}const r = <button className={botaoClasses({ variante: v }) + " bg-brand-600"}>x</button>;`)).toEqual([M_BRANCO, M_BRANCO]);
    expect(motivos(`${IMPORTA_BOTAO}const r = <Botao variante={v} className="bg-brand-600">x</Botao>;`)).toEqual([M_BRANCO, M_BRANCO]);
    // Spread: variante e tamanho valem por todos (primário e perigo × 3 tamanhos).
    expect(motivos(`${IMPORTA_BOTAO}const r = <Botao {...props} className="bg-brand-600">x</Botao>;`)).toEqual(new Array<string>(6).fill(M_BRANCO));
    expect(motivos('import { botaoClasses as bc } from "@/components/Botao";\nconst r = <a className={bc() + " bg-brand-600"}>x</a>;')).toEqual([M_BRANCO]);
    expect(motivos('import { Botao as B } from "@/components/Botao";\nconst r = <B className="bg-brand-600">x</B>;')).toEqual([M_BRANCO]);
    expect(motivos('import * as UI from "@/components/Botao";\nconst r = <UI.Botao className="bg-brand-600">x</UI.Botao>;')).toEqual([M_BRANCO]);
    expect(motivos('import * as UI from "@/components/Botao";\nconst r = <a className={UI.botaoClasses() + " bg-brand-600"}>x</a>;')).toEqual([M_BRANCO]);
    // Fantasma não tem texto branco: sobra como fundo (e cai na lista fechada).
    expect(contrasteNoFonte(`${IMPORTA_BOTAO}const r = <Botao variante="fantasma" className="bg-brand-600">x</Botao>;`).ofensas).toEqual([]);
  });

  it("acusa pedaço montado em tempo de execução e classe que não se sabe daqui", () => {
    expect(motivos("const r = <i className={`bg-brand-${s} text-white`} />;")).toEqual([M_BRANCO]);
    expect(motivos('const r = <i className={"bg-" + cor + " text-white"} />;')).toEqual([M_BRANCO]);
    expect(motivos("const r = <i className={`${v}:bg-brand-600`} />;")).toEqual([M_DESCONHECIDO]);
    expect(motivos('const r = <i className={"bg-brand-600 " + props.className} />;')).toEqual([M_DESCONHECIDO]);
    expect(motivos('import { EXTRA } from "./x";\nconst r = <i className={`bg-brand-600 ${EXTRA}`} />;')).toEqual([M_DESCONHECIDO]);
    expect(motivos('const r = <i className={"bg-brand-600 " + VARIANTES_BOTAO.primario} />;')).toEqual([M_DESCONHECIDO]);
    expect(motivos('const r = <i className={tw`bg-brand-600 text-white`} />;')).toEqual([M_FORA]);
  });

  it("acusa fundo passado a componente e fundo fora de className analisável", () => {
    expect(contrasteNoFonte('const r = <Chip className="bg-brand-600" />;').ofensas).toEqual([
      { local: "<Chip> linha 1", motivo: M_COMPONENTE, trecho: "bg-brand-600" },
    ]);
    expect(motivos('const r = <Link className="bg-brand-600 text-white">x</Link>;')).toEqual([M_BRANCO]);
    expect(contrasteNoFonte('const r = <Chip classeAtiva="bg-brand-600 text-white" />;').ofensas).toEqual([
      { local: "literal linha 1", motivo: M_FORA, trecho: "bg-brand-600 text-white" },
    ]);
    expect(motivos('export const ATIVA = "bg-brand-600 text-white";')).toEqual([M_FORA]);
    expect(motivos('const r = <div style={{ background: "var(--brand)", color: "#fff" }} />;')).toEqual([M_FORA]);
    expect(motivos('const x = "bg-brand-" + shade;')).toEqual([M_FORA]);
    expect(motivos('const partes = ["bg-brand-", "600"];')).toEqual([M_FORA]);
    expect(motivos('const r = <i className={junta("bg-brand-600", "text-white")} />;')).toEqual([M_FORA]);
    expect(motivos('const r = <i className={"bg-brand-600 x".replace("x", "text-white")} />;')).toEqual([M_FORA]);
  });

  it("deixa passar: bg-brand-solid, fundo sem texto, estados diferentes, outras shades e classes sem fundo", () => {
    for (const fonte of [
      '<i className="rounded bg-brand-solid px-2 text-white" />',
      '<i className={ativo ? "bg-brand-solid font-medium text-white" : "text-gray-600 hover:bg-gray-100"} />',
      '<i className={ativo ? "bg-brand-600" : "text-white"} />',
      '<i className="bg-brand-50 text-brand-700 focus:border-brand-500 focus:ring-brand-500" />',
      'export const MAPA = { a: "bg-brand-50 text-brand-700" };',
      'const t = "Mensagem com --brand-solid e bg-brand-solid";',
      '<a className={"px-2 " + estilo} />',
      `${IMPORTA_BOTAO}const r = <Botao variante="secundario" className="mt-2">Ok</Botao>;`,
      `${IMPORTA_BOTAO}const r = <button className={\`\${botaoClasses()} mt-2\`}>Ok</button>;`,
    ]) {
      expect(contrasteNoFonte(fonte).ofensas, fonte).toEqual([]);
    }
    expect(contrasteNoFonte('<div className="h-full bg-brand-600" />')).toEqual({ ofensas: [], fundos: ["h-full bg-brand-600"] });
    expect(contrasteNoFonte('<i className={ativo ? "bg-brand-600" : "text-white"} />').fundos).toEqual(["bg-brand-600"]);
  });

  it("CSS: @apply com fundo da marca e background/token em var(--brand)", () => {
    expect(contrasteNoCss(".x { @apply bg-brand-600 text-white; }")).toEqual([`@apply bg-brand-600 text-white: ${M_BRANCO}`]);
    expect(contrasteNoCss(".x { @apply h-1 bg-brand-500; }")).toEqual(["@apply h-1 bg-brand-500: fundo da marca"]);
    expect(contrasteNoCss(".x { background-color: var(--brand); color: #fff; }")).toEqual(["background-color: var(--brand)"]);
    expect(contrasteNoCss(".x { --fundo: var( --brand ); }")).toEqual(["--fundo: var( --brand )"]);
    expect(contrasteNoCss(".x { outline: 2px solid var(--brand); accent-color: var(--brand); background: var(--brand-solid); @apply bg-brand-solid text-white; }")).toEqual([]);
    expect(contrasteNoCss(".x { /* background: var(--brand); */ }")).toEqual([]);
  });

  it("exceção casa com exatamente uma ofensa, pelo trecho exato", () => {
    const achadas = [
      { arquivo: "a.tsx", trecho: "bg-brand-600 text-white" },
      { arquivo: "a.tsx", trecho: "bg-brand-600 text-white" },
      { arquivo: "b.tsx", trecho: "bg-brand-600 text-white" },
    ];
    expect(aplicarExcecoes(achadas, [{ arquivo: "b.tsx", trecho: "bg-brand-600 text-white" }])).toEqual({ restantes: achadas.slice(0, 2), problemas: [] });
    expect(aplicarExcecoes(achadas, [{ arquivo: "b.tsx", trecho: "bg-brand-600  text-white" }]).problemas).toHaveLength(1);
    expect(aplicarExcecoes(achadas, [{ arquivo: "a.tsx", trecho: "bg-brand-600 text-white" }]).problemas).toHaveLength(1);
  });

  it("varredura do src: nenhuma ofensa; os fundos da marca sem texto são só os da lista fechada", () => {
    const EXTENSOES = /\.(?:tsx?|jsx?|mjs|cjs|mts|cts)$/;
    const TESTE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
    // O mapa da trava guarda as classes como dado (é a lista fechada), não como classe de tela.
    const DADOS_DA_TRAVA = new Set(["src/app/contraste-mapa.ts"]);
    const arquivos = (readdirSync("src", { recursive: true }) as string[]).map((f) => join("src", f).split("\\").join("/"));
    const fontes = arquivos.filter((f) => EXTENSOES.test(f) && !TESTE.test(f) && !DADOS_DA_TRAVA.has(f));
    expect(fontes.length).toBeGreaterThan(1000);
    for (const f of ["src/components/SubTabs.tsx", "src/app/(app)/financeiro/BarraAbasFinanceiro.tsx", "src/app/(app)/home/HomeVendedor.tsx"]) expect(fontes).toContain(f);

    const resultados = fontes.map((arquivo) => ({ arquivo, ...contrasteNoFonte(readFileSync(arquivo, "utf-8"), arquivo) }));
    const achadas = resultados.flatMap(({ arquivo, ofensas }) => ofensas.map((o) => ({ arquivo, ...o })));
    const { restantes, problemas } = aplicarExcecoes(achadas, COPIA_EXCECOES);
    expect(restantes.map((o) => `${o.arquivo} ${o.local}: ${o.motivo}: "${o.trecho}"`)).toEqual([]);
    expect(problemas).toEqual([]);
    expect(resultados.flatMap(({ arquivo, fundos }) => fundos.map((trecho) => ({ arquivo, trecho })))).toEqual(COPIA_FUNDOS_SEM_TEXTO);

    const folhas = arquivos.filter((f) => f.endsWith(".css"));
    expect(folhas).toContain("src/app/globals.css");
    expect(folhas.flatMap((f) => contrasteNoCss(readFileSync(f, "utf-8")).map((a) => `${f}: ${a}`))).toEqual([]);
  });
});
