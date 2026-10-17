import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { truncarBanco, criarAlunoMinimo } from "@/test/integracao";

// Task 6 (2.M1): Pessoa como hub de identidade. Unicidade 1:1 com Aluno, lápide sem
// auto-referência (CHECK) e N telefones (ContatoWhatsApp) para 1 pessoa.

beforeEach(async () => {
  await truncarBanco();
});

describe("Pessoa (hub de identidade)", () => {
  it("um aluno por pessoa e lápide não aponta para si", async () => {
    const p = await prisma.pessoa.create({ data: { nome: "Ana" } });
    await criarAlunoMinimo({ pessoaId: p.id });
    await expect(criarAlunoMinimo({ pessoaId: p.id })).rejects.toThrow(/Unique constraint/);
    await expect(
      prisma.pessoa.update({ where: { id: p.id }, data: { mescladaEmId: p.id } }),
    ).rejects.toThrow(/check/i);
  });

  it("telefone continua único em ContatoWhatsApp e N telefones apontam para 1 pessoa", async () => {
    const p = await prisma.pessoa.create({ data: { nome: "Bia" } });
    await prisma.contatoWhatsApp.createMany({
      data: [
        { telefoneE164: "+5511900000001", pessoaId: p.id },
        { telefoneE164: "+5511900000002", pessoaId: p.id },
      ],
    });
    expect(await prisma.contatoWhatsApp.count({ where: { pessoaId: p.id } })).toBe(2);
    await expect(
      prisma.contatoWhatsApp.create({ data: { telefoneE164: "+5511900000001" } }),
    ).rejects.toThrow(/Unique constraint/);
  });
});
