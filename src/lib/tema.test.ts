import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHAVE_TEMA, acompanharTema, alternarTema, temaEscuroAplicado, temaEscuroNoServidor } from "./tema";

// C21 da #170: uma fonte só para o tema (a classe `dark` do <html>), com aviso a todos os controles.
// Sem DOM na suíte: document e localStorage falsos, só com o que o módulo usa.
function ambiente(escuroInicial: boolean) {
  const classes = new Set(escuroInicial ? ["dark"] : []);
  const gravado = new Map<string, string>();
  vi.stubGlobal("document", {
    documentElement: {
      classList: {
        contains: (c: string) => classes.has(c),
        toggle: (c: string, forcar?: boolean) => {
          const ligar = forcar ?? !classes.has(c);
          if (ligar) classes.add(c);
          else classes.delete(c);
          return ligar;
        },
      },
    },
  });
  vi.stubGlobal("localStorage", { setItem: (k: string, v: string) => gravado.set(k, v), getItem: (k: string) => gravado.get(k) ?? null });
  return { classes, gravado };
}

describe("tema do shell: fonte única", () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("lê o tema da classe do <html>; no servidor é sempre claro", () => {
    ambiente(true);
    expect(temaEscuroAplicado()).toBe(true);
    ambiente(false);
    expect(temaEscuroAplicado()).toBe(false);
    expect(temaEscuroNoServidor()).toBe(false);
  });

  it("alternar troca a classe, grava a escolha na chave que o layout lê e avisa TODOS os inscritos", () => {
    const { classes, gravado } = ambiente(false);
    const sidebar = vi.fn(), barraMobile = vi.fn();
    const cancelarSidebar = acompanharTema(sidebar);
    const cancelarBarra = acompanharTema(barraMobile);

    alternarTema();
    expect(classes.has("dark")).toBe(true);
    expect(gravado.get(CHAVE_TEMA)).toBe("dark");
    expect(CHAVE_TEMA).toBe("tema");
    expect(sidebar).toHaveBeenCalledTimes(1);
    expect(barraMobile).toHaveBeenCalledTimes(1);

    alternarTema();
    expect(classes.has("dark")).toBe(false);
    expect(gravado.get(CHAVE_TEMA)).toBe("light");
    expect(sidebar).toHaveBeenCalledTimes(2);
    expect(barraMobile).toHaveBeenCalledTimes(2);

    cancelarSidebar();
    alternarTema();
    expect(sidebar).toHaveBeenCalledTimes(2);
    expect(barraMobile).toHaveBeenCalledTimes(3);
    cancelarBarra();
  });

  it("o aviso sai depois da troca: quem é avisado já lê o tema novo", () => {
    ambiente(false);
    const lidos: boolean[] = [];
    const cancelar = acompanharTema(() => lidos.push(temaEscuroAplicado()));
    alternarTema();
    alternarTema();
    expect(lidos).toEqual([true, false]);
    cancelar();
  });
});
