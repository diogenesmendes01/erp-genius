import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HomeVendedor } from "./HomeVendedor";

const dados = {
  cards: { leadsNovos: 0, followVencidos: 0, experimentaisHoje: 1, comissaoPrevista: [] },
  sla: { pct: 100, atrasados: 0 }, fila: [],
  agenda: [{ id: "lead", nome: "Ana", hora: "2026-10-01T02:30:00.000Z" }],
  kanban: [], metaMes: { feitas: 0, meta: 20 },
};

describe("HomeVendedor", () => {
  it("mostra a agenda administrativa na preferência que atravessa o dia", () => {
    const html = renderToStaticMarkup(createElement(HomeVendedor, {
      nome: "Vendedor Um", dados, preferenciaFusoExibicao: "America/Costa_Rica",
    }));
    expect(html).toMatch(/30\/09\/2026.*20:30/);
  });

  it("usa UTC na ausência de preferência", () => {
    const html = renderToStaticMarkup(createElement(HomeVendedor, {
      nome: "Vendedor Um", dados, preferenciaFusoExibicao: null,
    }));
    expect(html).toMatch(/01\/10\/2026.*02:30/);
  });
});
