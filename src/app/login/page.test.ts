import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ errors: {} as Record<string, { message: string }> }));
vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
// Erros do react-hook-form só existem após um submit real, que o render estático não faz.
// `register` devolve um `id` conflitante de propósito: prova que os overrides de a11y vêm
// DEPOIS do spread e não são sobrescritos por ele.
vi.mock("react-hook-form", () => ({
  useForm: () => ({
    register: (nome: string) => ({ name: nome, id: "id-do-register", onChange: () => {}, onBlur: () => {}, ref: () => {} }),
    handleSubmit: () => () => {},
    formState: { errors: m.errors, isSubmitting: false },
  }),
}));

import LoginPage from "./page";

beforeEach(() => {
  m.errors = {};
});

describe("LoginPage — acessibilidade", () => {
  it("cada rótulo aponta para o campo que descreve, e o id de a11y vence o spread do register", () => {
    const html = renderToStaticMarkup(createElement(LoginPage));
    expect(html).toMatch(/<label[^>]*for="login-email"[^>]*>E-mail<\/label>/);
    expect(html).toMatch(/<input[^>]*id="login-email"/);
    expect(html).toMatch(/<label[^>]*for="login-senha"[^>]*>Senha<\/label>/);
    expect(html).toMatch(/<input[^>]*id="login-senha"/);
    expect(html).not.toContain("id-do-register");
  });

  it("sem erro, nenhum campo se anuncia como inválido nem aponta para mensagem", () => {
    const html = renderToStaticMarkup(createElement(LoginPage));
    expect(html).not.toContain("aria-invalid");
    expect(html).not.toContain("aria-describedby");
    expect(html).not.toContain('role="alert"');
  });

  it("com erro de campo, marca o campo como inválido, liga-o à mensagem e anuncia de forma educada (polite)", () => {
    m.errors = { email: { message: "E-mail inválido" } };
    const html = renderToStaticMarkup(createElement(LoginPage));
    expect(html).toMatch(/<input(?=[^>]*id="login-email")(?=[^>]*aria-invalid="true")(?=[^>]*aria-describedby="login-email-erro")[^>]*>/);
    expect(html).toMatch(/<p(?=[^>]*id="login-email-erro")(?=[^>]*aria-live="polite")[^>]*>E-mail inválido<\/p>/);
    // Erro de campo não interrompe o leitor de tela (alert é reservado à falha de autenticação).
    expect(html).not.toContain('role="alert"');
    // O outro campo segue válido.
    expect(html).not.toMatch(/<input(?=[^>]*id="login-senha")(?=[^>]*aria-invalid)[^>]*>/);
  });

  it("a região de erro existe mesmo vazia — aria-live só anuncia mudanças numa região já montada", () => {
    const html = renderToStaticMarkup(createElement(LoginPage));
    expect(html).toMatch(/<p(?=[^>]*id="login-email-erro")(?=[^>]*aria-live="polite")[^>]*><\/p>/);
    expect(html).toMatch(/<p(?=[^>]*id="login-senha-erro")(?=[^>]*aria-live="polite")[^>]*><\/p>/);
  });
});
