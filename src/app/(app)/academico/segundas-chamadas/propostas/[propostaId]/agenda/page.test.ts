import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ consultar: vi.fn(), fuso: vi.fn(), preferencia: vi.fn(), formulario: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: vi.fn() }));
vi.mock("@/server/avaliacoes/segunda-chamada-agenda-inicial", () => ({ consultarAgendasIniciaisSegundaChamada: mocks.consultar }));
vi.mock("@/server/operacao/consultas", () => ({ consultarFusoInstitucional: mocks.fuso }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./Formulario", () => ({ Formulario: (props: { proposta?: { podeAprovar: boolean; impedimentoAprovacao: string | null }; fusoInicial?: string }) => { mocks.formulario(props); return props.proposta ? `${props.proposta.podeAprovar ? "aprovar" : "rejeitar"}:${props.proposta.impedimentoAprovacao ?? ""}` : "formulário"; } }));
import Page from "./page";

beforeEach(() => {
 vi.clearAllMocks();
 mocks.fuso.mockResolvedValue(null);
 mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: null } });
});

const item = {
 id: "agenda/1?", versao: 1, autorNome: "Secretaria", professorNome: "Docente", inicio: "2026-10-02T12:00:00.000Z", fim: "2026-10-02T13:00:00.000Z", fusoOrigem: "America/Sao_Paulo", motivo: "Motivo válido", evidencia: "Evidência válida", motivoExcecaoNaoLetiva: "Exceção registrada", criadaEm: "2026-09-01T12:00:00.000Z", entradaHash: null, podeDecidir: false, decisao: null,
 calendario: { versao: 7, fusoInstitucional: "America/Sao_Paulo", periodos: [{ nome: "Feriado", inicio: "2026-10-02", fim: "2026-10-02" }] },
};
const dado = { identificacao: { aluno: "Ana", matriculaCodigo: "M1", turma: "T1", nivel: "N1" }, professores: [], podePropor: true, itens: [], proximoId: null };
const renderizar = async () => renderToStaticMarkup(await Page({ params: Promise.resolve({ propostaId: "fonte" }), searchParams: Promise.resolve({}) }));
const fusoInicialPassado = () => (mocks.formulario.mock.calls.at(-1)?.[0] as { fusoInicial?: string } | undefined)?.fusoInicial;

describe("AgendaInicialSegundaChamadaPage", () => {
 it("exibe histórico legível, data civil e paginação codificada", async () => {
  mocks.consultar.mockResolvedValue({ ok: true, dado: { identificacao: { aluno: "Ana", matriculaCodigo: "M1", turma: "T1", nivel: "N1" }, professores: [], podePropor: false, itens: [item], proximoId: "próximo &/" } });
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ propostaId: "fonte" }), searchParams: Promise.resolve({ antesId: "anterior" }) }));
  expect(html).toContain("Proposta de Secretaria");
  expect(html).toContain("Feriado, de 02/10/2026 até 02/10/2026");
  expect(html).not.toContain("01/10/2026");
  expect(html).toContain("Primeira página");
  expect(html).toContain("antesId=pr%C3%B3ximo%20%26%2F");
  expect(html).not.toContain("calendarioId");
 });
 it("mostra somente o erro da consulta", async () => {
  mocks.consultar.mockResolvedValue({ ok: false, erro: "Sem acesso." });
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ propostaId: "fonte" }), searchParams: Promise.resolve({}) }));
  expect(html).toContain("Sem acesso.");
  expect(html).not.toContain("Histórico de propostas");
 });
 it("mantém rejeição e esconde aprovação da proposta com vínculo superado", async () => {
  mocks.consultar.mockResolvedValue({ ok: true, dado: { identificacao: { aluno: "Ana", matriculaCodigo: "M1", turma: "T1", nivel: "N1" }, professores: [], podePropor: false, proximoId: null, itens: [{ ...item, entradaHash: "hash", podeDecidir: true, podeAprovar: false, impedimentoAprovacao: "O vínculo de origem mudou; rejeite ou prepare nova proposta." }] } });
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ propostaId: "fonte" }), searchParams: Promise.resolve({}) }));
  expect(html).toContain("rejeitar:O vínculo de origem mudou; rejeite ou prepare nova proposta.");
  expect(html).not.toContain("aprovar:");
 });
 // docs/43 §6 item 6: o fuso dos horários começava vazio, só com placeholder.
 it("o fuso dos horários começa no fuso da escola; sem ele, na preferência; sem nenhum, vazio (nunca UTC presumido)", async () => {
  mocks.consultar.mockResolvedValue({ ok: true, dado });
  mocks.fuso.mockResolvedValue("America/Costa_Rica");
  mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Sao_Paulo" } });
  await renderizar();
  expect(fusoInicialPassado()).toBe("America/Costa_Rica");
  mocks.fuso.mockResolvedValue(null);
  await renderizar();
  expect(fusoInicialPassado()).toBe("America/Sao_Paulo");
  mocks.preferencia.mockResolvedValue({ ok: false, erro: "Sessão expirada." });
  await renderizar();
  expect(fusoInicialPassado()).toBe("");
 });
});
