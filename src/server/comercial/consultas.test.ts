import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const db = vi.hoisted(() => ({ lead: { findMany: vi.fn(), findFirst: vi.fn() }, evento: { groupBy: vi.fn(), findMany: vi.fn() }, coberturaCarteira: { findMany: vi.fn() }, usuario: { findMany: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
import { listarLeads, obterLead } from "./consultas";
const u = (...papeis: Papel[]) => ({ id: "vendedor", nome: "V", papeis });
beforeEach(() => {
  vi.clearAllMocks(); db.coberturaCarteira.findMany.mockResolvedValue([]); db.usuario.findMany.mockResolvedValue([]);
  db.lead.findMany.mockResolvedValue([]); db.evento.findMany.mockResolvedValue([]);
  db.lead.findFirst.mockResolvedValue({ id: "lead", documentos: [{ categoria: "PROPOSTA", url: "proposta" }, { categoria: "CONTRATO", url: "contrato" }, { categoria: "COMPROVANTE", url: "comprovante" }], matricula: { secretariaAssumiuEm: new Date() } });
});
describe("consulta comercial não amplia carteira", () => {
  it("ex-vendedor não consulta ficha nem lista mesmo mantendo propriedade antiga", async () => {
    expect(await obterLead("lead", u(Papel.PROFESSOR))).toBeNull();
    expect(await listarLeads(u(Papel.PROFESSOR))).toEqual([]);
    expect(db.lead.findFirst).not.toHaveBeenCalled(); expect(db.lead.findMany).not.toHaveBeenCalled();
  });
  it("filtro de outro vendedor é interseção, preservando carteira obrigatória", async () => {
    await listarLeads(u(Papel.VENDEDOR), { vendedorId: "outro" });
    expect(db.lead.findMany.mock.calls[0][0].where.AND).toEqual([{ vendedorDonoId: { in: ["vendedor"] } }, { vendedorDonoId: "outro" }]);
  });
  it("gerente sem equipe não ganha escopo global", async () => {
    await listarLeads(u(Papel.GERENTE_COMERCIAL));
    expect(db.lead.findMany.mock.calls[0][0].where.AND[0]).toEqual({ id: "__sem_acesso__" });
  });
  it("vendedor perde projeção documental administrativa após assunção", async () => {
    const res = await obterLead("lead", u(Papel.VENDEDOR));
    expect(res?.lead.documentos).toEqual([{ categoria: "PROPOSTA", url: "proposta" }]);
  });
  it("vendedor também secretaria conserva documento pelo papel cadastral", async () => {
    expect((await obterLead("lead", u(Papel.VENDEDOR, Papel.SECRETARIA_ACADEMICA)))?.lead.documentos).toHaveLength(3);
  });
});
