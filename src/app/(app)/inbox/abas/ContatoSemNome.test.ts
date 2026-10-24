import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ContatoSemNome } from "./ContatoSemNome";
const h = (extra: object = {}) => renderToStaticMarkup(createElement(ContatoSemNome, { atendimentoId: "a1", nomeAnterior: null, podeEditar: true, aoMudar() {}, ...extra }));
it("explica a origem pelo telefone sem prometer automação Aria inexistente", () => {
  const html = h(); expect(html).toContain("Contato sem nome, criado pelo telefone."); expect(html).toContain("Você pode preencher agora."); expect(html).not.toContain("Aria vai perguntar");
});
it("oferece campo nomeado e Salvar apenas com edição autorizada", () => {
  expect(h()).toContain('aria-label="Nome do contato"'); expect(h()).toContain('maxLength="80"'); expect(h()).toContain(">Salvar<");
  const html = h({ podeEditar: false }); expect(html).toContain("Contato sem nome"); expect(html).not.toContain("<input"); expect(html).not.toContain("<button"); expect(html).not.toContain("preencher agora");
});
