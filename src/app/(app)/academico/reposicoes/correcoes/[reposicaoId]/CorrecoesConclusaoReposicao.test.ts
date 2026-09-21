import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("@/server/diario/reposicao-individual", () => ({
  decidirCorrecaoConclusaoReposicao: vi.fn(),
  proporCorrecaoConclusaoReposicao: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { CorrecoesConclusaoReposicao } from "./CorrecoesConclusaoReposicao";

it("renderiza origem, fonte particular e decisão no fuso pessoal ao atravessar o dia UTC", () => {
  const instante = "2026-01-01T02:30:00.000Z";
  const fonteParticular = {
    concluida: true,
    encontro: { id: "encontro-particular", inicio: instante, fim: "2026-01-01T03:30:00.000Z", fuso: "UTC", realizadaEm: "2026-01-01T03:45:00.000Z" },
    entrega: null,
    validadaEm: null,
    evidencia: "Presença e realização conferidas na agenda particular.",
  } as const;
  const dados = {
    reposicao: { id: "reposicao-1", modalidade: "PARTICULAR" as const, origem: { inicio: instante, fim: "2026-01-01T03:30:00.000Z", fuso: "UTC" } },
    conclusao: { id: "conclusao-1", versao: 1, concluidaPor: "Gestão", fonte: fonteParticular },
    consultaHistorica: false,
    conclusaoAnteriorVersao: null,
    conclusaoSeguinteVersao: null,
    ultimaConclusaoVersao: 1,
    vigente: { fonte: fonteParticular, origem: "CORRECAO_APROVADA" as const },
    versaoEsperada: 2,
    podePropor: false,
    fontesDisponiveis: { encontros: [], entregas: [] },
    correcoes: [{
      id: "correcao-1", versao: 2, criadaEm: instante, autor: "Secretaria", motivo: "Corrigir a conclusão com a fonte particular confirmada.", propostaHash: "hash",
      antes: { concluida: false, encontro: null, entrega: null, validadaEm: null, evidencia: "Conclusão retirada para nova conferência." },
      fonte: fonteParticular,
      decisao: { aprovada: true, motivo: "Aprovação independente após conferir a realização.", decididaEm: "2026-01-01T04:00:00.000Z", decisor: "Gestão Pedagógica" },
      podeRejeitar: false, podeAprovar: false, impactosHash: null, impactos: [], temImpactos: false, podeVerCasos: false, impedimentoAprovacao: null,
    }],
  };

  const costaRica = renderToStaticMarkup(createElement(CorrecoesConclusaoReposicao, { dados, mostrarPreparacao: false, fusoExibicao: "America/Costa_Rica" }));
  const utc = renderToStaticMarkup(createElement(CorrecoesConclusaoReposicao, { dados, mostrarPreparacao: false, fusoExibicao: "UTC" }));

  expect(costaRica).toContain("Aula de origem");
  expect(costaRica).toContain("origem UTC");
  expect(costaRica).toContain("Encontro particular realizado");
  expect(costaRica).toContain("Decisão de Gestão Pedagógica");
  expect(costaRica).toContain("31/12/2025");
  expect(costaRica).toContain("America/Costa_Rica");
  expect(utc).toContain("01/01/2026");
  expect(utc).toContain("(UTC)");
  expect(costaRica).not.toContain("01/01/2026");
});
