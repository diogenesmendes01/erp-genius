import { beforeEach, describe, expect, it, vi } from "vitest";

// Unitário da exportação filtrada (E4). O comportamento com banco real está em route.int.test.ts.
const mocks = vi.hoisted(() => {
  class ErroAutenticacao extends Error {}
  class ErroPermissao extends Error {}
  return {
    ErroAutenticacao, ErroPermissao,
    usuario: { id: "u1", nome: "U", papeis: ["SECRETARIA_ACADEMICA"] },
    listarAlunos: vi.fn(async () => [{ id: "a1", codigo: "A-1", nome: "Ana Silva", status: "ATIVO", pais: "Costa Rica", turmas: [], financeiro: null }]),
    registrarEvento: vi.fn(async () => undefined),
    listarLeads: vi.fn(async () => [] as unknown[]),
    contarLeads: vi.fn(async () => 0),
  };
});
vi.mock("@/server/_shared", () => ({
  exigirSessao: async () => mocks.usuario,
  ErroAutenticacao: mocks.ErroAutenticacao,
  ErroPermissao: mocks.ErroPermissao,
  registrarEvento: mocks.registrarEvento,
}));
vi.mock("@/server/_shared/capacidades", () => ({ exigirCapacidade: async () => undefined }));
vi.mock("@/server/_shared/escopo-comercial", () => ({ escopoComercialAtual: async () => ({}) }));
vi.mock("@/server/alunos/consultas", () => ({ listarAlunos: mocks.listarAlunos }));
vi.mock("@/server/comercial/consultas", () => ({ listarLeads: mocks.listarLeads }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: async (f: (tx: unknown) => unknown) => f({}), lead: { count: mocks.contarLeads } } }));

import ExcelJS from "exceljs";
import { GET } from "./route";

/** Linhas da planilha gerada (cabeçalho incluso), como texto. */
async function linhas(res: Response) {
  const livro = new ExcelJS.Workbook();
  await livro.xlsx.load(await res.arrayBuffer());
  const out: string[][] = [];
  livro.worksheets[0].eachRow((row) => out.push((row.values as unknown[]).slice(1).map((v) => String(v ?? ""))));
  return out;
}

describe("planilha com rótulos, não enums crus (E5)", () => {
  it("alunos: situação rotulada (\"Ativo\", não \"ATIVO\")", async () => {
    const res = await GET(new Request("http://localhost/api/exportacoes/alunos"), { params: Promise.resolve({ tipo: "alunos" }) });
    expect(res.status).toBe(200);
    expect((await linhas(res))[1]).toEqual(["A-1", "Ana Silva", "Ativo", "Costa Rica", ""]);
  });

  it("leads: segmento, etapa e temperatura rotulados (\"Adulto\", \"Novo\", \"Morno\")", async () => {
    mocks.listarLeads.mockResolvedValueOnce([{ id: "l1", codigo: "L-1", nome: "Ana", b2b: false, segmento: "ADULTO", etapa: "NOVO", temperatura: "MORNO", pais: { nome: "Costa Rica" }, vendedor: { nome: "Bia" } }]);
    mocks.contarLeads.mockResolvedValueOnce(1); // a linha continua na carteira na conferência final
    const res = await GET(new Request("http://localhost/api/exportacoes/leads"), { params: Promise.resolve({ tipo: "leads" }) });
    expect(res.status).toBe(200);
    expect((await linhas(res))[1]).toEqual(["L-1", "Ana", "PF", "Adulto", "Novo", "Morno", "Costa Rica", "Bia"]);
  });
});

const exportar = (query: string) => GET(new Request(`http://localhost/api/exportacoes/alunos${query}`), { params: Promise.resolve({ tipo: "alunos" }) });

describe("exportação de alunos com os filtros da tela", () => {
  beforeEach(() => { mocks.listarAlunos.mockClear(); mocks.registrarEvento.mockClear(); });

  it("?status=ATIVO: os mesmos filtros vão para a projeção exportada E para a assinatura de conferência", async () => {
    const res = await exportar("?status=ATIVO&busca=ana");
    expect(res.status).toBe(200);
    expect(mocks.listarAlunos).toHaveBeenCalledTimes(2);
    for (const [, filtros] of mocks.listarAlunos.mock.calls as unknown as [unknown, Record<string, unknown>][]) {
      expect(filtros).toEqual({ busca: "ana", status: "ATIVO", paisId: null, turmaId: null, pagina: 1 });
    }
  });

  it("recorte inteiro (sem paginação) e chaves estranhas ignoradas", async () => {
    await exportar("?status=ATIVO&pagina=7&colunas=cpf,telefone&ids=x");
    const filtros = (mocks.listarAlunos.mock.calls[0] as unknown as [unknown, Record<string, unknown>, unknown])[1];
    expect(filtros).toMatchObject({ status: "ATIVO", pagina: 1 });
    expect((mocks.listarAlunos.mock.calls[0] as unknown[])[2]).toBeUndefined(); // sem skip/take
  });

  it("evento de auditoria registra só os filtros preenchidos", async () => {
    await exportar("?status=ATIVO");
    const payload = ((mocks.registrarEvento.mock.calls[0] as unknown[])[1] as { payload: Record<string, unknown> }).payload;
    expect(payload).toMatchObject({ conjunto: "alunos", filtros: { status: "ATIVO" } });
  });

  it("LGPD: a trilha registra que houve busca e o tamanho dela, nunca o texto digitado", async () => {
    await exportar("?status=ATIVO&busca=ana.souza%40email.com");
    const payload = ((mocks.registrarEvento.mock.calls[0] as unknown[])[1] as { payload: Record<string, unknown> }).payload;
    expect(payload).toMatchObject({ filtros: { status: "ATIVO", busca: { aplicada: true, caracteres: "ana.souza@email.com".length } } });
    expect(JSON.stringify(payload)).not.toContain("ana.souza");
    // A busca continua valendo para o recorte exportado — só a trilha não guarda o conteúdo.
    expect((mocks.listarAlunos.mock.calls[0] as unknown as [unknown, Record<string, unknown>])[1]).toMatchObject({ busca: "ana.souza@email.com" });
  });

  it("sem filtros na URL: comportamento de antes (filtros vazios no evento)", async () => {
    await exportar("");
    const payload = ((mocks.registrarEvento.mock.calls[0] as unknown[])[1] as { payload: Record<string, unknown> }).payload;
    expect(payload).toMatchObject({ filtros: {} });
  });
});

const exportarLeads = (query: string) => GET(new Request(`http://localhost/api/exportacoes/leads${query}`), { params: Promise.resolve({ tipo: "leads" }) });

describe("exportação de leads com os filtros da tela", () => {
  beforeEach(() => { mocks.listarLeads.mockClear(); mocks.registrarEvento.mockClear(); });

  it("os filtros da URL vão para a consulta, inteira (sem paginação); chaves estranhas ignoradas", async () => {
    const res = await exportarLeads("?etapa=NOVO&tipo=b2b&busca=ana&pagina=4&vendedorId=x&colunas=telefoneE164");
    expect(res.status).toBe(200);
    const [, filtros, pagina] = mocks.listarLeads.mock.calls[0] as unknown as [unknown, Record<string, unknown>, unknown];
    expect(filtros).toEqual({ busca: "ana", b2b: true, etapa: "NOVO" });
    expect(pagina).toBeUndefined();
  });

  it("colunas iguais às da tabela (sem telefone) e filtros no evento de auditoria", async () => {
    mocks.listarLeads.mockResolvedValueOnce([{ id: "l1", codigo: "L-1", nome: "Ana", b2b: true, segmento: "ADULTO", etapa: "NOVO", temperatura: "MORNO", pais: { nome: "Costa Rica" }, vendedor: { nome: "Bia" }, telefoneE164: "+50688887777" }]);
    mocks.contarLeads.mockResolvedValueOnce(1); // a linha continua na carteira na conferência final
    await exportarLeads("?temperatura=MORNO");
    const payload = ((mocks.registrarEvento.mock.calls[0] as unknown[])[1] as { payload: Record<string, unknown> }).payload;
    expect(payload).toMatchObject({ conjunto: "leads", colunas: ["Código", "Nome", "Tipo", "Segmento", "Etapa", "Temperatura", "País", "Dono"], filtros: { temperatura: "MORNO" } });
  });

  it("LGPD: busca de leads entra na trilha só como tamanho, sem o texto (um telefone, por exemplo)", async () => {
    await exportarLeads("?busca=%2B50688887777");
    const payload = ((mocks.registrarEvento.mock.calls[0] as unknown[])[1] as { payload: Record<string, unknown> }).payload;
    expect(payload).toMatchObject({ conjunto: "leads", filtros: { busca: { aplicada: true, caracteres: "+50688887777".length } } });
    expect(JSON.stringify(payload)).not.toContain("88887777");
  });
});
