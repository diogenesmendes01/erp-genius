import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), acerto: vi.fn(), delta: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/matricula/desistencia-financeiro-consulta", () => ({ consultarCancelamentoFinanceiroDesistencia: mocks.consultar }));
vi.mock("@/server/matricula/desistencia-acerto-consulta", () => ({ consultarAcertoDesistenciaContratual: mocks.acerto }));
vi.mock("@/server/matricula/desistencia-reconferencia-delta-consulta", () => ({ consultarReconferenciaDeltaDesistencia: mocks.delta }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./ReconferenciaDeltaFormularios", () => ({
  PrepararReconferenciaDeltaFormulario: () => createElement("div", { "data-delta": "preparar" }),
  DecidirReconferenciaDeltaFormulario: () => createElement("div", { "data-delta": "decidir" }),
  AplicarReconferenciaDeltaFormulario: () => createElement("div", { "data-delta": "aplicar" }),
}));
vi.mock("./AcertoContratualFormularios", () => ({
  PrepararAcertoContratualFormulario: ({ reapresentacao }: { reapresentacao?: { id: string; versao: number; aprovada: boolean } | null }) => createElement("div", { "data-acerto": "preparar", "data-reapresentacao": reapresentacao?.id, "data-versao-reapresentada": reapresentacao?.versao }),
  DecidirAcertoContratualFormulario: () => createElement("div", { "data-acerto": "decidir" }),
  AplicarAcertoContratualFormulario: () => createElement("div", { "data-acerto": "aplicar" }),
}));
vi.mock("./Formularios", () => ({
  PropostaFormulario: ({ pedidoId }: { pedidoId: string; estadoHash: string }) => createElement("div", { "data-formulario": "proposta", "data-pedido": pedidoId }, "Proposta"),
  DecisaoFormulario: ({ propostaId, podeAprovar }: { propostaId: string; propostaHash: string; podeAprovar: boolean }) => createElement("div", { "data-formulario": "decisao", "data-proposta": propostaId, "data-aprovar": String(podeAprovar) }, "Decisão"),
}));

import Page from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.acerto.mockResolvedValue({ ok: true, dado: {
    matricula: { id: "m", alunoId: "aluno" }, propostas: [], podePreparar: false,
    impedimento: "Regra contratual aguardando conferência.", pedido: null, condicoes: null,
  } });
  mocks.delta.mockResolvedValue({ ok: true, dado: { podePreparar: false, impedimento: "Aplique primeiro a memória contratual Q165.", aplicacoesBase: [] } });
  mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: null } });
});

const resposta = (sobrescrever: Record<string, unknown> = {}) => ({ ok: true, dado: {
  matricula: { codigo: "MAT-595" },
  impedimento: null,
  cobrancas: [{ id: "cobranca-interna", tipo: "MATRICULA", status: "PENDENTE", vencimento: "2026-10-15T12:00:00.000Z", moeda: "CRC", valorOriginal: "100.00", valorNegociado: "90.00", saldo: "90.00" }],
  pedido: { id: "pedido-atual", estadoHash: "a".repeat(64) },
  podePropor: true,
  propostas: [{ id: "proposta-atual", versao: 2, preparadorNome: "Financeiro A", criadaEmISO: "2026-10-01T02:30:00.000Z", motivo: "Cobrança sem baixa confirmada", evidenciaCondicoes: "Extrato e condições revisados", propostaHash: "b".repeat(64), podeDecidir: true, podeAprovar: true, decisao: null }],
  ...sobrescrever,
} });

describe("DesistenciaFinanceiraPage", () => {
  it("mostra falha da consulta contratual sem oferecer preparo ou aplicação", async () => {
    mocks.consultar.mockResolvedValue(resposta());
    mocks.acerto.mockResolvedValue({ ok: false, erro: "Acesso contratual indisponível." });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m" }) }));
    expect(html).toContain("Acesso contratual indisponível.");
    expect(html).not.toContain("data-acerto=");
  });

  it("apresenta crédito aplicado e sua origem sem permitir nova aplicação", async () => {
    mocks.consultar.mockResolvedValue(resposta({ podePropor: false, propostas: [] }));
    mocks.acerto.mockResolvedValue({ ok: true, dado: {
      matricula: { id: "contrato", alunoId: "aluno" }, pedido: null, condicoes: null,
      podePreparar: false, impedimento: "Acerto aplicado; efetivação pendente.",
      propostas: [{ id: "proposta", preparadorNome: "Financeiro A", criadaEmISO: "2026-09-18T12:00:00Z",
        itens: [{ cobrancaId: "taxa", moeda: "BRL", devido: "50.00", saldoDevido: "0.00", creditoApurado: "50.00" }],
        podeDecidir: false, podeAplicar: false,
        decisao: { aprovada: true, decisorNome: "Financeiro B", motivo: "Conferido", aplicacao: { criadaEmISO: "2026-09-18T13:00:00Z", creditos: ["credito-q165"] } },
      }],
    } });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "contrato" }) }));
    expect(html).toContain("R$ 50,00");
    expect(html).toContain('/alunos/aluno/creditos/credito-q165');
    expect(html).toContain("efetivação pendente");
    expect(html).not.toContain("data-acerto=");
  });

  it("exibe o histórico administrativo no fuso pessoal sem converter vencimento, valores ou memória", async () => {
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
    mocks.consultar.mockResolvedValue(resposta({
      propostas: [{
        id: "proposta-decisao", versao: 2, preparadorNome: "Financeiro A", criadaEmISO: "2026-10-01T02:30:00.000Z",
        motivo: "Cobrança sem baixa confirmada", evidenciaCondicoes: "Extrato e condições revisados", propostaHash: "b".repeat(64), podeDecidir: false, podeAprovar: false,
        decisao: { aprovada: true, decisorNome: "Financeiro B", decididaEmISO: "2026-10-01T03:30:00.000Z", motivo: "Conferido" },
      }],
    }));
    mocks.acerto.mockResolvedValue({ ok: true, dado: {
      matricula: { id: "contrato", alunoId: "aluno" }, pedido: null, condicoes: null, podePreparar: false, impedimento: null,
      propostas: [{
        id: "acerto", versao: 1, preparadorNome: "Financeiro A", criadaEmISO: "2026-10-01T04:30:00.000Z", itens: [{ cobrancaId: "cobranca-interna", moeda: "CRC", devido: "90.00", saldoDevido: "90.00", creditoApurado: "0.00" }],
        podeDecidir: false, podeAplicar: false,
        decisao: { aprovada: true, decisorNome: "Financeiro B", motivo: "Conferido", aplicacao: { criadaEmISO: "2026-10-01T05:30:00.000Z", creditos: [] } },
      }],
    } });
    mocks.delta.mockResolvedValue({ ok: true, dado: {
      podePreparar: false, impedimento: null, aplicacoesBase: [{
        id: "base", criadaEmISO: "2026-10-01T06:30:00.000Z", podePreparar: false, preparoBloqueadoPor: null,
        propostas: [{
          id: "delta", versao: 1, estado: "APLICADA", criadaEmISO: "2026-10-01T07:30:00.000Z", preparadorNome: "Financeiro C", fotografiaHash: "d".repeat(64), pendencia: null, itens: [], creditosExternos: [],
          podeDecidirFinanceiro: false, podeDecidirAdministrativo: false, podeAplicar: false, decisaoFinanceira: null, decisaoAdministrativa: null,
          aplicacao: { criadaEmISO: "2026-10-01T08:30:00.000Z" },
        }],
      }],
    } });

    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m" }) }));

    expect(html).toContain("30/09/2026, 20:30");
    expect(html).toContain("30/09/2026, 21:30");
    expect(html).toContain("30/09/2026, 22:30");
    expect(html).toContain("30/09/2026, 23:30");
    expect(html).toContain("01/10/2026, 00:30");
    expect(html).toContain("America/Costa_Rica; origem UTC");
    expect(html).toContain("15/10/2026");
    expect(html).toContain("₡ 100");
    expect(html).toContain("₡ 90");
    expect(html).toContain("Extrato e condições revisados");
  });

  it("usa UTC quando não há preferência válida", async () => {
    mocks.consultar.mockResolvedValue(resposta());
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Preferência indisponível." });

    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m" }) }));

    expect(html).toContain("01/10/2026, 02:30");
    expect(html).toContain("UTC; origem UTC");
  });
  it("entrega à preparação a última versão decidida para reapresentação", async () => {
    mocks.consultar.mockResolvedValue(resposta({ podePropor: false, propostas: [] }));
    mocks.acerto.mockResolvedValue({ ok: true, dado: {
      matricula: { id: "contrato", alunoId: "aluno" }, pedido: { id: "pedido" }, condicoes: { id: "condicoes" },
      podePreparar: true, impedimento: null, propostas: [],
      reapresentacao: { id: "proposta-rejeitada", versao: 2, aprovada: false },
    } });

    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "contrato" }) }));

    expect(html).toContain('data-acerto="preparar"');
    expect(html).toContain('data-reapresentacao="proposta-rejeitada"');
    expect(html).toContain('data-versao-reapresentada="2"');
  });
  it("exige Financeiro/Administração e mostra valores somente na conferência financeira", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.FINANCEIRO] });
    mocks.consultar.mockResolvedValue(resposta());

    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "matricula/a?" }) }));

    expect(mocks.sessao).toHaveBeenCalledWith(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    expect(mocks.consultar).toHaveBeenCalledWith({ matriculaId: "matricula/a?" });
    expect(html).toContain("₡ 100");
    expect(html).toContain("₡ 90");
    expect(html).toContain("15/10/2026");
    expect(html).toContain('data-formulario="proposta"');
    expect(html).toContain('data-formulario="decisao"');
    expect(html).toContain('data-aprovar="true"');
    expect(html).not.toContain("cobranca-interna");
    expect(html).not.toContain("aaaaaaaa");
  });

  it("mantém o histórico e permite somente rejeição para versão obsoleta", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.ADMINISTRADOR] });
    mocks.consultar.mockResolvedValue(resposta({
      impedimento: "As cobranças mudaram desde a última proposta.",
      podePropor: false,
      propostas: [
        { id: "proposta-obsoleta", versao: 3, preparadorNome: "Financeiro A", criadaEmISO: "2026-10-01T02:30:00.000Z", motivo: "Proposta desatualizada", evidenciaCondicoes: "Evidência histórica", propostaHash: "c".repeat(64), podeDecidir: true, podeAprovar: false, decisao: null },
        { id: "proposta-rejeitada", versao: 2, preparadorNome: "Financeiro B", criadaEmISO: "2026-09-30T02:30:00.000Z", motivo: "Condição anterior", evidenciaCondicoes: "Evidência anterior", propostaHash: "d".repeat(64), podeDecidir: false, podeAprovar: false, decisao: { aprovada: false, decisorNome: "Financeiro C", decididaEmISO: "2026-09-30T03:30:00.000Z", motivo: "Saldo não conferido" } },
      ],
    }));

    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m" }) }));

    expect(html).toContain("As cobranças mudaram desde a última proposta.");
    expect(html).toContain("Versão 3 · Financeiro A");
    expect(html).toContain('data-formulario="decisao"');
    expect(html).toContain('data-aprovar="false"');
    expect(html).not.toContain('data-formulario="proposta"');
    expect(html).toContain("Rejeitada por Financeiro C, em 30/09/2026, 03:30 (UTC; origem UTC): Saldo não conferido");
  });

  it("mostra crédito externo e motivo da rejeição, sem repetir preparo durante pendência", async () => {
    mocks.consultar.mockResolvedValue(resposta({ podePropor: false, propostas: [] }));
    mocks.delta.mockResolvedValue({ ok: true, dado: {
      podePreparar: true, impedimento: null, aplicacoesBase: [{ id: "base", criadaEmISO: "2026-09-18T12:00:00Z", podePreparar: false,
        preparoBloqueadoPor: "Conclua a conferência do informe de pagamento no fluxo financeiro.", propostas: [{
          id: "delta-pendente", versao: 3, estado: "PENDENCIA_FINANCEIRA", fotografiaHash: "f".repeat(64), criadaEmISO: "2026-09-18T13:00:00Z", preparadorNome: "Financeiro A",
          tipo: "PENDENCIA", pendencia: "Há informe de pagamento pendente de conferência.", itens: [],
          creditosExternos: [{ id: "credito-externo", moeda: "BRL", saldoDisponivel: "17.00" }],
          podeDecidirFinanceiro: false, podeDecidirAdministrativo: false, podeAplicar: false,
          decisaoFinanceira: { id: "decisao-fin", aprovada: false, decisorNome: "Financeiro B", motivo: "Comprovante não confere." },
          decisaoAdministrativa: null, aplicacao: null,
        }] }],
    } });

    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m" }) }));

    expect(html).toContain("Créditos externos preservados nesta fotografia");
    expect(html).toContain("credito-externo");
    expect(html).toContain("BRL");
    expect(html).toContain("R$ 17,00");
    expect(html).toContain("Comprovante não confere.");
    expect(html).toContain("Conclua a conferência do informe");
    expect(html).not.toContain('data-delta="preparar"');
  });

  it("orienta nova preparação quando a aprovação anterior perdeu alçada", async () => {
    mocks.consultar.mockResolvedValue(resposta({ podePropor: false, propostas: [] }));
    mocks.delta.mockResolvedValue({ ok: true, dado: {
      podePreparar: true, impedimento: null, aplicacoesBase: [{
        id: "base", criadaEmISO: "2026-09-18T12:00:00Z", podePreparar: true, preparoBloqueadoPor: null,
        orientacaoPreparacao: "Uma aprovação anterior perdeu a alçada atual. Prepare nova reconferência para novas decisões independentes; nenhuma aprovação antiga volta a valer automaticamente.",
        propostas: [],
      }],
    } });

    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m" }) }));

    expect(html).toContain("perdeu a alçada atual");
    expect(html).toContain("nenhuma aprovação antiga volta a valer automaticamente");
    expect(html).toContain('data-delta="preparar"');
  });

  it("mostra o erro sem montar valores ou formulários", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.FINANCEIRO] });
    mocks.consultar.mockResolvedValue({ ok: false, erro: "Matrícula fora do escopo financeiro." });

    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m" }) }));

    expect(html).toContain("Matrícula fora do escopo financeiro.");
    expect(html).not.toContain("Cobranças desta matrícula");
    expect(html).not.toContain('data-formulario=');
  });

  it("não consulta preferência ou dados financeiros quando a guarda falha", async () => {
    mocks.sessao.mockRejectedValue(new Error("Sessão expirada."));

    await expect(Page({ params: Promise.resolve({ id: "m" }) })).rejects.toThrow("Sessão expirada.");

    expect(mocks.consultar).not.toHaveBeenCalled();
    expect(mocks.acerto).not.toHaveBeenCalled();
    expect(mocks.delta).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});
