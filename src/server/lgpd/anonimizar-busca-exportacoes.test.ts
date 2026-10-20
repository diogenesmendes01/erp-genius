import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { anonimizarBuscaExportacoes } from "./anonimizar-busca-exportacoes";

// #257 C5: se um lote falha e o registro do evento de auditoria também falha, o erro do lote não pode
// sumir — é ele que diz ao operador o que consertar antes de rodar de novo.
function prismaFalso(transacoes: Array<() => Promise<unknown>>) {
  const $transaction = vi.fn();
  for (const t of transacoes) $transaction.mockImplementationOnce(t);
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ total: 2, de: null, ate: null }]),
    $transaction,
  } as unknown as PrismaClient;
}

describe("anonimizarBuscaExportacoes — falha no lote e no registro do evento", () => {
  it("lança um erro que carrega a falha do lote e a do registro", async () => {
    const erroLote = new Error("deadlock no lote");
    const erroRegistro = new Error("conexão caiu ao gravar o evento");
    const prisma = prismaFalso([() => Promise.reject(erroLote), () => Promise.reject(erroRegistro)]);

    const erro = await anonimizarBuscaExportacoes(prisma, { aplicar: true }).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(AggregateError);
    expect((erro as AggregateError).cause).toBe(erroLote);
    expect((erro as AggregateError).errors).toEqual([erroLote, erroRegistro]);
    expect((erro as Error).message).toMatch(/lote falhou.*evento de auditoria/i);
  });

  it("falha só no lote: o evento é gravado e o erro do lote sobe como está", async () => {
    const erroLote = new Error("deadlock no lote");
    const prisma = prismaFalso([() => Promise.reject(erroLote), () => Promise.resolve({ id: "ev1" })]);
    await expect(anonimizarBuscaExportacoes(prisma, { aplicar: true })).rejects.toBe(erroLote);
  });

  it("falha só no registro: o erro do registro sobe como está", async () => {
    const erroRegistro = new Error("conexão caiu ao gravar o evento");
    const prisma = prismaFalso([() => Promise.resolve([]), () => Promise.reject(erroRegistro)]);
    await expect(anonimizarBuscaExportacoes(prisma, { aplicar: true })).rejects.toBe(erroRegistro);
  });
});
