import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import config from "../../tailwind.config";
import postcss from "postcss";
import tailwind from "tailwindcss";
import { TEXTO_SOBRE_SOLIDO } from "./contraste-mapa";
import { paresTexto, reprovados, reprovadosSolidos, temasDoCss } from "./contraste-nucleo";

// Tokens do design system (docs/planejamento/design-system-referencia.md; tabela "Tokens" do plano da Fase 0).
// Valores R são literais do spec; os A são adaptações com o motivo em docs/18-design-system.md. O escuro herda
// do claro o que não redefine (--shadow-dialog, --ai-border do claro não, etc.), como no navegador.

const CSS = readFileSync("src/app/globals.css", "utf-8").replace(/\r\n/g, "\n");

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
    "--avatar-1": "#007c9b",
    "--avatar-2": "#a5524d",
    "--avatar-3": "#0f825e",
    "--avatar-4": "#6e62aa",
    "--avatar-5": "#93640c",
    "--avatar-6": "#985383",
    "--avatar-7": "#677823",
    "--avatar-8": "#008188",
    "--bubble-ia": "#efebfa",
    "--bubble-note": "#fff7e5",
    "--chat-dot": "rgba(0, 0, 0, 0.035)",
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
    "--avatar-1": "#007c9b",
    "--avatar-2": "#a5524d",
    "--avatar-3": "#0f825e",
    "--avatar-4": "#6e62aa",
    "--avatar-5": "#93640c",
    "--avatar-6": "#985383",
    "--avatar-7": "#677823",
    "--avatar-8": "#008188",
    "--bubble-ia": "#2b2a37",
    "--bubble-note": "#3a3020",
    "--chat-dot": "rgba(255, 255, 255, 0.035)",
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
    const avatares = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`--avatar-${n}`, "white"]));
    expect(TEXTO_SOBRE_SOLIDO).toEqual({ "--brand-solid": "--on-brand-solid", "--success-solid": "--on-brand-solid", "--danger-solid": "white", "--ai-solid": "white", ...avatares });
    expect(reprovadosSolidos()).toEqual([]);
  });

  it("autoteste: o avatar do protótipo L 0,58 reprova com branco", () => {
    const css = CSS.replace("--avatar-8: #008188", "--avatar-8: #008d94");
    expect(css).not.toBe(CSS);
    expect(reprovadosSolidos(css)).toEqual(expect.arrayContaining([expect.stringContaining("white/--avatar-8")]));
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
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) expect(c[`avatar-${n}`]).toBe(`var(--avatar-${n})`);
    expect(c["bubble-ia"]).toBe("var(--bubble-ia)");
    expect(c["bubble-note"]).toBe("var(--bubble-note)");
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
    expect(ext.fontFamily).toEqual({
      sans: ["var(--font-sans)", "Segoe UI", "Roboto", "system-ui", "sans-serif"],
      mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
    });
  });

  it("fundo pontilhado usa pontos de 1 px a cada 18 px sobre a página", () => {
    const corpo = CSS.match(/\.fundo-conversa\s*\{([^}]*)\}/)?.[1]?.replace(/\s+/g, " ") ?? "";
    expect(corpo).toContain("background-color: var(--bg-page)");
    expect(corpo).toContain("background-image: radial-gradient(var(--chat-dot) 1px, transparent 1px)");
    expect(corpo).toContain("background-size: 18px 18px");
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

describe("campos de formulário (base em @layer base)", () => {
  const base = CSS.slice(CSS.indexOf("@layer base"));
  const SELETOR = ':where(input:not([type="checkbox"]):not([type="radio"])),\n  select,\n  textarea';
  const bloco = (seletor: string) => {
    const i = base.indexOf(seletor + " {");
    return i < 0 ? "" : base.slice(i, base.indexOf("}", i));
  };

  it("base de campos usa surface-muted, raio 8 e 44 px no celular", () => {
    expect(bloco(SELETOR)).toMatch(/background-color:\s*var\(--surface-muted\)/);
    expect(bloco(SELETOR)).toMatch(/border-radius:\s*8px/);
    const m = /@media \(max-width: 767px\) \{[^@]*?min-height:\s*44px/.exec(base);
    expect(m?.[0]).toContain("input:not");
    expect(m?.[0]).toContain("textarea");
  });

  it("no celular o textarea não recebe 44 px (mantém os 90 px)", () => {
    const i = base.indexOf("@media (max-width: 767px)");
    const media = base.slice(i).replace(/\/\*[\s\S]*?\*\//g, "");
    const regra44 = /([^{}]*)\{[^}]*min-height:\s*44px/.exec(media);
    expect(regra44?.[1]).toBeDefined();
    expect(regra44?.[1]).not.toContain("textarea");
  });

  it("disabled usa text-disabled e cursor-not-allowed", () => {
    const i = base.indexOf(":disabled");
    const trecho = base.slice(i, base.indexOf("}", i));
    expect(trecho).toMatch(/color:\s*var\(--text-disabled\)/);
    expect(trecho).toMatch(/cursor:\s*not-allowed/);
  });

  it("textarea de várias linhas tem 90 px; o de uma linha fica compacto; redimensiona na vertical", () => {
    expect(bloco(':where(textarea:not([rows="1"]))')).toMatch(/min-height:\s*90px/);
    const i = base.search(/^ {2}textarea \{\n {4}resize/m);
    expect(base.slice(i, base.indexOf("}", i))).toMatch(/resize:\s*vertical/);
  });

  it("seletores de input na base têm especificidade zero (classe utilitária vence)", () => {
    const semComentario = base.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(semComentario).not.toMatch(/(^|[\s,])input:not\(\[type="checkbox"\]\)/m);
    expect(semComentario).not.toMatch(/^\s*textarea \{[^}]*min-height/m);
  });
});
