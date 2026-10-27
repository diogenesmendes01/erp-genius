import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

import PortalLegado from "./page";

describe("/portal (endereço legado)", () => {
  const html = renderToStaticMarkup(createElement(PortalLegado));

  it("não redireciona calado", () => {
    expect(redirect).not.toHaveBeenCalled();
  });

  it("explica que a área do aluno tem acesso próprio, separado do login da equipe", () => {
    expect(html).toMatch(/<h1[^>]*>A área do aluno tem acesso próprio<\/h1>/);
    expect(html).toContain("e-mail individual confirmado no seu convite");
  });

  it("leva à entrada da área do aluno e permite sair da sessão da equipe", () => {
    expect(html).toContain('href="/portal-aluno/entrar"');
    expect(html).toContain("Entrar na área do aluno");
    expect(html).toContain(">Sair<");
  });
});
