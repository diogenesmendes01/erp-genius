import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { AgendaPublicada } from "./AgendaPublicada";

describe("AgendaPublicada", () => {
  it("usa a preferência válida somente como padrão visual", () => {
    const html = renderToStaticMarkup(createElement(AgendaPublicada, { preferenciaFusoExibicao: "America/Costa_Rica", agenda: {
      id: "agenda", inicio: "2026-10-01T02:30:00.000Z", fim: "2026-10-01T03:30:00.000Z", fusoOrigem: "America/Sao_Paulo",
      avaliador: "Prof. Ana", status: "PREVISTO", mesmoAvaliador: true, excecaoDiaNaoLetivo: false,
    } }));
    expect(html).toMatch(/30\/09\/2026.*20:30/);
    expect(html).toContain("Fuso de origem: America/Sao_Paulo");
  });

  it("recorre ao fuso de origem da agenda sem preferência", () => {
    const html = renderToStaticMarkup(createElement(AgendaPublicada, { preferenciaFusoExibicao: null, agenda: {
      id: "agenda", inicio: "2026-10-01T02:30:00.000Z", fim: "2026-10-01T03:30:00.000Z", fusoOrigem: "America/Sao_Paulo",
      avaliador: "Prof. Ana", status: "PREVISTO", mesmoAvaliador: true, excecaoDiaNaoLetivo: false,
    } }));
    expect(html).toMatch(/30\/09\/2026.*23:30/);
    expect(html).toContain("— America/Sao_Paulo.");
  });
});
