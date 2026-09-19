import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consulta: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/matricula/fechamento-horas-consulta", () => ({ consultarFechamentosHoras: mocks.consulta }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./PrepararFechamento", () => ({ PrepararFechamento: () => null }));
vi.mock("./DecidirFechamento", () => ({ DecidirFechamento: () => null }));
vi.mock("./EmitirFechamento", () => ({ EmitirFechamento: () => null }));

import Page from "./page";

const dado = { matricula: { alunoId: "aluno", codigo: "M-1" }, proximoCursor: null, cobrancasAnteriores: [], versoes: [{ id: "rascunho", versao: 1, criadoEm: new Date("2026-01-01T02:30:00.000Z"), preparador: { nome: "Financeiro" }, motivo: "Memória conferida", documento: { nome: "Contrato", url: null }, referenciaProposta: null, memoria: null, periodoInicio: "2099-10-01", periodoFimExclusivo: "2099-11-01", decisao: null, emissao: { executor: { nome: "Financeiro" }, criadaEm: new Date("2026-01-01T02:30:00.000Z"), cobranca: { id: "cobranca", codigo: "C-1", moeda: "USD", valorOriginal: "100", valorNegociado: "100", saldo: "100" } }, podeDecidir: false }] } as never;

describe("FechamentosHorasPage fuso de históricos", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({ id: "financeiro" });
    mocks.consulta.mockResolvedValue({ ok: true, dado });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  });

  it("formata preparação e emissão administrativas na preferência após a guarda", async () => {
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "matricula" }), searchParams: Promise.resolve({ aluno: "aluno" }) }));
    expect(mocks.sessao).toHaveBeenCalledWith(Papel.FINANCEIRO);
    expect(mocks.preferencia).toHaveBeenCalledTimes(1);
    expect(html.match(/31\/12\/2025, 20:30/g)).toHaveLength(2);
    expect(html.match(/horário exibido em America\/Costa_Rica; origem UTC/g)).toHaveLength(2);
    expect(html).toContain("Intervalo: 2099-10-01 até 2099-11-01");
  });

  it("não consulta preferência se a guarda recusa", async () => {
    mocks.sessao.mockRejectedValue(new Error("sem acesso"));
    await expect(Page({ params: Promise.resolve({ id: "matricula" }), searchParams: Promise.resolve({ aluno: "aluno" }) })).rejects.toThrow("sem acesso");
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});