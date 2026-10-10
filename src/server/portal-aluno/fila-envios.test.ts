import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ sessao: vi.fn(), usuario: vi.fn(), envios: vi.fn(), transaction: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: m.transaction } }));
vi.mock("@/server/_shared", async (original) => {
  const real = await original<typeof import("@/server/_shared")>();
  return { ...real, exigirSessaoComPapel: m.sessao };
});

import { findManyComOnde, idsEmOrdem, terminaNoId } from "@/test/consulta-paginada";
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
  it("lê por id, traz vinte itens e não projeta dados de entrega", async () => {
    m.envios.mockResolvedValue(Array.from({ length: 21 }, (_, indice) => linha(String(indice).padStart(2, "0"))));

    const resultado = await consultarFilaEnviosPortalAluno();

    if (!resultado.ok || !resultado.dado) throw new Error("Fila ausente");
    expect(resultado.dado.itens).toHaveLength(20);
    expect(resultado.dado).toMatchObject({ temAnterior: false, temProxima: true, anterior: null, proxima: "19" });
    expect(resultado.dado.itens[0]).toEqual({
      id: "00", alunoNome: "Ana Silva", finalidade: "CONVITE", situacao: "PREPARADO",
      criadoEm: new Date("2026-09-16T10:00:00.000Z"), atualizadoEm: new Date("2026-09-16T11:00:00.000Z"), conciliacao: null, podeRegistrarEvidencia: true, podeDecidirReemissao: false,
    });
    expect(m.envios).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { id: "asc" }, take: 21 }));
    expect(m.envios.mock.calls[0][0]).not.toHaveProperty("skip");
    expect(JSON.stringify(resultado.dado)).not.toMatch(/segredo@example|nao-expor@example|chave-interna|token|link/i);
  });

  it("cursor nos dois sentidos: ida e volta trazem os mesmos itens; a primeira não tem anterior e a última não tem próxima", async () => {
    const fila = idsEmOrdem(45).reverse().map(linha);
    m.envios.mockImplementation(findManyComOnde(fila));
    const ler = async (nav: { depois?: string; antes?: string } = {}) => {
      const r = await consultarFilaEnviosPortalAluno(nav);
      if (!r.ok || !r.dado) throw new Error("Fila ausente");
      return r.dado;
    };
    const p1 = await ler(), p2 = await ler({ depois: p1.proxima! }), p3 = await ler({ depois: p2.proxima! });
    expect(m.envios).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { gt: "r19" } }, take: 21 }));
    expect(terminaNoId(m.envios.mock.calls[0][0].orderBy)).toBe(true);
    expect([p1.temAnterior, p1.temProxima, p2.temProxima, p3.temProxima]).toEqual([false, true, true, false]);
    expect(p3.itens.map((i) => i.id)).toEqual(["40", "41", "42", "43", "44"].map((n) => `r${n}`));
    expect(p3.proxima).toBeNull();
    expect((await ler({ antes: p3.anterior! })).itens).toEqual(p2.itens);
    const inicio = await ler({ antes: p2.anterior! });
    expect(inicio.itens).toEqual(p1.itens);
    expect(inicio.temAnterior).toBe(false);
    expect(new Set([...p1.itens, ...p2.itens, ...p3.itens].map((i) => i.id)).size).toBe(45);

    // Conciliar r05 (que sai da fila) depois de ler a primeira página não faz a próxima pular r20.
    fila.splice(fila.findIndex((l) => l.id === "r05"), 1);
    expect((await ler({ depois: p1.proxima! })).itens.map((i) => i.id)).toEqual(p2.itens.map((i) => i.id));
  });

  it("recusa cursor inválido, os dois sentidos juntos e página numerada, sem consultar", async () => {
    await expect(consultarFilaEnviosPortalAluno({ depois: "../x" })).resolves.toMatchObject({ ok: false });
    await expect(consultarFilaEnviosPortalAluno({ depois: "a", antes: "b" })).resolves.toMatchObject({ ok: false });
    await expect(consultarFilaEnviosPortalAluno({ pagina: 2 } as never)).resolves.toMatchObject({ ok: false });
    expect(m.envios).not.toHaveBeenCalled();
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
