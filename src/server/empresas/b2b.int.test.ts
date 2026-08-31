import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel, StatusCobranca, StatusMatricula } from "@prisma/client";

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
  authMock.mockResolvedValue({ user: { id: gerente.id } });
});

async function seedEmpresa() {
  const r = await salvarEmpresa({ nome: "Acme Corp", paisId: catalogo.pais.id, diaVencimento: 10 });
  if (!r.ok) throw new Error(`salvarEmpresa: ${(r as { erro?: string }).erro}`);
  return r.dado!.id;
}

describe("empresa + lote", () => {
  it("cria empresa com código E- e evento", async () => {
    const id = await seedEmpresa();
    const empresa = await prisma.empresa.findUniqueOrThrow({ where: { id } });
    expect(empresa.codigo).toMatch(/^E-\d{6}$/);
    expect((await eventosDo("Empresa", id)).map((e) => e.tipo)).toContain("EmpresaCriada");
  });

  it("lote cria aluno + matrícula ATIVA (lastro contrato B2B) + cronograma por colaborador", async () => {
    const empresaId = await seedEmpresa();
    const r = await criarMatriculasLoteB2B({
      empresaId,
      produtoId: catalogo.produto.id,
      mensalidadeValor: 50000,
      mesesPlano: 3,
      colaboradores: [
        { primeiroNome: "Ana", sobrenome: "Rojas", email: "ana@acme.cr" },
        { primeiroNome: "Luis" },
      ],
    });
    expect(r.ok, r.ok ? "" : `falhou: ${(r as { erro?: string }).erro}`).toBe(true);
    expect(r.ok && r.dado!.criadas).toBe(2);

    const matriculas = await prisma.matricula.findMany({
      where: { empresaId },
      include: { cobrancas: true, aluno: true },
    });
    expect(matriculas).toHaveLength(2);
    for (const m of matriculas) {
      expect(m.status).toBe(StatusMatricula.ATIVA);
      expect(m.contratoOk).toBe(true);
      expect(m.cobrancas).toHaveLength(3); // cronograma completo, sem taxa individual
      expect(m.cobrancas.every((c) => c.tipo === "MENSALIDADE")).toBe(true);
      expect(m.moeda).toBe("CRC");
      const ativacao = (await eventosDo("Matricula", m.id)).find((e) => e.tipo === "MatriculaAtivada");
      expect((ativacao?.payload as { lastro?: string }).lastro).toBe("CONTRATO_B2B");
    }
  });
});

describe("fatura única", () => {
  async function seedLoteComCobrancas() {
    const empresaId = await seedEmpresa();
    await criarMatriculasLoteB2B({
      empresaId,
      produtoId: catalogo.produto.id,
      mensalidadeValor: 50000,
      mesesPlano: 2,
      colaboradores: [{ primeiroNome: "Ana" }, { primeiroNome: "Luis" }],
    });
    const primeira = await prisma.cobranca.findFirstOrThrow({
      where: { matricula: { empresaId } },
      orderBy: { vencimento: "asc" },
    });
    return { empresaId, competencia: primeira.competencia! };
  }

  it("fechar agrupa as mensalidades da competência; total = soma; idempotente por mês", async () => {
    const { empresaId, competencia } = await seedLoteComCobrancas();

    const r = await fecharFaturaB2B({ empresaId, competencia });
    expect(r.ok, r.ok ? "" : `falhou: ${(r as { erro?: string }).erro}`).toBe(true);
    expect(r.ok && r.dado!.total).toBe(100000); // 2 colaboradores × 50000

    const fatura = await prisma.faturaB2B.findFirstOrThrow({ include: { cobrancas: true } });
    expect(fatura.codigo).toMatch(/^F-\d{6}$/);
    expect(fatura.status).toBe("FECHADA");
    expect(fatura.cobrancas).toHaveLength(2);

    const r2 = await fecharFaturaB2B({ empresaId, competencia });
    expect(r2.ok).toBe(false); // já existe fatura da competência
  });

  it("pagar baixa TODAS as cobranças em lote (evento via fatura_b2b) e marca a fatura PAGA", async () => {
    const { empresaId, competencia } = await seedLoteComCobrancas();
    await fecharFaturaB2B({ empresaId, competencia });
    const fatura = await prisma.faturaB2B.findFirstOrThrow();

    authMock.mockResolvedValue({ user: { id: financeiro.id } });
    const r = await pagarFaturaB2B(fatura.id);
    expect(r.ok, r.ok ? "" : `falhou: ${(r as { erro?: string }).erro}`).toBe(true);
    expect(r.ok && r.dado!.baixadas).toBe(2);

    const depois = await prisma.faturaB2B.findUniqueOrThrow({
      where: { id: fatura.id },
      include: { cobrancas: true },
    });
    expect(depois.status).toBe("PAGA");
    expect(depois.cobrancas.every((c) => c.status === StatusCobranca.PAGO)).toBe(true);
    const evPagamento = await prisma.evento.findFirst({
      where: { tipo: "PagamentoRegistrado", agregadoId: depois.cobrancas[0].id },
    });
    expect((evPagamento?.payload as { via?: string }).via).toBe("fatura_b2b");
  });
});

describe("relatório por colaborador", () => {
  it("conta pagas/abertas/atrasadas e total pago por colaborador", async () => {
    const empresaId = await seedEmpresa();
    await criarMatriculasLoteB2B({
      empresaId,
      produtoId: catalogo.produto.id,
      mensalidadeValor: 50000,
      mesesPlano: 2,
      colaboradores: [{ primeiroNome: "Ana" }],
    });
    // Paga a 1ª mensalidade da Ana direto (simula baixa avulsa).
    const cobranca = await prisma.cobranca.findFirstOrThrow({
      where: { matricula: { empresaId } },
      orderBy: { vencimento: "asc" },
    });
    await prisma.cobranca.update({
      where: { id: cobranca.id },
      data: { status: StatusCobranca.PAGO, valorRecebido: 50000, pagoEm: new Date() },
    });

    const dados = await obterEmpresa(empresaId);
    expect(dados!.colaboradores).toHaveLength(1);
    expect(dados!.colaboradores[0].mensalidadesPagas).toBe(1);
    expect(dados!.colaboradores[0].mensalidadesAbertas).toBe(1);
    expect(dados!.colaboradores[0].totalPago).toBe(50000);
  });
});
