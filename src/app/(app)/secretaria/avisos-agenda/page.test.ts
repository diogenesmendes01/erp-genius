import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), preferencia: vi.fn() }));

vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/comunicacoes-agenda/consultas", () => ({ consultarAvisosAlteracaoAgenda: mocks.consultar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./ReconferirPendencia", () => ({ ReconferirPendencia: () => null }));

import Page from "./page";

beforeEach(() => vi.resetAllMocks());

describe("fila de avisos da agenda no fuso pessoal", () => {
  it("não consulta a preferência antes da guarda", async () => {
    mocks.sessao.mockRejectedValue(new Error("acesso negado"));

    await expect(Page({ searchParams: Promise.resolve({ cursor: "nao-consultar" }) })).rejects.toThrow("acesso negado");

    expect(mocks.sessao).toHaveBeenCalledWith(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
    expect(mocks.consultar).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });

  it("formata avisos e pendências no fuso pessoal, com fallback UTC", async () => {
    mocks.sessao.mockResolvedValue({ id: "secretaria" });
    mocks.preferencia.mockResolvedValueOnce({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
    mocks.consultar.mockResolvedValue({ ok: true, dado: {
      itens: [{ id: "aviso", alunoNome: "Ana", canal: "WHATSAPP", situacao: "INCERTO", atualizadoEm: new Date("2026-01-01T02:30:00.000Z") }],
      pendencias: [{ id: "pendencia", matriculaId: "matricula", matriculaCodigo: "MAT-1", alunoNome: "Ana", motivo: "CONTATO_INDISPONIVEL", situacao: "PENDENTE", criadoEm: new Date("2026-01-01T03:30:00.000Z") }],
      proximoCursor: null,
      proximoCursorPendencia: null,
    } });

    const noFusoPessoal = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(noFusoPessoal).toContain("31/12/2025, 20:30 (horário exibido em America/Costa_Rica; origem UTC)");
    expect(noFusoPessoal).toContain("31/12/2025, 21:30 (horário exibido em America/Costa_Rica; origem UTC)");
    expect(noFusoPessoal).toContain("Contato acadêmico indisponível");

    mocks.preferencia.mockResolvedValueOnce({ ok: false, erro: "Preferência indisponível." });
    const fallback = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(fallback).toContain("01/01/2026, 02:30 (horário exibido em UTC; origem UTC)");
  });
});
