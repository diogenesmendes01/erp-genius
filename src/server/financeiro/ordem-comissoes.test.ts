import { describe, expect, it } from "vitest";
import { ORDEM_PADRAO_COMISSOES, lerOrdemComissoes, orderByComissoes, parametrosOrdemComissoes } from "./ordem-comissoes";

describe("ordem das comissões (E1)", () => {
  it("lista fechada: beneficiário, valor e situação; fora dela → beneficiário crescente", () => {
    expect(lerOrdemComissoes({ ordem: "valor", dir: "desc" })).toEqual({ campo: "valor", dir: "desc" });
    expect(lerOrdemComissoes({ ordem: "status" })).toEqual({ campo: "status", dir: "asc" });
    for (const ordem of ["percentual", "matriculaId", "criadoEm", "id", ""]) {
      expect(lerOrdemComissoes({ ordem, dir: "desc" })).toEqual(ORDEM_PADRAO_COMISSOES);
    }
  });

  it("orderBy padrão idêntico ao de antes da ordenação", () => {
    expect(orderByComissoes()).toEqual([{ vendedor: { nome: "asc" } }, { criadoEm: "desc" }, { id: "desc" }]);
    expect(orderByComissoes(lerOrdemComissoes({}))).toEqual([{ vendedor: { nome: "asc" } }, { criadoEm: "desc" }, { id: "desc" }]);
  });

  it("todo critério termina no desempate por id", () => {
    for (const campo of ["vendedor", "valor", "status"] as const) {
      for (const dir of ["asc", "desc"] as const) {
        expect(Object.keys(orderByComissoes({ campo, dir }).at(-1) ?? {})).toEqual(["id"]);
      }
    }
  });

  it("parâmetros dos links: vazios na ordem padrão (URLs de antes não mudam)", () => {
    expect(parametrosOrdemComissoes(ORDEM_PADRAO_COMISSOES)).toEqual({ ordem: null, dir: null });
    expect(parametrosOrdemComissoes({ campo: "valor", dir: "desc" })).toEqual({ ordem: "valor", dir: "desc" });
  });
});

// Revisão R1 da #136 (B4): chave herdada de Object não é coluna — cai na ordem padrão.
describe("ordem das comissões: chave herdada de Object", () => {
  it.each(["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"])("ordem=%s → ordem padrão", (ordem) => {
    expect(lerOrdemComissoes({ ordem, dir: "desc" })).toEqual(ORDEM_PADRAO_COMISSOES);
  });
});
