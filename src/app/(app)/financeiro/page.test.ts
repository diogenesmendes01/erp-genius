import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  guard: vi.fn(), preferencia: vi.fn(), fila: vi.fn(), comissoes: vi.fn(), kpis: vi.fn(),
  aprovacoes: vi.fn(), cotacoes: vi.fn(), relatorio: vi.fn(), informes: vi.fn(), politicas: vi.fn(), retomadas: vi.fn(), configFinanceiro: vi.fn(),
}));

vi.mock("@/lib/guards", () => ({ exigirPapelLeitura: mocks.guard }));
vi.mock("@/components/AcessoNegado", () => ({ AcessoNegado: () => createElement("p", null, "Acesso negado") }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/cobrancas/consultas", () => ({ listarFilaCobranca: mocks.fila }));
vi.mock("@/server/ajustes/consultas", () => ({ listarAprovacoesPendentes: mocks.aprovacoes }));
vi.mock("@/server/retomada/consultas", () => ({ listarPropostasRetomada: mocks.retomadas }));
vi.mock("@/server/financeiro/consultas", () => ({
  listarComissoes: mocks.comissoes, kpisFinanceiro: mocks.kpis, dadosCambio: mocks.cotacoes,
  relatorioDescontosComissoes: mocks.relatorio, listarInformesPagamento: mocks.informes,
  configuracaoComissoes: mocks.politicas, carregarConfigFinanceiro: mocks.configFinanceiro,
}));
vi.mock("./FinanceiroPainel", () => ({
  FinanceiroPainel: ({ preferenciaFusoExibicao }: { preferenciaFusoExibicao: string | null }) => createElement("div", { "data-fuso": preferenciaFusoExibicao ?? "UTC" }),
}));

import Page from "./page";

describe("FinanceiroPage", () => {
  beforeEach(() => {
    mocks.guard.mockResolvedValue([Papel.FINANCEIRO]);
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
    mocks.fila.mockResolvedValue({ itens: [], dashs: { aVencer: 0, emAtraso: 0, bloquear: 0, promessas: 0, recebidoHoje: [] }, regua: [] });
    mocks.comissoes.mockResolvedValue([]); mocks.kpis.mockResolvedValue({ recebidoMes: [], emAtraso: [], aReceber: [], comissoesAPagar: [], novasMatriculas: 0 });
    mocks.aprovacoes.mockResolvedValue([]); mocks.cotacoes.mockResolvedValue([]); mocks.relatorio.mockResolvedValue({}); mocks.informes.mockResolvedValue([]);
    mocks.politicas.mockResolvedValue(null); mocks.retomadas.mockResolvedValue({ ok: true, dado: [] }); mocks.configFinanceiro.mockResolvedValue({ fechamentoComissaoAutomatico: false });
  });

  afterEach(() => vi.clearAllMocks());

  it("lê a preferência depois da guarda e a entrega à fila e aos informes", async () => {
    const html = renderToStaticMarkup(await Page());

    expect(mocks.guard).toHaveBeenCalledWith(Papel.FINANCEIRO, Papel.GERENTE_COMERCIAL);
    expect(mocks.preferencia).toHaveBeenCalledTimes(1);
    expect(html).toContain('data-fuso="America/Costa_Rica"');
  });

  it("não consulta preferência nem dados financeiros quando a guarda recusa", async () => {
    mocks.guard.mockResolvedValueOnce(null);

    const html = renderToStaticMarkup(await Page());

    expect(html).toContain("Acesso negado");
    expect(mocks.preferencia).not.toHaveBeenCalled();
    expect(mocks.fila).not.toHaveBeenCalled();
    expect(mocks.informes).not.toHaveBeenCalled();
  });
});
