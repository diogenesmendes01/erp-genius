import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// docs/42 /portal-aluno/recuperar (docs/43 §6 item 8): a tela abre com o formulário e o aviso de resposta neutra,
// sem nenhuma confirmação antes do envio. Nenhuma requisição: a chamada à rota é um mock.
const pedir = vi.hoisted(() => vi.fn());
vi.mock("../requisicoes", async (original) => ({ ...(await original<typeof import("../requisicoes")>()), pedirRecuperacaoPortalAluno: pedir }));

import RecuperarPortalAlunoPage from "./page";

describe("recuperar — render", () => {
  const html = renderToStaticMarkup(createElement(RecuperarPortalAlunoPage));

  it("formulário com o e-mail ligado ao rótulo, obrigatório e com autocomplete", () => {
    expect(html).toMatch(/<label[^>]*for="recuperar-email"[^>]*>E-mail/);
    expect(html).toMatch(/<input(?=[^>]*id="recuperar-email")(?=[^>]*type="email")(?=[^>]*autocomplete="email")(?=[^>]*required)[^>]*>/);
    expect(html).toContain("Solicitar recuperação");
  });

  it("avisa que a resposta é neutra e não confirma nada antes do envio", () => {
    expect(html).toContain("a resposta é a mesma havendo ou não uma conta");
    expect(html).not.toContain("Pedido registrado");
    // A região de status já está montada, vazia, para anunciar a confirmação.
    expect(html).toContain('<p role="status" class="sr-only"></p>');
    expect(html).not.toContain('role="alert"');
    expect(pedir).not.toHaveBeenCalled();
  });

  it("o botão de envio é o do design system (primário, submit) e há a volta para a entrada", () => {
    expect(html).toMatch(/<button(?=[^>]*type="submit")(?=[^>]*bg-brand-solid)[^>]*>Solicitar recuperação<\/button>/);
    expect(html).toContain('href="/portal-aluno/entrar"');
  });
});
