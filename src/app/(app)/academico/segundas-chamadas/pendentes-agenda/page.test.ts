import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ listar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: vi.fn() }));
vi.mock("@/server/avaliacoes/segunda-chamada-fila-agenda", () => ({ listarSegundasChamadasSemAgenda: mocks.listar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
import Page from "./page";
const ana = { propostaSegundaChamadaId: "fonte/a?", aluno: "Ana", matriculaCodigo: "M1", turma: "T1", codigoAvaliacao: "AV1", prazoAte: "2026-10-02T12:00:00.000Z", situacao: { pendente: true, saldo: 1, statusMatricula: "ATIVA", alocacaoAtiva: true, possuiReservaTerminal: false, possuiPendenciaEscola: false, requerPrevia: true } };
const semNavegacao = { temAnterior: false, temProxima: false, anterior: null, proxima: null };
describe("FilaPendentesAgenda", () => {
 mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
 it("exibe dados mínimos e anda por cursor nos dois sentidos", async () => {
  mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [ana], temAnterior: true, temProxima: true, anterior: "fonte-21", proxima: "fonte-40" } });
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ depois: "fonte-20" }) }));
  expect(mocks.listar).toHaveBeenLastCalledWith({ depois: "fonte-20" });
  expect(html).toContain("Ana"); expect(html).toContain("fonte%2Fa%3F/agenda"); expect(html).not.toContain("evidência");
  expect(html).toContain('href="/academico/segundas-chamadas/pendentes-agenda?antes=fonte-21">← Anterior');
  expect(html).toContain('href="/academico/segundas-chamadas/pendentes-agenda?depois=fonte-40">Próxima');
 });
 it("início só com Próxima e sem link para si; voltando, o cursor chega à consulta; a última não tem Próxima", async () => {
  mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [ana], ...semNavegacao, temProxima: true, proxima: "fonte-20" } });
  const inicio = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  expect(mocks.listar).toHaveBeenLastCalledWith({});
  expect(inicio).not.toContain("Anterior");
  expect(inicio).not.toContain("pagina");
  expect(inicio).toContain('href="/academico/segundas-chamadas/pendentes-agenda?depois=fonte-20">Próxima');
  mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [ana], ...semNavegacao, temAnterior: true, anterior: "fonte-41" } });
  const ultima = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ antes: "fonte-60" }) }));
  expect(mocks.listar).toHaveBeenLastCalledWith({ antes: "fonte-60" });
  expect(ultima).toContain('href="/academico/segundas-chamadas/pendentes-agenda?antes=fonte-41">← Anterior');
  expect(ultima).not.toContain("Próxima");
 });
 it("vazio: fila zerada no início; cursor que não leva a nada volta ao início", async () => {
  mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [], ...semNavegacao } });
  const zerada = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  expect(zerada).toContain("Nenhuma segunda chamada pendente de agenda foi encontrada.");
  expect(zerada).not.toContain('href="/academico/segundas-chamadas/pendentes-agenda"');
  const alem = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ depois: "fonte-sumida" }) }));
  expect(alem).toContain("Nenhuma segunda chamada pendente a partir deste ponto da fila");
  expect(alem).toContain('href="/academico/segundas-chamadas/pendentes-agenda">Ir para o início da fila');
  expect(alem).not.toContain("nesta página");
 });
 it("prioriza impedimento da escola e vínculo pausado sem pressupor resolução", async () => {
  mocks.listar.mockResolvedValue({ ok: true, dado: { ...semNavegacao, itens: [
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
