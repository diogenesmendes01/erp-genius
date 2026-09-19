import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AndamentoSubstituicao } from "./Andamento";

const dados: Parameters<typeof AndamentoSubstituicao>[0]["dados"] = {
  etapa: "CANCELAMENTO_A_CONCILIAR", conflitoAssinatura: false, ambiente: "SANDBOX",
  cancelamentoConfirmado: false,
  intencao: { executor: "Admin A", criadaEm: new Date("2026-10-01T02:30:00.000Z") },
  aplicacao: { executor: "Admin B", aplicadaEm: new Date("2026-10-01T03:30:00.000Z"), artefatoSubstitutoId: "novo" },
  observacoes: [{ id: "observacao", resultado: "CONFIRMADO", registradaEm: new Date("2026-10-01T04:30:00.000Z") }], pagina: 1, temProxima: false,
};

describe("AndamentoSubstituicao", () => {
  it("exibe intenção, aplicação e retornos no fuso pessoal", () => {
    const html = renderToStaticMarkup(createElement(AndamentoSubstituicao, { dados, matriculaId: "matricula", propostaId: "proposta", preferenciaFusoExibicao: "America/Costa_Rica" }));

    expect(html).toContain("30/09/2026, 20:30 (America/Costa_Rica; origem UTC)");
    expect(html).toContain("30/09/2026, 21:30 (America/Costa_Rica; origem UTC)");
    expect(html).toContain("30/09/2026, 22:30 (America/Costa_Rica; origem UTC)");
    expect(html).toContain('/matriculas/matricula/contrato/originais/novo');
  });

  it("mantém UTC sem preferência", () => {
    const html = renderToStaticMarkup(createElement(AndamentoSubstituicao, { dados, matriculaId: "matricula", propostaId: "proposta" }));
    expect(html).toContain("01/10/2026, 02:30 (UTC; origem UTC)");
  });
});
