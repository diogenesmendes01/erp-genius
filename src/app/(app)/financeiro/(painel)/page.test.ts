import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

// /financeiro por rota (E8): índice → aba padrão; layout com a barra e as contagens; cada aba com o
// PRÓPRIO guard antes das consultas e só as consultas dela.
const mocks = vi.hoisted(() => ({
  guard: vi.fn(), preferencia: vi.fn(), fila: vi.fn(), comissoes: vi.fn(), totais: vi.fn(), kpis: vi.fn(),
  aprovacoes: vi.fn(), cotacoes: vi.fn(), relatorio: vi.fn(), informes: vi.fn(), politicas: vi.fn(), retomadas: vi.fn(), configFinanceiro: vi.fn(),
  podeConfigurar: vi.fn(),
  redirect: vi.fn((d: string) => { throw new Error(`REDIRECT ${d}`); }),
  componente: vi.fn(),
}));
/** Cada componente de aba vira um marcador com o nome e o fuso recebido (hoisted: usado nos vi.mock). */
const { marcador } = vi.hoisted(() => ({
  marcador: (nome: string) => (props: { preferenciaFusoExibicao?: string | null }) => `[${nome}|${props.preferenciaFusoExibicao ?? "UTC"}]`,
}));

vi.mock("@/lib/guards", () => ({ exigirPapelLeitura: mocks.guard }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/components/AcessoNegado", () => ({ AcessoNegado: () => createElement("p", null, "Acesso negado") }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/cobrancas/consultas", () => ({ listarFilaCobranca: mocks.fila }));
vi.mock("@/server/ajustes/consultas", () => ({ listarAprovacoesPendentes: mocks.aprovacoes }));
vi.mock("@/server/retomada/consultas", () => ({ listarPropostasRetomada: mocks.retomadas }));
vi.mock("@/server/financeiro/consultas", () => ({
  COMISSOES_POR_PAGINA: 50, listarComissoesPagina: mocks.comissoes, totaisComissoesAPagar: mocks.totais,
  kpisFinanceiro: mocks.kpis, dadosCambio: mocks.cotacoes,
  relatorioDescontosComissoes: mocks.relatorio, listarInformesPagamento: mocks.informes,
  configuracaoComissoes: mocks.politicas, carregarConfigFinanceiro: mocks.configFinanceiro,
  podeConfigurarComissoes: mocks.podeConfigurar,
}));
vi.mock("../FilaCobranca", () => ({ FilaCobranca: marcador("fila") }));
vi.mock("../InformesPagamento", () => ({ InformesPagamento: marcador("informes") }));
vi.mock("../RetomadasPainel", () => ({ RetomadasPainel: marcador("retomadas") }));
vi.mock("../PoliticasComissao", () => ({ PoliticasComissao: marcador("politicas") }));
vi.mock("../FinanceiroPainel", () => ({
  ComissoesAba: (props: { preferenciaFusoExibicao?: string | null }) => { mocks.componente(props); return marcador("comissoes")(props); },
  Descontos: marcador("descontos"), GeralAba: marcador("geral"),
  AprovacoesAba: marcador("aprovacoes"), CambioAba: marcador("cambio"),
}));
vi.mock("../BarraAbasFinanceiro", () => ({
  BarraAbasFinanceiro: (props: { abas: string[]; contagem: Record<string, number> }) =>
    createElement("nav", { "data-abas": props.abas.join(","), "data-contagem": JSON.stringify(props.contagem) }),
}));

import Indice from "./page";
import Layout from "./layout";
import Cobrancas from "./cobrancas/page";
import Informes from "./informes/page";
import Retomadas from "./retomadas/page";
import ComissoesPagina from "./comissoes/page";
import Descontos from "./descontos/page";
import Geral from "./geral/page";
import Politicas from "./politicas/page";
import Aprovacoes from "./aprovacoes/page";
import Cambio from "./cambio/page";

const html = async (el: Promise<React.ReactElement | null>) => renderToStaticMarkup((await el) ?? createElement("span"));
/** A aba de comissões lê situação e página da URL (E4); sem parâmetros, a primeira página. */
const Comissoes = (parametros: Record<string, string> = {}) => ComissoesPagina({ searchParams: Promise.resolve(parametros) });
/** Consultas pesadas, cada uma só da sua aba. */
const pesadas = () => ({
  fila: mocks.fila.mock.calls.length, comissoes: mocks.comissoes.mock.calls.length, totais: mocks.totais.mock.calls.length, kpis: mocks.kpis.mock.calls.length,
  cotacoes: mocks.cotacoes.mock.calls.length, relatorio: mocks.relatorio.mock.calls.length, politicas: mocks.politicas.mock.calls.length,
  configFinanceiro: mocks.configFinanceiro.mock.calls.length,
});
const nenhuma = { fila: 0, comissoes: 0, totais: 0, kpis: 0, cotacoes: 0, relatorio: 0, politicas: 0, configFinanceiro: 0 };

describe("/financeiro por rota (E8)", () => {
  beforeEach(() => {
    mocks.guard.mockResolvedValue([Papel.FINANCEIRO]);
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
    mocks.fila.mockResolvedValue({ itens: [], dashs: { aVencer: 0, emAtraso: 0, bloquear: 0, promessas: 0, recebidoHoje: [] }, regua: [] });
    mocks.comissoes.mockResolvedValue({ itens: [], total: 0 }); mocks.totais.mockResolvedValue([]); mocks.kpis.mockResolvedValue({ recebidoMes: [], emAtraso: [], aReceber: [], comissoesAPagar: [], novasMatriculas: 0 });
    mocks.aprovacoes.mockResolvedValue([]); mocks.cotacoes.mockResolvedValue([]); mocks.relatorio.mockResolvedValue({}); mocks.informes.mockResolvedValue([]);
    mocks.politicas.mockResolvedValue({}); mocks.podeConfigurar.mockResolvedValue(false); mocks.retomadas.mockResolvedValue({ ok: true, dado: [] }); mocks.configFinanceiro.mockResolvedValue({ fechamentoComissaoAutomatico: false });
  });
  afterEach(() => vi.clearAllMocks());

  it("índice leva à aba padrão do papel e respeita ?aba= antigo visível — sem consultar dados", async () => {
    await expect(Indice({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT /financeiro/cobrancas");
    await expect(Indice({ searchParams: Promise.resolve({ aba: "geral" }) })).rejects.toThrow("REDIRECT /financeiro/geral");
    await expect(Indice({ searchParams: Promise.resolve({ aba: "politicas" }) })).rejects.toThrow("REDIRECT /financeiro/cobrancas"); // sem permissão
    mocks.guard.mockResolvedValue([Papel.GERENTE_COMERCIAL]);
    await expect(Indice({ searchParams: Promise.resolve({ aba: "cobrancas" }) })).rejects.toThrow("REDIRECT /financeiro/comissoes");
    expect(pesadas()).toEqual(nenhuma);
  });

  it("guard recusa: índice, layout e abas negam sem consultar nada", async () => {
    mocks.guard.mockResolvedValue(null);
    expect(await html(Indice({ searchParams: Promise.resolve({}) }))).toContain("Acesso negado");
    expect(await html(Layout({ children: createElement("p", null, "filho") }))).toContain("Acesso negado");
    for (const aba of [Cobrancas, Informes, Retomadas, Comissoes, Descontos, Geral, Politicas, Aprovacoes, Cambio]) {
      expect(await html(aba())).toContain("Acesso negado");
    }
    expect(mocks.guard).toHaveBeenCalledWith(Papel.FINANCEIRO, Papel.GERENTE_COMERCIAL);
    expect(pesadas()).toEqual(nenhuma);
    expect(mocks.preferencia).not.toHaveBeenCalled();
    expect(mocks.informes).not.toHaveBeenCalled();
  });

  it("layout: barra com as abas do papel e contagens das filas; Financeiro não consulta aprovações", async () => {
    mocks.informes.mockResolvedValue([{}, {}]);
    mocks.retomadas.mockResolvedValue({ ok: true, dado: [{ status: "PENDENTE" }, { status: "APLICADA" }] });
    const pagina = await html(Layout({ children: createElement("p", null, "filho") }));
    expect(pagina).toContain('data-abas="cobrancas,informes,retomadas,comissoes,descontos,geral,cambio"');
    expect(pagina).toContain(`data-contagem="${JSON.stringify({ informes: 2, retomadas: 1, aprovacoes: 0 }).replaceAll('"', "&quot;")}"`);
    expect(pagina).toContain("<p>filho</p>");
    expect(mocks.aprovacoes).not.toHaveBeenCalled();
    expect(pesadas()).toEqual(nenhuma); // o layout não consulta nada das abas
  });

  it("cobranças: só a fila; preferência de fuso entregue", async () => {
    const pagina = await html(Cobrancas());
    expect(pagina).toContain('[fila|');
    expect(pagina).toContain('|America/Costa_Rica]');
    expect(pesadas()).toEqual({ ...nenhuma, fila: 1 });
  });

  it.each([
    ["comissoes", Comissoes, { ...nenhuma, comissoes: 1, totais: 1, configFinanceiro: 1 }],
    ["descontos", Descontos, { ...nenhuma, relatorio: 1 }],
    ["geral", Geral, { ...nenhuma, kpis: 1, cotacoes: 1 }],
    ["cambio", Cambio, { ...nenhuma, cotacoes: 1 }],
  ] as const)("%s consulta só o que a aba mostra", async (nome, Aba, esperado) => {
    expect(await html(Aba())).toContain(`[${nome}|`);
    expect(pesadas()).toEqual(esperado);
  });

  it("comissões (E4): situação e página da URL vão para a consulta paginada; o total a pagar vem do servidor", async () => {
    const itens = Array.from({ length: 50 }, (_, i) => ({ id: `c${i}` }));
    mocks.comissoes.mockResolvedValue({ itens, total: 120 });
    mocks.totais.mockResolvedValue([{ moeda: "CRC", valor: 5000 }]);
    const pagina = await html(Comissoes({ status: "APROVADA", pagina: "2" }));
    expect(mocks.comissoes).toHaveBeenCalledWith({ status: "APROVADA", pagina: 2 });
    expect(pagina).toContain("51–100 de 120 comissões");
    expect(pagina).toContain("/financeiro/comissoes?status=APROVADA&amp;pagina=3");
    expect(pagina).toContain('aria-label="Filtrar por situação"');
    const props = mocks.componente.mock.calls.at(-1)?.[0] as { comissoes: unknown[]; aPagar: unknown };
    expect(props.comissoes).toHaveLength(50);
    expect(props.aPagar).toEqual([{ moeda: "CRC", valor: 5000 }]);
  });

  it("comissões: página além do fim volta para a última, sem perder a situação filtrada", async () => {
    mocks.comissoes.mockResolvedValue({ itens: [], total: 60 });
    await expect(Comissoes({ pagina: "9" })).rejects.toThrow("REDIRECT /financeiro/comissoes?pagina=2");
    await expect(Comissoes({ status: "APROVADA", pagina: "9" })).rejects.toThrow("REDIRECT /financeiro/comissoes?status=APROVADA&pagina=2");
  });

  it("comissões: filtro sem resultado diz que não há nesta situação e oferece ver todas; sem filtro, nada", async () => {
    mocks.comissoes.mockResolvedValue({ itens: [], total: 0 });
    await html(Comissoes({ status: "PAGA" }));
    const comFiltro = renderToStaticMarkup(createElement("div", null, (mocks.componente.mock.calls.at(-1)?.[0] as { vazio: React.ReactNode }).vazio));
    expect(comFiltro).toContain("Nenhuma comissão nesta situação.");
    expect(comFiltro).toContain('href="/financeiro/comissoes"');
    await html(Comissoes());
    expect((mocks.componente.mock.calls.at(-1)?.[0] as { vazio?: unknown }).vazio).toBeUndefined();
  });

  it("informes e retomadas vêm das filas pendentes (uma consulta), com o fuso", async () => {
    expect(await html(Informes())).toContain('[informes|');
    expect(await html(Retomadas())).toContain('|America/Costa_Rica]');
    expect(pesadas()).toEqual(nenhuma);
  });

  it("Gerente pedindo uma aba de cobrança direto: acesso negado, sem consultar a fila nem os informes", async () => {
    mocks.guard.mockResolvedValue([Papel.GERENTE_COMERCIAL]);
    for (const aba of [Cobrancas, Informes, Retomadas, Geral, Cambio]) expect(await html(aba())).toContain("Acesso negado");
    expect(pesadas()).toEqual(nenhuma);
    expect(mocks.informes).not.toHaveBeenCalled();
    expect(await html(Aprovacoes())).toContain('[aprovacoes|'); // Gerente aprova
    expect(mocks.aprovacoes).toHaveBeenCalledTimes(1);
  });

  it("Política de comissão só com permissão; consulta a configuração apenas na própria aba", async () => {
    expect(await html(Politicas())).toContain("Acesso negado");
    expect(mocks.politicas).not.toHaveBeenCalled();
    mocks.podeConfigurar.mockResolvedValue(true);
    expect(await html(Politicas())).toContain('[politicas|');
    expect(mocks.politicas).toHaveBeenCalledTimes(1);
  });

  it("Financeiro não abre Aprovações (não aprova): acesso negado, sem consultar", async () => {
    expect(await html(Aprovacoes())).toContain("Acesso negado");
    expect(mocks.aprovacoes).not.toHaveBeenCalled();
  });
});
