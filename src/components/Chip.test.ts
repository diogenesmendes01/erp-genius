import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Chip } from "./Chip";

const html = (selecionado: boolean, contagem?: number) =>
  renderToStaticMarkup(Chip({ selecionado, onClick: () => {}, contagem, children: "Abertos" }));

describe("Chip", () => {
  it("selecionado usa aria-pressed e accent-soft", () => {
    const h = html(true);
    expect(h).toContain('type="button"');
    expect(h).toContain('aria-pressed="true"');
    expect(h).toContain("bg-brand-bg text-brand-800 border-transparent");
    expect(h).not.toContain("hover:bg-highlight");
  });
  it("não selecionado: texto secundário e hover translúcido", () => {
    const h = html(false);
    expect(h).toContain('aria-pressed="false"');
    expect(h).toContain("text-gray-600 hover:bg-highlight");
  });
  it("classe base: pílula, borda suave e alvo de 44 px no celular", () => {
    const h = html(false);
    for (const c of ["rounded-full", "border", "border-border-soft", "px-3", "text-sm", "max-sm:min-h-11", "min-h-8"]) expect(h).toContain(c);
  });
  it("mostra a contagem quando informada (inclusive zero)", () => {
    expect(html(false, 3)).toContain(">3<");
    expect(html(false, 0)).toContain(">0<");
    expect(html(false)).not.toMatch(/>\d+</);
  });
});
