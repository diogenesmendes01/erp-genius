import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { precosDaOportunidade } from "./precos";

beforeEach(truncarBanco);

async function cenario() {
  const cat = await seedCatalogoMinimo();
  const op = await prisma.oportunidade.create({ data: { nome: "Maria", paisId: cat.pais.id } });
  const opSemPais = await prisma.oportunidade.create({ data: { nome: "Sem país" } });
  return { ...cat, op, opSemPais };
}

describe("precosDaOportunidade", () => {
  it("so_precos_ativos_do_pais", async () => {
    const { op } = await cenario();
    const r = await precosDaOportunidade(op.id);
    expect(r.map((p) => p.valor).sort((a, b) => a - b)).toEqual([20000, 85000]);
    expect(r.find((p) => p.valor === 85000)).toMatchObject({ tipoCobranca: "MENSALIDADE", moeda: "CRC", rotulo: "Português · Regular" });
  });

  it("preco_inativo_e_outro_pais_fora", async () => {
    const { op, precoTaxa, produto, modalidade } = await cenario();
    await prisma.precoReferencia.update({ where: { id: precoTaxa.id }, data: { ativo: false } });
    const outro = await prisma.pais.create({ data: { nome: "México", codigoISO: "MX", moedaLocal: "MXN", ddi: "+52", status: "ATIVO" } });
    await prisma.produtoPais.create({ data: { produtoId: produto.id, paisId: outro.id, moeda: "MXN" } });
    await prisma.precoReferencia.create({
      data: { paisId: outro.id, produtoId: produto.id, modalidadeId: modalidade.id, tipoCobranca: "MENSALIDADE", valor: 999, moeda: "MXN" },
    });
    expect((await precosDaOportunidade(op.id)).map((p) => p.valor)).toEqual([85000]);
  });

  it("produto_nao_oferecido_e_outros_tipos_fora", async () => {
    const { op, produto, pais, modalidade } = await cenario();
    await prisma.precoReferencia.create({
      data: { paisId: pais.id, produtoId: produto.id, modalidadeId: modalidade.id, tipoCobranca: "MATERIAL", valor: 5000, moeda: "CRC" },
    });
    expect((await precosDaOportunidade(op.id)).map((p) => p.valor).sort((a, b) => a - b)).toEqual([20000, 85000]);
    await prisma.produtoPais.updateMany({ where: { produtoId: produto.id }, data: { oferecido: false } });
    expect(await precosDaOportunidade(op.id)).toEqual([]);
  });

  it("oportunidade_sem_pais_sem_preco", async () => {
    const { opSemPais } = await cenario();
    expect(await precosDaOportunidade(opSemPais.id)).toEqual([]);
  });
});
