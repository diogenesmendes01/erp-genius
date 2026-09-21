import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ listar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: vi.fn() }));
vi.mock("@/server/avaliacoes/segunda-chamada-fila-agenda", () => ({ listarSegundasChamadasSemAgenda: mocks.listar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
import Page from "./page";
describe("FilaPendentesAgenda", () => {
 mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
 it("exibe dados mínimos e cursores codificados", async () => {
  mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [{ propostaSegundaChamadaId: "fonte/a?", aluno: "Ana", matriculaCodigo: "M1", turma: "T1", codigoAvaliacao: "AV1", prazoAte: "2026-10-02T12:00:00.000Z", situacao: { pendente: true, saldo: 1, statusMatricula: "ATIVA", alocacaoAtiva: true, possuiReservaTerminal: false, possuiPendenciaEscola: false, requerPrevia: true } }], proximoCursor: { criadaEm: "2026-09-01T12:00:00.000Z", id: "cursor &/" } } });
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ cursor: JSON.stringify({ criadaEm: "2026-09-02T12:00:00.000Z", id: "anterior" }) }) }));
  expect(html).toContain("Ana"); expect(html).toContain("fonte%2Fa%3F/agenda"); expect(html).toContain("Primeira página"); expect(html).toContain("cursor=%7B%22criadaEm%22%3A%222026-09-01T12%3A00%3A00.000Z%22%2C%22id%22%3A%22cursor%20%26%2F%22%7D"); expect(html).not.toContain("evidência");
 });
 it("prioriza impedimento da escola e vínculo pausado sem pressupor resolução", async () => {
  mocks.listar.mockResolvedValue({ ok: true, dado: { proximoCursor: null, itens: [
   { propostaSegundaChamadaId: "escola", aluno: "Ana", matriculaCodigo: "M1", turma: "T1", codigoAvaliacao: "AV1", prazoAte: "2026-10-02T12:00:00.000Z", situacao: { pendente: true, saldo: 1, statusMatricula: "ATIVA", alocacaoAtiva: true, possuiReservaTerminal: true, possuiPendenciaEscola: true, requerPrevia: true } },
   { propostaSegundaChamadaId: "pausada", aluno: "Bia", matriculaCodigo: "M2", turma: "T2", codigoAvaliacao: "AV2", prazoAte: "2026-10-02T12:00:00.000Z", situacao: { pendente: true, saldo: 1, statusMatricula: "PAUSADA", alocacaoAtiva: true, possuiReservaTerminal: false, possuiPendenciaEscola: false, requerPrevia: true } },
  ] } });
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  expect(html).toContain("Impedimento da escola pendente de revisão");
  expect(html).toContain("Indisponível sem autorização específica; a prévia confere");
  expect(html).not.toContain("Oportunidade anterior encerrada");
 });
 it("mostra somente erro", async () => {
  mocks.listar.mockResolvedValue({ ok: false, erro: "Cursor inválido." });
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  expect(html).toContain("Cursor inválido."); expect(html).not.toContain("prazo");
 });
});
