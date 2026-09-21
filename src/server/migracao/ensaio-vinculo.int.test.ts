import { beforeEach, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/server/_shared/sessao", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/_shared/sessao")>();
  const { prisma } = await import("@/lib/prisma");
  const sessao = async () => {
    const id = (await authMock())?.user?.id;
    const usuario = id && await prisma.usuario.findUnique({ where: { id } });
    if (!usuario?.ativo) throw new original.ErroAutenticacao();
    return usuario;
  };
  return { ...original, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => { const usuario = await sessao(); original.exigirPapel(usuario, ...papeis); return usuario; } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { prepararLoteMigracao } from "./acoes";
import { consultarLotePreparacaoMigracao } from "./consultas";
import { ensaiarVinculoMigracao, revisarCorrespondenciaProdutoMigracao, revisarCorrespondenciaStatusMatriculaMigracao } from "./ensaio-vinculo";

let adminId = "";
beforeEach(async () => { await truncarBanco(); adminId = (await criarUsuario([Papel.ADMINISTRADOR], "Admin de migração")).id; authMock.mockResolvedValue({ user: { id: adminId } }); });

it("serializa revisões concorrentes do mesmo produto de origem", async () => {
  const catalogo = await seedCatalogoMinimo();
  const entrada = { origem: "PLANILHA", produtoOrigemId: "123", produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", ativa: true };
  const [primeira, segunda] = await Promise.all([revisarCorrespondenciaProdutoMigracao(entrada), revisarCorrespondenciaProdutoMigracao(entrada)]);
  expect(primeira).toMatchObject({ ok: true }); expect(segunda).toMatchObject({ ok: true });
  expect((await prisma.correspondenciaProdutoMigracao.findMany({ orderBy: { versao: "asc" } })).map((revisao) => revisao.versao)).toEqual([1, 2]);
});

it("recusa revogação que aponta para uma revisão de produto superada", async () => {
  const catalogo = await seedCatalogoMinimo();
  const entrada = { origem: "PLANILHA", produtoOrigemId: "stale", produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", ativa: true };
  const primeira = await revisarCorrespondenciaProdutoMigracao(entrada);
  const segunda = await revisarCorrespondenciaProdutoMigracao(entrada);
  expect(primeira).toMatchObject({ ok: true, dado: { versao: 1, id: expect.any(String) } });
  expect(segunda).toMatchObject({ ok: true, dado: { versao: 2 } });
  const idAntigo = primeira.ok && primeira.dado?.id;
  expect(await revisarCorrespondenciaProdutoMigracao({ ...entrada, ativa: false, revisaoEsperada: { id: idAntigo!, versao: 1 } })).toMatchObject({ ok: false });
  expect(await prisma.correspondenciaProdutoMigracao.findMany({ where: { origem: "PLANILHA", produtoOrigemId: "stale" }, orderBy: { versao: "asc" } })).toHaveLength(2);
});

it("normaliza produto numérico da fotografia como a chave textual da correspondência", async () => {
  const catalogo = await seedCatalogoMinimo();
  const preparado = await prepararLoteMigracao({ origem: "PLANILHA", chaveLote: "produto-numerico", linhas: [{ linhaOrigem: "vinculos!2", tipoEntrada: "VINCULO_MATRICULA", aluno: { id: "a-1", nome: "Ana", email: "ana@example.test", documento: "D1", pais: "CR", fuso: "America/Costa_Rica" }, turma: { id: "turma-1", codigo: "T1" }, matricula: { id: "m-1", produtoOrigem: 123, situacao: "ATIVA", inicio: "2026-01-01", moeda: "CRC", pais: "CR" }, alocacao: { inicio: "2026-01-01" }, consentimentoOrigem: "sim" }] });
  expect(preparado).toMatchObject({ ok: true });
  await revisarCorrespondenciaProdutoMigracao({ origem: "PLANILHA", produtoOrigemId: "123", produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", ativa: true });
  const consulta = await consultarLotePreparacaoMigracao(preparado.ok && preparado.dado ? preparado.dado.loteId : "");
  expect(consulta).toMatchObject({ ok: true, dado: { linhas: [expect.objectContaining({ origemVinculo: expect.objectContaining({ produtoOrigemId: "123", produtoAtual: expect.objectContaining({ ativa: true }) }) })] } });
});

it("aceita chaves com espaços depois da normalização sem reescrever a fotografia", async () => {
  const catalogo = await seedCatalogoMinimo();
  const preparado = await prepararLoteMigracao({ origem: "PLANILHA", chaveLote: "produto-com-espacos", linhas: [{ linhaOrigem: "vinculos!2", tipoEntrada: "VINCULO_MATRICULA", aluno: { id: "a-1", nome: "Ana", email: "ana@example.test", documento: "D1", pais: "CR", fuso: "America/Costa_Rica" }, turma: { id: "turma-1", codigo: "T1" }, matricula: { id: "m-1", produtoOrigem: " 123 ", situacao: " ATIVA ", inicio: "2026-01-01", moeda: "CRC", pais: "CR" }, alocacao: { inicio: "2026-01-01" }, consentimentoOrigem: "sim" }] });
  await revisarCorrespondenciaProdutoMigracao({ origem: "PLANILHA", produtoOrigemId: "123", produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", ativa: true });
  await revisarCorrespondenciaStatusMatriculaMigracao({ origem: "PLANILHA", statusOrigem: "ATIVA", statusDestino: "ATIVA", ativa: true });
  const linha = await prisma.linhaPreparacaoMigracao.findFirstOrThrow({ where: { loteId: preparado.ok && preparado.dado ? preparado.dado.loteId : "" } });
  expect(linha.dadosOrigem).toMatchObject({ matricula: { produtoOrigem: " 123 ", situacao: " ATIVA " } });
  expect(await ensaiarVinculoMigracao({ linhaId: linha.id })).toMatchObject({ ok: true, dado: { resultado: "REQUISITO_AUSENTE" } });
});
