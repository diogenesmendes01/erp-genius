import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/server/matricula/condicoes-continuidade-mensal", () => ({ consultarCondicoesContinuidadeMensal: vi.fn(), prepararCondicoesContinuidadeMensal: vi.fn(), decidirCondicoesContinuidadeMensal: vi.fn() }));

import { CondicoesContinuidadeMensal } from "./CondicoesContinuidadeMensal";

// Lote 2 do fuso pessoal: registro e decisão da versão são instantes. Antes saíam como o dia UTC (o registro feito
// às 23:30 em São Paulo aparecia no dia seguinte). Agora: o dia no fuso pessoal; sem preferência, no da escola.
// Expectativas fixas: passam em TZ=UTC e America/Sao_Paulo.
const dados = {
  matriculaId: "m", codigo: "M-1", moeda: "BRL", impedimento: null, podePreparar: false, documentoId: "d",
  versoes: [{
    id: "v1", versao: 1, status: "REJEITADA", preparador: { nome: "Financeiro" }, criadaEm: "2026-10-21T02:30:00.000Z", regras: null, naoConferida: false,
    motivo: "Transcrição", decisor: { nome: "Gestão" }, motivoDecisao: "Sem contrato", decididaEm: "2026-10-22T02:40:00.000Z", podeDecidir: false,
  }],
} as unknown as Parameters<typeof CondicoesContinuidadeMensal>[0]["dados"];
const render = (preferenciaFusoExibicao: string | null) =>
  renderToStaticMarkup(createElement(CondicoesContinuidadeMensal, { dados, preferenciaFusoExibicao, fusoEscola: "America/Sao_Paulo" }));

describe("CondicoesContinuidadeMensal: registro e decisão no fuso pessoal, com o fuso escrito", () => {
  it("sem preferência: o dia da escola, não o dia UTC", () => {
    const html = render(null);
    expect(html).toContain("Financeiro · 20/10/2026 (America/Sao_Paulo) · contrato vinculado");
    expect(html).toContain("Sem contrato · 21/10/2026 (America/Sao_Paulo)");
  });

  it("com preferência: o dia no fuso pessoal", () => {
    const html = render("Asia/Tokyo");
    expect(html).toContain("Financeiro · 21/10/2026 (Asia/Tokyo) · contrato vinculado");
    expect(html).toContain("Sem contrato · 22/10/2026 (Asia/Tokyo)");
  });
});
