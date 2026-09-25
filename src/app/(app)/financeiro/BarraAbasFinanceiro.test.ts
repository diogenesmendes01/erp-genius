import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const caminho = vi.hoisted(() => ({ valor: "/financeiro/comissoes" }));
vi.mock("next/navigation", () => ({ usePathname: () => caminho.valor }));

import { BarraAbasFinanceiro } from "./BarraAbasFinanceiro";

const render = (abas: Parameters<typeof BarraAbasFinanceiro>[0]["abas"], contagem = {}, c = "/financeiro/comissoes") => {
  caminho.valor = c;
  return renderToStaticMarkup(createElement(BarraAbasFinanceiro, { abas, contagem }));
};

describe("barra de abas do financeiro (E8: uma rota por aba)", () => {
  it("cada aba é um link para a sua rota e só a ativa (pelo caminho) leva aria-current", () => {
    const html = render(["comissoes", "descontos", "aprovacoes"]);
    const links = [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g)].map((m) => [m[1], m[2]]);
    expect(links).toEqual([
      ["/financeiro/comissoes", "Comissões"],
      ["/financeiro/descontos", "Descontos"],
      ["/financeiro/aprovacoes", "Aprovações"],
    ]);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/<a(?=[^>]*href="\/financeiro\/comissoes")(?=[^>]*aria-current="page")[^>]*>/);
    expect(html).toContain('aria-label="Seções do financeiro"');
  });

  it("a aba ativa segue o caminho (inclusive subcaminho da aba); fora das abas, nenhuma ativa", () => {
    expect(render(["cobrancas", "comissoes"], {}, "/financeiro/cobrancas")).toMatch(/<a(?=[^>]*href="\/financeiro\/cobrancas")(?=[^>]*aria-current="page")/);
    expect(render(["cobrancas", "comissoes"], {}, "/financeiro/permuta")).not.toContain('aria-current="page"');
  });

  it("as contagens das filas pendentes aparecem no rótulo", () => {
    const html = render(["cobrancas", "informes", "retomadas", "aprovacoes"], { informes: 2, retomadas: 0, aprovacoes: 1 }, "/financeiro/cobrancas");
    expect(html).toContain(">A conferir (2)<");
    expect(html).toContain(">Retomadas (0)<");
    expect(html).toContain(">Aprovações (1)<");
    expect(render(["aprovacoes"], { aprovacoes: 0 })).toContain(">Aprovações<");
  });
});
