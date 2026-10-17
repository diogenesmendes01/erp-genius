import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, type Prisma } from "@prisma/client";

const db = vi.hoisted(() => ({ usuario: { findMany: vi.fn() }, alocacaoTurma: { findMany: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/_shared/escopo-comercial", () => ({ escopoComercialAtual: vi.fn(async () => ({ vendedorDonoId: { in: ["carteira"] } })) }));
vi.mock("@/server/diario/permissoes", () => ({ escopoTurmasDocente: vi.fn(() => ({})) }));

import { escopoAtendimentos, ramoFilaDoSetor } from "./escopo";

type Where = Prisma.AtendimentoWhatsAppWhereInput;
const LINHA = (donos: string[]): Where => ({
  finalidade: "COMERCIAL",
  conversa: { numero: { finalidade: "VENDAS", ativo: true, donoId: { in: donos } } },
});

async function ramos(id: string, ...papeis: Papel[]): Promise<Where[]> {
  const w = await escopoAtendimentos({ id, papeis });
  const [, ors] = (w as { AND: [Where, Where] }).AND;
  return (ors as { OR?: Where[] }).OR ?? [];
}

beforeEach(() => {
  vi.clearAllMocks();
  db.usuario.findMany.mockResolvedValue([]);
  db.alocacaoTurma.findMany.mockResolvedValue([]);
});

describe("escopoAtendimentos por setor", () => {
  it("ramoFilaDoSetor tem a forma do contrato", () => {
    expect(ramoFilaDoSetor("FINANCEIRO")).toMatchObject({ finalidade: "FINANCEIRO", responsavelId: null, encerradoEm: null });
  });
  it("financeiro: próprio + fila do setor + participante; não vê FIN de colega", async () => {
    const r = await ramos("f1", Papel.FINANCEIRO);
    expect(r).toContainEqual({ finalidade: "FINANCEIRO", responsavelId: "f1" });
    expect(r).toContainEqual(ramoFilaDoSetor("FINANCEIRO"));
    expect(r).toContainEqual(expect.objectContaining({ participantes: expect.anything() }));
    expect(r).not.toContainEqual({ finalidade: "FINANCEIRO", alunoId: { not: null } });
    expect(r).not.toContainEqual({ finalidade: "FINANCEIRO" });
  });
  it("gerente comercial: todo COMERCIAL; gerente pedagógico: todo PEDAGOGICO", async () => {
    expect(await ramos("g", Papel.GERENTE_COMERCIAL)).toContainEqual({ finalidade: "COMERCIAL" });
    expect(await ramos("gp", Papel.GERENTE_PEDAGOGICO)).toContainEqual({ finalidade: "PEDAGOGICO" });
  });
  it("vendedor mantém carteira e linha (regras 2 e 3)", async () => {
    const r = await ramos("v1", Papel.VENDEDOR);
    expect(r).toContainEqual(LINHA(["v1"]));
    expect(r).toContainEqual({ ...ramoFilaDoSetor("COMERCIAL"), leadId: null });
    expect(r).not.toContainEqual(ramoFilaDoSetor("COMERCIAL"));
  });
  it("vendedor: responsável gravado não vira acesso genérico em COMERCIAL (LC-D02)", async () => {
  const r = await ramos("v1", Papel.VENDEDOR);
  expect(r).not.toContainEqual({ finalidade: "COMERCIAL", responsavelId: "v1" });
});
it("professor mantém só turma atual / experimental própria (regra 4) e não ganha fila", async () => {
    expect((await ramos("p", Papel.PROFESSOR)).some((x) => x.responsavelId === null)).toBe(false);
  });
  it("secretaria: fila e próprio em SECRETARIA, FINANCEIRO e PEDAGOGICO; sem ver tudo", async () => {
    const r = await ramos("s", Papel.SECRETARIA_ACADEMICA);
    for (const setor of ["SECRETARIA", "FINANCEIRO", "PEDAGOGICO"] as const) {
      expect(r).toContainEqual(ramoFilaDoSetor(setor));
      expect(r).not.toContainEqual({ finalidade: setor });
    }
  });
});
