import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/whatsapp/operacoes-atendimento", () => ({ classificarMensagemWhatsApp: vi.fn(), revisarFalhaEnvio: vi.fn() }));

import { PainelTriagem } from "./PainelTriagem";

const triagem = [{ id: "mensagem", nome: "Ana", criadoEm: "2026-10-01T02:30:00.000Z", corpo: "Olá", tipo: "TEXTO", midiaPath: null, atendimentos: [] }];
const revisoes = [{ id: "r1", corpo: "Boleto", motivo: "resultado_incerto", criadoEm: "2026-10-01T02:30:00.000Z", contato: "Bia" }];
const painel = (props: object) => renderToStaticMarkup(createElement(PainelTriagem, { triagem: null, revisoes: null, preferenciaFusoExibicao: null, ...props } as never));

describe("PainelTriagem", () => {
  it("mostra a triagem no fuso preferido, com motivo de 12+ caracteres", () => {
    const html = painel({ triagem, preferenciaFusoExibicao: "America/Costa_Rica" });
    expect(html).toMatch(/30\/09\/2026.*20:30/);
    expect(html).toContain('minLength="12"');
    expect(html).toContain("Classificar esta mensagem");
    expect(html).not.toContain("Envios que exigem revisão");
  });

  it("revisão de envio incerto só aparece quando a página a entrega (administrador)", () => {
    const html = painel({ revisoes });
    expect(html).toContain("Envios que exigem revisão · 1");
    expect(html).toContain("Registrar revisão");
    expect(html).not.toContain("Triagem administrativa");
  });

  it("sem triagem nem revisão (papel sem alçada) não renderiza nada", () => {
    expect(painel({})).toBe("");
  });

  it("listas vazias valem como ausência: sem <details> com zero pendências", () => {
    expect(painel({ triagem: [], revisoes: [] })).toBe("");
    const soRevisao = painel({ triagem: [], revisoes });
    expect(soRevisao).not.toContain("Triagem administrativa");
    expect(soRevisao).toContain("Envios que exigem revisão · 1");
    const soTriagem = painel({ triagem, revisoes: [] });
    expect(soTriagem).not.toContain("Envios que exigem revisão");
    expect(soTriagem).toContain("Triagem administrativa · 1");
  });
});
