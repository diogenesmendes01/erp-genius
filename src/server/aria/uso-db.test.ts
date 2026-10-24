import { beforeEach, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
const global = vi.hoisted(() => ({ config: vi.fn(), soma: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { configIA: { upsert: global.config }, chamadaIA: { aggregate: global.soma } } }));
import { estadoOrcamento } from "./uso";
beforeEach(() => { vi.resetAllMocks(); global.config.mockRejectedValue(Error("client global nao autorizado")); global.soma.mockRejectedValue(Error("client global nao autorizado")); });
it("orcamento usa o db recebido inclusive inicializacao e agregado UTC", async () => {
  const upsert = vi.fn().mockResolvedValue({ orcamentoMensalUsd: 10, acaoAoEstourar: "PAUSAR" }), aggregate = vi.fn().mockResolvedValue({ _sum: { custoMicroUsd: 8_000_000 } });
  const tx = { configIA: { upsert }, chamadaIA: { aggregate } } as unknown as Prisma.TransactionClient, agora = new Date("2026-11-15T02:00:00-03:00");
  expect(await estadoOrcamento(agora, tx)).toEqual({ situacao: "ALERTA", gastoUsd: 8, limiteUsd: 10, acao: "PAUSAR" });
  expect(upsert).toHaveBeenCalledWith({ where: { id: "ia" }, create: { id: "ia" }, update: {} });
  expect(aggregate).toHaveBeenCalledWith({ _sum: { custoMicroUsd: true }, where: { criadoEm: { gte: new Date("2026-11-01T00:00:00Z"), lte: agora } } });
  expect(global.config).not.toHaveBeenCalled(); expect(global.soma).not.toHaveBeenCalled();
});
it("sem db preserva o client global e limite exato", async () => {
  global.config.mockResolvedValue({ orcamentoMensalUsd: 10, acaoAoEstourar: "SO_SUGERIR" }); global.soma.mockResolvedValue({ _sum: { custoMicroUsd: 10_000_000 } });
  expect(await estadoOrcamento(new Date())).toMatchObject({ situacao: "ESTOURADO", acao: "SO_SUGERIR" });
});
