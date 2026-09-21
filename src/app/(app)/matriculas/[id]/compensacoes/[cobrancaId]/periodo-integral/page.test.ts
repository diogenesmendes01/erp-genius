import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ guarda: vi.fn(), consulta: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.guarda }));
vi.mock("@/server/matricula/periodo-integral", () => ({ consultarRegularizacoesPeriodoIntegral: mocks.consulta }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./PeriodoIntegral", () => ({ PeriodoIntegral: ({ preferenciaFusoExibicao }: { preferenciaFusoExibicao: string | null }) => createElement("div", { "data-fuso": preferenciaFusoExibicao ?? "UTC" }) }));
import Page from "./page";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.consulta.mockResolvedValue({ ok: true, dado: {} });
  mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
});

it("encaminha a preferência após a guarda e mantém fallback UTC", async () => {
  const entrada = { params: Promise.resolve({ id: "m", cobrancaId: "c" }) };
  expect(renderToStaticMarkup(await Page(entrada))).toContain('data-fuso="America/Costa_Rica"');
  mocks.preferencia.mockResolvedValue({ ok: false, erro: "indisponível" });
  expect(renderToStaticMarkup(await Page(entrada))).toContain('data-fuso="UTC"');
});

it("não consulta dados quando a guarda falha", async () => {
  mocks.guarda.mockRejectedValue(new Error("Sem acesso"));
  await expect(Page({ params: Promise.resolve({ id: "m", cobrancaId: "c" }) })).rejects.toThrow("Sem acesso");
  expect(mocks.consulta).not.toHaveBeenCalled();
  expect(mocks.preferencia).not.toHaveBeenCalled();
});
