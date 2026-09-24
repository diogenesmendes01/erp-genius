import { describe, expect, it } from "vitest";
import { faixaDaPagina, hrefLista, lerOpcao, lerPagina, lerTexto, paginaAlemDoFim } from "./pagina-url";

describe("paginação e filtros na URL (páginas de servidor)", () => {
  it("página: inteiro 1..100000, qualquer outra coisa vira 1", () => {
    expect(lerPagina({ pagina: "3" })).toBe(3);
    for (const v of ["0", "-1", "2.5", "abc", "100001", ""]) expect(lerPagina({ pagina: v }), v).toBe(1);
    expect(lerPagina({})).toBe(1);
  });

  it("texto com teto e opção só entre as aceitas", () => {
    expect(lerTexto({ busca: "  ana  " }, "busca")).toBe("ana");
    expect(lerTexto({ busca: "x".repeat(300) }, "busca")).toHaveLength(100);
    expect(lerOpcao({ status: "PAGA" }, "status", ["PENDENTE", "PAGA"] as const)).toBe("PAGA");
    expect(lerOpcao({ status: "INVENTADA" }, "status", ["PENDENTE", "PAGA"] as const)).toBeNull();
  });

  it("link sem vazios e sem a página 1", () => {
    expect(hrefLista("/x", { busca: "ana", status: null, pagina: 1 })).toBe("/x?busca=ana");
    expect(hrefLista("/x", { busca: "", pagina: 3 })).toBe("/x?pagina=3");
    expect(hrefLista("/x", {})).toBe("/x");
  });

  it("faixa e página além do fim", () => {
    expect(faixaDaPagina(2, 50, 50, 120)).toEqual({ inicio: 51, fim: 100, temProxima: true });
    expect(faixaDaPagina(3, 50, 20, 120)).toEqual({ inicio: 101, fim: 120, temProxima: false });
    expect(faixaDaPagina(1, 50, 0, 0)).toEqual({ inicio: 0, fim: 0, temProxima: false });
    expect(paginaAlemDoFim(9, 50, 120)).toBe(3);
    expect(paginaAlemDoFim(3, 50, 120)).toBeNull();
    expect(paginaAlemDoFim(2, 50, 0)).toBe(1);
  });
});
