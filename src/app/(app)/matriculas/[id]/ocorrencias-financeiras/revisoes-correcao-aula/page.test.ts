import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/financeiro/revisao-correcao-aula", () => ({ consultarRevisoesFinanceirasCorrecaoAula: mocks.consultar }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import Page from "./page";

beforeEach(() => vi.resetAllMocks());

it("protege a página antes da consulta financeira", async () => {
  mocks.sessao.mockRejectedValue(new Error("sem alçada"));
  await expect(Page({ params: Promise.resolve({ id: "matricula" }) })).rejects.toThrow("sem alçada");
  expect(mocks.consultar).not.toHaveBeenCalled();
});

it("mostra a revisão vigente sem oferecer preparação repetida", async () => {
  mocks.sessao.mockResolvedValue({ papeis: [Papel.FINANCEIRO] });
  mocks.consultar.mockResolvedValue({ ok: true, dado: { usuarioId: "fin", revisoes: [], candidatas: [{ id: "q23", encontroId: "encontro", versao: 2, encontro: { id: "encontro", inicio: new Date("2026-01-10T15:00:00Z"), fim: new Date("2026-01-10T16:15:00Z"), fusoOrigem: "America/Sao_Paulo" }, podePreparar: false, preparoBloqueadoPor: "A revisão aprovada permanece vigente e aguarda publicação pedagógica." }] } });

  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "matricula/1" }) }));

  expect(mocks.sessao).toHaveBeenCalledWith(Papel.FINANCEIRO);
  expect(mocks.consultar).toHaveBeenCalledWith({ matriculaId: "matricula/1" });
  expect(html).toContain("aguarda publicação pedagógica");
  expect(html).not.toContain("Preparar revisão Q92");
  expect(html).toContain("/matriculas/matricula/1/ocorrencias-financeiras");
});

it("apresenta erro de consulta sem renderizar a operação", async () => {
  mocks.sessao.mockResolvedValue({ papeis: [Papel.FINANCEIRO] });
  mocks.consultar.mockResolvedValue({ ok: false, erro: "Matrícula sem acesso financeiro." });
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "matricula" }) }));
  expect(html).toContain('role="alert"');
  expect(html).toContain("Matrícula sem acesso financeiro.");
  expect(html).not.toContain("Revisões financeiras de correção de aula");
});
