import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/financeiro/revisao-correcao-aula", () => ({ consultarRevisoesFinanceirasCorrecaoAula: mocks.consultar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import Page from "./page";

beforeEach(() => { vi.resetAllMocks(); mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" }); });

it("protege a página antes da consulta financeira", async () => {
  mocks.sessao.mockRejectedValue(new Error("sem alçada"));
  await expect(Page({ params: Promise.resolve({ id: "matricula" }) })).rejects.toThrow("sem alçada");
  expect(mocks.consultar).not.toHaveBeenCalled();
});

it("mostra a revisão vigente sem oferecer preparação repetida", async () => {
  mocks.sessao.mockResolvedValue({ papeis: [Papel.FINANCEIRO] });
  mocks.consultar.mockResolvedValue({ ok: true, dado: { usuarioId: "fin", revisoes: [], candidatas: [{ id: "q23", encontroId: "encontro", versao: 2, encontro: { id: "encontro", inicio: new Date("2026-01-10T15:00:00Z"), fim: new Date("2026-01-10T16:15:00Z"), fusoOrigem: "America/Sao_Paulo" }, podePreparar: false, preparoBloqueadoPor: "A revisão aprovada permanece vigente e aguarda publicação pedagógica." }] } });

  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "matricula/1" }) }));

  expect(mocks.sessao).toHaveBeenCalledWith(Papel.FINANCEIRO);
  expect(mocks.consultar).toHaveBeenCalledWith({ matriculaId: "matricula/1" });
  expect(html).toContain("aguarda publicação pedagógica");
  expect(html).toContain("10/01/2026, 12:00 (America/Sao_Paulo)");
  expect(html).not.toContain("Preparar revisão Q92");
  expect(html).toContain("/matriculas/matricula/1/ocorrencias-financeiras");
});

it("apresenta erro de consulta sem renderizar a operação", async () => {
  mocks.sessao.mockResolvedValue({ papeis: [Papel.FINANCEIRO] });
  mocks.consultar.mockResolvedValue({ ok: false, erro: "Matrícula sem acesso financeiro." });
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "matricula" }) }));
  expect(html).toContain('role="alert"');
  expect(html).toContain("Matrícula sem acesso financeiro.");
  expect(html).not.toContain("Revisões financeiras de correção de aula");
});

it("exibe o encontro na preferência pessoal de fuso", async () => {
  mocks.sessao.mockResolvedValue({ papeis: [Papel.FINANCEIRO] });
  mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Sao_Paulo" } });
  mocks.consultar.mockResolvedValue({ ok: true, dado: { usuarioId: "fin", revisoes: [], candidatas: [{ id: "q23", encontroId: "encontro", versao: 2, encontro: { id: "encontro", inicio: new Date("2026-01-10T15:00:00Z"), fim: new Date("2026-01-10T16:15:00Z"), fusoOrigem: "UTC" }, podePreparar: false, preparoBloqueadoPor: "Bloqueada." }] } });
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "matricula" }) }));
  expect(html).toContain("10/01/2026, 12:00 (America/Sao_Paulo)");
  expect(html).not.toContain("10/01/2026, 15:00");
});

it("Q175: oferece a declaração de aula não cobrável com o efeito calculado e o mostra no histórico", async () => {
  mocks.sessao.mockResolvedValue({ papeis: [Papel.FINANCEIRO] });
  const encontro = { id: "encontro", inicio: new Date("2026-01-10T15:00:00Z"), fim: new Date("2026-01-10T16:15:00Z"), fusoOrigem: "America/Sao_Paulo" };
  mocks.consultar.mockResolvedValue({ ok: true, dado: { usuarioId: "fin", candidatas: [{ id: "q23", encontroId: "encontro", versao: 1, encontro, podePreparar: true, preparoBloqueadoPor: null,
      tiposDisponiveis: [{ tipo: "AULA_NAO_COBRAVEL", efeito: { tipo: "REDUZ_COBRANCA_ABERTA", valorAula: "156.25", moeda: "CRC", valorNegociadoAnterior: "156.25", valorNegociadoNovo: "0" } }] }],
    revisoes: [{ id: "rev", versao: 1, tipo: "AULA_NAO_COBRAVEL", motivo: "Sala indisponível.", criadaEm: new Date("2026-01-20T12:00:00Z"), propostaCorrecaoAulaId: "q23", fotografiaHash: "a".repeat(64), podeDecidir: false,
      preparador: { id: "fin", nome: "Financeiro Um", ativo: true, papeis: [Papel.FINANCEIRO] }, decisao: null, propostaCorrecaoAula: { versao: 1, entradaHash: "b".repeat(64), autorId: "prof", encontro },
      fotografia: { efeito: { tipo: "GERA_CREDITO", valorAula: "156.25", moeda: "CRC", creditoValor: "156.25" } } }] } });

  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "matricula" }) }));

  expect(html).toContain('value="AULA_NAO_COBRAVEL"');
  expect(html).toContain("cai de 156.25 CRC para 0.00 CRC e é cancelada");
  expect(html).toContain("nasce crédito de 156.25 CRC na matrícula");
  expect(html).toContain("só acontece quando a gestão pedagógica publica");
  expect(html).not.toContain("não cria crédito");
});
