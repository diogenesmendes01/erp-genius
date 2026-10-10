import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ listar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: vi.fn() }));
vi.mock("@/server/avaliacoes/segunda-chamada-fila-agenda", () => ({ listarSegundasChamadasSemAgenda: mocks.listar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
import Page from "./page";
const ana = { propostaSegundaChamadaId: "fonte/a?", aluno: "Ana", matriculaCodigo: "M1", turma: "T1", codigoAvaliacao: "AV1", prazoAte: "2026-10-02T12:00:00.000Z", situacao: { pendente: true, saldo: 1, statusMatricula: "ATIVA", alocacaoAtiva: true, possuiReservaTerminal: false, possuiPendenciaEscola: false, requerPrevia: true } };
describe("FilaPendentesAgenda", () => {
 mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
 it("exibe dados mínimos e pagina nos dois sentidos", async () => {
  mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [ana], pagina: 3, temProxima: true } });
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ pagina: "3" }) }));
  expect(mocks.listar).toHaveBeenLastCalledWith({ pagina: 3 });
  expect(html).toContain("Ana"); expect(html).toContain("fonte%2Fa%3F/agenda"); expect(html).not.toContain("evidência");
  expect(html).toContain('href="/academico/segundas-chamadas/pendentes-agenda?pagina=2">← Anterior');
  expect(html).toContain('href="/academico/segundas-chamadas/pendentes-agenda?pagina=4">Próxima');
 });
 it("primeira página só com Próxima; da segunda, Anterior volta sem ?pagina=1; a última não tem Próxima", async () => {
  mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [ana], pagina: 1, temProxima: true } });
  const primeira = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  expect(mocks.listar).toHaveBeenLastCalledWith({ pagina: 1 });
  expect(primeira).not.toContain("Anterior");
  expect(primeira).not.toContain("pagina=1");
  expect(primeira).toContain('href="/academico/segundas-chamadas/pendentes-agenda?pagina=2">Próxima');
  mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [ana], pagina: 2, temProxima: false } });
  const segunda = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ pagina: "2" }) }));
  expect(segunda).toContain('href="/academico/segundas-chamadas/pendentes-agenda">← Anterior');
  expect(segunda).not.toContain("Próxima");
 });
 it("prioriza impedimento da escola e vínculo pausado sem pressupor resolução", async () => {
  mocks.listar.mockResolvedValue({ ok: true, dado: { pagina: 1, temProxima: false, itens: [
   { propostaSegundaChamadaId: "escola", aluno: "Ana", matriculaCodigo: "M1", turma: "T1", codigoAvaliacao: "AV1", prazoAte: "2026-10-02T12:00:00.000Z", situacao: { pendente: true, saldo: 1, statusMatricula: "ATIVA", alocacaoAtiva: true, possuiReservaTerminal: true, possuiPendenciaEscola: true, requerPrevia: true } },
   { propostaSegundaChamadaId: "pausada", aluno: "Bia", matriculaCodigo: "M2", turma: "T2", codigoAvaliacao: "AV2", prazoAte: "2026-10-02T12:00:00.000Z", situacao: { pendente: true, saldo: 1, statusMatricula: "PAUSADA", alocacaoAtiva: true, possuiReservaTerminal: false, possuiPendenciaEscola: false, requerPrevia: true } },
  ] } });
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  expect(html).toContain("Impedimento da escola pendente de revisão");
  expect(html).toContain("Indisponível sem autorização específica; a prévia confere");
  expect(html).not.toContain("Oportunidade anterior encerrada");
 });
 it("mostra somente erro", async () => {
  mocks.listar.mockResolvedValue({ ok: false, erro: "Consulta recusada." });
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  expect(html).toContain("Consulta recusada."); expect(html).not.toContain("prazo");
 });
});
