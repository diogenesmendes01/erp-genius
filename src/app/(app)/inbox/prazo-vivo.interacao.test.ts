import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Elemento } from "@/test/dom-minimo";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
import type { ListaAtendimentos as Lista } from "./ListaAtendimentos";

// React DOM e efeitos reais, sem simular hooks. O DOM mínimo não mede layout;
// listas abaixo do limiar de virtualização permitem verificar texto e timers reais.
// DOM mínimo não implementa namespaces SVG; só os ícones decorativos viram spans.
// React, ListaAtendimentos, ItemConversa, relógio e assinaturas continuam reais.
vi.mock("@tabler/icons-react", async () => {
  const { createElement } = await import("react");
  const Icone = () => createElement("span");
  return { IconBellOff: Icone, IconClockExclamation: Icone, IconPin: Icone, IconUsersGroup: Icone, IconUserX: Icone };
});
const T = Date.UTC(2026, 9, 22, 12);
const MINUTO = 60_000;
const item = (prazo: number | null, id = "a1"): ItemListaInbox => ({
  id, numeroId: "n1", numeroRotulo: "Cobrança", finalidade: "FINANCEIRO", driver: "SIMULADO",
  contatoId: `c-${id}`, contatoNome: `Contato ${id}`, contatoTelefone: "", optOut: false, vinculo: null,
  naoLidas: 0, ultimaMensagemEm: null, preview: "Mensagem fictícia", linhaComercial: false,
  status: "EM_ATENDIMENTO", responsavelNome: null, prazoRespostaEm: prazo === null ? null : new Date(prazo).toISOString(),
  fixada: false, silenciada: false, grupo: false, responsavelId: null, numeroDonoId: null,
  setoresDoNumero: ["FINANCEIRO"], atendimentoOrigemId: null, capacidades: [],
});
let root: Root;
let container: Elemento;
let ListaAtendimentos: typeof Lista;
let montado: boolean;
const renderizar = async (itens: ItemListaInbox[]) => {
  await act(async () => root.render(createElement(ListaAtendimentos, {
    itens, proximo: null, selecionado: null, aoSelecionar() {}, aoCarregarMais() {},
  })));
};
const avancar = async (ms: number) => { await act(async () => { vi.advanceTimersByTime(ms); }); };
const selos = () => (container.textContent.match(/Prazo estourado/g) ?? []).length;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  vi.setSystemTime(T);
  const dom = criarDomMinimo();
  vi.stubGlobal("window", dom.janela);
  vi.stubGlobal("document", dom.documento);
  vi.stubGlobal("MutationObserver", dom.MutationObserver);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = dom.documento.createElement("div");
  dom.documento.body.appendChild(container);
  const { createRoot } = await import("react-dom/client");
  ({ ListaAtendimentos } = await import("./ListaAtendimentos"));
  root = createRoot(container as unknown as HTMLElement);
  montado = true;
});
afterEach(async () => {
  if (montado) await act(async () => root.unmount());
  desligarObservadores();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("prazo visual vivo na ListaAtendimentos", () => {
  it("vence estritamente em+1ms e pula o minuto1 que não altera o badge", async () => {
    await renderizar([item(T + MINUTO)]);
    expect(selos()).toBe(0); expect(vi.getTimerCount()).toBe(1);
    await avancar(MINUTO); expect(selos()).toBe(0);
    await avancar(1); expect(container.textContent).toContain("Prazo estourado · 1 min");
    expect(vi.getTimerCount()).toBe(1);
    await avancar(MINUTO); expect(container.textContent).toContain("Prazo estourado · 1 min");
    await avancar(MINUTO - 1); expect(container.textContent).toContain("Prazo estourado · 2 min");
    expect(vi.getTimerCount()).toBe(1);
  });
  it("29→30 muda texto/cor sem SSE, rede ou novo render externo", async () => {
    const buscar = vi.fn(); vi.stubGlobal("fetch", buscar);
    await renderizar([item(T - 29 * MINUTO)]);
    expect(container.textContent).toContain("29 min");
    expect(container.querySelectorAll("span").some(e => (e.getAttribute("class") ?? "").includes("bg-amber-50"))).toBe(true);
    await avancar(MINUTO - 1); expect(container.textContent).toContain("29 min");
    await avancar(1); expect(container.textContent).toContain("30 min");
    expect(container.querySelectorAll("span").some(e => (e.getAttribute("class") ?? "").includes("bg-red-50"))).toBe(true);
    expect(vi.getTimerCount()).toBe(1); expect(buscar).not.toHaveBeenCalled();
  });
  it("59→60 passa a1h na fronteira exata", async () => {
    await renderizar([item(T - 59 * MINUTO)]);
    expect(container.textContent).toContain("59 min");
    await avancar(MINUTO - 1); expect(container.textContent).toContain("59 min");
    await avancar(1); expect(container.textContent).toContain("Prazo estourado · 1 h");
    expect(container.textContent).not.toContain("60 min"); expect(vi.getTimerCount()).toBe(1);
  });
  it("lista SSE usa Date.now atual para futuros e vencidos", async () => {
    await renderizar([item(null)]); await avancar(30 * MINUTO);
    await renderizar([item(T + 35 * MINUTO)]);
    await avancar(5 * MINUTO); expect(selos()).toBe(0);
    await avancar(1); expect(selos()).toBe(1);
    await renderizar([item(T + 25 * MINUTO)]); expect(container.textContent).toContain("10 min"); expect(vi.getTimerCount()).toBe(1);
  });
  it("igual agora não cria loopzero; empates e múltiplos prazos dividem1timer", async () => {
    await renderizar([item(T), item(T, "a2"), item(T + 1000, "a3")]);
    expect(vi.getTimerCount()).toBe(1); await avancar(1); expect(selos()).toBe(2);
    await avancar(1000); expect(selos()).toBe(3); expect(vi.getTimerCount()).toBe(1);
  });
  it("escolhe próximo minuto vencido antes de outro vencimento futuro", async () => {
    await renderizar([item(T - 29 * MINUTO + 500), item(T + 1000, "a2")]);
    expect(container.textContent).toContain("28 min"); await avancar(500);
    expect(container.textContent).toContain("29 min"); expect(selos()).toBe(1);
    await avancar(501); expect(selos()).toBe(2); expect(vi.getTimerCount()).toBe(1);
  });
  it("troca de lista cancela timer antigo e desmontagem limpa o único timer", async () => {
    await renderizar([item(T + 1000)]); await renderizar([item(T + 2000)]);
    expect(vi.getTimerCount()).toBe(1); await avancar(1001); expect(selos()).toBe(0);
    await renderizar([item(T - MINUTO)]); expect(selos()).toBe(1); expect(vi.getTimerCount()).toBe(1);
    await act(async () => root.unmount()); montado = false; expect(vi.getTimerCount()).toBe(0);
    await avancar(10_000);
  });
  it("sem badge elegível, incluindo inválido/grupo/encerrado, não agenda", async () => {
    await renderizar([item(T - MINUTO)]);
    await renderizar([{ ...item(T), grupo: true }, { ...item(T), status: "ENCERRADO" }, { ...item(T), prazoRespostaEm: "inválida" }, item(null, "a4")]);
    expect(selos()).toBe(0); expect(vi.getTimerCount()).toBe(0);
    await renderizar([]); expect(vi.getTimerCount()).toBe(0);
  });
  it("teto nativo rearma sem vencer cedo; após vencimento só fronteira visual", async () => {
    const teto = 2_147_483_647; await renderizar([item(T + teto + 1000)]);
    await avancar(teto); expect(selos()).toBe(0); expect(vi.getTimerCount()).toBe(1);
    await avancar(1000); expect(selos()).toBe(0);
    await avancar(1); expect(selos()).toBe(1); expect(vi.getTimerCount()).toBe(1);
  });
  it("retorno de sleep/salto do relógio recalcula texto pelo tempo real e rearma1", async () => {
    await renderizar([item(T + 1000)]);
    vi.setSystemTime(T + 10 * MINUTO);
    await avancar(1001);
    expect(container.textContent).toContain("Prazo estourado · 10 min"); expect(vi.getTimerCount()).toBe(1);
    vi.setSystemTime(T - MINUTO); await avancar(MINUTO);
    expect(selos()).toBe(0); expect(vi.getTimerCount()).toBe(1);
  });
  it("StrictMode limpa assinatura intermediária e mantém no máximo1timer", async () => {
    const { StrictMode } = await import("react");
    await act(async () => root.render(createElement(StrictMode, null, createElement(ListaAtendimentos, { itens: [item(T - 29 * MINUTO)], proximo: null, selecionado: null, aoSelecionar() {}, aoCarregarMais() {} }))));
    expect(vi.getTimerCount()).toBe(1); await avancar(MINUTO); expect(container.textContent).toContain("30 min"); expect(vi.getTimerCount()).toBe(1);
  });
});
