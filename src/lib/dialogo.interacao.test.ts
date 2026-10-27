import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

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
const caixa = (...focaveis: Elemento[]) => ({ querySelectorAll: () => focaveis, focus: vi.fn() });
function teclar(key: string, shiftKey = false): Evento {
  const e: Evento = { key, shiftKey, stopPropagation: vi.fn(), preventDefault: vi.fn() };
  for (const f of [...ouvintes]) f(e);
  return e;
}
function abrirComCommit(ref: { current: unknown }, opcoes: Parameters<typeof useDialogo>[1]) {
  const antes = m.limpezas.length;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useDialogo(ref as Parameters<typeof useDialogo>[0], opcoes);
  const [noCommit, principal] = m.limpezas.slice(antes);
  expect(m.limpezas.length, "o diálogo aberto devolve a limpeza do commit e a do efeito principal").toBe(antes + 2);
  const rodar = (limpeza: () => void) => {
    const i = m.limpezas.indexOf(limpeza);
    if (i < 0) return;
    m.limpezas.splice(i, 1);
    limpeza();
  };
  return { soltarNoCommit: () => rodar(noCommit), fechar: () => { rodar(noCommit); rodar(principal); } };
}
const abrir = (ref: { current: unknown }, opcoes: Parameters<typeof useDialogo>[1]) => abrirComCommit(ref, opcoes).fechar;

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
    botaoDaGaveta.focus();
    botaoDaGaveta.focus.mockClear();
    const fecharConfirmacao = abrir({ current: caixa(elemento("voltar")) }, { aberto: true, aoFechar: aoFecharConfirmacao });
    fecharConfirmacao();
    expect(botaoDaGaveta.focus).toHaveBeenCalledTimes(1);
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

describe("useDialogo \u2014 isolamento do fundo (C14, #170)", () => {
  function paginaComCamada() {
    const app = { tagName: "MAIN", inert: false };
    const body: { children: unknown[] } = { children: [app] };
    const camada = { tagName: "DIV", inert: false, parentElement: body };
    body.children.push(camada);
    return { app, camada };
  }

  it("com `isolar`: o fundo fica inert enquanto aberto, depois de o foco entrar no diálogo", () => {
    const { app, camada } = paginaComCamada();
    const primeiro = elemento("primeiro");
    primeiro.focus.mockImplementation(() => { expect(app.inert, "o foco entra antes de o fundo ficar inert").toBe(false); });
    abrir({ current: caixa(primeiro) }, { aberto: true, aoFechar: vi.fn(), isolar: { current: camada as unknown as HTMLElement } });
    expect(primeiro.focus).toHaveBeenCalledTimes(1);
    expect(app.inert).toBe(true);
    expect(camada.inert).toBe(false);
  });

  it("ao fechar, o fundo é solto ANTES de o foco voltar a quem abriu (focus() num inert falharia)", () => {
    const { app, camada } = paginaComCamada();
    const quemAbriu = elemento("abrir-modal");
    documento.activeElement = quemAbriu;
    const fechar = abrir({ current: caixa(elemento("dentro")) }, { aberto: true, aoFechar: vi.fn(), isolar: { current: camada as unknown as HTMLElement } });
    expect(app.inert).toBe(true);
    quemAbriu.focus.mockImplementation(() => { expect(app.inert, "fundo solto quando o foco volta").toBe(false); });
    fechar();
    expect(quemAbriu.focus).toHaveBeenCalledTimes(1);
    expect(app.inert).toBe(false);
  });

  it("a limpeza do commit solta o fundo sem mexer no foco; a passiva, depois, só devolve o foco (#249 C1)", () => {
    const { app, camada } = paginaComCamada();
    const quemAbriu = elemento("abrir-modal");
    documento.activeElement = quemAbriu;
    const { soltarNoCommit, fechar } = abrirComCommit({ current: caixa(elemento("dentro")) },
      { aberto: true, aoFechar: vi.fn(), isolar: { current: camada as unknown as HTMLElement } });
    expect(app.inert).toBe(true);
    soltarNoCommit();
    expect(app.inert).toBe(false);
    expect(quemAbriu.focus).not.toHaveBeenCalled();
    app.inert = true;
    fechar();
    expect(app.inert, "a limpeza passiva não solta de novo").toBe(true);
    expect(quemAbriu.focus).toHaveBeenCalledTimes(1);
  });

  it("sem `isolar` (Drawer, painéis próprios): ninguém vira inert", () => {
    const { app } = paginaComCamada();
    abrir({ current: caixa(elemento("a")) }, { aberto: true, aoFechar: vi.fn() });
    expect(app.inert).toBe(false);
  });
});
