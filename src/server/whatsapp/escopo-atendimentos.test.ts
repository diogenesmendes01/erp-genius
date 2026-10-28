import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, type Prisma } from "@prisma/client";

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
    expect(comercial.OR).toContainEqual({ leadId: null, responsavelId: "v1", conversa: { numero: { finalidade: { not: "VENDAS" } } } });
    expect(comercial.OR).not.toContainEqual({ leadId: null, responsavelId: "v1" });
    expect(comercial.OR).toContainEqual({
      encerradoEm: null, responsavelId: "v1", conversa: { numero: { finalidade: { not: "VENDAS" } } },
      acessosTransferidos: { some: { usuarioId: "v1", revogadoEm: null } },
    });
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
      expect(JSON.stringify(r)).not.toContain("acessosTransferidos");
    }
  });

  it("administrador vê tudo; no envio, só por número ativo", async () => {
    expect(await escopoAtendimentos({ id: "a", papeis: [Papel.ADMINISTRADOR] })).toEqual({});
    const envio = await escopoAtendimentos({ id: "a", papeis: [Papel.ADMINISTRADOR] }, { enviar: true });
    expect(envio).toMatchObject({ encerradoEm: null, conversa: { numero: { ativo: true } } });
  });
});
