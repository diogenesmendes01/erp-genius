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

  const painel = (opcoes: object) => renderToStaticMarkup(createElement(AtendimentosPainel, {
    opcoes, revisoes: null, triagem: null, preferenciaFusoExibicao: null,
  } as never));
  const FALTA_CANAL = "A administração precisa disponibilizar um canal ativo";

  it("vendedor sem lead na carteira: orienta a cadastrar o lead — não culpa a falta de canal", () => {
    const html = painel({ destinos: [], numeros: [], comercial: true });
    expect(html).toContain("Nenhum lead na sua carteira para iniciar uma conversa");
    expect(html).not.toContain(FALTA_CANAL);
  });

  it("papel não comercial sem destinatário: mensagem de escopo, sem falar em canal", () => {
    const html = painel({ destinos: [], numeros: [], comercial: false });
    expect(html).toContain("Nenhum destinatário no seu escopo");
    expect(html).not.toContain(FALTA_CANAL);
    expect(html).not.toContain("Nenhum lead na sua carteira");
  });

  it("há destinatário mas nenhum canal ativo: aí sim a administração precisa disponibilizar o canal", () => {
    const html = painel({ destinos: [{ chave: "SECRETARIA:a1", nome: "Secretaria · Ana", finalidade: "SECRETARIA", alunoId: "a1" }], numeros: [], comercial: false });
    expect(html).toContain(FALTA_CANAL);
    expect(html).not.toContain("Nenhum destinatário no seu escopo");
  });
});
