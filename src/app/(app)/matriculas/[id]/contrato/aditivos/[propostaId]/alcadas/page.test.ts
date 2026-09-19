import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ guarda: vi.fn(), consultar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.guarda }));
vi.mock("@/server/contratos/aditivo-alcadas", () => ({ consultarAlcadasAditivo: mocks.consultar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./Formulario", () => ({ FormularioAlcada: () => null }));
import Page from "./page";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  mocks.consultar.mockResolvedValue({ ok: true, dado: { vigenciaInicio: "2026-10-01T02:30:00Z", superada: false, alcadas: [], podeDecidir: [], propostaHash: "h" } });
});

it("exibe a vigência contratual na preferência, com fallback UTC", async () => {
  const entrada = { params: Promise.resolve({ id: "m", propostaId: "p" }) };
  expect(renderToStaticMarkup(await Page(entrada))).toContain("30/09/2026, 20:30");
  mocks.preferencia.mockResolvedValue({ ok: false, erro: "indisponível" });
  expect(renderToStaticMarkup(await Page(entrada))).toContain("01/10/2026, 02:30");
});

it("não consulta alçadas nem preferência quando a guarda falha", async () => {
  mocks.guarda.mockRejectedValue(new Error("Sem acesso"));
  await expect(Page({ params: Promise.resolve({ id: "m", propostaId: "p" }) })).rejects.toThrow("Sem acesso");
  expect(mocks.consultar).not.toHaveBeenCalled();
  expect(mocks.preferencia).not.toHaveBeenCalled();
});
