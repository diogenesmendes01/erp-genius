import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), vendedores: vi.fn(), coberturas: vi.fn(), contar: vi.fn(), preferencia: vi.fn(), redirect: vi.fn((d: string) => { throw new Error(`REDIRECT ${d}`); }) }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { findMany: mocks.vendedores }, coberturaCarteira: { findMany: mocks.coberturas, count: mocks.contar } } }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./CoberturasPainel", () => ({ CoberturasPainel: ({ preferenciaFusoExibicao }: { preferenciaFusoExibicao: string | null }) => `fuso:${preferenciaFusoExibicao}` }));

import Page from "./page";

it("guarda carteiras antes das consultas e encaminha fallback da preferência", async () => {
  mocks.sessao.mockRejectedValueOnce(new Error("Sem acesso"));
  await expect(Page()).rejects.toThrow("Sem acesso");
  expect(mocks.vendedores).not.toHaveBeenCalled();
  expect(mocks.coberturas).not.toHaveBeenCalled();
  expect(mocks.contar).not.toHaveBeenCalled();
  expect(mocks.preferencia).not.toHaveBeenCalled();

  mocks.sessao.mockResolvedValue({ id: "gestor", papeis: [] });
  mocks.vendedores.mockResolvedValue([]);
  mocks.coberturas.mockResolvedValue([]);
  mocks.contar.mockResolvedValue(0);
  mocks.preferencia.mockResolvedValue({ ok: false });
  expect(renderToStaticMarkup(await Page())).toContain("fuso:null");
});

it("coberturas paginadas (E4): 50 por página com desempate, contador, e página além do fim volta à última", async () => {
  mocks.sessao.mockResolvedValue({ id: "gestor", papeis: ["ADMINISTRADOR"] });
  mocks.vendedores.mockResolvedValue([]);
  mocks.preferencia.mockResolvedValue({ ok: false });
  mocks.contar.mockResolvedValue(120);
  mocks.coberturas.mockResolvedValue(Array.from({ length: 50 }, (_, i) => ({ id: `c${i}`, titular: { nome: "T" }, substituto: { nome: "S" }, inicio: new Date(), fim: new Date(), revogadaEm: null, motivo: "m" })));
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ pagina: "2" }) }));
  expect(mocks.coberturas).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 50, take: 50, orderBy: [{ criadoEm: "desc" }, { id: "desc" }] }));
  expect(html).toContain("51–100 de 120 coberturas");
  expect(html).toContain('href="/carteiras"'); // anterior = página 1
  expect(html).toContain('href="/carteiras?pagina=3"');
  await expect(Page({ searchParams: Promise.resolve({ pagina: "9" }) })).rejects.toThrow("REDIRECT /carteiras?pagina=3");
});
