import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { whereBuscaMatriculas } from "@/server/secretaria/busca-matriculas";

const mocks = vi.hoisted(() => ({
  sessao: vi.fn(async () => ({ id: "sec", nome: "S", papeis: ["SECRETARIA_ACADEMICA"] })),
  findMany: vi.fn(async () => [] as unknown[]),
  count: vi.fn(async () => 0),
  redirect: vi.fn((d: string) => { throw new Error(`REDIRECT ${d}`); }),
}));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/_shared/escopo-comercial", () => ({ escopoComercialAtual: async () => ({ vendedorDonoId: { in: ["v1"] } }) }));
vi.mock("@/lib/prisma", () => ({ prisma: { matricula: { findMany: mocks.findMany, count: mocks.count } } }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("./SecretariaPainel", () => ({ SecretariaPainel: () => null }));
vi.mock("./CondicoesEncerramentoLista", () => ({ CondicoesEncerramentoLista: () => null }));

import Page from "./page";

const render = async (params: Record<string, string>) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));

describe("/secretaria — busca e páginas (E4)", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.count.mockResolvedValue(0); mocks.findMany.mockResolvedValue([]); });

  it("guard de sessão antes de qualquer consulta", async () => {
    mocks.sessao.mockRejectedValueOnce(new Error("negado"));
    await expect(render({ busca: "ana" })).rejects.toThrow("negado");
    expect(mocks.count).not.toHaveBeenCalled();
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("link direto (matriculaId): avisa e oferece ver todas; busca nova não carrega o id escondido", async () => {
    mocks.count.mockResolvedValue(1);
    const html = await render({ matriculaId: "m1" });
    expect(html).toContain("Mostrando a matrícula do link direto.");
    expect(html).not.toContain('name="matriculaId"');
    expect((mocks.count.mock.calls[0] as unknown as [{ where: { AND: { id?: string }[] } }])[0].where.AND[0]).toMatchObject({ id: "m1" });
  });

  it("busca por palavras no aluno ou no código", () => {
    expect(whereBuscaMatriculas("ana M-12")).toEqual({
      AND: [
        { OR: [{ codigo: { contains: "ana", mode: "insensitive" } }, { aluno: { OR: [{ primeiroNome: { contains: "ana", mode: "insensitive" } }, { sobrenome: { contains: "ana", mode: "insensitive" } }] } }] },
        { OR: [{ codigo: { contains: "M-12", mode: "insensitive" } }, { aluno: { OR: [{ primeiroNome: { contains: "M-12", mode: "insensitive" } }, { sobrenome: { contains: "M-12", mode: "insensitive" } }] } }] },
      ],
    });
    expect(whereBuscaMatriculas("  ")).toEqual({});
  });

  it("formulário GET de busca; página e busca chegam à consulta; contador e paginação", async () => {
    mocks.count.mockResolvedValue(90);
    mocks.findMany.mockResolvedValue(Array.from({ length: 40 }, (_, i) => ({ id: `m${i}`, codigo: null, leadId: null, alunoId: null, status: "ATIVA", secretariaAssumiuEm: null, confirmacaoContratoEm: null, referenciaCobertura: null, preparacaoComercial: null, cobrancas: [], aluno: { primeiroNome: "A", sobrenome: null }, documentos: [], lead: null, solicitacoesCorrecao: [] })));
    const html = await render({ busca: "ana", pagina: "2" });
    expect(html).toMatch(/<form method="get" action="\/secretaria" role="search"/);
    expect(html).toContain('value="ana"');
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 40, take: 40, orderBy: [{ criadoEm: "desc" }, { id: "desc" }] }));
    expect(html).toContain("41–80 de 90 matrículas para “ana”");
    expect(html).toContain('href="/secretaria?busca=ana"');
    expect(html).toContain('href="/secretaria?busca=ana&amp;pagina=3"');
  });

  it("escopo comercial em AND com a busca para quem não é secretaria", async () => {
    mocks.sessao.mockResolvedValueOnce({ id: "v1", nome: "V", papeis: ["VENDEDOR"] });
    await render({ busca: "ana" });
    const where = (mocks.count.mock.calls[0] as unknown as [{ where: { AND: unknown[] } }])[0].where;
    expect(where.AND[0]).toEqual({ lead: { is: { vendedorDonoId: { in: ["v1"] } } } });
    expect(where.AND[1]).toEqual(whereBuscaMatriculas("ana"));
  });

  it("página além do fim volta à última, mantendo a busca; sem resultado diz o termo", async () => {
    mocks.count.mockResolvedValue(41);
    await expect(render({ busca: "ana", pagina: "7" })).rejects.toThrow("REDIRECT /secretaria?busca=ana&pagina=2");
    mocks.count.mockResolvedValue(0);
    expect(await render({ busca: "zé" })).toContain("Nenhuma matrícula para “zé”.");
  });
});
