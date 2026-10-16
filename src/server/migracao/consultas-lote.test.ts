import { beforeEach, describe, expect, it, vi } from "vitest";

// Detalhe do lote de migração com as linhas paginadas (docs/42 L2483; docs/43 §6 item 9). Sem banco: o Prisma é
// mockado e o teste confere os argumentos da leitura das linhas (`skip`/`take`/`orderBy`) e que as correspondências
// de vínculo só são lidas para as linhas da página.

const m = vi.hoisted(() => ({
  sessao: vi.fn(),
  queryRaw: vi.fn(),
  lote: vi.fn(),
  eventos: vi.fn(),
  ofertas: vi.fn(),
  turmas: vi.fn(),
  produto: vi.fn(),
  turma: vi.fn(),
  status: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: async (f: (tx: object) => unknown) => f({
      $queryRaw: m.queryRaw,
      lotePreparacaoMigracao: { findUnique: m.lote },
      evento: { findMany: m.eventos },
      produtoPais: { findMany: m.ofertas },
      turma: { findMany: m.turmas },
      correspondenciaProdutoMigracao: { findMany: m.produto },
      correspondenciaTurmaMigracao: { findMany: m.turma },
      correspondenciaStatusMatriculaMigracao: { findMany: m.status },
    }),
  },
}));
vi.mock("@/server/_shared", async (original) => {
  const real = await original<typeof import("@/server/_shared")>();
  return { ...real, exigirSessaoComPapel: m.sessao };
});

import { consultarLotePreparacaoMigracao } from "./consultas";

const linha = (n: number, tipoEntrada = "VINCULO_MATRICULA") => ({
  id: `linha-${n}`, linhaOrigem: `vinculos!${n}`, tipoEntrada, alunoOrigemId: `a-${n}`, turmaOrigemId: `t-${n}`, matriculaOrigemId: `m-${n}`,
  financeiroOrigemId: null, dadosOrigem: { matricula: { produtoOrigem: `p-${n}`, situacao: "ATIVA" } }, entradaHash: `h-${n}`, estado: "PREPARADO",
  aplicacoesCadastro: [], ensaiosVinculo: [], pendencias: [], colisoesComoConflitante: [], colisoesComoExistente: [],
});
const lote = (linhas: ReturnType<typeof linha>[], total: number) => ({
  id: "lote-1", origem: "OPERACIONAL", chaveLote: "arquivo", estado: "PREPARADO", criadoEm: new Date("2026-09-16T00:00:00Z"),
  preparadoPor: { nome: "Admin" }, _count: { linhas: total }, conflitosEntrada: [], linhas,
});
/** Os argumentos da leitura das linhas (o `select.linhas` do findUnique do lote). */
const leituraDasLinhas = () => (m.lote.mock.calls.at(-1)![0] as { select: { linhas: { skip: number; take: number; orderBy: unknown } } }).select.linhas;

beforeEach(() => {
  vi.resetAllMocks();
  m.sessao.mockResolvedValue({ id: "admin", papeis: ["ADMINISTRADOR"] });
  m.queryRaw.mockResolvedValue([{ ativo: true, papeis: ["ADMINISTRADOR"] }]);
  for (const f of [m.eventos, m.ofertas, m.turmas, m.produto, m.turma, m.status]) f.mockResolvedValue([]);
});

describe("consultarLotePreparacaoMigracao — linhas paginadas (item 9)", () => {
  it("primeira página: 25 linhas lidas com uma a mais, ordem que termina no id, e a contagem do lote", async () => {
    m.lote.mockResolvedValue(lote(Array.from({ length: 26 }, (_, i) => linha(i)), 95));
    const r = await consultarLotePreparacaoMigracao("lote-1");
    expect(leituraDasLinhas()).toMatchObject({ skip: 0, take: 26, orderBy: [{ linhaOrigem: "asc" }, { id: "asc" }] });
    expect((m.lote.mock.calls[0][0] as { select: { _count: unknown } }).select._count).toEqual({ select: { linhas: true } });
    if (!r.ok || !r.dado) throw new Error("lote ausente");
    expect(r.dado.linhas).toHaveLength(25);
    expect(r.dado).toMatchObject({ pagina: 1, porPagina: 25, temProxima: true, totalLinhas: 95 });
    expect(r.dado).not.toHaveProperty("_count");
  });

  it("página 4 de um lote de 95: pula 75, a última não tem próxima", async () => {
    m.lote.mockResolvedValue(lote(Array.from({ length: 20 }, (_, i) => linha(75 + i)), 95));
    const r = await consultarLotePreparacaoMigracao("lote-1", { pagina: 4 });
    expect(leituraDasLinhas()).toMatchObject({ skip: 75, take: 26 });
    if (!r.ok || !r.dado) throw new Error("lote ausente");
    expect(r.dado).toMatchObject({ pagina: 4, temProxima: false });
    expect(r.dado.linhas.map((l) => l.id)[0]).toBe("linha-75");
  });

  it("as correspondências de vínculo são lidas só para as linhas da página (não para a linha a mais)", async () => {
    m.lote.mockResolvedValue(lote([...Array.from({ length: 25 }, (_, i) => linha(i)), linha(25)], 95));
    await consultarLotePreparacaoMigracao("lote-1");
    const produtos = (m.produto.mock.calls[0][0] as { where: { produtoOrigemId: { in: string[] } } }).where.produtoOrigemId.in;
    const turmas = (m.turma.mock.calls[0][0] as { where: { turmaOrigemId: { in: string[] } } }).where.turmaOrigemId.in;
    expect(produtos).toHaveLength(25);
    expect(produtos).not.toContain("p-25");
    expect(turmas).not.toContain("t-25");
  });

  it("página inválida é recusada sem ler o lote", async () => {
    for (const pagina of [0, -1, 1.5, 100001]) {
      await expect(consultarLotePreparacaoMigracao("lote-1", { pagina })).resolves.toMatchObject({ ok: false });
    }
    await expect(consultarLotePreparacaoMigracao("lote-1", { pagina: 2, extra: 1 } as never)).resolves.toMatchObject({ ok: false });
    expect(m.lote).not.toHaveBeenCalled();
  });

  it("lote inexistente: null", async () => {
    m.lote.mockResolvedValue(null);
    await expect(consultarLotePreparacaoMigracao("nao-existe")).resolves.toMatchObject({ ok: true, dado: null });
  });
});
