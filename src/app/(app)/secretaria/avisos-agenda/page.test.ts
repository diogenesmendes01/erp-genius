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

    await expect(Page({ searchParams: Promise.resolve({ depois: "a-20" }) })).rejects.toThrow("acesso negado");

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
      temAnterior: false, temProxima: false, anterior: null, proxima: null,
      temAnteriorPendencia: false, temProximaPendencia: false, anteriorPendencia: null, proximaPendencia: null,
    } });

    const noFusoPessoal = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(noFusoPessoal).toContain("31/12/2025, 20:30 (horário exibido em America/Costa_Rica; origem UTC)");
    expect(noFusoPessoal).toContain("31/12/2025, 21:30 (horário exibido em America/Costa_Rica; origem UTC)");
    expect(noFusoPessoal).toContain("Contato acadêmico indisponível");

    mocks.preferencia.mockResolvedValueOnce({ ok: false, erro: "Preferência indisponível." });
    const fallback = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(fallback).toContain("01/01/2026, 02:30 (horário exibido em UTC; origem UTC)");
  });

  it("cada fila anda por cursor nos dois sentidos sem perder o ponto da outra", async () => {
    mocks.sessao.mockResolvedValue({ id: "secretaria" });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
    const itens = [{ id: "aviso", alunoNome: "Ana", canal: "EMAIL", situacao: "PREPARADO", atualizadoEm: new Date("2026-01-01T02:30:00.000Z") }];
    const pendencias = [{ id: "pendencia", matriculaId: "matricula", matriculaCodigo: "MAT-1", alunoNome: "Ana", motivo: "CONTATO_INDISPONIVEL", situacao: "PENDENTE", criadoEm: new Date("2026-01-01T03:30:00.000Z") }];
    const render = async (params: Record<string, string>) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));

    // Início das duas filas: nenhuma "Anterior", nenhum número de página nem cursor vazio.
    mocks.consultar.mockResolvedValue({ ok: true, dado: { itens, pendencias,
      temAnterior: false, temProxima: true, anterior: null, proxima: "a-20",
      temAnteriorPendencia: false, temProximaPendencia: true, anteriorPendencia: null, proximaPendencia: "p-20" } });
    const inicio = await render({});
    expect(mocks.consultar).toHaveBeenLastCalledWith({});
    expect(inicio).not.toContain("Anterior");
    expect(inicio).not.toContain("pagina");
    expect(inicio).not.toMatch(/(depois|antes)(Pendencias)?=(&|")/);
    expect(inicio).toContain('href="/secretaria/avisos-agenda?depois=a-20">Próxima');
    expect(inicio).toContain('href="/secretaria/avisos-agenda?depoisPendencias=p-20">Próxima');

    // Avisos e pendências no meio: cada link move só a sua fila e mantém o cursor da outra.
    mocks.consultar.mockResolvedValue({ ok: true, dado: { itens, pendencias,
      temAnterior: true, temProxima: true, anterior: "a-21", proxima: "a-40",
      temAnteriorPendencia: true, temProximaPendencia: true, anteriorPendencia: "p-21", proximaPendencia: "p-40" } });
    const meio = await render({ depois: "a-20", antesPendencias: "p-41" });
    expect(mocks.consultar).toHaveBeenLastCalledWith({ depois: "a-20", antesPendencias: "p-41" });
    expect(meio).toContain('href="/secretaria/avisos-agenda?antes=a-21&amp;antesPendencias=p-41">← Anterior');
    expect(meio).toContain('href="/secretaria/avisos-agenda?depois=a-40&amp;antesPendencias=p-41">Próxima');
    expect(meio).toContain('href="/secretaria/avisos-agenda?depois=a-20&amp;antesPendencias=p-21">← Anterior');
    expect(meio).toContain('href="/secretaria/avisos-agenda?depois=a-20&amp;depoisPendencias=p-40">Próxima');
  });

  it("vazio: fila zerada no início; ponto da fila sem itens leva ao início daquela fila e mantém a outra", async () => {
    mocks.sessao.mockResolvedValue({ id: "secretaria" });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
    mocks.consultar.mockResolvedValue({ ok: true, dado: { itens: [], pendencias: [],
      temAnterior: false, temProxima: false, anterior: null, proxima: null,
      temAnteriorPendencia: false, temProximaPendencia: false, anteriorPendencia: null, proximaPendencia: null } });
    const zerada = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(zerada).toContain("Nenhum aviso de alteração na agenda.");
    expect(zerada).toContain("Nenhuma pendência operacional registrada.");
    expect(zerada).not.toContain("nesta página");
    expect(zerada).not.toContain('href="/secretaria/avisos-agenda"');

    const alem = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ depois: "a-sumido", depoisPendencias: "p-sumida" }) }));
    expect(alem).toContain("Nenhum aviso a partir deste ponto da fila");
    expect(alem).toContain('href="/secretaria/avisos-agenda?depoisPendencias=p-sumida">Ir para o início dos avisos');
    expect(alem).toContain("Nenhuma pendência a partir deste ponto da fila");
    expect(alem).toContain('href="/secretaria/avisos-agenda?depois=a-sumido">Ir para o início das pendências');
    expect(alem).not.toContain("nesta página");
  });
});
