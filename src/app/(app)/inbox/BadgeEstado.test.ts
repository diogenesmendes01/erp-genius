import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BadgeEstado } from "./BadgeEstado";
import type { TomEstado } from "./estado-visual";
const html = (p: Partial<Parameters<typeof BadgeEstado>[0]> = {}) => {
  const { children = "IA atendendo", ...props } = p;
  return renderToStaticMarkup(createElement(BadgeEstado, { tom: "ia", ...props } as Parameters<typeof BadgeEstado>[0], children));
};
describe("BadgeEstado", () => {
  it("ponto padrão e medidas do protótipo", () => {
    const h = html();
    for (const classe of ["bg-ai-50", "text-ai-700", "h-5", "px-[7px]", "gap-[5px]", "rounded-[6px]", "text-[11px]", "font-semibold", "bg-current"]) expect(h).toContain(classe);
  });
  it("setor neutro sem ponto usa peso400; tracejado sem fundo", () => {
    const h = html({ tom: "neutro", ponto: false });
    expect(h).not.toContain("bg-current"); expect(h).not.toContain("font-semibold");
    const t = html({ tom: "neutro", tracejado: true, ponto: false });
    expect(t).toContain("border-dashed"); expect(t).toContain("border-gray-200"); expect(t).not.toContain("bg-surface-muted");
  });
  it.each([["ia", "bg-ai-50", "text-ai-700"], ["aprovacao", "bg-amber-50", "text-amber-700"], ["sem-resposta", "bg-amber-50", "text-amber-700"], ["handoff", "bg-red-50", "text-red-700"], ["atraso", "bg-red-50", "text-red-700"], ["humano", "bg-brand-bg", "text-brand-700"], ["neutro", "bg-surface-muted", "text-gray-600"]])("tom%s usa classes existentes", (tom, fundo, texto) => {
    const h = html({ tom: tom as TomEstado }); expect(h).toContain(fundo); expect(h).toContain(texto);
  });
  it("ícone e texto permanecem visíveis sem ponto", () => {
    const h = html({ ponto: false, children: "Prazo estourado", icone: createElement("svg", { "aria-label": "Relógio" }) });
    expect(h).toContain('aria-label="Relógio"'); expect(h).toContain("Prazo estourado"); expect(h).not.toContain("bg-current");
  });
});
