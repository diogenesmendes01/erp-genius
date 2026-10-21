import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { ErroRegra } from "@/server/_shared/sessao";
import { comUnicidade } from "./unicidade";

const erroPrisma = (code: string) => new Prisma.PrismaClientKnownRequestError("falhou", { code, clientVersion: "x" });

describe("comUnicidade", () => {
  it("P2002 (corrida no índice único) vira ErroRegra com a mensagem da checagem", async () => {
    const r = comUnicidade("Já existe uma tag com este nome.", async () => { throw erroPrisma("P2002"); });
    await expect(r).rejects.toBeInstanceOf(ErroRegra);
    await expect(r).rejects.toThrow("Já existe uma tag com este nome.");
  });

  it("outros erros passam intactos e o sucesso devolve o valor", async () => {
    const outro = erroPrisma("P2025");
    await expect(comUnicidade("x", async () => { throw outro; })).rejects.toBe(outro);
    await expect(comUnicidade("x", async () => 42)).resolves.toBe(42);
  });
});
