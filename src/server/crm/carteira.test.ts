import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  oportunidades: vi.fn(),
  eventos: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    configuracaoOperacional: { findUnique: async () => ({ fusoInstitucional: "America/Sao_Paulo" }) },
    oportunidade: { findMany: mocks.oportunidades, groupBy: async () => [] },
    coberturaCarteira: { findMany: async () => [] },
    usuario: { findMany: async () => [] },
    evento: { groupBy: mocks.eventos },
  },
}));
vi.mock("@/server/_shared/escopo-comercial", () => ({ escopoComercialAtual: async () => ({}) }));

import { carregarCarteira, EVENTOS_IGNORADOS_SEM_INTERACAO, lerFiltrosCarteira } from "./carteira";

const gerente = { id: "g1", nome: "G", papeis: [Papel.GERENTE_COMERCIAL] };
const op = (id: string) => ({
  id, nome: id, b2b: false, etapa: "NOVO", pessoaId: null, empresaId: null, criadoEm: new Date("2026-09-01T12:00:00Z"),
  vendedor: null, pessoa: null, matricula: null,
});

describe("carregarCarteira: regra \"sem interação\"", () => {
  beforeEach(() => {
    mocks.oportunidades.mockReset().mockResolvedValue([op("o1"), op("o2")]);
    mocks.eventos.mockReset().mockResolvedValue([]);
  });

  it("o último evento ignora os eventos administrativos (LeadAtribuido, tags, campos)", async () => {
    await carregarCarteira(gerente, lerFiltrosCarteira({}));
    expect(mocks.eventos).toHaveBeenCalledTimes(1);
    const arg = mocks.eventos.mock.calls[0][0];
    expect(arg.where).toEqual({ agregadoTipo: "Lead", agregadoId: { in: ["o1", "o2"] }, tipo: { notIn: [...EVENTOS_IGNORADOS_SEM_INTERACAO] } });
    expect(arg.where.tipo.notIn).toEqual(expect.arrayContaining(["LeadAtribuido", "TagAtribuida", "TagRemovida", "CampoPersonalizadoAlterado"]));
  });

  it("sem oportunidades não consulta eventos", async () => {
    mocks.oportunidades.mockResolvedValue([]);
    await carregarCarteira(gerente, lerFiltrosCarteira({}));
    expect(mocks.eventos).not.toHaveBeenCalled();
  });
});
