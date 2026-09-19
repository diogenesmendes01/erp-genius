import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/agenda/replanejamento-decisao", () => ({ decidirEAplicarReplanejamentoConjunto: vi.fn() }));

import { DecidirReplanejamento } from "./DecidirReplanejamento";

describe("DecidirReplanejamento", () => {
  it("mantém a exceção vinculada ao fuso da turma e só altera sua apresentação", () => {
    const html = renderToStaticMarkup(createElement(DecidirReplanejamento, {
      calendarioId: "cal", revisaoId: "rev", podeAprovar: true, podeRejeitar: true, preferenciaFusoExibicao: "America/Costa_Rica",
      excecoes: [{ encontroId: "encontro", codigo: "T-01", inicio: "2026-10-01T02:30:00.000Z", fusoOrigem: "America/Sao_Paulo", motivoProposto: "Feriado conferido" }],
    }));
    expect(html).toMatch(/30\/09\/2026.*20:30/);
    expect(html).toContain("America/Costa_Rica; origem America/Sao_Paulo");
    expect(html).toContain('value="aprovar"');
    expect(html).toContain('value="rejeitar"');
  });
});
