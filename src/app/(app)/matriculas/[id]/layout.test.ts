import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Papel, StatusMatricula } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ carregar: vi.fn(), notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }) }));
vi.mock("./carregar-cabecalho", () => ({ carregarCabecalho: mocks.carregar }));
vi.mock("next/navigation", () => ({ usePathname: () => "/matriculas/m1/pagador", notFound: mocks.notFound }));

import Layout, { generateMetadata } from "./layout";
import Hub from "./page";

const params = Promise.resolve({ id: "m1" });
const cabecalho = { id: "m1", codigo: "M-000123", status: StatusMatricula.ATIVA, alunoId: "a1", aluno: "Ana Silva", produto: "Inglês · Regular" };

describe("layout da matrícula", () => {
  beforeEach(() => { mocks.carregar.mockReset(); mocks.notFound.mockClear(); });

  it("cabeçalho com código, aluno (link para a ficha), estado e produto; abas do papel com a ativa marcada", async () => {
    mocks.carregar.mockResolvedValue({ usuario: { papeis: [Papel.FINANCEIRO] }, cabecalho });
    const html = renderToStaticMarkup(await Layout({ params, children: createElement("main", null, "conteúdo") }));
    expect(html).toContain('aria-label="Matrícula"');
    expect(html).toContain(">M-000123<");
    expect(html).toContain('href="/alunos/a1"');
    expect(html).toContain(">Ana Silva<");
    expect(html).toContain(">Ativa<");
    expect(html).toContain("Inglês · Regular");
    expect(html).toContain('aria-label="Seções da matrícula"');
    const ativas = [...html.matchAll(/<a[^>]*aria-current="page"[^>]*>/g)].map((m) => m[0]);
    expect(ativas).toHaveLength(1);
    expect(ativas[0]).toContain('href="/matriculas/m1/pagador"');
    expect(html).not.toContain("/matriculas/m1/contrato"); // Financeiro não abre Contrato
    expect(html).toContain("<main>conteúdo</main>");
  });

  it("sem cabeçalho (inexistente ou fora da carteira): só a página, sem dado de matrícula", async () => {
    mocks.carregar.mockResolvedValue({ usuario: { papeis: [Papel.VENDEDOR] }, cabecalho: null });
    const html = renderToStaticMarkup(await Layout({ params, children: createElement("p", null, "página") }));
    expect(html).toBe("<p>página</p>");
  });

  it("título da aba do navegador identifica a matrícula", async () => {
    mocks.carregar.mockResolvedValue({ usuario: { papeis: [Papel.SECRETARIA_ACADEMICA] }, cabecalho });
    await expect(generateMetadata({ params })).resolves.toEqual({ title: "M-000123 · Ana Silva" });
    mocks.carregar.mockResolvedValue({ usuario: { papeis: [Papel.SECRETARIA_ACADEMICA] }, cabecalho: null });
    await expect(generateMetadata({ params })).resolves.toEqual({ title: "Matrícula" });
  });
});

describe("hub /matriculas/[id]", () => {
  beforeEach(() => { mocks.carregar.mockReset(); mocks.notFound.mockClear(); });

  it("lista as seções que o papel abre", async () => {
    mocks.carregar.mockResolvedValue({ usuario: { papeis: [Papel.VENDEDOR] }, cabecalho });
    const html = renderToStaticMarkup(await Hub({ params }));
    expect(html).toContain("Seções da matrícula");
    expect(html).not.toContain("Ana Silva"); // já está no cabeçalho do layout
    expect([...html.matchAll(/<a[^>]*\shref="([^"]+)"/g)].map((m) => m[1])).toEqual(["/matriculas/m1/preparacao", "/matriculas/m1/reserva"]);
  });

  it("inexistente ou fora do alcance: notFound (página em português, dentro do shell)", async () => {
    mocks.carregar.mockResolvedValue({ usuario: { papeis: [Papel.VENDEDOR] }, cabecalho: null });
    await expect(Hub({ params })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalled();
  });
});
