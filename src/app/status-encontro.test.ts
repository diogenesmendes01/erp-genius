import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { STATUS_ENCONTRO_LABEL } from "@/lib/labels";

// Status do encontro (StatusEncontroAgenda): um mapa só, STATUS_ENCONTRO_LABEL em src/lib/labels.ts,
// no masculino — concorda com "encontro". O diário dizia "Prevista/Ministrada/Cancelada" e o
// acadêmico "Previsto/…"; decisão do responsável em 25/09/2026. Nenhuma tela monta o próprio mapa.

/** Objetos literais com as chaves do status do encontro (PREVISTO e MINISTRADO) escritos numa tela. */
export function mapasDeStatusEncontro(fonte: string): string[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const achados: string[] = [];
  // Nome de uma chave em qualquer forma de membro: `PREVISTO:`, `"PREVISTO":`, `["PREVISTO"]:`,
  // shorthand `{ PREVISTO }`, getter/método `get PREVISTO()`.
  const nomeDaChave = (nome: ts.PropertyName | undefined): string | null => {
    if (!nome) return null;
    if (ts.isIdentifier(nome) || ts.isStringLiteral(nome) || ts.isNoSubstitutionTemplateLiteral(nome)) return nome.text;
    if (ts.isComputedPropertyName(nome)) {
      const e = nome.expression;
      if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
      if (ts.isPropertyAccessExpression(e)) return e.name.text; // [StatusEncontroAgenda.PREVISTO]
    }
    return null;
  };
  const doPar = (chaves: (string | null)[]) => chaves.includes("PREVISTO") && chaves.includes("MINISTRADO");
  const texto = (n: ts.Node) => n.getText(sf).replace(/\s+/g, " ").slice(0, 90);
  const visitar = (n: ts.Node) => {
    if (ts.isObjectLiteralExpression(n) && doPar(n.properties.map((p) => (ts.isSpreadAssignment(p) ? null : nomeDaChave(p.name))))) achados.push(texto(n));
    // Pares em array — Object.fromEntries([["PREVISTO", …], …]), new Map([...]).
    if (ts.isArrayLiteralExpression(n)) {
      // A chave do par em qualquer forma: "PREVISTO", `PREVISTO` ou StatusEncontroAgenda.PREVISTO.
      const chaveDoPar = (e: ts.Expression | undefined) =>
        !e ? null : ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : null;
      const primeiros = n.elements.map((e) => (ts.isArrayLiteralExpression(e) ? chaveDoPar(e.elements[0]) : null));
      if (doPar(primeiros)) achados.push(texto(n));
    }
    // switch (status) { case "PREVISTO": … case "MINISTRADO": … } também é um mapa de rótulos.
    if (ts.isSwitchStatement(n)) {
      const casos = n.caseBlock.clauses.map((c) => (ts.isCaseClause(c) ? (ts.isStringLiteral(c.expression) ? c.expression.text : ts.isPropertyAccessExpression(c.expression) ? c.expression.name.text : null) : null));
      if (doPar(casos)) achados.push(texto(n));
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return achados;
}

const telas = ["src/app", "src/components"].flatMap((raiz) =>
  (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f))
    .map((f) => ({ arquivo: join(raiz, f).split("\\").join("/"), conteudo: readFileSync(join(raiz, f), "utf-8") })),
);

describe("status do encontro: um rótulo por estado, no masculino", () => {
  it("o mapa central concorda com \"encontro\"", () => {
    expect(STATUS_ENCONTRO_LABEL).toEqual({
      RASCUNHO: "Rascunho",
      PREVISTO: "Previsto",
      MINISTRADO: "Ministrado",
      CANCELADO: "Cancelado",
      NAO_REALIZADO: "Não realizado",
      IMPEDIDO_ESCOLA: "Impedido pela escola",
    });
  });

  it("nenhuma tela monta o próprio mapa do status do encontro (use STATUS_ENCONTRO_LABEL)", () => {
    const ofensores = telas.flatMap(({ arquivo, conteudo }) => mapasDeStatusEncontro(conteudo).map((m) => `${arquivo}: ${m}`));
    expect(ofensores).toEqual([]);
  });

  it("o detector pega o mapa local (inclusive entre aspas e dentro de outro mapa) e aceita o spread do central", () => {
    expect(mapasDeStatusEncontro('const r = { PREVISTO: "Prevista", MINISTRADO: "Ministrada" };')).toHaveLength(1);
    expect(mapasDeStatusEncontro('const r = { "PREVISTO": "Previsto", "MINISTRADO": "Ministrado" };')).toHaveLength(1);
    expect(mapasDeStatusEncontro('const r = { RESERVADA: "Reservada", PREVISTO: "Previsto", MINISTRADO: "Ministrado" };')).toHaveLength(1);
    expect(mapasDeStatusEncontro('const r = { RESERVADA: "Reservada", ...STATUS_ENCONTRO_LABEL };')).toEqual([]);
    // R1 da #120: chaves computadas, shorthand, getters, enum como chave e pares em array também contam.
    expect(mapasDeStatusEncontro('const r = { ["PREVISTO"]: "Prevista", ["MINISTRADO"]: "Ministrada" };')).toHaveLength(1);
    expect(mapasDeStatusEncontro("const PREVISTO = \"Prevista\", MINISTRADO = \"Ministrada\"; const r = { PREVISTO, MINISTRADO };")).toHaveLength(1);
    expect(mapasDeStatusEncontro('const r = { get PREVISTO() { return "Prevista"; }, get MINISTRADO() { return "Ministrada"; } };')).toHaveLength(1);
    expect(mapasDeStatusEncontro('const r = { [StatusEncontroAgenda.PREVISTO]: "Prevista", [StatusEncontroAgenda.MINISTRADO]: "Ministrada" };')).toHaveLength(1);
    expect(mapasDeStatusEncontro('const r = Object.fromEntries([["PREVISTO", "Prevista"], ["MINISTRADO", "Ministrada"]]);')).toHaveLength(1);
    expect(mapasDeStatusEncontro('const r = new Map([["PREVISTO", "Prevista"], ["MINISTRADO", "Ministrada"]]);')).toHaveLength(1);
    expect(mapasDeStatusEncontro('const r = Object.fromEntries([[StatusEncontroAgenda.PREVISTO, "Prevista"], [StatusEncontroAgenda.MINISTRADO, "Ministrada"]]);')).toHaveLength(1);
    expect(mapasDeStatusEncontro('const r = new Map([[StatusEncontroAgenda.PREVISTO, "Prevista"], [StatusEncontroAgenda.MINISTRADO, "Ministrada"]]);')).toHaveLength(1);
    expect(mapasDeStatusEncontro('function r(s) { switch (s) { case "PREVISTO": return "Prevista"; case "MINISTRADO": return "Ministrada"; } }')).toHaveLength(1);
  });
});
