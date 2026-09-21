import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ consultar: vi.fn(), sessao: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoComPapel: mocks.sessao }));
vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { findUniqueOrThrow: async () => ({ permissoes: [] }) } } }));
vi.mock("@/server/financeiro/permuta-servico", () => ({ consultarPermutas: mocks.consultar, listarCobrancasParaPermuta: vi.fn() }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./PermutaOperacional", () => ({ PermutaOperacional: ({ preferenciaFusoExibicao }: { preferenciaFusoExibicao: string | null }) => `preferência=${preferenciaFusoExibicao}` }));
import Page from "./page";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.sessao.mockResolvedValue({ id: "pedagogico", papeis: ["GERENTE_PEDAGOGICO"] });
  mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
});
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

it("lê a preferência somente depois da guarda e a encaminha à saída histórica", async () => {
  mocks.consultar.mockResolvedValue({ ok: true, dado: [] });
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  expect(html).toContain("preferência=America/Costa_Rica");
});

it("não consulta acordos ou preferência quando a guarda falha", async () => {
  mocks.sessao.mockRejectedValue(new Error("Sem sessão"));
  await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("Sem sessão");
  expect(mocks.consultar).not.toHaveBeenCalled();
  expect(mocks.preferencia).not.toHaveBeenCalled();
});
