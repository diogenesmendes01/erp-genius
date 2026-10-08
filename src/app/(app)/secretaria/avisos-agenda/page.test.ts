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

    await expect(Page({ searchParams: Promise.resolve({ pagina: "2" }) })).rejects.toThrow("acesso negado");

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
      pagina: 1, temProxima: false,
      paginaPendencias: 1, temProximaPendencia: false,
    } });

    const noFusoPessoal = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(noFusoPessoal).toContain("31/12/2025, 20:30 (horário exibido em America/Costa_Rica; origem UTC)");
    expect(noFusoPessoal).toContain("31/12/2025, 21:30 (horário exibido em America/Costa_Rica; origem UTC)");
    expect(noFusoPessoal).toContain("Contato acadêmico indisponível");

    mocks.preferencia.mockResolvedValueOnce({ ok: false, erro: "Preferência indisponível." });
    const fallback = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(fallback).toContain("01/01/2026, 02:30 (horário exibido em UTC; origem UTC)");
  });

  it("cada lista pagina nos dois sentidos sem perder a página da outra", async () => {
    mocks.sessao.mockResolvedValue({ id: "secretaria" });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
    mocks.consultar.mockResolvedValue({ ok: true, dado: {
      itens: [{ id: "aviso", alunoNome: "Ana", canal: "EMAIL", situacao: "PREPARADO", atualizadoEm: new Date("2026-01-01T02:30:00.000Z") }],
      pendencias: [{ id: "pendencia", matriculaId: "matricula", matriculaCodigo: "MAT-1", alunoNome: "Ana", motivo: "CONTATO_INDISPONIVEL", situacao: "PENDENTE", criadoEm: new Date("2026-01-01T03:30:00.000Z") }],
      pagina: 1, temProxima: true, paginaPendencias: 1, temProximaPendencia: true,
    } });
    const render = async (params: Record<string, string>) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));

    // Primeira página das duas listas: nenhuma "Anterior", e nenhum link com página 1.
    const primeira = await render({});
    expect(mocks.consultar).toHaveBeenLastCalledWith({ pagina: 1, paginaPendencias: 1 });
    expect(primeira).not.toContain("Anterior");
    expect(primeira).not.toMatch(/pagina(Pendencias)?=1(?!\d)/);
    expect(primeira).toContain('href="/secretaria/avisos-agenda?pagina=2">Próxima');
    expect(primeira).toContain('href="/secretaria/avisos-agenda?paginaPendencias=2">Próxima');

    // Avisos na 3ª, pendências na 2ª: cada "Anterior" volta só a sua lista e mantém a outra.
    const meio = await render({ pagina: "3", paginaPendencias: "2" });
    expect(mocks.consultar).toHaveBeenLastCalledWith({ pagina: 3, paginaPendencias: 2 });
    expect(meio).toContain('href="/secretaria/avisos-agenda?pagina=2&amp;paginaPendencias=2">← Anterior');
    expect(meio).toContain('href="/secretaria/avisos-agenda?pagina=4&amp;paginaPendencias=2">Próxima');
    expect(meio).toContain('href="/secretaria/avisos-agenda?pagina=3">← Anterior');
    expect(meio).toContain('href="/secretaria/avisos-agenda?pagina=3&amp;paginaPendencias=3">Próxima');
  });
});
