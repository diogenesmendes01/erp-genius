import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setAberta: vi.fn(),
  navLinks: vi.fn((props: { aoNavegar?: () => void }) => (props ? null : null)),
  drawer: vi.fn(({ children }: { children: ReactNode; onClose: () => void }) => children),
}));
vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return { ...react, useState: (inicial: unknown) => [inicial, mocks.setAberta], useEffect: (efeito: () => void) => { efeito(); } };
});
vi.mock("next/navigation", () => ({ usePathname: () => "/home" }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("./Drawer", () => ({ Drawer: mocks.drawer }));
vi.mock("./Sidebar", () => ({ NavLinks: mocks.navLinks, ThemeToggle: () => null }));

import { BarraMobile, CONSULTA_MD } from "./BarraMobile";

function simularMatchMedia() {
  const ouvintes: Record<string, (e: { matches: boolean }) => void> = {};
  vi.stubGlobal("window", {
    matchMedia: (consulta: string) => ({
      matches: false,
      addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => { ouvintes[consulta] = fn; },
      removeEventListener: vi.fn(),
    }),
  });
  return ouvintes;
}
const renderizar = () => renderToStaticMarkup(createElement(BarraMobile, { papeis: ["ADMINISTRADOR"], nome: "Ana" }));

describe("BarraMobile — quando a gaveta fecha", () => {
  afterEach(() => { vi.unstubAllGlobals(); mocks.setAberta.mockClear(); mocks.navLinks.mockClear(); });

  it("ao navegar: a navegação da gaveta recebe um aoNavegar que fecha a gaveta", () => {
    simularMatchMedia();
    renderizar();
    const aoNavegar = mocks.navLinks.mock.calls[0][0].aoNavegar;
    expect(aoNavegar).toBeTypeOf("function");
    aoNavegar!();
    expect(mocks.setAberta).toHaveBeenCalledWith(false);
  });

  it("ao fechar a gaveta (Escape, fundo, botão)", () => {
    simularMatchMedia();
    renderizar();
    mocks.drawer.mock.calls.at(-1)![0].onClose();
    expect(mocks.setAberta).toHaveBeenCalledWith(false);
  });

  it("ao cruzar para md+ (a Sidebar volta): fecha; voltar para baixo de md não abre", () => {
    const ouvintes = simularMatchMedia();
    renderizar();
    expect(ouvintes[CONSULTA_MD]).toBeTypeOf("function");
    ouvintes[CONSULTA_MD]({ matches: false });
    expect(mocks.setAberta).not.toHaveBeenCalled();
    ouvintes[CONSULTA_MD]({ matches: true });
    expect(mocks.setAberta).toHaveBeenCalledWith(false);
  });
});
