import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";

// Task 7 (2.M2): Empresa B2B (prospect sem matrícula) e participantes da oportunidade.

beforeEach(async () => {
  await truncarBanco();
});

async function criarOportunidadeComPessoa() {
  const empresa = await prisma.empresa.create({ data: { nome: "Acme" } });
  const pessoa = await prisma.pessoa.create({ data: { nome: "Carla", empresaId: empresa.id } });
  const oportunidade = await prisma.oportunidade.create({
    data: { nome: "Acme - turma in company", b2b: true, empresaId: empresa.id, pessoaId: pessoa.id },
  });
  return { empresa, oportunidade, pessoa };
}

describe("Empresa B2B e participantes", () => {
  it("pessoa entra uma vez por oportunidade com papel", async () => {
    const { oportunidade, pessoa } = await criarOportunidadeComPessoa();
    await prisma.participanteOportunidade.create({
      data: { oportunidadeId: oportunidade.id, pessoaId: pessoa.id, papel: "DECISOR" },
    });
    await expect(
      prisma.participanteOportunidade.create({
        data: { oportunidadeId: oportunidade.id, pessoaId: pessoa.id, papel: "OUTRO" },
      }),
    ).rejects.toThrow(/Unique/);
  });

  it("empresa prospect sem matrícula e com site", async () => {
    const e = await prisma.empresa.create({
      data: { nome: "TechNova", site: "technova.example", segmentoMercado: "Tecnologia", porte: "MEDIO", origemCanal: "LINKEDIN" },
    });
    expect(e.ativo).toBe(true);
    expect(e.site).toBe("technova.example");
    expect(await prisma.matricula.count({ where: { empresaId: e.id } })).toBe(0);
  });
});
