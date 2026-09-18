import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), acerto: vi.fn(), delta: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/matricula/desistencia-financeiro-consulta", () => ({ consultarCancelamentoFinanceiroDesistencia: mocks.consultar }));
vi.mock("@/server/matricula/desistencia-acerto-consulta", () => ({ consultarAcertoDesistenciaContratual: mocks.acerto }));
vi.mock("@/server/matricula/desistencia-reconferencia-delta-consulta", () => ({ consultarReconferenciaDeltaDesistencia: mocks.delta }));
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
});

const resposta = (sobrescrever: Record<string, unknown> = {}) => ({ ok: true, dado: {
  matricula: { codigo: "MAT-595" },
  impedimento: null,
  cobrancas: [{ id: "cobranca-interna", tipo: "MATRICULA", status: "PENDENTE", vencimento: "2026-10-15T12:00:00.000Z", moeda: "CRC", valorOriginal: "100.00", valorNegociado: "90.00", saldo: "90.00" }],
  pedido: { id: "pedido-atual", estadoHash: "a".repeat(64) },
  podePropor: true,
  propostas: [{ id: "proposta-atual", versao: 2, preparadorNome: "Financeiro A", motivo: "Cobrança sem baixa confirmada", evidenciaCondicoes: "Extrato e condições revisados", propostaHash: "b".repeat(64), podeDecidir: true, podeAprovar: true, decisao: null }],
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
    expect(html).toContain("BRL 50.00");
    expect(html).toContain('/alunos/aluno/creditos/credito-q165');
    expect(html).toContain("efetivação pendente");
    expect(html).not.toContain("data-acerto=");
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
    expect(html).toContain("CRC 100.00");
    expect(html).toContain("CRC 90.00");
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
        { id: "proposta-obsoleta", versao: 3, preparadorNome: "Financeiro A", motivo: "Proposta desatualizada", evidenciaCondicoes: "Evidência histórica", propostaHash: "c".repeat(64), podeDecidir: true, podeAprovar: false, decisao: null },
        { id: "proposta-rejeitada", versao: 2, preparadorNome: "Financeiro B", motivo: "Condição anterior", evidenciaCondicoes: "Evidência anterior", propostaHash: "d".repeat(64), podeDecidir: false, podeAprovar: false, decisao: { aprovada: false, decisorNome: "Financeiro C", motivo: "Saldo não conferido" } },
      ],
    }));

    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m" }) }));

    expect(html).toContain("As cobranças mudaram desde a última proposta.");
    expect(html).toContain("Versão 3 · Financeiro A");
    expect(html).toContain('data-formulario="decisao"');
    expect(html).toContain('data-aprovar="false"');
    expect(html).not.toContain('data-formulario="proposta"');
    expect(html).toContain("Rejeitada por Financeiro C: Saldo não conferido");
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
    expect(html).toContain("17.00");
    expect(html).toContain("Comprovante não confere.");
    expect(html).toContain("Conclua a conferência do informe");
    expect(html).not.toContain('data-delta="preparar"');
  });

  it("mostra o erro sem montar valores ou formulários", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.FINANCEIRO] });
    mocks.consultar.mockResolvedValue({ ok: false, erro: "Matrícula fora do escopo financeiro." });

    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m" }) }));

    expect(html).toContain("Matrícula fora do escopo financeiro.");
    expect(html).not.toContain("Cobranças desta matrícula");
    expect(html).not.toContain('data-formulario=');
  });
});
