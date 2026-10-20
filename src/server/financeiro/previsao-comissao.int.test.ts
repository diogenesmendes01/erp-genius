import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

// D11: mudar o dia X da previsão de pagamento grava o evento auditado `{ de, para }`, na alçada de configurar
// comissão; repetir o mesmo dia não grava nada; fora de 1 a 28 é recusado (também no banco, por CHECK).

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, eventosDo } from "@/test/integracao";
import { salvarDiaPrevisaoComissao } from "./acoes";
import { configuracaoComissoes } from "./consultas";

const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
let financeiro: Awaited<ReturnType<typeof criarUsuario>>;

beforeEach(async () => {
  await truncarBanco();
  financeiro = await criarUsuario([Papel.FINANCEIRO], "Financeiro");
  await prisma.usuario.update({ where: { id: financeiro.id }, data: { permissoes: ["comissao.configurar"] } });
});

describe("salvarDiaPrevisaoComissao (D11)", () => {
  it("padrão 10; mudar grava o dia e o evento { de, para }", async () => {
    entrar(financeiro.id);
    expect((await configuracaoComissoes())?.diaPrevisaoPagamento).toBe(10);
    expect(await salvarDiaPrevisaoComissao({ dia: 15 })).toEqual({ ok: true, dado: { dia: 15 } });
    expect((await prisma.configFinanceiro.findUniqueOrThrow({ where: { id: "financeiro" } })).diaPrevisaoPagamentoComissao).toBe(15);
    expect((await configuracaoComissoes())?.diaPrevisaoPagamento).toBe(15);
    expect(await salvarDiaPrevisaoComissao({ dia: 20 })).toMatchObject({ ok: true });
    const eventos = (await eventosDo("ConfigFinanceiro", "financeiro")).filter((e) => e.tipo === "DiaPrevisaoComissaoAlterado");
    expect(eventos.map((e) => e.payload)).toEqual([{ de: 10, para: 15 }, { de: 15, para: 20 }]);
    expect(eventos.every((e) => e.autorId === financeiro.id)).toBe(true);
  });

  it("repetir o mesmo dia não grava evento", async () => {
    entrar(financeiro.id);
    await salvarDiaPrevisaoComissao({ dia: 12 });
    await salvarDiaPrevisaoComissao({ dia: 12 });
    expect((await eventosDo("ConfigFinanceiro", "financeiro")).filter((e) => e.tipo === "DiaPrevisaoComissaoAlterado")).toHaveLength(1);
  });

  it("fora de 1 a 28 é recusado, e o banco também recusa", async () => {
    entrar(financeiro.id);
    for (const dia of [0, 29, 10.5]) expect((await salvarDiaPrevisaoComissao({ dia })).ok).toBe(false);
    expect(await prisma.configFinanceiro.count()).toBe(0);
    await expect(prisma.configFinanceiro.create({ data: { id: "financeiro", diaPrevisaoPagamentoComissao: 31 } })).rejects.toThrow();
  });

  it("sem a permissão de configurar comissão, nada muda", async () => {
    const semPermissao = await criarUsuario([Papel.FINANCEIRO], "Financeiro sem permissão");
    entrar(semPermissao.id);
    expect((await salvarDiaPrevisaoComissao({ dia: 15 })).ok).toBe(false);
    const vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
    entrar(vendedor.id);
    expect((await salvarDiaPrevisaoComissao({ dia: 15 })).ok).toBe(false);
    expect(await prisma.evento.count({ where: { tipo: "DiaPrevisaoComissaoAlterado" } })).toBe(0);
  });
});
