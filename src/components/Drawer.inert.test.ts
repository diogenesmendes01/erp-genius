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
  renderToStaticMarkup(createElement(Drawer, { open, onClose: () => undefined, title: "Menu", children: createElement("a", { href: "/x" }, "link") }));

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
