import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { PopoverTransferir } from "./PopoverTransferir";
it("escolha inicial reúne as quatro alternativas sem presença, carga ou ação implícita", () => {
  const executar = vi.fn();
  const html = renderToStaticMarkup(createElement(PopoverTransferir, { atendimentoId: "a", ancora: { current: null }, opcoes: { visivel: true, pessoas: true, setores: ["SECRETARIA"], filaDoSetor: "COMERCIAL", aria: true }, pessoas: [{ id: "b", nome: "Beatriz" }], destinos: [], aoFechar() {}, aoExecutar: executar }));
  for (const texto of ["Pessoas", "Equipes e filas", "Devolver para a Aria", "Cancelar"]) expect(html).toContain(texto);
  expect(html).not.toContain("online"); expect(html).not.toContain("conversas abertas"); expect(executar).not.toHaveBeenCalled();
});
it("nenhuma capacidade não fabrica um diálogo operacional", () => {
  expect(renderToStaticMarkup(createElement(PopoverTransferir, { atendimentoId: "a", ancora: { current: null }, opcoes: { visivel: false, pessoas: false, setores: [], filaDoSetor: null, aria: false }, pessoas: [], destinos: [], aoFechar() {}, aoExecutar: vi.fn() }))).toBe("");
});
