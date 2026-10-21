import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, eventosDo, truncarBanco } from "@/test/integracao";
import { painelIA, salvarConfigIA } from "./ia";

type U = Awaited<ReturnType<typeof criarUsuario>>;
let admin: U, gerente: U;
const logado = (u: { id: string }) => authMock.mockResolvedValue({ user: { id: u.id } });
const c = { modeloConversa: "claude-sonnet-5-5", modeloClassificacao: "claude-haiku-5-5", orcamentoMensalUsd: 100, acaoAoEstourar: "SO_SUGERIR", triagemAtiva: false, limiarTriagem: 80 } as const;
const ultimoEvento = async (tipo: string) => (await prisma.evento.findFirstOrThrow({ where: { tipo }, orderBy: { criadoEm: "desc" } }));

beforeEach(async () => {
  await truncarBanco();
  delete process.env.ANTHROPIC_API_KEY;
  admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
});

describe("Configuração de IA", () => {
  it("so_admin", async () => {
    logado(gerente);
    expect((await salvarConfigIA(c)).ok).toBe(false);
    await expect(painelIA()).rejects.toThrow();
  });
  it("modelo_fora_da_lista_rejeitado", async () => {
    logado(admin);
    expect((await salvarConfigIA({ ...c, modeloConversa: "gpt-4o" })).ok).toBe(false);
    expect((await salvarConfigIA({ ...c, modeloClassificacao: "gpt-4o" })).ok).toBe(false);
  });
  it("orcamento_positivo_e_limiar_50_a_100", async () => {
    logado(admin);
    expect((await salvarConfigIA({ ...c, orcamentoMensalUsd: 0 })).ok).toBe(false);
    expect((await salvarConfigIA({ ...c, limiarTriagem: 40 })).ok).toBe(false);
    expect((await salvarConfigIA({ ...c, limiarTriagem: 101 })).ok).toBe(false);
    expect((await salvarConfigIA({ ...c, limiarTriagem: 50 })).ok).toBe(true);
  });
  it("nunca_expoe_a_chave", async () => {
    process.env.ANTHROPIC_API_KEY = "chave-de-teste-nao-real";
    logado(admin);
    const p = await painelIA();
    expect(p.chave).toBe("configurada");
    expect(JSON.stringify(p)).not.toContain("chave-de-teste-nao-real");
    delete process.env.ANTHROPIC_API_KEY;
    expect((await painelIA()).chave).toBe("ausente");
  });
  it("evento_com_de_para", async () => {
    logado(admin);
    expect((await salvarConfigIA({ ...c, orcamentoMensalUsd: 200 })).ok).toBe(true);
    expect((await ultimoEvento("ConfigIAAlterada")).payload).toMatchObject({ de: { orcamentoMensalUsd: 100 }, para: { orcamentoMensalUsd: 200 } });
    expect((await prisma.configIA.findUniqueOrThrow({ where: { id: "ia" } })).alteradaPorId).toBe(admin.id);
    expect(await eventosDo("ConfigIA", "ia")).toHaveLength(1);
  });
  it("painel_lista_ultimas_50_chamadas", async () => {
    logado(admin);
    await prisma.chamadaIA.createMany({
      data: Array.from({ length: 55 }, () => ({ origem: "ATENDIMENTO" as const, modelo: "claude-sonnet-5-5", provedor: "simulado", tokensEntrada: 10, tokensSaida: 5, tokensCache: 1, custoMicroUsd: 100, latenciaMs: 20, resultado: "OK" })),
    });
    const p = await painelIA();
    expect(p.chamadas).toHaveLength(50);
    expect(p.chamadas[0]).toMatchObject({ tokens: 16, resultado: "OK" });
    expect(p.orcamento.limiteUsd).toBe(100);
  });
});

describe("salvarConfigIA: reenvio idêntico não grava (#166, PR #267 B2)", () => {
  const alteracoes = () => prisma.evento.count({ where: { tipo: "ConfigIAAlterada" } });

  it("duas chamadas idênticas gravam 1 Evento; mudança real ainda grava", async () => {
    logado(admin);
    expect((await salvarConfigIA({ ...c, orcamentoMensalUsd: 250.5 })).ok).toBe(true);
    expect((await salvarConfigIA({ ...c, orcamentoMensalUsd: 250.5 })).ok).toBe(true);
    expect(await alteracoes()).toBe(1);
    expect((await salvarConfigIA({ ...c, orcamentoMensalUsd: 250.5, limiarTriagem: 90 })).ok).toBe(true);
    expect(await alteracoes()).toBe(2);
    expect((await ultimoEvento("ConfigIAAlterada")).payload).toMatchObject({ de: { limiarTriagem: 80 }, para: { limiarTriagem: 90 } });
  });
});
