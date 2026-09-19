import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), vendedores: vi.fn(), coberturas: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { findMany: mocks.vendedores }, coberturaCarteira: { findMany: mocks.coberturas } } }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./CoberturasPainel", () => ({ CoberturasPainel: ({ preferenciaFusoExibicao }: { preferenciaFusoExibicao: string | null }) => `fuso:${preferenciaFusoExibicao}` }));

import Page from "./page";

it("guarda carteiras antes das consultas e encaminha fallback da preferência", async () => {
  mocks.sessao.mockRejectedValueOnce(new Error("Sem acesso"));
  await expect(Page()).rejects.toThrow("Sem acesso");
  expect(mocks.vendedores).not.toHaveBeenCalled();
  expect(mocks.coberturas).not.toHaveBeenCalled();
  expect(mocks.preferencia).not.toHaveBeenCalled();

  mocks.sessao.mockResolvedValue({ id: "gestor", papeis: [] });
  mocks.vendedores.mockResolvedValue([]);
  mocks.coberturas.mockResolvedValue([]);
  mocks.preferencia.mockResolvedValue({ ok: false });
  expect(renderToStaticMarkup(await Page())).toContain("fuso:null");
});