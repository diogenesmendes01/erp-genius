import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const db = vi.hoisted(() => ({ lead: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), groupBy: vi.fn() }, evento: { groupBy: vi.fn(), findMany: vi.fn() }, coberturaCarteira: { findMany: vi.fn() }, usuario: { findMany: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
import { LEADS_POR_COLUNA_FUNIL, listarLeads, listarLeadsFunil, listarLeadsPagina, obterLead } from "./consultas";
import { LEADS_POR_PAGINA, lerFiltrosLeads } from "./filtros";
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

describe("lista de /leads paginada (E4)", () => {
  it("página e contagem filtrada somam escopo E filtros; total da carteira só o escopo", async () => {
    db.lead.count.mockImplementation(async ({ where }: { where: { AND?: unknown } }) => (where.AND ? 3 : 9));
    const r = await listarLeadsPagina(u(Papel.VENDEDOR), lerFiltrosLeads({ etapa: "NOVO", pagina: "2" }));
    const escopo = { vendedorDonoId: { in: ["vendedor"] } };
    const consulta = db.lead.findMany.mock.calls[0][0];
    expect(consulta.where).toEqual({ AND: [escopo, { etapa: "NOVO" }] });
    expect(consulta).toMatchObject({ skip: LEADS_POR_PAGINA, take: LEADS_POR_PAGINA, orderBy: [{ criadoEm: "desc" }, { id: "desc" }] });
    const contagens = db.lead.count.mock.calls.map((c) => c[0].where);
    expect(contagens).toHaveLength(2);
    expect(contagens).toEqual(expect.arrayContaining([{ AND: [escopo, { etapa: "NOVO" }] }, escopo]));
    expect(r).toMatchObject({ total: 3, totalBase: 9 });
  });

  it("papel sem carteira comercial: nada consultado", async () => {
    expect(await listarLeadsPagina(u(Papel.PROFESSOR), lerFiltrosLeads({}))).toEqual({ itens: [], total: 0, totalBase: 0 });
    expect(db.lead.count).not.toHaveBeenCalled();
  });
});

describe("funil do /pipeline com teto por coluna (docs/43 §6 item 9)", () => {
  const escopo = { vendedorDonoId: { in: ["vendedor"] } };
  const lead = (id: string, etapa: string, b2b: boolean) => ({ id, etapa, b2b, criadoEm: new Date("2026-09-01T00:00:00Z"), pais: null, vendedor: null });

  it("um groupBy dá o total de cada coluna; cada coluna com lead lê no máximo o teto, dentro do escopo, mais recentes primeiro", async () => {
    db.lead.groupBy.mockResolvedValue([
      { etapa: "NOVO", b2b: false, _count: { _all: 120 } },
      { etapa: "NOVO", b2b: true, _count: { _all: 3 } },
      { etapa: "PERDIDO", b2b: false, _count: { _all: 0 } },
    ]);
    db.lead.findMany.mockImplementation(async ({ where }: { where: { AND: [unknown, { etapa: string; b2b: boolean }] } }) =>
      [lead(`${where.AND[1].etapa}-${where.AND[1].b2b}`, where.AND[1].etapa, where.AND[1].b2b)]);
    db.evento.groupBy.mockResolvedValue([]);
    const r = await listarLeadsFunil(u(Papel.VENDEDOR));
    expect(db.lead.groupBy).toHaveBeenCalledWith({ by: ["etapa", "b2b"], where: escopo, _count: { _all: true } });
    const consultas = db.lead.findMany.mock.calls.map((c) => c[0]);
    // A coluna sem lead (PERDIDO, 0) não é lida.
    expect(consultas.map((c) => c.where)).toEqual([
      { AND: [escopo, { b2b: false, etapa: "NOVO" }] },
      { AND: [escopo, { b2b: true, etapa: "NOVO" }] },
    ]);
    for (const c of consultas) expect(c).toMatchObject({ take: LEADS_POR_COLUNA_FUNIL, orderBy: [{ criadoEm: "desc" }, { id: "desc" }] });
    expect(r.totais).toEqual([
      { etapa: "NOVO", b2b: false, total: 120 },
      { etapa: "NOVO", b2b: true, total: 3 },
      { etapa: "PERDIDO", b2b: false, total: 0 },
    ]);
    expect(r.leads.map((l) => l.id)).toEqual(["NOVO-false", "NOVO-true"]);
    // As projeções de eventos rodam uma vez sobre todos os cartões (não por coluna).
    expect(db.evento.groupBy).toHaveBeenCalledTimes(2);
    expect(db.evento.groupBy.mock.calls[0][0].where.agregadoId).toEqual({ in: ["NOVO-false", "NOVO-true"] });
  });

  it("papel sem carteira comercial: nada consultado", async () => {
    expect(await listarLeadsFunil(u(Papel.PROFESSOR))).toEqual({ leads: [], totais: [] });
    expect(db.lead.groupBy).not.toHaveBeenCalled();
    expect(db.lead.findMany).not.toHaveBeenCalled();
  });
});
