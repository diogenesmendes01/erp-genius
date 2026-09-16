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

it("aplica vínculo histórico ATIVA sem criar efeitos comerciais e repete a mesma aplicação", async () => {
  const catalogo = await seedCatalogoMinimo();
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  const turma = await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, codigo: "MIG-T1" } });
  const preparado = await prepararLoteMigracao({
    origem: "PLANILHA", chaveLote: "ativa-replay",
    linhas: [{
      linhaOrigem: "vinculos!2", tipoEntrada: "VINCULO_MATRICULA",
      aluno: { id: "a-1", nome: "Ana Lima", email: "ana@example.test", documento: "DOC-1", pais: "CR", fuso: "America/Costa_Rica" },
      turma: { id: "t-1", codigo: "T1" },
      matricula: { id: "m-1", produtoOrigem: "p-1", situacao: "ATIVA", inicio: "2025-01-01", moeda: "CRC", pais: "CR" },
      alocacao: { inicio: "2025-01-01" }, consentimentoOrigem: "fonte",
    }],
  });
  expect(preparado).toMatchObject({ ok: true });
  if (!preparado.ok || !preparado.dado) throw new Error("Lote não preparado.");
  const linha = await prisma.linhaPreparacaoMigracao.findFirstOrThrow({ where: { loteId: preparado.dado.loteId } });
  const aluno = await prisma.aluno.create({ data: {
    primeiroNome: "Ana", email: "ana@example.test", documento: "DOC-1", paisId: catalogo.pais.id,
    fuso: "America/Costa_Rica", whatsapp: false, aceitaComunicacoes: false,
  } });
  await prisma.mapaOrigemAlunoMigracao.create({ data: { id: "mapa-a", origem: "PLANILHA", alunoOrigemId: "a-1", alunoId: aluno.id } });
  await revisarCorrespondenciaProdutoMigracao({
    origem: "PLANILHA", produtoOrigemId: "p-1", produtoId: catalogo.produto.id,
    paisId: catalogo.pais.id, moeda: "CRC", ativa: true,
  });
  await revisarCorrespondenciaTurmaMigracao({ origem: "PLANILHA", turmaOrigemId: "t-1", turmaId: turma.id, ativa: true });
  await revisarCorrespondenciaStatusMatriculaMigracao({ origem: "PLANILHA", statusOrigem: "ATIVA", statusDestino: "ATIVA", ativa: true });
  const ensaio = await ensaiarVinculoMigracao({ linhaId: linha.id });
  expect(ensaio).toMatchObject({ ok: true, dado: { resultado: "PRONTO_PARA_REVISAO" } });
  const e = await prisma.ensaioVinculoMigracao.findFirstOrThrow({ where: { linhaId: linha.id }, orderBy: { criadoEm: "desc" } });
  const input = {
    linhaId: linha.id, ensaioId: e.id, entradaHash: linha.entradaHash, contextoHash: e.contextoHash,
    fusoReferencia: "America/Costa_Rica" as const, semanticaFim: "LIMITE_EXCLUSIVO" as const,
    inicioAlocacao: "2025-01-01", fimAlocacao: null, diaVencimento: 10, mesesPlano: 9,
    evidenciaContrato: { referencia: "contrato legado" }, evidenciaPagamento: { referencia: "pagamento não confirmado" },
    fatos: [{ tipo: "ATIVACAO" as const, data: "2025-01-01", evidencia: { referencia: "estado ativo" } }],
  };
  const primeira = await aplicarVinculoMigracao(input);
  expect(primeira.ok, primeira.ok ? undefined : primeira.erro).toBe(true);
  const segunda = await aplicarVinculoMigracao(input);
  expect(segunda).toMatchObject({ ok: true, dado: { repetida: true } });
  if (!primeira.ok || !primeira.dado || !segunda.ok || !segunda.dado) throw new Error("Aplicação falhou.");
  expect(segunda.dado).toMatchObject({ id: primeira.dado.id, matriculaId: primeira.dado.matriculaId, alocacaoId: primeira.dado.alocacaoId });
  expect(await prisma.matricula.count()).toBe(1);
  expect(await prisma.alocacaoTurma.count()).toBe(1);
  expect(await prisma.aplicacaoVinculoMigracao.count()).toBe(1);
  expect(await prisma.matricula.findUniqueOrThrow({ where: { id: primeira.dado.matriculaId } })).toMatchObject({
    status: "ATIVA", contratoOk: false, pagamentoTaxaOk: false, primeiraMensalidadeOk: false, ativadaEm: null,
  });
  expect(await prisma.cobranca.count()).toBe(0);
});

it("mantém duas participações históricas da mesma matrícula e aceita replay com fatos de chaves invertidas", async () => {
  const catalogo = await seedCatalogoMinimo();
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  const [turmaA, turmaB] = await Promise.all([
    prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, codigo: "MIG-HIST-A" } }),
    prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, codigo: "MIG-HIST-B" } }),
  ]);
  const preparado = await prepararLoteMigracao({
    origem: "PLANILHA", chaveLote: "participacoes-historicas",
    linhas: [
      {
        linhaOrigem: "vinculos!2", tipoEntrada: "VINCULO_MATRICULA",
        aluno: { id: "a-1", nome: "Ana Lima", email: "ana@example.test", documento: "DOC-1", pais: "CR", fuso: "America/Costa_Rica" },
        turma: { id: "t-a", codigo: "HIST-A" },
        matricula: { id: "m-1", produtoOrigem: "p-1", situacao: "ATIVA", inicio: "2025-01-01", moeda: "CRC", pais: "CR" },
        alocacao: { inicio: "2025-01-01", fim: "2025-04-01" }, consentimentoOrigem: "fonte",
      },
      {
        linhaOrigem: "vinculos!3", tipoEntrada: "VINCULO_MATRICULA",
        aluno: { id: "a-1", nome: "Ana Lima", email: "ana@example.test", documento: "DOC-1", pais: "CR", fuso: "America/Costa_Rica" },
        turma: { id: "t-b", codigo: "HIST-B" },
        matricula: { id: "m-1", produtoOrigem: "p-1", situacao: "ATIVA", inicio: "2025-01-01", moeda: "CRC", pais: "CR" },
        alocacao: { inicio: "2025-04-01" }, consentimentoOrigem: "fonte",
      },
    ],
  });
  expect(preparado).toMatchObject({ ok: true });
  if (!preparado.ok || !preparado.dado) throw new Error("Lote não preparado.");
  const [linhaA, linhaB] = await prisma.linhaPreparacaoMigracao.findMany({ where: { loteId: preparado.dado.loteId }, orderBy: { linhaOrigem: "asc" } });
  if (!linhaA || !linhaB) throw new Error("Participações não preparadas.");
  const aluno = await prisma.aluno.create({ data: {
    primeiroNome: "Ana", email: "ana@example.test", documento: "DOC-1", paisId: catalogo.pais.id,
    fuso: "America/Costa_Rica", whatsapp: false, aceitaComunicacoes: false,
  } });
  await prisma.mapaOrigemAlunoMigracao.create({ data: { id: "mapa-a", origem: "PLANILHA", alunoOrigemId: "a-1", alunoId: aluno.id } });
  await revisarCorrespondenciaProdutoMigracao({
    origem: "PLANILHA", produtoOrigemId: "p-1", produtoId: catalogo.produto.id,
    paisId: catalogo.pais.id, moeda: "CRC", ativa: true,
  });
  await Promise.all([
    revisarCorrespondenciaTurmaMigracao({ origem: "PLANILHA", turmaOrigemId: "t-a", turmaId: turmaA.id, ativa: true }),
    revisarCorrespondenciaTurmaMigracao({ origem: "PLANILHA", turmaOrigemId: "t-b", turmaId: turmaB.id, ativa: true }),
  ]);
  await revisarCorrespondenciaStatusMatriculaMigracao({ origem: "PLANILHA", statusOrigem: "ATIVA", statusDestino: "ATIVA", ativa: true });
  const [ensaioA, ensaioB] = await Promise.all([ensaiarVinculoMigracao({ linhaId: linhaA.id }), ensaiarVinculoMigracao({ linhaId: linhaB.id })]);
  expect([ensaioA, ensaioB]).toEqual([
    expect.objectContaining({ ok: true, dado: expect.objectContaining({ resultado: "PRONTO_PARA_REVISAO" }) }),
    expect.objectContaining({ ok: true, dado: expect.objectContaining({ resultado: "PRONTO_PARA_REVISAO" }) }),
  ]);
  const [revisaoA, revisaoB] = await Promise.all([
    prisma.ensaioVinculoMigracao.findFirstOrThrow({ where: { linhaId: linhaA.id }, orderBy: { criadoEm: "desc" } }),
    prisma.ensaioVinculoMigracao.findFirstOrThrow({ where: { linhaId: linhaB.id }, orderBy: { criadoEm: "desc" } }),
  ]);
  const base = {
    fusoReferencia: "America/Costa_Rica" as const, semanticaFim: "LIMITE_EXCLUSIVO" as const,
    diaVencimento: 10, mesesPlano: 9,
    evidenciaContrato: { arquivo: "contrato-legado", pagina: 1 }, evidenciaPagamento: { arquivo: "pagamento-legado", pagina: 1 },
  };
  const aplicadaA = await aplicarVinculoMigracao({
    ...base, linhaId: linhaA.id, ensaioId: revisaoA.id, entradaHash: linhaA.entradaHash, contextoHash: revisaoA.contextoHash,
    inicioAlocacao: "2025-01-01", fimAlocacao: "2025-04-01",
    fatos: [{ tipo: "ATIVACAO" as const, data: "2025-01-01", evidencia: { arquivo: "vinculos-2025", pagina: 2 } }],
  });
  expect(aplicadaA.ok, aplicadaA.ok ? undefined : aplicadaA.erro).toBe(true);
  if (!aplicadaA.ok || !aplicadaA.dado) throw new Error("Primeira participação não aplicada.");
  const entradaB = {
    ...base, linhaId: linhaB.id, ensaioId: revisaoB.id, entradaHash: linhaB.entradaHash, contextoHash: revisaoB.contextoHash,
    inicioAlocacao: "2025-04-01", fimAlocacao: null,
    fatos: [{ tipo: "ATIVACAO" as const, data: "2025-01-01", evidencia: { pagina: 2, arquivo: "vinculos-2025" } }],
  };
  const aplicadaB = await aplicarVinculoMigracao(entradaB);
  const replayB = await aplicarVinculoMigracao(entradaB);
  expect(aplicadaB.ok, aplicadaB.ok ? undefined : aplicadaB.erro).toBe(true);
  expect(replayB).toMatchObject({ ok: true, dado: { repetida: true } });
  if (!aplicadaB.ok || !aplicadaB.dado || !replayB.ok || !replayB.dado) throw new Error("Segunda participação não aplicada.");
  expect(replayB.dado).toMatchObject({ id: aplicadaB.dado.id, matriculaId: aplicadaA.dado.matriculaId, alocacaoId: aplicadaB.dado.alocacaoId });
  expect(await prisma.matricula.count()).toBe(1);
  expect(await prisma.mapaOrigemMatriculaMigracao.count()).toBe(1);
  expect(await prisma.alocacaoTurma.count()).toBe(2);
  expect(await prisma.fatoSituacaoMatriculaMigracao.count()).toBe(1);
  expect(await prisma.aplicacaoVinculoMigracao.count()).toBe(2);
  const alocacoes = await prisma.alocacaoTurma.findMany({ where: { matriculaId: aplicadaA.dado.matriculaId }, orderBy: { inicioVigencia: "asc" } });
  expect(alocacoes).toMatchObject([
    { id: aplicadaA.dado.alocacaoId, turmaId: turmaA.id, ativa: false },
    { id: aplicadaB.dado.alocacaoId, turmaId: turmaB.id, ativa: true },
  ]);
});
