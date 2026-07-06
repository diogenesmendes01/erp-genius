import { describe, it, expect, beforeAll } from "vitest";
import { gerarCodigo } from "./codigo";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";

// Prioridade 4 do docs/14: `gerarCodigo` sob CONCORRÊNCIA não pode duplicar código.
// O upsert com `increment` é atômico no Postgres — este teste prova empiricamente.

describe("gerarCodigo (integração)", () => {
  beforeAll(async () => {
    await truncarBanco();
  });

  it("30 gerações concorrentes produzem 30 códigos únicos e sequenciais", async () => {
    const codigos = await Promise.all(Array.from({ length: 30 }, () => gerarCodigo("lead")));

    expect(new Set(codigos).size).toBe(30); // nenhum duplicado
    expect(codigos.every((c) => /^L-\d{6}$/.test(c))).toBe(true);

    const numeros = codigos.map((c) => Number(c.slice(2))).sort((a, b) => a - b);
    expect(numeros[0]).toBe(1);
    expect(numeros[29]).toBe(30); // sem buracos: contador não pulou nem repetiu

    const contador = await prisma.contador.findUnique({ where: { chave: "lead" } });
    expect(contador?.valor).toBe(30);
  });

  it("chaves diferentes têm contadores independentes", async () => {
    const [aluno, turma] = await Promise.all([gerarCodigo("aluno"), gerarCodigo("turma")]);
    expect(aluno).toBe("A-000001");
    expect(turma).toBe("T-000001");
  });
});
