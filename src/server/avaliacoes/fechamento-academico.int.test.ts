import { beforeEach, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import { HABILIDADES } from "./calculo";
import { proporCorrecaoNota, revisarCorrecaoNota, decidirCorrecaoNota } from "./correcao";
import { confirmarFechamentoAcademico, revisarFechamentoAcademico } from "./fechamento";
import { salvarLancamentoAvaliacao, oficializarLancamentoAvaliacao } from "./lancamentos";
import { decidirRegraAvaliacaoTx, prepararRegraAvaliacaoTx } from "./regras-tx";

let professorId: string;
let gestorId: string;
let administradorId: string;
let alunoId: string;
let matriculaId: string;
let alocacaoId: string;
let turmaId: string;
let nivelId: string;

const inicio = new Date("2026-01-01T00:00:00.000Z");
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

function assertOk<T extends { ok: boolean; dado?: unknown }>(resultado: T): asserts resultado is T & { ok: true; dado: NonNullable<T["dado"]> } {
  expect(resultado, JSON.stringify(resultado)).toMatchObject({ ok: true });
  if (!resultado.ok || resultado.dado === undefined || resultado.dado === null) throw new Error(JSON.stringify(resultado));
}

async function registrarFrequenciaConferida() {
  const encontro = await prisma.encontroAgenda.create({ data: {
    turmaId, professorId, preparadorId: gestorId,
    inicio: new Date("2026-01-10T10:00:00.000Z"), fim: new Date("2026-01-10T11:00:00.000Z"),
    fusoOrigem: "UTC", status: "PREVISTO", finalidade: "AULA",
    motivo: "Aula real da apuração de frequência do fechamento.",
    chaveIdempotencia: "fechamento-frequencia-conferida", entradaHash: "fixture-fechamento-frequencia",
  } });
  await prisma.aulaDiario.create({ data: {
    encontroId: encontro.id, turmaId, professorId, ocorridaEm: encontro.inicio,
    conteudo: "Aula efetivamente realizada para compor a frequência.",
    registros: { create: { alunoId, matriculaId, nomeAluno: "Aluno de fechamento", presente: true, participacao: "PRESENTE" } },
  } });
  await prisma.encontroAgenda.update({ where: { id: encontro.id }, data: { status: "MINISTRADO" } });
}

async function oficializarAvaliacao(codigoAvaliacao: "I1" | "F1", nota: string, chaveIdempotencia: string) {
  const notas = codigoAvaliacao === "I1"
    ? [{ habilidade: "FALA" as const, nota, comentarioAluno: `Nota oficial de fala: ${nota}.` }]
    : HABILIDADES.map(habilidade => ({ habilidade, nota, comentarioAluno: `Nota oficial ${habilidade}: ${nota}.` }));
  entrar(professorId);
  const salvo = await salvarLancamentoAvaliacao({
    alocacaoId, codigoAvaliacao, realizadaEm: "2026-01-11T10:00:00.000Z", notas,
    submetida: true, versaoEsperada: 0, chaveIdempotencia,
  });
  assertOk(salvo);
  const lancamento = await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: salvo.dado.id } });
  entrar(gestorId);
  assertOk(await oficializarLancamentoAvaliacao({
    lancamentoId: lancamento.id, conteudoHash: lancamento.conteudoHash, aprovada: true,
    motivo: "Conferência independente da nota para o fechamento acadêmico.",
  }));
  return lancamento;
}

async function completarNotas(nota: string) {
  const intermediaria = await oficializarAvaliacao("I1", nota, `fechamento-i1-${nota}`);
  await oficializarAvaliacao("F1", nota, `fechamento-f1-${nota}`);
  return intermediaria;
}

async function revisarComoGestao() {
  entrar(gestorId);
  const revisao = await revisarFechamentoAcademico({ alocacaoId });
  assertOk(revisao);
  return revisao.dado;
}

async function confirmarDaRevisao(revisao: Awaited<ReturnType<typeof revisarComoGestao>>, chaveIdempotencia: string) {
  entrar(gestorId);
  return confirmarFechamentoAcademico({
    alocacaoId, estadoHash: revisao.estadoHash, versaoEsperada: revisao.versaoAtual,
    motivo: "Fechamento acadêmico conferido para preservar o resultado oficial.", chaveIdempotencia,
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  professorId = (await criarUsuario(["PROFESSOR"])).id;
  gestorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  administradorId = (await criarUsuario(["ADMINISTRADOR"])).id;
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  nivelId = nivel.id;
  const regra = await prisma.$transaction(tx => prepararRegraAvaliacaoTx(tx, gestorId, {
    nivelId, versaoEsperada: 0, conteudo: regraAvaliacaoTeste(),
    motivo: "Regra publicada para os cenários de fechamento acadêmico.", chaveIdempotencia: "regra-fechamento-academico",
  }));
  const versaoRegra = await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: regra.id } });
  await prisma.$transaction(tx => decidirRegraAvaliacaoTx(tx, administradorId, {
    regraId: regra.id, conteudoHash: versaoRegra.conteudoHash, aprovada: true,
    motivo: "Publicação independente da regra de fechamento acadêmico.",
  }));
  const turma = await prisma.turma.create({ data: {
    nome: "Turma de fechamento acadêmico", modalidadeId: catalogo.modalidade.id, nivelId, professorId,
    dataInicio: new Date("2099-01-01T00:00:00.000Z"),
    vinculosDocentes: { create: { professorId, inicio } },
  } });
  await prisma.turma.update({ where: { id: turma.id }, data: { status: "EM_ANDAMENTO", dataInicio: inicio } });
  turmaId = turma.id;
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno de fechamento", paisId: catalogo.pais.id } });
  alunoId = aluno.id;
  const matricula = await prisma.matricula.create({ data: {
    alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA", ativadaEm: inicio,
  } });
  matriculaId = matricula.id;
  alocacaoId = (await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId, turmaId, criadoEm: inicio } })).id;
  await registrarFrequenciaConferida();
});

it("impede persistir o fechamento com notas pendentes e nega o professor", async () => {
  const revisao = await revisarComoGestao();
  expect(revisao.elegibilidade).toMatchObject({ podeFechar: false, pendencias: expect.arrayContaining(["NOTAS_INCOMPLETAS"]) });
  const bloqueado = await confirmarDaRevisao(revisao, "fechamento-notas-pendentes");
  expect(bloqueado, JSON.stringify(bloqueado)).toMatchObject({ ok: false });
  expect(await prisma.fechamentoAcademico.count()).toBe(0);

  entrar(professorId);
  expect(await revisarFechamentoAcademico({ alocacaoId })).toMatchObject({ ok: false });
  expect(await confirmarFechamentoAcademico({
    alocacaoId, estadoHash: "0".repeat(64), versaoEsperada: 0,
    motivo: "Professor não pode confirmar o fechamento acadêmico.", chaveIdempotencia: "fechamento-professor-negado",
  })).toMatchObject({ ok: false });
  expect(await prisma.fechamentoAcademico.count()).toBe(0);
});

it("fecha resultado completo insuficiente sem exigir uma segunda pessoa", async () => {
  await completarNotas("5");
  const revisao = await revisarComoGestao();
  expect(revisao.elegibilidade).toMatchObject({ situacao: "INSUFICIENTE", podeFechar: true, podeProgredir: false, pendencias: [] });
  const fechado = await confirmarDaRevisao(revisao, "fechamento-insuficiente");
  assertOk(fechado);
  expect(fechado.dado).toMatchObject({ versao: 1, resultadoSuficiente: false });
  expect(await prisma.fechamentoAcademico.findUniqueOrThrow({ where: { id: fechado.dado.id } })).toMatchObject({
    confirmadoPorId: gestorId, resultadoSuficiente: false, versao: 1,
  });
});

it("fecha resultado suficiente e preserva o replay idempotente do mesmo ato", async () => {
  await completarNotas("8");
  const revisao = await revisarComoGestao();
  expect(revisao.elegibilidade).toMatchObject({ situacao: "SUFICIENTE", podeFechar: true, podeProgredir: true, pendencias: [] });
  const primeiro = await confirmarDaRevisao(revisao, "fechamento-suficiente-idempotente");
  assertOk(primeiro);
  expect(primeiro.dado).toMatchObject({ versao: 1, resultadoSuficiente: true });
  const repetido = await confirmarDaRevisao(revisao, "fechamento-suficiente-idempotente");
  expect(repetido).toEqual(primeiro);
  expect(await prisma.fechamentoAcademico.count()).toBe(1);
  expect((await revisarComoGestao()).ultimo).toMatchObject({ id: primeiro.dado.id, atual: true });
  await expect(prisma.fechamentoAcademico.update({ where: { id: primeiro.dado.id }, data: { motivo: "Tentativa de reescrever o histórico." } })).rejects.toThrow();
  await expect(prisma.fechamentoAcademico.delete({ where: { id: primeiro.dado.id } })).rejects.toThrow();
  entrar(administradorId);
  const administrativa = await revisarFechamentoAcademico({ alocacaoId });
  assertOk(administrativa);
  expect(administrativa.dado.ultimo).toMatchObject({ atual: true, versao: 1 });
});

it("preserva o fechamento anterior e exige nova versão após correção oficial da fonte", async () => {
  const intermediaria = await completarNotas("8");
  const revisao = await revisarComoGestao();
  const anterior = await confirmarDaRevisao(revisao, "fechamento-antes-correcao");
  assertOk(anterior);
  entrar(professorId);
  const proposta = await proporCorrecaoNota({
    lancamentoId: intermediaria.id, origemHash: intermediaria.conteudoHash,
    notas: [{ habilidade: "FALA", nota: "9", comentarioAluno: "Correção oficial posterior à prévia." }],
    motivo: "Evidência posterior exige atualizar a fonte oficial de fala.", versaoEsperada: 0,
    chaveIdempotencia: "correcao-fonte-apos-previa-fechamento",
  });
  assertOk(proposta);
  entrar(administradorId);
  const conferenciaCorrecao = await revisarCorrecaoNota(proposta.dado.id);
  assertOk(conferenciaCorrecao);
  assertOk(await decidirCorrecaoNota({
    propostaId: proposta.dado.id, propostaHash: conferenciaCorrecao.dado.propostaHash,
    impactosHash: conferenciaCorrecao.dado.impactosHash, aprovada: true,
    motivo: "Aprovação administrativa independente da correção da fonte.",
  }));

  const rejeitado = await confirmarDaRevisao(revisao, "fechamento-hash-obsoleto");
  expect(rejeitado, JSON.stringify(rejeitado)).toMatchObject({ ok: false, erro: expect.stringContaining("fontes acadêmicas mudaram") });
  expect(await prisma.fechamentoAcademico.count()).toBe(1);
  const atualizada = await revisarComoGestao();
  expect(atualizada.ultimo).toMatchObject({ id: anterior.dado.id, versao: 1, atual: false });
  const novo = await confirmarDaRevisao(atualizada, "fechamento-apos-correcao");
  assertOk(novo);
  expect(novo.dado).toMatchObject({ versao: 2, resultadoSuficiente: true });
  expect(await prisma.fechamentoAcademico.count()).toBe(2);
  expect((await prisma.fechamentoAcademico.findUniqueOrThrow({ where: { id: anterior.dado.id } })).estadoHash).toBe(revisao.estadoHash);
});
