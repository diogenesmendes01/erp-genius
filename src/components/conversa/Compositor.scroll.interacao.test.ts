import { act, createElement, StrictMode } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Elemento } from "@/test/dom-minimo";
import { useRevisoesRascunhos } from "./rascunhos-conversa";
import type { PropsCompositor } from "./Compositor";

vi.mock("@tabler/icons-react", () => Object.fromEntries(["IconCalendarEvent", "IconMicrophone", "IconMoodSmile", "IconPaperclip", "IconPlayerStop", "IconSend", "IconTrash"].map(k => [k, () => null])));
let root: Root, host: Elemento;
let Compositor: typeof import("./Compositor").Compositor;
const storage = new Map<string, string>();
function props(p: Partial<PropsCompositor> = {}): PropsCompositor {
  return { atendimentoId: "A", modo: "nota", podeEnviar: true, capacidades: [], aoEnviarTexto: async () => ({ ok: true }), aoEnviarMidia: async () => ({ ok: true }), aoNota: async () => ({ ok: true }), ...p };
}
function Tela(p: PropsCompositor) {
  const revisoesRascunhos = useRevisoesRascunhos();
  return createElement(Compositor, { ...p, revisoesRascunhos, key: p.atendimentoId });
}
function eventos(el: Elemento) {
  const k = Object.keys(el).find(k => k.startsWith("__reactProps"))!;
  return (el as unknown as Record<string, Record<string, (e?: unknown) => void>>)[k];
}
async function montar(p = props()) { await act(async () => root.render(createElement(StrictMode, null, createElement(Tela, p)))); }
async function digitar(v: string) {
  const campo = host.querySelector("textarea")!;
  await act(async () => eventos(campo).onChange({ target: { value: v, selectionStart: v.length } }));
}
async function enviar() {
  const botao = [...host.querySelectorAll("button")].find(b => b.textContent === "Enviar")!;
  await act(async () => eventos(botao).onClick());
}
beforeEach(async () => {
  const dom = criarDomMinimo();
  vi.stubGlobal("document", dom.documento); vi.stubGlobal("window", dom.janela);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("localStorage", { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) });
  storage.clear();
  host = dom.documento.createElement("div"); dom.documento.body.appendChild(host);
  const { createRoot } = await import("react-dom/client"); root = createRoot(host as unknown as HTMLElement);
  ({ Compositor } = await import("./Compositor"));
});
afterEach(async () => { await act(async () => root.unmount()); desligarObservadores(); vi.unstubAllGlobals(); });

/** Fronteira nativa observada em Chromium 320x500: trocar value longo por vazio
 * limita scrollTop a 20, pois o placeholder ocupa 62px numa area de 42px.
 * ReactDOM e o ACK/owner sao reais; nao ha layout sintetico na aplicacao.
 */
function campoComRolagem() {
  const campo = host.querySelector("textarea")! as Elemento & Pick<HTMLTextAreaElement, "value" | "scrollTop">;
  let valor = String(campo.value ?? ""), topo = 0;
  Object.defineProperties(campo, {
    value: { configurable: true, get: () => valor, set: (v: string) => {
      if (valor !== v) { valor = v; if (v === "") topo = Math.min(topo, 20); }
    } },
    scrollTop: { configurable: true, get: () => topo, set: (v: number) => { topo = v; } },
  });
  return campo;
}
it.each(["nota", "responder"] as const)("ACK atual de %s limpa rolagem do campo vazio apos commit sem mover foco", async modo => {
  let concluir!: (r: { ok: true }) => void;
  const pendente = new Promise<{ ok: true }>(r => { concluir = r; });
  await montar(props({ modo, aoNota: () => pendente, aoEnviarTexto: () => pendente }));
  const campo = campoComRolagem(); await digitar("texto longo confirmado"); campo.scrollTop = 127;
  await enviar();
  const externo = host.ownerDocument!.createElement("button"); host.ownerDocument!.body.appendChild(externo); externo.focus();
  await act(async () => concluir({ ok: true }));
  expect(campo.value).toBe("");
  expect(campo.scrollTop).toBe(0);
  expect(campo.ownerDocument?.activeElement).toBe(externo);
  expect(storage.has("conversa-rascunho:A:" + modo)).toBe(false);
});
it("erro de envio conserva texto, rolagem e foco do rascunho", async () => {
  let concluir!: (r: { ok: false; erro: string }) => void;
  await montar(props({ aoNota: () => new Promise(r => { concluir = r; }) }));
  const campo = campoComRolagem(); await digitar("rascunho nao confirmado"); campo.scrollTop = 87; campo.focus();
  await enviar(); await act(async () => concluir({ ok: false, erro: "Negado" }));
  expect(campo.value).toBe("rascunho nao confirmado");
  expect(campo.scrollTop).toBe(87); expect(campo.ownerDocument?.activeElement).toBe(campo);
});
it("ACK antigo conserva texto e rolagem de uma intencao mais nova", async () => {
  let concluir!: (r: { ok: true }) => void;
  await montar(props({ aoNota: () => new Promise(r => { concluir = r; }) }));
  const campo = campoComRolagem(); await digitar("tentativa antiga"); await enviar();
  await digitar("rascunho novo"); campo.scrollTop = 63; campo.focus();
  await act(async () => concluir({ ok: true }));
  expect(campo.value).toBe("rascunho novo"); expect(campo.scrollTop).toBe(63);
  expect(campo.ownerDocument?.activeElement).toBe(campo);
});
it("troca de contexto sem key conserva a rolagem do rascunho nao vazio", async () => {
  await act(async () => root.render(createElement(Compositor, props())));
  const campo = campoComRolagem(); await digitar("rascunho A"); campo.scrollTop = 55;
  storage.set("conversa-rascunho:B:nota", "rascunho B");
  const externo = host.ownerDocument!.createElement("button"); host.ownerDocument!.body.appendChild(externo); externo.focus();
  await act(async () => root.render(createElement(Compositor, props({ atendimentoId: "B" }))));
  expect(campo.value).toBe("rascunho B"); expect(campo.scrollTop).toBe(55);
  expect(campo.ownerDocument?.activeElement).toBe(externo);
});
