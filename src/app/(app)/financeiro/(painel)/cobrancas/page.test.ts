import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Aba de cobranças (E4 + item 9 de docs/43 §6): os filtros e o cursor da fila vêm da URL, lidos e validados
// no servidor; a consulta devolve o trecho já filtrado e ordenado, e a página só repassa ao componente.
const mocks = vi.hoisted(() => ({
  contexto: vi.fn(),
  fila: vi.fn(),
  preferencia: vi.fn(async () => ({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } })),
}));
vi.mock("../../contexto", () => ({ contextoDaAba: mocks.contexto }));
vi.mock("@/server/cobrancas/consultas", () => ({ listarFilaCobranca: mocks.fila }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/components/AcessoNegado", () => ({ AcessoNegado: () => "Acesso negado" }));
vi.mock("../../FilaCobranca", () => ({ FilaCobranca: () => null }));

import Page from "./page";
import { FilaCobranca } from "../../FilaCobranca";

const dashs = { aVencer: 1, emAtraso: 2, bloquear: 0, promessas: 0, recebidoHoje: [] };
const consulta = {
  itens: [{ id: "cr2" }], dashs, regua: [], totalFila: 3, totalVisao: 1,
  opcoes: { paises: ["Brasil", "Costa Rica"], turmas: ["Inglês A1"] },
  temAnterior: true, temProxima: true, anterior: "1_3_cr2", proxima: "1_3_cr2",
};
/** Props entregues ao componente da fila (o elemento devolvido pela página); undefined quando não é a fila. */
const render = async (params: Record<string, string>) => {
  const el = await Page({ searchParams: Promise.resolve(params) });
  return el.type === FilaCobranca ? (el.props as Record<string, unknown>) : undefined;
};

describe("/financeiro/cobrancas — filtros e cursor na URL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.contexto.mockResolvedValue({ papeis: [], permissoes: { podeOperarCobranca: true, podeAprovar: false } });
    mocks.fila.mockResolvedValue(consulta);
  });

  it("guard antes da consulta: quem não enxerga a aba não consulta a fila", async () => {
    mocks.contexto.mockResolvedValue(null);
    expect(await render({ indicador: "emAtraso" })).toBeUndefined();
    expect(mocks.fila).not.toHaveBeenCalled();
  });

  it("filtros e cursor lidos da URL vão para a consulta; o trecho, os totais, as opções e os cursores chegam ao componente", async () => {
    const p = (await render({ indicador: "emAtraso", pais: "Costa Rica", depois: "1_5_c010" }))!;
    expect(mocks.fila).toHaveBeenCalledWith({
      filtros: { indicador: "emAtraso", busca: "", pais: "Costa Rica", turma: null },
      navegacao: { depois: "1_5_c010" },
    });
    expect(p.filtros).toEqual({ indicador: "emAtraso", busca: "", pais: "Costa Rica", turma: null });
    expect(p.itens).toEqual([{ id: "cr2" }]);
    expect(p.totalFila).toBe(3);
    expect(p.totalVisao).toBe(1);
    expect(p.dashs).toEqual(dashs);
    expect(p.opcoes).toEqual({ paises: ["Brasil", "Costa Rica"], turmas: ["Inglês A1"] });
    expect(p.navegacao).toEqual({ anterior: "1_3_cr2", proxima: "1_3_cr2" });
    // Leu a partir de um cursor: a volta ao início mantém o recorte (e não leva cursor).
    expect(p.inicioDaFila).toBe("/financeiro/cobrancas?indicador=emAtraso&pais=Costa+Rica");
    expect(p.preferenciaFusoExibicao).toBe("America/Costa_Rica");
  });

  it("no início da fila não há volta ao início; o cursor `antes` também chega à consulta", async () => {
    expect((await render({}))!.inicioDaFila).toBeNull();
    expect(mocks.fila).toHaveBeenLastCalledWith({ filtros: { indicador: null, busca: "", pais: null, turma: null }, navegacao: {} });
    await render({ antes: "900_0_c3" });
    expect(mocks.fila).toHaveBeenLastCalledWith(expect.objectContaining({ navegacao: { antes: "900_0_c3" } }));
  });

  it("valor inválido de filtro é ignorado: indicador desconhecido lê a fila inteira", async () => {
    await render({ indicador: "todos" });
    expect(mocks.fila).toHaveBeenCalledWith({ filtros: { indicador: null, busca: "", pais: null, turma: null }, navegacao: {} });
  });

  it("cursor fora do formato, ou os dois sentidos juntos: erro com a volta ao início, sem consultar", async () => {
    for (const params of [{ depois: "../x" }, { depois: "c010" }, { antes: "1_2_a", depois: "1_2_b" }, { busca: "ana", depois: "1_x_c1" }]) {
      const el = await Page({ searchParams: Promise.resolve(params) });
      const html = renderToStaticMarkup(el);
      expect(html, JSON.stringify(params)).toContain('role="alert"');
      expect(html).toContain("Ir para o início da fila");
    }
    const comBusca = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ busca: "ana", depois: "1_x_c1" }) }));
    expect(comBusca).toContain('href="/financeiro/cobrancas?busca=ana"');
    expect(mocks.fila).not.toHaveBeenCalled();
  });
});
