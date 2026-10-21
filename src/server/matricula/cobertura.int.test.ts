import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
let matriculaId: string;
beforeEach(async () => {
  await truncarBanco();
  const c = await seedCatalogoMinimo();
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Cobertura", paisId: c.pais.id } });
  matriculaId = (await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: c.produto.id, paisId: c.pais.id, moeda: "CRC" } })).id;
});
describe("integridade da cobertura no PostgreSQL", () => {
  it("permite legado vazio, exige âncora de ciclo e rejeita referência contraditória", async () => {
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).referenciaCobertura).toBeNull();
    await expect(prisma.matricula.update({ where: { id: matriculaId }, data: { dataReferenciaCobertura: new Date("2026-09-01") } })).rejects.toThrow();
    await expect(prisma.matricula.update({ where: { id: matriculaId }, data: { referenciaCobertura: "CICLO_MATRICULA" } })).rejects.toThrow();
    await expect(prisma.matricula.update({ where: { id: matriculaId }, data: { referenciaCobertura: "MES_CIVIL", dataReferenciaCobertura: new Date("2026-09-01") } })).rejects.toThrow();
    await prisma.matricula.update({ where: { id: matriculaId }, data: { referenciaCobertura: "CICLO_MATRICULA", dataReferenciaCobertura: new Date("2026-09-15") } });
  });
  it("exige par ordenado de datas e não atribui cobertura mensal a uma taxa", async () => {
    const data = { matriculaId, tipo: "MENSALIDADE" as const, valorOriginal: 100, valorNegociado: 100, saldo: 100, moeda: "CRC", vencimento: new Date("2026-10-10") };
    const inicio = new Date("2026-09-01"), fim = new Date("2026-09-30");
    await expect(prisma.cobranca.create({ data: { ...data, coberturaInicio: inicio } })).rejects.toThrow();
    await expect(prisma.cobranca.create({ data: { ...data, coberturaFim: fim } })).rejects.toThrow();
    await expect(prisma.cobranca.create({ data: { ...data, coberturaInicio: fim, coberturaFim: inicio } })).rejects.toThrow();
    await expect(prisma.cobranca.create({ data: { ...data, tipo: "MATRICULA", coberturaInicio: inicio, coberturaFim: fim } })).rejects.toThrow();
    const cobranca = await prisma.cobranca.create({ data: { ...data, coberturaInicio: inicio, coberturaFim: fim } });
    expect(cobranca.coberturaFim).toEqual(fim);
    expect(cobranca.vencimento).toEqual(data.vencimento);
  });
});
