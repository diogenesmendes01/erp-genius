import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ consultar: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoComPapel: async () => ({ id: "pedagogico", papeis: ["GERENTE_PEDAGOGICO"] }) }));
vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { findUniqueOrThrow: async () => ({ permissoes: [] }) } } }));
vi.mock("@/server/financeiro/permuta-servico", () => ({ consultarPermutas: mocks.consultar, listarCobrancasParaPermuta: vi.fn() }));
vi.mock("./PermutaOperacional", () => ({ PermutaOperacional: () => null }));
import Page from "./page";
beforeEach(() => vi.clearAllMocks());
it("permite navegar além dos cinquenta primeiros acordos", async () => {
  mocks.consultar.mockResolvedValue({ ok: true, dado: Array.from({ length: 50 }, (_, id) => ({ id })) });
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ pagina: "2" }) }));
  expect(mocks.consultar).toHaveBeenCalledWith(2);
  expect(html).toContain('/financeiro/permuta?pagina=1');
  expect(html).toContain('/financeiro/permuta?pagina=3');
});
it("página vazia conserva retorno e não oferece próxima", async () => {
  mocks.consultar.mockResolvedValue({ ok: true, dado: [] });
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ pagina: "2" }) }));
  expect(html).toContain("Nenhum acordo nesta página");
  expect(html).toContain("Anterior");
  expect(html).not.toContain("Próxima");
});
it("inicia na primeira página sem link anterior", async () => {
  mocks.consultar.mockResolvedValue({ ok: true, dado: [] });
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  expect(mocks.consultar).toHaveBeenCalledWith(1);
  expect(html).not.toContain("Anterior");
});
