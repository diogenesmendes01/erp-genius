import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

// B2B — Fase 2 (doc 03): lote de matrículas corporativas, fatura única por competência,
// baixa em lote e relatório por colaborador. Sessão mockada; papéis frescos do banco.

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, seedCatalogoMinimo, eventosDo } from "@/test/integracao";
import { criarMatriculasLoteB2B, fecharFaturaB2B, pagarFaturaB2B, salvarEmpresa } from "./acoes";
import { obterEmpresa } from "./consultas";

let gerente: Awaited<ReturnType<typeof criarUsuario>>;
let financeiro: Awaited<ReturnType<typeof criarUsuario>>;
let catalogo: Awaited<ReturnType<typeof seedCatalogoMinimo>>;

beforeEach(async () => {
  await truncarBanco();
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  financeiro = await criarUsuario([Papel.FINANCEIRO], "Financeiro");
  catalogo = await seedCatalogoMinimo();
  authMock.mockResolvedValue({ user: { id: financeiro.id } });
});

async function seedEmpresa() {
  const r = await salvarEmpresa({ nome: "Acme Corp", paisId: catalogo.pais.id, diaVencimento: 10 });
  if (!r.ok) throw new Error(`salvarEmpresa: ${(r as { erro?: string }).erro}`);
  return r.dado!.id;
}


// Q88 preserva empresas pagadoras; o lote que ativava sem contrato/reserva é obsoleto.
describe("empresas e dados históricos após merge", () => {
  it("Financeiro mantém cadastro da empresa com autoria", async () => {
    const id = await seedEmpresa();
    expect((await prisma.empresa.findUniqueOrThrow({ where: { id } })).codigo).toMatch(/^E-\d{6}$/);
    expect((await eventosDo("Empresa", id))[0].autorId).toBe(financeiro.id);
  });
  it("lote não ativa contratos nem gera recebíveis fora da preparação", async () => {
    const empresaId = await seedEmpresa();
    const r = await criarMatriculasLoteB2B({ empresaId, produtoId: catalogo.produto.id, mensalidadeValor: 500, mesesPlano: 3, colaboradores: [{ primeiroNome: "Ana" }] });
    expect(r.ok).toBe(false);
    expect(await prisma.aluno.count()).toBe(0); expect(await prisma.matricula.count()).toBe(0); expect(await prisma.cobranca.count()).toBe(0);
  });
  it("gerente comercial não recebe ficha financeira coletiva", async () => {
    const id = await seedEmpresa();
    authMock.mockResolvedValue({ user: { id: gerente.id } });
    await expect(obterEmpresa(id)).rejects.toThrow();
    expect((await fecharFaturaB2B({ empresaId: id, competencia: "2030-01" })).ok).toBe(false);
  });
  it("baixa histórica grava recebimentos/destinações sem ativar matrícula", async () => {
    const empresaId = await seedEmpresa();
    const aluno = await prisma.aluno.create({ data: { primeiroNome: "Legado", paisId: catalogo.pais.id } });
    const mat = await prisma.matricula.create({ data: { alunoId: aluno.id, empresaId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "AGUARDANDO" } });
    const c = await prisma.cobranca.create({ data: { matriculaId: mat.id, tipo: "MENSALIDADE", competencia: "2030-01", valorOriginal: 500, valorNegociado: 500, saldo: 500, moeda: "CRC", vencimento: new Date("2030-01-10") } });
    const f = await fecharFaturaB2B({ empresaId, competencia: "2030-01" });
    expect(f.ok, JSON.stringify(f)).toBe(true);
    if (!f.ok || !f.dado) throw new Error("Fatura ausente");
    const pago = await pagarFaturaB2B(f.dado.id);
    expect(pago.ok, JSON.stringify(pago)).toBe(true);
    expect(await prisma.recebimento.count()).toBe(1); expect(await prisma.destinacaoRecebimento.count()).toBe(1);
    expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("PAGO");
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: mat.id } })).status).toBe("AGUARDANDO");
    expect((await pagarFaturaB2B(f.dado.id)).ok).toBe(false);
    expect(await prisma.recebimento.count()).toBe(1);
  });
});
