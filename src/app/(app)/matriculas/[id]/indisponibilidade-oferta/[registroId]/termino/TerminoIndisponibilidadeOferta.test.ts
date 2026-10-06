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
});
