import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import LoginPage from "./page";

describe("LoginPage — acessibilidade", () => {
  it("cada rótulo aponta para o campo que descreve (clicar no rótulo foca o campo; leitor de tela anuncia o nome)", () => {
    const html = renderToStaticMarkup(createElement(LoginPage));
    expect(html).toMatch(/<label[^>]*for="login-email"[^>]*>E-mail<\/label>/);
    expect(html).toMatch(/<input[^>]*id="login-email"/);
    expect(html).toMatch(/<label[^>]*for="login-senha"[^>]*>Senha<\/label>/);
    expect(html).toMatch(/<input[^>]*id="login-senha"/);
  });

  it("sem erro, os campos não se anunciam como inválidos", () => {
    const html = renderToStaticMarkup(createElement(LoginPage));
    expect(html).not.toContain("aria-invalid");
    expect(html).not.toContain('role="alert"');
  });
});
