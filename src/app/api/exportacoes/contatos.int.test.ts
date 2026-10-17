import { beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared/sessao", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/_shared/sessao")>();
  const sessao = async () => {
    const id = (await authMock())?.user?.id;
    const u = id && await prisma.usuario.findUnique({ where: { id }, select: { id: true, nome: true, ativo: true, papeis: true } });
    if (!u?.ativo) throw new original.ErroAutenticacao();
    return u;
  };
  return { ...original, exigirSessao: sessao };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { COLUNAS_EXPORTACAO_CONTATOS } from "@/server/crm/planilha";
import { GET } from "./[tipo]/route";

let vendedor: Awaited<ReturnType<typeof criarUsuario>>;
const logadoComo = (id: string) => authMock.mockResolvedValue({ user: { id } });
const req = (caminho: string) => new Request(`http://localhost${caminho}`);
const params = (tipo: string) => ({ params: Promise.resolve({ tipo }) });
const concederCapacidade = (id: string, c: "dados.exportar_contatos") =>
  prisma.usuario.update({ where: { id }, data: { permissoes: [c] } });
async function lerXlsx(res: Response) {
  const livro = new ExcelJS.Workbook();
  await livro.xlsx.load(await res.arrayBuffer());
  const linhas: string[][] = [];
  livro.worksheets[0].eachRow((l) => linhas.push((l.values as string[]).slice(1).map((v) => String(v ?? ""))));
  return { cabecalho: linhas[0], linhas: linhas.slice(1) };
}

beforeEach(async () => {
  await truncarBanco();
  vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  const ana = await prisma.pessoa.create({ data: { codigo: "P-000001", nome: "=Ana Souza", email: "ana@exemplo.test", cidade: "Recife", origemCanal: "SITE" } });
  await prisma.contatoWhatsApp.create({ data: { pessoaId: ana.id, telefoneE164: "+5511999999999" } });
  await prisma.oportunidade.create({ data: { nome: "Ana", vendedorDonoId: vendedor.id, pessoaId: ana.id } });
  const alheia = await prisma.pessoa.create({ data: { nome: "Ana Alheia" } });
  const outro = await criarUsuario([Papel.VENDEDOR], "Outro");
  await prisma.oportunidade.create({ data: { nome: "Alheia", vendedorDonoId: outro.id, pessoaId: alheia.id } });
});

describe("exportação de contatos", () => {
  it("sem capacidade: 403; com capacidade: sem telefone/e-mail e com DadosExportados sem o texto da busca", async () => {
    logadoComo(vendedor.id);
    expect((await GET(req("/api/exportacoes/contatos?busca=ana"), params("contatos"))).status).toBe(403);
    expect(await prisma.evento.count({ where: { tipo: "DadosExportados" } })).toBe(0);
    await concederCapacidade(vendedor.id, "dados.exportar_contatos");
    const res = await GET(req("/api/exportacoes/contatos?busca=ana"), params("contatos"));
    expect(res.status).toBe(200);
    const planilha = await lerXlsx(res);
    expect(planilha.cabecalho).toEqual([...COLUNAS_EXPORTACAO_CONTATOS]);
    expect(planilha.linhas).toEqual([["P-000001", "'=Ana Souza", "Pessoa", "Recife", "Site", "", "Novo", vendedor.nome]]);
    expect(JSON.stringify(planilha.linhas)).not.toMatch(/\+55|@/);
    const ev = await prisma.evento.findFirstOrThrow({ where: { tipo: "DadosExportados" }, orderBy: { criadoEm: "desc" } });
    expect(ev.payload).toMatchObject({ conjunto: "contatos", quantidade: 1, filtros: { busca: { aplicada: true, caracteres: 3 } } });
    expect(JSON.stringify(ev.payload)).not.toMatch(/"ana"|Souza/);
  });
});
