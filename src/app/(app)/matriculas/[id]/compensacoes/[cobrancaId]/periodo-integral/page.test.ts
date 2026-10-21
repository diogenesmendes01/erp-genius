import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ guarda: vi.fn(), consulta: vi.fn(), preferencia: vi.fn(), fusoEscola: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.guarda }));
vi.mock("@/server/matricula/periodo-integral", () => ({ consultarRegularizacoesPeriodoIntegral: mocks.consulta }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/relatorios/atendimento", () => ({ fusoDaEscola: mocks.fusoEscola }));
vi.mock("./PeriodoIntegral", async (original) => ({ ...(await original<typeof import("./PeriodoIntegral")>()), PeriodoIntegral: ({ preferenciaFusoExibicao, fusoEscola }: { preferenciaFusoExibicao: string | null; fusoEscola: string }) => createElement("div", { "data-fuso": preferenciaFusoExibicao ?? "nenhum", "data-escola": fusoEscola }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import Page from "./page";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.consulta.mockResolvedValue({ ok: true, dado: {} });
  mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  mocks.fusoEscola.mockResolvedValue("America/Sao_Paulo");
});

it("encaminha a preferência e o fuso da escola após a guarda", async () => {
  const entrada = { params: Promise.resolve({ id: "m", cobrancaId: "c" }) };
  expect(renderToStaticMarkup(await Page(entrada))).toContain('data-fuso="America/Costa_Rica" data-escola="America/Sao_Paulo"');
  mocks.preferencia.mockResolvedValue({ ok: false, erro: "indisponível" });
  expect(renderToStaticMarkup(await Page(entrada))).toContain('data-fuso="nenhum" data-escola="America/Sao_Paulo"');
});

// Lote 3 do fuso pessoal: sem preferência, o instante sai no fuso da escola (antes, UTC). Fixo em TZ=UTC e SP.
it("instante de registro/decisão/aplicação: pessoal; sem preferência, a escola; escola inválida, UTC — sempre escrito", async () => {
  const { instanteDoPeriodoIntegral } = await import("./PeriodoIntegral");
  expect(instanteDoPeriodoIntegral("2026-10-21T02:30:00.000Z", null, "America/Sao_Paulo")).toBe("20/10/2026, 23:30 (horário exibido em America/Sao_Paulo)");
  expect(instanteDoPeriodoIntegral("2026-10-21T02:30:00.000Z", "Asia/Tokyo", "America/Sao_Paulo")).toBe("21/10/2026, 11:30 (horário exibido em Asia/Tokyo)");
  expect(instanteDoPeriodoIntegral("2026-10-21T02:30:00.000Z", null, "Lua/Base")).toBe("21/10/2026, 02:30 (horário exibido em UTC)");
});

it("não consulta dados quando a guarda falha", async () => {
  mocks.guarda.mockRejectedValue(new Error("Sem acesso"));
  await expect(Page({ params: Promise.resolve({ id: "m", cobrancaId: "c" }) })).rejects.toThrow("Sem acesso");
  expect(mocks.consulta).not.toHaveBeenCalled();
  expect(mocks.preferencia).not.toHaveBeenCalled();
});
