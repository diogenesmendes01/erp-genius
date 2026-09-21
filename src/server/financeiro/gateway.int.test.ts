import { describe, it, expect, beforeEach, vi } from "vitest";
import { FormaPagamento, Papel, StatusComissao } from "@prisma/client";

// Fase 2 (doc 03): gateway por driver (simulado) — geração de link + CONCILIAÇÃO
// automática (webhook) pela baixa compartilhada, incluindo o gatilho C4 (taxa quitada
// ativa matrícula com contrato OK); e fechamento MENSAL automático de comissões.

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, seedCatalogoMinimo } from "@/test/integracao";
import { processarPagamentoGateway } from "./gateway";
import { rodarFechamentoComissoes } from "./cron-financeiro";
import { baixarCobrancaTx } from "./baixa";

let admin: Awaited<ReturnType<typeof criarUsuario>>;
let vendedor: Awaited<ReturnType<typeof criarUsuario>>;
let catalogo: Awaited<ReturnType<typeof seedCatalogoMinimo>>;

beforeEach(async () => {
  await truncarBanco();
  admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  catalogo = await seedCatalogoMinimo();
  authMock.mockResolvedValue({ user: { id: admin.id } });
});

async function seedMatriculaAguardando() {
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Rita", paisId: catalogo.pais.id } });
  const matricula = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "AGUARDANDO" } });
  const taxa = await prisma.cobranca.create({ data: { matriculaId: matricula.id, tipo: "MATRICULA", valorOriginal: 20000, valorNegociado: 20000, saldo: 20000, moeda: "CRC", vencimento: new Date("2030-01-10"), gatewayRef: "aaaaaaaaaaaaaaaaaaaaaaaa" } });
  await prisma.comissao.create({ data: { matriculaId: matricula.id, vendedorId: vendedor.id, percentual: 10, valor: 2000, moeda: "CRC" } });
  return { matriculaId: matricula.id, taxa };
}

describe("gateway legado respeita ledger da SPEC", () => {
  it("não concilia nem ativa sem adaptação ao recebimento contratual", async () => {
    const { taxa, matriculaId } = await seedMatriculaAguardando();
    await expect(processarPagamentoGateway(taxa.gatewayRef!)).rejects.toThrow("Conciliação automática pendente");
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).status).toBe("AGUARDANDO");
    expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: taxa.id } })).valorRecebido).toBeNull();
    expect(await prisma.recebimento.count()).toBe(0);
  });
});

describe("fechamento mensal automático de comissões", () => {
  it("desligado (default) → nada; ligado → paga aprovadas 1x por mês (idempotente)", async () => {
    const { matriculaId } = await seedMatriculaAguardando();
    // Aprovada no MÊS PASSADO: o fechamento automático só paga competência fechada
    // (corte da review PR #60) — aprovadas no mês corrente têm teste próprio abaixo.
    const hoje = new Date();
    await prisma.comissao.updateMany({
      where: { matriculaId },
      data: { status: StatusComissao.APROVADA, aprovadaEm: new Date(hoje.getFullYear(), hoje.getMonth() - 1, 15) },
    });

    const r0 = await rodarFechamentoComissoes();
    expect(r0.executou).toBe(false);
    expect(r0.motivoParada).toBe("fechamento_automatico_desligado");

    await prisma.configFinanceiro.upsert({
      where: { id: "financeiro" },
      create: { id: "financeiro", fechamentoComissaoAutomatico: true },
      update: { fechamentoComissaoAutomatico: true },
    });

    const r1 = await rodarFechamentoComissoes();
    expect(r1.executou).toBe(true);
    expect(r1.pagas).toBe(1);
    expect(await prisma.comissao.count({ where: { status: StatusComissao.PAGA } })).toBe(1);

    const r2 = await rodarFechamentoComissoes();
    expect(r2.executou).toBe(false);
    expect(r2.motivoParada).toBe("ja_fechado_no_mes");
  });
});


describe("review PR #60 — financeiro", () => {
  it("corte de competência: comissão aprovada NO mês corrente NÃO entra no fechamento automático", async () => {
    const { matriculaId } = await seedMatriculaAguardando();
    await prisma.configFinanceiro.upsert({
      where: { id: "financeiro" },
      create: { id: "financeiro", fechamentoComissaoAutomatico: true },
      update: { fechamentoComissaoAutomatico: true },
    });
    // Aprovada AGORA (mês corrente): fica para o próximo ciclo.
    await prisma.comissao.updateMany({
      where: { matriculaId },
      data: { status: StatusComissao.APROVADA, aprovadaEm: new Date() },
    });
    const r1 = await rodarFechamentoComissoes(new Date());
    expect(r1.executou).toBe(true);
    expect(r1.pagas).toBe(0);
    expect(await prisma.comissao.count({ where: { status: StatusComissao.APROVADA } })).toBe(1);

    // No mês seguinte, a mesma comissão (agora do "mês anterior") entra.
    const mesQueVem = new Date();
    mesQueVem.setMonth(mesQueVem.getMonth() + 1, 2);
    const r2 = await rodarFechamentoComissoes(mesQueVem);
    expect(r2.pagas).toBe(1);
  });

  it("não permite baixa manual legada sem chave e destinação", async () => {
    const { taxa } = await seedMatriculaAguardando();
    await expect(prisma.$transaction(tx => baixarCobrancaTx(tx, admin.id, taxa.id, { valorRecebido: 6000, forma: FormaPagamento.TRANSFERENCIA, via: "manual" }))).rejects.toThrow("chave de idempotência");
    expect(await prisma.recebimento.count()).toBe(0);
  });

});

describe("review PR #60 rodada 2 — financeiro", () => {
  it("dois ticks SIMULTÂNEOS do fechamento mensal pagam UMA vez (advisory lock por mês)", async () => {
    const { matriculaId } = await seedMatriculaAguardando();
    await prisma.configFinanceiro.upsert({
      where: { id: "financeiro" },
      create: { id: "financeiro", fechamentoComissaoAutomatico: true },
      update: { fechamentoComissaoAutomatico: true },
    });
    const hoje = new Date();
    await prisma.comissao.updateMany({
      where: { matriculaId },
      data: { status: StatusComissao.APROVADA, aprovadaEm: new Date(hoje.getFullYear(), hoje.getMonth() - 1, 15) },
    });

    const [a, b] = await Promise.all([rodarFechamentoComissoes(), rodarFechamentoComissoes()]);
    expect([a.executou, b.executou].filter(Boolean)).toHaveLength(1); // um fecha, o outro desiste
    expect(await prisma.comissao.count({ where: { status: StatusComissao.PAGA } })).toBe(1);
    expect(await prisma.evento.count({ where: { tipo: "FechamentoComissoesMensal" } })).toBe(1);
  });
});

describe("reconciliação de identidade da cobrança", () => {
  it("competência não bloqueia períodos diferentes e não substitui a identidade da emissão", async () => {
    const { matriculaId } = await seedMatriculaAguardando();
    const comum = { matriculaId, tipo: "HORA_PARTICULAR" as const, competencia: "2030-01", moeda: "CRC", valorOriginal: 100, valorNegociado: 100, saldo: 100, vencimento: new Date("2030-02-05") };
    await prisma.cobranca.create({ data: comum });
    await prisma.cobranca.create({ data: comum });
    expect(await prisma.cobranca.count({ where: { matriculaId, tipo: "HORA_PARTICULAR", competencia: "2030-01" } })).toBe(2);
    const indices = await prisma.$queryRaw<{ indexname: string }[]>`SELECT indexname FROM pg_indexes WHERE indexname = 'EmissaoContinuidadeMensal_matricula_cobertura_key'`;
    expect(indices).toHaveLength(1);
  });
});
