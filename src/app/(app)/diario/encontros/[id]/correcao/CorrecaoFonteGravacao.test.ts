import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("@/server/gravacoes/regularizacao-fonte", () => ({ proporRegularizacaoFonteGravacao: vi.fn() }));

import { CorrecaoFonteGravacao } from "./CorrecaoFonteGravacao";

it("mostra a proposta de fonte só no contexto da publicação autorizada", () => {
  const html = renderToStaticMarkup(createElement(CorrecaoFonteGravacao, { publicacaoId: "publicacao-interna", podePropor: true }));

  expect(html).toContain("Correção da gravação oficial");
  expect(html).toContain("Propor nova fonte para revisão");
  expect(html).toContain('name="arquivoOficialId"');
  expect(html).not.toContain("publicacao-interna");
});

it("preserva a orientação histórica sem expor o formulário a quem não pode propor", () => {
  const html = renderToStaticMarkup(createElement(CorrecaoFonteGravacao, { publicacaoId: "publicacao-interna", podePropor: false }));

  expect(html).toContain("permanece no histórico");
  expect(html).not.toContain("<form");
});