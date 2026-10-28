import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const mocks = vi.hoisted(() => {
  const tx = {
    metaComercial: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  };
  const db = {
    usuario: { findUnique: vi.fn(), findMany: vi.fn() },
    metaComercial: { findFirst: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(async (fn: (cliente: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { tx, db, sessao: vi.fn(), registrarEvento: vi.fn() };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.db }));
vi.mock("@/server/_shared", async (orig) => ({
  ...(await orig<typeof import("@/server/_shared")>()),
  exigirSessaoComPapel: mocks.sessao,
  registrarEvento: mocks.registrarEvento,
}));

import { copiarMetasMesAnterior, salvarMeta } from "./metas";

const gerente = { id: "g", nome: "G", papeis: [Papel.GERENTE_COMERCIAL] };
const admin = { id: "a", nome: "A", papeis: [Papel.ADMINISTRADOR] };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tx.metaComercial.findFirst.mockResolvedValue(null);
  mocks.tx.metaComercial.create.mockResolvedValue({ id: "nova" });
  mocks.db.metaComercial.findMany.mockResolvedValue([]);
});

describe("salvarMeta · meta geral", () => {
  it("gerente_comercial_nao_define_usuario_nulo", async () => {
    mocks.sessao.mockResolvedValue(gerente);
    const r = await salvarMeta({ competencia: "2026-11", usuarioId: null, metrica: "MATRICULAS", valor: 10 });
    expect(r).toEqual({ ok: false, erro: "Só o administrador define a meta geral." });
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });

  it("administrador_grava_a_meta_geral", async () => {
    mocks.sessao.mockResolvedValue(admin);
    const r = await salvarMeta({ competencia: "2026-11", usuarioId: null, metrica: "MATRICULAS", valor: 10 });
    expect(r.ok).toBe(true);
    expect(mocks.tx.metaComercial.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ usuarioId: null, competencia: "2026-11", valor: 10, criadaPorId: "a" }),
    });
  });
});

describe("copiarMetasMesAnterior · escopo", () => {
  it("gerente_copia_apenas_vendedores_da_equipe", async () => {
    mocks.sessao.mockResolvedValue(gerente);
    mocks.db.metaComercial.findMany.mockResolvedValue([
      { id: "o1", usuarioId: "v1", metrica: "MATRICULAS", moeda: null, valor: 8 },
    ]);
    const r = await copiarMetasMesAnterior("2026-11");
    expect(r).toEqual({ ok: true, dado: { copiadas: 1 } });
    expect(mocks.db.metaComercial.findMany).toHaveBeenCalledWith({
      where: { competencia: "2026-10", usuario: { gerenteComercialId: "g", ativo: true } },
    });
    expect(JSON.stringify(mocks.db.metaComercial.findMany.mock.calls[0][0])).not.toContain('"usuarioId":null');
    expect(mocks.tx.metaComercial.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ usuarioId: "v1", competencia: "2026-11", valor: 8 }),
    });
  });

  it("administrador_copia_tambem_a_meta_geral", async () => {
    mocks.sessao.mockResolvedValue(admin);
    const r = await copiarMetasMesAnterior("2026-11");
    expect(r).toEqual({ ok: true, dado: { copiadas: 0 } });
    expect(mocks.db.metaComercial.findMany).toHaveBeenCalledWith({
      where: {
        competencia: "2026-10",
        OR: [
          { usuarioId: null },
          { usuario: { ativo: true, papeis: { hasSome: [Papel.VENDEDOR, Papel.GERENTE_COMERCIAL] } } },
        ],
      },
    });
  });
});
