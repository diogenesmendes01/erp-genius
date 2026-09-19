import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/avaliacoes/recuperacao-substituicao-previa", () => ({ preverSubstituicaoAvaliadorRecuperacao: vi.fn() }));
vi.mock("./ProporSubstituicao", () => ({ ProporSubstituicao: () => "Propor substituição" }));
import { ResultadoPreviaSubstituicao } from "./PreviaSubstituicao";

describe("prévia de substituição da recuperação", () => {
  it("apresenta a conferência no fuso pessoal sem alterar o fuso de origem", () => {
    const dado = {
      itemReservaId: "item", encontroId: "encontro", matriculaId: "matricula", planoId: "plano", planoHash: "hash", avaliadorAtualId: "a", substitutoId: "b", calendarioId: "calendario", prazoVigente: "2026-01-02T02:30:00.000Z",
      inicio: "2026-01-01T02:30:00.000Z", fim: "2026-01-01T03:30:00.000Z", fusoOrigem: "America/Sao_Paulo", avaliadorAtual: "Prof. A", substituto: "Prof. B", versaoDesignacao: 1, excecaoDiaNaoLetivo: false,
      fontesEstado: "fonte", conflitos: [], indisponibilidades: 0, reservas: 0, pendencias: [], aplicada: false as const, estadoConferido: "hash", versaoEsperada: 1,
    };
    const html = renderToStaticMarkup(createElement(ResultadoPreviaSubstituicao, { itemReservaId: "item", preferenciaFusoExibicao: "America/Costa_Rica", dado }));
    expect(html).toContain("31/12/2025, 20:30");
    expect(html).toContain("America/Costa_Rica; origem America/Sao_Paulo");
  });
});