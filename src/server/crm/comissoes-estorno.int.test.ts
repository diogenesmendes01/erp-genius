import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, eventosDo, seedCatalogoMinimo } from "@/test/integracao";
import { MOTIVOS_ESTORNO, estornarComissao } from "./comissoes-estorno";

const logadoComo = (id: string) => authMock.mockResolvedValue({ user: { id } });

type U = Awaited<ReturnType<typeof criarUsuario>>;
let gerente: U;
let vendedor: U;
let financeiro: U;
let aprovada: string;
let pendente: string;
let paga: string;
let cat: Awaited<ReturnType<typeof seedCatalogoMinimo>>;
let seq = 0;

async function comissao(status: "PENDENTE" | "APROVADA" | "PAGA" | "ESTORNADA") {
  seq += 1;
  const aluno = await prisma.aluno.create({ data: { primeiroNome: `Aluno${seq}`, paisId: cat.pais.id } });
  const lead = await prisma.oportunidade.create({ data: { nome: `Opp${seq}`, vendedorDonoId: vendedor.id, etapa: "MATRICULADO" } });
  const m = await prisma.matricula.create({ data: { alunoId: aluno.id, leadId: lead.id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "BRL", status: "ATIVA", mesesPlano: 2, referenciaCobertura: "MES_CIVIL" } });
  return (await prisma.comissao.create({ data: { matriculaId: m.id, vendedorId: vendedor.id, tipo: "PERCENTUAL", percentual: 10, valor: 25, moeda: "BRL", status } })).id;
}

beforeEach(async () => {
  await truncarBanco();
  seq = 0;
  cat = await seedCatalogoMinimo();
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  financeiro = await criarUsuario([Papel.FINANCEIRO], "Financeiro");
  aprovada = await comissao("APROVADA");
  pendente = await comissao("PENDENTE");
  paga = await comissao("PAGA");
});

describe("estornarComissao", () => {
  it("expõe os motivos fechados", () => {
    expect([...MOTIVOS_ESTORNO]).toEqual(["CANCELAMENTO_MATRICULA", "DESISTENCIA_7_DIAS", "ERRO_LANCAMENTO", "OUTRO"]);
  });

  it("só FINANCEIRO (e ADMINISTRADOR, que tem todas as capacidades); só PENDENTE/APROVADA; PAGA exige clawback (fora da fase)", async () => {
    logadoComo(gerente.id);
    expect((await estornarComissao({ id: aprovada, motivo: "ERRO_LANCAMENTO" })).ok).toBe(false);
    logadoComo(vendedor.id);
    expect((await estornarComissao({ id: aprovada, motivo: "ERRO_LANCAMENTO" })).ok).toBe(false);
    expect((await prisma.comissao.findUniqueOrThrow({ where: { id: aprovada } })).status).toBe("APROVADA");
    logadoComo(financeiro.id);
    expect(await estornarComissao({ id: paga, motivo: "ERRO_LANCAMENTO" })).toEqual({ ok: false, erro: "Comissão já paga: o desconto no próximo fechamento ainda não existe." });
    expect(await estornarComissao({ id: aprovada, motivo: "OUTRO" })).toEqual({ ok: false, erro: "Descreva o motivo." });
    await estornarComissao({ id: aprovada, motivo: "CANCELAMENTO_MATRICULA" });
    const c = await prisma.comissao.findUniqueOrThrow({ where: { id: aprovada } });
    expect(c.status).toBe("ESTORNADA");
    expect(c.valor.toString()).toBe("25");
    expect((await eventosDo("Comissao", aprovada)).at(-1)).toMatchObject({ tipo: "ComissaoEstornada", payload: { de: "APROVADA", motivo: "CANCELAMENTO_MATRICULA" } });
  });

  it("ADMINISTRADOR estorna (matriz da Task 4: o admin recebe todas as capacidades)", async () => {
    const admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
    logadoComo(admin.id);
    expect(await estornarComissao({ id: aprovada, motivo: "ERRO_LANCAMENTO" })).toMatchObject({ ok: true });
    expect((await prisma.comissao.findUniqueOrThrow({ where: { id: aprovada } })).status).toBe("ESTORNADA");
    expect((await eventosDo("Comissao", aprovada)).at(-1)).toMatchObject({ tipo: "ComissaoEstornada", autorId: admin.id });
  });

  it("estorna PENDENTE com detalhe, e não estorna duas vezes nem sem existir", async () => {
    logadoComo(financeiro.id);
    expect((await estornarComissao({ id: pendente, motivo: "OUTRO", detalhe: "  Lançada no aluno errado  " })).ok).toBe(true);
    expect((await eventosDo("Comissao", pendente)).at(-1)).toMatchObject({ payload: { de: "PENDENTE", motivo: "OUTRO", detalhe: "Lançada no aluno errado" } });
    const de = await estornarComissao({ id: pendente, motivo: "ERRO_LANCAMENTO" });
    expect(de).toEqual({ ok: false, erro: "Comissão já estornada." });
    expect((await eventosDo("Comissao", pendente)).filter((e) => e.tipo === "ComissaoEstornada")).toHaveLength(1);
    expect(await estornarComissao({ id: "inexistente", motivo: "ERRO_LANCAMENTO" })).toEqual({ ok: false, erro: "Comissão não encontrada." });
    expect((await estornarComissao({ id: aprovada, motivo: "INVENTADO" as never })).ok).toBe(false);
  });
});
