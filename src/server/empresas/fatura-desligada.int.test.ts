import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

// D9 com a chave COBRANCA_B2B_ATIVA desligada (padrão, sem mock aqui) — R1 do #251, B1: uma fatura FECHADA que já
// existia congela as cobranças dela (pausar aluno, ajustar e dar baixa mandam cancelar a fatura antes). Cancelar
// continua disponível e só desfaz o agrupamento; depois disso o aluno pode ser pausado. Fechar e pagar recusam.

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, seedCatalogoMinimo } from "@/test/integracao";
import { COBRANCA_B2B_ATIVA, MSG_COBRANCA_B2B_DESLIGADA } from "@/lib/funcionalidades";
import { pausarAluno } from "@/server/alunos/acoes";
import { cancelarFaturaB2B, fecharFaturaB2B, pagarFaturaB2B, salvarEmpresa } from "./acoes";

const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

let financeiro: Awaited<ReturnType<typeof criarUsuario>>;
let secretaria: Awaited<ReturnType<typeof criarUsuario>>;
let catalogo: Awaited<ReturnType<typeof seedCatalogoMinimo>>;

beforeEach(async () => {
  await truncarBanco();
  financeiro = await criarUsuario([Papel.FINANCEIRO], "Financeiro");
  secretaria = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria");
  catalogo = await seedCatalogoMinimo();
});

async function faturaFechadaAntiga() {
  entrar(financeiro.id);
  const empresa = await salvarEmpresa({ nome: "Acme Corp", paisId: catalogo.pais.id, diaVencimento: 10 });
  if (!empresa.ok || !empresa.dado) throw new Error(JSON.stringify(empresa));
  const empresaId = empresa.dado.id;
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Colaborador", paisId: catalogo.pais.id, status: "ATIVO" } });
  const mat = await prisma.matricula.create({ data: { alunoId: aluno.id, empresaId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } });
  const vencimento = new Date(Date.now() + 40 * 86_400_000);
  const competencia = vencimento.toISOString().slice(0, 7);
  // Fatura fechada antes da D9: criada direto no banco, como o histórico que a escola já tem.
  const fatura = await prisma.faturaB2B.create({ data: { codigo: "FAT-ANTIGA", empresaId, competencia, moeda: "CRC", valorTotal: 500, status: "FECHADA", vencimento } });
  const cobranca = await prisma.cobranca.create({ data: {
    matriculaId: mat.id, tipo: "MENSALIDADE", competencia, valorOriginal: 500, valorNegociado: 500, saldo: 500, moeda: "CRC",
    vencimento, faturaB2BId: fatura.id, valorFaturado: 500,
  } });
  return { empresaId, alunoId: aluno.id, faturaId: fatura.id, cobrancaId: cobranca.id, competencia };
}

describe("fatura B2B com a cobrança de empresas desligada (D9, B1 da R1 do #251)", () => {
  it("a chave nasce desligada", () => {
    expect(COBRANCA_B2B_ATIVA).toBe(false);
  });

  it("fatura FECHADA antiga: cancelar funciona e depois o aluno pode ser pausado", async () => {
    const { alunoId, faturaId, cobrancaId } = await faturaFechadaAntiga();
    entrar(secretaria.id);
    const antes = await pausarAluno(alunoId, { motivo: "Pausa a pedido" });
    expect(antes.ok).toBe(false);
    expect(antes.ok ? "" : antes.erro).toContain("cancele a fatura");

    entrar(financeiro.id);
    expect((await cancelarFaturaB2B(faturaId)).ok).toBe(true);
    expect((await prisma.faturaB2B.findUniqueOrThrow({ where: { id: faturaId } })).status).toBe("CANCELADA");
    expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } })).toMatchObject({ faturaB2BId: null, valorFaturado: null });

    entrar(secretaria.id);
    expect((await pausarAluno(alunoId, { motivo: "Pausa a pedido" })).ok).toBe(true);
    expect((await prisma.aluno.findUniqueOrThrow({ where: { id: alunoId } })).status).toBe("PAUSADO");
  });

  it("fechar e pagar recusam com a mensagem, sem mudar a fatura", async () => {
    const { empresaId, faturaId, competencia } = await faturaFechadaAntiga();
    entrar(financeiro.id);
    expect(await pagarFaturaB2B(faturaId)).toEqual({ ok: false, erro: MSG_COBRANCA_B2B_DESLIGADA });
    expect(await fecharFaturaB2B({ empresaId, competencia })).toEqual({ ok: false, erro: MSG_COBRANCA_B2B_DESLIGADA });
    expect((await prisma.faturaB2B.findUniqueOrThrow({ where: { id: faturaId } })).status).toBe("FECHADA");
    expect(await prisma.recebimento.count()).toBe(0);
  });
});
