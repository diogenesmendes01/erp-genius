import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ guarda: vi.fn(), propostas: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.guarda }));
vi.mock("@/lib/prisma", () => ({ prisma: { propostaGradeTurma: { findMany: mocks.propostas } } }));

import Page from "./page";

const proposta = (i: number) => ({ id: `grade-${String(i).padStart(2, "0")}`, versao: 1, fusoOrigem: "UTC", turma: { codigo: `T-${i}` }, decisao: null, preparador: { nome: "Secretaria" } });
const render = async (params: Record<string, string>) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));

describe("/academico/grades — paginação nos dois sentidos (E4)", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.guarda.mockResolvedValue({ id: "gestor" }); });

  it("guarda antes da consulta; primeira página só com Próxima, sem link para si mesma", async () => {
    mocks.guarda.mockRejectedValueOnce(new Error("Sem acesso"));
    await expect(render({})).rejects.toThrow("Sem acesso");
    expect(mocks.propostas).not.toHaveBeenCalled();

    // 31 lidas = 30 da página + a que só diz que há próxima.
    mocks.propostas.mockResolvedValue(Array.from({ length: 31 }, (_, i) => proposta(i)));
    const html = await render({});
    expect(mocks.guarda).toHaveBeenLastCalledWith(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
    expect(mocks.propostas).toHaveBeenLastCalledWith(expect.objectContaining({ where: { decisao: null }, skip: 0, take: 31, orderBy: [{ criadoEm: "desc" }, { id: "desc" }] }));
    expect(html.match(/Revisar grade/g)).toHaveLength(30);
    expect(html).not.toContain("Anterior");
    expect(html).not.toContain("pagina=1");
    expect(html).toContain('href="/academico/grades?pagina=2">Próxima');
  });

  it("no meio, com o histórico: os dois sentidos na página certa, sem perder o filtro", async () => {
    mocks.propostas.mockResolvedValue(Array.from({ length: 31 }, (_, i) => proposta(i)));
    const html = await render({ historico: "todos", pagina: "3" });
    expect(mocks.propostas).toHaveBeenLastCalledWith(expect.objectContaining({ where: {}, skip: 60, take: 31 }));
    expect(html).toContain('href="/academico/grades?historico=todos&amp;pagina=2">← Anterior');
    expect(html).toContain('href="/academico/grades?historico=todos&amp;pagina=4">Próxima');
  });

  it("da segunda página, Anterior volta à primeira sem ?pagina=1; a última não tem Próxima", async () => {
    mocks.propostas.mockResolvedValue([proposta(30)]);
    const html = await render({ historico: "todos", pagina: "2" });
    expect(html).toContain('href="/academico/grades?historico=todos">← Anterior');
    expect(html).not.toContain("Próxima");
  });
});
