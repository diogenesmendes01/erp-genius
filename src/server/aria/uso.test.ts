import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RespostaIA } from "./provedor/tipos";

// Mapeamento RespostaIA -> ChamadaIA sem banco: o Prisma é mockado e o teste lê o `data` do create.

const m = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { chamadaIA: { create: m.create } } }));

const { registrarChamadaIA } = await import("./uso");

const resp: RespostaIA = {
  texto: "oi",
  modelo: "claude-sonnet-5-5",
  provedor: "anthropic",
  recusa: false,
  tokensEntrada: 1000,
  tokensSaida: 500,
  tokensCache: 10000,
  tokensEscritaCache: 2000,
  latenciaMs: 20,
};

const dados = () => (m.create.mock.calls[0]![0] as { data: Record<string, unknown> }).data;

beforeEach(() => {
  m.create.mockReset().mockImplementation(async (a: { data: unknown }) => a.data);
});

describe("registrarChamadaIA: mapeamento", () => {
  it("grava_tokens_de_escrita_de_cache", async () => {
    await registrarChamadaIA("ATENDIMENTO", resp);
    expect(dados()).toMatchObject({ tokensCache: 10000, tokensEscritaCache: 2000, custoMicroUsd: 14000 });
  });

  it("falha_grava_escrita_de_cache_zero", async () => {
    await registrarChamadaIA("ATENDIMENTO", { erro: "429", modelo: "claude-sonnet-5-5", latenciaMs: 5 });
    expect(dados()).toMatchObject({ tokensEscritaCache: 0, custoMicroUsd: 0, resultado: "ERRO:429" });
  });
});
