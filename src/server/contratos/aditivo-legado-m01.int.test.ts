import { beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared", async original => {
  const real = await original<typeof import("@/server/_shared")>();
  return {
    ...real,
    exigirSessaoComPapel: async (...papeis: Papel[]) => {
      const sessao = await authMock();
      const usuario = await prisma.usuario.findUniqueOrThrow({
        where: { id: sessao.user.id },
        select: { id: true, nome: true, papeis: true, ativo: true },
      });
      if (!usuario.ativo) throw new real.ErroPermissao();
      real.exigirPapel(usuario, ...papeis);
      return usuario;
    },
  };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { prepararLoteMigracao } from "@/server/migracao/acoes";
import { aplicarVinculoMigracao } from "@/server/migracao/aplicar-vinculo";
import { ensaiarVinculoMigracao, revisarCorrespondenciaProdutoMigracao, revisarCorrespondenciaStatusMatriculaMigracao, revisarCorrespondenciaTurmaMigracao } from "@/server/migracao/ensaio-vinculo";
import { proporEntradaFinanceiraHistoricaMigracao, decidirEntradaFinanceiraHistoricaMigracao } from "@/server/migracao/entrada-financeira-historica";
import { consultarAditivosContratuais, prepararAditivoContratual } from "./aditivos";

let secretariaId: string;
let financeiroId: string;
let catalogo: Awaited<ReturnType<typeof seedCatalogoMinimo>>;

const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

/** Cria a cadeia M01 por ações públicas: lote, mapeamentos, ensaio, vínculo
 * aplicado e obrigação financeira aprovada por outra pessoa. Não insere uma
 * assinatura, uma proposta ou uma aplicação de aditivo artificialmente. */
async function criarMatriculaM01(nome: string) {
  const origem = `M01-ADITIVO-${randomUUID()}`;
  const alunoOrigemId = `aluno-${randomUUID()}`;
  const matriculaOrigemId = `matricula-${randomUUID()}`;
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.produto.idiomaId, codigo: `M01-AD-${randomUUID()}`, ordem: 1 } });
  const turma = await prisma.turma.create({ data: { modalidadeId: catalogo.produto.modalidadeId, nivelId: nivel.id, codigo: `M01-AD-${randomUUID()}` } });

  entrar(secretariaId);
  const vinculo = await prepararLoteMigracao({
    origem,
    chaveLote: `vinculo-${randomUUID()}`,
    linhas: [{
      linhaOrigem: "vinculos!2",
      tipoEntrada: "VINCULO_MATRICULA",
      aluno: { id: alunoOrigemId, nome, email: `${alunoOrigemId}@example.test`, documento: `DOC-${alunoOrigemId}`, pais: "CR", fuso: "America/Costa_Rica" },
      turma: { id: "turma-legada", codigo: turma.codigo },
      matricula: { id: matriculaOrigemId, produtoOrigem: "produto-legado", situacao: "ATIVA", inicio: "2025-01-01", moeda: "CRC", pais: "CR" },
      alocacao: { inicio: "2025-01-01" },
      consentimentoOrigem: "Documento histórico preservado na fonte M01.",
    }],
  });
  if (!vinculo.ok || !vinculo.dado) throw new Error(vinculo.ok ? "Lote M01 sem retorno" : vinculo.erro);
  const linhaVinculo = await prisma.linhaPreparacaoMigracao.findFirstOrThrow({ where: { loteId: vinculo.dado.loteId } });
  const aluno = await prisma.aluno.create({ data: { primeiroNome: nome, paisId: catalogo.pais.id } });
  await prisma.mapaOrigemAlunoMigracao.create({ data: { origem, alunoOrigemId, alunoId: aluno.id } });
  await revisarCorrespondenciaProdutoMigracao({ origem, produtoOrigemId: "produto-legado", produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", ativa: true });
  await revisarCorrespondenciaTurmaMigracao({ origem, turmaOrigemId: "turma-legada", turmaId: turma.id, ativa: true });
  await revisarCorrespondenciaStatusMatriculaMigracao({ origem, statusOrigem: "ATIVA", statusDestino: "ATIVA", ativa: true });
  const ensaio = await ensaiarVinculoMigracao({ linhaId: linhaVinculo.id });
  if (!ensaio.ok) throw new Error(ensaio.erro);
  const ensaioPersistido = await prisma.ensaioVinculoMigracao.findFirstOrThrow({ where: { linhaId: linhaVinculo.id } });
  const aplicada = await aplicarVinculoMigracao({
    linhaId: linhaVinculo.id,
    ensaioId: ensaioPersistido.id,
    entradaHash: linhaVinculo.entradaHash,
    contextoHash: ensaioPersistido.contextoHash,
    fusoReferencia: "America/Costa_Rica",
    semanticaFim: "LIMITE_EXCLUSIVO",
    inicioAlocacao: "2025-01-01",
    fimAlocacao: null,
    diaVencimento: 10,
    mesesPlano: 1,
    evidenciaContrato: { origem: "contrato-historico" },
    evidenciaPagamento: { origem: "financeiro-historico" },
    fatos: [{ tipo: "ATIVACAO", data: "2025-01-01", evidencia: { origem: "registro-historico" } }],
  });
  if (!aplicada.ok || !aplicada.dado) throw new Error(aplicada.ok ? "Vínculo M01 sem retorno" : aplicada.erro);

  const financeiro = await prepararLoteMigracao({
    origem,
    chaveLote: `financeiro-${randomUUID()}`,
    linhas: [{
      linhaOrigem: "financeiro!2",
      tipoEntrada: "FINANCEIRO_HISTORICO",
      aluno: { id: alunoOrigemId, nome, email: `${alunoOrigemId}@example.test`, documento: `DOC-${alunoOrigemId}`, pais: "CR", fuso: "America/Costa_Rica" },
      matricula: { id: matriculaOrigemId, produtoOrigem: "produto-legado", situacao: "ATIVA", inicio: "2025-01-01", moeda: "CRC", pais: "CR" },
      financeiro: { id: `financeiro-${randomUUID()}`, tipo: "MENSALIDADE", valor: "125.00", moeda: "CRC", situacao: "PENDENTE" },
      consentimentoOrigem: "Documento financeiro histórico preservado.",
    }],
  });
  if (!financeiro.ok || !financeiro.dado) throw new Error(financeiro.ok ? "Financeiro M01 sem retorno" : financeiro.erro);
  const linhaFinanceira = await prisma.linhaPreparacaoMigracao.findFirstOrThrow({ where: { loteId: financeiro.dado.loteId } });
  entrar(financeiroId);
  const propostaFinanceira = await proporEntradaFinanceiraHistoricaMigracao({
    linhaId: linhaFinanceira.id,
    tipoCobranca: "MENSALIDADE",
    valor: "125.00",
    moeda: "CRC",
    vencimento: "2025-01-10",
    competencia: "2025-01",
    pagador: { tipo: "ALUNO", dados: { nome, paisId: catalogo.pais.id } },
    evidencia: { planilha: "financeiro!2" },
    chaveIdempotencia: randomUUID(),
  });
  if (!propostaFinanceira.ok || !propostaFinanceira.dado) throw new Error(propostaFinanceira.ok ? "Proposta M01 sem retorno" : propostaFinanceira.erro);
  entrar(secretariaId);
  const decisaoFinanceira = await decidirEntradaFinanceiraHistoricaMigracao({
    propostaId: propostaFinanceira.dado.id,
    aprovada: true,
    motivo: "Obrigação histórica conferida por pessoa distinta.",
    chaveIdempotencia: randomUUID(),
  });
  if (!decisaoFinanceira.ok || !decisaoFinanceira.dado) throw new Error(decisaoFinanceira.ok ? "Decisão M01 sem retorno" : decisaoFinanceira.erro);
  return { matriculaId: aplicada.dado.matriculaId, cobrancaId: decisaoFinanceira.dado.cobrancaId };
}

beforeEach(async () => {
  await truncarBanco();
  await prisma.configuracaoOperacional.create({ data: { fusoInstitucional: "UTC" } });
  secretariaId = (await criarUsuario([Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR])).id;
  financeiroId = (await criarUsuario([Papel.FINANCEIRO])).id;
  catalogo = await seedCatalogoMinimo();
});

it("DCT/Q117: M01 sem original assinado apto não propõe nem aplica aditivo e preserva outro contrato", async () => {
  const alvo = await criarMatriculaM01("Aluno legado alvo");
  const outro = await criarMatriculaM01("Aluno legado isolado");
  expect(await prisma.preparacaoComercialMatricula.findUnique({ where: { matriculaId: alvo.matriculaId } })).toBeNull();
  expect(await prisma.conclusaoAssinaturaContratual.count({ where: { processo: { matriculaId: alvo.matriculaId } } })).toBe(0);

  entrar(secretariaId);
  const consulta = await consultarAditivosContratuais({ matriculaId: alvo.matriculaId });
  expect(consulta).toMatchObject({
    ok: true,
    dado: { fonte: null, modelos: [], impedimento: expect.stringContaining("original com todas as assinaturas") },
  });

  const antes = {
    propostas: await prisma.propostaAditivoContratual.count(),
    aplicacoes: await prisma.aplicacaoCondicoesAditivo.count(),
    eventos: await prisma.evento.count({ where: { tipo: { in: ["AditivoContratualProposto", "CondicoesAditivoFormalizadas", "CondicoesAditivoAplicadas"] } } }),
    outraCobranca: await prisma.cobranca.findUniqueOrThrow({ where: { id: outro.cobrancaId } }),
    outraMatricula: await prisma.matricula.findUniqueOrThrow({ where: { id: outro.matriculaId } }),
  };
  const tentativa = {
    matriculaId: alvo.matriculaId,
    conclusaoOriginalId: "conclusao-legada-ausente",
    conclusaoHashEsperado: "a".repeat(64),
    modeloId: "modelo-aditivo-ausente",
    modeloHashEsperado: "b".repeat(64),
    vigenciaInicio: "2026-01-01T00:00:00Z",
    alteracoes: [{ origem: "MENSALIDADE_VALOR" as const, novo: "130.00 CRC", valorEstruturado: { tipo: "DINHEIRO" as const, valor: "130", moeda: "CRC" } }],
    motivo: "Tentativa deve exigir a origem assinada histórica importada.",
    chaveIdempotencia: "q117-legado-m01-sem-assinatura",
  };
  expect(await prepararAditivoContratual(tentativa)).toMatchObject({ ok: false, erro: expect.stringContaining("Conclusão contratual indisponível") });
  expect(await prepararAditivoContratual(tentativa)).toMatchObject({ ok: false, erro: expect.stringContaining("Conclusão contratual indisponível") });
  expect(await prisma.propostaAditivoContratual.count()).toBe(antes.propostas);
  expect(await prisma.aplicacaoCondicoesAditivo.count()).toBe(antes.aplicacoes);
  expect(await prisma.evento.count({ where: { tipo: { in: ["AditivoContratualProposto", "CondicoesAditivoFormalizadas", "CondicoesAditivoAplicadas"] } } })).toBe(antes.eventos);
  expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: outro.cobrancaId } })).toEqual(antes.outraCobranca);
  expect(await prisma.matricula.findUniqueOrThrow({ where: { id: outro.matriculaId } })).toEqual(antes.outraMatricula);
});
