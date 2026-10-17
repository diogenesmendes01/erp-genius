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
import { criarAlunoMinimo, criarUsuario, truncarBanco } from "@/test/integracao";
import { POST } from "./route";

let gerente: Awaited<ReturnType<typeof criarUsuario>>;
let vendedor: Awaited<ReturnType<typeof criarUsuario>>;
let alunoExistente: string;
const logadoComo = (id: string) => authMock.mockResolvedValue({ user: { id } });

async function xlsx(linhas: string[][]): Promise<File> {
  const livro = new ExcelJS.Workbook();
  const folha = livro.addWorksheet("Contatos");
  folha.addRow(["Nome", "WhatsApp", "E-mail", "Cidade", "Origem", "Tag"]);
  for (const l of linhas) folha.addRow(l);
  return new File([await livro.xlsx.writeBuffer()], "contatos.xlsx");
}
const form = (arquivo: File, modo: string, extra: Record<string, string> = {}) => {
  const f = new FormData();
  f.set("arquivo", arquivo);
  f.set("modo", modo);
  for (const [k, v] of Object.entries(extra)) f.set(k, v);
  return new Request("http://localhost/api/contatos/importar", { method: "POST", body: f });
};
const planilha = () => xlsx([
  ["Ana Nova", "11 98888-7777", "ana@x.test", "Recife", "Indicação", "Feira"],
  ["Bia Nova", "11 97777-6666", "", "", "", ""],
  ["Carlos Existente", "11 96666-5555", "carlos@x.test", "Olinda", "Site", ""],
  ["", "1", "", "", "", ""],
]);

beforeEach(async () => {
  await truncarBanco();
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  await prisma.usuario.update({ where: { id: vendedor.id }, data: { gerenteComercialId: gerente.id } });
  const pessoa = await prisma.pessoa.create({ data: { nome: "Carlos Existente" } });
  await prisma.contatoWhatsApp.create({ data: { pessoaId: pessoa.id, telefoneE164: "+5511966665555" } });
  const aluno = await criarAlunoMinimo({ email: "original@x.test", telefoneE164: "+5511966665555", pessoaId: pessoa.id });
  alunoExistente = aluno.id;
});

describe("POST /api/contatos/importar", () => {
  it("prévia não grava; aplicar completa vazios, não altera aluno e grava ContatosImportados sem conteúdo", async () => {
    logadoComo(gerente.id);
    const previa = await (await POST(form(await planilha(), "previa"))).json();
    expect(previa).toMatchObject({ validas: 3, novos: 2, existentes: 1, invalidas: [{ linha: 5, motivo: "Informe o nome." }] });
    expect(await prisma.pessoa.count()).toBe(1);
    expect(await prisma.evento.count({ where: { tipo: "ContatosImportados" } })).toBe(0);

    const res = await POST(form(await planilha(), "aplicar", { donoId: vendedor.id }));
    expect(res.status).toBe(200);
    expect((await prisma.aluno.findUniqueOrThrow({ where: { id: alunoExistente } })).email).toBe("original@x.test");
    const carlos = await prisma.pessoa.findFirstOrThrow({ where: { nome: "Carlos Existente" } });
    expect(carlos).toMatchObject({ email: "carlos@x.test", cidade: "Olinda", origemCanal: "SITE" });
    expect(await prisma.oportunidade.count({ where: { vendedorDonoId: vendedor.id, etapa: "NOVO" } })).toBe(2);
    const ev = await prisma.evento.findFirstOrThrow({ where: { tipo: "ContatosImportados" } });
    expect(ev.payload).toEqual({ novos: 2, atualizados: 1, invalidos: 1, comOportunidade: 2 });
    expect(JSON.stringify(ev.payload)).not.toMatch(/Ana|\+55|@/);
    const ana = await prisma.pessoa.findFirstOrThrow({ where: { nome: "Ana Nova" }, include: { tags: { include: { tag: true } } } });
    expect(ana.origemCanal).toBe("INDICACAO");
    expect(ana.tags.map((t) => t.tag.nome)).toEqual(["Feira"]);
  });

  it("sem donoId não cria oportunidade; reaplicar não duplica", async () => {
    logadoComo(gerente.id);
    await POST(form(await planilha(), "aplicar"));
    expect(await prisma.oportunidade.count()).toBe(0);
    await POST(form(await planilha(), "aplicar"));
    expect(await prisma.pessoa.count()).toBe(3);
  });

  it("importação guarda texto literal de célula com =", async () => {
    logadoComo(gerente.id);
    await POST(form(await xlsx([["=HYPERLINK(1)", "11 95555-4444", "", "", "", ""]]), "aplicar"));
    expect((await prisma.pessoa.findFirstOrThrow({ orderBy: { criadoEm: "desc" } })).nome).toBe("=HYPERLINK(1)");
  });

  it("pessoa de outra equipe conta como existente e não é tocada", async () => {
    const outroGerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Outro gerente");
    const outroVendedor = await criarUsuario([Papel.VENDEDOR], "Outro vendedor");
    await prisma.usuario.update({ where: { id: outroVendedor.id }, data: { gerenteComercialId: outroGerente.id } });
    const alheia = await prisma.pessoa.create({ data: { nome: "Dora Alheia" } });
    await prisma.contatoWhatsApp.create({ data: { pessoaId: alheia.id, telefoneE164: "+5511944443333" } });
    await prisma.oportunidade.create({ data: { nome: "Dora Alheia", pessoaId: alheia.id, vendedorDonoId: outroVendedor.id } });

    logadoComo(gerente.id);
    const res = await POST(form(await xlsx([["Dora", "11 94444-3333", "dora@x.test", "Natal", "Site", "Feira"]]), "aplicar"));
    expect(await res.json()).toMatchObject({ novos: 0, atualizados: 1, invalidos: 0 });
    expect(await prisma.pessoa.findUniqueOrThrow({ where: { id: alheia.id } }))
      .toMatchObject({ nome: "Dora Alheia", email: null, cidade: null, origemCanal: null });
    expect(await prisma.pessoaTag.count({ where: { pessoaId: alheia.id } })).toBe(0);
    expect(await prisma.evento.count({ where: { agregadoTipo: "Pessoa", agregadoId: alheia.id } })).toBe(0);
  });

  it("exige contatos.importar e dono da própria equipe", async () => {
    logadoComo(vendedor.id);
    expect((await POST(form(await planilha(), "aplicar"))).status).toBe(403);
    const outroGerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Outro gerente");
    logadoComo(outroGerente.id);
    expect((await POST(form(await planilha(), "aplicar", { donoId: vendedor.id }))).status).toBe(403);
    expect(await prisma.pessoa.count()).toBe(1);
  });
});
