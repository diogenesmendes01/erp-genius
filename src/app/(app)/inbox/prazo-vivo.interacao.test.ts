import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Elemento } from "@/test/dom-minimo";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
import type { ListaAtendimentos as Lista } from "./ListaAtendimentos";

// React DOM e efeitos reais, sem simular hooks. O DOM mínimo não mede layout;
// listas abaixo do limiar de virtualização permitem verificar texto e timers reais.
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

describe("prazo vivo na ListaAtendimentos", () => {
  it("o selo aparece 1ms após o prazo, sem reload, com um único timer", async () => {
    await renderizar([item(T + MINUTO)]);
    expect(selos()).toBe(0);
    expect(vi.getTimerCount()).toBe(1);
    await avancar(MINUTO);
    expect(selos()).toBe(0);
    await avancar(1);
    expect(selos()).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("lista SSE aos 30min com prazo aos 35min vence em 5min reais", async () => {
    await renderizar([item(null)]);
    await avancar(30 * MINUTO);
    await renderizar([item(T + 35 * MINUTO)]);
    expect(selos()).toBe(0);
    expect(vi.getTimerCount()).toBe(1);
    await avancar(5 * MINUTO);
    expect(selos()).toBe(0);
    await avancar(1);
    expect(selos()).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("lista SSE aos 30min com prazo aos 25min mostra o selo imediatamente", async () => {
    await renderizar([item(null)]);
    await avancar(30 * MINUTO);
    await renderizar([item(T + 25 * MINUTO)]);
    expect(selos()).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("um prazo recebido exatamente agora vence no próximo milissegundo", async () => {
    await renderizar([item(T)]);
    expect(selos()).toBe(0);
    expect(vi.getTimerCount()).toBe(1);
    await avancar(1);
    expect(selos()).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("prazos empatados vencem juntos e só o próximo prazo mantém timer", async () => {
    await renderizar([item(T + 1000), item(T + 1000, "a2"), item(T + 2000, "a3")]);
    expect(vi.getTimerCount()).toBe(1);
    await avancar(1001);
    expect(selos()).toBe(2);
    expect(vi.getTimerCount()).toBe(1);
    await avancar(1000);
    expect(selos()).toBe(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("trocar itens cancela o prazo antigo e desmontar limpa o próximo", async () => {
    await renderizar([item(T + 1000)]);
    await renderizar([item(T + 2000)]);
    expect(vi.getTimerCount()).toBe(1);
    await avancar(1001);
    expect(selos()).toBe(0);
    expect(vi.getTimerCount()).toBe(1);
    await act(async () => root.unmount());
    montado = false;
    expect(vi.getTimerCount()).toBe(0);
    await avancar(10_000);
  });

  it("remover o próximo prazo cancela o timer, sem armar outro para vencidos", async () => {
    await renderizar([item(T + 1000)]);
    expect(vi.getTimerCount()).toBe(1);
    await renderizar([item(T - 1)]);
    expect(selos()).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("prazo além do teto nativo rearma sem vencer cedo nem criar polling", async () => {
    const teto = 2_147_483_647;
    await renderizar([item(T + teto + 1000)]);
    expect(vi.getTimerCount()).toBe(1);
    await avancar(teto);
    expect(selos()).toBe(0);
    expect(vi.getTimerCount()).toBe(1);
    await avancar(1000);
    expect(selos()).toBe(0);
    await avancar(1);
    expect(selos()).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
