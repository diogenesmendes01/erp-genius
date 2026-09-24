import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  guard: vi.fn(), preferencia: vi.fn(), fila: vi.fn(), comissoes: vi.fn(), kpis: vi.fn(),
  aprovacoes: vi.fn(), cotacoes: vi.fn(), relatorio: vi.fn(), informes: vi.fn(), politicas: vi.fn(), retomadas: vi.fn(), configFinanceiro: vi.fn(),
  podeConfigurar: vi.fn(), painel: vi.fn(),
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
  podeConfigurarComissoes: mocks.podeConfigurar,
}));
vi.mock("../FinanceiroPainel", () => ({
  FinanceiroPainel: (props: { preferenciaFusoExibicao: string | null; aba: string }) => {
    mocks.painel(props);
    return createElement("div", { "data-fuso": props.preferenciaFusoExibicao ?? "UTC", "data-aba": props.aba });
  },
}));

import Page from "./page";

const pagina = (aba?: string) => Page({ searchParams: Promise.resolve(aba === undefined ? {} : { aba }) });
/** Consultas pesadas, cada uma só da sua aba. */
const pesadas = () => ({
  fila: mocks.fila.mock.calls.length, comissoes: mocks.comissoes.mock.calls.length, kpis: mocks.kpis.mock.calls.length,
  cotacoes: mocks.cotacoes.mock.calls.length, relatorio: mocks.relatorio.mock.calls.length, politicas: mocks.politicas.mock.calls.length,
  configFinanceiro: mocks.configFinanceiro.mock.calls.length,
});

describe("FinanceiroPage", () => {
  beforeEach(() => {
    mocks.guard.mockResolvedValue([Papel.FINANCEIRO]);
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
    mocks.fila.mockResolvedValue({ itens: [], dashs: { aVencer: 0, emAtraso: 0, bloquear: 0, promessas: 0, recebidoHoje: [] }, regua: [] });
    mocks.comissoes.mockResolvedValue([]); mocks.kpis.mockResolvedValue({ recebidoMes: [], emAtraso: [], aReceber: [], comissoesAPagar: [], novasMatriculas: 0 });
    mocks.aprovacoes.mockResolvedValue([]); mocks.cotacoes.mockResolvedValue([]); mocks.relatorio.mockResolvedValue({}); mocks.informes.mockResolvedValue([]);
    mocks.politicas.mockResolvedValue(null); mocks.podeConfigurar.mockResolvedValue(false); mocks.retomadas.mockResolvedValue({ ok: true, dado: [] }); mocks.configFinanceiro.mockResolvedValue({ fechamentoComissaoAutomatico: false });
  });

  afterEach(() => vi.clearAllMocks());

  it("lê a preferência depois da guarda e a entrega à fila e aos informes", async () => {
    const html = renderToStaticMarkup(await pagina());

    expect(mocks.guard).toHaveBeenCalledWith(Papel.FINANCEIRO, Papel.GERENTE_COMERCIAL);
    expect(mocks.preferencia).toHaveBeenCalledTimes(1);
    expect(html).toContain('data-fuso="America/Costa_Rica"');
  });

  it("não consulta preferência nem dados financeiros quando a guarda recusa", async () => {
    mocks.guard.mockResolvedValueOnce(null);

    const html = renderToStaticMarkup(await pagina());

    expect(html).toContain("Acesso negado");
    expect(mocks.preferencia).not.toHaveBeenCalled();
    expect(mocks.fila).not.toHaveBeenCalled();
    expect(mocks.informes).not.toHaveBeenCalled();
  });

  it("sem ?aba=, Financeiro abre em Cobranças e consulta só a fila (mais as filas pendentes das contagens)", async () => {
    const html = renderToStaticMarkup(await pagina());
    expect(html).toContain('data-aba="cobrancas"');
    expect(pesadas()).toEqual({ fila: 1, comissoes: 0, kpis: 0, cotacoes: 0, relatorio: 0, politicas: 0, configFinanceiro: 0 });
    expect(mocks.informes).toHaveBeenCalledTimes(1);
    expect(mocks.retomadas).toHaveBeenCalledTimes(1);
    expect(mocks.aprovacoes).not.toHaveBeenCalled(); // Financeiro não aprova: nem a contagem é consultada
  });

  it.each([
    ["comissoes", { fila: 0, comissoes: 1, kpis: 0, cotacoes: 0, relatorio: 0, politicas: 0, configFinanceiro: 1 }],
    ["descontos", { fila: 0, comissoes: 0, kpis: 0, cotacoes: 0, relatorio: 1, politicas: 0, configFinanceiro: 0 }],
    ["geral", { fila: 0, comissoes: 0, kpis: 1, cotacoes: 1, relatorio: 0, politicas: 0, configFinanceiro: 0 }],
    ["cambio", { fila: 0, comissoes: 0, kpis: 0, cotacoes: 1, relatorio: 0, politicas: 0, configFinanceiro: 0 }],
  ])("?aba=%s consulta só o que a aba mostra", async (aba, esperado) => {
    const html = renderToStaticMarkup(await pagina(aba));
    expect(html).toContain(`data-aba="${aba}"`);
    expect(pesadas()).toEqual(esperado);
  });

  it("Política de comissão só com permissão; consulta a configuração apenas na própria aba", async () => {
    mocks.podeConfigurar.mockResolvedValue(true);
    renderToStaticMarkup(await pagina("politicas"));
    expect(mocks.politicas).toHaveBeenCalledTimes(1);
    expect(mocks.painel).toHaveBeenLastCalledWith(expect.objectContaining({ aba: "politicas", podeConfigurarPoliticas: true }));
  });

  it("aba proibida para o papel cai na padrão sem disparar a consulta dela (Gerente pedindo Cobranças)", async () => {
    mocks.guard.mockResolvedValue([Papel.GERENTE_COMERCIAL]);
    const html = renderToStaticMarkup(await pagina("cobrancas"));
    expect(html).toContain('data-aba="comissoes"');
    expect(mocks.fila).not.toHaveBeenCalled();
    expect(mocks.informes).not.toHaveBeenCalled();
    expect(mocks.aprovacoes).toHaveBeenCalledTimes(1); // Gerente aprova: a contagem da aba aparece
  });

  it("aba sem permissão de configuração também cai na padrão (Financeiro pedindo Política)", async () => {
    const html = renderToStaticMarkup(await pagina("politicas"));
    expect(html).toContain('data-aba="cobrancas"');
    expect(mocks.politicas).not.toHaveBeenCalled();
  });
});
