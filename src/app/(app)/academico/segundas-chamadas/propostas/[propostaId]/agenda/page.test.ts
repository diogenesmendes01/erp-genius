import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ consultar: vi.fn(), preferencia: vi.fn().mockResolvedValue({ ok: false, erro: "Indisponível" }) }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: vi.fn() }));
vi.mock("@/server/avaliacoes/segunda-chamada-agenda-inicial", () => ({ consultarAgendasIniciaisSegundaChamada: mocks.consultar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./Formulario", () => ({ Formulario: ({ proposta }: { proposta?: { podeAprovar: boolean; impedimentoAprovacao: string | null } }) => proposta ? `${proposta.podeAprovar ? "aprovar" : "rejeitar"}:${proposta.impedimentoAprovacao ?? ""}` : "formulário" }));
import Page from "./page";

const item = {
 id: "agenda/1?", versao: 1, autorNome: "Secretaria", professorNome: "Docente", inicio: "2026-10-02T12:00:00.000Z", fim: "2026-10-02T13:00:00.000Z", fusoOrigem: "America/Sao_Paulo", motivo: "Motivo válido", evidencia: "Evidência válida", motivoExcecaoNaoLetiva: "Exceção registrada", criadaEm: "2026-09-01T12:00:00.000Z", entradaHash: null, podeDecidir: false, decisao: null,
 calendario: { versao: 7, fusoInstitucional: "America/Sao_Paulo", periodos: [{ nome: "Feriado", inicio: "2026-10-02", fim: "2026-10-02" }] },
};
describe("AgendaInicialSegundaChamadaPage", () => {
 it("exibe histórico legível, data civil e paginação codificada", async () => {
  mocks.consultar.mockResolvedValue({ ok: true, dado: { identificacao: { aluno: "Ana", matriculaCodigo: "M1", turma: "T1", nivel: "N1" }, professores: [], podePropor: false, itens: [item], proximoId: "próximo &/" } });
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ propostaId: "fonte" }), searchParams: Promise.resolve({ antesId: "anterior" }) }));
  expect(html).toContain("Proposta de Secretaria em 01/09/2026, 09:00 (America/Sao_Paulo)");
  expect(html).toContain("02/10/2026, 09:00 até 02/10/2026, 10:00 (America/Sao_Paulo)");
  expect(html).toContain("Feriado, de 02/10/2026 até 02/10/2026");
  expect(html).not.toContain("01/10/2026");
  expect(html).toContain("Primeira página");
  expect(html).toContain("antesId=pr%C3%B3ximo%20%26%2F");
  expect(html).not.toContain("calendarioId");
 });
 it("exibe criação e horário proposto na preferência pessoal de fuso", async () => {
  mocks.preferencia.mockResolvedValueOnce({ ok: true, dado: { fusoExibicao: "America/Sao_Paulo" } });
  mocks.consultar.mockResolvedValue({ ok: true, dado: { identificacao: { aluno: "Ana", matriculaCodigo: "M1", turma: "T1", nivel: "N1" }, professores: [], podePropor: false, itens: [{ ...item, fusoOrigem: "UTC" }], proximoId: null } });
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ propostaId: "fonte" }), searchParams: Promise.resolve({}) }));
  expect(html).toContain("em 01/09/2026, 09:00 (America/Sao_Paulo)");
  expect(html).toContain("02/10/2026, 09:00 até 02/10/2026, 10:00 (America/Sao_Paulo)");
  expect(html).not.toContain("(UTC)");
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
 });});