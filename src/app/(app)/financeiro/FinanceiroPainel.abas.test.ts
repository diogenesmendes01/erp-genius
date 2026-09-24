import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import { FinanceiroPainel } from "./FinanceiroPainel";

type Props = Parameters<typeof FinanceiroPainel>[0];
const base: Props = {
  aba: "comissoes", podeConfigurarPoliticas: false, podeAprovar: true, podeOperarCobranca: false, podeGerenciarCambio: false,
  fila: { itens: [], dashs: { aVencer: 0, emAtraso: 0, bloquear: 0, promessas: 0, recebidoHoje: [] }, regua: [] },
  informes: [], politicas: null, retomadas: [], comissoes: [], kpis: { recebidoMes: [], emAtraso: [], aReceber: [], comissoesAPagar: [], novasMatriculas: 0 },
  aprovacoes: [], cotacoes: [], relatorio: null, configFinanceiro: { fechamentoComissaoAutomatico: false },
};

describe("barra de abas do financeiro", () => {
  it("cada aba é um link para ?aba= e só a ativa leva aria-current", () => {
    const html = renderToStaticMarkup(createElement(FinanceiroPainel, base));
    const links = [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g)].map((m) => [m[1], m[2]]);
    expect(links).toEqual([
      ["/financeiro?aba=comissoes", "Comissões"],
      ["/financeiro?aba=descontos", "Descontos"],
      ["/financeiro?aba=aprovacoes", "Aprovações"],
    ]);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*>Comissões<\/a>|<a[^>]*href="\/financeiro\?aba=comissoes"[^>]*aria-current="page"/);
    expect(html).toContain('aria-label="Seções do financeiro"');
  });

  it("as contagens das filas pendentes aparecem no rótulo", () => {
    const html = renderToStaticMarkup(createElement(FinanceiroPainel, {
      ...base, aba: "cobrancas", podeOperarCobranca: true,
      informes: [{} as Props["informes"][number], {} as Props["informes"][number]],
      aprovacoes: [{} as Props["aprovacoes"][number]],
    }));
    expect(html).toContain(">A conferir (2)<");
    expect(html).toContain(">Retomadas (0)<");
    expect(html).toContain(">Aprovações (1)<");
  });
});
