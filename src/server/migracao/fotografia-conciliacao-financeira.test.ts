import { Prisma } from "@prisma/client";
import { expect, it, vi } from "vitest";
vi.mock("@/server/financeiro/recebimentos", () => ({ bloquearMatriculas: vi.fn() }));
import { fotografiaConciliacaoFinanceiraTx } from "./fotografia-conciliacao-financeira";
import { hashFotografiaFinanceira } from "./fotografia-financeira";

it.each([0, 40])("preserva hash legado sem permuta e identifica serviço compensado: %s", async valor => {
  const linha = { id: "linha", origem: "planilha", financeiroOrigemId: "f1", matriculaOrigemId: "m1", entradaHash: "hash", dadosOrigem: {}, loteId: "lote" };
  const mapa = { origem: "planilha", matriculaOrigemId: "m1", matriculaId: "matricula", linhaId: "linha", entradaHash: "hash" };
  const cobranca = { id: "cobranca", matriculaId: "matricula", valorRecebido: null, saldo: new Prisma.Decimal(100 - valor), versao: 2 };
  const pagador = { id: "pagador", matriculaId: "matricula", versao: 1, tipo: "ALUNO", dados: {} };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([linha]),
    mapaOrigemMatriculaMigracao: { findUnique: vi.fn().mockResolvedValue(mapa) },
    cobranca: { findUnique: vi.fn().mockResolvedValue({ ...cobranca, valorCompensadoPermuta: new Prisma.Decimal(valor) }) },
    pagadorPreparacaoMatricula: { findUnique: vi.fn().mockResolvedValue(pagador) },
  };
  const resultado = await fotografiaConciliacaoFinanceiraTx(tx as unknown as Prisma.TransactionClient, {
    linhaId: "linha", matriculaId: "matricula", cobrancaId: "cobranca", pagadorId: "pagador",
  });
  const hashAnterior = hashFotografiaFinanceira({ linha, mapa, cobranca, pagador, recebimento: null });
  if (valor === 0) {
    expect(resultado.hash).toBe(hashAnterior);
    expect(resultado.foto).not.toHaveProperty("cobranca.valorCompensadoPermuta");
  } else {
    expect(resultado.hash).not.toBe(hashAnterior);
    expect(resultado.foto).toHaveProperty("cobranca.valorCompensadoPermuta", "40");
    expect(resultado.foto).toHaveProperty("cobranca.valorRecebido", null);
  }
  expect(tx.cobranca.findUnique).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: "cobranca" }, select: expect.objectContaining({ valorCompensadoPermuta: true }),
  }));
});
