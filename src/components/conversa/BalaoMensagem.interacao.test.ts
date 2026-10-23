import { act, createElement, type ComponentProps } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, Elemento, type Documento } from "@/test/dom-minimo";
import type { BalaoMensagem as Balao } from "./BalaoMensagem";

// React DOM/hooks reais. Ícones decorativos viram spans porque o DOM mínimo é HTML;
// geometria e entrega de eventos são locais a este teste, sem alterar o utilitário compartilhado.
vi.mock("@tabler/icons-react", async (original) => {
  const real = await original<typeof import("@tabler/icons-react")>();
  const icone = () => createElement("span", { "aria-hidden": true });
  return { ...real, IconAlertCircle: icone, IconCheck: icone, IconChecks: icone, IconChevronDown: icone, IconClock: icone, IconStar: icone, IconUser: icone, IconSparkles: icone, IconLock: icone };
});

type Ouvinte = { tipo: string; f: (e: Event) => void; captura: boolean };
function eventos() {
  const lista: Ouvinte[] = [];
  return {
    lista,
    addEventListener(tipo: string, f: (e: Event) => void, captura?: boolean) { lista.push({ tipo, f, captura: !!captura }); },
    removeEventListener(tipo: string, f: (e: Event) => void, captura?: boolean) {
      const k = lista.findIndex((x) => x.tipo === tipo && x.f === f && x.captura === !!captura);
      if (k >= 0) lista.splice(k, 1);
    },
  };
}
let doc: Documento;
let janela: Record<string, unknown>;
let root: Root;
let container: Elemento;
let BalaoMensagem: typeof Balao;
let docEventos: ReturnType<typeof eventos>;
let raizEventos: ReturnType<typeof eventos>;
let winEventos: ReturnType<typeof eventos>;
let ancora: { top: number; bottom: number; left: number; right: number };
let props: ComponentProps<typeof Balao>;
let medido: string[];
let focado: { painelVisivel: unknown; preventScroll: unknown }[];
let montado: boolean;
const comando = vi.fn();
const painel = () => container.querySelector('[role="menu"]');
const gatilho = () => container.querySelector('button[aria-label="Opções da mensagem"]')!;
const item = (rotulo: string) => container.querySelector(`[role="menuitem"][aria-label="${rotulo}"]`)!;
const renderizar = async (novas: Partial<ComponentProps<typeof Balao>> = {}) => {
  props = { ...props, ...novas };
  await act(async () => root.render(createElement(BalaoMensagem, props)));
};
async function disparar(tipo: string, alvo: Elemento = gatilho(), dados: Record<string, unknown> = {}, naJanela = false) {
  let parado = false;
  const e = { type: tipo, target: alvo, button: 0, bubbles: true, defaultPrevented: false,
    ...dados, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { parado = true; } };
  await act(async () => {
    const entregar = (lista: Ouvinte[], captura: boolean) => {
      for (const o of [...lista]) if (!parado && o.tipo === tipo && o.captura === captura) o.f(e as unknown as Event);
    };
    if (naJanela) { entregar(winEventos.lista, true); entregar(winEventos.lista, false); }
    else {
      entregar(docEventos.lista, true);
      if (container.contains(alvo)) { entregar(raizEventos.lista, true); entregar(raizEventos.lista, false); }
      entregar(docEventos.lista, false);
    }
  });
  return e;
}
const abrir = async () => { gatilho().focus(); await disparar("click"); };
const tecla = (key: string) => disparar("keydown", doc.activeElement, { key });

beforeEach(async () => {
  const dom = criarDomMinimo();
  doc = dom.documento; janela = dom.janela;
  docEventos = eventos(); raizEventos = eventos(); winEventos = eventos();
  Object.assign(doc, docEventos);
  Object.assign(janela, winEventos, { innerWidth: 400, innerHeight: 800 });
  vi.stubGlobal("document", doc); vi.stubGlobal("window", janela);
  vi.stubGlobal("MutationObserver", dom.MutationObserver);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  ancora = { top: 760, bottom: 790, left: 380, right: 400 };
  medido = []; focado = [];
  Object.defineProperty(Elemento.prototype, "getBoundingClientRect", { configurable: true, value(this: Elemento) {
    if (this === gatilho()) return { ...ancora, width: 20, height: 30 };
    if (this.getAttribute("role") === "menu") {
      medido.push(String(this.style.visibility));
      const natural = this.querySelectorAll("small").length ? 400 : 200;
      // Geometria controlada representa a restrição CSS; a captura no navegador valida layout real.
      const height = this.style.maxHeight === "calc(100dvh - 16px)" ? Math.min(natural, Number(janela.innerHeight) - 16) : natural;
      const top = parseFloat(String(this.style.top)) || 0, left = parseFloat(String(this.style.left)) || 0;
      return { top, bottom: top + height, left, right: left + 220, width: 220, height };
    }
    return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
  } });
  // O seletor nativo :disabled equivale ao atributo nos buttons deste teste.
  const consultar = Elemento.prototype.querySelectorAll;
  vi.spyOn(Elemento.prototype, "querySelectorAll").mockImplementation(function (this: Elemento, seletor: string) {
    return consultar.call(this, seletor.replace(/:disabled/g, "[disabled]"));
  });
  const focus = Elemento.prototype.focus;
  vi.spyOn(Elemento.prototype, "focus").mockImplementation(function (this: Elemento, ...args: unknown[]) {
    if (this.getAttribute("role") === "menuitem") focado.push({ painelVisivel: painel()?.style.visibility, preventScroll: (args[0] as { preventScroll?: boolean } | undefined)?.preventScroll });
    focus.call(this);
  });
  const { createRoot } = await import("react-dom/client");
  ({ BalaoMensagem } = await import("./BalaoMensagem"));
  container = doc.createElement("div"); doc.body.appendChild(container);
  Object.assign(container, raizEventos);
  root = createRoot(container as unknown as HTMLElement); montado = true;
  comando.mockClear();
  props = {
    m: { id: "m1", direcao: "SAIDA", tipo: "TEXTO", corpo: "Mensagem fictícia", midiaPath: null, status: "ENVIADA", origem: "HUMANO", autorNome: "Camila", templateNome: null, criadoEm: "2026-10-22T12:00:00Z", participanteNome: null, favorita: false, clientMessageId: null },
    fuso: "UTC", aoComando: comando, recursos: () => false,
  };
  await renderizar();
});
afterEach(async () => {
  if (montado) await act(async () => root.unmount());
  delete (Elemento.prototype as unknown as Record<string, unknown>).getBoundingClientRect;
  vi.restoreAllMocks(); desligarObservadores(); vi.unstubAllGlobals();
});

describe("BalaoMensagem: ligação real de menu, medição e foco", () => {
  it("clique mede, abre acima/dentro da borda direita e foca somente depois de visível", async () => {
    await abrir();
    expect(painel()?.style.position).toBe("fixed");
    expect(painel()?.style.top).toBe("354px");
    expect(painel()?.style.left).toBe("172px");
    expect(medido).toContain("hidden");
    expect(doc.activeElement === item("Responder")).toBe(true);
    expect(focado).toEqual([{ painelVisivel: "visible", preventScroll: true }]);
  });
  it("setas/Home/End pulam disabled; Escape devolve foco e não alcança diálogo pai", async () => {
    let escapouAoPai = false;
    docEventos.addEventListener("keydown", ((e: KeyboardEvent) => { if (e.key === "Escape") escapouAoPai = true; }) as unknown as () => void);
    await abrir();
    await tecla("ArrowDown"); expect(doc.activeElement === item("Copiar")).toBe(true);
    await tecla("ArrowDown"); expect(doc.activeElement === item("Favoritar")).toBe(true);
    await tecla("ArrowDown"); expect(doc.activeElement === item("Responder")).toBe(true);
    await tecla("ArrowUp"); expect(doc.activeElement === item("Favoritar")).toBe(true);
    await tecla("Home"); expect(doc.activeElement === item("Responder")).toBe(true);
    await tecla("End"); expect(doc.activeElement === item("Favoritar")).toBe(true);
    await tecla("Escape");
    expect(painel() === null).toBe(true); expect(doc.activeElement === gatilho()).toBe(true); expect(escapouAoPai).toBe(false);
    expect(comando).not.toHaveBeenCalled();
  });
  it("Tab fecha sem impedir navegação nem forçar foco no gatilho", async () => {
    await abrir();
    const antes = doc.activeElement;
    const e = await tecla("Tab");
    expect(painel() === null).toBe(true); expect(e.defaultPrevented).toBe(false);
    expect(doc.activeElement === gatilho()).toBe(false); expect(antes === gatilho()).toBe(false);
  });
  it("scroll interno permanece aberto; scroll externo e resize fecham; reabertura recalcula", async () => {
    await abrir();
    await disparar("scroll", painel()!, {}, true); expect(painel() !== null).toBe(true);
    await disparar("scroll", doc.body, {}, true); expect(painel() === null).toBe(true);
    ancora = { top: 10, bottom: 30, left: 10, right: 30 };
    await abrir(); expect(painel()?.style.top).toBe("36px");
    await disparar("resize", doc.body, {}, true); expect(painel() === null).toBe(true);
  });
  it("viewport curta limita painel e permite rolagem interna sem sair das margens", async () => {
    janela.innerHeight = 300;
    ancora = { top: 270, bottom: 290, left: 380, right: 400 };
    await abrir();
    expect(painel()?.style.maxHeight).toBe("calc(100dvh - 16px)");
    expect(painel()?.style.overflowY).toBe("auto");
    const rect = (painel() as unknown as HTMLElement).getBoundingClientRect();
    expect(rect.top).toBe(8); expect(rect.bottom).toBeLessThanOrEqual(292);
    await disparar("scroll", painel()!, {}, true); expect(painel() !== null).toBe(true);
  });
  it("capacidade e comandos novos reavaliam tamanho e foco entre habilitados", async () => {
    await renderizar({ recursos: () => true }); await abrir();
    expect(painel()?.style.top).toBe("554px");
    item("Editar").focus();
    await renderizar({ recursos: () => false, comandos: ["copiar", "reagir"] });
    expect(item("Reagir").hasAttribute("disabled")).toBe(true);
    expect(doc.activeElement === item("Copiar")).toBe(true);
    expect(painel()?.style.top).toBe("354px");
    await disparar("click", item("Reagir")); expect(comando).not.toHaveBeenCalled();
    await tecla("ArrowDown"); expect(doc.activeElement === item("Copiar")).toBe(true);
  });
  it("comando fecha, devolve foco e entrega somente a ação escolhida", async () => {
    await abrir(); await disparar("click", item("Copiar"));
    expect(comando).toHaveBeenCalledExactlyOnceWith("copiar");
    expect(painel() === null).toBe(true); expect(doc.activeElement === gatilho()).toBe(true);
  });
  it("clique fora fecha e desmontagem remove ouvintes do balão", async () => {
    await abrir(); await disparar("mousedown", doc.body); expect(painel() === null).toBe(true);
    await abrir(); await act(async () => root.unmount()); montado = false;
    expect(winEventos.lista).toHaveLength(0);
    expect(docEventos.lista.filter((e) => ["mousedown", "keydown"].includes(e.tipo))).toHaveLength(0);
    expect(comando).not.toHaveBeenCalled();
  });
  it("menu sem habilitados permite Escape e não executa ações", async () => {
    await renderizar({ comandos: ["reagir"] }); await abrir();
    await tecla("ArrowDown"); expect(comando).not.toHaveBeenCalled();
    await tecla("Escape"); expect(painel() === null).toBe(true); expect(doc.activeElement === gatilho()).toBe(true);
  });
});
