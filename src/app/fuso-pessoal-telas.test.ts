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
//   getFullYear/getTimezoneOffset/toDateString/toTimeString.
// Opções que não são objeto literal, ou objeto com spread e sem `timeZone`, não dão para conferir: contam (falha
// fechada). Arquivo que não analisa também conta.
//
// Fora do alcance (declarado): `timeZone` presente mas com o fuso errado (ex.: o da escola num instante que devia
// sair no fuso pessoal). Isso é conferido tela a tela, nos testes de renderização.
//
// Exceções: arquivo + regra + trecho exato (espaços normalizados) + motivo; cada uma casa com exatamente um achado.

const RAIZES = ["src/app", "src/components"];
const FORA_DE_TELA = /^src\/app\/api\//;

export type Regra = "toLocale" | "intl" | "relogio-local" | "opaco";
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

const ehIntlDateTimeFormat = (e: ts.Expression) =>
  ts.isPropertyAccessExpression(e) && e.name.text === "DateTimeFormat" && ts.isIdentifier(e.expression) && e.expression.text === "Intl";

export function achadosDeFuso(arquivo: string, fonte: string): Achado[] {
  const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const achados: Achado[] = [];
  const diagnosticos = (sf as unknown as { parseDiagnostics?: unknown[] }).parseDiagnostics ?? [];
  if (diagnosticos.length) return [{ arquivo, linha: 1, regra: "opaco", trecho: "arquivo não analisa" }];
  const acha = (no: ts.Node, regra: Regra) =>
    achados.push({ arquivo, linha: sf.getLineAndCharacterOfPosition(no.getStart(sf)).line + 1, regra, trecho: normaliza(no.getText(sf)) });
  const visita = (no: ts.Node) => {
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

  it("exceção solta (não casa) e achado sem exceção aparecem", () => {
    const achados = achadosDeFuso("src/app/x.tsx", `d.getDate();`);
    expect(conferirExcecoes(achados, [{ arquivo: "src/app/x.tsx", regra: "relogio-local", trecho: "d.getDay()", motivo: "m" }])).toEqual({
      semExcecao: ["src/app/x.tsx:1: [relogio-local] d.getDate()"], soltas: ["src/app/x.tsx: [relogio-local] d.getDay()"],
    });
  });
});
