import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consulta: vi.fn(), preferencia: vi.fn(), fuso: vi.fn(), preparar: vi.fn(), cabecalho: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/matricula/cabecalho", () => ({ consultarCabecalhoMatricula: mocks.cabecalho }));
vi.mock("@/server/matricula/fechamento-horas-consulta", () => ({ consultarFechamentosHoras: mocks.consulta }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/operacao/consultas", () => ({ consultarFusoInstitucional: mocks.fuso }));
vi.mock("./PrepararFechamento", () => ({ PrepararFechamento: (props: unknown) => { mocks.preparar(props); return null; } }));
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
    mocks.fuso.mockResolvedValue(null);
  });

  // docs/43 §6 item 6: "Fuso do período" começava vazio, só com placeholder.
  it("o fuso do período começa no fuso da escola; sem ele, na preferência da equipe", async () => {
    const abrir = async () => renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "matricula" }), searchParams: Promise.resolve({ aluno: "aluno" }) }));
    mocks.fuso.mockResolvedValue("America/Sao_Paulo");
    await abrir();
    expect(mocks.preparar).toHaveBeenLastCalledWith(expect.objectContaining({ fusoInicial: "America/Sao_Paulo" }));
    mocks.fuso.mockResolvedValue(null);
    await abrir();
    expect(mocks.preparar).toHaveBeenLastCalledWith(expect.objectContaining({ fusoInicial: "America/Costa_Rica" }));
  });

  it("formata preparação e emissão administrativas na preferência após a guarda", async () => {
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "matricula" }), searchParams: Promise.resolve({ aluno: "aluno" }) }));
    expect(mocks.sessao).toHaveBeenCalledWith(Papel.FINANCEIRO);
    expect(mocks.preferencia).toHaveBeenCalledTimes(1);
    expect(html.match(/31\/12\/2025, 20:30/g)).toHaveLength(2);
    expect(html.match(/horário exibido em America\/Costa_Rica; origem UTC/g)).toHaveLength(2);
    expect(html).toContain("Intervalo: 2099-10-01 até 2099-11-01");
  });

  it("sem ?aluno= na URL, o aluno sai da matrícula — não é mais beco (docs/42 L905)", async () => {
    mocks.cabecalho.mockResolvedValue({ id: "matricula", codigo: "M-1", status: "ATIVA", alunoId: "aluno-da-matricula", aluno: "Ana", produto: "Inglês" });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "matricula" }), searchParams: Promise.resolve({}) }));
    expect(mocks.cabecalho).toHaveBeenCalledWith({ id: "financeiro" }, "matricula");
    expect(mocks.consulta).toHaveBeenCalledWith({ alunoId: "aluno-da-matricula", matriculaId: "matricula", cursor: undefined, rascunhoId: undefined });
    expect(html).toContain("Fechamentos por hora · M-1");
    expect(html).not.toContain("Abra os fechamentos pela ficha financeira");
  });

  it("com ?aluno= não consulta o cabeçalho; fora do alcance, diz por quê e dá saída", async () => {
    await Page({ params: Promise.resolve({ id: "matricula" }), searchParams: Promise.resolve({ aluno: "aluno" }) });
    expect(mocks.cabecalho).not.toHaveBeenCalled();
    mocks.cabecalho.mockResolvedValue(null);
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "matricula" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain('role="alert">Matrícula não encontrada no seu alcance');
    expect(html).toContain('href="/financeiro"');
    expect(mocks.consulta).toHaveBeenCalledTimes(1);
  });

  it("sem código, a matrícula e a cobrança não viram o id interno", async () => {
    const semCodigo = { ...(dado as unknown as Record<string, unknown>), matricula: { alunoId: "aluno", codigo: null },
      versoes: [{ ...(dado as { versoes: Record<string, unknown>[] }).versoes[0]!, emissao: { executor: { nome: "Financeiro" }, criadaEm: new Date("2026-01-01T02:30:00.000Z"), cobranca: { id: "cobranca-interna", codigo: null, moeda: "USD", valorOriginal: "100", valorNegociado: "100", saldo: "100" } } }] };
    mocks.consulta.mockResolvedValue({ ok: true, dado: semCodigo });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "matricula-interna" }), searchParams: Promise.resolve({ aluno: "aluno" }) }));
    expect(html).toContain("Fechamentos por hora · matrícula sem código");
    expect(html).toContain("Cobrança emitida · sem código");
    expect(html.replace(/href="[^"]*"/g, "")).not.toMatch(/matricula-interna|cobranca-interna/);
  });

  it("não consulta preferência se a guarda recusa", async () => {
    mocks.sessao.mockRejectedValue(new Error("sem acesso"));
    await expect(Page({ params: Promise.resolve({ id: "matricula" }), searchParams: Promise.resolve({ aluno: "aluno" }) })).rejects.toThrow("sem acesso");
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });

  it("formata as três origens de encontro na preferência e usa o fuso do período como fallback", async () => {
    const memoria = { periodo: { inicio: "2026-01-01", fim: "2026-01-31", fuso: "America/Sao_Paulo", vencimento: "2026-02-10" }, apuracao: {
      moeda: "BRL", estado: "APURACAO_COMPLETA", totalApurado: "100.00", minutosApurados: 60,
      itens: [{ encontroId: "i", minutos: 60, valorHoraContratado: "100.00", valor: "100.00", origem: { inicio: "2026-01-01T02:30:00Z" } }],
      pendencias: [{ encontroId: "p", motivo: "Conferir" }], origens: [{ encontroId: "p", inicio: "2026-01-01T02:30:00Z" }],
      preservados: [{ encontroId: "p", destinacao: { tipo: "FATURADA", cobrancaId: "c" } }],
      semCobranca: [{ encontroId: "s", desfecho: "CANCELAMENTO_ESCOLA", origem: { inicio: "2026-01-01T02:30:00Z" } }],
    } };
    const versaoBase = (dado as { versoes: Record<string, unknown>[] }).versoes[0]!;
    mocks.consulta.mockResolvedValue({ ok: true, dado: { ...(dado as unknown as Record<string, unknown>), versoes: [{ ...versaoBase, memoria }] } });
    const entrada = { params: Promise.resolve({ id: "matricula" }), searchParams: Promise.resolve({ aluno: "aluno", versao: "rascunho" }) };
    const pessoal = renderToStaticMarkup(await Page(entrada));
    expect(pessoal.match(/31\/12\/2025, 20:30/g)).toHaveLength(6);
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "indisponível" });
    const fallback = renderToStaticMarkup(await Page(entrada));
    expect(fallback).toContain("31/12/2025, 23:30");
    expect(fallback).toContain("origem America/Sao_Paulo");
  });
});
