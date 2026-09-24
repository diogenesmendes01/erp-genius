import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BASE_BOTAO, Botao, TAMANHOS_BOTAO, VARIANTES_BOTAO, botaoClasses } from "./Botao";

describe("Botao (E1)", () => {
  it("base: alinhamento do ícone, alvo de toque no celular e estado desabilitado — cada classe prometida", () => {
    expect(BASE_BOTAO.split(" ")).toEqual([
      "inline-flex", "items-center", "justify-center", "gap-1.5", "rounded-md", "font-medium", "transition", "max-sm:min-h-10",
      "disabled:cursor-not-allowed", "disabled:opacity-60",
    ]);
  });

  it("variantes e tamanhos exatos (só tokens, sem sombra nem cor crua)", () => {
    expect(VARIANTES_BOTAO).toEqual({
      primario: "bg-brand-solid text-white hover:brightness-95",
      secundario: "border border-gray-300 bg-surface text-gray-700 hover:bg-gray-50",
      perigo: "bg-danger text-white hover:brightness-95",
      fantasma: "text-brand-700 hover:bg-gray-100",
    });
    expect(TAMANHOS_BOTAO).toEqual({ sm: "px-2.5 py-1 text-xs", md: "px-3 py-1.5 text-sm", lg: "px-4 py-2 text-sm" });
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
