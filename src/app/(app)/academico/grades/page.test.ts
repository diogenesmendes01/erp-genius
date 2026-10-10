import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ guarda: vi.fn(), propostas: vi.fn(), ancora: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.guarda }));
vi.mock("@/lib/prisma", () => ({ prisma: { propostaGradeTurma: { findMany: mocks.propostas, findUnique: mocks.ancora } } }));

import { buscarPorId, findManyComOnde } from "@/test/consulta-paginada";
import Page from "./page";

// Ordem da fila: criadoEm desc, id desc. Sete propostas por instante: o id desempata, e a âncora do cursor (a 30ª)
// cai no meio de um empate.
const base = Date.parse("2026-09-01T12:00:00.000Z");
const proposta = (i: number) => ({ id: `grade-${String(99 - i).padStart(2, "0")}`, criadoEm: new Date(base - Math.floor(i / 7) * 60_000), versao: 1, fusoOrigem: "UTC", turma: { codigo: `T-${i}` }, decisao: null, preparador: { nome: "Secretaria" } });
const render = async (params: Record<string, string>) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));

describe("/academico/grades — fila por cursor nos dois sentidos (E4)", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.guarda.mockResolvedValue({ id: "gestor" }); });

  it("guarda antes da consulta; o início só com Próxima, sem link para si mesmo", async () => {
    mocks.guarda.mockRejectedValueOnce(new Error("Sem acesso"));
    await expect(render({})).rejects.toThrow("Sem acesso");
    expect(mocks.propostas).not.toHaveBeenCalled();

    // 31 lidas = 30 da página + a que só diz que há próxima.
    mocks.propostas.mockResolvedValue(Array.from({ length: 31 }, (_, i) => proposta(i)));
    const html = await render({});
    expect(mocks.guarda).toHaveBeenLastCalledWith(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
    expect(mocks.propostas).toHaveBeenLastCalledWith(expect.objectContaining({ where: { decisao: null }, take: 31, orderBy: [{ criadoEm: "desc" }, { id: "desc" }] }));
    expect(mocks.propostas.mock.calls[0][0]).not.toHaveProperty("skip");
    expect(html.match(/Revisar grade/g)).toHaveLength(30);
    expect(html).not.toContain("Anterior");
    expect(html).not.toContain("pagina");
    expect(html).toContain(`href="/academico/grades?depois=${proposta(29).id}">Próxima`);
  });

  it("no meio, com o histórico: os dois sentidos com o cursor certo, sem perder o filtro", async () => {
    const todas = Array.from({ length: 95 }, (_, i) => proposta(i));
    mocks.propostas.mockImplementation(findManyComOnde(todas));
    mocks.ancora.mockImplementation(buscarPorId(todas));
    const html = await render({ historico: "todos", depois: proposta(29).id });
    expect(html).toContain(`href="/academico/grades?historico=todos&amp;antes=${proposta(30).id}">← Anterior`);
    expect(html).toContain(`href="/academico/grades?historico=todos&amp;depois=${proposta(59).id}">Próxima`);
  });

  it("decidir uma proposta da primeira página não faz a próxima pular ninguém (desempate pelo id)", async () => {
    const todas = Array.from({ length: 65 }, (_, i) => proposta(i));
    const pendentes = [...todas];
    mocks.propostas.mockImplementation(findManyComOnde(pendentes));
    mocks.ancora.mockImplementation(buscarPorId(todas));
    const inicio = await render({});
    // Decididas: a 3ª e a âncora (a 30ª, último item da página) saem da fila; a âncora continua existindo.
    pendentes.splice(29, 1); pendentes.splice(2, 1);
    const seguinte = await render({ depois: proposta(29).id });
    const ids = [...seguinte.matchAll(/href="\/academico\/grades\/(grade-\d+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(Array.from({ length: 30 }, (_, i) => proposta(30 + i).id));
    expect(inicio).toContain(`depois=${proposta(29).id}`);
  });

  it("voltando ao começo, a página é a primeira, sem Anterior; a última não tem Próxima", async () => {
    const todas = Array.from({ length: 35 }, (_, i) => proposta(i));
    mocks.propostas.mockImplementation(findManyComOnde(todas));
    mocks.ancora.mockImplementation(buscarPorId(todas));
    const ultima = await render({ depois: proposta(29).id });
    expect(ultima.match(/Revisar grade/g)).toHaveLength(5);
    expect(ultima).toContain(`href="/academico/grades?antes=${proposta(30).id}">← Anterior`);
    expect(ultima).not.toContain("Próxima");
    const volta = await render({ antes: proposta(30).id });
    expect(volta.match(/Revisar grade/g)).toHaveLength(30);
    expect(volta).not.toContain("Anterior");
  });

  it("vazio: no início, sem link para si; cursor que não leva a nada volta ao início; cursor inválido é erro", async () => {
    mocks.propostas.mockResolvedValue([]);
    mocks.ancora.mockResolvedValue(null);
    const inicio = await render({});
    expect(inicio).toContain("Nenhuma proposta encontrada.");
    expect(inicio).not.toContain("Ir para o início da fila");
    const sumido = await render({ historico: "todos", depois: "grade-inexistente" });
    expect(sumido).toContain("Nenhuma proposta a partir deste ponto da fila");
    expect(sumido).toContain('href="/academico/grades?historico=todos">Ir para o início da fila');
    expect(sumido).not.toContain("nesta página");
    mocks.propostas.mockClear();
    const invalido = await render({ depois: "a b" });
    expect(invalido).toContain('role="alert"');
    expect(invalido).toContain("Cursor de navegação inválido");
    expect(mocks.propostas).not.toHaveBeenCalled();
  });
});
