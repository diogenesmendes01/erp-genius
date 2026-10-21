import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Trava do fuso pessoal nas telas (pendência da Q176 em docs/planejamento/quadro-entregas.md: "fuso pessoal nas
// telas restantes"). Instante na tela sai pelo helper central `formatarInstanteExibicao` (src/server/operacao/
// fuso-exibicao.ts), com o fuso pessoal de exibição e, sem ele, o fuso de origem (o da escola nas telas
// operacionais). Data civil gravada (promessa, pagamento) sai por `formatarDiaCivilGravado`, no dia da escola; data
// civil em texto ("2026-10-05") por `formatarDataCivil`. Nenhuma tela formata data/hora no fuso do PROCESSO — o do
// servidor no SSR, o do navegador no cliente —, que é o que acontecia com `toLocaleDateString("pt-BR")`.
//
// Em todo .ts/.tsx de produção de src/app e src/components (fora src/app/api, que não é tela), pelo AST:
// - "toLocale": `x.toLocaleDateString(…)`/`x.toLocaleTimeString(…)` sem `timeZone` nas opções; `x.toLocaleString(…)`
//   sem `timeZone` e sem opção de número (style, currency, *FractionDigits…), isto é, que não é formatação de número.
// - "intl": `Intl.DateTimeFormat(…)` (com ou sem `new`) sem `timeZone` nas opções.
// - "relogio-local": getters e textos no fuso do processo — getHours/getMinutes/getSeconds/getDate/getDay/getMonth/
//   getFullYear/getTimezoneOffset/toDateString/toTimeString — e `Date()` chamado sem `new` (devolve o texto local).
// - "texto-local" (lote 2, review do #286): uma data virando texto pelo `Date.prototype.toString`, que usa o fuso do
//   processo — `String(d)`, `d.toString()`, `${d}` e `d + …`/`… + d`. Sem o type checker (caro demais para rodar
//   em toda a suíte), "d é data" é sintático: `new Date(…)` ou um nome que o próprio arquivo declara como
//   `new Date(…)` ou com tipo `Date` (também em união, como `Date | string`), usado solto (`d`) ou como acesso por
//   propriedade (`p.criadoEm`, review do #289). Data que chega tipada de outro módulo (ex.: campo do Prisma) fica
//   fora do alcance, e retorno de função (`String(agora())`) também; dentro do JSX (`{d}`) o próprio tsc recusa a Date.
//   O conjunto de nomes vale para o ARQUIVO inteiro, sem escopo: um nome declarado como data num lugar acusa em
//   qualquer outro, mesmo onde é texto (`type P = { fim: Date }; function g(fim: string) { return "até " + fim; }`).
//   É falso positivo possível (falha fechada: barulho, não omissão); quando aparecer, uma exceção resolve.
// - "apelido" (lote 2): `Intl.DateTimeFormat` fora da posição de chamada (`const F = Intl.DateTimeFormat`,
//   `.bind`, `Reflect.construct`), `Intl` usado como valor (`const I = Intl`), `X.DateTimeFormat` de outro objeto e a
//   desestruturação `{ DateTimeFormat } = …`. `globalThis.Intl`/`window.Intl`/`Intl["DateTimeFormat"]` contam como
//   `Intl.DateTimeFormat` e passam pela regra "intl" (timeZone obrigatório).
// Opções que não são objeto literal, ou objeto com spread e sem `timeZone`, não dão para conferir: contam (falha
// fechada). Arquivo que não analisa também conta.
//
// Fora do alcance (declarado): `timeZone` presente mas com o fuso errado (ex.: o da escola num instante que devia
// sair no fuso pessoal). Isso é conferido tela a tela, nos testes de renderização.
//
// Exceções: arquivo + regra + trecho exato (espaços normalizados) + motivo; cada uma casa com exatamente um achado.

const RAIZES = ["src/app", "src/components"];
const FORA_DE_TELA = /^src\/app\/api\//;

export type Regra = "toLocale" | "intl" | "relogio-local" | "texto-local" | "apelido" | "opaco";
export type Achado = { arquivo: string; linha: number; regra: Regra; trecho: string };
export type Excecao = { arquivo: string; regra: Regra; trecho: string; motivo: string };

const normaliza = (t: string) => t.replace(/\s+/g, " ").trim();
export const METODOS_DE_DATA = ["toLocaleDateString", "toLocaleTimeString"];
export const RELOGIO_LOCAL = ["getHours", "getMinutes", "getSeconds", "getDate", "getDay", "getMonth", "getFullYear", "getTimezoneOffset", "toDateString", "toTimeString"];
export const OPCOES_DE_NUMERO = ["style", "currency", "currencyDisplay", "unit", "notation", "useGrouping", "minimumIntegerDigits", "minimumFractionDigits", "maximumFractionDigits", "minimumSignificantDigits", "maximumSignificantDigits"];

function nomeDaPropriedade(p: ts.ObjectLiteralElementLike): string | null {
  if ((ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p) || ts.isMethodDeclaration(p)) && p.name) {
    if (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) return p.name.text;
  }
  return null;
}

/** "sim": objeto literal com `timeZone`; "numero": objeto literal com opção de número; "nao": sem opções ou sem as duas; "opaco": não dá para conferir. */
function opcoes(arg: ts.Expression | undefined): "sim" | "numero" | "nao" | "opaco" {
  if (!arg) return "nao";
  while (ts.isParenthesizedExpression(arg) || ts.isAsExpression(arg) || ts.isSatisfiesExpression(arg)) arg = arg.expression;
  if (!ts.isObjectLiteralExpression(arg)) return "opaco";
  const nomes = arg.properties.map(nomeDaPropriedade);
  if (nomes.includes("timeZone")) return "sim";
  if (arg.properties.some(ts.isSpreadAssignment)) return "opaco";
  return nomes.some((n) => n !== null && OPCOES_DE_NUMERO.includes(n)) ? "numero" : "nao";
}

const semEnvoltorio = (e: ts.Expression): ts.Expression => {
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e) || ts.isNonNullExpression(e)) e = e.expression;
  return e;
};

/** `Intl`, `globalThis.Intl`, `window.Intl` ou `self.Intl`. */
const ehIntl = (e: ts.Expression): boolean => {
  e = semEnvoltorio(e);
  if (ts.isIdentifier(e)) return e.text === "Intl";
  return ts.isPropertyAccessExpression(e) && e.name.text === "Intl" && ts.isIdentifier(e.expression) && ["globalThis", "window", "self"].includes(e.expression.text);
};

/** O nó é o acesso `DateTimeFormat` (por ponto ou por texto) em qualquer objeto. */
const nomeDateTimeFormat = (e: ts.Node): e is ts.PropertyAccessExpression | ts.ElementAccessExpression =>
  (ts.isPropertyAccessExpression(e) && e.name.text === "DateTimeFormat") ||
  (ts.isElementAccessExpression(e) && ts.isStringLiteralLike(e.argumentExpression) && e.argumentExpression.text === "DateTimeFormat");

const ehIntlDateTimeFormat = (e: ts.Expression) => {
  e = semEnvoltorio(e);
  return nomeDateTimeFormat(e) && ehIntl(e.expression);
};

/** O tipo anotado é `Date` ou uma união que inclui `Date`. */
const tipoTemDate = (t: ts.TypeNode | undefined): boolean =>
  !!t && ((ts.isTypeReferenceNode(t) && ts.isIdentifier(t.typeName) && t.typeName.text === "Date") || (ts.isUnionTypeNode(t) && t.types.some(tipoTemDate)) || (ts.isParenthesizedTypeNode(t) && tipoTemDate(t.type)));

const ehNewDate = (e: ts.Expression) => { e = semEnvoltorio(e); return ts.isNewExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === "Date"; };

/** Nomes que o arquivo declara como data: `x = new Date(…)` ou `x: Date` (variável, parâmetro, propriedade). */
function nomesDeData(sf: ts.SourceFile): Set<string> {
  const nomes = new Set<string>();
  const visita = (no: ts.Node) => {
    if ((ts.isVariableDeclaration(no) || ts.isParameter(no) || ts.isPropertySignature(no) || ts.isPropertyDeclaration(no)) && ts.isIdentifier(no.name)) {
      const inicial = ts.isPropertySignature(no) ? undefined : no.initializer;
      if (tipoTemDate(no.type) || (inicial && ehNewDate(inicial))) nomes.add(no.name.text);
    }
    ts.forEachChild(no, visita);
  };
  visita(sf);
  return nomes;
}

export function achadosDeFuso(arquivo: string, fonte: string): Achado[] {
  const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const achados: Achado[] = [];
  // `parseDiagnostics` é interno do TypeScript: se sumir, falha fechada (todo arquivo acusa) em vez de passar calado.
  const diagnosticos = (sf as unknown as { parseDiagnostics?: unknown }).parseDiagnostics;
  if (!Array.isArray(diagnosticos) || diagnosticos.length) return [{ arquivo, linha: 1, regra: "opaco", trecho: "arquivo não analisa" }];
  const datas = nomesDeData(sf);
  const ehData = (e: ts.Expression) => { e = semEnvoltorio(e); return ehNewDate(e) || (ts.isIdentifier(e) && datas.has(e.text)) || (ts.isPropertyAccessExpression(e) && datas.has(e.name.text)); };
  const acha = (no: ts.Node, regra: Regra) =>
    achados.push({ arquivo, linha: sf.getLineAndCharacterOfPosition(no.getStart(sf)).line + 1, regra, trecho: normaliza(no.getText(sf)) });
  const visita = (no: ts.Node) => {
    // Apelidos: DateTimeFormat fora da posição de chamada, Intl como valor, DateTimeFormat de outro objeto, desestruturação.
    if (nomeDateTimeFormat(no)) {
      let topo: ts.Node = no;
      while (ts.isParenthesizedExpression(topo.parent) || ts.isAsExpression(topo.parent) || ts.isSatisfiesExpression(topo.parent) || ts.isNonNullExpression(topo.parent)) topo = topo.parent;
      const chamado = (ts.isCallExpression(topo.parent) || ts.isNewExpression(topo.parent)) && topo.parent.expression === topo;
      if (!ehIntl(no.expression) || !chamado) acha(no, "apelido");
    } else if (ts.isIdentifier(no) && no.text === "Intl" && !ts.isQualifiedName(no.parent) && !ts.isTypeQueryNode(no.parent) && !ehIntl(no.parent as ts.Expression) && !((ts.isPropertyAccessExpression(no.parent) || ts.isElementAccessExpression(no.parent)) && no.parent.expression === no)) {
      acha(no, "apelido");
    } else if (ts.isIdentifier(no) && no.text === "Intl" && ts.isPropertyAccessExpression(no.parent) && no.parent.name === no) {
      // globalThis.Intl / window.Intl: o pai é tratado como Intl; usado como valor solto, é apelido.
      const pai = no.parent;
      if (!((ts.isPropertyAccessExpression(pai.parent) || ts.isElementAccessExpression(pai.parent)) && pai.parent.expression === pai)) acha(pai, "apelido");
    } else if (ts.isBindingElement(no) && ((no.propertyName && ts.isIdentifier(no.propertyName) && no.propertyName.text === "DateTimeFormat") || (!no.propertyName && ts.isIdentifier(no.name) && no.name.text === "DateTimeFormat"))) {
      acha(no, "apelido");
    }
    // Data virando texto no fuso do processo.
    if (ts.isCallExpression(no) && ts.isIdentifier(no.expression) && no.expression.text === "Date") acha(no, "relogio-local");
    else if (ts.isCallExpression(no) && ts.isIdentifier(no.expression) && no.expression.text === "String" && no.arguments.length && ehData(no.arguments[0])) acha(no, "texto-local");
    else if (ts.isCallExpression(no) && ts.isPropertyAccessExpression(no.expression) && no.expression.name.text === "toString" && ehData(no.expression.expression)) acha(no, "texto-local");
    else if (ts.isTemplateSpan(no) && ehData(no.expression)) acha(no.expression, "texto-local");
    else if (ts.isBinaryExpression(no) && no.operatorToken.kind === ts.SyntaxKind.PlusToken && (ehData(no.left) || ehData(no.right))) acha(no, "texto-local");
    else if (ts.isBinaryExpression(no) && no.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken && ehData(no.right)) acha(no, "texto-local");

    if ((ts.isCallExpression(no) || ts.isNewExpression(no)) && ehIntlDateTimeFormat(no.expression)) {
      if (opcoes(no.arguments?.[1]) !== "sim") acha(no, "intl");
    } else if (ts.isCallExpression(no) && ts.isPropertyAccessExpression(no.expression)) {
      const metodo = no.expression.name.text;
      if (METODOS_DE_DATA.includes(metodo) && opcoes(no.arguments[1]) !== "sim") acha(no, "toLocale");
      else if (metodo === "toLocaleString" && !["sim", "numero"].includes(opcoes(no.arguments[1]))) acha(no, "toLocale");
      else if (RELOGIO_LOCAL.includes(metodo)) acha(no, "relogio-local");
    } else if (ts.isCallExpression(no) && ts.isElementAccessExpression(no.expression) && !ts.isStringLiteralLike(no.expression.argumentExpression)) {
      // x[m]() pode ser qualquer um dos métodos acima: falha fechada só quando o nome é calculado.
      acha(no, "opaco");
    } else if (ts.isCallExpression(no) && ts.isElementAccessExpression(no.expression) && ts.isStringLiteralLike(no.expression.argumentExpression)) {
      const metodo = no.expression.argumentExpression.text;
      if ([...METODOS_DE_DATA, "toLocaleString", ...RELOGIO_LOCAL].includes(metodo)) acha(no, metodo.startsWith("toLocale") ? "toLocale" : "relogio-local");
    }
    ts.forEachChild(no, visita);
  };
  visita(sf);
  return achados;
}

/** Comum às 5 linhas de dataHoraLocal (EdicaoOportunidade). */
const MOTIVO_EXPERIMENTAL = "campo de ENTRADA <input type=\"datetime-local\"> da experimental: o valor é montado e relido (new Date(valor) no envio) no mesmo relógio do navegador, ida e volta; não é exibição. Fuso de entrada é outra pendência (ver PR)";

export const EXCECOES: Excecao[] = [
  { arquivo: "src/app/(app)/funil/EdicaoOportunidade.tsx", regra: "relogio-local", trecho: "x.getFullYear()", motivo: MOTIVO_EXPERIMENTAL },
  { arquivo: "src/app/(app)/funil/EdicaoOportunidade.tsx", regra: "relogio-local", trecho: "x.getMonth()", motivo: MOTIVO_EXPERIMENTAL },
  { arquivo: "src/app/(app)/funil/EdicaoOportunidade.tsx", regra: "relogio-local", trecho: "x.getDate()", motivo: MOTIVO_EXPERIMENTAL },
  { arquivo: "src/app/(app)/funil/EdicaoOportunidade.tsx", regra: "relogio-local", trecho: "x.getHours()", motivo: MOTIVO_EXPERIMENTAL },
  { arquivo: "src/app/(app)/funil/EdicaoOportunidade.tsx", regra: "relogio-local", trecho: "x.getMinutes()", motivo: MOTIVO_EXPERIMENTAL },
  {
    arquivo: "src/app/(app)/diario/DiarioAulas.tsx", regra: "relogio-local", trecho: "d.getTimezoneOffset()",
    motivo: "campo de ENTRADA <input type=\"datetime-local\"> da data da aula (valor inicial e `max`): converte o instante para o relógio do navegador que o próprio input usa; não é exibição. Fuso de entrada é outra pendência (ver PR)",
  },
  {
    arquivo: "src/app/(app)/matriculas/[id]/contrato/aditivos/Formularios.tsx", regra: "intl", trecho: "Intl.DateTimeFormat()",
    motivo: "não formata data: `resolvedOptions().timeZone` só descobre o fuso do navegador para DIZER, junto do campo de vigência, em que fuso o valor digitado é lido",
  },
];

export function conferirExcecoes(achados: Achado[], excecoes: Excecao[]) {
  const casa = (a: Achado, e: Excecao) => a.arquivo === e.arquivo && a.regra === e.regra && a.trecho === normaliza(e.trecho);
  return {
    semExcecao: achados.filter((a) => !excecoes.some((e) => casa(a, e))).map((a) => `${a.arquivo}:${a.linha}: [${a.regra}] ${a.trecho}`),
    soltas: excecoes.filter((e) => achados.filter((a) => casa(a, e)).length !== 1).map((e) => `${e.arquivo}: [${e.regra}] ${e.trecho}`),
  };
}

function telasDeProducao() {
  const saida: { arquivo: string; fonte: string }[] = [];
  for (const raiz of RAIZES) for (const f of (readdirSync(raiz, { recursive: true }) as string[]).sort()) {
    if (!/\.tsx?$/.test(f) || /\.test\.tsx?$/.test(f) || /\.d\.ts$/.test(f)) continue;
    const arquivo = join(raiz, f).split("\\").join("/");
    if (FORA_DE_TELA.test(arquivo)) continue;
    saida.push({ arquivo, fonte: readFileSync(arquivo, "utf8") });
  }
  return saida;
}

describe("fuso pessoal nas telas: nenhuma data/hora formatada no fuso do processo", () => {
  const telas = telasDeProducao();
  const achados = telas.flatMap(({ arquivo, fonte }) => achadosDeFuso(arquivo, fonte));

  it("a varredura acha as telas (não passa vazia por erro de caminho) e inclui src/components e .ts", () => {
    expect(telas.length).toBeGreaterThan(500);
    expect(telas.some((t) => t.arquivo === "src/components/conversa/BalaoMensagem.tsx")).toBe(true);
    expect(telas.some((t) => t.arquivo === "src/app/(app)/tarefas/visao.ts")).toBe(true);
    expect(telas.some((t) => t.arquivo.startsWith("src/app/api/"))).toBe(false);
  });

  it("todo achado está nas exceções, e toda exceção casa com exatamente um achado", () => {
    expect(conferirExcecoes(achados, EXCECOES)).toEqual({ semExcecao: [], soltas: [] });
  });

  it("cada exceção tem motivo de verdade", () => {
    for (const e of EXCECOES) expect(e.motivo.length, `${e.arquivo}: ${e.trecho}`).toBeGreaterThan(40);
  });
});

describe("autoteste da trava", () => {
  const acha = (fonte: string, arquivo = "src/app/x.tsx") => achadosDeFuso(arquivo, fonte).map((a) => `${a.regra}: ${a.trecho}`);

  it("acusa as formas que existiam nas telas", () => {
    expect(acha(`const a = <p>{new Date(x).toLocaleDateString("pt-BR")}</p>;`)).toEqual(['toLocale: new Date(x).toLocaleDateString("pt-BR")']);
    expect(acha(`const a = new Date(c.quando).toLocaleString("pt-BR");`)).toEqual(['toLocale: new Date(c.quando).toLocaleString("pt-BR")']);
    expect(acha(`const F = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });`)).toEqual(['intl: new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" })']);
    expect(acha(`const h = d.getHours();`)).toEqual(["relogio-local: d.getHours()"]);
    expect(acha(`const h = d.toTimeString();`, "src/components/x.ts")).toEqual(["relogio-local: d.toTimeString()"]);
  });

  it("acusa as evasões: sem opções, opções por variável, spread sem timeZone, nome por texto e nome calculado", () => {
    expect(acha(`d.toLocaleTimeString();`)).toEqual(["toLocale: d.toLocaleTimeString()"]);
    expect(acha(`Intl.DateTimeFormat("pt-BR", OPCOES).format(d);`)).toEqual(['intl: Intl.DateTimeFormat("pt-BR", OPCOES)']);
    expect(acha(`new Intl.DateTimeFormat("pt-BR", { ...base, hour: "2-digit" });`)).toHaveLength(1);
    expect(acha(`d["toLocaleDateString"]("pt-BR");`)).toEqual(['toLocale: d["toLocaleDateString"]("pt-BR")']);
    expect(acha(`d[metodo]("pt-BR");`)).toEqual(['opaco: d[metodo]("pt-BR")']);
    expect(acha(`const a = <p>{`)).toEqual(["opaco: arquivo não analisa"]);
  });

  it("o certo passa: timeZone explícito (também com spread), número, o helper central e getUTC*", () => {
    expect(acha(`new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: fuso }).format(d);`)).toEqual([]);
    expect(acha(`new Intl.DateTimeFormat("pt-BR", { ...base, timeZone }).format(d);`)).toEqual([]);
    expect(acha(`d.toLocaleDateString("pt-BR", { timeZone: "UTC" });`)).toEqual([]);
    expect(acha(`v.toLocaleString("pt-BR", { style: "currency", currency: "USD" }); (m / 60).toLocaleString("pt-BR", { maximumFractionDigits: 2 });`)).toEqual([]);
    expect(acha(`formatarInstanteExibicao(x, preferencia, fusoEscola, "hora").texto; d.getUTCHours(); d.getTime();`)).toEqual([]);
  });

  // Lacunas apontadas na review do #286 (lote 2).
  it("acusa apelidos de Intl.DateTimeFormat; globalThis/window/texto contam como Intl.DateTimeFormat", () => {
    expect(acha(`const F = Intl.DateTimeFormat; new F("pt-BR").format(d);`)).toEqual(["apelido: Intl.DateTimeFormat"]);
    expect(acha(`const F = (Intl.DateTimeFormat as typeof Intl.DateTimeFormat);`)).toEqual(["apelido: Intl.DateTimeFormat"]);
    expect(acha(`const f = Intl.DateTimeFormat.bind(null, "pt-BR");`)).toEqual(["apelido: Intl.DateTimeFormat"]);
    expect(acha(`Reflect.construct(Intl.DateTimeFormat, ["pt-BR"]);`)).toEqual(["apelido: Intl.DateTimeFormat"]);
    expect(acha(`const I = Intl; new I.DateTimeFormat("pt-BR", { timeZone: fuso });`)).toEqual(["apelido: Intl", "apelido: I.DateTimeFormat"]);
    expect(acha(`const I = globalThis.Intl;`)).toEqual(["apelido: globalThis.Intl"]);
    expect(acha(`const { DateTimeFormat } = Intl; const { DateTimeFormat: G } = x;`)).toEqual(["apelido: DateTimeFormat", "apelido: Intl", "apelido: DateTimeFormat: G"]);
    expect(acha(`new globalThis.Intl.DateTimeFormat("pt-BR").format(d);`)).toEqual(['intl: new globalThis.Intl.DateTimeFormat("pt-BR")']);
    expect(acha(`new window.Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });`)).toEqual(['intl: new window.Intl.DateTimeFormat("pt-BR", { dateStyle: "short" })']);
    expect(acha(`new Intl["DateTimeFormat"]("pt-BR").format(d);`)).toEqual(['intl: new Intl["DateTimeFormat"]("pt-BR")']);
  });

  it("acusa data virando texto no fuso do processo: String, toString, template, concatenação e Date()", () => {
    expect(acha(`const t = String(new Date(x));`)).toEqual(["texto-local: String(new Date(x))"]);
    expect(acha(`const t = new Date(x).toString();`)).toEqual(["texto-local: new Date(x).toString()"]);
    expect(acha("const d = new Date(x); const t = `em ${d}`;")).toEqual(["texto-local: d"]);
    expect(acha(`function f(quando: Date | string) { return "em " + quando; }`)).toEqual(['texto-local: "em " + quando']);
    expect(acha(`type P = { criadoEm: Date }; const g = ({ criadoEm }: P) => String(criadoEm);`)).toEqual(["texto-local: String(criadoEm)"]);
    // Acesso por propriedade (review do #289, item B): antes passava calado.
    expect(acha("type P = { criadoEm: Date }; const g = (p: P) => String(p.criadoEm) + `${p.criadoEm}`;")).toEqual(["texto-local: String(p.criadoEm)", "texto-local: p.criadoEm"]);
    expect(acha("type P = { criadoEm: Date }; const g = (p: P) => \"em \" + p.criadoEm;")).toEqual(['texto-local: "em " + p.criadoEm']);
    expect(acha("type P = { criadoEm: Date }; const g = (p: P) => String(p.criadoEm);")).toEqual(["texto-local: String(p.criadoEm)"]);
    expect(acha("type P = { criadoEm: Date }; const g = (p: P) => `em ${p.criadoEm}`;")).toEqual(["texto-local: p.criadoEm"]);
    expect(acha("class C { quando: Date = new Date(); t() { return this.quando.toString(); } }")).toEqual(["texto-local: this.quando.toString()"]);
    expect(acha(`let t = ""; const d: Date = agora(); t += d;`)).toEqual(["texto-local: t += d"]);
    expect(acha(`const t = Date();`)).toEqual(["relogio-local: Date()"]);
  });

  it("o certo passa: tipos de Intl, Intl.DateTimeFormat chamado com timeZone, String de texto e de número, ISO", () => {
    expect(acha(`const o: Intl.DateTimeFormatOptions = { timeZone: f }; type T = typeof Intl;`)).toEqual([]);
    expect(acha(`new (Intl.DateTimeFormat)("pt-BR", { timeZone: fuso }).format(d); Intl.NumberFormat("pt-BR").format(1);`)).toEqual([]);
    expect(acha(`const d = new Date(x); String(d.getTime()); d.toISOString(); String(valor); n.toString(); "a" + d.toISOString();`)).toEqual([]);
  });

  it("sanidade: parseDiagnostics (interno do TypeScript) existe e acusa erro de sintaxe; sem ele, falha fechada", () => {
    const ok = ts.createSourceFile("x.tsx", "const a = 1;", ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX) as unknown as { parseDiagnostics?: unknown };
    const quebrado = ts.createSourceFile("x.tsx", "const a = <p>{", ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX) as unknown as { parseDiagnostics?: unknown };
    expect(Array.isArray(ok.parseDiagnostics)).toBe(true);
    expect(ok.parseDiagnostics).toHaveLength(0);
    expect((quebrado.parseDiagnostics as unknown[]).length).toBeGreaterThan(0);
  });

  it("exceção solta (não casa) e achado sem exceção aparecem", () => {
    const achados = achadosDeFuso("src/app/x.tsx", `d.getDate();`);
    expect(conferirExcecoes(achados, [{ arquivo: "src/app/x.tsx", regra: "relogio-local", trecho: "d.getDay()", motivo: "m" }])).toEqual({
      semExcecao: ["src/app/x.tsx:1: [relogio-local] d.getDate()"], soltas: ["src/app/x.tsx: [relogio-local] d.getDay()"],
    });
  });
});
