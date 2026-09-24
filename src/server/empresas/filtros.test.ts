import { describe, expect, it } from "vitest";
import {
  EMPRESAS_POR_PAGINA,
  destinoPaginaEmpresas,
  filtrosEmpresasParaQuery,
  hrefDosCamposEmpresas,
  lerFiltrosEmpresas,
  sanearFiltrosEmpresas,
  temFiltroEmpresas,
  whereFiltrosEmpresas,
} from "./filtros";

describe("filtros de empresas na URL", () => {
  it("lê e valida: situação desconhecida, id estranho e página inválida caem para vazio/1", () => {
    expect(lerFiltrosEmpresas({ busca: "  acme ", situacao: "ativas", pais: "p-1", pagina: "2" }))
      .toEqual({ busca: "acme", situacao: "ativas", paisId: "p-1", pagina: 2 });
    expect(lerFiltrosEmpresas({ situacao: "todas", pais: "a b", pagina: "0" }))
      .toEqual({ busca: "", situacao: null, paisId: null, pagina: 1 });
    expect(lerFiltrosEmpresas({ busca: "x".repeat(300) }).busca).toHaveLength(100);
  });

  it("query sem vazios e sem a página 1", () => {
    expect(filtrosEmpresasParaQuery(lerFiltrosEmpresas({ busca: "acme", situacao: "inativas", pagina: "3" }))).toBe("busca=acme&situacao=inativas&pagina=3");
    expect(filtrosEmpresasParaQuery(lerFiltrosEmpresas({ busca: "acme", pagina: "3" }), { semPagina: true })).toBe("busca=acme");
    expect(temFiltroEmpresas(lerFiltrosEmpresas({ pagina: "2" }))).toBe(false);
  });

  it("where: palavras em nome/código, situação e país", () => {
    expect(whereFiltrosEmpresas(lerFiltrosEmpresas({ busca: "acme ltda", situacao: "inativas", pais: "p1" }))).toEqual({
      AND: [
        { OR: [{ nome: { contains: "acme", mode: "insensitive" } }, { codigo: { contains: "acme", mode: "insensitive" } }] },
        { OR: [{ nome: { contains: "ltda", mode: "insensitive" } }, { codigo: { contains: "ltda", mode: "insensitive" } }] },
        { ativo: false },
        { paisId: "p1" },
      ],
    });
    expect(whereFiltrosEmpresas(lerFiltrosEmpresas({ situacao: "ativas" }))).toEqual({ AND: [{ ativo: true }] });
    expect(whereFiltrosEmpresas(lerFiltrosEmpresas({}))).toEqual({});
  });

  it("país fora das opções é descartado", () => {
    expect(sanearFiltrosEmpresas(lerFiltrosEmpresas({ pais: "antigo" }), { paises: [{ id: "p1" }] }).paisId).toBeNull();
    expect(sanearFiltrosEmpresas(lerFiltrosEmpresas({ pais: "p1" }), { paises: [{ id: "p1" }] }).paisId).toBe("p1");
  });

  it("página além do fim leva à última existente, preservando os filtros", () => {
    expect(destinoPaginaEmpresas(lerFiltrosEmpresas({ situacao: "ativas", pagina: "9" }), EMPRESAS_POR_PAGINA + 1)).toBe("/empresas?situacao=ativas&pagina=2");
    expect(destinoPaginaEmpresas(lerFiltrosEmpresas({ pagina: "2" }), EMPRESAS_POR_PAGINA + 1)).toBeNull();
  });

  it("link a partir dos campos volta à página 1 e descarta valor inválido", () => {
    expect(hrefDosCamposEmpresas({ busca: " acme ", situacao: "x", pais: "" })).toBe("/empresas?busca=acme");
  });
});
