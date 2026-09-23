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
});
