import { beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { carregarImpactosCorrecaoReposicaoTx, carregarImpactosFrequenciaAulaTx } from "./impactos-reposicao-tx";
import { prepararLoteMigracao } from "@/server/migracao/acoes";
import { ensaiarVinculoMigracao, revisarCorrespondenciaProdutoMigracao, revisarCorrespondenciaStatusMatriculaMigracao, revisarCorrespondenciaTurmaMigracao } from "@/server/migracao/ensaio-vinculo";
import { aplicarVinculoMigracao } from "@/server/migracao/aplicar-vinculo";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import { prepararRegraAvaliacaoTx, decidirRegraAvaliacaoTx } from "./regras-tx";
import { proporCorrecaoConclusaoReposicao, decidirCorrecaoConclusaoReposicao } from "@/server/diario/reposicao-individual";
import { consultarCorrecoesConclusaoReposicao } from "@/server/diario/correcao-reposicao-consulta";
import { consultarCasoRevisaoProgressao } from "./revisao-progressao-consulta";
import { listarRevisoesPorCorrecao } from "./revisoes-pendentes";
import { revisarResolucaoRevisaoProgressao, proporResolucaoRevisaoProgressao, decidirResolucaoRevisaoProgressao } from "./resolucao-revisao-progressao";

function ok<T extends { ok: boolean; dado?: unknown }>(r: T): asserts r is T & { ok: true; dado: NonNullable<T["dado"]> } {
  expect(r, JSON.stringify(r)).toMatchObject({ ok: true });
  if (!r.ok || r.dado == null) throw new Error(JSON.stringify(r));
}

async function corrigirReposicao() {
  await prisma.decisaoReposicaoIndividual.create({ data: { reposicaoId, decisorId: gestorId, aprovada: true, motivo: "Reposição autorizada para avaliar a entrega." } });
  await prisma.designacaoAvaliadorReposicaoIndividual.create({ data: { reposicaoId, professorId, designadorId: gestorId,
    inicio: new Date("2026-01-01T00:00:00Z"), motivo: "Professor designado para a reposição." } });
  const conta = await prisma.contaPortalAluno.create({ data: { alunoId } });
  const entrega = await prisma.entregaReposicaoGravacao.create({ data: { reposicaoId, alunoId, contaPortalAlunoId: conta.id,
    versao: 1, resumo: "Resumo do aluno para avaliação.", atividade: "Atividade apresentada.", evidencia: "Entrega da fixture.", entregueEm: new Date("2026-01-11T00:00:00Z") } });
  const conclusao = await prisma.conclusaoReposicaoIndividual.create({ data: { reposicaoId, versao: 1, concluida: true, entregaId: entrega.id,
    validadaEm: new Date("2026-01-11T01:00:00Z"), validadaPorId: professorId, concluidaPorId: professorId, evidencia: "Validação docente original." } });
  authMock.mockResolvedValue({ user: { id: professorId } });
  const proposta = await proporCorrecaoConclusaoReposicao({ reposicaoId, conclusaoId: conclusao.id, versaoAnterior: 0, concluida: false,
    motivo: "Correção que altera fonte da frequência do fechamento.", evidencia: "Evidência para retirar a regularização." });
  ok(proposta);
  authMock.mockResolvedValue({ user: { id: gestorId } });
  const revisao = await consultarCorrecoesConclusaoReposicao({ reposicaoId });
  ok(revisao);
  const entrada = { correcaoId: proposta.dado.id, propostaHash: proposta.dado.propostaHash,
    impactosHash: revisao.dado.correcoes[0]!.impactosHash!, aprovar: true, motivo: "Aprovação independente das fontes e dependências." };
  const decisao = await decidirCorrecaoConclusaoReposicao(entrada);
  ok(decisao);
  expect(await decidirCorrecaoConclusaoReposicao(entrada)).toEqual(decisao);
  return decisao.dado;
}

async function publicarRegra(nivelId: string) {
  const admin = await criarUsuario(["ADMINISTRADOR"]);
  const proposta = await prisma.$transaction(tx => prepararRegraAvaliacaoTx(tx, gestorId, { nivelId,
    versaoEsperada: 0, conteudo: regraAvaliacaoTeste(), motivo: "Regra fictícia para seleção de dependências.", chaveIdempotencia: `regra-${nivelId}` }));
  const regra = await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: proposta.id } });
  await prisma.$transaction(tx => decidirRegraAvaliacaoTx(tx, admin.id, { regraId: regra.id, conteudoHash: regra.conteudoHash,
    aprovada: true, motivo: "Publicação independente da regra de teste." }));
}

// Fixture persistida de dependência: esta suíte verifica alcance, não o cálculo
// de notas/fechamento, coberto nas suítes próprias. Nenhum guard é desativado.
async function criarPedido(alocacaoOrigemId: string, turmaDestinoId: string, status: "APROVADA" | "EXECUTADA" = "APROVADA") {
  const a = await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: alocacaoOrigemId }, include: { turma: true } });
  const regraId = a.turma.regraAvaliacaoId!;
  const contexto = { matriculaId: a.matriculaId!, nivelId: a.turma.nivelId, alocacaoReferenciaId: a.id, regraId };
  const fechamento = await prisma.fechamentoAcademico.create({ data: { ...contexto, versao: 1,
    snapshot: { versao: 1, contexto, consolidado: { resultado: { completa: true, atendeRequisitosNotas: true } },
      frequencia: {}, pendenciasPorVinculo: [], fontesOficiais: [], elegibilidade: { podeFechar: true, podeProgredir: true, situacao: "SUFICIENTE", pendencias: [] } },
    estadoHash: "a".repeat(64), entradaHash: "b".repeat(64), resultadoSuficiente: true, motivo: "Fechamento sintético para fixture de seleção de impactos.",
    confirmadoPorId: gestorId, chaveIdempotencia: `fechamento-${a.id}`,
  } });
  const movimentacao = status === "EXECUTADA" ? await prisma.movimentacaoAluno.create({ data: {
    alunoId: a.alunoId, matriculaId: a.matriculaId, tipo: "TROCA_TURMA", turmaOrigemId: a.turmaId, turmaDestinoId,
    usuarioId: secretariaId, motivo: "Movimentação sintética da dependência executada.",
  } }) : null;
  return prisma.solicitacaoMudancaAcademica.create({ data: { alunoId: a.alunoId, matriculaId: a.matriculaId,
    alocacaoOrigemId: a.id, turmaOrigemId: a.turmaId, turmaDestinoId, motivo: "Pedido da fixture de impacto.", horarioCompativel: true,
    snapshot: { matriculaOrigemId: a.matriculaId }, status, solicitanteId: secretariaId, aprovadorId: gestorId, motivoDecisao: "Conferência da fixture.",
    decididoEm: new Date(), ...(movimentacao ? { executadoEm: new Date(), executorId: secretariaId, movimentacaoId: movimentacao.id, motivoExecucao: "Execução registrada na fixture." } : {}),
    fechamentoAcademicoId: fechamento.id, fechamentoEstadoHash: fechamento.estadoHash,
  } });
}

let alunoId: string, matriculaId: string, turmaId: string, alocacaoId: string, aulaId: string, reposicaoId: string, gestorId: string, secretariaId: string, professorId: string;

async function carregar() { return prisma.$transaction(tx => carregarImpactosCorrecaoReposicaoTx(tx, { reposicaoId })); }

beforeEach(async () => {
  await truncarBanco(); const c = await seedCatalogoMinimo();
  gestorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  secretariaId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  professorId = (await criarUsuario(["PROFESSOR"])).id;
  const nivel = await prisma.nivel.create({ data: { idiomaId: c.idioma.id, codigo: "A1-IMP", ordem: 1 } });
  await publicarRegra(nivel.id);
  turmaId = (await prisma.turma.create({ data: { modalidadeId: c.modalidade.id, nivelId: nivel.id, professorId, dataInicio: new Date("2099-01-01T00:00:00Z"), status: "ABERTA" } })).id;
  await prisma.turma.update({ where: { id: turmaId }, data: { dataInicio: new Date("2026-01-01T00:00:00Z"), status: "EM_ANDAMENTO" } });
  alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Aluno impacto", paisId: c.pais.id } })).id;
  matriculaId = (await prisma.matricula.create({ data: { alunoId, produtoId: c.produto.id, paisId: c.pais.id, moeda: "CRC", status: "ATIVA", ativadaEm: new Date("2026-01-01T00:00:00Z") } })).id;
  alocacaoId = (await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId, turmaId, criadoEm: new Date("2026-01-01T00:00:00Z") } })).id;
  const aula = await prisma.encontroAgenda.create({ data: { turmaId, professorId, preparadorId: secretariaId, inicio: new Date("2026-01-10T10:00:00Z"), fim: new Date("2026-01-10T11:00:00Z"), fusoOrigem: "UTC", finalidade: "AULA", status: "PREVISTO", motivo: "Aula origem", chaveIdempotencia: "impacto-repo-aula", entradaHash: "fixture", diario: { create: { turmaId, professorId, ocorridaEm: new Date("2026-01-10T10:00:00Z"), conteudo: "Chamada da aula", registros: { create: { alunoId, matriculaId, nomeAluno: "Aluno impacto", presente: false, participacao: "FALTA" } } } } } });
  await prisma.encontroAgenda.update({ where: { id: aula.id }, data: { status: "MINISTRADO" } });
  aulaId = aula.id;
  reposicaoId = (await prisma.reposicaoIndividual.create({ data: { aulaOriginalId: aulaId, matriculaId, modalidade: "GRAVACAO", solicitanteId: secretariaId, motivo: "Reposição", evidencia: "Falta", chaveIdempotencia: "impacto-repo", entradaHash: "fixture" } })).id;
});

it("seleciona mesma matrícula/nível após troca sem equivalência e exclui outra matrícula e nível", async () => {
  const origem = await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } });
  const destino = await prisma.turma.create({ data: { modalidadeId: origem.modalidadeId, nivelId: origem.nivelId, professorId, dataInicio: new Date("2099-01-01T00:00:00Z") } });
  await prisma.alocacaoTurma.update({ where: { id: alocacaoId }, data: { ativa: false, encerradaEm: new Date("2026-01-12T00:00:00Z") } });
  const vinculoDestino = await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId, turmaId: destino.id, criadoEm: new Date("2026-01-12T00:00:00Z") } });
  const pedido = await criarPedido(vinculoDestino.id, turmaId, "EXECUTADA");
  expect(await prisma.aplicacaoEquivalenciaAvaliacao.count()).toBe(0);

  const idiomaId = (await prisma.nivel.findUniqueOrThrow({ where: { id: origem.nivelId } })).idiomaId;
  const nivelOutro = await prisma.nivel.create({ data: { idiomaId, codigo: "A2-IMP", ordem: 2 } });
  await publicarRegra(nivelOutro.id);
  const turmaOutroNivel = await prisma.turma.create({ data: { modalidadeId: origem.modalidadeId, nivelId: nivelOutro.id, professorId, dataInicio: new Date("2099-01-01T00:00:00Z") } });
  await prisma.alocacaoTurma.update({ where: { id: vinculoDestino.id }, data: { ativa: false, encerradaEm: new Date("2026-02-01T00:00:00Z") } });
  const outroNivel = await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId, turmaId: turmaOutroNivel.id, criadoEm: new Date("2026-02-01T00:00:00Z") } });
  const pedidoOutroNivel = await criarPedido(outroNivel.id, turmaId);

  const original = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const outraMatricula = await prisma.matricula.create({ data: { alunoId, produtoId: original.produtoId, paisId: original.paisId, moeda: "CRC", status: "ATIVA" } });
  const outraAlocacao = await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId: outraMatricula.id, turmaId, criadoEm: new Date("2026-01-01T00:00:00Z") } });
  await criarPedido(outraAlocacao.id, destino.id, "EXECUTADA");
  expect(await carregar()).toMatchObject({ matriculaId, alocacaoFonteId: alocacaoId, impactos: [{ id: pedido.id, status: "EXECUTADA" }] });
  const movimentosAntes = await prisma.movimentacaoAluno.findMany({ orderBy: { id: "asc" } });
  const decisao = await corrigirReposicao();
  const casos = await prisma.casoRevisaoProgressao.findMany({ where: { decisaoCorrecaoConclusaoReposicaoId: decisao.id } });
  expect(casos).toEqual([expect.objectContaining({ matriculaId, alocacaoFonteId: alocacaoId, solicitacaoId: pedido.id })]);
  expect(await prisma.movimentacaoAluno.findMany({ orderBy: { id: "asc" } })).toEqual(movimentosAntes);
  const consulta = await consultarCasoRevisaoProgressao({ casoId: casos[0]!.id });
  ok(consulta);
  expect(consulta.dado).toMatchObject({ origem: { tipo: "REPOSICAO", decisaoId: decisao.id }, situacao: "PENDENTE_REVISAO" });
  const fila = await listarRevisoesPorCorrecao({});
  ok(fila);
  expect(fila.dado.itens).toEqual([expect.objectContaining({ id: decisao.id, tipo: "REPOSICAO", impactos: [expect.objectContaining({ casoId: casos[0]!.id })] })]);
  const caso = casos[0]!;
  await expect(prisma.casoRevisaoProgressao.create({ data: { matriculaId, solicitacaoId: pedido.id,
    alocacaoFonteId: outroNivel.id, decisaoCorrecaoConclusaoReposicaoId: decisao.id, snapshotImpacto: caso.snapshotImpacto! } })).rejects.toThrow();
  await expect(prisma.casoRevisaoProgressao.create({ data: { matriculaId, solicitacaoId: pedidoOutroNivel.id,
    alocacaoFonteId: alocacaoId, decisaoCorrecaoConclusaoReposicaoId: decisao.id,
    snapshotImpacto: { ...(caso.snapshotImpacto as Record<string, string | null>), id: pedidoOutroNivel.id } } })).rejects.toThrow();
  const revisaoResolucao = await revisarResolucaoRevisaoProgressao({ solicitacaoId: pedido.id, acao: "ENCAMINHAR_REGULARIZACAO" });
  ok(revisaoResolucao);
  const propostaResolucao = await proporResolucaoRevisaoProgressao({ solicitacaoId: pedido.id, acao: "ENCAMINHAR_REGULARIZACAO",
    estadoHash: revisaoResolucao.dado.estadoHash, versaoEsperada: revisaoResolucao.dado.versaoAtual,
    motivo: "Gestão encaminha a dependência para regularização.", chaveIdempotencia: "encaminhar-reposicao" });
  ok(propostaResolucao);
  const admin = await criarUsuario(["ADMINISTRADOR"]);
  authMock.mockResolvedValue({ user: { id: admin.id } });
  ok(await decidirResolucaoRevisaoProgressao({ propostaId: propostaResolucao.dado.id, estadoHash: revisaoResolucao.dado.estadoHash,
    aprovada: true, motivo: "Administração confere o encaminhamento sem encerrar o caso." }));
  const encaminhado = await consultarCasoRevisaoProgressao({ casoId: caso.id });
  ok(encaminhado);
  expect(encaminhado.dado.situacao).toBe("PENDENTE_REVISAO");
  expect(await prisma.movimentacaoAluno.findMany({ orderBy: { id: "asc" } })).toEqual(movimentosAntes);
});
it("recusa vínculo histórico ambíguo ou encerrado sem limite", async () => {
  await prisma.alocacaoTurma.update({ where: { id: alocacaoId }, data: { ativa: false, encerradaEm: new Date("2026-01-20T00:00:00Z") } });
  await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId, turmaId, ativa: false, criadoEm: new Date("2026-01-05T00:00:00Z"), encerradaEm: new Date("2026-01-19T00:00:00Z") } });
  await expect(carregar()).rejects.toThrow("único vínculo histórico");
});

it("usa início inclusivo e fim exclusivo ao localizar o vínculo da aula original", async () => {
  await prisma.alocacaoTurma.update({ where: { id: alocacaoId }, data: { criadoEm: new Date("2026-01-10T10:00:00.000Z") } });
  expect(await carregar()).toMatchObject({ alocacaoFonteId: alocacaoId });
  await prisma.alocacaoTurma.update({ where: { id: alocacaoId }, data: { encerradaEm: new Date("2026-01-10T10:00:00.000Z"), ativa: false } });
  await expect(carregar()).rejects.toThrow("único vínculo histórico");
});

it("recusa vínculo inativo sem data de encerramento", async () => {
  await prisma.alocacaoTurma.update({ where: { id: alocacaoId }, data: { ativa: false, encerradaEm: null } });
  // O seletor temporal já exclui o vínculo sem intervalo histórico conferível.
  await expect(carregar()).rejects.toThrow("único vínculo histórico");
});

it("inclui a dependência aprovada ainda não executada", async () => {
  const origem = await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } });
  const destino = await prisma.turma.create({ data: { modalidadeId: origem.modalidadeId, nivelId: origem.nivelId, professorId, dataInicio: new Date("2099-01-01T00:00:00Z") } });
  const pedido = await criarPedido(alocacaoId, destino.id);
  expect((await carregar()).impactos).toEqual([expect.objectContaining({ id: pedido.id, status: "APROVADA", turmaDestinoId: destino.id })]);
});

it("M01: vigência histórica seleciona fonte real, respeita fronteiras e recusa ambiguidade", async () => {
  const admin = await criarUsuario(["ADMINISTRADOR"]); authMock.mockResolvedValue({ user: { id: admin.id } });
  const produto = await prisma.produto.findFirstOrThrow();
  const paisId = (await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).paisId;
  const turmaA = await prisma.turma.create({ data: { modalidadeId: produto.modalidadeId, nivelId: (await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } })).nivelId, professorId, dataInicio: new Date("2026-01-01T00:00:00Z") } });
  const turmaB = await prisma.turma.create({ data: { modalidadeId: produto.modalidadeId, nivelId: (await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } })).nivelId, professorId, dataInicio: new Date("2026-01-01T00:00:00Z") } });
  const origem = "M01_TEMPORAL";
  const lote = await prepararLoteMigracao({ origem, chaveLote: "m01-temporal-fontes", linhas: [
    { linhaOrigem: "v!a", tipoEntrada: "VINCULO_MATRICULA", aluno: { id: "aluno-temporal", nome: "Ana temporal", email: "ana-temporal@example.test", documento: "TEMP-1", pais: "CR", fuso: "America/Costa_Rica" }, turma: { id: "turma-a", codigo: "A" }, matricula: { id: "mat-temporal", produtoOrigem: "produto-temporal", situacao: "ATIVA", inicio: "2025-01-01", moeda: "CRC", pais: "CR" }, alocacao: { inicio: "2025-01-01", fim: "2025-02-01" }, consentimentoOrigem: "fonte histórica A" },
    { linhaOrigem: "v!b", tipoEntrada: "VINCULO_MATRICULA", aluno: { id: "aluno-temporal", nome: "Ana temporal", email: "ana-temporal@example.test", documento: "TEMP-1", pais: "CR", fuso: "America/Costa_Rica" }, turma: { id: "turma-b", codigo: "B" }, matricula: { id: "mat-temporal", produtoOrigem: "produto-temporal", situacao: "ATIVA", inicio: "2025-01-01", moeda: "CRC", pais: "CR" }, alocacao: { inicio: "2025-02-01" }, consentimentoOrigem: "fonte histórica B" },
    { linhaOrigem: "v!c", tipoEntrada: "VINCULO_MATRICULA", aluno: { id: "aluno-temporal", nome: "Ana temporal", email: "ana-temporal@example.test", documento: "TEMP-1", pais: "CR", fuso: "America/Costa_Rica" }, turma: { id: "turma-a", codigo: "A" }, matricula: { id: "mat-temporal", produtoOrigem: "produto-temporal", situacao: "ATIVA", inicio: "2025-01-01", moeda: "CRC", pais: "CR" }, alocacao: { inicio: "2025-01-15", fim: "2025-02-15" }, consentimentoOrigem: "sobreposição histórica" },
  ] });
  if (!lote.ok || !lote.dado) throw new Error("Lote M01 ausente");
  const linhas = await prisma.linhaPreparacaoMigracao.findMany({ where: { loteId: lote.dado.loteId }, orderBy: { linhaOrigem: "asc" } });
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Ana", paisId } });
  await prisma.mapaOrigemAlunoMigracao.create({ data: { origem, alunoOrigemId: "aluno-temporal", alunoId: aluno.id } });
  await revisarCorrespondenciaProdutoMigracao({ origem, produtoOrigemId: "produto-temporal", produtoId: produto.id, paisId, moeda: "CRC", ativa: true });
  await revisarCorrespondenciaStatusMatriculaMigracao({ origem, statusOrigem: "ATIVA", statusDestino: "ATIVA", ativa: true });
  await revisarCorrespondenciaTurmaMigracao({ origem, turmaOrigemId: "turma-a", turmaId: turmaA.id, ativa: true });
  await revisarCorrespondenciaTurmaMigracao({ origem, turmaOrigemId: "turma-b", turmaId: turmaB.id, ativa: true });
  const ensaios = [];
  for (const linha of linhas) ensaios.push(await ensaiarVinculoMigracao({ linhaId: linha.id }));
  expect(ensaios.map(e => e.ok)).toEqual([true, true, true]);
  const revisoes = await Promise.all(linhas.map(l => prisma.ensaioVinculoMigracao.findFirstOrThrow({ where: { linhaId: l.id }, orderBy: { criadoEm: "desc" } })));
  const aplicar = async (indice: number, inicio: string, fim: string | null) => {
    const r = await aplicarVinculoMigracao({ linhaId: linhas[indice]!.id, ensaioId: revisoes[indice]!.id, entradaHash: linhas[indice]!.entradaHash, contextoHash: revisoes[indice]!.contextoHash, fusoReferencia: "America/Costa_Rica", semanticaFim: "LIMITE_EXCLUSIVO", inicioAlocacao: inicio, fimAlocacao: fim, diaVencimento: 10, mesesPlano: 1, evidenciaContrato: { fonte: "contrato" }, evidenciaPagamento: { fonte: "pagamento" }, fatos: [{ tipo: "ATIVACAO", data: "2025-01-01", evidencia: { fonte: "situação" } }], ...(fim ? { complementoVigencia: { motivo: "Limite histórico conferido na fonte migrada.", evidencia: { fonte: "limite histórico" } } } : {}) });
    if (!r.ok || !r.dado) throw new Error(r.ok ? "Aplicação M01 ausente" : r.erro); return r.dado;
  };
  // B é importada antes da A: a criação técnica não define a fonte histórica.
  const b = await aplicar(1, "2025-02-01", null); const a = await aplicar(0, "2025-01-01", "2025-02-01");
  const m = await prisma.matricula.findUniqueOrThrow({ where: { id: a.matriculaId } });
  const fonte = (inicio: string, turma = turmaA.id) => ({ matriculaId: m.id, alunoId: aluno.id, turmaId: turma, nivelId: turmaA.nivelId, inicio: new Date(inicio) });
  // Q23: data dentro de A finita, embora criada tecnicamente depois de B.
  await expect(prisma.$transaction(tx => carregarImpactosFrequenciaAulaTx(tx, fonte("2025-01-10T12:00:00Z")))).resolves.toMatchObject({ alocacaoFonteId: a.alocacaoId });
  await expect(prisma.$transaction(tx => carregarImpactosFrequenciaAulaTx(tx, fonte("2025-02-01T06:00:00Z")))).rejects.toThrow("único vínculo histórico");
  await expect(prisma.$transaction(tx => carregarImpactosFrequenciaAulaTx(tx, fonte("2024-12-31T23:59:59Z")))).rejects.toThrow("único vínculo histórico");
  // Q54 usa o mesmo fato real de aula e deve selecionar B no período posterior, não a última importação técnica.
  const encontro = await prisma.encontroAgenda.create({ data: { turmaId: turmaB.id, professorId, preparadorId: secretariaId, inicio: new Date("2025-02-10T12:00:00Z"), fim: new Date("2025-02-10T13:00:00Z"), fusoOrigem: "UTC", status: "PREVISTO", finalidade: "AULA", motivo: "Aula M01 posterior", chaveIdempotencia: "m01-q54", entradaHash: "fixture", diario: { create: { turmaId: turmaB.id, professorId, ocorridaEm: new Date("2025-02-10T12:00:00Z"), conteudo: "Histórico", registros: { create: { alunoId: aluno.id, matriculaId: m.id, nomeAluno: "Ana", presente: false, participacao: "FALTA" } } } } } });
  await prisma.encontroAgenda.update({ where: { id: encontro.id }, data: { status: "MINISTRADO" } });
  const repo = await prisma.reposicaoIndividual.create({ data: { aulaOriginalId: encontro.id, matriculaId: m.id, modalidade: "GRAVACAO", solicitanteId: secretariaId, motivo: "Q54 temporal", evidencia: "Evidência histórica", chaveIdempotencia: "m01-q54-repo", entradaHash: "fixture" } });
  await expect(prisma.$transaction(tx => carregarImpactosCorrecaoReposicaoTx(tx, { reposicaoId: repo.id }))).resolves.toMatchObject({ alocacaoFonteId: b.alocacaoId });
  const c = await aplicar(2, "2025-01-15", "2025-02-15");
  expect(c.alocacaoId).toBeTruthy();
  await expect(prisma.$transaction(tx => carregarImpactosFrequenciaAulaTx(tx, fonte("2025-01-20T12:00:00Z")))).rejects.toThrow("único vínculo histórico");
  const legado = await prisma.alocacaoTurma.create({ data: { alunoId: m.alunoId, matriculaId: m.id, turmaId, ativa: false, criadoEm: new Date("2025-01-11T00:00:00Z"), encerradaEm: new Date("2025-01-10T00:00:00Z") } });
  const nivelLegadoId = (await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } })).nivelId;
  await expect(prisma.$transaction(tx => carregarImpactosFrequenciaAulaTx(tx, { matriculaId: m.id, alunoId: m.alunoId, turmaId, nivelId: nivelLegadoId, inicio: new Date("2025-01-10T12:00:00Z") }))).rejects.toThrow("único vínculo histórico");
  expect(legado.id).toBeTruthy();
});
