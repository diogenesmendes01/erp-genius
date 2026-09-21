import { beforeEach, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import { HABILIDADES } from "./calculo";
import { decidirExcecaoFrequencia, proporExcecaoFrequencia } from "./excecao-frequencia";
import { revisarFechamentoAcademico, confirmarFechamentoAcademico } from "./fechamento";
import { oficializarLancamentoAvaliacao, salvarLancamentoAvaliacao } from "./lancamentos";
import { decidirRegraAvaliacaoTx, prepararRegraAvaliacaoTx } from "./regras-tx";

let professorId: string;
let gestorProponenteId: string;
let gestorDecisorId: string;
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

async function registrarFaltaConferida(chave: string, horario: string) {
  const inicioEncontro = new Date(horario);
  const encontro = await prisma.encontroAgenda.create({ data: {
    turmaId,
    professorId,
    preparadorId: gestorProponenteId,
    inicio: inicioEncontro,
    fim: new Date(inicioEncontro.getTime() + 60 * 60 * 1000),
    fusoOrigem: "UTC",
    status: "PREVISTO",
    finalidade: "AULA",
    motivo: "Aula realizada cuja falta foi conferida no fechamento.",
    chaveIdempotencia: chave,
    entradaHash: `fixture-${chave}`,
  } });
  await prisma.aulaDiario.create({ data: {
    encontroId: encontro.id,
    turmaId,
    professorId,
    ocorridaEm: inicioEncontro,
    conteudo: "Aula realizada sem presença da aluna.",
    registros: { create: {
      alunoId,
      matriculaId,
      nomeAluno: "Aluna com exceção de frequência",
      presente: false,
      participacao: "FALTA",
    } },
  } });
  await prisma.encontroAgenda.update({ where: { id: encontro.id }, data: { status: "MINISTRADO" } });
  return encontro.id;
}

async function oficializarAvaliacao(codigoAvaliacao: "I1" | "F1", chaveIdempotencia: string) {
  const notas = codigoAvaliacao === "I1"
    ? [{ habilidade: "FALA" as const, nota: "8", comentarioAluno: "Resultado oficial de fala: 8." }]
    : HABILIDADES.map(habilidade => ({ habilidade, nota: "8", comentarioAluno: `Resultado oficial ${habilidade}: 8.` }));
  entrar(professorId);
  const salvo = await salvarLancamentoAvaliacao({
    alocacaoId,
    codigoAvaliacao,
    realizadaEm: "2026-01-11T10:00:00.000Z",
    notas,
    submetida: true,
    versaoEsperada: 0,
    chaveIdempotencia,
  });
  assertOk(salvo);
  const lancamento = await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: salvo.dado.id } });
  entrar(gestorDecisorId);
  assertOk(await oficializarLancamentoAvaliacao({
    lancamentoId: lancamento.id,
    conteudoHash: lancamento.conteudoHash,
    aprovada: true,
    motivo: "Conferência independente da nota oficial para o fechamento.",
  }));
}

async function completarNotas() {
  await oficializarAvaliacao("I1", "excecao-frequencia-i1");
  await oficializarAvaliacao("F1", "excecao-frequencia-f1");
}

async function revisarComoGestao() {
  entrar(gestorProponenteId);
  const revisao = await revisarFechamentoAcademico({ alocacaoId });
  assertOk(revisao);
  return revisao.dado;
}

async function proporDaRevisao(revisao: Awaited<ReturnType<typeof revisarComoGestao>>, chaveIdempotencia: string) {
  entrar(gestorProponenteId);
  return proporExcecaoFrequencia({
    alocacaoId,
    fonteHash: revisao.snapshot.frequencia.fonteHash,
    versaoEsperada: revisao.versaoAtual,
    motivo: "Circunstância documentada justifica reconhecer a progressão sem alterar a frequência real.",
    evidencias: "Atestado e decisão pedagógica independente anexados ao processo acadêmico.",
    chaveIdempotencia,
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  professorId = (await criarUsuario(["PROFESSOR"])).id;
  gestorProponenteId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  gestorDecisorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  nivelId = nivel.id;
  const regra = await prisma.$transaction(tx => prepararRegraAvaliacaoTx(tx, gestorProponenteId, {
    nivelId,
    versaoEsperada: 0,
    conteudo: regraAvaliacaoTeste(),
    motivo: "Regra publicada para avaliar exceção de frequência sem alterar a apuração.",
    chaveIdempotencia: "regra-excecao-frequencia",
  }));
  const versaoRegra = await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: regra.id } });
  await prisma.$transaction(tx => decidirRegraAvaliacaoTx(tx, gestorDecisorId, {
    regraId: regra.id,
    conteudoHash: versaoRegra.conteudoHash,
    aprovada: true,
    motivo: "Aprovação independente da regra usada no fechamento.",
  }));
  const turma = await prisma.turma.create({ data: {
    nome: "Turma de exceção de frequência",
    modalidadeId: catalogo.modalidade.id,
    nivelId,
    professorId,
    dataInicio: new Date("2099-01-01T00:00:00.000Z"),
    vinculosDocentes: { create: { professorId, inicio } },
  } });
  await prisma.turma.update({ where: { id: turma.id }, data: { status: "EM_ANDAMENTO", dataInicio: inicio } });
  turmaId = turma.id;
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluna com exceção de frequência", paisId: catalogo.pais.id } });
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
  alocacaoId = (await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId, turmaId, criadoEm: inicio } })).id;
  await registrarFaltaConferida("excecao-frequencia-falta-1", "2026-01-10T10:00:00.000Z");
});

it("mantém frequência real e permite fechamento suficiente após decisão independente, enquanto a fonte permanece atual", async () => {
  await completarNotas();
  const antes = await revisarComoGestao();
  expect(antes.elegibilidade).toMatchObject({
    situacao: "INSUFICIENTE",
    podeFechar: true,
    podeProgredir: false,
    insuficiencias: expect.arrayContaining(["FREQUENCIA_MINIMA"]),
    frequencia: { atendeMinimoReal: false, excecaoAplicada: false },
  });
  expect(antes.snapshot.frequencia).toMatchObject({ base: 1, presencas: 0, faltas: 1, regularizadas: 0, atendeMinimo: false });
  const frequenciaReal = structuredClone(antes.snapshot.frequencia);
  const registrosAntes = await prisma.registroAulaAluno.count({ where: { matriculaId, participacao: "FALTA" } });

  const proposta = await proporDaRevisao(antes, "excecao-frequencia-independente");
  assertOk(proposta);
  expect(proposta.dado).toMatchObject({ versao: 1 });
  const pendente = await revisarComoGestao();
  expect(pendente.elegibilidade).toMatchObject({
    situacao: "PENDENTE",
    podeFechar: false,
    podeProgredir: false,
    pendencias: expect.arrayContaining(["EXCECAO_FREQUENCIA_PENDENTE"]),
  });

  entrar(gestorProponenteId);
  const autoaprovacao = await decidirExcecaoFrequencia({
    propostaId: proposta.dado.id,
    fonteHash: antes.snapshot.frequencia.fonteHash,
    aprovada: true,
    motivo: "O próprio proponente não pode validar sua exceção de frequência.",
  });
  expect(autoaprovacao, JSON.stringify(autoaprovacao)).toMatchObject({ ok: false });
  expect(await prisma.decisaoExcecaoFrequencia.count({ where: { propostaId: proposta.dado.id } })).toBe(0);

  entrar(gestorDecisorId);
  const decisao = await decidirExcecaoFrequencia({
    propostaId: proposta.dado.id,
    fonteHash: antes.snapshot.frequencia.fonteHash,
    aprovada: true,
    motivo: "Gestão distinta valida a evidência sem reescrever a chamada original.",
  });
  assertOk(decisao);
  expect(decisao.dado).toMatchObject({ aprovada: true });

  const depois = await revisarComoGestao();
  expect(depois.elegibilidade).toMatchObject({
    situacao: "SUFICIENTE",
    podeFechar: true,
    podeProgredir: true,
    pendencias: [],
    insuficiencias: [],
    frequencia: { atendeMinimoReal: false, excecaoAplicada: true },
  });
  expect(depois.snapshot.frequencia).toEqual(frequenciaReal);
  expect(await prisma.registroAulaAluno.count({ where: { matriculaId, participacao: "FALTA" } })).toBe(registrosAntes);
  const fechado = await confirmarFechamentoAcademico({ alocacaoId, estadoHash: depois.estadoHash, versaoEsperada: depois.versaoAtual,
    motivo: "Resultado suficiente com exceção independente de frequência.", chaveIdempotencia: "fechamento-com-excecao" });
  assertOk(fechado);
  expect(fechado.dado.resultadoSuficiente).toBe(true);
  await expect(prisma.decisaoExcecaoFrequencia.delete({ where: { id: decisao.dado.id } })).rejects.toThrow();
  await registrarFaltaConferida("falta-depois-excecao-aprovada", "2026-01-13T10:00:00.000Z");
  const alterado = await revisarComoGestao();
  expect(alterado.elegibilidade).toMatchObject({ situacao: "INSUFICIENTE", podeProgredir: false, frequencia: { excecaoAplicada: false } });
  expect(alterado.ultimo).toMatchObject({ id: fechado.dado.id, atual: false });
});

it("recusa a decisão quando uma nova falta conferida altera a fonte da frequência proposta", async () => {
  await completarNotas();
  const antes = await revisarComoGestao();
  const proposta = await proporDaRevisao(antes, "excecao-frequencia-fonte-obsoleta");
  assertOk(proposta);

  await registrarFaltaConferida("excecao-frequencia-falta-2", "2026-01-12T10:00:00.000Z");
  const atualizada = await revisarComoGestao();
  expect(atualizada.snapshot.frequencia).toMatchObject({ base: 2, presencas: 0, faltas: 2, regularizadas: 0, atendeMinimo: false });
  expect(atualizada.snapshot.frequencia.fonteHash).not.toBe(antes.snapshot.frequencia.fonteHash);

  entrar(gestorDecisorId);
  const obsoleta = await decidirExcecaoFrequencia({
    propostaId: proposta.dado.id,
    fonteHash: antes.snapshot.frequencia.fonteHash,
    aprovada: true,
    motivo: "A decisão precisa falhar porque a frequência mudou após a proposta.",
  });
  expect(obsoleta, JSON.stringify(obsoleta)).toMatchObject({ ok: false });
  expect(await prisma.decisaoExcecaoFrequencia.count({ where: { propostaId: proposta.dado.id } })).toBe(0);
  expect((await revisarComoGestao()).elegibilidade).toMatchObject({
    situacao: "PENDENTE",
    podeProgredir: false,
    pendencias: expect.arrayContaining(["EXCECAO_FREQUENCIA_PENDENTE"]),
  });
});
