import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BASE_BOTAO, Botao, TAMANHOS_BOTAO, VARIANTES_BOTAO, botaoClasses } from "./Botao";

describe("Botao (E1)", () => {
  it("base é pílula com 44 px no celular", () => {
    expect(BASE_BOTAO).toContain("rounded-full");
    expect(BASE_BOTAO).toContain("max-sm:min-h-11");
    expect(BASE_BOTAO).not.toContain("rounded-md");
    expect(BASE_BOTAO).toBe(
      "inline-flex items-center justify-center gap-2 rounded-full font-medium transition max-sm:min-h-11 " +
        "aria-busy:cursor-progress disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-disabled disabled:border-gray-200",
    );
  });

  it("disabled não usa opacidade", () => {
    expect(BASE_BOTAO).toContain("disabled:text-disabled");
    expect(BASE_BOTAO).not.toContain("opacity-60");
  });

  it("ocupado marca aria-busy e desabilita", () => {
    const html = renderToStaticMarkup(createElement(Botao, { ocupado: true }, "Salvar"));
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled=""');
    expect(renderToStaticMarkup(createElement(Botao, null, "Salvar"))).not.toContain('aria-busy="');
  });

  it("secundário sem fundo e com hover highlight", () => {
    expect(VARIANTES_BOTAO.secundario).toBe("border border-border-soft bg-transparent text-brand-700 hover:bg-highlight");
    expect(VARIANTES_BOTAO.secundario).not.toContain("bg-surface");
  });

  it("variantes e tamanhos exatos (só tokens, sem sombra nem cor crua)", () => {
    expect(VARIANTES_BOTAO).toEqual({
      primario: "bg-brand-solid text-on-brand hover:brightness-95",
      secundario: "border border-border-soft bg-transparent text-brand-700 hover:bg-highlight",
      perigo: "bg-danger text-white hover:brightness-95",
      fantasma: "text-brand-700 hover:bg-highlight",
    });
    expect(TAMANHOS_BOTAO).toEqual({ sm: "px-3 py-1 text-xs", md: "px-4 py-1.5 text-sm", lg: "px-[22px] py-2.5 text-sm" });
  });

  it("padrão = primário md; a combinação é base + variante + tamanho", () => {
    expect(botaoClasses()).toBe(botaoClasses({ variante: "primario", tamanho: "md" }));
    expect(botaoClasses({ variante: "fantasma", tamanho: "lg" })).toBe(`${BASE_BOTAO} ${VARIANTES_BOTAO.fantasma} ${TAMANHOS_BOTAO.lg}`);
  });

  it("não anula o indicador de foco global do app (sem outline-none, sem anel próprio com halo)", () => {
    for (const v of ["primario", "secundario", "perigo", "fantasma"] as const) {
      const c = botaoClasses({ variante: v });
      expect(c).not.toMatch(/outline-none|ring-/);
    }
    // O indicador que vale é o global, para todo <button>.
    const css = readFileSync("src/app/globals.css", "utf-8");
    expect(css).toMatch(/button:focus-visible[\s\S]*?outline: 2px solid var\(--brand\)/);
  });

  it("<Botao> é type=\"button\" por padrão (submit só quando declarado), acrescenta className e encaminha ref", () => {
    expect(renderToStaticMarkup(createElement(Botao, null, "Ok"))).toMatch(/^<button type="button"/);
    expect(renderToStaticMarkup(createElement(Botao, { type: "submit" }, "Salvar"))).toMatch(/^<button type="submit"/);
    const html = renderToStaticMarkup(createElement(Botao, { variante: "perigo", className: "mt-4", disabled: true }, "Excluir"));
    expect(html).toContain("bg-danger");
    expect(html).toMatch(/class="[^"]* mt-4"/);
    expect(html).toContain('disabled=""');
    expect((Botao as unknown as { render?: unknown }).render).toBeTypeOf("function"); // forwardRef
  });
});
