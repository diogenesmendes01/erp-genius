import { renderToStaticMarkup } from "react-dom/server";
import { vi, expect, it } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), opcoes: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/contratos/agenda-aditivo", () => ({ consultarOpcoesConferenciaAgendaAditivo: mocks.opcoes }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
import Page from "./page";

it("renderiza controles somente leitura da conferência sem acesso financeiro", async () => {
  mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
  mocks.opcoes.mockResolvedValue({ ok: true, dado: { matricula: { id: "m", aluno: "Ana" }, encontros: [{ id: "e", inicio: "2099-10-10T15:00:00.000Z", fim: "2099-10-10T16:00:00.000Z", fusoOrigem: "UTC", professorId: "p", professor: "Docente" }], professores: [{ id: "p", nome: "Docente" }] } });
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m" }) }));
  expect(mocks.opcoes).toHaveBeenCalledWith({ matriculaId: "m" });
  expect(html).toContain("10/10/2099, 15:00–10/10/2099, 16:00 (UTC)");
  expect(html).toContain("Conferência — não reserva nem altera agenda.");
  expect(html).toContain('type="checkbox"');
  expect(html).toContain("Conferir alterações");
  expect(html).not.toMatch(/financeir|aprovar|gerar contrato/i);
});

it("exibe os encontros atuais na preferência pessoal sem alterar os campos de entrada", async () => {
  mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Sao_Paulo" } });
  mocks.opcoes.mockResolvedValue({ ok: true, dado: { matricula: { id: "m", aluno: "Ana" }, encontros: [{ id: "e", inicio: "2099-10-10T15:00:00.000Z", fim: "2099-10-10T16:00:00.000Z", fusoOrigem: "UTC", professorId: "p", professor: "Docente" }], professores: [{ id: "p", nome: "Docente" }] } });
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m" }) }));
  expect(html).toContain("10/10/2099, 12:00–10/10/2099, 13:00 (America/Sao_Paulo)");
});
