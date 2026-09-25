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
  const visitar = (n: ts.Node) => {
    if (ts.isObjectLiteralExpression(n)) {
      const chaves = n.properties.filter((p) => ts.isPropertyAssignment(p)).map((p) => p.name.getText(sf).replace(/["']/g, ""));
      if (chaves.includes("PREVISTO") && chaves.includes("MINISTRADO")) achados.push(n.getText(sf).replace(/\s+/g, " ").slice(0, 90));
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
  });
});
