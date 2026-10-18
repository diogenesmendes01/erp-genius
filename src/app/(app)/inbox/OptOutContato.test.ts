import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/whatsapp/acoes", () => ({ registrarOptOutContato: vi.fn(), removerOptOutContato: vi.fn() }));

import { OptOutContato } from "./OptOutContato";

const h = (p: { optOut: boolean; podeReautorizar: boolean }) =>
  renderToStaticMarkup(createElement(OptOutContato, { contatoId: "c1", nome: "Maria", ...p }));

describe("OptOutContato", () => {
  it("sem opt-out: botão Registrar opt-out (a action só roda na confirmação)", () => {
    const t = h({ optOut: false, podeReautorizar: false });
    expect(t).toContain("Registrar opt-out");
    expect(t).not.toContain("Remover opt-out");
  });
  it("em opt-out: aviso; só o administrador vê Remover opt-out com evidência", () => {
    const comum = h({ optOut: true, podeReautorizar: false });
    expect(comum).toContain("pediu opt-out");
    expect(comum).not.toContain("Remover opt-out");
    const admin = h({ optOut: true, podeReautorizar: true });
    expect(admin).toContain("Remover opt-out");
    expect(admin).toContain('minLength="12"');
  });
});
