import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { criarDomMinimo, desligarObservadores, Elemento, type Documento } from "@/test/dom-minimo";

// Revisão R1 do #269, ponto 3: em vez de procurar a linha do useEffect na fonte (quebra com qualquer
// reformatação), o React DOM roda de verdade sobre o DOM mínimo (src/test/dom-minimo.ts) com uma geometria
// fingida de celular: a faixa tem 300 px visíveis e cada aba 100 px. A trava é o efeito observável: ao montar,
// a faixa rola até a aba ativa; quando o caminho muda, rola de novo até a nova aba ativa.

const caminho = vi.hoisted(() => ({ valor: "/financeiro/cambio" }));
vi.mock("next/navigation", () => ({ usePathname: () => caminho.valor }));
// O Link do Next precisa do roteador; aqui basta o <a> com os mesmos atributos.
vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return {
    default: ({ href, children, "aria-current": atual, className }: { href: string; children: ReactNode; "aria-current"?: "page"; className?: string }) =>
      createElement("a", { href, "aria-current": atual, className }, children),
  };
});

const LARGURA_FAIXA = 300;
const LARGURA_ABA = 100;
const rolagem = new WeakMap<Elemento, number>();

/** Geometria fingida: <nav> é a faixa (300 px visíveis); cada <a> filho ocupa 100 px, deslocado pela rolagem. */
function instalarGeometria() {
  const p = Elemento.prototype as unknown as Record<string, unknown>;
  const definir = (nome: string, d: PropertyDescriptor) => Object.defineProperty(p, nome, { configurable: true, ...d });
  definir("scrollLeft", {
    get(this: Elemento) { return rolagem.get(this) ?? 0; },
    set(this: Elemento, v: number) { rolagem.set(this, Math.max(0, Math.min(v, this.children.length * LARGURA_ABA - LARGURA_FAIXA))); },
  });
  definir("clientWidth", { get(this: Elemento) { return this.tagName === "NAV" ? LARGURA_FAIXA : LARGURA_ABA; } });
  definir("scrollWidth", { get(this: Elemento) { return this.tagName === "NAV" ? this.children.length * LARGURA_ABA : LARGURA_ABA; } });
  definir("getBoundingClientRect", {
    value(this: Elemento) {
      if (this.tagName === "NAV") return { left: 0, right: LARGURA_FAIXA };
      const pai = this.parentNode as Elemento;
      const left = pai.children.indexOf(this) * LARGURA_ABA - ((pai as unknown as { scrollLeft: number }).scrollLeft);
      return { left, right: left + LARGURA_ABA };
    },
  });
  return () => { for (const n of ["scrollLeft", "clientWidth", "scrollWidth", "getBoundingClientRect"]) delete p[n]; };
}

const proximaTarefa = () => new Promise<void>((r) => setImmediate(r));
async function ate(condicao: () => boolean, descricao: string) {
  for (let i = 0; i < 50; i++) {
    if (condicao()) return;
    await proximaTarefa();
  }
  throw new Error(`não aconteceu: ${descricao}`);
}

describe("barra de abas do financeiro: a faixa rola até a aba ativa abaixo de sm (C6, #263)", () => {
  let doc: Documento;
  let desmontar: (() => void) | undefined;
  let tirarGeometria: (() => void) | undefined;
  beforeAll(() => {
    const dom = criarDomMinimo();
    doc = dom.documento;
    vi.stubGlobal("window", dom.janela);
    vi.stubGlobal("document", dom.documento);
    vi.stubGlobal("MutationObserver", dom.MutationObserver);
    tirarGeometria = instalarGeometria();
  });
  afterAll(async () => {
    desmontar?.();
    for (let i = 0; i < 20; i++) await proximaTarefa();
    desligarObservadores();
    tirarGeometria?.();
    vi.unstubAllGlobals();
  });

  it("ao montar, a aba ativa fora da vista entra na faixa; ao mudar de rota, a faixa acompanha a nova aba", async () => {
    // react-dom decide `canUseDOM` ao carregar: só depois de instalar o DOM.
    const React = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { BarraAbasFinanceiro } = await import("./BarraAbasFinanceiro");
    const abas = ["cobrancas", "informes", "retomadas", "comissoes", "descontos", "cambio"] as const;
    const container = doc.createElement("div");
    doc.body.appendChild(container);
    const root = createRoot(container as unknown as HTMLElement);
    desmontar = () => root.unmount();
    const nav = () => container.querySelector("nav") as unknown as { scrollLeft: number } | null;
    const renderizar = () => root.render(React.createElement(BarraAbasFinanceiro, { abas: [...abas], contagem: {} }));

    // Câmbio é a 6ª aba (500–600 px): a faixa rola 300 px para que ela termine na borda direita.
    renderizar();
    await ate(() => nav() !== null && nav()!.scrollLeft === 300, "faixa rolada até Câmbio");
    expect(container.querySelector("[aria-current='page']")?.getAttribute("href")).toBe("/financeiro/cambio");

    // Nova rota, Cobranças (0–100 px): estava à esquerda, fora da vista; a faixa volta ao início.
    caminho.valor = "/financeiro/cobrancas";
    renderizar();
    await ate(() => nav()!.scrollLeft === 0, "faixa de volta até Cobranças");
    expect(container.querySelector("[aria-current='page']")?.getAttribute("href")).toBe("/financeiro/cobrancas");

    // Aba já visível: a faixa não se mexe.
    caminho.valor = "/financeiro/informes";
    renderizar();
    await ate(() => container.querySelector("[aria-current='page']")?.getAttribute("href") === "/financeiro/informes", "Informes ativa");
    for (let i = 0; i < 5; i++) await proximaTarefa();
    expect(nav()!.scrollLeft).toBe(0);
  });
});
