import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { proximoFocoPreso } from "./dialogo";
import { Modal } from "@/components/Modal";

describe("proximoFocoPreso (Tab preso no diálogo)", () => {
  const [a, b, c] = ["a", "b", "c"];
  it("Tab no último volta ao primeiro; Shift+Tab no primeiro vai ao último", () => {
    expect(proximoFocoPreso([a, b, c], c, false)).toBe(a);
    expect(proximoFocoPreso([a, b, c], a, true)).toBe(c);
  });
  it("no meio da lista o navegador segue sozinho (null)", () => {
    expect(proximoFocoPreso([a, b, c], b, false)).toBeNull();
    expect(proximoFocoPreso([a, b, c], b, true)).toBeNull();
  });
  it("foco fora do diálogo é trazido para dentro", () => {
    expect(proximoFocoPreso([a, b, c], "fora", false)).toBe(a);
    expect(proximoFocoPreso([a, b, c], null, true)).toBe(c);
  });
  it("diálogo sem focáveis: nada a fazer", () => {
    expect(proximoFocoPreso([], null, false)).toBeNull();
  });
});

describe("Modal", () => {
  it("é um diálogo modal nomeado pelo título, com altura limitada e rolagem interna", () => {
    const html = renderToStaticMarkup(createElement(Modal, { titulo: "Registrar recebimento", aoFechar: () => {} }, createElement("p", null, "corpo")));
    const dialogo = html.match(/<div[^>]*role="dialog"[^>]*>/)![0];
    expect(dialogo).toContain('aria-modal="true"');
    expect(dialogo).toContain('tabindex="-1"');
    expect(dialogo).toContain("max-h-[90dvh]");
    expect(dialogo).toContain("overflow-y-auto");
    const id = dialogo.match(/aria-labelledby="([^"]+)"/)![1];
    expect(html).toContain(`<h3 id="${id}" class="mb-3 text-sm font-medium">Registrar recebimento</h3>`);
  });
});
