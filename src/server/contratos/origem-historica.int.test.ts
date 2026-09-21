import { beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";

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
import { consultarAditivosContratuais, decidirAditivoContratual, prepararAditivoContratual } from "./aditivos";
import { prepararModeloTx } from "./modelos-tx";
import { decidirModeloContratual } from "./modelos";
import { registrarOrigemContratualHistoricaTx } from "./origem-historica-tx";
import { consultarOrigemContratualHistorica, decidirOrigemContratualHistorica } from "./origem-historica";
import { hashSubstituicao } from "./substituicao-estado";

let secretariaId: string;
let financeiroId: string;
let adminId: string;
let modeloId = "", modeloHash = "";
let catalogo: Awaited<ReturnType<typeof seedCatalogoMinimo>>;

const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

/** Cria uma fonte M01 com lote e mapa de origem montados pela fixture, seguida
 * das ações públicas de ensaio, vínculo aplicado e obrigação financeira
 * aprovada por outra pessoa. Não insere assinatura, proposta ou aplicação de
 * aditivo artificialmente. */
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
  adminId = (await criarUsuario([Papel.ADMINISTRADOR], "Conferente independente")).id;
  catalogo = await seedCatalogoMinimo();
  const campos = [["original", "ADITIVO_CONTRATO_ORIGINAL"], ["anteriores", "ADITIVO_ANTERIORES"], ["alteracoes", "ADITIVO_ALTERACOES"], ["vigencia", "ADITIVO_VIGENCIA"]] as const;
  const m = await prisma.$transaction(tx => prepararModeloTx(tx, secretariaId, { codigo: "ADITIVO_HISTORICO", versaoEsperada: 0,
    chaveIdempotencia: "modelo-aditivo-historico", motivo: "Modelo institucional de aditivo", conteudo: {
      titulo: "Aditivo ao contrato", finalidade: "ADITIVO", regimes: ["MENSALIDADE", "HORA_PARTICULAR"], aplicacao: "Alterações de condições contratadas",
      campos: campos.map(([chave, origem]) => ({ chave, origem, descricao: chave })),
      secoes: [{ titulo: "Condições e referência", texto: "{{original}}\\n{{anteriores}}\\n{{alteracoes}}\\n{{vigencia}}" }], assinaturas: [{ papel: "ALUNO", condicao: "SEMPRE" }],
    } }));
  modeloId = m.id; modeloHash = (await prisma.versaoModeloContratual.findUniqueOrThrow({ where: { id: m.id } })).conteudoHash;
  entrar(adminId);
  expect(await decidirModeloContratual({ modeloId, conteudoHash: modeloHash, aprovada: true, motivo: "Modelo conferido independentemente" })).toMatchObject({ ok: true });
});

const pdf = Buffer.from("%PDF-1.4 contrato legado assinado em papel, digitalizado para conferência");
const transcricao = { moeda: "CRC", aluno: { nome: "Aluno legado alvo", documento: "DOC-LEGADO-1" }, taxa: { valor: "50.00", vencimento: "2025-01-05" },
  aulas: { regime: "MENSALIDADE" as const, valor: "125.00", primeiroVencimento: "2025-01-10", cobertura: { referencia: "MES_CIVIL" as const, inicio: "2025-01-01" } } };
const registrar = (matriculaId: string, extra: Record<string, unknown> = {}) => prisma.$transaction(tx => registrarOrigemContratualHistoricaTx(tx, secretariaId, {
  matriculaId, referencia: "Contrato 2025/017", assinadoEm: "2024-12-20", pdfAssinado: pdf, transcricao, motivo: "Contrato legado digitalizado e transcrito para servir de fonte de aditivos.", chaveIdempotencia: "origem-historica-1", ...extra }));

it("Origem histórica: PDF + transcrição + conferência dupla viram fonte de aditivo do contrato legado; taxa/adiantamento recusados; nunca coexiste com contrato assinado", async () => {
  const alvo = await criarMatriculaM01("Aluno legado alvo");
  entrar(secretariaId);
  expect(await consultarAditivosContratuais({ matriculaId: alvo.matriculaId })).toMatchObject({ ok: true, dado: { fonte: null, impedimento: expect.stringContaining("origem contratual histórica") } });
  // Transcrição em outra moeda ou sem PDF válido é recusada; nada presumido.
  await expect(registrar(alvo.matriculaId, { transcricao: { ...transcricao, moeda: "USD" } })).rejects.toThrow(/moeda/i);
  await expect(registrar(alvo.matriculaId, { pdfAssinado: Buffer.from("nao e pdf") })).rejects.toThrow();
  const origem = await registrar(alvo.matriculaId);
  expect(await registrar(alvo.matriculaId)).toEqual(origem);
  await expect(registrar(alvo.matriculaId, { chaveIdempotencia: "origem-historica-2" })).rejects.toThrow(/aguardando conferência/);
  const gravada = await prisma.propostaOrigemContratualHistorica.findUniqueOrThrow({ where: { id: origem.id } });
  expect(gravada.pdfHash).toBe(origem.pdfHash);
  expect(hashSubstituicao(gravada.transcricao as Prisma.JsonObject)).toBe(gravada.transcricaoHash);
  // Ainda não é fonte: aditivo sobre a origem pendente é recusado (ação e banco).
  const base = { matriculaId: alvo.matriculaId, origemHistoricaId: origem.id, origemHashEsperado: gravada.entradaHash, modeloId, modeloHashEsperado: modeloHash, vigenciaInicio: "2026-02-01T00:00:00Z",
    alteracoes: [{ origem: "MENSALIDADE_VALOR" as const, novo: "130.00 CRC", valorEstruturado: { tipo: "DINHEIRO" as const, valor: "130.00", moeda: "CRC" } }], motivo: "Reajuste da mensalidade acordado com o aluno.", chaveIdempotencia: "aditivo-historico-1" };
  expect(await prepararAditivoContratual(base)).toMatchObject({ ok: false, erro: expect.stringContaining("não aprovada") });
  // Conferência dupla: o preparador não decide; hashes divergentes recusam; outro administrador aprova.
  expect(await decidirOrigemContratualHistorica({ propostaId: origem.id, aprovada: true, motivo: "Tentativa do próprio preparador.", pdfHashConferido: gravada.pdfHash, transcricaoHashConferido: gravada.transcricaoHash })).toMatchObject({ ok: false });
  entrar(adminId);
  expect(await decidirOrigemContratualHistorica({ propostaId: origem.id, aprovada: true, motivo: "Hash digitado errado.", pdfHashConferido: "0".repeat(64), transcricaoHashConferido: gravada.transcricaoHash })).toMatchObject({ ok: false, erro: expect.stringContaining("hashes conferidos divergem") });
  await expect(prisma.decisaoOrigemContratualHistorica.create({ data: { propostaId: origem.id, decisorId: secretariaId, aprovada: true, motivo: "Autoaprovação direta", pdfHashConferido: gravada.pdfHash, transcricaoHashConferido: gravada.transcricaoHash } })).rejects.toThrow();
  const decisao = await decidirOrigemContratualHistorica({ propostaId: origem.id, aprovada: true, motivo: "PDF aberto e transcrição relida linha a linha.", pdfHashConferido: gravada.pdfHash, transcricaoHashConferido: gravada.transcricaoHash });
  expect(decisao).toMatchObject({ ok: true, dado: { aprovada: true } });
  expect(await decidirOrigemContratualHistorica({ propostaId: origem.id, aprovada: true, motivo: "PDF aberto e transcrição relida linha a linha.", pdfHashConferido: gravada.pdfHash, transcricaoHashConferido: gravada.transcricaoHash })).toEqual(decisao);
  // Agora é a fonte: consulta expõe campos transcritos; taxa e adiantamento não são alteráveis.
  entrar(secretariaId);
  const consulta = await consultarAditivosContratuais({ matriculaId: alvo.matriculaId });
  expect(consulta).toMatchObject({ ok: true, dado: { impedimento: null, fonte: { tipo: "ORIGEM_HISTORICA", origemHistoricaId: origem.id, origemHash: gravada.entradaHash, conclusaoId: null, ambiente: "HISTORICO" } } });
  const campos = (consulta as { dado: { fonte: { campos: { origem: string; anterior: string }[] } } }).dado.fonte.campos;
  expect(campos).toEqual(expect.arrayContaining([{ origem: "MENSALIDADE_VALOR", rotulo: expect.any(String), anterior: "125.00 CRC" }, { origem: "TAXA_VALOR", rotulo: expect.any(String), anterior: "50.00 CRC" }, { origem: "COBERTURA_FIM", rotulo: expect.any(String), anterior: "2025-01-31" }]));
  expect(campos.some(c => c.origem === "PAGADOR_NOME" || c.origem === "ALUNO_EMAIL")).toBe(false);
  expect(await prepararAditivoContratual({ ...base, chaveIdempotencia: "aditivo-historico-taxa", alteracoes: [{ origem: "TAXA_VALOR", novo: "60.00 CRC", valorEstruturado: { tipo: "DINHEIRO", valor: "60.00", moeda: "CRC" } }] })).toMatchObject({ ok: false, erro: expect.stringContaining("taxa, primeira mensalidade ou adiantamento") });
  expect(await prepararAditivoContratual({ ...base, chaveIdempotencia: "aditivo-historico-conclusao", origemHistoricaId: undefined, origemHashEsperado: undefined, conclusaoOriginalId: "conclusao-inexistente", conclusaoHashEsperado: "a".repeat(64) })).toMatchObject({ ok: false });
  const proposta = await prepararAditivoContratual(base);
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  const p = await prisma.propostaAditivoContratual.findUniqueOrThrow({ where: { id: proposta.dado.id } });
  expect(p).toMatchObject({ conclusaoOriginalId: null, origemHistoricaId: origem.id });
  expect((p.snapshot as { base: Record<string, unknown> }).base).toMatchObject({ tipo: "ORIGEM_HISTORICA", origemHash: gravada.entradaHash, pdfAssinadoHash: gravada.pdfHash, transcricaoHash: gravada.transcricaoHash });
  entrar(adminId);
  expect(await decidirAditivoContratual({ propostaId: proposta.dado.id, propostaHashEsperado: proposta.dado.propostaHash, aprovada: true, motivo: "Reajuste conferido sobre a origem histórica." })).toMatchObject({ ok: true, dado: { aprovada: true } });
  // Segunda origem aprovada ou contrato assinado no sistema não coexistem com a origem aprovada.
  await expect(prisma.$transaction(tx => registrarOrigemContratualHistoricaTx(tx, secretariaId, { matriculaId: alvo.matriculaId, referencia: "Outro", assinadoEm: "2024-12-20", pdfAssinado: pdf, transcricao, motivo: "Segunda origem para a mesma matrícula.", chaveIdempotencia: "origem-historica-3" }))).rejects.toThrow(/já possui origem/);
  entrar(secretariaId);
  const painel = await consultarOrigemContratualHistorica({ matriculaId: alvo.matriculaId });
  expect(painel).toMatchObject({ ok: true, dado: { podeRegistrar: false, propostas: [{ id: origem.id, estado: "APROVADA", decisao: { aprovada: true, decisor: "Conferente independente" } }] } });
});

it("Origem histórica rejeitada libera novo registro e não vira fonte", async () => {
  const alvo = await criarMatriculaM01("Aluno legado rejeitado");
  entrar(secretariaId);
  const origem = await registrar(alvo.matriculaId, { transcricao: { ...transcricao, aluno: { nome: "Aluno legado rejeitado" } } });
  const gravada = await prisma.propostaOrigemContratualHistorica.findUniqueOrThrow({ where: { id: origem.id } });
  entrar(adminId);
  expect(await decidirOrigemContratualHistorica({ propostaId: origem.id, aprovada: false, motivo: "Transcrição diverge do PDF na cobertura.", pdfHashConferido: gravada.pdfHash, transcricaoHashConferido: gravada.transcricaoHash })).toMatchObject({ ok: true, dado: { aprovada: false } });
  entrar(secretariaId);
  expect(await consultarAditivosContratuais({ matriculaId: alvo.matriculaId })).toMatchObject({ ok: true, dado: { fonte: null } });
  const segunda = await registrar(alvo.matriculaId, { chaveIdempotencia: "origem-historica-4", transcricao: { ...transcricao, aluno: { nome: "Aluno legado rejeitado" } } });
  expect(segunda.id).not.toBe(origem.id);
});

