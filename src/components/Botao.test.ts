import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Botao, botaoClasses } from "./Botao";

describe("Botao (E1)", () => {
  it("toda combinação tem foco visível e estado desabilitado", () => {
    for (const variante of ["primario", "secundario", "perigo", "fantasma"] as const) {
      for (const tamanho of ["sm", "md", "lg"] as const) {
        const c = botaoClasses({ variante, tamanho });
        expect(c, `${variante}/${tamanho}`).toContain("focus-visible:ring-2");
        expect(c).toContain("disabled:opacity-60");
      }
    }
  });

  it("variantes usam os tokens do design system (sem cor crua, sem sombra)", () => {
    expect(botaoClasses()).toContain("bg-brand-solid text-white");
    expect(botaoClasses({ variante: "secundario" })).toContain("border border-gray-300 bg-surface");
    expect(botaoClasses({ variante: "perigo" })).toContain("bg-danger text-white");
    for (const v of ["primario", "secundario", "perigo", "fantasma"] as const) expect(botaoClasses({ variante: v })).not.toMatch(/shadow|bg-white|#[0-9a-f]{3,6}/i);
  });

  it("tamanhos distintos", () => {
    expect(botaoClasses({ tamanho: "sm" })).toContain("px-2.5 py-1 text-xs");
    expect(botaoClasses({ tamanho: "md" })).toContain("px-3 py-1.5 text-sm");
    expect(botaoClasses({ tamanho: "lg" })).toContain("px-4 py-2 text-sm");
  });

  it("<Botao> é type=\"button\" por padrão (submit só quando declarado) e acrescenta className", () => {
    expect(renderToStaticMarkup(createElement(Botao, null, "Ok"))).toMatch(/^<button type="button"/);
    expect(renderToStaticMarkup(createElement(Botao, { type: "submit" }, "Salvar"))).toMatch(/^<button type="submit"/);
    const html = renderToStaticMarkup(createElement(Botao, { variante: "perigo", className: "mt-4", disabled: true }, "Excluir"));
    expect(html).toContain("bg-danger");
    expect(html).toMatch(/class="[^"]* mt-4"/);
    expect(html).toContain('disabled=""');
  });
});
