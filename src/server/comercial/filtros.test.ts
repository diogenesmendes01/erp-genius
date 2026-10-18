import { describe, expect, it } from "vitest";
import { filtrosDaConsultaLeads, lerFiltrosLeads, whereFiltrosLead } from "./filtros";

describe("filtros de leads na URL", () => {
  it("lê e valida: enums desconhecidos, id estranho e página inválida caem para vazio/1", () => {
    expect(lerFiltrosLeads({ busca: "  ana  ", tipo: "b2b", etapa: "NOVO", segmento: "ADULTO", temperatura: "QUENTE", dono: "u-1", pagina: "3" }))
      .toEqual({ busca: "ana", tipo: "b2b", etapa: "NOVO", segmento: "ADULTO", temperatura: "QUENTE", donoId: "u-1", pagina: 3 });
    expect(lerFiltrosLeads({ tipo: "x", etapa: "INVENTADA", segmento: "?", temperatura: "", dono: "a b", pagina: "-2" }))
      .toEqual({ busca: "", tipo: null, etapa: null, segmento: null, temperatura: null, donoId: null, pagina: 1 });
    expect(lerFiltrosLeads({ busca: "x".repeat(300) }).busca).toHaveLength(100);
    expect(lerFiltrosLeads(new URLSearchParams("etapa=NOVO&vendedorId=outro")).donoId).toBeNull();
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
});

describe("teto da busca de leads", () => {
  it("no máximo 6 palavras: a 7ª em diante é descartada (limita o tamanho da consulta)", () => {
    const where = whereFiltrosLead({ busca: "a b c d e f g" }) as { AND: unknown[] };
    expect(where.AND).toHaveLength(6);
    expect(JSON.stringify(where)).not.toContain('"g"');
  });
});
