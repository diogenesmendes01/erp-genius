import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, type Prisma } from "@prisma/client";

const m = vi.hoisted(() => ({
  sessao: vi.fn(),
  eventos: [] as Record<string, unknown>[],
  tx: {
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
    pais: { findUnique: vi.fn(), create: vi.fn() },
    evento: { create: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn(async (f: (tx: unknown) => unknown) => f(m.tx)) } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared/sessao", async () => ({
  ...(await vi.importActual<typeof import("@/server/_shared/sessao")>("@/server/_shared/sessao")),
  exigirSessaoComPapel: m.sessao,
}));

import { criarPais } from "./acoes";

const textoSql = (a: unknown) => (Array.isArray(a) ? a.join("?") : (a as Prisma.Sql).sql);
const doEventoComChave = (a: unknown) => m.eventos.filter((e) => (a as Prisma.Sql).values.includes((e.payload as { chaveIdempotencia?: string }).chaveIdempotencia)).slice(0, 1);
const entrada = { nome: "Costa Rica", codigoISO: "cr", moedaLocal: "crc", ddi: "+506", fuso: "America/Costa_Rica", idioma: "es", tiposDocumento: [{ nome: "Cédula", validador: "cedula_cr" }] };

beforeEach(() => {
  vi.clearAllMocks();
  m.eventos = [];
  m.sessao.mockResolvedValue({ id: "adm", papeis: [Papel.ADMINISTRADOR] });
  m.tx.$queryRaw.mockImplementation(async (a: unknown) => (textoSql(a).includes(`FROM "Evento"`) ? doEventoComChave(a) : []));
  m.tx.pais.findUnique.mockImplementation(async () => (m.tx.pais.create.mock.calls.length ? { id: "p1" } : null));
  m.tx.pais.create.mockImplementation(async ({ data }: { data: { nome: string; codigoISO: string } }) => ({ id: "p1", nome: data.nome, codigoISO: data.codigoISO }));
  m.tx.evento.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    m.eventos.push({ ...data, agregadoId: data.agregadoId });
    return data;
  });
});

describe("criarPais com chave de idempotência", () => {
  it("cria o país e grava a marca no Evento PaisCriado", async () => {
    expect(await criarPais({ ...entrada, chaveIdempotencia: "tentativa-pais-1" })).toEqual({ ok: true, dado: { id: "p1" } });
    expect(m.tx.pais.create.mock.calls[0][0].data).not.toHaveProperty("chaveIdempotencia");
    expect(m.eventos[0]).toMatchObject({ tipo: "PaisCriado", agregadoId: "p1", payload: { codigoISO: "CR", chaveIdempotencia: "tentativa-pais-1", entradaHash: expect.any(String) } });
  });

  it("o reenvio com a mesma chave devolve o mesmo país em vez de \"já existe\"", async () => {
    await criarPais({ ...entrada, chaveIdempotencia: "tentativa-pais-2" });
    expect(await criarPais({ ...entrada, chaveIdempotencia: "tentativa-pais-2" })).toEqual({ ok: true, dado: { id: "p1" } });
    expect(m.tx.pais.create).toHaveBeenCalledTimes(1);
    expect(m.eventos).toHaveLength(1);
  });

  it("a mesma chave com outros dados é conflito", async () => {
    await criarPais({ ...entrada, chaveIdempotencia: "tentativa-pais-3" });
    const r = await criarPais({ ...entrada, nome: "Panamá", chaveIdempotencia: "tentativa-pais-3" });
    expect(r).toEqual({ ok: false, erro: expect.stringContaining("Esta tentativa já foi usada com outros dados") });
    expect(m.tx.pais.create).toHaveBeenCalledTimes(1);
  });

  it("sem chave, o código repetido continua recusado", async () => {
    await criarPais(entrada);
    expect(await criarPais(entrada)).toEqual({ ok: false, erro: "Já existe país com código CR." });
    expect(m.tx.$executeRaw).not.toHaveBeenCalled();
  });

  it("chave nova para um código existente continua recusada", async () => {
    await criarPais({ ...entrada, chaveIdempotencia: "tentativa-pais-4" });
    expect(await criarPais({ ...entrada, chaveIdempotencia: "tentativa-pais-5" })).toEqual({ ok: false, erro: "Já existe país com código CR." });
  });
});
