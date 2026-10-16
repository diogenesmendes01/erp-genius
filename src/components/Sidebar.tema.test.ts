import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// C21 da #170: a Sidebar e a BarraMobile tinham cada uma o seu useState do tema, lido uma vez no efeito.
// Aqui o componente é chamado como função, com useSyncExternalStore trocado por uma leitura direta do
// cliente (a hidratação já leu o tema), para provar que as duas instâncias leem a MESMA fonte.
const m = vi.hoisted(() => ({ inscricoes: [] as unknown[] }));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useSyncExternalStore: ((inscrever: unknown, ler: () => unknown) => { m.inscricoes.push(inscrever); return ler(); }) as unknown as typeof real.useSyncExternalStore,
  };
});
vi.mock("next/navigation", () => ({ usePathname: () => "/home" }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

import { ThemeToggle } from "./Sidebar";
import { acompanharTema, alternarTema } from "@/lib/tema";

type Botao = { props: Record<string, unknown> };
const daSidebar = () => ThemeToggle({}) as unknown as Botao;
const daBarraMobile = () => ThemeToggle({ className: "min-h-10 min-w-10", classeIcone: "h-6 w-6" }) as unknown as Botao;

function htmlFalso(escuro: boolean) {
  const classes = new Set(escuro ? ["dark"] : []);
  vi.stubGlobal("document", {
    documentElement: {
      classList: {
        contains: (c: string) => classes.has(c),
        toggle: (c: string, forcar?: boolean) => { if (forcar ?? !classes.has(c)) classes.add(c); else classes.delete(c); return classes.has(c); },
      },
    },
  });
  vi.stubGlobal("localStorage", { setItem: vi.fn() });
}

describe("ThemeToggle: um estado só para a Sidebar e a barra mobile", () => {
  beforeEach(() => { m.inscricoes = []; });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("as duas instâncias se inscrevem na mesma fonte e o clique é a troca compartilhada", () => {
    htmlFalso(false);
    const [a, b] = [daSidebar(), daBarraMobile()];
    expect(m.inscricoes).toEqual([acompanharTema, acompanharTema]);
    expect(a.props.onClick).toBe(alternarTema);
    expect(b.props.onClick).toBe(alternarTema);
  });

  it("trocar numa instância muda a outra: aria-pressed e título acompanham o tema aplicado", () => {
    htmlFalso(false);
    expect(daSidebar().props).toMatchObject({ "aria-pressed": false, title: "Tema escuro", "aria-label": "Alternar tema" });
    // Troca pela barra mobile; a Sidebar, no próximo render, já sai com o tema novo.
    (daBarraMobile().props.onClick as () => void)();
    expect(daSidebar().props).toMatchObject({ "aria-pressed": true, title: "Tema claro", "aria-label": "Alternar tema" });
    expect(daBarraMobile().props).toMatchObject({ "aria-pressed": true, className: "min-h-10 min-w-10" });
  });

  it("página carregada no escuro (script do layout): os dois já começam pressionados", () => {
    htmlFalso(true);
    expect(daSidebar().props["aria-pressed"]).toBe(true);
    expect(daBarraMobile().props["aria-pressed"]).toBe(true);
  });
});
