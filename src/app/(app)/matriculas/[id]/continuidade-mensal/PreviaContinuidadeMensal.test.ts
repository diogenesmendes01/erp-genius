import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PreviaContinuidadeMensal } from "./PreviaContinuidadeMensal";

const resultado = {
  ok: true,
  dado: {
    plano: {
      cobertura: { inicio: "2026-10-01", fim: "2026-10-31" },
      memoriaVencimento: {
        dataCalculada: "2026-09-05",
        dataAjustada: "2026-09-08",
        regraAplicada: "PROXIMO_DIA_UTIL",
        referenciaCalendarioAplicada: { referencia: "Calendário financeiro 2026", versao: 4 },
      },
      emissaoEm: "2026-08-29",
      status: "PRONTA_PARA_EMISSAO",
      valorOriginal: "150.00",
      valorNegociado: "125.00",
      moeda: "CRC",
    },
    memoriaPreco: {
      referencia: {
        versaoCondicoes: 7,
        valorOriginalReferencia: "150.00",
        valorNegociadoPreparacao: "125.00",
      },
    },
    oferta: { estado: "SEM_RELATO" },
    comprovacaoOferta: { estado: "EXIGE_CONFIRMACAO_GESTAO", memoria: { fontes: [], motivos: ["VINCULO_AUSENTE"] } },
    motivo: "A prévia não emite cobrança.",
  },
} as unknown as Parameters<typeof PreviaContinuidadeMensal>[0]["resultado"];

describe("Prévia de continuidade mensal", () => {
  it("mostra a referência, a versão e a memória de preço sem apresentar emissão", () => {
    const html = renderToStaticMarkup(createElement(PreviaContinuidadeMensal, { resultado }));

    expect(html).toContain("Mês anterior à cobertura (09/2026)");
    expect(html).toContain("Condição contratual usada");
    expect(html).toContain("Versão 7");
    expect(html).toContain("Preço de referência da preparação");
    expect(html).toContain("Preço contratado na preparação");
    expect(html).toContain("Calendário financeiro 2026 · versão 4");
    expect(html).toContain("Nenhuma cobrança será criada por esta consulta");
  });
});
