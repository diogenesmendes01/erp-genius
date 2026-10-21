import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sessao: vi.fn(), listar: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/contratos/moeda-aditivo", () => ({ listarAditivosParaTrocaMoeda: mocks.listar }));
import Page from "./page";
const item = { versaoId: "v1", matriculaId: "m1", propostaId: "p1", versao: 2, matriculaCodigo: "M-000123", aluno: "Ana Silva", moedaAtual: "CRC", estado: "PENDENTE" };
beforeEach(() => { vi.resetAllMocks(); mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [item], temProxima: true } }); });
it("nega acesso antes de listar", async () => {
  mocks.sessao.mockRejectedValue(new Error("Sem acesso"));
  await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("Sem acesso");
  expect(mocks.listar).not.toHaveBeenCalled();
});
it("lista pelo código da matrícula e leva à troca exata", async () => {
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ pagina: "2" }) }));
  expect(mocks.sessao).toHaveBeenCalledWith("FINANCEIRO"); expect(mocks.listar).toHaveBeenCalledWith(2);
  expect(html).toContain('href="/financeiro/acertos-moeda/m1/p1"'); expect(html).toContain("Matrícula M-000123 · Ana Silva · condições versão 2");
  expect(html).toContain("moeda atual CRC"); expect(html).toContain("?pagina=1"); expect(html).toContain("?pagina=3");
  expect(html.replace(/href="[^"]*"/g, "")).not.toMatch(/m1|p1/);
});
it("aditivo sem proposta de troca ainda aparece, sem estado decidido", async () => {
  mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [{ ...item, estado: null }], temProxima: false } });
  expect(renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }))).toContain("Sem proposta de troca");
});
it.each(["abc", "0", "-3", "2.5"])("?pagina=%s inválida cai na primeira página", async (pagina) => {
  await Page({ searchParams: Promise.resolve({ pagina }) });
  expect(mocks.listar).toHaveBeenCalledWith(1);
});
it("estado vazio distingue a primeira página das seguintes", async () => {
  mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [], temProxima: false } });
  expect(renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }))).toContain("Nenhum aditivo formaliza troca de moeda.");
  expect(renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ pagina: "3" }) }))).toContain("Nenhum aditivo de moeda nesta página.");
});
