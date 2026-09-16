import { beforeEach, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import { HABILIDADES } from "@/server/avaliacoes/calculo";
import { decidirCorrecaoNota, proporCorrecaoNota, revisarCorrecaoNota } from "@/server/avaliacoes/correcao";
import { confirmarFechamentoAcademico, revisarFechamentoAcademico } from "@/server/avaliacoes/fechamento";
import { oficializarLancamentoAvaliacao, salvarLancamentoAvaliacao } from "@/server/avaliacoes/lancamentos";
import { decidirRegraAvaliacaoTx, prepararRegraAvaliacaoTx } from "@/server/avaliacoes/regras-tx";
import { decidirMudancaAcademica, executarMudancaAcademica, solicitarMudancaAcademica } from "./acoes";

let professorId: string;
let secretariaId: string;
let gestorId: string;
let administradorId: string;
let alunoId: string;
let matriculaId: string;
let alocacaoOrigemId: string;
let turmaOrigemId: string;
let turmaDestinoId: string;
let nivelOrigemId: string;
let lancamentoIntermediarioId: string;

const inicio = new Date("2026-01-01T00:00:00.000Z");
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const motivoSolicitacao = "Progressão para A2 após resultado acadêmico final conferido.";
const motivoDecisao = "Gestão pedagógica aprova a progressão baseada no fechamento vigente.";
const justificativaDispensa = "Professor indisponível; a gestão conferiu o fechamento acadêmico oficial.";
const motivoExecucao = "Secretaria executa a progressão após confirmar a decisão acadêmica.";

function assertOk<T extends { ok: boolean; dado?: unknown }>(resultado: T): asserts resultado is T & { ok: true; dado: NonNullable<T["dado"]> } {
  expect(resultado, JSON.stringify(resultado)).toMatchObject({ ok: true });
  if (!resultado.ok || resultado.dado === undefined || resultado.dado === null) throw new Error(JSON.stringify(resultado));
}

async function registrarPresencaConferida() {
  const encontro = await prisma.encontroAgenda.create({ data: {
    turmaId: turmaOrigemId,
    professorId,
    preparadorId: gestorId,
    inicio: new Date("2026-01-10T10:00:00.000Z"),
    fim: new Date("2026-01-10T11:00:00.000Z"),
    fusoOrigem: "UTC",
    status: "PREVISTO",
    finalidade: "AULA",
    motivo: "Aula concluída para a apuração real de frequência da progressão.",
    chaveIdempotencia: "progressao-fechamento-presenca",
    entradaHash: "fixture-progressao-fechamento-presenca",
  } });
  await prisma.aulaDiario.create({ data: {
    encontroId: encontro.id,
    turmaId: turmaOrigemId,
    professorId,
    ocorridaEm: encontro.inicio,
    conteudo: "Aula efetivamente realizada com presença conferida.",
    registros: { create: {
      alunoId,
      matriculaId,
      nomeAluno: "Aluno em progressão",
      presente: true,
      participacao: "PRESENTE",
    } },
  } });
  await prisma.encontroAgenda.update({ where: { id: encontro.id }, data: { status: "MINISTRADO" } });
}

async function oficializarAvaliacao(codigoAvaliacao: "I1" | "F1", chaveIdempotencia: string) {
  const notas = codigoAvaliacao === "I1"
    ? [{ habilidade: "FALA" as const, nota: "8", comentarioAluno: "Nota oficial de fala: 8." }]
    : HABILIDADES.map(habilidade => ({ habilidade, nota: "8", comentarioAluno: `Nota oficial ${habilidade}: 8.` }));
  entrar(professorId);
  const salvo = await salvarLancamentoAvaliacao({
    alocacaoId: alocacaoOrigemId,
    codigoAvaliacao,
    realizadaEm: "2026-01-11T10:00:00.000Z",
    notas,
    submetida: true,
    versaoEsperada: 0,
    chaveIdempotencia,
  });
  assertOk(salvo);
  const lancamento = await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: salvo.dado.id } });
  entrar(gestorId);
  assertOk(await oficializarLancamentoAvaliacao({
    lancamentoId: lancamento.id,
    conteudoHash: lancamento.conteudoHash,
    aprovada: true,
    motivo: "Gestão conferiu a nota que integra o fechamento de progressão.",
  }));
  return lancamento;
}

async function completarNotas() {
  const intermediaria = await oficializarAvaliacao("I1", "progressao-fechamento-i1");
  lancamentoIntermediarioId = intermediaria.id;
  await oficializarAvaliacao("F1", "progressao-fechamento-f1");
}

async function confirmarFechamentoSuficiente() {
  entrar(gestorId);
  const revisao = await revisarFechamentoAcademico({ alocacaoId: alocacaoOrigemId });
  assertOk(revisao);
  expect(revisao.dado.elegibilidade).toMatchObject({ situacao: "SUFICIENTE", podeFechar: true, podeProgredir: true, pendencias: [] });
  const fechamento = await confirmarFechamentoAcademico({
    alocacaoId: alocacaoOrigemId,
    estadoHash: revisao.dado.estadoHash,
    versaoEsperada: revisao.dado.versaoAtual,
    motivo: "Fechamento suficiente confirma o resultado antes de solicitar progressão.",
    chaveIdempotencia: "progressao-fechamento-suficiente",
  });
  assertOk(fechamento);
  return fechamento.dado;
}

async function solicitarProgressao() {
  entrar(secretariaId);
  return solicitarMudancaAcademica(alunoId, {
    matriculaId,
    alocacaoOrigemId,
    turmaDestinoId,
    motivo: motivoSolicitacao,
    horarioCompativel: true,
  });
}

async function aprovarComDispensa(solicitacaoId: string) {
  entrar(gestorId);
  return decidirMudancaAcademica(solicitacaoId, {
    aprovar: true,
    motivo: motivoDecisao,
    justificativaDispensaParecer: justificativaDispensa,
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  professorId = (await criarUsuario([Papel.PROFESSOR], "Professor da origem")).id;
  secretariaId = (await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria executora")).id;
  gestorId = (await criarUsuario([Papel.GERENTE_PEDAGOGICO], "Gestão aprovadora")).id;
  administradorId = (await criarUsuario([Papel.ADMINISTRADOR], "Direção da regra")).id;
  const nivelOrigem = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  nivelOrigemId = nivelOrigem.id;
  const nivelDestino = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A2", ordem: 2 } });
  const regra = await prisma.$transaction(tx => prepararRegraAvaliacaoTx(tx, gestorId, {
    nivelId: nivelOrigemId,
    versaoEsperada: 0,
    conteudo: regraAvaliacaoTeste(),
    motivo: "Regra publicada para confirmar fechamento antes da progressão.",
    chaveIdempotencia: "regra-progressao-fechamento",
  }));
  const versaoRegra = await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: regra.id } });
  await prisma.$transaction(tx => decidirRegraAvaliacaoTx(tx, administradorId, {
    regraId: regra.id,
    conteudoHash: versaoRegra.conteudoHash,
    aprovada: true,
    motivo: "Aprovação da regra aplicada à turma de origem.",
  }));
  const origem = await prisma.turma.create({ data: {
    nome: "Origem A1 para progressão",
    modalidadeId: catalogo.modalidade.id,
    nivelId: nivelOrigemId,
    professorId,
    dataInicio: new Date("2099-01-01T00:00:00.000Z"),
    capacidade: 10,
    diasSemana: [1, 3],
    horarioInicio: "18:00",
    horarioFim: "19:00",
    vinculosDocentes: { create: { professorId, inicio } },
  } });
  await prisma.turma.update({ where: { id: origem.id }, data: { status: "EM_ANDAMENTO", dataInicio: inicio } });
  turmaOrigemId = origem.id;
  const destino = await prisma.turma.create({ data: {
    nome: "Destino A2 para progressão",
    modalidadeId: catalogo.modalidade.id,
    nivelId: nivelDestino.id,
    professorId,
    status: "EM_ANDAMENTO",
    dataInicio: inicio,
    capacidade: 10,
    diasSemana: [2, 4],
    horarioInicio: "18:00",
    horarioFim: "19:00",
    vinculosDocentes: { create: { professorId, inicio } },
  } });
  turmaDestinoId = destino.id;
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno em progressão", paisId: catalogo.pais.id, status: "ATIVO" } });
  alunoId = aluno.id;
  const matricula = await prisma.matricula.create({ data: {
    alunoId,
    produtoId: catalogo.produto.id,
    paisId: catalogo.pais.id,
    moeda: "CRC",
    status: "ATIVA",
    ativadaEm: inicio,
  } });
  matriculaId = matricula.id;
  alocacaoOrigemId = (await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId, turmaId: turmaOrigemId, criadoEm: inicio } })).id;
  await registrarPresencaConferida();
  await completarNotas();
});

it("registra o pedido, mas nega sua aprovação sem uma versão suficiente de fechamento", async () => {
  const solicitacao = await solicitarProgressao();
  assertOk(solicitacao);
  const bloqueada = await aprovarComDispensa(solicitacao.dado.solicitacaoId);
  expect(bloqueada, JSON.stringify(bloqueada)).toMatchObject({ ok: false });
  expect(await prisma.solicitacaoMudancaAcademica.findUniqueOrThrow({ where: { id: solicitacao.dado.solicitacaoId } })).toMatchObject({
    status: "PENDENTE",
    solicitanteId: secretariaId,
    aprovadorId: null,
  });
  expect(await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: alocacaoOrigemId } })).toMatchObject({ ativa: true, turmaId: turmaOrigemId });
});

it("autoriza a exceção de nível somente com fechamento suficiente atual, parecer dispensado de forma justificada e execução da Secretaria", async () => {
  const fechamento = await confirmarFechamentoSuficiente();
  expect(fechamento).toMatchObject({ versao: 1, resultadoSuficiente: true });
  const contratoAntes = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const solicitacao = await solicitarProgressao();
  assertOk(solicitacao);
  const pedido = await prisma.solicitacaoMudancaAcademica.findUniqueOrThrow({ where: { id: solicitacao.dado.solicitacaoId } });
  expect(pedido).toMatchObject({ matriculaId, alocacaoOrigemId, turmaOrigemId, turmaDestinoId, solicitanteId: secretariaId, status: "PENDENTE" });

  const decisao = await aprovarComDispensa(pedido.id);
  expect(decisao, JSON.stringify(decisao)).toMatchObject({ ok: true });
  expect(await prisma.solicitacaoMudancaAcademica.findUniqueOrThrow({ where: { id: pedido.id } })).toMatchObject({
    status: "APROVADA",
    fechamentoAcademicoId: fechamento.id,
    solicitanteId: secretariaId,
    aprovadorId: gestorId,
    justificativaDispensaParecer: justificativaDispensa,
  });

  entrar(secretariaId);
  const execucao = await executarMudancaAcademica(pedido.id, { motivo: motivoExecucao, horarioCompativel: true });
  expect(execucao, JSON.stringify(execucao)).toMatchObject({ ok: true });
  expect(await prisma.solicitacaoMudancaAcademica.findUniqueOrThrow({ where: { id: pedido.id } })).toMatchObject({ status: "EXECUTADA", executorId: secretariaId });
  expect(await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: alocacaoOrigemId } })).toMatchObject({ ativa: false, turmaId: turmaOrigemId });
  expect(await prisma.alocacaoTurma.findMany({ where: { alunoId, ativa: true } })).toMatchObject([{ matriculaId, turmaId: turmaDestinoId }]);
  expect(await prisma.movimentacaoAluno.findMany({ where: { alunoId, tipo: "TROCA_TURMA" } })).toHaveLength(1);
  expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toEqual(contratoAntes);
  entrar(gestorId);
  const revisaoDaOrigem = await revisarFechamentoAcademico({ alocacaoId: alocacaoOrigemId });
  assertOk(revisaoDaOrigem);
  expect(revisaoDaOrigem.dado.ultimo).toMatchObject({ id: fechamento.id, versao: 1, atual: true, resultadoSuficiente: true });
});

it("não troca o fechamento aprovado por uma versão final posterior durante a execução", async () => {
  const primeiro = await confirmarFechamentoSuficiente();
  const solicitacao = await solicitarProgressao();
  assertOk(solicitacao);
  expect(await aprovarComDispensa(solicitacao.dado.solicitacaoId)).toMatchObject({ ok: true });
  entrar(gestorId);
  const revisao = await revisarFechamentoAcademico({ alocacaoId: alocacaoOrigemId });
  assertOk(revisao);
  const segundo = await confirmarFechamentoAcademico({ alocacaoId: alocacaoOrigemId,
    estadoHash: revisao.dado.estadoHash, versaoEsperada: revisao.dado.versaoAtual,
    motivo: "Nova confirmação preserva a versão anterior e exige conferência da progressão.", chaveIdempotencia: "nova-versao-final-progressao" });
  assertOk(segundo);
  expect(segundo.dado.versao).toBe(2);
  entrar(secretariaId);
  expect(await executarMudancaAcademica(solicitacao.dado.solicitacaoId, { motivo: motivoExecucao, horarioCompativel: true })).toMatchObject({ ok: false });
  expect(await prisma.solicitacaoMudancaAcademica.findUniqueOrThrow({ where: { id: solicitacao.dado.solicitacaoId } })).toMatchObject({ status: "APROVADA", fechamentoAcademicoId: primeiro.id });
  expect(await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: alocacaoOrigemId } })).toMatchObject({ ativa: true });
});

it("mantém a solicitação aprovada sem execução quando uma correção oficial torna o fechamento anterior obsoleto", async () => {
  await confirmarFechamentoSuficiente();
  const solicitacao = await solicitarProgressao();
  assertOk(solicitacao);
  const pedidoId = solicitacao.dado.solicitacaoId;
  expect(await aprovarComDispensa(pedidoId)).toMatchObject({ ok: true });

  const lancamento = await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: lancamentoIntermediarioId } });
  entrar(professorId);
  const proposta = await proporCorrecaoNota({
    lancamentoId: lancamento.id,
    origemHash: lancamento.conteudoHash,
    notas: [{ habilidade: "FALA", nota: "9", comentarioAluno: "Correção oficial posterior ao fechamento de progressão." }],
    motivo: "Evidência posterior exige corrigir a nota já oficializada.",
    versaoEsperada: 0,
    chaveIdempotencia: "correcao-progressao-fechamento-obsoleto",
  });
  assertOk(proposta);
  entrar(gestorId);
  const revisaoCorrecao = await revisarCorrecaoNota(proposta.dado.id);
  assertOk(revisaoCorrecao);
  assertOk(await decidirCorrecaoNota({
    propostaId: proposta.dado.id,
    propostaHash: revisaoCorrecao.dado.propostaHash,
    impactosHash: revisaoCorrecao.dado.impactosHash,
    aprovada: true,
    motivo: "Gestão aprova a correção que invalida a versão anterior do fechamento.",
  }));

  entrar(secretariaId);
  const bloqueada = await executarMudancaAcademica(pedidoId, { motivo: motivoExecucao, horarioCompativel: true });
  expect(bloqueada, JSON.stringify(bloqueada)).toMatchObject({ ok: false });
  expect(await prisma.solicitacaoMudancaAcademica.findUniqueOrThrow({ where: { id: pedidoId } })).toMatchObject({ status: "APROVADA", executorId: null });
  expect(await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: alocacaoOrigemId } })).toMatchObject({ ativa: true, turmaId: turmaOrigemId });
  expect(await prisma.alocacaoTurma.count({ where: { alunoId, ativa: true } })).toBe(1);
  expect(await prisma.movimentacaoAluno.count({ where: { alunoId, tipo: "TROCA_TURMA" } })).toBe(0);
});
