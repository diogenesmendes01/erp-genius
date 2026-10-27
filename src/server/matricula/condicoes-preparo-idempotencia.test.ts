import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, type Prisma } from "@prisma/client";

const m = vi.hoisted(() => ({
  sessao: vi.fn(),
  eventos: [] as Record<string, unknown>[],
  tx: {
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
    usuario: { findUnique: vi.fn() },
    matricula: { findUnique: vi.fn() },
    documento: { findFirst: vi.fn() },
    preparacaoComercialMatricula: { findUnique: vi.fn() },
    condicoesHorasMatricula: { count: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    condicoesContinuidadeMensalMatricula: { count: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    evento: { create: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn(async (f: (tx: unknown) => unknown) => f(m.tx)) } }));
vi.mock("@/server/financeiro/recebimentos", () => ({ bloquearMatriculas: vi.fn() }));
vi.mock("@/server/_shared/sessao", async () => ({
  ...(await vi.importActual<typeof import("@/server/_shared/sessao")>("@/server/_shared/sessao")),
  exigirSessaoComPapel: m.sessao,
}));

import { prepararCondicoesHoras } from "./condicoes-horas";
import { prepararCondicoesContinuidadeMensal } from "./condicoes-continuidade-mensal";

const textoSql = (a: unknown) => (Array.isArray(a) ? a.join("?") : (a as Prisma.Sql).sql);
const doEventoComChave = (a: unknown) => m.eventos.filter((e) => (a as Prisma.Sql).values.includes((e.payload as { chaveIdempotencia?: string }).chaveIdempotencia)).slice(0, 1);

const regrasHoras = {
  moeda: "BRL", unidadeMinutos: 60 as const, valorHora: "100.00", antecedenciaCancelamentoMinutos: 60,
  vigenteDesde: "2026-02-01T08:00:00-03:00", clausulaPreco: "Cláusula 3", clausulaCancelamento: "Cláusula 4",
};
const regrasMensal = {
  continuidadeContratada: { contratada: true as const, clausula: "Cláusula 5", evidenciaId: "d" },
  regraCobertura: { referencia: "MES_CIVIL" as const }, referenciaVencimento: "MES_COBERTURA" as const,
  diaVencimento: 10, antecedenciaDias: 5, valorOriginal: "1000.00", valorNegociado: "900.00", moeda: "BRL",
  vigenteDesde: "2026-02-01", ajusteVencimento: "MANTER_DATA" as const,
};
const horas = (extra: Record<string, unknown> = {}) => ({ matriculaId: "mat", documentoId: "d", motivo: "Transcrição conferida", regras: regrasHoras, ...extra });
const mensal = (extra: Record<string, unknown> = {}) => ({ matriculaId: "mat", documentoId: "d", regras: regrasMensal, motivo: "Transcrição conferida", ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  m.eventos = [];
  m.sessao.mockResolvedValue({ id: "sec", papeis: [Papel.SECRETARIA_ACADEMICA] });
  m.tx.$queryRaw.mockImplementation(async (a: unknown) => (textoSql(a).includes(`FROM "Evento"`) ? doEventoComChave(a) : []));
  m.tx.usuario.findUnique.mockResolvedValue({ ativo: true, papeis: [Papel.SECRETARIA_ACADEMICA] });
  m.tx.matricula.findUnique.mockResolvedValue({ contratoOk: true, confirmacaoContratoEm: new Date(), contratoDocumentoId: "d", moeda: "BRL", leadId: null });
  m.tx.documento.findFirst.mockResolvedValue({ id: "d" });
  m.tx.preparacaoComercialMatricula.findUnique.mockResolvedValue(null);
  m.tx.condicoesHorasMatricula.count.mockResolvedValue(0);
  m.tx.condicoesHorasMatricula.findFirst.mockResolvedValue(null);
  m.tx.condicoesHorasMatricula.create.mockResolvedValue({ id: "c1", versao: 1 });
  m.tx.evento.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => { m.eventos.push(data); return data; });
});

describe("prepararCondicoesHoras com chave de idempotência", () => {
  it("a primeira tentativa cria a versão e grava a marca no Evento", async () => {
    expect(await prepararCondicoesHoras(horas({ chaveIdempotencia: "tentativa-horas-1" }))).toEqual({ ok: true, dado: { id: "c1", versao: 1 } });
    expect(m.tx.condicoesHorasMatricula.create.mock.calls[0][0].data).not.toHaveProperty("chaveIdempotencia");
    expect(m.eventos[0]).toMatchObject({ tipo: "CondicoesHorasPreparadas", payload: { condicoesId: "c1", versao: 1, chaveIdempotencia: "tentativa-horas-1", entradaHash: expect.any(String) } });
  });

  it("a mesma chave com a mesma entrada devolve a mesma versão sem criar outra", async () => {
    await prepararCondicoesHoras(horas({ chaveIdempotencia: "tentativa-horas-2" }));
    m.tx.condicoesHorasMatricula.count.mockResolvedValue(1);
    expect(await prepararCondicoesHoras(horas({ chaveIdempotencia: "tentativa-horas-2" }))).toEqual({ ok: true, dado: { id: "c1", versao: 1 } });
    expect(m.tx.condicoesHorasMatricula.create).toHaveBeenCalledTimes(1);
    expect(m.eventos).toHaveLength(1);
  });

  it("a mesma chave com outra entrada é conflito", async () => {
    await prepararCondicoesHoras(horas({ chaveIdempotencia: "tentativa-horas-3" }));
    const r = await prepararCondicoesHoras(horas({ chaveIdempotencia: "tentativa-horas-3", motivo: "Outro motivo informado" }));
    expect(r).toEqual({ ok: false, erro: expect.stringContaining("Esta tentativa já foi usada com outras condições") });
    expect(m.tx.condicoesHorasMatricula.create).toHaveBeenCalledTimes(1);
  });

  it("sem chave segue a regra de versão pendente, sem trava de idempotência", async () => {
    m.tx.condicoesHorasMatricula.count.mockResolvedValue(1);
    expect(await prepararCondicoesHoras(horas())).toEqual({ ok: false, erro: "Já existe versão aguardando decisão." });
    expect(m.tx.$executeRaw).not.toHaveBeenCalled();
  });

  it("a repetição ainda confere o papel do autor", async () => {
    m.eventos = [{ tipo: "CondicoesHorasPreparadas", payload: { condicoesId: "c1", versao: 1, chaveIdempotencia: "tentativa-horas-4", entradaHash: "y" } }];
    m.tx.usuario.findUnique.mockResolvedValue({ ativo: false, papeis: [] });
    expect(await prepararCondicoesHoras(horas({ chaveIdempotencia: "tentativa-horas-4" }))).toMatchObject({ ok: false });
    expect(m.tx.$executeRaw).not.toHaveBeenCalled();
  });
});

describe("prepararCondicoesContinuidadeMensal com chave de idempotência", () => {
  it("a mesma chave com a mesma entrada devolve a versão já preparada", async () => {
    const { hashEntrada } = await import("@/server/_shared/idempotencia");
    m.eventos = [{ tipo: "CondicoesContinuidadeMensalPreparadas", payload: { condicoesId: "cm1", versao: 2, chaveIdempotencia: "tentativa-mensal-1", entradaHash: hashEntrada(mensal()) } }];
    expect(await prepararCondicoesContinuidadeMensal(mensal({ chaveIdempotencia: "tentativa-mensal-1" }))).toEqual({ ok: true, dado: { id: "cm1", versao: 2 } });
    expect(m.tx.condicoesContinuidadeMensalMatricula.create).not.toHaveBeenCalled();
  });

  it("a mesma chave com outra entrada é conflito", async () => {
    m.eventos = [{ tipo: "CondicoesContinuidadeMensalPreparadas", payload: { condicoesId: "cm1", versao: 2, chaveIdempotencia: "tentativa-mensal-2", entradaHash: "outra" } }];
    const r = await prepararCondicoesContinuidadeMensal(mensal({ chaveIdempotencia: "tentativa-mensal-2" }));
    expect(r).toEqual({ ok: false, erro: expect.stringContaining("Esta tentativa já foi usada com outras condições") });
  });

  it("a chave entra na marca do Evento quando a versão é criada", async () => {
    m.tx.preparacaoComercialMatricula.findUnique.mockResolvedValue({ regime: "MENSALIDADE" });
    m.tx.condicoesContinuidadeMensalMatricula.count.mockResolvedValue(0);
    m.tx.condicoesContinuidadeMensalMatricula.findFirst.mockResolvedValue({ versao: 1 });
    m.tx.condicoesContinuidadeMensalMatricula.create.mockResolvedValue({ id: "cm2", versao: 2 });
    expect(await prepararCondicoesContinuidadeMensal(mensal({ chaveIdempotencia: "tentativa-mensal-3" }))).toEqual({ ok: true, dado: { id: "cm2", versao: 2 } });
    expect(m.tx.condicoesContinuidadeMensalMatricula.create.mock.calls[0][0].data).not.toHaveProperty("chaveIdempotencia");
    expect(m.eventos[0]).toMatchObject({ tipo: "CondicoesContinuidadeMensalPreparadas", payload: { condicoesId: "cm2", chaveIdempotencia: "tentativa-mensal-3" } });
  });
});
