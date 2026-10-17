import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { ehFalhaDeSerializacao, repetirEmFalhaDeSerializacao } from "./repetir-serializacao";

const erroPrisma = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError("falha", { code, clientVersion: "5.22.0", meta });

describe("ehFalhaDeSerializacao", () => {
  it("reconhece o conflito de transação do Prisma e o SQLSTATE 40001 de consulta crua", () => {
    expect(ehFalhaDeSerializacao(erroPrisma("P2034"))).toBe(true);
    expect(ehFalhaDeSerializacao(erroPrisma("P2010", { code: "40001", message: "could not serialize access due to concurrent update" }))).toBe(true);
  });

  it("não confunde outros erros com conflito de serialização", () => {
    expect(ehFalhaDeSerializacao(erroPrisma("P2002"))).toBe(false);
    expect(ehFalhaDeSerializacao(erroPrisma("P2010", { code: "P0001" }))).toBe(false);
    expect(ehFalhaDeSerializacao(new Error("40001"))).toBe(false);
  });
});

describe("repetirEmFalhaDeSerializacao", () => {
  it("repete a transação inteira após conflito de serialização e devolve o resultado da nova tentativa", async () => {
    const operacao = vi.fn()
      .mockRejectedValueOnce(erroPrisma("P2010", { code: "40001" }))
      .mockResolvedValueOnce("replay");
    await expect(repetirEmFalhaDeSerializacao(operacao)).resolves.toBe("replay");
    expect(operacao).toHaveBeenCalledTimes(2);
  });

  it("não repete erro de negócio", async () => {
    const operacao = vi.fn().mockRejectedValue(new Error("regra"));
    await expect(repetirEmFalhaDeSerializacao(operacao)).rejects.toThrow("regra");
    expect(operacao).toHaveBeenCalledTimes(1);
  });

  it("desiste após o limite de tentativas e propaga o conflito", async () => {
    const conflito = erroPrisma("P2034");
    const operacao = vi.fn().mockRejectedValue(conflito);
    await expect(repetirEmFalhaDeSerializacao(operacao, 3)).rejects.toBe(conflito);
    expect(operacao).toHaveBeenCalledTimes(3);
  });
});
