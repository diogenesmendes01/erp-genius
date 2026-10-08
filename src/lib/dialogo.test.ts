import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { criarPilhaDialogos, proximoFocoPreso } from "./dialogo";
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

describe("pilha de diálogos (confirmação aberta sobre outro diálogo)", () => {
  it("só o diálogo de cima responde ao teclado; ao fechar, o de baixo volta a responder", () => {
    const pilha = criarPilhaDialogos();
    const gaveta = {}, confirmacao = {};
    pilha.abrir(gaveta);
    expect(pilha.noTopo(gaveta)).toBe(true);
    pilha.abrir(confirmacao);
    expect(pilha.noTopo(confirmacao)).toBe(true);
    expect(pilha.noTopo(gaveta)).toBe(false); // Escape não fecha a gaveta de trás
    pilha.fechar(confirmacao);
    expect(pilha.noTopo(gaveta)).toBe(true);
    pilha.fechar(gaveta);
    expect(pilha.noTopo(gaveta)).toBe(false);
  });

  it("fechar fora de ordem tira só aquele diálogo", () => {
    const pilha = criarPilhaDialogos();
    const a = {}, b = {}, c = {};
    pilha.abrir(a); pilha.abrir(b); pilha.abrir(c);
    pilha.fechar(b);
    expect(pilha.noTopo(c)).toBe(true);
    pilha.fechar(c);
    expect(pilha.noTopo(a)).toBe(true);
    pilha.fechar({}); // desconhecido: nada muda
    expect(pilha.noTopo(a)).toBe(true);
  });
});

describe("Modal como alertdialog (ConfirmarAcao)", () => {
  it("papel alertdialog, descrito pelo id dado; o padrão continua dialog sem descrição", () => {
    const html = renderToStaticMarkup(createElement(Modal, { titulo: "Cancelar a fatura?", aoFechar: () => {}, papel: "alertdialog", descricaoId: "consequencia" }, createElement("p", { id: "consequencia" }, "Sem desfazer.")));
    const caixa = html.match(/<div[^>]*role="alertdialog"[^>]*>/)![0];
    expect(caixa).toContain('aria-modal="true"');
    expect(caixa).toContain('aria-describedby="consequencia"');
    const padrao = renderToStaticMarkup(createElement(Modal, { titulo: "Registrar recebimento", aoFechar: () => {} }));
    expect(padrao).toMatch(/role="dialog"/);
    expect(padrao).not.toContain("aria-describedby");
  });
});
