import { afterEach, expect, it, vi } from "vitest";
import { combinacoes } from "../../scripts/visual/nucleo-captura.mjs";
import { semanticaThreadHumanaPronta } from "../../scripts/visual/espera-app.mjs";
import { criarDomMinimo, desligarObservadores, type Elemento } from "./dom-minimo";

afterEach(() => { desligarObservadores(); vi.unstubAllGlobals(); });
it("humano-compositor cobre três tamanhos nos dois temas e dois alvos", () => {
  const c = combinacoes({ alvos: ["app", "prototipo"], estados: ["humano-compositor"] });
  expect(c).toHaveLength(12);
  expect(new Set(c.map(x => x.tamanho))).toEqual(new Set(["desktop", "tablet", "celular"]));
});
it("prontidão humana exige autor, dia, status e nota sem comandos/mídia antes da foto", () => {
  const { documento } = criarDomMinimo(); vi.stubGlobal("document", { querySelector: (s: string) => documento.documentElement.querySelector(s) });
  const el = (tag: string, attrs: Record<string, string> = {}, texto = "", pai: Elemento = documento.body) => {
    const n = documento.createElement(tag); for (const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); n.textContent = texto; pai.appendChild(n); return n;
  };
  const conversa = el("section", { "aria-label": "Conversa" });
  expect(semanticaThreadHumanaPronta()).toBe(false);
  const msg = el("div", { "data-mensagem-id": "msg" }, "", conversa);
  el("span", {}, "Você", msg); el("span", { title: "Lida" }, "", msg);
  const nota = el("div", { role: "note", "data-nota-id": "nota" }, "Nota interna · só equipe", conversa);
  expect(semanticaThreadHumanaPronta()).toBe(false);
  el("div", { "data-virtual-key": "dia:2026-10-22" }, "Hoje", conversa);
  expect(semanticaThreadHumanaPronta()).toBe(true);
  const botao = el("button", {}, "Opções", nota); expect(semanticaThreadHumanaPronta()).toBe(false);
  nota.removeChild(botao); const midia = el("img", {}, "", nota); expect(semanticaThreadHumanaPronta()).toBe(false);
  nota.removeChild(midia); expect(semanticaThreadHumanaPronta()).toBe(true);
  el("div", { role: "note", "data-nota-id": "nota-sequencia" }, "Continuação da mesma autoria, sem repetir cabeçalho", conversa);
  expect(semanticaThreadHumanaPronta()).toBe(true);
});
