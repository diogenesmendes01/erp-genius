import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43 §6 item 3: o aviso de saída (beforeunload) liga só com alteração não salva e desliga ao salvar.
// Sem DOM: `window` falso (só add/removeEventListener) e os efeitos do React simulados com as dependências
// (o efeito roda de novo — e o anterior é desfeito — só quando `sujo` muda), como o React faz.
const m = vi.hoisted(() => {
  type Efeito = { deps: unknown[] | undefined; desfazer: (() => void) | void };
  let efeitos: Efeito[] = [];
  let posicao = 0;
  return {
    reiniciar() { efeitos = []; posicao = 0; },
    render(f: () => void) { posicao = 0; f(); },
    desmontar() { for (const e of efeitos) if (typeof e.desfazer === "function") e.desfazer(); efeitos = []; },
    useEffect(efeito: () => (() => void) | void, deps?: unknown[]) {
      const k = posicao++;
      const anterior = efeitos[k];
      const mudou = !anterior || !deps || !anterior.deps || deps.some((d, i) => !Object.is(d, anterior.deps![i]));
      if (!mudou) return;
      if (anterior && typeof anterior.desfazer === "function") anterior.desfazer();
      efeitos[k] = { deps, desfazer: efeito() };
    },
  };
});
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return { ...real, useEffect: ((f: () => (() => void) | void, deps?: unknown[]) => m.useEffect(f, deps)) as unknown as typeof real.useEffect };
});

import { pedirConfirmacaoDeSaida, useAvisoAoSair } from "./aviso-ao-sair";

/** O mínimo de `window` que o aviso usa. */
type AlvoDoAviso = {
  addEventListener(tipo: "beforeunload", ouvinte: (evento: BeforeUnloadEvent) => void): void;
  removeEventListener(tipo: "beforeunload", ouvinte: (evento: BeforeUnloadEvent) => void): void;
};

/** `window` falso: guarda os ouvintes de beforeunload registrados agora. */
function janelaFalsa() {
  const ouvintes = new Set<(e: BeforeUnloadEvent) => void>();
  const alvo: AlvoDoAviso & { ouvintes: typeof ouvintes; adicoes: number } = {
    ouvintes, adicoes: 0,
    addEventListener(_tipo, f) { alvo.adicoes++; ouvintes.add(f); },
    removeEventListener(_tipo, f) { ouvintes.delete(f); },
  };
  return alvo;
}
/** Dispara o beforeunload: devolve se o navegador perguntaria (preventDefault ou returnValue). */
function sair(janela: ReturnType<typeof janelaFalsa>) {
  const evento = { prevenido: false, returnValue: undefined as unknown, preventDefault() { this.prevenido = true; } };
  for (const f of janela.ouvintes) f(evento as unknown as BeforeUnloadEvent);
  return evento.prevenido || evento.returnValue !== undefined;
}

let janela: ReturnType<typeof janelaFalsa>;
beforeEach(() => { m.reiniciar(); janela = janelaFalsa(); vi.stubGlobal("window", janela); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("useAvisoAoSair", () => {
  const tela = (sujo: boolean) => m.render(() => useAvisoAoSair(sujo));

  it("sem alteração, nenhum ouvinte: sair não pergunta", () => {
    tela(false);
    expect(janela.ouvintes.size).toBe(0);
    expect(sair(janela)).toBe(false);
  });

  it("com alteração, liga uma vez (renders seguidos não duplicam); ao salvar (sujo=false), desliga", () => {
    tela(false);
    tela(true);
    expect(janela.ouvintes.size).toBe(1);
    expect(sair(janela)).toBe(true);
    tela(true);
    tela(true);
    expect(janela.adicoes).toBe(1);
    tela(false); // salvou
    expect(janela.ouvintes.size).toBe(0);
    expect(sair(janela)).toBe(false);
  });

  it("alterar de novo depois de salvar liga outra vez; desmontar a tela desliga", () => {
    tela(true);
    tela(false);
    tela(true);
    expect(janela.ouvintes.size).toBe(1);
    m.desmontar();
    expect(janela.ouvintes.size).toBe(0);
  });
});

describe("pedirConfirmacaoDeSaida", () => {
  it("o ouvinte registrado no window é o pedido de confirmação, e o mesmo sai ao desligar", () => {
    m.render(() => useAvisoAoSair(true));
    expect([...janela.ouvintes]).toEqual([pedirConfirmacaoDeSaida]);
    m.render(() => useAvisoAoSair(false));
    expect(janela.ouvintes.size).toBe(0);
  });

  it("sem window (render no servidor), o gancho não falha nem registra nada", () => {
    vi.unstubAllGlobals();
    expect(typeof window).toBe("undefined");
    expect(() => m.render(() => useAvisoAoSair(true))).not.toThrow();
    expect(janela.adicoes).toBe(0);
  });

  it("o pedido usa preventDefault e returnValue (navegadores antigos)", () => {
    const evento = { preventDefault: vi.fn(), returnValue: undefined as unknown };
    pedirConfirmacaoDeSaida(evento as unknown as BeforeUnloadEvent);
    expect(evento.preventDefault).toHaveBeenCalled();
    expect(evento.returnValue).toBe("");
  });
});
