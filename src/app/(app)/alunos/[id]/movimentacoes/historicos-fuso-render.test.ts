import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RegistroCompraHoras } from "./ComprasHorasPainel";
import { DecisaoCumprimentoHistorico } from "./CumprimentoPainel";
import { EfetivacaoAcertoHistorico, mensagemConferenciaAcerto } from "./AcertoEncerramento";
import { TituloMovimentacao } from "./MovimentacoesPainel";

const instante = "2026-01-01T02:30:00.000Z";

function renderir(preferenciaFusoExibicao: string | null) {
  return renderToStaticMarkup(createElement("section", null,
    createElement(DecisaoCumprimentoHistorico, { decisor: "Administração", motivo: "Oferta conferida", decididaEm: instante, preferenciaFusoExibicao }),
    createElement(EfetivacaoAcertoHistorico, { executor: "Financeiro", aplicadaEm: instante, preferenciaFusoExibicao }),
    createElement(TituloMovimentacao, { estado: "PENDENTE", criadoEm: instante, preferenciaFusoExibicao }),
    createElement("p", null, mensagemConferenciaAcerto({ atual: true, motivos: [], conferidoEm: instante, preferenciaFusoExibicao })),
  ));
}

describe("históricos administrativos das movimentações", () => {
  it("renderiza compra, decisão, efetivação e conferência na preferência pessoal", () => {
    const html = renderir("America/Costa_Rica");
    expect(html).toContain("31/12/2025, 20:30");
    expect(html).toContain("Decisão de Administração");
    expect(html).toContain("Efetivado por Financeiro");
    expect(html).toContain("Conferido em 31/12/2025, 20:30");
    expect(html).toContain("horário exibido em America/Costa_Rica; origem UTC");
    expect(html.match(/31\/12\/2025, 20:30/g)).toHaveLength(4);
    expect(html.match(/horário exibido em America\/Costa_Rica; origem UTC/g)).toHaveLength(4);
  });

  it("mantém UTC como fallback determinístico quando a preferência falha", () => {
    const html = renderir(null);
    expect(html).toContain("01/01/2026, 02:30");
    expect(html).toContain("horário exibido em UTC; origem UTC");
    expect(html.match(/01\/01\/2026, 02:30/g)).toHaveLength(4);
    expect(html.match(/horário exibido em UTC; origem UTC/g)).toHaveLength(4);
  });
});

// Lote 3 do fuso pessoal nas telas: o registro da compra de horas, sem preferência, sai no fuso da ESCOLA (antes,
// UTC), com o fuso escrito. Expectativas fixas: passam em TZ=UTC e America/Sao_Paulo.
describe("registro da compra de horas", () => {
  const html = (preferenciaFusoExibicao: string | null, fusoEscola: string) => renderToStaticMarkup(createElement(RegistroCompraHoras, { nome: "Financeiro", criadoEm: instante, preferenciaFusoExibicao, fusoEscola }));
  it("pessoal; sem preferência, a escola; escola sem fuso válido, UTC", () => {
    expect(html("America/Costa_Rica", "America/Sao_Paulo")).toContain("Registrado por Financeiro em 31/12/2025, 20:30 (horário exibido em America/Costa_Rica).");
    expect(html(null, "America/Sao_Paulo")).toContain("Registrado por Financeiro em 31/12/2025, 23:30 (horário exibido em America/Sao_Paulo).");
    expect(html(null, "")).toContain("Registrado por Financeiro em 01/01/2026, 02:30 (horário exibido em UTC).");
  });
});
