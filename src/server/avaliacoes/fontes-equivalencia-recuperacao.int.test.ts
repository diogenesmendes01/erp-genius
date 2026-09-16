import { beforeEach, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import { HABILIDADES } from "./calculo";
import { carregarFontesEquivalenciaTx } from "./fontes-equivalencia-tx";
import { salvarLancamentoAvaliacao, oficializarLancamentoAvaliacao } from "./lancamentos";
import { prepararRegraAvaliacaoTx, decidirRegraAvaliacaoTx } from "./regras-tx";
import { proporPlanoRecuperacao } from "./recuperacao-proposta";
import { decidirPlanoRecuperacao } from "./recuperacao-decisao";
import { registrarDisponibilizacaoRecuperacao } from "./recuperacao-disponibilizacao";
import { reservarTentativaRecuperacao } from "./recuperacao-reserva";
import { registrarRealizacaoRecuperacao } from "./recuperacao-realizacao";
import { salvarNotaRecuperacao, decidirNotaRecuperacao } from "./recuperacao-nota";
import { proporCorrecaoRecuperacao, revisarCorrecaoRecuperacao, decidirCorrecaoRecuperacao } from "./recuperacao-correcao";

let professorId: string;
let gestorId: string;
let matriculaId: string;
let alocacaoId: string;
let turmaId: string;
let nivelId: string;
let regraId: string;

const inicio = new Date("2026-01-01T00:00:00.000Z");
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

function assertOk<T extends { ok: boolean; dado?: unknown }>(resultado: T): asserts resultado is T & { ok: true; dado: NonNullable<T["dado"]> } {
  expect(resultado, JSON.stringify(resultado)).toMatchObject({ ok: true });
  if (!resultado.ok || resultado.dado === undefined || resultado.dado === null) throw new Error(JSON.stringify(resultado));
}

async function instanteAtualConferido() {
  const [relogio] = await prisma.$queryRaw<{ agora: Date }[]>`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS agora`;
  const espera = relogio.agora.getTime() - Date.now();
  if (espera > 0) await new Promise(resolve => setTimeout(resolve, espera + 2));
  return new Date();
}

async function lancarRegular(alocacao: string, prefixo: string, nota: string) {
  entrar(professorId);
  const salvar = async (codigoAvaliacao: "I1" | "F1", notas: Array<{ habilidade: typeof HABILIDADES[number]; nota: string }>) => {
    const resultado = await salvarLancamentoAvaliacao({
      alocacaoId: alocacao,
      codigoAvaliacao,
      realizadaEm: "2026-01-10T10:00:00.000Z",
      notas: notas.map(item => ({ ...item, comentarioAluno: `Resultado oficial ${prefixo}` })),
      submetida: true,
      versaoEsperada: 0,
      chaveIdempotencia: `${prefixo}-${codigoAvaliacao}-regular`,
    });
    assertOk(resultado);
    const lancamento = await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: resultado.dado.id } });
    entrar(gestorId);
    assertOk(await oficializarLancamentoAvaliacao({
      lancamentoId: lancamento.id,
      conteudoHash: lancamento.conteudoHash,
      aprovada: true,
      motivo: "Conferência independente do resultado regular",
    }));
    entrar(professorId);
  };

  await salvar("I1", [{ habilidade: "FALA", nota }]);
  await salvar("F1", HABILIDADES.map(habilidade => ({ habilidade, nota })));
}

async function lerFontes() {
  return prisma.$transaction(tx => carregarFontesEquivalenciaTx(tx, {
    matriculaId,
    alocacaoId,
    turmaId,
    nivelId,
    regraId,
  }));
}

async function recuperarFala(nota: string, indice: number) {
  entrar(professorId);
  const plano = await proporPlanoRecuperacao({
    alocacaoId,
    versaoEsperada: indice,
    motivo: "Plano de recuperação por desempenho insuficiente",
    chaveIdempotencia: `fontes-recuperacao-plano-${indice}`,
    atividades: HABILIDADES.map(habilidade => ({
      habilidade,
      estrategia: "Atividade orientada com evidência de aprendizagem",
      avaliacaoProposta: "Avaliação individual registrada pelo professor",
    })),
  });
  assertOk(plano);
  const persistido = await prisma.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: plano.dado.id } });

  entrar(gestorId);
  assertOk(await decidirPlanoRecuperacao({
    propostaId: persistido.id,
    propostaHash: persistido.entradaHash,
    aprovada: true,
    motivo: "Aprovação independente do plano de recuperação",
  }));
  assertOk(await registrarDisponibilizacaoRecuperacao({
    propostaId: persistido.id,
    propostaHash: persistido.entradaHash,
    disponibilizadaEm: (await instanteAtualConferido()).toISOString(),
    condicoes: "Atividade e critério de correção comunicados ao aluno",
    evidenciaComunicacao: "Comunicado acadêmico registrado no atendimento",
  }));
  const reserva = await reservarTentativaRecuperacao({
    propostaId: persistido.id,
    propostaHash: persistido.entradaHash,
    habilidades: ["FALA"],
    motivo: "Reservar a oportunidade de recuperação oral",
    chaveIdempotencia: `fontes-recuperacao-reserva-${indice}`,
  });
  assertOk(reserva);
  const item = await prisma.itemReservaTentativaRecuperacao.findFirstOrThrow({ where: { reservaId: reserva.dado.id, habilidade: "FALA" } });

  entrar(professorId);
  const realizacao = await registrarRealizacaoRecuperacao({
    itemReservaId: item.id,
    realizadaEm: (await instanteAtualConferido()).toISOString(),
    evidencia: "Evidência da realização individual da recuperação oral",
  });
  assertOk(realizacao);
  const notaSalva = await salvarNotaRecuperacao({
    realizacaoId: realizacao.dado.id,
    nota,
    comentarioAluno: "Devolutiva da recuperação oral",
    submetida: true,
    versaoEsperada: 0,
    chaveIdempotencia: `fontes-recuperacao-nota-${indice}`,
  });
  assertOk(notaSalva);
  return prisma.notaRecuperacao.findUniqueOrThrow({ where: { id: notaSalva.dado.id } });
}

async function oficializarRecuperacao(notaId: string) {
  const nota = await prisma.notaRecuperacao.findUniqueOrThrow({ where: { id: notaId } });
  entrar(gestorId);
  assertOk(await decidirNotaRecuperacao({
    notaId: nota.id,
    entradaHash: nota.entradaHash,
    aprovada: true,
    motivo: "Conferência independente da nota de recuperação",
  }));
  entrar(professorId);
}

beforeEach(async () => {
  vi.clearAllMocks();
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  professorId = (await criarUsuario(["PROFESSOR"])).id;
  gestorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  const administradorId = (await criarUsuario(["ADMINISTRADOR"])).id;
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  nivelId = nivel.id;
  const regra = await prisma.$transaction(tx => prepararRegraAvaliacaoTx(tx, gestorId, {
    nivelId,
    versaoEsperada: 0,
    conteudo: regraAvaliacaoTeste(),
    motivo: "Regra de avaliação para fontes de recuperação",
    chaveIdempotencia: "regra-fontes-recuperacao",
  }));
  regraId = regra.id;
  const regraPersistida = await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: regraId } });
  await prisma.$transaction(tx => decidirRegraAvaliacaoTx(tx, administradorId, {
    regraId,
    conteudoHash: regraPersistida.conteudoHash,
    aprovada: true,
    motivo: "Publicação independente da regra de avaliação",
  }));
  const turma = await prisma.turma.create({ data: {
    nome: "Turma de fontes de recuperação",
    modalidadeId: catalogo.modalidade.id,
    nivelId,
    professorId,
    dataInicio: new Date("2099-01-01T00:00:00.000Z"),
    vinculosDocentes: { create: { professorId, inicio } },
  } });
  await prisma.turma.update({ where: { id: turma.id }, data: { dataInicio: inicio, status: "EM_ANDAMENTO" } });
  turmaId = turma.id;
  regraId = (await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } })).regraAvaliacaoId!;
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluna das fontes", paisId: catalogo.pais.id } });
  const matricula = await prisma.matricula.create({ data: {
    alunoId: aluno.id,
    produtoId: catalogo.produto.id,
    paisId: catalogo.pais.id,
    moeda: "CRC",
    status: "ATIVA",
    ativadaEm: inicio,
  } });
  matriculaId = matricula.id;
  alocacaoId = (await prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, matriculaId, turmaId, criadoEm: inicio } })).id;
  entrar(professorId);
});

it("preserva fontes regulares e só inclui recuperação que melhora após oficialização", async () => {
  await lancarRegular(alocacaoId, "principal", "5");
  const regulares = await lerFontes();
  expect(regulares).toHaveLength(5);
  expect(regulares.every(fonte => fonte.tipoFonte === "REGULAR" && fonte.nota === "5")).toBe(true);

  const recuperacao = await recuperarFala("8", 0);
  expect((await lerFontes()).filter(fonte => fonte.tipoFonte === "RECUPERACAO")).toEqual([]);
  await oficializarRecuperacao(recuperacao.id);

  const depois = await lerFontes();
  expect(depois.filter(fonte => fonte.tipoFonte === "REGULAR")).toHaveLength(5);
  expect(depois.filter(fonte => fonte.tipoFonte === "RECUPERACAO")).toMatchObject([{
    realizacaoId: recuperacao.realizacaoId,
    notaRecuperacaoId: recuperacao.id,
    habilidade: "FALA",
    nota: "8",
    oficial: true,
  }]);
});

it("não projeta recuperação oficial inferior e altera o hash somente com correção aprovada", async () => {
  await lancarRegular(alocacaoId, "principal", "5");
  const melhor = await recuperarFala("8", 0);
  await oficializarRecuperacao(melhor.id);
  const fonteMelhor = (await lerFontes()).find(fonte => fonte.tipoFonte === "RECUPERACAO");
  expect(fonteMelhor).toMatchObject({ nota: "8", notaRecuperacaoId: melhor.id, correcaoRecuperacaoId: null });

  const pior = await recuperarFala("4", 1);
  await oficializarRecuperacao(pior.id);
  expect((await lerFontes()).filter(fonte => fonte.tipoFonte === "RECUPERACAO")).toEqual([expect.objectContaining({
    notaRecuperacaoId: melhor.id,
    nota: "8",
    fonteHash: fonteMelhor!.fonteHash,
  })]);

  const proposta = await proporCorrecaoRecuperacao({
    notaId: melhor.id,
    origemId: melhor.id,
    nota: "9",
    comentarioAluno: "Correção oficial da recuperação oral",
    motivo: "Evidência revisada altera a nota da recuperação",
    versaoEsperada: 0,
    chaveIdempotencia: "fontes-recuperacao-correcao",
  });
  assertOk(proposta);
  entrar(gestorId);
  const revisao = await revisarCorrecaoRecuperacao(proposta.dado.id);
  assertOk(revisao);
  assertOk(await decidirCorrecaoRecuperacao({
    propostaId: proposta.dado.id,
    propostaHash: revisao.dado.propostaHash,
    impactosHash: revisao.dado.impactosHash,
    aprovada: true,
    motivo: "Correção conferida por gestão independente",
  }));

  const corrigida = (await lerFontes()).find(fonte => fonte.tipoFonte === "RECUPERACAO");
  expect(corrigida).toMatchObject({ notaRecuperacaoId: melhor.id, nota: "9", correcaoRecuperacaoId: proposta.dado.id });
  expect(corrigida?.fonteHash).not.toBe(fonteMelhor?.fonteHash);
});

it("mantém fontes oficializadas de outra matrícula fora do contexto", async () => {
  await lancarRegular(alocacaoId, "principal", "5");
  const catalogo = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId }, select: { produtoId: true, paisId: true } });
  const outroAluno = await prisma.aluno.create({ data: { primeiroNome: "Outro contrato", paisId: catalogo.paisId } });
  const outraMatricula = await prisma.matricula.create({ data: {
    alunoId: outroAluno.id,
    produtoId: catalogo.produtoId,
    paisId: catalogo.paisId,
    moeda: "CRC",
    status: "ATIVA",
    ativadaEm: inicio,
  } });
  const outraAlocacao = await prisma.alocacaoTurma.create({ data: {
    alunoId: outroAluno.id,
    matriculaId: outraMatricula.id,
    turmaId,
    criadoEm: inicio,
  } });
  // A segunda matrícula também precisa estar insuficiente para que sua
  // recuperação seja uma origem persistida real, e não uma fixture direta.
  await lancarRegular(outraAlocacao.id, "outra-matricula", "5");

  const contextoPrincipal = { matriculaId, alocacaoId };
  matriculaId = outraMatricula.id;
  alocacaoId = outraAlocacao.id;
  try {
    const recuperacaoOutraMatricula = await recuperarFala("10", 0);
    await oficializarRecuperacao(recuperacaoOutraMatricula.id);
    expect((await lerFontes()).filter(fonte => fonte.tipoFonte === "RECUPERACAO")).toMatchObject([{
      notaRecuperacaoId: recuperacaoOutraMatricula.id,
      matriculaId: outraMatricula.id,
    }]);
  } finally {
    matriculaId = contextoPrincipal.matriculaId;
    alocacaoId = contextoPrincipal.alocacaoId;
  }

  const fontes = await lerFontes();
  expect(fontes).toHaveLength(5);
  expect(fontes.every(fonte => fonte.matriculaId === matriculaId && fonte.alocacaoId === alocacaoId)).toBe(true);
  expect(fontes.some(fonte => fonte.matriculaId === outraMatricula.id || fonte.alocacaoId === outraAlocacao.id)).toBe(false);
});
