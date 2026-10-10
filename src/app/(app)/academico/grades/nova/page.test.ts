import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ guarda: vi.fn(), turmas: vi.fn(), preparar: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.guarda }));
vi.mock("@/lib/prisma", () => ({ prisma: { turma: { findMany: mocks.turmas } } }));
vi.mock("./PrepararGrade", () => ({ PrepararGrade: (props: unknown) => { mocks.preparar(props); return "preparar-grade"; } }));

import Page from "./page";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.guarda.mockResolvedValue({ id: "gestor" });
  mocks.turmas.mockResolvedValue([{
    id: "turma-1", codigo: "T-1", dataInicio: new Date("2099-10-12T12:00:00.000Z"), horarioInicio: "22:00", diasSemana: [1],
    professor: { nome: "Professor" }, modalidade: { aulasPorNivel: 1, horasAula: 3, frequencia: "1x/semana" }, propostasGrade: [],
  }]);
});

it("guarda antes da consulta e seleciona apenas a turma planejada retornada pelo filtro", async () => {
  mocks.guarda.mockRejectedValueOnce(new Error("Sem acesso"));
  await expect(Page({ searchParams: Promise.resolve({ turmaId: "turma-1" }) })).rejects.toThrow("Sem acesso");
  expect(mocks.turmas).not.toHaveBeenCalled();

  renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ turmaId: "turma-1" }) }));
  expect(mocks.turmas).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "turma-1", status: "PLANEJADA" }) }));
  expect(mocks.preparar.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ turmaInicialId: "turma-1", turmas: [expect.objectContaining({ id: "turma-1", duracao: 180 })] }));
});

it("paginação nos dois sentidos: janela numerada, Anterior na página certa e a busca mantida", async () => {
  const turma = (i: number) => ({ id: `turma-${String(i).padStart(2, "0")}`, codigo: `T-${i}`, dataInicio: null, horarioInicio: "22:00", diasSemana: [1], professor: null, modalidade: { aulasPorNivel: 1, horasAula: 1, frequencia: "1x/semana" }, propostasGrade: [] });
  // 31 lidas = 30 da página + a que só diz que há próxima.
  mocks.turmas.mockResolvedValue(Array.from({ length: 31 }, (_, i) => turma(i)));
  const primeira = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ busca: "T" }) }));
  expect(mocks.turmas).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 0, take: 31, orderBy: [{ codigo: "asc" }, { id: "asc" }] }));
  expect(mocks.preparar.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ turmas: expect.any(Array) }));
  expect((mocks.preparar.mock.calls.at(-1)?.[0] as { turmas: unknown[] }).turmas).toHaveLength(30);
  expect(primeira).not.toContain("Anterior");
  expect(primeira).not.toContain("pagina=1");
  expect(primeira).toContain('href="/academico/grades/nova?busca=T&amp;pagina=2">Próxima');

  const meio = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ busca: "T", pagina: "3" }) }));
  expect(mocks.turmas).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 60, take: 31 }));
  expect(meio).toContain('href="/academico/grades/nova?busca=T&amp;pagina=2">← Anterior');
  expect(meio).toContain('href="/academico/grades/nova?busca=T&amp;pagina=4">Próxima');

  mocks.turmas.mockResolvedValue([turma(60)]);
  const ultima = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ busca: "T", pagina: "2" }) }));
  expect(ultima).toContain('href="/academico/grades/nova?busca=T">← Anterior');
  expect(ultima).not.toContain("Próxima");
});

it("não seleciona identificador repetido ou turma inelegível", async () => {
  const repetida = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ turmaId: ["turma-1", "turma-2"] }) }));
  expect(repetida).toContain("Seleção de turma inválida.");
  expect(mocks.turmas).not.toHaveBeenCalled();

  mocks.turmas.mockResolvedValueOnce([]);
  const inelegivel = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ turmaId: "turma-concluida" }) }));
  expect(inelegivel).toContain("Nenhuma turma planejada sem histórico ou agenda publicada foi encontrada.");
  expect(mocks.preparar).not.toHaveBeenCalled();
});
