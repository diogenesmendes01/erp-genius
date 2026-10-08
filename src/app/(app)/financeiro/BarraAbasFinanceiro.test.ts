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
    // Subcaminho da aba (ex.: um detalhe futuro sob a aba) mantém a aba ativa.
    expect(render(["cobrancas", "comissoes"], {}, "/financeiro/cobrancas/detalhe")).toMatch(/<a(?=[^>]*href="\/financeiro\/cobrancas")(?=[^>]*aria-current="page")/);
    // Prefixo de texto não é subcaminho: /financeiro/cobrancasx não ativa Cobranças.
    expect(render(["cobrancas", "comissoes"], {}, "/financeiro/cobrancasx")).not.toContain('aria-current="page"');
    expect(render(["cobrancas", "comissoes"], {}, "/financeiro/permuta")).not.toContain('aria-current="page"');
  });

  it("aba ativa: fundo bg-brand-solid com texto branco; nunca bg-brand-500/600, que clareia no escuro (docs/43 §6 item 5)", () => {
    const html = render(["comissoes", "descontos"]);
    const classeDe = (href: string) => html.match(new RegExp(`<a(?=[^>]*\\shref="${href}")[^>]*\\sclass="([^"]*)"`))?.[1].split(" ") ?? [];
    expect(classeDe("/financeiro/comissoes")).toEqual(expect.arrayContaining(["bg-brand-solid", "font-medium", "text-white"]));
    expect(classeDe("/financeiro/descontos")).toEqual(expect.arrayContaining(["text-gray-600"]));
    expect(classeDe("/financeiro/descontos")).not.toContain("bg-brand-solid");
    expect(classeDe("/financeiro/descontos")).not.toContain("text-white");
    expect(html).not.toMatch(/bg-brand-(?:500|600)/);
  });

  it("as contagens das filas pendentes aparecem no rótulo", () => {
    const html = render(["cobrancas", "informes", "retomadas", "aprovacoes"], { informes: 2, retomadas: 0, aprovacoes: 1 }, "/financeiro/cobrancas");
    expect(html).toContain(">A conferir (2)<");
    expect(html).toContain(">Retomadas (0)<");
    expect(html).toContain(">Aprovações (1)<");
    expect(render(["aprovacoes"], { aprovacoes: 0 })).toContain(">Aprovações<");
  });
});
