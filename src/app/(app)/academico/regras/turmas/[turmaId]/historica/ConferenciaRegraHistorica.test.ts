import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/avaliacoes/conferencia-regra-historica", () => ({
  revisarConferenciaRegraHistorica: vi.fn(), proporConferenciaRegraHistorica: vi.fn(),
  decidirConferenciaRegraHistorica: vi.fn(),
}));
import { PrepararConferenciaRegraHistorica, DecidirConferenciaRegraHistorica } from "./ConferenciaRegraHistorica";

it("exige seleção explícita antes de apresentar a proposta", () => {
  const html = renderToStaticMarkup(createElement(PrepararConferenciaRegraHistorica, {
    turmaId: "turma", destinos: [{ id: "regra-1", versao: 1 }, { id: "regra-2", versao: 2 }],
  }));
  expect(html).toMatch(/<option value="" selected="">Selecione<\/option>/);
  expect(html).not.toContain("Propor conferência");
  expect(html).not.toContain("Versão 1 conferida");
});

it("preserva a rejeição e não oferece aprovação para proposta inelegível", () => {
  const html = renderToStaticMarkup(createElement(DecidirConferenciaRegraHistorica, {
    propostaId: "proposta", estadoHash: "a".repeat(64), podeAprovar: false,
  }));
  expect(html).toContain("Rejeitar");
  expect(html).not.toContain("Aprovar e vincular");
});
