import { describe, expect, it } from "vitest";
import { faixaDaPagina, hrefLista, janelaDaPagina, lerOpcao, lerPagina, lerTexto, paginaAlemDoFim, recorteDaPagina } from "./pagina-url";

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

describe("consulta numerada nos dois sentidos (E4)", () => {
  // 45 registros em ordem estável (criadoEm desc, id desc), com empate de criadoEm resolvido pelo id.
  const base = Array.from({ length: 45 }, (_, i) => ({ id: `r${String(i).padStart(2, "0")}`, criadoEm: Math.floor(i / 3) }));
  const ordenados = [...base].sort((a, b) => b.criadoEm - a.criadoEm || (a.id < b.id ? 1 : -1));
  const ler = (pagina: number) => {
    const { skip, take } = janelaDaPagina(pagina, 20);
    return recorteDaPagina(ordenados.slice(skip, skip + take), 20);
  };

  it("janela: pula as páginas anteriores e lê um a mais", () => {
    expect(janelaDaPagina(1, 20)).toEqual({ skip: 0, take: 21 });
    expect(janelaDaPagina(3, 20)).toEqual({ skip: 40, take: 21 });
  });

  it("recorte: só o registro a mais diz que há próxima (página cheia no fim não tem próxima)", () => {
    const vinte = Array.from({ length: 20 }, (_, i) => i);
    expect(recorteDaPagina(vinte, 20)).toEqual({ registros: vinte, temProxima: false });
    expect(recorteDaPagina([...vinte, 20], 20)).toEqual({ registros: vinte, temProxima: true });
    expect(recorteDaPagina([], 20)).toEqual({ registros: [], temProxima: false });
  });

  it("ida e volta devolvem os mesmos registros; a última página não tem próxima", () => {
    const p1 = ler(1), p2 = ler(2), p3 = ler(3);
    expect([p1.temProxima, p2.temProxima, p3.temProxima]).toEqual([true, true, false]);
    expect(p3.registros).toHaveLength(5);
    expect(ler(2).registros).toEqual(p2.registros);
    expect(ler(1).registros).toEqual(p1.registros);
    // Nenhum registro some nem se repete entre as páginas.
    const todos = [...p1.registros, ...p2.registros, ...p3.registros].map((r) => r.id);
    expect(new Set(todos).size).toBe(45);
    expect(todos).toEqual(ordenados.map((r) => r.id));
  });

  it("chave de página de um segundo painel: a página 1 também fica fora do link", () => {
    expect(hrefLista("/x", { pagina: 2, paginaPendencias: 1 })).toBe("/x?pagina=2");
    expect(hrefLista("/x", { pagina: 1, paginaPendencias: 3 })).toBe("/x?paginaPendencias=3");
    expect(lerPagina({ paginaPendencias: "4" }, "paginaPendencias")).toBe(4);
    expect(lerPagina({ pagina: "4" }, "paginaPendencias")).toBe(1);
    // Só "pagina" e "paginaX": outra chave com 1 continua no link.
    expect(hrefLista("/x", { modelos: 1, paginas: 1 })).toBe("/x?modelos=1&paginas=1");
  });
});
