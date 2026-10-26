import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PopoverFluxo } from "./PopoverFluxo";
describe("PopoverFluxo", () => {
  it("SSR acessível tem título ligado ao diálogo e conteúdo sem depender de window", () => {
    const html = renderToStaticMarkup(createElement(PopoverFluxo, { titulo: "Transferir", ancora: { current: null }, aoFechar() {} }, createElement("p", null, "Pessoas e equipes")));
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-labelledby=');
    expect(html).toContain("Transferir");
    expect(html).toContain("Pessoas e equipes");
  });
});
