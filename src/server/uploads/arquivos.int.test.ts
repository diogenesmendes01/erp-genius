import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CategoriaDocumento, Papel } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { prisma } from "@/lib/prisma";
import { resolverCaminhoUpload, UPLOAD_DIR } from "@/lib/uploads";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { exigirSessao } from "@/server/_shared/sessao";
import { POST as enviarArquivo } from "@/app/api/upload/route";
import { GET as baixarArquivo } from "@/app/api/files/[...path]/route";
import { exigirArquivoVinculavel } from "./autorizacao";

const arquivosCriados = new Set<string>();
const como = (u: { id: string; papeis: Papel[] }) => authMock.mockResolvedValue({ user: { id: u.id, papeis: u.papeis } });

function requisicaoUpload(contexto: { leadId?: string; matriculaId?: string; categoriaDocumento?: CategoriaDocumento } = {}) {
  const form = new FormData();
  form.append("file", new File(["%PDF-1.7\nCONTEUDO_PRIVADO_DO_ARQUIVO"], "documento.pdf", { type: "application/pdf" }));
  for (const [chave, valor] of Object.entries(contexto)) if (valor) form.append(chave, valor);
  return new Request("http://localhost/api/upload", { method: "POST", body: form });
}

async function upload(contexto: Parameters<typeof requisicaoUpload>[0] = {}) {
  const resposta = await enviarArquivo(requisicaoUpload(contexto));
  expect(resposta.status).toBe(200);
  const body = await resposta.json() as { url: string };
  const arquivo = resolverCaminhoUpload([body.url.split("/").at(-1)!]);
  if (!arquivo) throw new Error("URL de upload inesperada.");
  arquivosCriados.add(arquivo);
  return body.url;
}

function download(url: string) {
  return baixarArquivo(new Request(`http://localhost${url}`), { params: Promise.resolve({ path: [url.split("/").at(-1)!] }) });
}

async function arquivoLegado() {
  const nome = `${randomUUID()}.pdf`;
  const arquivo = resolverCaminhoUpload([nome]);
  if (!arquivo) throw new Error("Caminho de teste inválido.");
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(arquivo, "%PDF-1.7\nCONTEUDO_PRIVADO_DO_ARQUIVO", { flag: "wx" });
  arquivosCriados.add(arquivo);
  return `/api/files/${nome}`;
}

async function cenario() {
  const cat = await seedCatalogoMinimo();
  const secretaria = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria");
  const financeiro = await criarUsuario([Papel.FINANCEIRO], "Financeiro");
  const professor = await criarUsuario([Papel.PROFESSOR], "Professor");
  const pedagogico = await criarUsuario([Papel.GERENTE_PEDAGOGICO], "Gestão pedagógica");
  const vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  const admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  const lead = await prisma.lead.create({ data: { nome: "Lead", vendedorDonoId: vendedor.id, professorExperimentalId: professor.id } });
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Ana", sobrenome: "Santos", paisId: cat.pais.id } });
  const matricula = await prisma.matricula.create({ data: {
    alunoId: aluno.id, leadId: lead.id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "CRC",
    secretariaAssumiuEm: new Date(), secretariaResponsavelId: secretaria.id,
  } });
  const outraMatricula = await prisma.matricula.create({ data: {
    alunoId: aluno.id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "CRC",
    secretariaAssumiuEm: new Date(), secretariaResponsavelId: secretaria.id,
  } });
  const cobranca = await prisma.cobranca.create({ data: {
    matriculaId: matricula.id, tipo: "MENSALIDADE", moeda: "CRC", valorOriginal: 85000,
    valorNegociado: 85000, vencimento: new Date(),
  } });
  return { secretaria, financeiro, professor, pedagogico, vendedor, admin, lead, aluno, matricula, outraMatricula, cobranca };
}

async function anexarNaMatricula(url: string, matriculaId: string, categoria: CategoriaDocumento) {
  const usuario = await exigirSessao();
  return prisma.$transaction(async (tx) => {
    await exigirArquivoVinculavel(usuario, url, { matriculaId, categoriaDocumento: categoria }, tx);
    return tx.documento.create({ data: { matriculaId, categoria, url, nome: "Documento da matrícula" } });
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  await truncarBanco();
});

afterEach(async () => {
  for (const arquivo of arquivosCriados) await unlink(arquivo).catch((erro: NodeJS.ErrnoException) => { if (erro.code !== "ENOENT") throw erro; });
  arquivosCriados.clear();
});

describe("arquivos privados persistidos — identidade, objeto, finalidade e conteúdo", () => {
  it("upload fixa matrícula e categoria antes da associação; categoria e matrícula não mudam", async () => {
    const c = await cenario();
    como(c.secretaria);
    const url = await upload({ matriculaId: c.matricula.id, categoriaDocumento: CategoriaDocumento.CONTRATO });
    const registro = await prisma.registroUpload.findUnique({ where: { url } });
    expect(registro).toMatchObject({ autorId: c.secretaria.id, matriculaId: c.matricula.id, alunoId: c.aluno.id, leadId: null, categoriaDocumento: CategoriaDocumento.CONTRATO });
    expect((await download(url)).status).toBe(403); // Ainda não existe Documento vinculado.
    await anexarNaMatricula(url, c.matricula.id, CategoriaDocumento.CONTRATO);
    const usuario = await exigirSessao();
    await expect(prisma.$transaction((tx) => exigirArquivoVinculavel(usuario, url, { matriculaId: c.matricula.id, categoriaDocumento: CategoriaDocumento.TESTE_NIVEL }, tx))).rejects.toThrow("outro objeto ou finalidade");
    await expect(prisma.$transaction((tx) => exigirArquivoVinculavel(usuario, url, { matriculaId: c.outraMatricula.id, categoriaDocumento: CategoriaDocumento.CONTRATO }, tx))).rejects.toThrow("outro objeto ou finalidade");
    expect(await prisma.registroUpload.findUnique({ where: { url } })).toEqual(registro);
    expect(await prisma.documento.count({ where: { url } })).toBe(1);
  });

  it.each([CategoriaDocumento.CONTRATO, CategoriaDocumento.COMPROVANTE])("download de %s da matrícula devolve bytes somente para funções autorizadas", async (categoria) => {
    const c = await cenario();
    como(c.secretaria);
    const url = await upload({ matriculaId: c.matricula.id, categoriaDocumento: categoria });
    await anexarNaMatricula(url, c.matricula.id, categoria);
    for (const usuario of [c.secretaria, c.admin, c.financeiro, c.professor, c.pedagogico, c.vendedor]) {
      como(usuario);
      const resposta = await download(url);
      const permitido = usuario.id === c.secretaria.id || usuario.id === c.admin.id || (usuario.id === c.financeiro.id && categoria === CategoriaDocumento.COMPROVANTE);
      expect(resposta.status, `papel ${usuario.papeis[0]}`).toBe(permitido ? 200 : 403);
      if (permitido) {
        expect(await resposta.text()).toBe("%PDF-1.7\nCONTEUDO_PRIVADO_DO_ARQUIVO");
        expect(resposta.headers.get("Cache-Control")).toBe("private, no-store");
      } else expect(await resposta.text()).not.toContain("CONTEUDO_PRIVADO_DO_ARQUIVO");
    }
  });

  it("arquivo pedagógico exige atribuição atual e perde acesso após revogação sem novo login", async () => {
    const c = await cenario();
    como(c.professor);
    const url = await upload({ leadId: c.lead.id, categoriaDocumento: CategoriaDocumento.TESTE_NIVEL });
    const usuario = await exigirSessao();
    await prisma.$transaction(async (tx) => {
      await exigirArquivoVinculavel(usuario, url, { leadId: c.lead.id, categoriaDocumento: CategoriaDocumento.TESTE_NIVEL }, tx);
      await tx.documento.create({ data: { leadId: c.lead.id, categoria: CategoriaDocumento.TESTE_NIVEL, url, nome: "Teste pedagógico" } });
    });
    expect((await download(url)).status).toBe(200);
    await prisma.lead.update({ where: { id: c.lead.id }, data: { professorExperimentalId: null } });
    expect((await download(url)).status).toBe(403);
    await prisma.lead.update({ where: { id: c.lead.id }, data: { professorExperimentalId: c.professor.id } });
    await prisma.usuario.update({ where: { id: c.professor.id }, data: { papeis: [] } });
    expect((await download(url)).status).toBe(403);
    expect((await enviarArquivo(requisicaoUpload({ leadId: c.lead.id, categoriaDocumento: CategoriaDocumento.TESTE_NIVEL }))).status).toBe(403);
    expect(await prisma.registroUpload.count()).toBe(1);
  });

  it("cookie da Secretaria desativada não envia nem baixa documentos existentes", async () => {
    const c = await cenario();
    como(c.secretaria);
    const url = await upload({ matriculaId: c.matricula.id, categoriaDocumento: CategoriaDocumento.CONTRATO });
    await anexarNaMatricula(url, c.matricula.id, CategoriaDocumento.CONTRATO);
    await prisma.usuario.update({ where: { id: c.secretaria.id }, data: { ativo: false } });
    expect((await download(url)).status).toBe(401);
    expect((await enviarArquivo(requisicaoUpload())).status).toBe(401);
    expect(await prisma.registroUpload.count()).toBe(1);
  });

  it("outro operador não captura upload ainda sem vínculo", async () => {
    const c = await cenario();
    como(c.vendedor);
    const url = await upload();
    como(c.secretaria);
    await expect(anexarNaMatricula(url, c.matricula.id, CategoriaDocumento.CONTRATO)).rejects.toThrow("outro usuário");
    expect(await prisma.registroUpload.findUnique({ where: { url } })).toMatchObject({ autorId: c.vendedor.id, matriculaId: null, categoriaDocumento: null });
    expect(await prisma.documento.count({ where: { url } })).toBe(0);
  });

  it("legado de lead conserva categoria e não vira teste pedagógico ou documento de outro lead", async () => {
    const c = await cenario();
    const url = await arquivoLegado();
    const documento = await prisma.documento.create({ data: { leadId: c.lead.id, categoria: CategoriaDocumento.CONTRATO, url, nome: "Contrato legado" } });
    como(c.secretaria);
    const usuario = await exigirSessao();
    await expect(exigirArquivoVinculavel(usuario, url, { leadId: c.lead.id, categoriaDocumento: CategoriaDocumento.CONTRATO })).resolves.toBeUndefined();
    for (const categoriaDocumento of [CategoriaDocumento.TESTE_NIVEL, CategoriaDocumento.PROPOSTA]) {
      await expect(exigirArquivoVinculavel(usuario, url, { leadId: c.lead.id, categoriaDocumento })).rejects.toThrow("Envie o arquivo novamente");
    }
    const outroLead = await prisma.lead.create({ data: { nome: "Outro lead", vendedorDonoId: c.vendedor.id } });
    como(c.admin);
    await expect(exigirArquivoVinculavel(await exigirSessao(), url, { leadId: outroLead.id, categoriaDocumento: CategoriaDocumento.CONTRATO })).rejects.toThrow("Envie o arquivo novamente");
    expect(await prisma.documento.findUnique({ where: { id: documento.id } })).toEqual(documento);
    expect(await prisma.registroUpload.findUnique({ where: { url } })).toBeNull();
    como(c.professor);
    expect((await download(url)).status).toBe(403);
  });

  it("legado da matrícula permanece no objeto original mesmo quando o aluno é o mesmo", async () => {
    const c = await cenario();
    const url = await arquivoLegado();
    await prisma.documento.create({ data: { matriculaId: c.matricula.id, categoria: CategoriaDocumento.CONTRATO, url, nome: "Contrato sem registro de upload" } });
    como(c.secretaria);
    const usuario = await exigirSessao();
    await expect(exigirArquivoVinculavel(usuario, url, { matriculaId: c.matricula.id, categoriaDocumento: CategoriaDocumento.CONTRATO })).resolves.toBeUndefined();
    await expect(exigirArquivoVinculavel(usuario, url, { matriculaId: c.outraMatricula.id, categoriaDocumento: CategoriaDocumento.CONTRATO })).rejects.toThrow("Envie o arquivo novamente");
    await expect(exigirArquivoVinculavel(usuario, url, { matriculaId: c.matricula.id, alunoId: "aluno-alheio", categoriaDocumento: CategoriaDocumento.CONTRATO })).rejects.toThrow();
    expect((await download(url)).status).toBe(200);
  });

  it("comprovante vinculado pela Secretaria permite conferência financeira sem trocar autor", async () => {
    const c = await cenario();
    como(c.secretaria);
    const url = await upload();
    await prisma.$transaction(async (tx) => {
      await exigirArquivoVinculavel(c.secretaria, url, { cobrancaId: c.cobranca.id }, tx);
      await tx.cobranca.update({ where: { id: c.cobranca.id }, data: { comprovanteUrl: url } });
    });
    const registro = await prisma.registroUpload.findUnique({ where: { url } });
    expect(registro).toMatchObject({ autorId: c.secretaria.id, matriculaId: c.matricula.id, cobrancaId: c.cobranca.id, categoriaDocumento: CategoriaDocumento.COMPROVANTE });
    como(c.financeiro);
    await expect(exigirArquivoVinculavel(await exigirSessao(), url, { cobrancaId: c.cobranca.id })).resolves.toBeUndefined();
    expect(await prisma.registroUpload.findUnique({ where: { url } })).toEqual(registro);
    expect((await download(url)).status).toBe(200);
    como(c.professor);
    expect((await download(url)).status).toBe(403);
  });
});
