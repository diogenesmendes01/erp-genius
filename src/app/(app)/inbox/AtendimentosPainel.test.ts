import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/server/whatsapp/operacoes-atendimento", () => ({ abrirAtendimentoInstitucional: vi.fn(), classificarMensagemWhatsApp: vi.fn(), revisarFalhaEnvio: vi.fn() }));

import { AtendimentosPainel } from "./AtendimentosPainel";

describe("AtendimentosPainel", () => {
  it("mostra a triagem administrativa no fuso preferido sem modificar o formulário", () => {
    const html = renderToStaticMarkup(createElement(AtendimentosPainel, {
      opcoes: { destinos: [], numeros: [] }, revisoes: null,
      triagem: [{ id: "mensagem", nome: "Ana", criadoEm: "2026-10-01T02:30:00.000Z", corpo: "Olá", tipo: "TEXTO", midiaPath: null, atendimentos: [] }],
      preferenciaFusoExibicao: "America/Costa_Rica",
    } as never));
    expect(html).toMatch(/30\/09\/2026.*20:30/);
    expect(html).toContain('minLength="12"');
    expect(html).toContain("Classificar esta mensagem");
  });
});
