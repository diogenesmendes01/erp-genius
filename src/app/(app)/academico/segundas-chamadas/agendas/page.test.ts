import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listarAgendasSegundaChamada: vi.fn(), consultarPreferenciaFusoEquipe: vi.fn() }));

vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: vi.fn() }));
vi.mock("@/server/avaliacoes/segunda-chamada-agendas", () => ({ listarAgendasSegundaChamada: mocks.listarAgendasSegundaChamada }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.consultarPreferenciaFusoEquipe }));

import Page from "./page";

describe("AgendasSegundaChamadaPage", () => {
  mocks.consultarPreferenciaFusoEquipe.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  it("mantém navegação paginada com identificadores codificados e rótulos operacionais", async () => {
    mocks.listarAgendasSegundaChamada.mockResolvedValue({ ok: true, dado: {
      itens: [{
        reservaId: "reserva/a?",
        statusReserva: "LIBERADA_CANCELAMENTO_TEMPESTIVO",
        codigoAvaliacao: "FALA",
        reservadaEm: "2026-09-15T10:00:00.000Z",
        matricula: { codigo: "M-1" }, aluno: "Ana", turma: { codigo: "T-1", nome: "Turma" },
        agenda: { inicio: "2026-09-16T10:00:00.000Z", fim: "2026-09-16T11:00:00.000Z", fusoOrigem: "UTC", status: "PREVISTO" },
      }],
      proximoCursor: "cursor &/",
    } });

    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ cursor: "anterior" }) }));
    expect(html).toContain("Primeira página");
    expect(html).toContain("reserva%2Fa%3F/remarcacao");
    expect(html).toContain("cursor=cursor%20%26%2F");
    expect(html).toContain("Cancelada dentro do prazo");
    expect(html).toContain("Previsto");
  });

  it("mostra somente o erro da consulta", async () => {
    mocks.listarAgendasSegundaChamada.mockResolvedValue({ ok: false, erro: "Cursor inválido." });

    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Cursor inválido.");
    expect(html).not.toContain("evidência");
    expect(html).not.toContain("cobrança");
  });
});
