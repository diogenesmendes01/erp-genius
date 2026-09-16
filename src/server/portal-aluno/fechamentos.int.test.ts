import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authMock: vi.fn(), portalCookie: "" }));
vi.mock("@/lib/auth", () => ({ auth: mocks.authMock }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nome: string) => nome === "portal_aluno_session" && mocks.portalCookie ? { value: mocks.portalCookie } : undefined,
    delete: vi.fn(),
  }),
}));

import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HABILIDADES } from "@/server/avaliacoes/calculo";
import { proporCorrecaoNota, revisarCorrecaoNota, decidirCorrecaoNota } from "@/server/avaliacoes/correcao";
import { proporCorrecaoNotaTx } from "@/server/avaliacoes/correcao-tx";
import { decidirCorrecaoNotaTx, revisarCorrecaoNotaTx } from "@/server/avaliacoes/correcao-decisao-tx";
import { decidirExcecaoFrequencia, proporExcecaoFrequencia } from "@/server/avaliacoes/excecao-frequencia";
import { confirmarFechamentoAcademico, revisarFechamentoAcademico } from "@/server/avaliacoes/fechamento";
import { salvarLancamentoAvaliacao, oficializarLancamentoAvaliacao } from "@/server/avaliacoes/lancamentos";
import { decidirRegraAvaliacaoTx, prepararRegraAvaliacaoTx } from "@/server/avaliacoes/regras-tx";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { consultarFechamentosPortalAluno } from "./fechamentos";
import { criarSessaoPortalAlunoTx } from "./sessao";

type ContextoFechamento = {
  alunoId: string;
  matriculaId: string;
  nivelId: string;
  turmaId: string;
  alocacaoId: string;
  codigo: string;
  intermediariaId?: string;
};

let catalogoContexto: { produtoId: string; paisId: string };
let professorId: string;
let gestorId: string;
let administradorId: string;
let secretariaId: string;
let alunoDonoId: string;
let contaDonoId: string;
let suficiente: ContextoFechamento;
let insuficiente: ContextoFechamento;
let suficienteComExcecaoFrequencia: ContextoFechamento;
let semFechamento: ContextoFechamento;
let outroAluno: ContextoFechamento;

const inicio = new Date("2026-01-01T00:00:00.000Z");
const entrar = (id: string) => mocks.authMock.mockResolvedValue({ user: { id } });

function assertOk<T extends { ok: boolean; dado?: unknown }>(resultado: T): asserts resultado is T & { ok: true; dado: NonNullable<T["dado"]> } {
  expect(resultado, JSON.stringify(resultado)).toMatchObject({ ok: true });
  if (!resultado.ok || resultado.dado === undefined || resultado.dado === null) throw new Error(JSON.stringify(resultado));
}

async function criarContexto(alunoId: string, codigoNivel: string, ordem: number, codigoMatricula: string): Promise<ContextoFechamento> {
  const catalogo = catalogoContexto;
  const produto = await prisma.produto.findUniqueOrThrow({ where: { id: catalogo.produtoId }, select: { idiomaId: true, modalidadeId: true } });
  const nivel = await prisma.nivel.create({ data: { idiomaId: produto.idiomaId, codigo: codigoNivel, ordem } });
  const regra = await prisma.$transaction(tx => prepararRegraAvaliacaoTx(tx, gestorId, {
    nivelId: nivel.id,
    versaoEsperada: 0,
    conteudo: regraAvaliacaoTeste(),
    motivo: `Regra publicada para o fechamento ${codigoNivel} do portal.`,
    chaveIdempotencia: `portal-fechamentos-regra-${codigoNivel}-${alunoId}`,
  }));
  const regraPersistida = await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: regra.id } });
  await prisma.$transaction(tx => decidirRegraAvaliacaoTx(tx, administradorId, {
    regraId: regra.id,
    conteudoHash: regraPersistida.conteudoHash,
    aprovada: true,
    motivo: `Direção publicou a regra do nível ${codigoNivel}.`,
  }));
  const turma = await prisma.turma.create({ data: {
    nome: `Turma portal ${codigoNivel}`,
    modalidadeId: produto.modalidadeId,
    nivelId: nivel.id,
    professorId,
    dataInicio: new Date("2099-01-01T00:00:00.000Z"),
    vinculosDocentes: { create: { professorId, inicio } },
  } });
  await prisma.turma.update({ where: { id: turma.id }, data: { status: "EM_ANDAMENTO", dataInicio: inicio } });
  const matricula = await prisma.matricula.create({ data: {
    alunoId,
    produtoId: catalogo.produtoId,
    paisId: catalogo.paisId,
    moeda: "CRC",
    codigo: codigoMatricula,
    status: "ATIVA",
    ativadaEm: inicio,
  } });
  const alocacao = await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId: matricula.id, turmaId: turma.id, criadoEm: inicio } });
  return { alunoId, matriculaId: matricula.id, nivelId: nivel.id, turmaId: turma.id, alocacaoId: alocacao.id, codigo: codigoMatricula };
}

async function registrarFrequenciaConferida(contexto: ContextoFechamento, participacao: "PRESENTE" | "FALTA" = "PRESENTE") {
  const encontro = await prisma.encontroAgenda.create({ data: {
    turmaId: contexto.turmaId,
    professorId,
    preparadorId: gestorId,
    inicio: new Date("2026-01-10T10:00:00.000Z"),
    fim: new Date("2026-01-10T11:00:00.000Z"),
    fusoOrigem: "UTC",
    status: "PREVISTO",
    finalidade: "AULA",
    motivo: "Aula conferida para a frequência do fechamento do portal.",
    chaveIdempotencia: `portal-fechamentos-presenca-${contexto.matriculaId}`,
    entradaHash: `fixture-presenca-${contexto.matriculaId}`,
  } });
  await prisma.aulaDiario.create({ data: {
    encontroId: encontro.id,
    turmaId: contexto.turmaId,
    professorId,
    ocorridaEm: encontro.inicio,
    conteudo: "Aula realizada com participação conferida.",
    registros: { create: {
      alunoId: contexto.alunoId,
      matriculaId: contexto.matriculaId,
      nomeAluno: "Aluno do fechamento portal",
      presente: participacao === "PRESENTE",
      participacao,
    } },
  } });
  await prisma.encontroAgenda.update({ where: { id: encontro.id }, data: { status: "MINISTRADO" } });
}

async function oficializarNotas(contexto: ContextoFechamento, nota: string) {
  const salvar = async (codigoAvaliacao: "I1" | "F1", chave: string) => {
    entrar(professorId);
    const salvo = await salvarLancamentoAvaliacao({
      alocacaoId: contexto.alocacaoId,
      codigoAvaliacao,
      realizadaEm: "2026-01-11T10:00:00.000Z",
      notas: codigoAvaliacao === "I1"
        ? [{ habilidade: "FALA", nota, comentarioAluno: `Nota oficial de fala: ${nota}.` }]
        : HABILIDADES.map(habilidade => ({ habilidade, nota, comentarioAluno: `Nota oficial ${habilidade}: ${nota}.` })),
      submetida: true,
      versaoEsperada: 0,
      chaveIdempotencia: chave,
    });
    assertOk(salvo);
    const lancamento = await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: salvo.dado.id } });
    entrar(gestorId);
    assertOk(await oficializarLancamentoAvaliacao({
      lancamentoId: lancamento.id,
      conteudoHash: lancamento.conteudoHash,
      aprovada: true,
      motivo: "Gestão conferiu a nota oficial que compõe o fechamento do portal.",
    }));
    return lancamento;
  };
  contexto.intermediariaId = (await salvar("I1", `portal-fechamentos-${contexto.codigo}-i1`)).id;
  await salvar("F1", `portal-fechamentos-${contexto.codigo}-f1`);
}

async function confirmarFechamento(contexto: ContextoFechamento, chave: string) {
  entrar(gestorId);
  const revisao = await revisarFechamentoAcademico({ alocacaoId: contexto.alocacaoId });
  assertOk(revisao);
  const confirmado = await confirmarFechamentoAcademico({
    alocacaoId: contexto.alocacaoId,
    estadoHash: revisao.dado.estadoHash,
    versaoEsperada: revisao.dado.versaoAtual,
    motivo: "Fechamento acadêmico confirmado para a visualização do aluno no portal.",
    chaveIdempotencia: chave,
  });
  assertOk(confirmado);
  return confirmado.dado;
}

async function confirmarFechamentoComExcecaoFrequencia(contexto: ContextoFechamento, chave: string) {
  entrar(gestorId);
  const antes = await revisarFechamentoAcademico({ alocacaoId: contexto.alocacaoId });
  assertOk(antes);
  expect(antes.dado.elegibilidade).toMatchObject({ situacao: "INSUFICIENTE", frequencia: { atendeMinimoReal: false, excecaoAplicada: false } });
  const proposta = await proporExcecaoFrequencia({
    alocacaoId: contexto.alocacaoId,
    fonteHash: antes.dado.snapshot.frequencia.fonteHash,
    versaoEsperada: antes.dado.versaoAtual,
    motivo: "Evidência acadêmica excepcional permite progressão sem alterar a frequência real.",
    evidencias: "Evidência independente registrada e conferida pela gestão pedagógica.",
    chaveIdempotencia: `${chave}-excecao`,
  });
  assertOk(proposta);
  entrar(administradorId);
  assertOk(await decidirExcecaoFrequencia({
    propostaId: proposta.dado.id,
    fonteHash: antes.dado.snapshot.frequencia.fonteHash,
    aprovada: true,
    motivo: "Direção decide a exceção de frequência de forma independente.",
  }));
  entrar(gestorId);
  const depois = await revisarFechamentoAcademico({ alocacaoId: contexto.alocacaoId });
  assertOk(depois);
  expect(depois.dado.elegibilidade).toMatchObject({ situacao: "SUFICIENTE", frequencia: { atendeMinimoReal: false, excecaoAplicada: true } });
  const confirmado = await confirmarFechamentoAcademico({
    alocacaoId: contexto.alocacaoId,
    estadoHash: depois.dado.estadoHash,
    versaoEsperada: depois.dado.versaoAtual,
    motivo: "Fechamento suficiente por exceção mantém a frequência real do portal.",
    chaveIdempotencia: chave,
  });
  assertOk(confirmado);
  return confirmado.dado;
}

async function iniciarSessaoPortalReal() {
  const sessao = await prisma.$transaction(tx => criarSessaoPortalAlunoTx(tx, {
    contaId: contaDonoId,
    versaoConta: 1,
    prazos: { sessaoMinutos: 60, conviteMinutos: 60, recuperacaoMinutos: 60, validacaoEmailMinutos: 60 },
  }));
  mocks.portalCookie = sessao.segredo;
}

beforeEach(async () => {
  mocks.portalCookie = "";
  mocks.authMock.mockReset();
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  catalogoContexto = { produtoId: catalogo.produto.id, paisId: catalogo.pais.id };
  professorId = (await criarUsuario([Papel.PROFESSOR], "Professor do fechamento")).id;
  gestorId = (await criarUsuario([Papel.GERENTE_PEDAGOGICO], "Gestão do fechamento")).id;
  administradorId = (await criarUsuario([Papel.ADMINISTRADOR], "Direção do fechamento")).id;
  secretariaId = (await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Funcionário sem portal")).id;
  alunoDonoId = (await prisma.aluno.create({ data: { primeiroNome: "Aluna dona do portal", paisId: catalogo.pais.id, email: "dona.fechamentos@portal.test" } })).id;
  const outroAlunoId = (await prisma.aluno.create({ data: { primeiroNome: "Outro aluno do portal", paisId: catalogo.pais.id, email: "outro.fechamentos@portal.test" } })).id;
  suficiente = await criarContexto(alunoDonoId, "A1", 1, "M-PORTAL-SUF");
  insuficiente = await criarContexto(alunoDonoId, "A2", 2, "M-PORTAL-INS");
  suficienteComExcecaoFrequencia = await criarContexto(alunoDonoId, "B1", 3, "M-PORTAL-EXC");
  semFechamento = await criarContexto(alunoDonoId, "B2", 4, "M-PORTAL-SEM");
  outroAluno = await criarContexto(outroAlunoId, "C1", 5, "M-OUTRO-OCULTO");
  for (const contexto of [suficiente, insuficiente, outroAluno]) await registrarFrequenciaConferida(contexto);
  await registrarFrequenciaConferida(suficienteComExcecaoFrequencia, "FALTA");
  await oficializarNotas(suficiente, "8");
  await oficializarNotas(insuficiente, "5");
  await oficializarNotas(suficienteComExcecaoFrequencia, "8");
  await oficializarNotas(outroAluno, "8");
  await confirmarFechamento(suficiente, "portal-fechamentos-suficiente-v1");
  await confirmarFechamento(insuficiente, "portal-fechamentos-insuficiente-v1");
  await confirmarFechamentoComExcecaoFrequencia(suficienteComExcecaoFrequencia, "portal-fechamentos-excecao-v1");
  await confirmarFechamento(outroAluno, "portal-fechamentos-outro-v1");
  const conta = await prisma.contaPortalAluno.create({ data: {
    alunoId: alunoDonoId,
    emailVerificado: "dona.fechamentos@portal.test",
    emailVerificadoEm: new Date(),
    senhaHash: "hash-servidor-nao-exposto",
    ativa: true,
  } });
  contaDonoId = conta.id;
  await iniciarSessaoPortalReal();
});

it("exibe somente os fechamentos atuais da conta dona, com resumo público de notas e frequência real", async () => {
  const fechamentos = await consultarFechamentosPortalAluno();
  expect(fechamentos).toEqual(expect.arrayContaining([
    expect.objectContaining({
      matriculaId: suficiente.matriculaId, nivelId: suficiente.nivelId, estado: "CONFIRMADO_SUFICIENTE", versao: 1, confirmadoEm: expect.any(String),
      resumo: {
        geral: { numerador: "8", denominador: "1" }, minimoGeral: "7",
        habilidades: expect.arrayContaining([expect.objectContaining({ habilidade: "FALA", resultado: { numerador: "8", denominador: "1" }, minimo: "6", atendeMinimo: true })]),
        frequencia: { base: 1, presencas: 1, regularizadas: 0, faltas: 0, impedimentos: 0, percentual: { numerador: "100", denominador: "1" }, minimoPercentual: "75", atendeMinimo: true },
      },
    }),
    expect.objectContaining({
      matriculaId: insuficiente.matriculaId, nivelId: insuficiente.nivelId, estado: "CONFIRMADO_INSUFICIENTE", versao: 1, confirmadoEm: expect.any(String),
      resumo: {
        geral: { numerador: "5", denominador: "1" }, minimoGeral: "7",
        habilidades: expect.arrayContaining([expect.objectContaining({ habilidade: "FALA", resultado: { numerador: "5", denominador: "1" }, minimo: "6", atendeMinimo: false })]),
        frequencia: { base: 1, presencas: 1, regularizadas: 0, faltas: 0, impedimentos: 0, percentual: { numerador: "100", denominador: "1" }, minimoPercentual: "75", atendeMinimo: true },
      },
    }),
    expect.objectContaining({
      matriculaId: suficienteComExcecaoFrequencia.matriculaId, nivelId: suficienteComExcecaoFrequencia.nivelId, estado: "CONFIRMADO_SUFICIENTE", versao: 1, confirmadoEm: expect.any(String),
      resumo: expect.objectContaining({
        geral: { numerador: "8", denominador: "1" },
        frequencia: { base: 1, presencas: 0, regularizadas: 0, faltas: 1, impedimentos: 0, percentual: { numerador: "0", denominador: "1" }, minimoPercentual: "75", atendeMinimo: false },
      }),
    }),
    expect.objectContaining({ matriculaId: semFechamento.matriculaId, nivelId: semFechamento.nivelId, estado: "SEM_FECHAMENTO", versao: null, confirmadoEm: null, resumo: null }),
  ]));
  expect(fechamentos).toHaveLength(4);
  expect(JSON.stringify(fechamentos)).not.toContain(outroAluno.matriculaId);
  expect(JSON.stringify(fechamentos)).not.toMatch(/snapshot|estadoHash|fonteHash|entradaHash|motivo|evidencia|confirmadoPor|autor/i);
});

it("marca a versão anterior em revisão após correção oficial e volta a confirmar somente na nova versão", async () => {
  const intermediariaId = suficiente.intermediariaId;
  if (!intermediariaId) throw new Error("Fixture sem lançamento intermediário oficial.");
  const lancamento = await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: intermediariaId } });
  entrar(professorId);
  const proposta = await proporCorrecaoNota({
    lancamentoId: lancamento.id,
    origemHash: lancamento.conteudoHash,
    notas: [{ habilidade: "FALA", nota: "9", comentarioAluno: "Correção oficial posterior ao fechamento." }],
    motivo: "Evidência posterior exige revisar a fonte oficial da fala.",
    versaoEsperada: 0,
    chaveIdempotencia: "portal-fechamentos-correcao-fonte",
  });
  assertOk(proposta);
  entrar(administradorId);
  const revisaoCorrecao = await revisarCorrecaoNota(proposta.dado.id);
  assertOk(revisaoCorrecao);
  assertOk(await decidirCorrecaoNota({
    propostaId: proposta.dado.id,
    propostaHash: revisaoCorrecao.dado.propostaHash,
    impactosHash: revisaoCorrecao.dado.impactosHash,
    aprovada: true,
    motivo: "Direção aprova a correção independente da nota oficial.",
  }));

  const emRevisao = await consultarFechamentosPortalAluno();
  expect(emRevisao).toEqual(expect.arrayContaining([
    expect.objectContaining({ matriculaId: suficiente.matriculaId, nivelId: suficiente.nivelId, estado: "EM_REVISAO", versao: 1, confirmadoEm: expect.any(String), resumo: null }),
  ]));
  entrar(gestorId);
  const revisaoFechamento = await revisarFechamentoAcademico({ alocacaoId: suficiente.alocacaoId });
  assertOk(revisaoFechamento);
  const novo = await confirmarFechamentoAcademico({
    alocacaoId: suficiente.alocacaoId,
    estadoHash: revisaoFechamento.dado.estadoHash,
    versaoEsperada: revisaoFechamento.dado.versaoAtual,
    motivo: "Nova versão confirma a fonte corrigida para o portal do aluno.",
    chaveIdempotencia: "portal-fechamentos-suficiente-v2",
  });
  assertOk(novo);
  expect(novo.dado).toMatchObject({ versao: 2, resultadoSuficiente: true });

  const atual = await consultarFechamentosPortalAluno();
  expect(atual).toEqual(expect.arrayContaining([
    expect.objectContaining({ matriculaId: suficiente.matriculaId, nivelId: suficiente.nivelId, estado: "CONFIRMADO_SUFICIENTE", versao: 2, confirmadoEm: expect.any(String), resumo: expect.any(Object) }),
  ]));
});

it("não aceita sessão de funcionário sem cookie do portal nem sessão portal revogada", async () => {
  mocks.portalCookie = "";
  entrar(secretariaId);
  await expect(consultarFechamentosPortalAluno()).rejects.toThrow("Sessão do aluno inválida");

  const sessaoRevogavel = await prisma.$transaction(tx => criarSessaoPortalAlunoTx(tx, {
    contaId: contaDonoId,
    versaoConta: 1,
    prazos: { sessaoMinutos: 60, conviteMinutos: 60, recuperacaoMinutos: 60, validacaoEmailMinutos: 60 },
  }));
  mocks.portalCookie = sessaoRevogavel.segredo;
  await prisma.sessaoPortalAluno.update({ where: { id: sessaoRevogavel.id }, data: { revogadaEm: new Date() } });
  await expect(consultarFechamentosPortalAluno()).rejects.toThrow("Sessão do aluno inválida");
});

it("lê a fonte corrigida quando a consulta aguarda o lock acadêmico global", async () => {
  const intermediariaId = suficiente.intermediariaId;
  if (!intermediariaId) throw new Error("Fixture sem lançamento intermediário oficial.");
  const lancamento = await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: intermediariaId } });
  let consulta!: Promise<Awaited<ReturnType<typeof consultarFechamentosPortalAluno>>>;
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
    consulta = consultarFechamentosPortalAluno();

    let aguardando = false;
    const limite = Date.now() + 3_000;
    while (Date.now() < limite) {
      await tx.$executeRaw`SELECT pg_stat_clear_snapshot()`;
      const [atividade] = await tx.$queryRaw<{ aguardando: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM pg_stat_activity
          WHERE wait_event_type = 'Lock' AND wait_event = 'advisory'
            AND pg_backend_pid() = ANY(pg_blocking_pids(pid))
        ) AS aguardando
      `;
      if (atividade?.aguardando) { aguardando = true; break; }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    expect(aguardando, "A consulta do portal deve aguardar o lock acadêmico antes de ler candidatas.").toBe(true);

    const proposta = await proporCorrecaoNotaTx(tx, professorId, {
      lancamentoId: lancamento.id,
      origemHash: lancamento.conteudoHash,
      notas: [{ habilidade: "FALA", nota: "9", comentarioAluno: "Correção aprovada enquanto a consulta aguarda." }],
      motivo: "Evidência posterior altera a fonte durante a leitura concorrente.",
      versaoEsperada: 0,
      chaveIdempotencia: "portal-fechamentos-correcao-concorrente",
    });
    const revisao = await revisarCorrecaoNotaTx(tx, administradorId, proposta.id);
    await decidirCorrecaoNotaTx(tx, administradorId, {
      propostaId: proposta.id,
      propostaHash: revisao.p.entradaHash,
      impactosHash: revisao.impactosHash,
      aprovada: true,
      motivo: "Direção aprova a fonte alterada ainda sob o lock global.",
    });
  }, { timeout: 8_000 });

  const resposta = await consulta;
  expect(resposta).toEqual(expect.arrayContaining([
    expect.objectContaining({ matriculaId: suficiente.matriculaId, nivelId: suficiente.nivelId, estado: "EM_REVISAO", versao: 1, confirmadoEm: expect.any(String) }),
  ]));
});
