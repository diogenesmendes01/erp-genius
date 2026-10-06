import { describe, expect, it } from "vitest";
import {
  EMPRESAS_POR_PAGINA,
  destinoPaginaEmpresas,
  filtrosEmpresasParaQuery,
  hrefDosCamposEmpresas,
  lerFiltrosEmpresas,
  orderByEmpresas,
  parametrosFiltrosEmpresas,
  sanearFiltrosEmpresas,
  temFiltroEmpresas,
  whereFiltrosEmpresas,
} from "./filtros";

describe("filtros de empresas na URL", () => {
  it("lê e valida: situação desconhecida, id estranho e página inválida caem para vazio/1", () => {
    expect(lerFiltrosEmpresas({ busca: "  acme ", situacao: "ativas", pais: "p-1", pagina: "2" }))
      .toEqual({ busca: "acme", situacao: "ativas", paisId: "p-1", pagina: 2, ordem: null });
    expect(lerFiltrosEmpresas({ situacao: "todas", pais: "a b", pagina: "0" }))
      .toEqual({ busca: "", situacao: null, paisId: null, pagina: 1, ordem: null });
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

describe("ordenação de empresas (E1 — ColunaOrdenavel)", () => {
  it("lista fechada: código, nome, colaboradores e situação; fora dela → sem ordem (a de cadastro)", () => {
    expect(lerFiltrosEmpresas({ ordem: "colaboradores", dir: "desc" }).ordem).toEqual({ campo: "colaboradores", dir: "desc" });
    for (const ordem of ["pais", "faturasAReceber", "criadoEm", "documento", "id"]) {
      expect(lerFiltrosEmpresas({ ordem, dir: "asc" }).ordem).toBeNull();
    }
  });

  it("orderBy: sem ordem, o de sempre; cada coluna termina no desempate por id", () => {
    expect(orderByEmpresas(null)).toEqual([{ criadoEm: "desc" }, { id: "desc" }]);
    expect(orderByEmpresas({ campo: "nome", dir: "desc" })).toEqual([{ nome: "desc" }, { id: "desc" }]);
    expect(orderByEmpresas({ campo: "codigo", dir: "asc" })).toEqual([{ codigo: { sort: "asc", nulls: "last" } }, { id: "asc" }]);
    expect(orderByEmpresas({ campo: "colaboradores", dir: "desc" })).toEqual([{ matriculas: { _count: "desc" } }, { nome: "asc" }, { id: "asc" }]);
    // Crescente pelo rótulo exibido: "Ativa" antes de "Inativa".
    expect(orderByEmpresas({ campo: "situacao", dir: "asc" })).toEqual([{ ativo: "desc" }, { nome: "asc" }, { id: "asc" }]);
    expect(orderByEmpresas({ campo: "situacao", dir: "desc" })).toEqual([{ ativo: "asc" }, { nome: "asc" }, { id: "asc" }]);
  });

  it("a ordem vai nos links (paginação, filtros, redirecionamento) e não conta como filtro", () => {
    const f = lerFiltrosEmpresas({ situacao: "ativas", ordem: "nome", dir: "desc", pagina: "9" });
    expect(filtrosEmpresasParaQuery(f)).toBe("situacao=ativas&ordem=nome&dir=desc&pagina=9");
    expect(destinoPaginaEmpresas(f, EMPRESAS_POR_PAGINA + 1)).toBe("/empresas?situacao=ativas&ordem=nome&dir=desc&pagina=2");
    expect(temFiltroEmpresas(lerFiltrosEmpresas({ ordem: "nome" }))).toBe(false);
    expect(hrefDosCamposEmpresas({ busca: "acme", situacao: "", pais: "" }, f.ordem)).toBe("/empresas?busca=acme&ordem=nome&dir=desc");
    expect(parametrosFiltrosEmpresas(f)).toEqual({ situacao: "ativas" });
  });
});

describe("teto da busca de empresas", () => {
  it("no máximo 6 palavras: a 7ª em diante é descartada (limita o tamanho da consulta)", () => {
    const where = whereFiltrosEmpresas(lerFiltrosEmpresas({ busca: "a b c d e f g" })) as { AND: unknown[] };
    expect(where.AND).toHaveLength(6);
    expect(JSON.stringify(where)).not.toContain('"g"');
  });
});
