import { beforeEach, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/server/_shared/sessao", async importOriginal => {
  const original = await importOriginal<typeof import("@/server/_shared/sessao")>();
  const { prisma } = await import("@/lib/prisma");
  const sessao = async () => {
    const id = (await authMock())?.user?.id;
    const usuario = id && await prisma.usuario.findUnique({ where: { id } });
    if (!usuario?.ativo) throw new original.ErroAutenticacao();
    return usuario;
  };
  return { ...original, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const usuario = await sessao(); original.exigirPapel(usuario, ...papeis); return usuario;
  } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { prepararLoteMigracao } from "./acoes";
import {
  ensaiarVinculoMigracao,
  revisarCorrespondenciaProdutoMigracao,
  revisarCorrespondenciaStatusMatriculaMigracao,
  revisarCorrespondenciaTurmaMigracao,
} from "./ensaio-vinculo";
import { aplicarVinculoMigracao } from "./aplicar-vinculo";

let adminId = "";
beforeEach(async () => {
  await truncarBanco();
  adminId = (await criarUsuario([Papel.ADMINISTRADOR], "Admin migração")).id;
  authMock.mockResolvedValue({ user: { id: adminId } });
});

async function prepararAplicacao() {
  const catalogo = await seedCatalogoMinimo();
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  const turma = await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, codigo: "MIG-A" } });
  const lote = await prepararLoteMigracao({ origem: "PLANILHA", chaveLote: "adversarial", linhas: [{
    linhaOrigem: "vinculos!2", tipoEntrada: "VINCULO_MATRICULA",
    aluno: { id: "a-1", nome: "Ana", email: "ana@example.test", documento: "D-1", pais: "CR", fuso: "America/Costa_Rica" },
    turma: { id: "t-1", codigo: "MIG-A" },
    matricula: { id: "m-1", produtoOrigem: "p-1", situacao: "ATIVA", inicio: "2025-01-01", moeda: "CRC", pais: "CR" },
    alocacao: { inicio: "2025-01-01" }, consentimentoOrigem: "confirmado na fonte",
  }] });
  if (!lote.ok || !lote.dado) throw new Error("Lote ausente.");
  const linha = await prisma.linhaPreparacaoMigracao.findFirstOrThrow({ where: { loteId: lote.dado.loteId } });
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Ana", email: "ana@example.test", documento: "D-1", paisId: catalogo.pais.id, fuso: "America/Costa_Rica", whatsapp: false, aceitaComunicacoes: false } });
  await prisma.mapaOrigemAlunoMigracao.create({ data: { origem: "PLANILHA", alunoOrigemId: "a-1", alunoId: aluno.id } });
  const produto = await revisarCorrespondenciaProdutoMigracao({ origem: "PLANILHA", produtoOrigemId: "p-1", produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", ativa: true });
  await revisarCorrespondenciaTurmaMigracao({ origem: "PLANILHA", turmaOrigemId: "t-1", turmaId: turma.id, ativa: true });
  await revisarCorrespondenciaStatusMatriculaMigracao({ origem: "PLANILHA", statusOrigem: "ATIVA", statusDestino: "ATIVA", ativa: true });
  const ensaio = await ensaiarVinculoMigracao({ linhaId: linha.id });
  if (!produto.ok || !produto.dado || !ensaio.ok || ensaio.dado?.resultado !== "PRONTO_PARA_REVISAO") throw new Error("Ensaio não ficou pronto.");
  const e = await prisma.ensaioVinculoMigracao.findFirstOrThrow({ where: { linhaId: linha.id }, orderBy: { criadoEm: "desc" } });
  const input = {
    linhaId: linha.id, ensaioId: e.id, entradaHash: linha.entradaHash, contextoHash: e.contextoHash,
    fusoReferencia: "America/Costa_Rica" as const, semanticaFim: "LIMITE_EXCLUSIVO" as const,
    inicioAlocacao: "2025-01-01", fimAlocacao: null, diaVencimento: 10, mesesPlano: 9,
    evidenciaContrato: { referencia: "contrato histórico" }, evidenciaPagamento: { referencia: "pagamento não confirmado" },
    fatos: [{ tipo: "ATIVACAO" as const, data: "2025-01-01", evidencia: { referencia: "estado ativo" } }],
  };
  return { catalogo, linha, produto: produto.dado, input };
}

it("revogação posterior da correspondência rejeita aplicação e reverte todos os fatos", async () => {
  const { catalogo, linha, produto, input } = await prepararAplicacao();
  const revogada = await revisarCorrespondenciaProdutoMigracao({
    origem: "PLANILHA", produtoOrigemId: "p-1", produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC",
    ativa: false, revisaoEsperada: { id: produto.id, versao: produto.versao },
  });
  expect(revogada).toMatchObject({ ok: true, dado: { versao: produto.versao + 1 } });
  const resultado = await aplicarVinculoMigracao(input);
  expect(resultado).toMatchObject({ ok: false });
  expect(await prisma.mapaOrigemMatriculaMigracao.count()).toBe(0);
  expect(await prisma.matricula.count()).toBe(0);
  expect(await prisma.termosHistoricosMatriculaMigracao.count()).toBe(0);
  expect(await prisma.fatoSituacaoMatriculaMigracao.count()).toBe(0);
  expect(await prisma.alocacaoTurma.count()).toBe(0);
  expect(await prisma.aplicacaoVinculoMigracao.count({ where: { linhaId: linha.id } })).toBe(0);
});

it("trigger recusa snapshot divergente antes de deixar nova aplicação ou alocação", async () => {
  const { linha, input } = await prepararAplicacao();
  const aplicada = await aplicarVinculoMigracao(input);
  if (!aplicada.ok || !aplicada.dado) throw new Error("Aplicação base ausente.");
  const antes = await prisma.alocacaoTurma.count();
  await expect(prisma.$transaction(async tx => {
    const alocacao = await tx.alocacaoTurma.create({ data: {
      alunoId: (await tx.matricula.findUniqueOrThrow({ where: { id: aplicada.dado!.matriculaId } })).alunoId,
      matriculaId: aplicada.dado!.matriculaId,
      turmaId: (await tx.alocacaoTurma.findUniqueOrThrow({ where: { id: aplicada.dado!.alocacaoId } })).turmaId,
      ativa: false, provenienciaVinculo: "MIGRACAO", inicioVigencia: new Date("2025-01-01T06:00:00.000Z"), fimVigencia: new Date("2025-01-02T06:00:00.000Z"),
    } });
    await tx.aplicacaoVinculoMigracao.create({ data: {
      linhaId: linha.id, entradaHash: linha.entradaHash, contextoHash: input.contextoHash, ensaioId: input.ensaioId,
      matriculaId: aplicada.dado!.matriculaId, alocacaoId: alocacao.id, fusoReferencia: input.fusoReferencia, semanticaFim: input.semanticaFim,
      snapshot: {
        linhaId: linha.id, entradaHash: linha.entradaHash, contextoHash: input.contextoHash, fusoReferencia: input.fusoReferencia,
        semanticaFim: input.semanticaFim,
        limites: { inicioVigencia: "2025-01-03T06:00:00.000Z", fimVigencia: "2025-01-02T06:00:00.000Z" },
        termos: { diaVencimento: input.diaVencimento, mesesPlano: input.mesesPlano },
        evidencias: { contrato: input.evidenciaContrato, pagamento: input.evidenciaPagamento },
      }, aplicadoPorId: adminId,
    } });
  })).rejects.toThrow(/snapshot|limites/i);
  expect(await prisma.alocacaoTurma.count()).toBe(antes);
  expect(await prisma.aplicacaoVinculoMigracao.count({ where: { linhaId: linha.id } })).toBe(1);
});

