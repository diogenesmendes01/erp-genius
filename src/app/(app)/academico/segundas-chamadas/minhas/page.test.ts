import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ fila: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: vi.fn() }));
vi.mock("@/server/avaliacoes/segunda-chamada-docente", () => ({ listarSegundasChamadasDocente: mocks.fila }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
import Page from "./page";
const item = { reservaId: "r", codigoAvaliacao: "AV", inicio: "2026-01-01T02:30:00.000Z", fim: "2026-01-01T03:30:00.000Z", fusoOrigem: "America/Costa_Rica", status: "RESERVADA", aluno: "Ana", matriculaCodigo: "M", turma: "T", realizacao: null, podeRealizar: false };
it("usa origem Costa Rica sem preferência e preferência UTC quando escolhida", async () => {
  mocks.fila.mockResolvedValue({ ok: true, dado: { itens: [item], pagina: 1, temProxima: false } });
  mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: null } });
  const costaRica = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
  const utc = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  expect(costaRica).toContain("31/12/2025"); expect(costaRica).toContain("America/Costa_Rica; origem America/Costa_Rica");
  expect(utc).toContain("01/01/2026"); expect(utc).toContain("UTC; origem America/Costa_Rica");
});

it("paginação nos dois sentidos: primeira só com Próxima; no meio, as duas; da segunda, Anterior sem ?pagina=1", async () => {
  mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
  mocks.fila.mockResolvedValue({ ok: true, dado: { itens: [item], pagina: 1, temProxima: true } });
  const primeira = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  expect(mocks.fila).toHaveBeenLastCalledWith({ pagina: 1 });
  expect(primeira).not.toContain("Anterior");
  expect(primeira).not.toContain("pagina=1");
  expect(primeira).toContain('href="/academico/segundas-chamadas/minhas?pagina=2">Próxima');

  const meio = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ pagina: "3" }) }));
  expect(mocks.fila).toHaveBeenLastCalledWith({ pagina: 3 });
  expect(meio).toContain('href="/academico/segundas-chamadas/minhas?pagina=2">← Anterior');
  expect(meio).toContain('href="/academico/segundas-chamadas/minhas?pagina=4">Próxima');

  mocks.fila.mockResolvedValue({ ok: true, dado: { itens: [item], pagina: 2, temProxima: false } });
  const segunda = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ pagina: "2" }) }));
  expect(segunda).toContain('href="/academico/segundas-chamadas/minhas">← Anterior');
  expect(segunda).not.toContain("Próxima");
});
