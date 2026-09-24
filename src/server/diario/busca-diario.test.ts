import { describe, expect, it } from "vitest";
import { hrefDiario, lerBuscaDiario, whereBuscaAulas } from "./busca-diario";

describe("busca no histórico do diário", () => {
  it("lê a busca da URL com teto", () => {
    expect(lerBuscaDiario({ busca: "  verbos  " })).toBe("verbos");
    expect(lerBuscaDiario({ busca: "x".repeat(300) })).toHaveLength(100);
    expect(lerBuscaDiario({})).toBe("");
  });

  it("cada palavra no conteúdo, na turma (código/nome) ou no professor", () => {
    expect(whereBuscaAulas("T-01 verbos")).toEqual({
      AND: ["T-01", "verbos"].map((p) => {
        const contem = { contains: p, mode: "insensitive" };
        return { OR: [{ conteudo: contem }, { turma: { OR: [{ codigo: contem }, { nome: contem }] } }, { professor: { nome: contem } }] };
      }),
    });
    expect(whereBuscaAulas("   ")).toEqual({});
  });

  it("links mantêm a busca e o cursor", () => {
    expect(hrefDiario({ busca: "verbos", antes: "a1" })).toBe("/diario?busca=verbos&antes=a1");
    expect(hrefDiario({ busca: "verbos" })).toBe("/diario?busca=verbos");
    expect(hrefDiario({})).toBe("/diario");
  });
});
