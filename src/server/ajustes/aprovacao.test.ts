import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, Prisma } from "@prisma/client";

const m = vi.hoisted(() => ({
  papeis: ["GERENTE_COMERCIAL"] as string[],
  $queryRaw: vi.fn(),
  usuario: { findUnique: vi.fn(), findMany: vi.fn() },
  matricula: { findFirst: vi.fn(), findMany: vi.fn(), findUniqueOrThrow: vi.fn() },
  cobranca: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  aprovacao: { findUnique: vi.fn(), update: vi.fn() },
  ajusteFinanceiro: { create: vi.fn() },
  comissao: { update: vi.fn() },
  coberturaCarteira: { findMany: vi.fn() },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { ...m, $transaction: async (fn: (tx: typeof m) => Promise<unknown>) => fn(m) } }));
vi.mock("@/server/_shared", async (original) => {
  const real = await original<typeof import("@/server/_shared")>();
  return { ...real, registrarEvento: vi.fn(), exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const usuario = { id: "gerente", nome: "Gerente", papeis: m.papeis as Papel[] };
    real.exigirPapel(usuario, ...papeis); return usuario;
  } };
});

import { decidirAprovacao } from "./acoes";
import { escopoMatriculaAprovacao } from "@/server/financeiro/acesso";

beforeEach(() => {
  vi.resetAllMocks(); m.papeis = [Papel.GERENTE_COMERCIAL];
  m.$queryRaw.mockResolvedValue([]);
  m.usuario.findUnique.mockResolvedValue({ ativo: true, limiteDescontoTaxaPct: new Prisma.Decimal(50), limiteDescontoMensalidadePct: new Prisma.Decimal(20), alcadaAlteradaEm: null });
  m.usuario.findMany.mockResolvedValue([{ id: "vendedor-equipe" }]);
  m.matricula.findFirst.mockResolvedValue({ id: "matricula" });
  m.matricula.findMany.mockResolvedValue([{ id: "matricula", leadId: "lead" }]);
  m.matricula.findUniqueOrThrow.mockResolvedValue({ id: "matricula", paisId: "pais", produto: { modalidadeId: "modalidade" }, comissoes: [] });
  m.cobranca.findMany.mockResolvedValue([{ matriculaId: "matricula" }]);
  m.cobranca.findUnique.mockResolvedValue({ id: "cobranca", matriculaId: "matricula", tipo: "MATRICULA", versao: 1, status: "PENDENTE", valorOriginal: new Prisma.Decimal(100), valorNegociado: new Prisma.Decimal(100), valorRecebido: null, valorLiquidadoCredito: new Prisma.Decimal(0), moeda: "BRL", vencimento: new Date("2030-01-01") });
  m.aprovacao.findUnique.mockResolvedValue({ id: "pedido", solicitanteId: "vendedor-equipe", status: "PENDENTE", tipo: "DESCONTO", alvoTipo: "Cobranca", alvoId: "cobranca", criadoEm: new Date("2026-01-01"), payload: {
    alunoId: "aluno", alunoNome: "Aluna", moeda: "BRL", valorDe: 100, valorPara: 50, descontoValor: 50, tipo: "DESCONTO", exigeDirecao: false,
    alvos: [{ id: "cobranca", versao: 1, valorDe: 100, valorPara: 50, referencia: 100, novoVencimento: null }],
  } });
});

describe("aprovação independente na equipe atual", () => {
  it("aprova o desconto da equipe dentro da alçada", async () => {
    expect((await decidirAprovacao("pedido", { aprovar: true })).ok).toBe(true);
    expect(m.cobranca.update).toHaveBeenCalledOnce();
    expect(m.aprovacao.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "APROVADA", aprovadorId: "gerente" }) }));
  });

  it("acumular Financeiro não amplia o alcance comercial da aprovação", async () => {
    m.papeis = [Papel.GERENTE_COMERCIAL, Papel.FINANCEIRO];
    m.matricula.findFirst.mockResolvedValue(null);
    expect((await decidirAprovacao("pedido", { aprovar: true })).ok).toBe(false);
    expect(m.matricula.findFirst).toHaveBeenCalledOnce();
    expect(m.cobranca.update).not.toHaveBeenCalled();
    expect(m.aprovacao.update).not.toHaveBeenCalled();
  });

  it("cobertura de carteira não concede aprovação sobre o titular coberto", async () => {
    const escopo = await escopoMatriculaAprovacao({ id: "gerente", nome: "Gerente", papeis: [Papel.GERENTE_COMERCIAL, Papel.VENDEDOR, Papel.FINANCEIRO] });
    expect(escopo).toEqual({ lead: { is: { vendedorDonoId: { in: ["vendedor-equipe"] } } } });
    expect(m.coberturaCarteira.findMany).not.toHaveBeenCalled();
  });

  it("alçada elevada depois do pedido não autoriza a aprovação pendente", async () => {
    m.usuario.findUnique.mockResolvedValue({ ativo: true, limiteDescontoTaxaPct: new Prisma.Decimal(100), limiteDescontoMensalidadePct: new Prisma.Decimal(100), alcadaAlteradaEm: new Date("2026-02-01") });
    expect((await decidirAprovacao("pedido", { aprovar: true })).ok).toBe(false);
    expect(m.cobranca.update).not.toHaveBeenCalled();
  });

  it("bolsa não herda automaticamente a capacidade de aprovar desconto", async () => {
    const pedido = await m.aprovacao.findUnique();
    m.aprovacao.findUnique.mockResolvedValue({ ...pedido, tipo: "BOLSA", payload: { ...pedido.payload, tipo: "BOLSA" } });
    expect((await decidirAprovacao("pedido", { aprovar: true })).ok).toBe(false);
    expect(m.cobranca.update).not.toHaveBeenCalled();
  });

  it("não altera o valor da comissão paga enquanto o ajuste aguardava o bloqueio", async () => {
    let status = "APROVADA";
    m.$queryRaw.mockImplementation(async (sql: TemplateStringsArray) => {
      if (sql.join("").includes('FROM "Comissao"')) status = "PAGA";
      return [];
    });
    m.matricula.findUniqueOrThrow.mockImplementation(async () => ({ id: "matricula", paisId: "pais", produto: { modalidadeId: "modalidade" }, comissoes: [
      { id: "comissao", vendedorId: "vendedor-equipe", tipo: "PERCENTUAL", status, percentual: new Prisma.Decimal(10), valor: new Prisma.Decimal(10) },
    ] }));
    expect((await decidirAprovacao("pedido", { aprovar: true })).ok).toBe(true);
    expect(m.cobranca.update).toHaveBeenCalledOnce();
    expect(m.comissao.update).not.toHaveBeenCalled();
  });
});

it("não aprova desconto abaixo do total já liquidado por crédito e dinheiro", async () => {
  const c = await m.cobranca.findUnique();
  m.cobranca.findUnique.mockResolvedValue({ ...c, valorRecebido: new Prisma.Decimal(20), valorLiquidadoCredito: new Prisma.Decimal(40) });
  const r = await decidirAprovacao("pedido", { aprovar: true });
  expect(r.ok).toBe(false);
  expect(m.cobranca.update).not.toHaveBeenCalled();
  expect(m.ajusteFinanceiro.create).not.toHaveBeenCalled();
});
it("aprova ajuste compatível mantendo dinheiro e crédito separados no saldo", async () => {
  const c = await m.cobranca.findUnique();
  m.cobranca.findUnique.mockResolvedValue({ ...c, valorRecebido: new Prisma.Decimal(10), valorLiquidadoCredito: new Prisma.Decimal(20) });
  expect((await decidirAprovacao("pedido", { aprovar: true })).ok).toBe(true);
  const dados = m.cobranca.update.mock.calls[0][0].data;
  expect(dados.saldo.toFixed(2)).toBe("20.00");
  expect(dados).not.toHaveProperty("valorRecebido");
  expect(dados).not.toHaveProperty("valorLiquidadoCredito");
});
