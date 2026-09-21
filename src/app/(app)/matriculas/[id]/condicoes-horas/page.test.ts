import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ guarda: vi.fn(), consulta: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.guarda }));
vi.mock("@/server/matricula/condicoes-horas", () => ({ consultarCondicoesHoras: mocks.consulta }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./CondicoesHoras", () => ({ CondicoesHoras: ({ preferenciaFusoExibicao }: { preferenciaFusoExibicao: string | null }) => createElement("div", { "data-fuso": preferenciaFusoExibicao ?? "FALLBACK" }) }));
import Page from "./page";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.consulta.mockResolvedValue({ ok: true, dado: { matriculaId: "m" } });
  mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
});

it("passa preferência somente depois da guarda e preserva fallback nulo", async () => {
  const entrada = { params: Promise.resolve({ id: "m" }) };
  expect(renderToStaticMarkup(await Page(entrada))).toContain('data-fuso="America/Costa_Rica"');
  mocks.preferencia.mockResolvedValue({ ok: false, erro: "indisponível" });
  expect(renderToStaticMarkup(await Page(entrada))).toContain('data-fuso="FALLBACK"');
});

it("não lê dados quando a guarda falha", async () => {
  mocks.guarda.mockRejectedValue(new Error("Sem acesso"));
  await expect(Page({ params: Promise.resolve({ id: "m" }) })).rejects.toThrow("Sem acesso");
  expect(mocks.consulta).not.toHaveBeenCalled();
  expect(mocks.preferencia).not.toHaveBeenCalled();
});
