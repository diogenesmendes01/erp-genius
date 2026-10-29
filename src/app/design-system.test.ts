import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import config from "../../tailwind.config";
import postcss from "postcss";
import tailwind from "tailwindcss";
import { BadgeEstado, CLASSES_TOM, PONTO_TOM, TEXTO_TOM, type PropsBadgeEstado, type TomEstado } from "@/components/BadgeEstado";
import { CONTROLE_CAMPO } from "@/components/Campo";
import { EstadoVazio, EstadoVazioLinha } from "@/components/EstadoVazio";
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

const TONS: TomEstado[] = [
  "brand", "humano", "sucesso", "aviso", "aprovacao", "sem-resposta",
  "perigo", "handoff", "atraso", "ia", "frio", "neutro",
];
const CORES = (config.theme?.extend?.colors ?? {}) as Record<string, Record<string, string>>;
const PARES_FAMILIA = {
  brand: { bg: "bg-[var(--brand-soft)]", text: "text-[var(--brand-text)]", soft: "--brand-soft", tokenText: "--brand-text" },
  warning: { bg: "bg-[var(--warning-soft)]", text: "text-[var(--warning-text)]", soft: "--warning-soft", tokenText: "--warning-text" },
  danger: { bg: "bg-[var(--danger-soft)]", text: "text-[var(--danger-text)]", soft: "--danger-soft", tokenText: "--danger-text" },
  info: { bg: "bg-[var(--info-soft)]", text: "text-[var(--info-text)]", soft: "--info-soft", tokenText: "--info-text" },
} as const;

describe("design system: primitivos da fundação", () => {
  it("EstadoVazio não emite border-gray-300 em nenhuma variante", () => {
    const compacto = renderToStaticMarkup(EstadoVazio({ children: "Nada." }));
    const bloco = renderToStaticMarkup(EstadoVazio({ bloco: true, children: "Nada." }));
    const linha = renderToStaticMarkup(createElement("table", null, createElement("tbody", null, EstadoVazioLinha({ colSpan: 1, children: "Nada." }))));
    for (const html of [compacto, bloco, linha]) expect(html).not.toContain("border-gray-300");
    expect(compacto).not.toContain("border-dashed");
    expect(bloco).toContain("border-gray-200");
    expect(bloco).toContain("border-dashed");
  });

  it("BadgeEstado cobre os 12 tons com pares semânticos de globals.css", () => {
    const familiaDe = (tom: TomEstado) =>
      tom === "brand" || tom === "humano" || tom === "sucesso" ? "brand"
      : tom === "aviso" || tom === "aprovacao" || tom === "sem-resposta" ? "warning"
      : tom === "perigo" || tom === "handoff" || tom === "atraso" ? "danger"
      : tom === "ia" || tom === "frio" ? "info" : "neutro";
    expect(TONS).toHaveLength(12);
    for (const tom of TONS) {
      const html = renderToStaticMarkup(createElement(BadgeEstado, { tom } as PropsBadgeEstado, tom));
      expect(html, tom).toContain(CLASSES_TOM[tom]);
      const familia = familiaDe(tom);
      if (familia === "neutro") continue;
      const par = PARES_FAMILIA[familia];
      expect(CLASSES_TOM[tom], tom).toContain(par.bg);
      expect(CLASSES_TOM[tom], tom).toContain(par.text);
      expect(CSS, par.soft).toContain(par.soft);
      expect(CSS, par.tokenText).toContain(par.tokenText);
      expect(CLASSES_TOM[tom], tom).not.toContain(familia === "brand" ? "--danger-text" : "--brand-text");
    }
    expect(TEXTO_TOM.humano).toBe("text-brand-700");
    expect(CORES.brand["700"]).toBe("var(--brand-text)");
    expect(PONTO_TOM.atraso).toBe("bg-red-600");
    expect(CORES.red["600"]).toBe("var(--danger-text)");
    expect(CSS).toContain("--danger-solid");
    expect(CSS).toContain("--brand-solid");
    expect(PONTO_TOM["sem-resposta"]).toContain("bg-[var(--warning-solid)]");
    expect(CORES.amber["600"]).toBe("var(--warning-text)");
    expect(CSS).toContain("--warning-solid");
    expect(CSS).toContain("--info-solid");
  });

  it("CONTROLE_CAMPO usa borda e superfície do sistema", () => {
    expect(CONTROLE_CAMPO).toContain("border-gray-200");
    expect(CONTROLE_CAMPO).toContain("bg-surface-muted");
    expect(CONTROLE_CAMPO).not.toContain("border-gray-300");
  });
});
