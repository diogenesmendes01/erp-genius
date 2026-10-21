import type { Prisma, PrismaClient } from "@prisma/client";
import { expect, it, vi } from "vitest";
import { confirmarTransacao, protegerTransacoes } from "./transacao-confirmada";

it("não confere nem transforma em sucesso uma operação que já falhou", async () => {
  const conferir = vi.fn();
  const erro = new Error("operação rejeitada");
  const executar = confirmarTransacao(async () => { throw erro; });
  await expect(executar({ $executeRaw: conferir } as unknown as Prisma.TransactionClient)).rejects.toBe(erro);
  expect(conferir).not.toHaveBeenCalled();
});

it("instala uma vez e preserva as opções da transação interativa", async () => {
  const ordem: string[] = [];
  const conferir = vi.fn(async () => { ordem.push("conferência"); return 0; });
  const original = vi.fn(async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
    callback({ $executeRaw: conferir } as unknown as Prisma.TransactionClient));
  const cliente = { $transaction: original } as unknown as PrismaClient;
  protegerTransacoes(cliente);
  protegerTransacoes(cliente);
  const opcoes = { isolationLevel: "Serializable" as const, timeout: 20000, maxWait: 5000 };
  const resultado = await cliente.$transaction(async () => { ordem.push("operação"); return 42; }, opcoes);
  expect(resultado).toBe(42);
  expect(original).toHaveBeenCalledExactlyOnceWith(expect.any(Function), opcoes);
  expect(conferir).toHaveBeenCalledTimes(1);
  expect(ordem).toEqual(["operação", "conferência"]);
});

it("rejeita o lote se a conferência adicional falhar", async () => {
  const erro = new Error("restrição rejeitada");
  const original = vi.fn().mockRejectedValue(erro);
  const comando = { sql: "conferência" };
  const cliente = { $transaction: original, $executeRaw: vi.fn().mockReturnValue(comando) } as unknown as PrismaClient;
  protegerTransacoes(cliente);
  const consulta = {} as Prisma.PrismaPromise<number>;
  const opcoes = { isolationLevel: "Serializable" as const };
  await expect(cliente.$transaction([consulta], opcoes)).rejects.toBe(erro);
  expect(original).toHaveBeenCalledExactlyOnceWith([consulta, comando], opcoes);
});
