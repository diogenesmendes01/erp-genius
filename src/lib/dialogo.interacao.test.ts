import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// O useDialogo LIGADO (R1 da #154, B3): o efeito roda de verdade, com `document` falso (ouvintes de teclado
// e foco espionados). Cobre o que a parte pura (criarPilhaDialogos, em dialogo.test.ts) não alcança:
// a pilha é aberta e fechada pelo efeito, só o diálogo de cima responde ao teclado e o foco inicial vai
// para `focoInicial`. Sem DOM: useRef vira um objeto e useEffect roda na hora, guardando a limpeza.
const m = vi.hoisted(() => ({ limpezas: [] as (() => void)[] }));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useRef: ((inicial: unknown) => ({ current: inicial })) as unknown as typeof real.useRef,
    useEffect: ((efeito: () => void | (() => void)) => {
      const limpeza = efeito();
      if (typeof limpeza === "function") m.limpezas.push(limpeza);
    }) as unknown as typeof real.useEffect,
  };
});

import { useDialogo } from "./dialogo";

type Evento = { key: string; shiftKey: boolean; stopPropagation: Mock; preventDefault: Mock };
type Elemento = { nome: string; focus: Mock; closest: () => null };

let ouvintes: Set<(e: Evento) => void>;
let documento: { activeElement: unknown; addEventListener: (t: string, f: (e: Evento) => void) => void; removeEventListener: (t: string, f: (e: Evento) => void) => void; contains: () => boolean };

function elemento(nome: string): Elemento {
  const el: Elemento = { nome, focus: vi.fn(() => { documento.activeElement = el; }), closest: () => null };
  return el;
}
/** Caixa do diálogo com os focáveis dados, na ordem. */
const caixa = (...focaveis: Elemento[]) => ({ querySelectorAll: () => focaveis, focus: vi.fn() });
function teclar(key: string, shiftKey = false): Evento {
  const e: Evento = { key, shiftKey, stopPropagation: vi.fn(), preventDefault: vi.fn() };
  for (const f of [...ouvintes]) f(e);
  return e;
}
/** Abre um diálogo (chama o gancho como um componente montado) e devolve a limpeza do efeito principal. */
function abrir(ref: { current: unknown }, opcoes: Parameters<typeof useDialogo>[1]): () => void {
  const antes = m.limpezas.length;
  // O gancho roda fora de componente de propósito: useEffect está mockado e o teste dispara o efeito à mão.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useDialogo(ref as Parameters<typeof useDialogo>[0], opcoes);
  const limpeza = m.limpezas[m.limpezas.length - 1];
  expect(m.limpezas.length, "o efeito do diálogo aberto devolve uma limpeza").toBe(antes + 1);
  return () => { m.limpezas.splice(m.limpezas.indexOf(limpeza), 1); limpeza(); };
}

beforeEach(() => {
  ouvintes = new Set();
  documento = {
    activeElement: null,
    addEventListener: (_t: string, f: (e: Evento) => void) => { ouvintes.add(f); },
    removeEventListener: (_t: string, f: (e: Evento) => void) => { ouvintes.delete(f); },
    contains: () => true,
  };
  vi.stubGlobal("document", documento);
});
afterEach(() => {
  // Fecha o que ficou aberto: a pilha é do módulo e não pode vazar para o próximo teste.
  for (const limpeza of m.limpezas.splice(0).reverse()) limpeza();
  vi.unstubAllGlobals();
});

describe("useDialogo \u2014 foco inicial", () => {
  it("vai para `focoInicial` (o botão seguro), não para o primeiro focável", () => {
    const primeiro = elemento("primeiro"), voltar = elemento("voltar");
    abrir({ current: caixa(primeiro, voltar) }, { aberto: true, aoFechar: vi.fn(), focoInicial: { current: voltar as unknown as HTMLElement } });
    expect(voltar.focus).toHaveBeenCalledTimes(1);
    expect(primeiro.focus).not.toHaveBeenCalled();
  });

  it("sem `focoInicial` (ou com o ref vazio), vai para o primeiro focável", () => {
    const primeiro = elemento("primeiro"), segundo = elemento("segundo");
    abrir({ current: caixa(primeiro, segundo) }, { aberto: true, aoFechar: vi.fn(), focoInicial: { current: null } });
    expect(primeiro.focus).toHaveBeenCalledTimes(1);
    expect(segundo.focus).not.toHaveBeenCalled();
  });

  it("fechado não liga nada", () => {
    const primeiro = elemento("primeiro");
    const antes = m.limpezas.length;
    useDialogo({ current: caixa(primeiro) } as unknown as Parameters<typeof useDialogo>[0], { aberto: false, aoFechar: vi.fn() });
    expect(m.limpezas.length).toBe(antes);
    expect(primeiro.focus).not.toHaveBeenCalled();
    expect(ouvintes.size).toBe(0);
  });
});

describe("useDialogo \u2014 pilha ligada ao efeito", () => {
  it("o único diálogo aberto responde ao Escape (a pilha foi aberta pelo efeito)", () => {
    const aoFechar = vi.fn();
    abrir({ current: caixa(elemento("a")) }, { aberto: true, aoFechar });
    teclar("Escape");
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it("com bloquearFechamento, Escape não fecha", () => {
    const aoFechar = vi.fn();
    abrir({ current: caixa(elemento("a")) }, { aberto: true, aoFechar, bloquearFechamento: true });
    teclar("Escape");
    expect(aoFechar).not.toHaveBeenCalled();
  });

  it("dois abertos: Escape fecha só o de cima; o Tab do de baixo não puxa o foco para trás", () => {
    const aoFecharGaveta = vi.fn(), aoFecharConfirmacao = vi.fn();
    const g1 = elemento("gaveta-1"), g2 = elemento("gaveta-2");
    const voltar = elemento("voltar"), confirmar = elemento("confirmar");
    abrir({ current: caixa(g1, g2) }, { aberto: true, aoFechar: aoFecharGaveta });
    abrir({ current: caixa(voltar, confirmar) }, { aberto: true, aoFechar: aoFecharConfirmacao });
    teclar("Escape");
    expect(aoFecharConfirmacao).toHaveBeenCalledTimes(1);
    expect(aoFecharGaveta).not.toHaveBeenCalled();
    // Tab no último da confirmação volta ao primeiro DELA; a gaveta não mexe no foco.
    confirmar.focus();
    g1.focus.mockClear(); g2.focus.mockClear(); voltar.focus.mockClear();
    const e = teclar("Tab");
    expect(voltar.focus).toHaveBeenCalledTimes(1);
    expect(g1.focus).not.toHaveBeenCalled();
    expect(g2.focus).not.toHaveBeenCalled();
    expect(e.preventDefault).toHaveBeenCalledTimes(1);
  });

  it("fechar o de cima devolve o teclado ao de baixo e o foco a quem abriu", () => {
    const aoFecharGaveta = vi.fn(), aoFecharConfirmacao = vi.fn();
    const botaoDaGaveta = elemento("enviar-via-api");
    abrir({ current: caixa(botaoDaGaveta) }, { aberto: true, aoFechar: aoFecharGaveta });
    botaoDaGaveta.focus(); // quem abre a confirmação
    botaoDaGaveta.focus.mockClear();
    const fecharConfirmacao = abrir({ current: caixa(elemento("voltar")) }, { aberto: true, aoFechar: aoFecharConfirmacao });
    fecharConfirmacao();
    expect(botaoDaGaveta.focus).toHaveBeenCalledTimes(1); // foco devolvido
    teclar("Escape");
    expect(aoFecharGaveta).toHaveBeenCalledTimes(1);
    expect(aoFecharConfirmacao).not.toHaveBeenCalled();
  });

  it("a limpeza tira o ouvinte de teclado", () => {
    const aoFechar = vi.fn();
    const fechar = abrir({ current: caixa(elemento("a")) }, { aberto: true, aoFechar });
    fechar();
    teclar("Escape");
    expect(aoFechar).not.toHaveBeenCalled();
    expect(ouvintes.size).toBe(0);
  });
});
