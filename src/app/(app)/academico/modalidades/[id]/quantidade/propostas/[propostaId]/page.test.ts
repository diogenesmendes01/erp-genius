import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/agenda/modalidade-quantidade-consulta", () => ({ consultarPropostaQuantidadeAulasModalidade: mocks.consultar }));
vi.mock("./DecidirQuantidadeAulas", () => ({ DecidirQuantidadeAulas: () => createElement("p", null, "Decidir revisão") }));
import Page from "./page";

beforeEach(() => vi.resetAllMocks());

it("renderiza os parâmetros aprovados que justificam a exceção Q37", async () => {
 mocks.sessao.mockResolvedValue({ id: "secretaria" });
 mocks.consultar.mockResolvedValue({ ok: true, dado: {
  id: "p", modalidadeId: "m", modalidade: { nome: "Inglês" }, versao: 2, quantidadeAnterior: 2, quantidadeNova: 3, situacao: "PREPARADA", motivo: "Aumento revisado", preparador: { nome: "Secretaria" }, decisao: null, aplicadaEm: null,
  impactos: [{ id: "i", turmaId: "t", turma: { codigo: "T-01" }, quantidadeAnterior: 2, quantidadeNova: 3, alcance: "AUMENTO_NAO_INICIADA", excecoesQ37: ["grade"], snapshot: { parametrosGradeAprovada: { duracaoMinutos: 90, frequencia: "2x/semana", diasSemana: [1, 3] } } }],
 } });
 const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m", propostaId: "p" }) }));
 expect(html).toContain("Exceção Q37 preservada da grade aprovada");
 expect(html).toContain("90 min");
 expect(html).toContain("2x/semana");
 expect(html).toContain("dias 1, 3");
});
