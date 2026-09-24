import { describe, expect, it } from "vitest";
import {
  LEADS_POR_PAGINA,
  camposDosFiltrosLeads,
  destinoPaginaLeads,
  filtrosDaConsultaLeads,
  filtrosLeadsParaQuery,
  hrefDosCamposLeads,
  lerFiltrosLeads,
  sanearFiltrosLeads,
  temFiltroLeads,
  whereFiltrosLead,
} from "./filtros";
import { sincronizarCamposFiltro } from "@/lib/filtros-url";

// A lista usa a sincronização genérica (useFiltrosUrl) sobre os campos derivados destes filtros.
const sincronizarCamposLeads = (atuais: ReturnType<typeof camposDosFiltrosLeads>, antes: ReturnType<typeof lerFiltrosLeads>, depois: ReturnType<typeof lerFiltrosLeads>) =>
  sincronizarCamposFiltro(atuais, camposDosFiltrosLeads(antes), camposDosFiltrosLeads(depois));

describe("filtros de leads na URL", () => {
  it("lê e valida: enums desconhecidos, id estranho e página inválida caem para vazio/1", () => {
    expect(lerFiltrosLeads({ busca: "  ana  ", tipo: "b2b", etapa: "NOVO", segmento: "ADULTO", temperatura: "QUENTE", dono: "u-1", pagina: "3" }))
      .toEqual({ busca: "ana", tipo: "b2b", etapa: "NOVO", segmento: "ADULTO", temperatura: "QUENTE", donoId: "u-1", pagina: 3 });
    expect(lerFiltrosLeads({ tipo: "x", etapa: "INVENTADA", segmento: "?", temperatura: "", dono: "a b", pagina: "-2" }))
      .toEqual({ busca: "", tipo: null, etapa: null, segmento: null, temperatura: null, donoId: null, pagina: 1 });
    expect(lerFiltrosLeads({ busca: "x".repeat(300) }).busca).toHaveLength(100);
    expect(lerFiltrosLeads(new URLSearchParams("etapa=NOVO&vendedorId=outro")).donoId).toBeNull();
  });

  it("query sem vazios e sem a página 1; `semPagina` para exportação", () => {
    const f = lerFiltrosLeads({ busca: "ana", etapa: "NOVO", pagina: "2" });
    expect(filtrosLeadsParaQuery(f)).toBe("busca=ana&etapa=NOVO&pagina=2");
    expect(filtrosLeadsParaQuery(f, { semPagina: true })).toBe("busca=ana&etapa=NOVO");
    expect(filtrosLeadsParaQuery(lerFiltrosLeads({}))).toBe("");
    expect(temFiltroLeads(lerFiltrosLeads({ pagina: "4" }))).toBe(false);
    expect(temFiltroLeads(lerFiltrosLeads({ tipo: "pf" }))).toBe(true);
  });

  it("filtros da URL → filtros da consulta (tipo vira b2b; dono vira vendedorId)", () => {
    expect(filtrosDaConsultaLeads(lerFiltrosLeads({ tipo: "pf", dono: "u1", busca: "ana" }))).toEqual({ busca: "ana", b2b: false, vendedorId: "u1" });
    expect(filtrosDaConsultaLeads(lerFiltrosLeads({}))).toEqual({});
  });

  it("busca por palavras em nome/código; telefone só pelos dígitos (3+)", () => {
    const where = whereFiltrosLead({ busca: "Ana 8888-7777" });
    expect(where.AND).toEqual([
      { OR: [{ nome: { contains: "Ana", mode: "insensitive" } }, { codigo: { contains: "Ana", mode: "insensitive" } }] },
      { OR: [{ nome: { contains: "8888-7777", mode: "insensitive" } }, { codigo: { contains: "8888-7777", mode: "insensitive" } }, { telefoneE164: { contains: "88887777" } }] },
    ]);
    // Menos de 3 dígitos não varre telefones; a partir de 3, sim.
    const campos = (busca: string) => (whereFiltrosLead({ busca }).AND as { OR: Record<string, unknown>[] }[])[0].OR.map((c) => Object.keys(c)[0]);
    expect(campos("a1")).toEqual(["nome", "codigo"]);
    expect(campos("12")).toEqual(["nome", "codigo"]);
    expect(campos("123")).toEqual(["nome", "codigo", "telefoneE164"]);
    expect((whereFiltrosLead({ busca: "123" }).AND as { OR: Record<string, unknown>[] }[])[0].OR[2]).toEqual({ telefoneE164: { contains: "123" } });
    expect(whereFiltrosLead({ vendedorId: "outro" })).toEqual({ vendedorDonoId: "outro" });
    expect(whereFiltrosLead({ b2b: false })).toEqual({ b2b: false });
  });

  it("dono fora das opções é descartado (vendedor não filtra por dono)", () => {
    const f = lerFiltrosLeads({ dono: "u9", etapa: "NOVO" });
    expect(sanearFiltrosLeads(f, { donos: [] }).donoId).toBeNull();
    expect(sanearFiltrosLeads(f, { donos: [{ id: "u9" }] }).donoId).toBe("u9");
  });

  it("página além do fim leva à última existente, preservando os filtros", () => {
    const f = lerFiltrosLeads({ etapa: "NOVO", pagina: "9" });
    expect(destinoPaginaLeads(f, LEADS_POR_PAGINA * 2 + 1)).toBe("/leads?etapa=NOVO&pagina=3");
    expect(destinoPaginaLeads(f, 0)).toBe("/leads?etapa=NOVO");
    expect(destinoPaginaLeads(lerFiltrosLeads({ pagina: "2" }), LEADS_POR_PAGINA + 1)).toBeNull();
  });

  it("campos: só os que mudaram na URL são atualizados; o resto preserva o que está sendo digitado", () => {
    const antes = lerFiltrosLeads({ busca: "ana" });
    const depois = lerFiltrosLeads({ busca: "ana", etapa: "NOVO" });
    const emEdicao = { ...camposDosFiltrosLeads(antes), busca: "ana mar" };
    expect(sincronizarCamposLeads(emEdicao, antes, depois)).toMatchObject({ busca: "ana mar", etapa: "NOVO" });
    expect(sincronizarCamposLeads(emEdicao, antes, lerFiltrosLeads({})).busca).toBe("");
  });

  it("link a partir dos campos volta à página 1 e descarta valor inválido", () => {
    expect(hrefDosCamposLeads({ busca: " ana ", tipo: "b2b", etapa: "X", segmento: "", temperatura: "", dono: "" })).toBe("/leads?busca=ana&tipo=b2b");
  });
});
