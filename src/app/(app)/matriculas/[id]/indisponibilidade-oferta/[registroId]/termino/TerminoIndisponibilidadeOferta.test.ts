import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/matricula/indisponibilidade-oferta-termino", () => ({
  consultarTerminosIndisponibilidadeOferta: vi.fn(),
  decidirTerminoIndisponibilidadeOferta: vi.fn(),
  proporTerminoIndisponibilidadeOferta: vi.fn(),
}));

import { TerminoIndisponibilidadeOferta } from "./TerminoIndisponibilidadeOferta";

describe("TerminoIndisponibilidadeOferta", () => {
  it("não deixa escolher um último dia anterior ao início relatado (validado no navegador, antes do envio)", () => {
    const html = renderToStaticMarkup(createElement(TerminoIndisponibilidadeOferta, {
      registroId: "registro",
      inicio: "2026-09-10",
      dados: { pagina: 1, temProxima: false, podePropor: true, propostas: [] },
      fusoInstitucional: null,
    } as never));
    expect(html).toMatch(/<input(?=[^>]*name="fim")(?=[^>]*type="date")(?=[^>]*min="2026-09-10")[^>]*>/);
  });

  it("histórico vazio: na primeira página diz que não há propostas; numa página seguinte, fala da página e volta ao início (docs/42)", () => {
    const render = (pagina: number) => renderToStaticMarkup(createElement(TerminoIndisponibilidadeOferta, {
      registroId: "registro",
      inicio: "2026-09-10",
      dados: { pagina, temProxima: false, podePropor: true, propostas: [] },
      fusoInstitucional: null,
    } as never));
    const primeira = render(1);
    expect(primeira).toContain("Nenhuma proposta de término registrada para esta indisponibilidade.");
    expect(primeira).not.toContain("nesta página");
    expect(primeira).not.toContain("Ir para a primeira página");

    const seguinte = render(3);
    expect(seguinte).toContain("Nenhuma proposta registrada nesta página.");
    expect(seguinte).not.toContain("para esta indisponibilidade.");
    expect(seguinte).toMatch(/<a[^>]*href="\?pagina=1"[^>]*>Ir para a primeira página<\/a>/);
  });

  // docs/43 §6 item 6 (docs/42 L939): sem fuso da escola, o instante era o ISO cru com "(fuso institucional não configurado)".
  it("sem fuso da escola: aviso explícito com o caminho para configurar, e o instante em UTC formatado — não o ISO", () => {
    const proposta = { id: "p", fim: "2026-09-20", motivo: "Motivo", evidenciaTexto: "Evidência", criadaEm: "2026-09-12T13:41:07.482Z", decisao: null, podeDecidir: false };
    const render = (fusoInstitucional: string | null) => renderToStaticMarkup(createElement(TerminoIndisponibilidadeOferta, {
      registroId: "registro", inicio: "2026-09-10", dados: { pagina: 1, temProxima: false, podePropor: false, propostas: [proposta] }, fusoInstitucional,
    } as never));
    const sem = render(null);
    expect(sem).toContain("Fuso da escola não configurado; horários exibidos em UTC.");
    expect(sem).toContain('href="/configuracao/operacao"');
    expect(sem).toContain("Proposta registrada em 12/09/2026, 13:41 UTC.");
    expect(sem).not.toContain("2026-09-12T13:41");
    const com = render("America/Sao_Paulo");
    expect(com).not.toContain("Fuso da escola não configurado");
    expect(com).toContain("Proposta registrada em 12/09/2026, 10:41.");
  });
});
