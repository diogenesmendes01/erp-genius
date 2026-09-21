import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ sessao: vi.fn(), usuario: vi.fn(), envios: vi.fn(), transaction: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: m.transaction } }));
vi.mock("@/server/_shared", async (original) => {
  const real = await original<typeof import("@/server/_shared")>();
  return { ...real, exigirSessaoComPapel: m.sessao };
});

import { consultarFilaEnviosPortalAluno } from "./fila-envios";

const linha = (id: string) => ({
  id,
  finalidade: "CONVITE" as const,
  situacao: "PREPARADO" as const,
  criadoEm: new Date("2026-09-16T10:00:00.000Z"),
  atualizadoEm: new Date("2026-09-16T11:00:00.000Z"),
  destinatario: "segredo@example.test",
  chave: "chave-interna",
  conta: { aluno: { primeiroNome: "Ana", sobrenome: "Silva", email: "nao-expor@example.test" } },
  conciliacoes: [],
});

beforeEach(() => {
  vi.resetAllMocks();
  m.sessao.mockResolvedValue({ id: "secretaria" });
  m.usuario.mockResolvedValue({ ativo: true, papeis: ["SECRETARIA_ACADEMICA"] });
  m.transaction.mockImplementation((f: (tx: object) => unknown) => f({
    usuario: { findUnique: m.usuario },
    solicitacaoEnvioPortalAluno: { findMany: m.envios },
  }));
});

describe("consultarFilaEnviosPortalAluno", () => {
  it("pagina por id, traz vinte itens e não projeta dados de entrega", async () => {
    m.envios.mockResolvedValue(Array.from({ length: 21 }, (_, indice) => linha(String(indice).padStart(2, "0"))));

    const resultado = await consultarFilaEnviosPortalAluno();

    if (!resultado.ok || !resultado.dado) throw new Error("Fila ausente");
    expect(resultado.dado.itens).toHaveLength(20);
    expect(resultado.dado.proximoCursor).toBe("19");
    expect(resultado.dado.itens[0]).toEqual({
      id: "00", alunoNome: "Ana Silva", finalidade: "CONVITE", situacao: "PREPARADO",
      criadoEm: new Date("2026-09-16T10:00:00.000Z"), atualizadoEm: new Date("2026-09-16T11:00:00.000Z"), conciliacao: null, podeRegistrarEvidencia: true, podeDecidirReemissao: false,
    });
    expect(m.envios).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { id: "asc" }, take: 21 }));
    expect(JSON.stringify(resultado.dado)).not.toMatch(/segredo@example|nao-expor@example|chave-interna|token|link/i);
  });

  it("aplica o cursor somente como limite ascendente do id", async () => {
    m.envios.mockResolvedValue([]);

    await consultarFilaEnviosPortalAluno({ cursor: "solicitacao-20" });

    expect(m.envios).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { gt: "solicitacao-20" } } }));
  });

  it("revalida o papel no banco antes da consulta", async () => {
    m.usuario.mockResolvedValue({ ativo: true, papeis: ["FINANCEIRO"] });

    await expect(consultarFilaEnviosPortalAluno()).resolves.toMatchObject({ ok: false });

    expect(m.envios).not.toHaveBeenCalled();
  });
});


  it("projeta evid�ncia e controles apenas para a Administra��o independente", async () => {
    m.usuario.mockResolvedValue({ ativo: true, papeis: ["ADMINISTRADOR"] });
    const comConciliacao = linha("x");
    comConciliacao.conciliacoes = [{ id: "c1", estadoHash: "a".repeat(64), evidencia: "Confer�ncia sem recibo do provedor.", versao: 2, criadaEm: new Date("2026-09-16T12:00:00Z"), secretariaId: "outra", secretaria: { nome: "Secretaria" }, decisao: { aprovada: false, decididaEm: new Date("2026-09-16T13:00:00Z"), solicitacaoReemitidaId: null } }] as never;
    m.envios.mockResolvedValue([comConciliacao]);
    const r = await consultarFilaEnviosPortalAluno();
    expect(r).toMatchObject({ ok: true, dado: { itens: [{ podeRegistrarEvidencia: true, podeDecidirReemissao: true, conciliacao: { secretariaNome: "Secretaria", evidencia: "Confer�ncia sem recibo do provedor.", versao: 2, decisao: { aprovada: false, decididaEm: new Date("2026-09-16T13:00:00Z"), solicitacaoReemitidaId: null } } }] } });
    expect(m.envios).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ conciliacoes: expect.objectContaining({ select: expect.objectContaining({ decisao: { select: expect.objectContaining({ decididaEm: true }) } }) }) }) }));
  });
