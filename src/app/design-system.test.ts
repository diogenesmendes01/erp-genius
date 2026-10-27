import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import config from "../../tailwind.config";
import postcss from "postcss";
import tailwind from "tailwindcss";
import { paresTexto, reprovados, reprovadosSolidos } from "./contraste-nucleo";

const CSS = readFileSync("src/app/globals.css", "utf-8").replace(/\r\n/g, "\n");

describe("design system: tokens nos dois temas", () => {
  it("texto sobre cada sólido ≥ 4,5:1 com o par do mapa", () => {
    expect(reprovadosSolidos()).toEqual([]);
  });

  it("placeholder ≥ 4,5:1 sobre controle e página", () => {
    expect(reprovados(paresTexto("--text-terciary", ["--surface-muted", "--bg-page", "--surface"], 4.5))).toEqual([]);
  });

  it("--brand-text ≥ 4,5:1 sobre página e cartão", () => {
    expect(reprovados(paresTexto("--brand-text", ["--bg-page", "--surface"], 4.5))).toEqual([]);
  });

  it("utilitários novos geram CSS quando há consumidores explícitos", async () => {
    const classes = ["fundo-conversa", "bg-bubble-ia", "bg-bubble-note", "font-mono", ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `bg-avatar-${n}`)];
    const resultado = await postcss([tailwind({ ...config, content: [{ raw: `<div class="${classes.join(" ")}"></div>`, extension: "html" }] })]).process(CSS, { from: undefined });
    const regras = new Map<string, Map<string, string>>();
    resultado.root.walkRules((regra) => {
      const valores = new Map<string, string>();
      regra.walkDecls((d) => { valores.set(d.prop, d.value); });
      regras.set(regra.selector, valores);
    });
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) expect(regras.get(`.bg-avatar-${n}`)?.get("background-color")).toBe(`var(--avatar-${n})`);
    for (const nome of ["ia", "note"]) expect(regras.get(`.bg-bubble-${nome}`)?.get("background-color")).toBe(`var(--bubble-${nome})`);
    expect(regras.get(".font-mono")?.get("font-family")).toContain("var(--font-mono)");
    expect(regras.get(".fundo-conversa")?.get("background-image")).toBe("radial-gradient(var(--chat-dot) 1px, transparent 1px)");
    expect(regras.get(".fundo-conversa")?.get("background-size")).toBe("18px 18px");
  });
});
