import { beforeEach, expect, it, vi } from "vitest";
import { Papel, StatusMatricula } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/server/_shared/sessao", async (original) => {
  const real = await original<typeof import("@/server/_shared/sessao")>();
  const { prisma } = await import("@/lib/prisma");
  const sessao = async () => {
    const id = (await authMock())?.user?.id;
    const usuario = id && await prisma.usuario.findUnique({ where: { id } });
    if (!usuario?.ativo) throw new real.ErroAutenticacao();
    return usuario;
  };
  return { ...real, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const usuario = await sessao(); real.exigirPapel(usuario, ...papeis); return usuario;
  } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { prepararLoteMigracao } from "./acoes";

let adminId = "", operadorId = "", linhaId = "", linhaCadastroId = "", entradaHash = "", entradaCadastroHash = "", origem = "MIGRACAO_TESTE";
let produtoId = "", paisId = "", turmaId = "", alunoId = "", moeda = "";
const hash = "a".repeat(64), contexto = "b".repeat(64);
const snapshotValido = (id: string, entrada: string, contextoHash: string) => JSON.stringify({ linhaId: id, entradaHash: entrada, contextoHash, correspondencias: { produto: null, turma: null, status: null } });

async function inserirMapas(ativa = true) {
  await prisma.$executeRaw`INSERT INTO "CorrespondenciaProdutoMigracao" (id,origem,"produtoOrigemId",versao,"produtoId","paisId",moeda,ativa,"revisadaPorId") VALUES ('produto-v1',${origem},'oferta-legada',1,${produtoId},${paisId},${moeda},${ativa},${adminId})`;
  await prisma.$executeRaw`INSERT INTO "CorrespondenciaTurmaMigracao" (id,origem,"turmaOrigemId",versao,"turmaId",ativa,"revisadaPorId") VALUES ('turma-v1',${origem},'turma-legada',1,${turmaId},${ativa},${adminId})`;
  await prisma.$executeRaw`INSERT INTO "CorrespondenciaStatusMatriculaMigracao" (id,origem,"statusOrigem",versao,"statusDestino",ativa,"revisadaPorId") VALUES ('status-v1',${origem},'ATIVA',1,${StatusMatricula.ATIVA}::"StatusMatricula",${ativa},${adminId})`;
}

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo(); produtoId = catalogo.produto.id; paisId = catalogo.pais.id;
  const oferta = await prisma.produtoPais.findUniqueOrThrow({ where: { produtoId_paisId: { produtoId, paisId } } }); moeda = oferta.moeda;
  await prisma.produtoPais.update({ where: { id: oferta.id }, data: { oferecido: true } });
  adminId = (await criarUsuario([Papel.ADMINISTRADOR])).id;
  operadorId = (await criarUsuario([Papel.SECRETARIA_ACADEMICA])).id;
  const professorId = (await criarUsuario([Papel.PROFESSOR])).id;
  const nivelId = (await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } })).id;
  turmaId = (await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId, professorId, status: "ABERTA", diasSemana: [1], horarioInicio: "10:00", dataInicio: new Date("2099-01-01") } })).id;
  alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Ana", paisId, email: "ana@example.test" } })).id;
  authMock.mockResolvedValue({ user: { id: adminId } });
  const preparado = await prepararLoteMigracao({ origem, chaveLote: "vinculos-183", linhas: [{ linhaOrigem: "vinculos!2", tipoEntrada: "VINCULO_MATRICULA", aluno: { id: "aluno-legado", nome: "Ana", email: "ana@example.test", documento: "DOC", pais: "BR", fuso: "UTC" }, turma: { id: "turma-legada", codigo: "T", nome: "Turma" }, matricula: { id: "matricula-legada", situacao: "ATIVA", inicio: "2026-01-01", fim: "2026-12-01", produtoOrigem: "oferta-legada", moeda, pais: "BR" }, alocacao: { inicio: "2026-01-01", fim: "2026-12-01" }, consentimentoOrigem: "evidência legada preservada", dadosAdicionais: {} }] });
  if (!preparado.ok || !preparado.dado) throw new Error("preparo ausente");
  await prepararLoteMigracao({ origem, chaveLote: "cadastro-183", linhas: [{ linhaOrigem: "cadastro!2", tipoEntrada: "CADASTRO", aluno: { id: "cadastro-legado", nome: "Bia", email: "bia@example.test", documento: "DOC2", pais: "BR", fuso: "UTC" }, dadosAdicionais: {} }] });
  const linha = await prisma.linhaPreparacaoMigracao.findFirstOrThrow({ where: { tipoEntrada: "VINCULO_MATRICULA" } }); linhaId = linha.id; entradaHash = linha.entradaHash;
  const cadastro = await prisma.linhaPreparacaoMigracao.findFirstOrThrow({ where: { tipoEntrada: "CADASTRO" } }); linhaCadastroId = cadastro.id; entradaCadastroHash = cadastro.entradaHash;
  await prisma.$executeRaw`INSERT INTO "MapaOrigemAlunoMigracao" (id,origem,"alunoOrigemId","alunoId") VALUES ('aluno-mapa',${origem},'aluno-legado',${alunoId})`;
});

it("recusa correspondência de não-Admin, alteração/exclusão e versão inválida", async () => {
  await expect(prisma.$executeRaw`INSERT INTO "CorrespondenciaStatusMatriculaMigracao" (id,origem,"statusOrigem",versao,"statusDestino",ativa,"revisadaPorId") VALUES ('nao-admin',${origem},'ATIVA',1,${StatusMatricula.ATIVA}::"StatusMatricula",true,${operadorId})`).rejects.toThrow();
  await inserirMapas();
  await expect(prisma.$executeRaw`UPDATE "CorrespondenciaTurmaMigracao" SET ativa=false WHERE id='turma-v1'`).rejects.toThrow();
  await expect(prisma.$executeRaw`DELETE FROM "CorrespondenciaProdutoMigracao" WHERE id='produto-v1'`).rejects.toThrow();
  await expect(prisma.$executeRaw`INSERT INTO "CorrespondenciaTurmaMigracao" (id,origem,"turmaOrigemId",versao,"turmaId",ativa,"revisadaPorId") VALUES ('turma-v3',${origem},'turma-legada',3,${turmaId},true,${adminId})`).rejects.toThrow();
});

it("recusa ensaio com hash ou tipo de linha incorreto e snapshot incompleto", async () => {
  await inserirMapas();
  await expect(prisma.$executeRaw`INSERT INTO "EnsaioVinculoMigracao" (id,"linhaId","entradaHash","contextoHash",resultado,requisitos,snapshot,"ensaiadoPorId") VALUES ('hash-ruim',${linhaId},${hash},${contexto},'REQUISITO_AUSENTE','[{"codigo":"X"}]'::jsonb,${snapshotValido(linhaId, hash, contexto)}::jsonb,${adminId})`).rejects.toThrow(/fotografia/i);
  const contextoTipo = "c".repeat(64);
  await expect(prisma.$executeRaw`INSERT INTO "EnsaioVinculoMigracao" (id,"linhaId","entradaHash","contextoHash",resultado,requisitos,snapshot,"ensaiadoPorId") VALUES ('tipo-ruim',${linhaCadastroId},${entradaCadastroHash},${contextoTipo},'REQUISITO_AUSENTE','[{"codigo":"X"}]'::jsonb,${snapshotValido(linhaCadastroId, entradaCadastroHash, contextoTipo)}::jsonb,${adminId})`).rejects.toThrow(/fotografia de vínculo/i);
  await expect(prisma.$executeRaw`INSERT INTO "EnsaioVinculoMigracao" (id,"linhaId","entradaHash","contextoHash",resultado,requisitos,snapshot,"ensaiadoPorId") VALUES ('snapshot-nulo',${linhaId},${entradaHash},${"d".repeat(64)},'REQUISITO_AUSENTE','[{"codigo":"X"}]'::jsonb,NULL,${adminId})`).rejects.toThrow();
  await expect(prisma.$executeRaw`INSERT INTO "EnsaioVinculoMigracao" (id,"linhaId","entradaHash","contextoHash",resultado,requisitos,snapshot,"ensaiadoPorId") VALUES ('snapshot-json-nulo',${linhaId},${entradaHash},${"e".repeat(64)},'REQUISITO_AUSENTE','[{"codigo":"X"}]'::jsonb,'null'::jsonb,${adminId})`).rejects.toThrow(/snapshot/i);
  await expect(prisma.$executeRaw`INSERT INTO "EnsaioVinculoMigracao" (id,"linhaId","entradaHash","contextoHash",resultado,requisitos,snapshot,"ensaiadoPorId") VALUES ('snapshot-ruim',${linhaId},${entradaHash},${contexto},'REQUISITO_AUSENTE','[]'::jsonb,'{}'::jsonb,${adminId})`).rejects.toThrow(/snapshot/i);
});

it("não ressuscita a versão revogada e preserva novo ensaio ao mudar o contexto", async () => {
  const { ensaiarVinculoMigracao } = await import("./ensaio-vinculo");
  await inserirMapas(true);
  const primeiro = await ensaiarVinculoMigracao({ linhaId });
  expect(primeiro).toMatchObject({ ok: true, dado: { resultado: "PRONTO_PARA_REVISAO", repetido: false } });
  await prisma.$executeRaw`INSERT INTO "CorrespondenciaProdutoMigracao" (id,origem,"produtoOrigemId",versao,"produtoId","paisId",moeda,ativa,"revisadaPorId") VALUES ('produto-v2',${origem},'oferta-legada',2,${produtoId},${paisId},${moeda},false,${adminId})`;
  const revogado = await ensaiarVinculoMigracao({ linhaId });
  expect(revogado).toMatchObject({ ok: true, dado: { resultado: "REQUISITO_AUSENTE", repetido: false } });
  expect(await prisma.ensaioVinculoMigracao.count({ where: { linhaId } })).toBe(2);
  const replay = await ensaiarVinculoMigracao({ linhaId });
  expect(replay).toMatchObject({ ok: true, dado: { repetido: true, resultado: "REQUISITO_AUSENTE" } });
});
