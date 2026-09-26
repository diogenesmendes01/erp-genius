import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, type Prisma } from "@prisma/client";

// Trava UNITÁRIA do escopo de atendimentos na linha comercial (SPEC-ERP-005 LC-D02/LC-L03/LC-L03b/
// LC-L05), no `npm test` comum: a forma do filtro fica presa sem depender do banco de integração.

const db = vi.hoisted(() => ({ usuario: { findMany: vi.fn() }, alocacaoTurma: { findMany: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
const CARTEIRA = { vendedorDonoId: { in: ["carteira"] } };
vi.mock("@/server/_shared/escopo-comercial", () => ({ escopoComercialAtual: vi.fn(async () => CARTEIRA) }));
vi.mock("@/server/diario/permissoes", () => ({ escopoTurmasDocente: vi.fn(() => ({})) }));

import { escopoAtendimentos } from "./escopo";

type Where = Prisma.AtendimentoWhatsAppWhereInput;
const LINHA = (donos: string[]): Where => ({
  finalidade: "COMERCIAL",
  conversa: { numero: { finalidade: "VENDAS", ativo: true, donoId: { in: donos } } },
});

/** Os ramos OR do escopo de um usuário não administrador. */
async function ramos(id: string, ...papeis: Papel[]): Promise<Where[]> {
  const w = await escopoAtendimentos({ id, papeis });
  const [, ors] = (w as { AND: [Where, Where] }).AND;
  return (ors as { OR?: Where[] }).OR ?? [];
}

beforeEach(() => vi.clearAllMocks());

describe("escopoAtendimentos × linha comercial", () => {
  it("vendedor: linha própria (ativa) + regra de carteira; sem lead fora de linha só pelo responsável", async () => {
    const r = await ramos("v1", Papel.VENDEDOR);
    expect(r).toContainEqual(LINHA(["v1"]));
    const comercial = r.find((x) => x.finalidade === "COMERCIAL" && "OR" in x) as { OR: Where[] };
    expect(comercial.OR).toContainEqual({ lead: { is: CARTEIRA } });
    // LC-L03b: o "responsável sem lead" NÃO vale em número de VENDAS (troca de dono corta o anterior).
    expect(comercial.OR).toContainEqual({ leadId: null, responsavelId: "v1", conversa: { numero: { finalidade: { not: "VENDAS" } } } });
    expect(comercial.OR).not.toContainEqual({ leadId: null, responsavelId: "v1" });
    expect(db.usuario.findMany).not.toHaveBeenCalled();
  });

  it("gerente comercial: linhas próprias e da equipe", async () => {
    db.usuario.findMany.mockResolvedValue([{ id: "v1" }]);
    expect(await ramos("g1", Papel.GERENTE_COMERCIAL)).toContainEqual(LINHA(["g1", "v1"]));
  });

  it("financeiro, secretaria e professor não recebem ramo de linha", async () => {
    db.alocacaoTurma.findMany.mockResolvedValue([]);
    for (const papel of [Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA, Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO]) {
      const r = await ramos("u", papel);
      expect(JSON.stringify(r)).not.toContain('"VENDAS"');
      expect(r.some((x) => x.finalidade === "COMERCIAL")).toBe(false);
    }
  });

  it("administrador vê tudo; no envio, só por número ativo", async () => {
    expect(await escopoAtendimentos({ id: "a", papeis: [Papel.ADMINISTRADOR] })).toEqual({});
    const envio = await escopoAtendimentos({ id: "a", papeis: [Papel.ADMINISTRADOR] }, { enviar: true });
    expect(envio).toMatchObject({ encerradoEm: null, conversa: { numero: { ativo: true } } });
  });
});
