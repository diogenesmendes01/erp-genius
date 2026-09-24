import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Interação sem DOM (o projeto não tem jsdom/Testing Library): o estado da gaveta é observado pelo
// setter do useState, a gaveta renderiza os filhos sempre e a NavLinks guarda o `aoNavegar` recebido.
// Assim, "clicar num link" = chamar o aoNavegar que a BarraMobile entregou à navegação.
const mocks = vi.hoisted(() => ({
  setAberta: vi.fn(),
  navLinks: vi.fn((props: { aoNavegar?: () => void }) => (props ? null : null)),
  drawer: vi.fn(({ children }: { children: ReactNode; onClose: () => void }) => children),
}));
vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return { ...react, useState: (inicial: unknown) => [inicial, mocks.setAberta] };
});
vi.mock("next/navigation", () => ({ usePathname: () => "/home" }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("./Drawer", () => ({ Drawer: mocks.drawer }));
vi.mock("./Sidebar", () => ({ NavLinks: mocks.navLinks, ThemeToggle: () => null }));

import { BarraMobile } from "./BarraMobile";

describe("BarraMobile — a gaveta fecha ao navegar", () => {
  it("a navegação da gaveta recebe um aoNavegar que fecha a gaveta", () => {
    renderToStaticMarkup(createElement(BarraMobile, { papeis: ["ADMINISTRADOR"], nome: "Ana" }));
    const aoNavegar = mocks.navLinks.mock.calls[0][0].aoNavegar;
    expect(aoNavegar).toBeTypeOf("function");
    aoNavegar!();
    expect(mocks.setAberta).toHaveBeenCalledWith(false);
  });

  it("fechar a gaveta (Escape, fundo, botão) também fecha", () => {
    mocks.setAberta.mockClear();
    renderToStaticMarkup(createElement(BarraMobile, { papeis: ["ADMINISTRADOR"], nome: "Ana" }));
    mocks.drawer.mock.calls.at(-1)![0].onClose();
    expect(mocks.setAberta).toHaveBeenCalledWith(false);
  });
});
