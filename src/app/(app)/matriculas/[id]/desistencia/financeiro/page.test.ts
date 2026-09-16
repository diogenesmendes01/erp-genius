import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/matricula/desistencia-financeiro-consulta", () => ({ consultarCancelamentoFinanceiroDesistencia: mocks.consultar }));
vi.mock("./Formularios", () => ({
  PropostaFormulario: ({ pedidoId }: { pedidoId: string; estadoHash: string }) => createElement("div", { "data-formulario": "proposta", "data-pedido": pedidoId }, "Proposta"),
  DecisaoFormulario: ({ propostaId, podeAprovar }: { propostaId: string; propostaHash: string; podeAprovar: boolean }) => createElement("div", { "data-formulario": "decisao", "data-proposta": propostaId, "data-aprovar": String(podeAprovar) }, "Decisão"),
}));

import Page from "./page";

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

  it("mostra o erro sem montar valores ou formulários", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.FINANCEIRO] });
    mocks.consultar.mockResolvedValue({ ok: false, erro: "Matrícula fora do escopo financeiro." });

    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m" }) }));

    expect(html).toContain("Matrícula fora do escopo financeiro.");
    expect(html).not.toContain("Cobranças desta matrícula");
    expect(html).not.toContain('data-formulario=');
  });
});
