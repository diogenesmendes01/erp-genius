import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HistoricoSolicitacaoAcessoAulas } from "./AcessoAulasPainel";

const solicitacao = {
  id: "pedido", bloquear: true, motivo: "Atraso confirmado", status: "APROVADA",
  criadoEm: "2026-01-01T02:30:00.000Z", decididoEm: "2026-01-01T03:30:00.000Z",
  motivoDecisao: "Documentação conferida", solicitante: "Financeiro", aprovador: "Admin", podeDecidir: false,
} as never;

describe("HistoricoSolicitacaoAcessoAulas", () => {
  it("renderiza dados carregados no fuso pessoal, incluindo a decisão", () => {
    const html = renderToStaticMarkup(createElement(HistoricoSolicitacaoAcessoAulas, { solicitacao, preferenciaFusoExibicao: "America/Costa_Rica" }));
    expect(html).toContain("Solicitante: Financeiro · 31/12/2025, 20:30 (horário exibido em America/Costa_Rica; origem UTC)");
    expect(html).toContain("Decisão de Admin: Documentação conferida · 31/12/2025, 21:30 (horário exibido em America/Costa_Rica; origem UTC)");
  });
  it("usa UTC no fallback e não muda motivo ou estado", () => {
    const html = renderToStaticMarkup(createElement(HistoricoSolicitacaoAcessoAulas, { solicitacao }));
    expect(html).toContain("01/01/2026, 02:30 (horário exibido em UTC; origem UTC)");
    expect(html).toContain("Documentação conferida");
  });
});
