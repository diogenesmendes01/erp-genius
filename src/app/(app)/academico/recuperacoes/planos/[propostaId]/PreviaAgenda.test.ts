import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/avaliacoes/recuperacao-agenda", () => ({ preverAgendaRecuperacao: vi.fn() }));
import { PreviaAgenda, ResultadoPreviaAgenda } from "./PreviaAgenda";

const base = {
  itemReservaId: "item", planoId: "plano", planoHash: "hash", habilidade: "FALA", inicio: "2026-01-01T02:30:00.000Z", fim: "2026-01-01T03:30:00.000Z", fuso: "America/Sao_Paulo",
  professor: { id: "professor", nome: "Professora" }, calendarioId: "calendario", prazoAte: "2026-01-02T02:30:00.000Z", diasNaoLetivos: [], conflitos: [], indisponibilidades: 0, reservas: 0, pendencias: [], conferidoEm: "2026-01-01T00:00:00.000Z", publicacaoAutorizada: false as const,
};

describe("prévia de agenda da recuperação", () => {
  it("muda só a saída para a preferência e preserva os campos locais de entrada", () => {
    const formulario = renderToStaticMarkup(createElement(PreviaAgenda, { itemReservaId: "item", preferenciaFusoExibicao: "America/Costa_Rica" }));
    expect(formulario).toContain('type="datetime-local"');
    expect(formulario).toContain('name="fuso"');
    expect(formulario).toContain('value="UTC"');

    const html = renderToStaticMarkup(createElement(ResultadoPreviaAgenda, { preferenciaFusoExibicao: "America/Costa_Rica", dado: base }));
    expect(html).toContain("31/12/2025, 20:30");
    expect(html).toContain("America/Costa_Rica; origem America/Sao_Paulo");
  });

  it("mantém o fuso da agenda quando a preferência está ausente", () => {
    const html = renderToStaticMarkup(createElement(ResultadoPreviaAgenda, { preferenciaFusoExibicao: null, dado: { ...base, professor: null, calendarioId: null } }));
    expect(html).toContain("31/12/2025, 23:30");
    expect(html).toContain("America/Sao_Paulo; origem America/Sao_Paulo");
  });
});