import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ fila: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: vi.fn() }));
vi.mock("@/server/avaliacoes/segunda-chamada-docente", () => ({ listarSegundasChamadasDocente: mocks.fila }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
import Page from "./page";
const item = { reservaId: "r", codigoAvaliacao: "AV", inicio: "2026-01-01T02:30:00.000Z", fim: "2026-01-01T03:30:00.000Z", fusoOrigem: "America/Costa_Rica", status: "RESERVADA", aluno: "Ana", matriculaCodigo: "M", turma: "T", realizacao: null, podeRealizar: false };
it("usa origem Costa Rica sem preferência e preferência UTC quando escolhida", async () => {
  mocks.fila.mockResolvedValue({ ok: true, dado: { itens: [item], proximoId: null } });
  mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: null } });
  const costaRica = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
  const utc = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  expect(costaRica).toContain("31/12/2025"); expect(costaRica).toContain("America/Costa_Rica; origem America/Costa_Rica");
  expect(utc).toContain("01/01/2026"); expect(utc).toContain("UTC; origem America/Costa_Rica");
});
