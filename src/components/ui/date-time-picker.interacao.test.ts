import { act, createElement, useState } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Documento, type Elemento } from "@/test/dom-minimo";
import { DateTimePicker } from "@/components/ui/date-time-picker";

let root: Root;
let doc: Documento;

function eventos(el: Elemento) {
  const chave = Object.keys(el).find((k) => k.startsWith("__reactProps"));
  return (el as unknown as Record<string, { onChange?: (e: unknown) => void }>)[chave ?? ""];
}

function Harness({ inicial = "2026-12-01T13:05" }: { inicial?: string }) {
  const [valor, setValor] = useState(inicial);
  return createElement("form", null, createElement(DateTimePicker, {
    name: "quando",
    fuso: "America/Sao_Paulo",
    required: true,
    value: valor,
    onChange: (e: { target: { value: string } }) => setValor(e.target.value),
  }));
}

beforeEach(async () => {
  const d = criarDomMinimo();
  doc = d.documento;
  Object.assign(doc, { createElementNS: (_ns: string, tag: string) => doc.createElement(tag) });
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", d.janela);
  vi.stubGlobal("MutationObserver", d.MutationObserver);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = doc.createElement("div");
  doc.body.appendChild(host);
  const { createRoot } = await import("react-dom/client");
  root = createRoot(host as unknown as HTMLElement);
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  desligarObservadores();
  vi.unstubAllGlobals();
});

it("o html montado não tem select nem datetime-local, e o hidden acompanha o valor local", async () => {
  await act(async () => root.render(createElement(Harness, {})));
  const campo = doc.body.querySelector('[name="quando"]')!;
  expect(doc.body.querySelector("select")).toBeNull();
  expect(doc.body.querySelector('[type="datetime-local"]')).toBeNull();
  expect(campo.getAttribute("type")).toBe("hidden");
  expect((campo as unknown as { value: string }).value).toBe("2026-12-01T13:05");
  expect(campo.getAttribute("data-fuso")).toBe("America/Sao_Paulo");
  await act(async () => eventos(campo).onChange?.({ target: { value: "2026-12-01T18:05" } }));
  expect((doc.body.querySelector('[name="quando"]') as unknown as { value: string }).value).toBe("2026-12-01T18:05");
  expect(doc.body.querySelector("select")).toBeNull();
});
