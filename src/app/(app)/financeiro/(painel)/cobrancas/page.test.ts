import { beforeEach, describe, expect, it, vi } from "vitest";

// Aba de cobranças (E4): os filtros da fila vêm da URL, lidos e validados no servidor, e a fila chega ao
// componente já filtrada; contadores e opções dos selects continuam sobre a fila inteira.
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

const item = (id: string, o: Record<string, unknown> = {}) => ({
  id, estado: "acao_devida", diasAtraso: 3, precisaBloqueio: false, codigo: `COB-${id}`, pais: "Brasil", turma: null, prioridade: 1,
  aluno: { id: `a-${id}`, nome: `Aluno ${id}`, telefone: null }, ...o,
});
const dashs = { aVencer: 1, emAtraso: 2, bloquear: 0, promessas: 0, recebidoHoje: [] };
/** Props entregues ao componente da fila (o elemento devolvido pela página); undefined no acesso negado. */
const render = async (params: Record<string, string>) => {
  const el = await Page({ searchParams: Promise.resolve(params) });
  return el.type === FilaCobranca ? (el.props as Record<string, unknown>) : undefined;
};

describe("/financeiro/cobrancas — filtros na URL (E4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.contexto.mockResolvedValue({ papeis: [], permissoes: { podeOperarCobranca: true, podeAprovar: false } });
    mocks.fila.mockResolvedValue({
      itens: [item("br"), item("cr", { pais: "Costa Rica", turma: "Inglês A1", diasAtraso: -2 }), item("cr2", { pais: "Costa Rica", aluno: { id: "x", nome: "Ana Silva", telefone: null } })],
      dashs, regua: [],
    });
  });

  it("guard antes da consulta: quem não enxerga a aba não consulta a fila", async () => {
    mocks.contexto.mockResolvedValue(null);
    expect(await render({ indicador: "emAtraso" })).toBeUndefined();
    expect(mocks.fila).not.toHaveBeenCalled();
  });

  it("filtros lidos da URL chegam ao componente e a fila vem filtrada; total, contadores e opções da fila inteira", async () => {
    const p = (await render({ indicador: "emAtraso", pais: "Costa Rica" }))!;
    expect(p.filtros).toEqual({ indicador: "emAtraso", busca: "", pais: "Costa Rica", turma: null });
    expect((p.itens as { id: string }[]).map((i) => i.id)).toEqual(["cr2"]);
    expect(p.totalFila).toBe(3);
    expect(p.dashs).toEqual(dashs);
    expect(p.opcoes).toEqual({ paises: ["Brasil", "Costa Rica"], turmas: ["Inglês A1"] });
    expect(p.preferenciaFusoExibicao).toBe("America/Costa_Rica");
  });

  it("busca chega ao filtro do servidor (palavras no nome ou no código)", async () => {
    expect(((await render({ busca: " silva ana " }))!.itens as { id: string }[]).map((i) => i.id)).toEqual(["cr2"]);
    expect(((await render({ busca: "cob-br" }))!.itens as { id: string }[]).map((i) => i.id)).toEqual(["br"]);
  });

  it("valor inválido na URL é ignorado: indicador desconhecido mostra a fila inteira", async () => {
    const p = (await render({ indicador: "todos" }))!;
    expect(p.filtros).toEqual({ indicador: null, busca: "", pais: null, turma: null });
    expect(p.itens).toHaveLength(3);
  });
});
