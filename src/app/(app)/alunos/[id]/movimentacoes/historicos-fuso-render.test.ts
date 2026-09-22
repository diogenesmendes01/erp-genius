import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RegistroCompraHoras } from "./ComprasHorasPainel";
import { DecisaoCumprimentoHistorico } from "./CumprimentoPainel";
import { EfetivacaoAcertoHistorico, mensagemConferenciaAcerto } from "./AcertoEncerramento";
import { TituloMovimentacao } from "./MovimentacoesPainel";
import { ImpactosAcademicosAcerto } from "./ImpactosAcademicosAcerto";

const instante = "2026-01-01T02:30:00.000Z";

function renderir(preferenciaFusoExibicao: string | null) {
  return renderToStaticMarkup(createElement("section", null,
    createElement(RegistroCompraHoras, { nome: "Financeiro", criadoEm: instante, preferenciaFusoExibicao }),
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
    expect(html).toContain("Registrado por Financeiro");
    expect(html).toContain("Decisão de Administração");
    expect(html).toContain("Efetivado por Financeiro");
    expect(html).toContain("Conferido em 31/12/2025, 20:30");
    expect(html).toContain("horário exibido em America/Costa_Rica; origem UTC");
    expect(html.match(/31\/12\/2025, 20:30/g)).toHaveLength(5);
    expect(html.match(/horário exibido em America\/Costa_Rica; origem UTC/g)).toHaveLength(5);
  });

  it("mantém UTC como fallback determinístico quando a preferência falha", () => {
    const html = renderir(null);
    expect(html).toContain("01/01/2026, 02:30");
    expect(html).toContain("horário exibido em UTC; origem UTC");
    expect(html.match(/01\/01\/2026, 02:30/g)).toHaveLength(5);
    expect(html.match(/horário exibido em UTC; origem UTC/g)).toHaveLength(5);
  });

  it("exibe encontros particulares do acerto na preferência pessoal e no fuso de origem sem preferência", () => {
    const snapshot = { fusoInstitucional: "UTC", contratos: [{ impactosAcademicos: { matriculaId: "m", status: "ATIVA", vinculos: [], encontrosParticulares: [{ id: "e", inicio: instante, fusoOrigem: "UTC", status: "PREVISTO" }] } }] };
    const pessoal = renderToStaticMarkup(createElement(ImpactosAcademicosAcerto, { snapshot, preferenciaFusoExibicao: "America/Sao_Paulo" }));
    expect(pessoal).toContain("31/12/2025, 23:30 (America/Sao_Paulo)");
    const origem = renderToStaticMarkup(createElement(ImpactosAcademicosAcerto, { snapshot }));
    expect(origem).toContain("01/01/2026, 02:30 (UTC)");
  });
});
