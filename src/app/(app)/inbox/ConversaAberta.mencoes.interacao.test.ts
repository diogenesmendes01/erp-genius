import { act, createElement, useEffect } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Elemento } from "@/test/dom-minimo";
import type { PropsCompositor } from "@/components/conversa/Compositor";
import type { PropsConversaAberta } from "./ConversaAberta";

const m = vi.hoisted(() => ({ buscas: [] as NonNullable<PropsCompositor["buscarMencoes"]>[] }));
vi.mock("./RodapeConversa", () => ({ RodapeConversa: (p: PropsCompositor) => {
  const buscar = p.buscarMencoes!;
  m.buscas.push(buscar);
  useEffect(() => { void buscar("Jo"); }, [buscar]);
  return null;
} }));
vi.mock("./CabecalhoConversa", () => ({ CabecalhoConversa: () => null }));
vi.mock("./AcoesAtendimento", () => ({ useAcoesAtendimento: () => ({ feedback: null, dialogos: null, abrirAgendar: null }) }));
vi.mock("./AcoesMensagem", () => ({ AcoesMensagem: () => null }));
vi.mock("@/components/conversa/VirtualList", () => ({ VirtualList: () => null }));
vi.mock("@/components/conversa/agora-thread", () => ({ useAgoraDaThread: () => Date.UTC(2026, 9, 24, 12) }));
vi.mock("@/server/whatsapp/acoes", () => ({ enviarMidiaInbox: vi.fn(), enviarTextoInbox: vi.fn() }));
vi.mock("@/server/whatsapp/acoes-conversa", () => ({ registrarNotaAtendimento: vi.fn() }));
vi.mock("@/server/whatsapp/consultas-acoes-atendimento", () => ({ origemVisivelDaTransferencia: vi.fn() }));
vi.mock("@/server/crm-config/acoes-respostas", () => ({ respostasRapidasDoCompositor: async () => [] }));

let root: Root, host: Elemento;
let ConversaAberta: typeof import("./ConversaAberta").ConversaAberta;
const fetchMock = vi.fn<typeof fetch>(async () => ({ ok: true, json: async () => [] }) as unknown as Response);
const props = (id = "a"): PropsConversaAberta => ({ item: { id, capacidades: [], status: "EM_ATENDIMENTO", grupo: false }, usuario: { id: "u", papeis: [] }, fuso: "UTC", conversa: { mensagens: [], notas: [], temMaisAntes: false, temMaisDepois: false }, aoVoltar() {}, aoAlternarPainel() {}, aoMudar() {}, podeEnviar: false } as unknown as PropsConversaAberta);
const renderizar = async (p = props()) => { await act(async () => root.render(createElement(ConversaAberta, p))); };

beforeEach(async () => {
  const dom = criarDomMinimo();
  vi.stubGlobal("document", dom.documento); vi.stubGlobal("window", dom.janela); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("fetch", fetchMock);
  m.buscas.length = 0; fetchMock.mockClear();
  host = dom.documento.createElement("div"); dom.documento.body.appendChild(host);
  const { createRoot } = await import("react-dom/client"); root = createRoot(host as unknown as HTMLElement);
  ({ ConversaAberta } = await import("./ConversaAberta"));
});
afterEach(async () => { await act(async () => root.unmount()); desligarObservadores(); vi.unstubAllGlobals(); });

it("re-render do pai sem trocar atendimento não repete GET do consumidor", async () => {
  await renderizar(); expect(fetchMock).toHaveBeenCalledTimes(1);
  await renderizar(props("a")); expect(fetchMock).toHaveBeenCalledTimes(1);
  await renderizar(props("b")); expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("/b/mencoes?");
});
it("callback captura somente o atendimento e repassa o AbortSignal ao fetch", async () => {
  await renderizar(props("a/?"));
  const controlador = new AbortController();
  await m.buscas.at(-1)!("A & B", controlador.signal);
  expect(fetchMock).toHaveBeenLastCalledWith("/api/inbox/atendimentos/a%2F%3F/mencoes?q=A+%26+B", expect.objectContaining({ credentials: "same-origin", cache: "no-store", signal: controlador.signal }));
});
