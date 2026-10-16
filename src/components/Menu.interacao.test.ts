import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// Menu aberto dentro de um diálogo (Modal/Drawer/ConfirmarAcao, via useDialogo LIGADO). Sem DOM: useRef vira
// objeto e useEffect roda na hora; o `document` falso entrega o keydown primeiro aos ouvintes de captura e
// depois aos de bolha, respeitando stopPropagation — como o navegador faz com ouvintes no próprio document.
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

import { useDialogo } from "@/lib/dialogo";
import { ligarMenuAberto } from "./Menu";

type Evento = { key?: string; shiftKey?: boolean; target?: unknown; parado: boolean; stopPropagation: Mock; preventDefault: Mock };
type Ouvinte = { tipo: string; f: (e: Evento) => void; captura: boolean };
type Elemento = { nome: string; focus: Mock; closest: () => null };

function alvoFalso() {
  const ouvintes: Ouvinte[] = [];
  return {
    ouvintes,
    activeElement: null as unknown,
    contains: () => true,
    addEventListener(tipo: string, f: (e: Evento) => void, captura?: boolean) { ouvintes.push({ tipo, f, captura: !!captura }); },
    removeEventListener(tipo: string, f: (e: Evento) => void, captura?: boolean) {
      const i = ouvintes.findIndex((o) => o.tipo === tipo && o.f === f && o.captura === !!captura);
      if (i >= 0) ouvintes.splice(i, 1);
    },
    disparar(tipo: string, dados: Partial<Evento> = {}): Evento {
      const e: Evento = { ...dados, parado: false, stopPropagation: vi.fn(() => { e.parado = true; }), preventDefault: vi.fn() };
      const da = (captura: boolean) => ouvintes.filter((o) => o.tipo === tipo && o.captura === captura);
      for (const o of da(true)) o.f(e);
      if (!e.parado) for (const o of da(false)) o.f(e);
      return e;
    },
  };
}

let documento: ReturnType<typeof alvoFalso>;
let janela: ReturnType<typeof alvoFalso>;

function elemento(nome: string): Elemento {
  const el: Elemento = { nome, focus: vi.fn(() => { documento.activeElement = el; }), closest: () => null };
  return el;
}
const caixa = (...focaveis: Elemento[]) => ({ querySelectorAll: () => focaveis, focus: vi.fn() });

beforeEach(() => {
  documento = alvoFalso();
  janela = alvoFalso();
  vi.stubGlobal("document", documento);
});
afterEach(() => {
  for (const limpeza of m.limpezas.splice(0).reverse()) limpeza();
  vi.unstubAllGlobals();
});

/** Diálogo aberto (useDialogo ligado) com um Menu aberto dentro, como as ações da conversa no drawer. */
function dialogoComMenu() {
  const aoFecharDialogo = vi.fn();
  const gatilho = elemento("gatilho"), editar = elemento("editar"), excluir = elemento("excluir");
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useDialogo({ current: caixa(gatilho, editar, excluir) } as unknown as Parameters<typeof useDialogo>[0], { aberto: true, aoFechar: aoFecharDialogo });
  const fecharMenu = vi.fn();
  const painel = { contains: (n: unknown) => n === editar || n === excluir || n === painel };
  const limparMenu = ligarMenuAberto({
    doc: documento as unknown as Parameters<typeof ligarMenuAberto>[0]["doc"],
    win: janela as unknown as Parameters<typeof ligarMenuAberto>[0]["win"],
    painel: () => painel,
    gatilho: () => ({ contains: (n: unknown) => n === gatilho }),
    habilitados: () => [editar, excluir],
    fechar: fecharMenu,
  });
  m.limpezas.push(limparMenu);
  return { aoFecharDialogo, fecharMenu, gatilho, editar, excluir, painel, limparMenu };
}

describe("Menu dentro de diálogo", () => {
  it("Escape fecha só o menu (devolvendo o foco ao gatilho); o diálogo continua aberto", () => {
    const { aoFecharDialogo, fecharMenu, editar } = dialogoComMenu();
    editar.focus();
    const e = documento.disparar("keydown", { key: "Escape" });
    expect(fecharMenu).toHaveBeenCalledWith(true);
    expect(aoFecharDialogo).not.toHaveBeenCalled();
    expect(e.stopPropagation).toHaveBeenCalled();
  });

  it("com o menu já fechado, o próximo Escape fecha o diálogo", () => {
    const { aoFecharDialogo, limparMenu } = dialogoComMenu();
    limparMenu();
    documento.disparar("keydown", { key: "Escape" });
    expect(aoFecharDialogo).toHaveBeenCalledTimes(1);
  });

  it("ArrowUp com o foco no gatilho vai ao último item", () => {
    const { gatilho, excluir } = dialogoComMenu();
    gatilho.focus();
    excluir.focus.mockClear();
    documento.disparar("keydown", { key: "ArrowUp" });
    expect(excluir.focus).toHaveBeenCalledTimes(1);
  });

  it("Tab fecha o menu sem devolver o foco e segue para o diálogo, que mantém o foco preso", () => {
    const { fecharMenu, gatilho, excluir } = dialogoComMenu();
    excluir.focus();
    gatilho.focus.mockClear();
    const e = documento.disparar("keydown", { key: "Tab" });
    expect(fecharMenu).toHaveBeenCalledWith(false);
    expect(e.parado).toBe(false);
    // O último focável do diálogo era o item do menu: o diálogo leva o foco de volta ao primeiro.
    expect(gatilho.focus).toHaveBeenCalledTimes(1);
  });
});

describe("Menu aberto — scroll e resize", () => {
  it("rolagem de qualquer lista (captura) fecha o menu", () => {
    const { fecharMenu } = dialogoComMenu();
    janela.disparar("scroll", { target: { lista: true } });
    expect(fecharMenu).toHaveBeenCalledWith(false);
  });

  it("rolagem dentro do próprio painel não fecha", () => {
    const { fecharMenu, painel } = dialogoComMenu();
    janela.disparar("scroll", { target: painel });
    expect(fecharMenu).not.toHaveBeenCalled();
  });

  it("resize fecha o menu; a limpeza tira todos os ouvintes", () => {
    const { fecharMenu, limparMenu } = dialogoComMenu();
    janela.disparar("resize");
    expect(fecharMenu).toHaveBeenCalledWith(false);
    limparMenu();
    expect(janela.ouvintes).toHaveLength(0);
    expect(documento.ouvintes.filter((o) => o.captura)).toHaveLength(0);
  });
});
