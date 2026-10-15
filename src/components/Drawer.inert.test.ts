import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// `inert` é aplicado pela propriedade do DOM num efeito (os tipos do React 18 não conhecem o
// atributo), então não aparece no HTML estático. Sem jsdom: os refs viram objetos observáveis e os
// efeitos rodam na hora — o primeiro ref do Drawer é a raiz que recebe o `inert`.
const refs = vi.hoisted(() => ({ lista: [] as { current: { inert?: boolean } }[] }));
vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return {
    ...react,
    useRef: () => { const ref = { current: {} as { inert?: boolean } }; refs.lista.push(ref); return ref; },
    useEffect: (efeito: () => void) => { efeito(); },
  };
});
vi.mock("@/lib/dialogo", () => ({ useDialogo: () => undefined }));

import { Drawer } from "./Drawer";

const renderizar = (open: boolean) =>
  renderToStaticMarkup(createElement(Drawer, { open, onClose: () => undefined, title: "Menu" } as Parameters<typeof Drawer>[0], createElement("a", { href: "/x" }, "link")));

describe("Drawer — inert", () => {
  beforeEach(() => { refs.lista.length = 0; });

  it("fechado: a raiz fica inert (fora de Tab, clique e árvore de acessibilidade)", () => {
    renderizar(false);
    expect(refs.lista[0].current.inert).toBe(true);
  });

  it("aberto: a raiz deixa de ser inert", () => {
    renderizar(true);
    expect(refs.lista[0].current.inert).toBe(false);
  });
});

describe("Drawer → camada elevada (DS)", () => {
  it("drawer usa superfície elevada", () => {
    const h = renderToStaticMarkup(createElement(Drawer, { open: true, onClose: () => {}, title: "Detalhes" } as Parameters<typeof Drawer>[0], "x"));
    expect(h).toContain("bg-surface-raised");
    expect(h).toContain("shadow-dialog");
    expect(h).toContain("border-gray-200");
    expect(h).toContain("bg-black/60");
    // Bordas lógicas (RTL): à direita o painel tem borda no início; nunca a física border-l.
    expect(h).toContain("border-s");
    expect(h).not.toMatch(/\bborder-[lr]\b/);
  });

  it("drawer fechado não projeta sombra (vazava na borda da tela)", () => {
    const h = renderToStaticMarkup(createElement(Drawer, { open: false, onClose: () => {}, title: "Menu", lado: "esquerda" } as Parameters<typeof Drawer>[0], "x"));
    expect(h).not.toContain("shadow-dialog");
    expect(h).toContain("-translate-x-full");
  });

  it("drawer à esquerda usa borda lógica no fim (border-e)", () => {
    const h = renderToStaticMarkup(createElement(Drawer, { open: true, onClose: () => {}, title: "Menu", lado: "esquerda" } as Parameters<typeof Drawer>[0], "x"));
    expect(h).toContain("border-e");
    expect(h).not.toContain("border-s ");
    expect(h).not.toMatch(/\bborder-[lr]\b/);
  });
});
