import { beforeEach, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
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
import { carregarBaseAditivoTx } from "./aditivo-estado";
import { prepararProcessoAditivoTx } from "./aditivo-envio-tx";
import { carregarConferenciaAgendaAditivoTx, registrarPropostaAgendaAditivoTx } from "./agenda-aditivo-tx";
import { consultarOpcoesConferenciaAgendaAditivo } from "./agenda-aditivo";
import { dataCivilInstitucional } from "@/server/operacao/fuso";
import { MSG_ADITIVO_ORIGEM_HISTORICA_SEM_ASSINATURA } from "@/lib/mensagens";

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

/** B1 da #285: a ação não prepara aditivo sobre a origem histórica. Para exercitar a base (carregarBaseAditivoTx) e os
 * guards do banco, a proposta é montada como a ação a montaria e inserida direto: o banco continua aceitando a fonte. */
async function inserirPropostaDireta(entrada: Record<string, unknown>, autorId = secretariaId) {
  return prisma.$transaction(async tx => {
    const contexto = await carregarBaseAditivoTx(tx, entrada);
    const ultima = await tx.propostaAditivoContratual.findFirst({ where: { matriculaId: contexto.matriculaId }, orderBy: { versao: "desc" }, select: { versao: true } });
    const versao = (ultima?.versao ?? 0) + 1, d = entrada as { motivo: string; chaveIdempotencia: string; modeloId: string };
    const snapshot = JSON.parse(JSON.stringify({ ...contexto, versao, preparadaPorId: autorId, motivo: d.motivo, entrada })) as Prisma.JsonObject;
    const entradaHash = hashSubstituicao(snapshot);
    const p = await tx.propostaAditivoContratual.create({ data: { matriculaId: contexto.matriculaId, conclusaoOriginalId: null, origemHistoricaId: contexto.origemHistoricaId, modeloId: d.modeloId,
      versao, preparadaPorId: autorId, vigenciaInicio: new Date(contexto.vigenciaInicio), motivo: d.motivo, baseHash: contexto.baseHash, alteracoesHash: contexto.alteracoesHash,
      snapshot, entradaHash, chaveIdempotencia: d.chaveIdempotencia } });
    return { id: p.id, versao, propostaHash: entradaHash };
  });
}

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
  // Ainda não é fonte: a base do aditivo sobre a origem pendente é recusada.
  const base = { matriculaId: alvo.matriculaId, origemHistoricaId: origem.id, origemHashEsperado: gravada.entradaHash, modeloId, modeloHashEsperado: modeloHash, vigenciaInicio: "2026-02-01T00:00:00Z",
    alteracoes: [{ origem: "MENSALIDADE_VALOR" as const, novo: "130.00 CRC", valorEstruturado: { tipo: "DINHEIRO" as const, valor: "130.00", moeda: "CRC" } }], motivo: "Reajuste da mensalidade acordado com o aluno.", chaveIdempotencia: "aditivo-historico-1" };
  await expect(prisma.$transaction(tx => carregarBaseAditivoTx(tx, base))).rejects.toThrow(/não aprovada/);
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
  // B1 da #285: enquanto o dono não decide o ambiente de assinatura, a ação não prepara aditivo sobre a origem histórica
  // e diz o porquê (não a mensagem genérica de ambiente do envio). Nada é gravado.
  expect(await prepararAditivoContratual(base)).toEqual({ ok: false, erro: MSG_ADITIVO_ORIGEM_HISTORICA_SEM_ASSINATURA });
  expect(await prisma.propostaAditivoContratual.count({ where: { matriculaId: alvo.matriculaId } })).toBe(0);
  // A base continua correta (o limite é só de formalização): uma proposta montada como a ação montaria entra no banco...
  const proposta = await inserirPropostaDireta(base);
  const p = await prisma.propostaAditivoContratual.findUniqueOrThrow({ where: { id: proposta.id } });
  expect(p).toMatchObject({ conclusaoOriginalId: null, origemHistoricaId: origem.id });
  expect((p.snapshot as { base: Record<string, unknown> }).base).toMatchObject({ tipo: "ORIGEM_HISTORICA", origemHash: gravada.entradaHash, pdfAssinadoHash: gravada.pdfHash, transcricaoHash: gravada.transcricaoHash, ambiente: "HISTORICO" });
  // ...mas não é aprovada nem enviada para assinatura, cada uma com a mensagem específica; rejeitar continua possível.
  entrar(adminId);
  expect(await decidirAditivoContratual({ propostaId: proposta.id, propostaHashEsperado: proposta.propostaHash, aprovada: true, motivo: "Reajuste conferido sobre a origem histórica." })).toEqual({ ok: false, erro: MSG_ADITIVO_ORIGEM_HISTORICA_SEM_ASSINATURA });
  await expect(prisma.$transaction(tx => prepararProcessoAditivoTx(tx, adminId, { matriculaId: alvo.matriculaId, propostaId: proposta.id, artefatoId: "artefato", conferenciaId: "conferencia", fornecedor: "ZAPSIGN", ambiente: "PRODUCAO" })))
    .rejects.toThrow(MSG_ADITIVO_ORIGEM_HISTORICA_SEM_ASSINATURA);
  expect(await decidirAditivoContratual({ propostaId: proposta.id, propostaHashEsperado: proposta.propostaHash, aprovada: false, motivo: "Aguarda decisão sobre a assinatura do contrato legado." })).toMatchObject({ ok: true, dado: { aprovada: false } });
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


it("Origem histórica no banco: moeda da matrícula, aditivo de taxa recusado sem passar pela ação e um Evento por escrita", async () => {
  const alvo = await criarMatriculaM01("Aluno legado no banco");
  entrar(secretariaId);
  const projecaoUsd = { condicoes: { moeda: "USD", aulas: { regime: "MENSALIDADE" } }, documento: { campos: [] } };
  // O guard do banco confere a moeda da matrícula, como a ação: a inserção direta em outra moeda é recusada.
  await expect(prisma.propostaOrigemContratualHistorica.create({ data: {
    matriculaId: alvo.matriculaId, referencia: "Direto", assinadoEm: new Date("2024-12-20T00:00:00Z"), pdfAssinado: pdf,
    pdfHash: createHash("sha256").update(pdf).digest("hex"), transcricao: { moeda: "USD" }, transcricaoHash: "a".repeat(64),
    projecao: projecaoUsd, projecaoHash: "b".repeat(64), preparadorId: secretariaId, motivo: "Inserção direta", chaveIdempotencia: "origem-direta-1", entradaHash: "c".repeat(64),
  } })).rejects.toThrow(/moeda da matrícula/);
  const origem = await registrar(alvo.matriculaId, { transcricao: { ...transcricao, aluno: { nome: "Aluno legado no banco" } } });
  expect(await registrar(alvo.matriculaId, { transcricao: { ...transcricao, aluno: { nome: "Aluno legado no banco" } } })).toEqual(origem);
  const gravada = await prisma.propostaOrigemContratualHistorica.findUniqueOrThrow({ where: { id: origem.id } });
  entrar(adminId);
  const conferencia = { propostaId: origem.id, aprovada: true, motivo: "PDF e transcrição conferidos.", pdfHashConferido: gravada.pdfHash, transcricaoHashConferido: gravada.transcricaoHash };
  expect(await decidirOrigemContratualHistorica(conferencia)).toMatchObject({ ok: true });
  expect(await decidirOrigemContratualHistorica(conferencia)).toMatchObject({ ok: true });
  const eventos = await prisma.evento.findMany({ where: { agregadoTipo: "Matricula", agregadoId: alvo.matriculaId, tipo: { in: ["OrigemContratualHistoricaRegistrada", "OrigemContratualHistoricaDecidida"] } }, select: { tipo: true, autorId: true } });
  expect(eventos.sort((a, b) => a.tipo.localeCompare(b.tipo))).toEqual([{ tipo: "OrigemContratualHistoricaDecidida", autorId: adminId }, { tipo: "OrigemContratualHistoricaRegistrada", autorId: secretariaId }]);
  // Proposta de mensalidade montada como a ação montaria (B1: a ação não prepara sobre a origem); uma versão seguinte
  // que altere a taxa, inserida direto no banco, é recusada pelo guard.
  const proposta = await inserirPropostaDireta({ matriculaId: alvo.matriculaId, origemHistoricaId: origem.id, origemHashEsperado: gravada.entradaHash, modeloId, modeloHashEsperado: modeloHash, vigenciaInicio: "2026-02-01T00:00:00Z",
    alteracoes: [{ origem: "MENSALIDADE_VALOR", novo: "130.00 CRC", valorEstruturado: { tipo: "DINHEIRO", valor: "130.00", moeda: "CRC" } }], motivo: "Reajuste da mensalidade acordado com o aluno.", chaveIdempotencia: "aditivo-historico-banco" });
  const p = await prisma.propostaAditivoContratual.findUniqueOrThrow({ where: { id: proposta.id } });
  const snapshot = { ...(p.snapshot as Prisma.JsonObject), versao: p.versao + 1, alteracoes: [{ campo: "TAXA_VALOR", rotulo: "Taxa", anterior: "50.00 CRC", novo: "60.00 CRC" }] };
  await expect(prisma.propostaAditivoContratual.create({ data: {
    matriculaId: p.matriculaId, origemHistoricaId: p.origemHistoricaId, modeloId: p.modeloId, versao: p.versao + 1, preparadaPorId: p.preparadaPorId, vigenciaInicio: p.vigenciaInicio,
    motivo: p.motivo, baseHash: p.baseHash, alteracoesHash: p.alteracoesHash, snapshot, entradaHash: "d".repeat(64), chaveIdempotencia: "aditivo-historico-taxa-direto",
  } })).rejects.toThrow(/não admite aditivo de taxa/);
  // A proposta é imutável: o trigger recusa a troca de fonte antes de qualquer CHECK.
  await expect(prisma.$executeRaw`UPDATE "PropostaAditivoContratual" SET "conclusaoOriginalId" = 'x' WHERE id = ${p.id}`).rejects.toThrow();
  // CHECK de fonte única exercitado de fato: com triggers (e FKs) desligados, só a constraint resta.
  await expect(adulterar(Prisma.sql`UPDATE "PropostaAditivoContratual" SET "conclusaoOriginalId" = 'x' WHERE id = ${p.id}`)).rejects.toThrow(/PropostaAditivoContratual_fonte_unica/);
  await expect(adulterar(Prisma.sql`UPDATE "PropostaAditivoContratual" SET "origemHistoricaId" = NULL WHERE id = ${p.id}`)).rejects.toThrow(/PropostaAditivoContratual_fonte_unica/);
  const fotografia = (fontes: { conclusao: string | null; origem: string | null }, chave: string) => adulterar(Prisma.sql`
    INSERT INTO "PropostaAgendaAditivoParticular" (id,"matriculaId","conclusaoFonteId","origemHistoricaId","preparadorId",fotografia,"fotografiaHash",pendencias,"chaveIdempotencia","entradaHash")
    VALUES (${randomUUID()},${alvo.matriculaId},${fontes.conclusao},${fontes.origem},${secretariaId},'{}'::jsonb,${"e".repeat(64)},'[]'::jsonb,${chave},${"f".repeat(64)})`);
  await expect(fotografia({ conclusao: "x", origem: origem.id }, "agenda-duas-fontes")).rejects.toThrow(/PropostaAgendaAditivoParticular_fonte_unica/);
  await expect(fotografia({ conclusao: null, origem: null }, "agenda-sem-fonte")).rejects.toThrow(/PropostaAgendaAditivoParticular_fonte_unica/);
});

const pdfAdulterado = Buffer.from("%PDF-1.4 outro documento colocado no lugar do contrato legado");
/** Altera uma linha imutável sem passar pelos triggers, para simular adulteração fora do sistema. */
const adulterar = (sql: Prisma.Sql) => prisma.$transaction(async tx => {
  await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
  await tx.$executeRaw(sql);
});

it("Agenda particular sobre origem histórica: integridade do PDF e da transcrição reconferida; registro recusado enquanto o aditivo não segue para assinatura", async () => {
  const alvo = await criarMatriculaM01("Aluno legado agenda");
  entrar(secretariaId);
  const origem = await registrar(alvo.matriculaId, { transcricao: { ...transcricao, aluno: { nome: "Aluno legado agenda" } } });
  const gravada = await prisma.propostaOrigemContratualHistorica.findUniqueOrThrow({ where: { id: origem.id } });
  entrar(adminId);
  expect(await decidirOrigemContratualHistorica({ propostaId: origem.id, aprovada: true, motivo: "PDF e transcrição conferidos.", pdfHashConferido: gravada.pdfHash, transcricaoHashConferido: gravada.transcricaoHash })).toMatchObject({ ok: true });
  const calendario = await prisma.versaoCalendarioEscolar.create({ data: { versao: 1, preparadorId: secretariaId, fusoInstitucional: "UTC", periodos: [], motivo: "Calendário de teste", chaveIdempotencia: "calendario-origem-historica", entradaHash: "fixture" } });
  await prisma.decisaoCalendarioEscolar.create({ data: { calendarioId: calendario.id, decisorId: adminId, aprovada: true, motivo: "Calendário conferido" } });
  const professor = await criarUsuario([Papel.PROFESSOR], "Professor particular");
  await prisma.matricula.update({ where: { id: alvo.matriculaId }, data: { status: "ATIVA" } });
  const encontro = await prisma.encontroAgenda.create({ data: { matriculaId: alvo.matriculaId, professorId: professor.id, preparadorId: secretariaId, inicio: new Date("2099-10-10T15:00:00Z"), fim: new Date("2099-10-10T16:00:00Z"), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Agenda contratada", chaveIdempotencia: "origem-historica-encontro", entradaHash: "fixture" } });
  const entrada = { matriculaId: alvo.matriculaId, encontros: [{ encontroId: encontro.id, professorNovoId: professor.id, inicioNovo: "2099-10-12T15:00:00Z", fimNovo: "2099-10-12T16:00:00Z", duracaoMinutos: 60, fusoOrigem: "UTC" }] };

  // R2 (C6): a tela de opções sabe que a fonte é a origem histórica e avisa antes da conferência.
  entrar(secretariaId);
  expect(await consultarOpcoesConferenciaAgendaAditivo({ matriculaId: alvo.matriculaId })).toMatchObject({ ok: true, dado: { fonteOrigemHistorica: true, encontros: [expect.objectContaining({ id: encontro.id })] } });
  // Íntegra: a conferência (somente leitura) usa a origem histórica como fonte.
  const conferencia = await prisma.$transaction(tx => carregarConferenciaAgendaAditivoTx(tx, secretariaId, entrada));
  expect(conferencia).toMatchObject({ somenteConsulta: true, fonte: { tipo: "ORIGEM_HISTORICA", conclusaoId: origem.id, conclusaoHash: gravada.entradaHash }, pendencias: [] });
  // B1 da #285: a fotografia só serve ao aditivo, que ainda não segue para assinatura; nada é gravado.
  await expect(prisma.$transaction(tx => registrarPropostaAgendaAditivoTx(tx, secretariaId, { ...entrada, chaveIdempotencia: "agenda-origem-historica-1" }))).rejects.toThrow(MSG_ADITIVO_ORIGEM_HISTORICA_SEM_ASSINATURA);
  expect(await prisma.propostaAgendaAditivoParticular.count({ where: { matriculaId: alvo.matriculaId } })).toBe(0);

  // PDF trocado fora do sistema: a agenda reconfere os bytes como a base do aditivo (carregarFonteBaseTx).
  await adulterar(Prisma.sql`UPDATE "PropostaOrigemContratualHistorica" SET "pdfAssinado" = ${pdfAdulterado} WHERE id = ${origem.id}`);
  await expect(prisma.$transaction(tx => carregarConferenciaAgendaAditivoTx(tx, secretariaId, entrada))).rejects.toThrow(/origem histórica e sua integridade/);
  await adulterar(Prisma.sql`UPDATE "PropostaOrigemContratualHistorica" SET "pdfAssinado" = ${pdf} WHERE id = ${origem.id}`);
  expect(await prisma.$transaction(tx => carregarConferenciaAgendaAditivoTx(tx, secretariaId, entrada))).toMatchObject({ fonte: { tipo: "ORIGEM_HISTORICA" } });
  // Transcrição alterada depois da conferência dupla: também recusada.
  await adulterar(Prisma.sql`UPDATE "PropostaOrigemContratualHistorica" SET transcricao = jsonb_set(transcricao, '{aulas,valor}', '"999.00"') WHERE id = ${origem.id}`);
  await expect(prisma.$transaction(tx => carregarConferenciaAgendaAditivoTx(tx, secretariaId, entrada))).rejects.toThrow(/origem histórica e sua integridade/);
});

it("Origem histórica: data de assinatura posterior a hoje no fuso da escola é recusada na ação e no banco", async () => {
  const alvo = await criarMatriculaM01("Aluno legado datado");
  const t = { ...transcricao, aluno: { nome: "Aluno legado datado" } };
  // Kiritimati (UTC+14) está sempre ao menos um dia civil à frente de Pago Pago (UTC−11): o "hoje" depende do fuso da escola.
  const hojeKiritimati = dataCivilInstitucional(new Date(), "Pacific/Kiritimati");
  const amanha = (civil: string) => { const d = new Date(`${civil}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
  await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { fusoInstitucional: "Pacific/Pago_Pago" } });
  entrar(secretariaId);
  await expect(registrar(alvo.matriculaId, { transcricao: t, assinadoEm: hojeKiritimati })).rejects.toThrow(/não pode ser posterior a hoje/);
  // O guard do banco aplica a mesma regra a uma inserção direta.
  await expect(prisma.propostaOrigemContratualHistorica.create({ data: {
    matriculaId: alvo.matriculaId, referencia: "Direto", assinadoEm: new Date(`${hojeKiritimati}T00:00:00Z`), pdfAssinado: pdf,
    pdfHash: createHash("sha256").update(pdf).digest("hex"), transcricao: { moeda: "CRC" }, transcricaoHash: "a".repeat(64),
    projecao: { condicoes: { moeda: "CRC", aulas: { regime: "MENSALIDADE" } }, documento: { campos: [] } }, projecaoHash: "b".repeat(64), preparadorId: secretariaId, motivo: "Inserção direta", chaveIdempotencia: "origem-direta-futura", entradaHash: "c".repeat(64),
  } })).rejects.toThrow(/posterior a hoje no fuso da escola/);
  // Na escola em Kiritimati, a mesma data é hoje e vale; o dia seguinte, não.
  await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { fusoInstitucional: "Pacific/Kiritimati" } });
  await expect(registrar(alvo.matriculaId, { transcricao: t, assinadoEm: amanha(hojeKiritimati), chaveIdempotencia: "origem-historica-amanha" })).rejects.toThrow(/não pode ser posterior a hoje/);
  const origem = await registrar(alvo.matriculaId, { transcricao: t, assinadoEm: hojeKiritimati, chaveIdempotencia: "origem-historica-hoje" });
  // Fuso inválido gravado (validado na gravação; aqui forçado sem triggers): erro de configuração legível, não ZodError.
  await adulterar(Prisma.sql`UPDATE "ConfiguracaoOperacional" SET "fusoInstitucional" = 'GMT-3' WHERE id = 'escola'`);
  await expect(registrar(alvo.matriculaId, { transcricao: t, chaveIdempotencia: "origem-historica-fuso" })).rejects.toThrow("O fuso institucional configurado (GMT-3) não é reconhecido. Corrija a configuração da escola antes de registrar a origem histórica.");
  expect((await prisma.propostaOrigemContratualHistorica.findUniqueOrThrow({ where: { id: origem.id } })).assinadoEm.toISOString().slice(0, 10)).toBe(hojeKiritimati);
});
