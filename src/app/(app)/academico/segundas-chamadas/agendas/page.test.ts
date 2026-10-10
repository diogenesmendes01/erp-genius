import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listarAgendasSegundaChamada: vi.fn(), consultarPreferenciaFusoEquipe: vi.fn() }));

vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: vi.fn() }));
vi.mock("@/server/avaliacoes/segunda-chamada-agendas", () => ({ listarAgendasSegundaChamada: mocks.listarAgendasSegundaChamada }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.consultarPreferenciaFusoEquipe }));

import Page from "./page";

describe("AgendasSegundaChamadaPage", () => {
  mocks.consultarPreferenciaFusoEquipe.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  const itemA = {
    reservaId: "reserva/a?",
    statusReserva: "LIBERADA_CANCELAMENTO_TEMPESTIVO",
    codigoAvaliacao: "FALA",
    reservadaEm: "2026-09-15T10:00:00.000Z",
    matricula: { codigo: "M-1" }, aluno: "Ana", turma: { codigo: "T-1", nome: "Turma" },
    agenda: { inicio: "2026-09-16T10:00:00.000Z", fim: "2026-09-16T11:00:00.000Z", fusoOrigem: "UTC", status: "PREVISTO" },
  };

  it("mantém navegação paginada nos dois sentidos, com identificadores codificados e rótulos operacionais", async () => {
    mocks.listarAgendasSegundaChamada.mockResolvedValue({ ok: true, dado: { itens: [itemA], pagina: 3, temProxima: true } });

    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ pagina: "3" }) }));
    expect(mocks.listarAgendasSegundaChamada).toHaveBeenLastCalledWith({ pagina: 3 });
    expect(html).toContain("reserva%2Fa%3F/remarcacao");
    expect(html).toContain('href="/academico/segundas-chamadas/agendas?pagina=2">← Anterior');
    expect(html).toContain('href="/academico/segundas-chamadas/agendas?pagina=4">Próxima');
    expect(html).toContain("Cancelada dentro do prazo");
    expect(html).toContain("Previsto");
  });

  it("primeira página só com Próxima; da segunda, Anterior volta sem ?pagina=1; a última não tem Próxima", async () => {
    mocks.listarAgendasSegundaChamada.mockResolvedValue({ ok: true, dado: { itens: [itemA], pagina: 1, temProxima: true } });
    const primeira = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(mocks.listarAgendasSegundaChamada).toHaveBeenLastCalledWith({ pagina: 1 });
    expect(primeira).not.toContain("Anterior");
    expect(primeira).not.toContain("pagina=1");
    expect(primeira).toContain('href="/academico/segundas-chamadas/agendas?pagina=2">Próxima');
    mocks.listarAgendasSegundaChamada.mockResolvedValue({ ok: true, dado: { itens: [itemA], pagina: 2, temProxima: false } });
    const segunda = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ pagina: "2" }) }));
    expect(segunda).toContain('href="/academico/segundas-chamadas/agendas">← Anterior');
    expect(segunda).not.toContain("Próxima");
  });

  it("não confunde encontro em rascunho com encontro em conferência", async () => {
    mocks.listarAgendasSegundaChamada.mockResolvedValue({ ok: true, dado: {
      itens: [{
        reservaId: "reserva-b",
        statusReserva: "RESERVADA",
        codigoAvaliacao: "FALA",
        reservadaEm: "2026-09-15T10:00:00.000Z",
        matricula: { codigo: "M-2" }, aluno: "Bia", turma: { codigo: "T-2", nome: "Turma" },
        agenda: { inicio: "2026-09-16T10:00:00.000Z", fim: "2026-09-16T11:00:00.000Z", fusoOrigem: "UTC", status: "RASCUNHO" },
      }],
      pagina: 1, temProxima: false,
    } });

    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Situação do encontro: Rascunho.");
    expect(html).not.toContain("Em conferência");
  });

  it("mostra o valor cru em vez de inventar uma situação para um status não mapeado", async () => {
    mocks.listarAgendasSegundaChamada.mockResolvedValue({ ok: true, dado: {
      itens: [{
        reservaId: "reserva-c",
        statusReserva: "STATUS_FUTURO",
        codigoAvaliacao: "FALA",
        reservadaEm: "2026-09-15T10:00:00.000Z",
        matricula: { codigo: "M-3" }, aluno: "Cau", turma: { codigo: "T-3", nome: "Turma" },
        agenda: { inicio: "2026-09-16T10:00:00.000Z", fim: "2026-09-16T11:00:00.000Z", fusoOrigem: "UTC", status: "STATUS_FUTURO" },
      }],
      pagina: 1, temProxima: false,
    } });

    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Situação da reserva: STATUS_FUTURO.");
    expect(html).toContain("Situação do encontro: STATUS_FUTURO.");
    expect(html).not.toContain("Em conferência");
  });

  it("mostra somente o erro da consulta", async () => {
    mocks.listarAgendasSegundaChamada.mockResolvedValue({ ok: false, erro: "Consulta recusada." });

    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Consulta recusada.");
    expect(html).not.toContain("evidência");
    expect(html).not.toContain("cobrança");
  });
});
