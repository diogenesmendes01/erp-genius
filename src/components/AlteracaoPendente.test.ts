import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AlteracaoPendente } from "./AlteracaoPendente";

describe("AlteracaoPendente", () => {
  it("sem alteração: a região existe e está vazia", () => {
    const html = renderToStaticMarkup(createElement(AlteracaoPendente, { sujo: false }));
    expect(html).toMatch(/^<p role="status"[^>]*><\/p>$/);
  });

  it("com alteração: anuncia \"Alterações não salvas\"", () => {
    const html = renderToStaticMarkup(createElement(AlteracaoPendente, { sujo: true }));
    expect(html).toMatch(/^<p role="status"[^>]*>.*Alterações não salvas<\/p>$/);
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
  });
});
