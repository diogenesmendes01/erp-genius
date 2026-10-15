import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import config from "../../tailwind.config";
import { TEXTO_SOBRE_SOLIDO } from "./contraste-mapa";
import { paresTexto, reprovados, reprovadosSolidos, temasDoCss } from "./contraste-nucleo";

// Tokens do design system (docs/planejamento/design-system-referencia.md; tabela "Tokens" do plano da Fase 0).
// Valores R são literais do spec; os A são adaptações com o motivo em docs/18-design-system.md. O escuro herda
// do claro o que não redefine (--shadow-dialog, --ai-border do claro não, etc.), como no navegador.

const CSS = readFileSync("src/app/globals.css", "utf-8");

const ESPERADO = {
  claro: {
    "--bg-page": "#f7f5f3",
    "--surface": "#ffffff",
    "--surface-muted": "#f7f5f3",
    "--surface-raised": "#ffffff",
    "--neutral-muted": "#ededed",
    "--highlight": "rgba(194, 189, 184, 0.15)",
    "--pressed": "rgba(0, 0, 0, 0.2)",
    "--border": "rgba(0, 0, 0, 0.1)",
    "--border-soft": "rgba(0, 0, 0, 0.2)",
    "--border-control": "#858383",
    "--text-primary": "#0a0a0a",
    "--text-secondary": "rgba(0, 0, 0, 0.6)",
    "--text-terciary": "#6d6c64",
    "--text-disabled": "#bdbdbd",
    "--brand": "#1daa61",
    "--brand-text": "#15603e",
    "--brand-bg": "#d9fdd3",
    "--brand-strong": "#15603e",
    "--brand-border": "#b7ebc0",
    "--brand-solid": "#1b8755",
    "--on-brand-solid": "#ffffff",
    "--success-bg": "#d9fdd3",
    "--success-text": "#15603e",
    "--success-solid": "#1b8755",
    "--warning-bg": "#fff7e5",
    "--warning-text": "#7a4f00",
    "--danger-bg": "#fde8eb",
    "--danger-text": "#b3002b",
    "--danger-solid": "#ea0038",
    "--info-bg": "#e6f1fb",
    "--info-text": "#0064d1",
    "--ai-bg": "#f2f0f9",
    "--ai-text": "#6a53bd",
    "--ai-solid": "#6a53bd",
    "--cold-text": "#007daa",
    "--entry": "#ffffff",
    "--entry-accent": "#d9fdd3",
    "--composer": "#ffffff",
    "--shadow-popover": "0 5px 20px #0002",
    "--shadow-dialog": "0 15px 60px #0006",
  },
  escuro: {
    "--bg-page": "#161717",
    "--surface": "#161717",
    "--surface-muted": "#1d1f1f",
    "--surface-raised": "#1d1f1f",
    "--neutral-muted": "#2a2c2c",
    "--highlight": "rgba(255, 255, 255, 0.1)",
    "--pressed": "rgba(255, 255, 255, 0.2)",
    "--border": "rgba(255, 255, 255, 0.1)",
    "--border-soft": "rgba(255, 255, 255, 0.1)",
    "--border-control": "#757778",
    "--text-primary": "#fafafa",
    "--text-secondary": "rgba(255, 255, 255, 0.6)",
    "--text-terciary": "#8f9192",
    "--text-disabled": "#424445",
    "--brand": "#21c063",
    "--brand-text": "#21c063",
    "--brand-bg": "#103529",
    "--brand-strong": "#d9fdd3",
    "--brand-border": "#1e5c40",
    "--brand-solid": "#21c063",
    "--on-brand-solid": "#0a0a0a",
    "--success-bg": "#103529",
    "--success-text": "#71eb85",
    "--success-solid": "#21c063",
    "--warning-bg": "#362c1f",
    "--warning-text": "#ffd279",
    "--danger-bg": "#321622",
    "--danger-text": "#fb5061",
    "--danger-solid": "#c4002f",
    "--info-bg": "#10283a",
    "--info-text": "#53bdeb",
    "--ai-bg": "#2b2a37",
    "--ai-text": "#ad9ffa",
    "--ai-solid": "#6a53bd",
    "--cold-text": "#5bb0d7",
    "--entry": "#242626",
    "--entry-accent": "#144d37",
    "--composer": "#242626",
    "--shadow-popover": "0 6px 24px #0006",
    "--shadow-dialog": "0 15px 60px #0006",
  },
} as const;

describe("design system: tokens nos dois temas", () => {
  it("tokens do design system nos dois temas", () => {
    const temas = temasDoCss(CSS);
    for (const tema of ["claro", "escuro"] as const) {
      const lidos = Object.fromEntries(Object.keys(ESPERADO[tema]).map((k) => [k, temas[tema][k]?.toLowerCase()]));
      expect(lidos, tema).toEqual(ESPERADO[tema]);
    }
  });

  it("texto sobre cada sólido ≥ 4,5:1 com o par do mapa", () => {
    expect(TEXTO_SOBRE_SOLIDO).toEqual({ "--brand-solid": "--on-brand-solid", "--success-solid": "--on-brand-solid", "--danger-solid": "white", "--ai-solid": "white" });
    expect(reprovadosSolidos()).toEqual([]);
  });

  it("placeholder ≥ 4,5:1 sobre controle e página", () => {
    expect(reprovados(paresTexto("--text-terciary", ["--surface-muted", "--bg-page", "--surface"], 4.5))).toEqual([]);
  });

  it("--brand-text ≥ 4,5:1 sobre página e cartão", () => {
    expect(reprovados(paresTexto("--brand-text", ["--bg-page", "--surface"], 4.5))).toEqual([]);
  });

  it("autoteste: o texto errado sobre o sólido reprova (branco sobre o verde do escuro)", () => {
    const css = CSS.replace(/(\.dark \{[\s\S]*?--on-brand-solid:\s*)#0a0a0a/, "$1#ffffff");
    expect(css).not.toBe(CSS);
    expect(reprovadosSolidos(css).length).toBeGreaterThan(0);
  });

  it("tailwind mapeia as cores novas", () => {
    const c = config.theme!.extend!.colors as Record<string, unknown>;
    expect(c["on-brand"]).toBe("var(--on-brand-solid)");
    expect(c["surface-raised"]).toBe("var(--surface-raised)");
    expect(c.highlight).toBe("var(--highlight)");
    expect(c.pressed).toBe("var(--pressed)");
    expect(c["border-soft"]).toBe("var(--border-soft)");
    expect(c.disabled).toBe("var(--text-disabled)");
    expect(c.entry).toBe("var(--entry)");
    expect(c["entry-accent"]).toBe("var(--entry-accent)");
    expect(c.composer).toBe("var(--composer)");
    expect((c.brand as Record<string, string>)["800"]).toBe("var(--brand-strong)");
    expect(c.cold).toEqual({ 700: "var(--cold-text)" });
  });

  it("raios, sombras e fonte do design system", () => {
    const ext = config.theme!.extend!;
    expect(ext.borderRadius).toMatchObject({ md: "8px", item: "10px", lg: "12px", xl: "12px", dialog: "14px" });
    expect(ext.boxShadow).toEqual({ popover: "var(--shadow-popover)", dialog: "var(--shadow-dialog)" });
    expect(ext.fontFamily).toEqual({ sans: ["var(--font-sans)", "Segoe UI", "Roboto", "system-ui", "sans-serif"] });
  });

  it("nenhum asset ou ícone do WhatsApp", () => {
    const proibido = /IconBrandWhatsapp|whatsapp[-_]?(logo|wallpaper)|wallpaper-(light|dark)/i;
    const ofensores: string[] = [];
    for (const raiz of ["src", "public"]) {
      let arquivos: string[] = [];
      try { arquivos = readdirSync(raiz, { recursive: true }) as string[]; } catch { continue; }
      for (const f of arquivos) {
        const caminho = join(raiz, f);
        if (proibido.test(f) && !/\.test\.tsx?$/.test(f)) ofensores.push(caminho);
        else if (/\.(tsx?|css|svg|json)$/.test(f) && !/\.test\.tsx?$/.test(f) && proibido.test(readFileSync(caminho, "utf-8"))) ofensores.push(caminho);
      }
    }
    expect(ofensores).toEqual([]);
  });

  it("globals desliga animação em reduced-motion", () => {
    const bloco = CSS.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([^}]*\{[^}]*\})\s*\}/);
    expect(bloco, "falta o @media (prefers-reduced-motion: reduce)").not.toBeNull();
    const corpo = bloco![1].replace(/\s+/g, " ");
    expect(corpo).toContain("*, *::before, *::after");
    for (const d of ["animation: none !important", "transition: none !important", "scroll-behavior: auto !important"]) expect(corpo).toContain(d);
  });
});
