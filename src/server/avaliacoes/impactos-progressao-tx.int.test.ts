import { beforeEach, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { Papel, Prisma } from "@prisma/client";
import { aprovarCorrecaoAula, proporCorrecaoAula, revisarCorrecaoAula, revisarImpactosCorrecaoAula } from "@/server/diario/correcao-aula";
import { carregarImpactosCorrecaoAulaTx } from "@/server/diario/correcao-aula-impactos-tx";
import { proporCorrecaoConclusaoReposicao, decidirCorrecaoConclusaoReposicao } from "@/server/diario/reposicao-individual";
import { consultarCorrecoesConclusaoReposicao } from "@/server/diario/correcao-reposicao-consulta";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import { HABILIDADES } from "./calculo";
import { confirmarFechamentoAcademico, revisarFechamentoAcademico } from "./fechamento";
import { carregarImpactosProgressaoPorAproveitamentoTx } from "./impactos-progressao-tx";
import { decidirCorrecaoNota, proporCorrecaoNota, revisarCorrecaoNota } from "./correcao";
import { consultarCasoRevisaoProgressao } from "./revisao-progressao-consulta";
import { listarRevisoesPorCorrecao } from "./revisoes-pendentes";
import { decidirResolucaoRevisaoProgressao, listarPropostasResolucaoRevisaoProgressao, proporResolucaoRevisaoProgressao, revisarResolucaoRevisaoProgressao } from "./resolucao-revisao-progressao";
import { decidirResolucaoRevisaoProgressaoTx } from "./resolucao-revisao-progressao-tx";
import { decidirEquivalenciaTransferencia } from "./equivalencia-decisao";
import { executarEquivalenciaTransferencia } from "./equivalencia-execucao";
import { proporEquivalenciaTransferencia, revisarEquivalenciaTransferencia } from "./equivalencia-proposta";
import { oficializarLancamentoAvaliacao, salvarLancamentoAvaliacao } from "./lancamentos";
import { decidirRegraAvaliacaoTx, prepararRegraAvaliacaoTx } from "./regras-tx";
import { decidirMudancaAcademica, executarMudancaAcademica, solicitarMudancaAcademica } from "@/server/academico/acoes";

const inicio = new Date("2026-01-01T00:00:00.000Z");
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

let catalogo: Awaited<ReturnType<typeof seedCatalogoMinimo>>;
let professorId: string;
let gestorId: string;
let administradorId: string;
let secretariaId: string;
let alunoId: string;
let matriculaId: string;
let alocacaoAId: string;
let turmaAId: string;
let turmaBId: string;
let turmaCId: string;
let turmaSemAplicacaoId: string;
let turmaProgressaoId: string;

function assertOk<T extends { ok: boolean; dado?: unknown }>(resultado: T): asserts resultado is T & { ok: true; dado: NonNullable<T["dado"]> } {
  expect(resultado, JSON.stringify(resultado)).toMatchObject({ ok: true });
  if (!resultado.ok || resultado.dado === undefined || resultado.dado === null) throw new Error(JSON.stringify(resultado));
}

async function criarTurma(nivelId: string, nome: string, emAndamento = false) {
  const turma = await prisma.turma.create({ data: {
    nome,
    modalidadeId: (await prisma.turma.findFirstOrThrow({ select: { modalidadeId: true } })).modalidadeId,
    nivelId,
    professorId,
    dataInicio: new Date("2099-01-01T00:00:00.000Z"),
    status: "ABERTA",
    capacidade: 12,
    diasSemana: [1, 3],
    horarioInicio: "18:00",
    horarioFim: "19:00",
    vinculosDocentes: { create: { professorId, inicio } },
  } });
  return emAndamento
    ? prisma.turma.update({ where: { id: turma.id }, data: { status: "EM_ANDAMENTO", dataInicio: inicio } })
    : turma;
}

async function publicarRegra(nivelId: string, chave: string) {
  const regra = await prisma.$transaction(tx => prepararRegraAvaliacaoTx(tx, gestorId, {
    nivelId, versaoEsperada: 0, conteudo: regraAvaliacaoTeste(),
    motivo: "Regra publicada para a fixture de impactos de progressão.", chaveIdempotencia: chave,
  }));
  const persistida = await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: regra.id } });
  await prisma.$transaction(tx => decidirRegraAvaliacaoTx(tx, administradorId, {
    regraId: regra.id, conteudoHash: persistida.conteudoHash, aprovada: true,
    motivo: "Publicação independente da regra da fixture.",
  }));
}

async function aplicarEquivalencia(alocacaoOrigemId: string, turmaDestinoId: string, chave: string) {
  entrar(gestorId);
  const base = { matriculaId, alocacaoOrigemId, turmaDestinoId, mapeamentos: [] };
  const revisao = await revisarEquivalenciaTransferencia(base);
  assertOk(revisao);
  const proposta = await proporEquivalenciaTransferencia({
    ...base, estadoHash: revisao.dado.estadoHash, versaoEsperada: revisao.dado.versaoAtual,
    motivo: "Transferência equivalente aplicada para conferir impactos transitivos.", chaveIdempotencia: chave,
  });
  assertOk(proposta);
  entrar(administradorId);
  const decisao = await decidirEquivalenciaTransferencia({
    propostaId: proposta.dado.id, estadoHash: revisao.dado.estadoHash, aprovar: true,
    motivo: "Decisão independente da transferência equivalente da fixture.",
  });
  assertOk(decisao);
  entrar(secretariaId);
  const aplicada = await executarEquivalenciaTransferencia({
    decisaoId: decisao.dado.id, motivo: "Secretaria aplica a equivalência para a cadeia de impactos.", horarioCompativel: true,
  });
  assertOk(aplicada);
  return aplicada.dado.alocacaoDestinoId;
}

async function prepararEquivalenciaSemAplicar(alocacaoOrigemId: string) {
  entrar(gestorId);
  const base = { matriculaId, alocacaoOrigemId, turmaDestinoId: turmaSemAplicacaoId, mapeamentos: [] };
  const revisao = await revisarEquivalenciaTransferencia(base);
  assertOk(revisao);
  const proposta = await proporEquivalenciaTransferencia({
    ...base, estadoHash: revisao.dado.estadoHash, versaoEsperada: revisao.dado.versaoAtual,
    motivo: "Proposta equivalente que permanece sem aplicação.", chaveIdempotencia: "impactos-proposta-sem-aplicar",
  });
  assertOk(proposta);
  entrar(administradorId);
  const decisao = await decidirEquivalenciaTransferencia({
    propostaId: proposta.dado.id, estadoHash: revisao.dado.estadoHash, aprovar: false,
    motivo: "Rejeição que preserva a proposta sem efetivar equivalência.",
  });
  assertOk(decisao);
  return decisao.dado.id;
}

async function fecharC(alocacaoCId: string, extra?: { alunoId: string; matriculaId: string }) {
  const inicioEncontro = new Date();
  const encontro = await prisma.encontroAgenda.create({ data: {
    turmaId: turmaCId, professorId, preparadorId: gestorId,
    inicio: inicioEncontro, fim: new Date(inicioEncontro.getTime() + 1),
    fusoOrigem: "UTC", status: "PREVISTO", finalidade: "AULA",
    motivo: "Aula real da frequência da progressão após a equivalência.",
    chaveIdempotencia: "impactos-progressao-frequencia-c", entradaHash: "fixture-impactos-progressao-frequencia-c",
  } });
  await prisma.aulaDiario.create({ data: {
    encontroId: encontro.id, turmaId: turmaCId, professorId, ocorridaEm: encontro.inicio,
    conteudo: "Aula realizada para fechar a progressão da alocação C.",
    registros: { create: [
      { alunoId, matriculaId, nomeAluno: "Aluno da cadeia", presente: true, participacao: "PRESENTE" },
      ...(extra ? [{ ...extra, nomeAluno: "Aluno sem alteração", presente: true, participacao: "PRESENTE" as const }] : []),
    ] },
  } });
  await prisma.encontroAgenda.update({ where: { id: encontro.id }, data: { status: "MINISTRADO" } });
  for (const codigoAvaliacao of ["I1", "F1"] as const) {
    entrar(professorId);
    const notas = codigoAvaliacao === "I1"
      ? [{ habilidade: "FALA" as const, nota: "8", comentarioAluno: "Resultado oficial da cadeia." }]
      : HABILIDADES.map(habilidade => ({ habilidade, nota: "8", comentarioAluno: `Resultado oficial ${habilidade}.` }));
    const salvo = await salvarLancamentoAvaliacao({
      alocacaoId: alocacaoCId, codigoAvaliacao, realizadaEm: new Date().toISOString(), notas,
      submetida: true, versaoEsperada: 0, chaveIdempotencia: `impactos-progressao-${codigoAvaliacao}`,
    });
    assertOk(salvo);
    const lancamento = await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: salvo.dado.id } });
    entrar(gestorId);
    assertOk(await oficializarLancamentoAvaliacao({
      lancamentoId: lancamento.id, conteudoHash: lancamento.conteudoHash, aprovada: true,
      motivo: "Gestão confere a avaliação do fechamento da cadeia.",
    }));
  }
  entrar(gestorId);
  const revisao = await revisarFechamentoAcademico({ alocacaoId: alocacaoCId });
  assertOk(revisao);
  expect(revisao.dado.elegibilidade).toMatchObject({ podeProgredir: true, pendencias: [] });
  const fechamento = await confirmarFechamentoAcademico({
    alocacaoId: alocacaoCId, estadoHash: revisao.dado.estadoHash, versaoEsperada: revisao.dado.versaoAtual,
    motivo: "Fechamento suficiente para a progressão real após a cadeia.", chaveIdempotencia: "impactos-progressao-fechamento-c",
  });
  assertOk(fechamento);
}

async function aprovarProgressao(alocacaoCId: string) {
  entrar(secretariaId);
  const solicitacao = await solicitarMudancaAcademica(alunoId, {
    matriculaId, alocacaoOrigemId: alocacaoCId, turmaDestinoId: turmaProgressaoId,
    motivo: "Progressão real que deve aparecer nos impactos da cadeia.", horarioCompativel: true,
  });
  assertOk(solicitacao);
  entrar(gestorId);
  const decisao = await decidirMudancaAcademica(solicitacao.dado.solicitacaoId, {
    aprovar: true, motivo: "Gestão aprova a progressão depois do fechamento suficiente.",
    justificativaDispensaParecer: "A gestão conferiu o fechamento oficial para esta fixture.",
  });
  expect(decisao).toMatchObject({ ok: true });
  return solicitacao.dado.solicitacaoId;
}

async function confirmarNovoFechamentoC(alocacaoCId: string, chaveIdempotencia: string) {
  entrar(gestorId);
  const revisao = await revisarFechamentoAcademico({ alocacaoId: alocacaoCId });
  assertOk(revisao);
  expect(revisao.dado.elegibilidade).toMatchObject({ podeProgredir: true, pendencias: [] });
  const fechamento = await confirmarFechamentoAcademico({
    alocacaoId: alocacaoCId, estadoHash: revisao.dado.estadoHash, versaoEsperada: revisao.dado.versaoAtual,
    motivo: "Novo fechamento suficiente confirmado depois da correção que abriu a revisão.", chaveIdempotencia,
  });
  assertOk(fechamento);
  return fechamento.dado;
}

async function publicarCorrecaoAulaTeste(encontroId: string, participacao: "PRESENTE" | "FALTA", chave: string, adulterar?: "IMPACTOS" | "PARTICIPACAO") {
  entrar(professorId);
  const revisao = await revisarCorrecaoAula({ encontroId });
  assertOk(revisao);
  const proposta = await proporCorrecaoAula({ encontroId, estadoHash: revisao.dado.estadoHash,
    versaoEsperada: revisao.dado.versaoAtual, chaveIdempotencia: chave,
    motivo: "Correção conferida da chamada que compõe a progressão.", evidencia: "Documentação docente da participação revisada.",
    alteracao: { conteudo: `Conteúdo conferido na versão ${chave}.`, registros: revisao.dado.snapshot.registros.map(r => ({
      registroId: r.registroId, participacao: r.matriculaId === matriculaId ? participacao : r.participacao, observacao: r.observacao,
    })) } });
  assertOk(proposta);
  if (!adulterar) {
    entrar(gestorId);
    const impactos = await revisarImpactosCorrecaoAula({ propostaId: proposta.dado.id });
    assertOk(impactos);
    const publicada = await aprovarCorrecaoAula({ propostaId: proposta.dado.id,
      propostaHash: impactos.dado.propostaHash, impactosHash: impactos.dado.impactosHash,
      motivo: "Gestão confirma a correção e a revisão de progressão vinculada." });
    assertOk(publicada);
    return prisma.aprovacaoCorrecaoAula.findUniqueOrThrow({ where: { id: publicada.dado.id } });
  }
  // Escrita interna apenas para comprovar a recusa de impactos adulterados no banco.
  return prisma.$transaction(async tx => {
    const { impactosHash, ...impactos } = await carregarImpactosCorrecaoAulaTx(tx, gestorId, proposta.dado.id);
    if (adulterar === "IMPACTOS") impactos.progressao = impactos.progressao.map(fonte => ({ ...fonte, impactos: [] }));
    if (adulterar === "PARTICIPACAO") impactos.comparacao.registros = impactos.comparacao.registros.map(registro => ({ ...registro, participacaoAlterada: false }));
    return tx.aprovacaoCorrecaoAula.create({ data: { propostaId: proposta.dado.id, decisorId: gestorId,
      propostaHash: impactos.propostaHash, impactosHash, impactos: impactos as Prisma.InputJsonValue,
      motivo: "Gestão confirma a correção e a revisão de progressão vinculada." } });
  });
}

async function oficializarFonteAParaCorrecao() {
  entrar(professorId);
  const salvo = await salvarLancamentoAvaliacao({
    alocacaoId: alocacaoAId, codigoAvaliacao: "I1", realizadaEm: new Date().toISOString(), submetida: true,
    notas: [{ habilidade: "FALA", nota: "8", comentarioAluno: "Fonte oficial anterior à cadeia de equivalências." }],
    versaoEsperada: 0, chaveIdempotencia: "impactos-fonte-a-oficial",
  });
  assertOk(salvo);
  const lancamento = await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: salvo.dado.id } });
  entrar(gestorId);
  assertOk(await oficializarLancamentoAvaliacao({
    lancamentoId: lancamento.id, conteudoHash: lancamento.conteudoHash, aprovada: true,
    motivo: "Gestão confirma a fonte A antes de uma correção posterior.",
  }));
  return lancamento;
}

async function criarPendenteOutraMatricula(catalogo: Awaited<ReturnType<typeof seedCatalogoMinimo>>) {
  const outro = await prisma.aluno.create({ data: { primeiroNome: "Outro contrato", paisId: catalogo.pais.id } });
  const outraMatricula = await prisma.matricula.create({ data: {
    alunoId: outro.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA", ativadaEm: inicio,
  } });
  const outraAlocacao = await prisma.alocacaoTurma.create({ data: { alunoId: outro.id, matriculaId: outraMatricula.id, turmaId: turmaAId, criadoEm: inicio } });
  return prisma.solicitacaoMudancaAcademica.create({ data: {
    alunoId: outro.id, matriculaId: outraMatricula.id, alocacaoOrigemId: outraAlocacao.id,
    turmaOrigemId: turmaAId, turmaDestinoId: turmaProgressaoId,
    motivo: "Pedido pendente de outro contrato, fora da cadeia aplicada.", horarioCompativel: true,
    snapshot: { matriculaOrigemId: outraMatricula.id }, status: "PENDENTE", solicitanteId: secretariaId,
  } });
}

beforeEach(async () => {
  vi.clearAllMocks();
  await truncarBanco();
  catalogo = await seedCatalogoMinimo();
  professorId = (await criarUsuario([Papel.PROFESSOR])).id;
  gestorId = (await criarUsuario([Papel.GERENTE_PEDAGOGICO])).id;
  administradorId = (await criarUsuario([Papel.ADMINISTRADOR])).id;
  secretariaId = (await criarUsuario([Papel.SECRETARIA_ACADEMICA])).id;
  const a1 = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  const a2 = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A2", ordem: 2 } });
  await publicarRegra(a1.id, "impactos-regra-a1");
  await publicarRegra(a2.id, "impactos-regra-a2");
  const base = await prisma.turma.create({ data: {
    nome: "Turma base de impactos", modalidadeId: catalogo.modalidade.id, nivelId: a1.id, professorId,
    dataInicio: new Date("2099-01-01T00:00:00.000Z"), status: "ABERTA", capacidade: 12,
    diasSemana: [1, 3], horarioInicio: "18:00", horarioFim: "19:00",
    vinculosDocentes: { create: { professorId, inicio } },
  } });
  turmaAId = (await prisma.turma.update({ where: { id: base.id }, data: { status: "EM_ANDAMENTO", dataInicio: inicio } })).id;
  turmaBId = (await criarTurma(a1.id, "Turma B aplicada")).id;
  turmaCId = (await criarTurma(a1.id, "Turma C aplicada")).id;
  turmaSemAplicacaoId = (await criarTurma(a1.id, "Turma sem aplicação")).id;
  turmaProgressaoId = (await criarTurma(a2.id, "Turma da progressão", true)).id;
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno da cadeia", paisId: catalogo.pais.id } });
  alunoId = aluno.id;
  const matricula = await prisma.matricula.create({ data: {
    alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA", ativadaEm: inicio,
  } });
  matriculaId = matricula.id;
  alocacaoAId = (await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId, turmaId: turmaAId, criadoEm: inicio } })).id;
});

it("não executa aprovação antiga com revisão pendente mesmo após restaurar a presença", async () => {
  const b = await aplicarEquivalencia(alocacaoAId, turmaBId, "q23-pendente-a-b");
  const c = await aplicarEquivalencia(b, turmaCId, "q23-pendente-b-c");
  await prisma.turma.update({ where: { id: turmaCId }, data: { status: "EM_ANDAMENTO", dataInicio: inicio } });
  await fecharC(c);
  const solicitacaoId = await aprovarProgressao(c);
  const aula = await prisma.encontroAgenda.findFirstOrThrow({ where: { turmaId: turmaCId, finalidade: "AULA" } });
  await publicarCorrecaoAulaTeste(aula.id, "FALTA", "q23-pendente-falta");
  await publicarCorrecaoAulaTeste(aula.id, "PRESENTE", "q23-pendente-presenca" );
  expect(await prisma.casoRevisaoProgressao.count({ where: { solicitacaoId } })).toBe(2);
  const movimentos = await prisma.movimentacaoAluno.count();
  entrar(secretariaId);
  const executada = await executarMudancaAcademica(solicitacaoId, { motivo: "Tentativa de usar aprovação anterior à revisão.", horarioCompativel: true });
  expect(executada).toMatchObject({ ok: false });
  expect(JSON.stringify(executada)).toContain("revisão de correção pendente");
  await expect(prisma.solicitacaoMudancaAcademica.update({ where: { id: solicitacaoId }, data: { status: "EXECUTADA" } }))
    .rejects.toThrow(/revisão de correção pendente/);
  expect((await prisma.solicitacaoMudancaAcademica.findUniqueOrThrow({ where: { id: solicitacaoId } })).status).toBe("APROVADA");
  expect((await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: c } })).ativa).toBe(true);
  expect(await prisma.movimentacaoAluno.count()).toBe(movimentos);
});

it("correção publicada abre revisão da progressão executada e exige novo fechamento para reconfirmar", async () => {
  const b = await aplicarEquivalencia(alocacaoAId, turmaBId, "q23-progressao-a-b");
  const c = await aplicarEquivalencia(b, turmaCId, "q23-progressao-b-c");
  await prisma.turma.update({ where: { id: turmaCId }, data: { status: "EM_ANDAMENTO", dataInicio: inicio } });
  const extraAluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno sem alteração", paisId: catalogo.pais.id } });
  const extraMatricula = await prisma.matricula.create({ data: { alunoId: extraAluno.id, produtoId: catalogo.produto.id,
    paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA", ativadaEm: inicio } });
  await prisma.alocacaoTurma.create({ data: { alunoId: extraAluno.id, matriculaId: extraMatricula.id, turmaId: turmaCId, criadoEm: inicio } });
  await fecharC(c, { alunoId: extraAluno.id, matriculaId: extraMatricula.id });
  const solicitacaoId = await aprovarProgressao(c);
  entrar(secretariaId);
  expect(await executarMudancaAcademica(solicitacaoId, { motivo: "Secretaria executa a progressão da fixture Q23.", horarioCompativel: true })).toMatchObject({ ok: true });
  const movimentos = await prisma.movimentacaoAluno.findMany({ orderBy: { id: "asc" } });
  const aula = await prisma.encontroAgenda.findFirstOrThrow({ where: { turmaId: turmaCId, finalidade: "AULA" }, include: { diario: { include: { registros: true } } } });
  const original = aula.diario!;
  const texto = await publicarCorrecaoAulaTeste(aula.id, "PRESENTE", "q23-progressao-texto");
  expect(await prisma.casoRevisaoProgressao.count({ where: { aprovacaoCorrecaoAulaId: texto.id } })).toBe(0);
  await expect(publicarCorrecaoAulaTeste(aula.id, "FALTA", "q23-progressao-omissao", "IMPACTOS")).rejects.toThrow();
  await expect(publicarCorrecaoAulaTeste(aula.id, "FALTA", "q23-progressao-flag-adulterada", "PARTICIPACAO")).rejects.toThrow();
  expect(await prisma.aprovacaoCorrecaoAula.count()).toBe(1);
  expect(await prisma.casoRevisaoProgressao.count()).toBe(0);
  const alterada = await publicarCorrecaoAulaTeste(aula.id, "FALTA", "q23-progressao-falta");
  const caso = await prisma.casoRevisaoProgressao.findFirstOrThrow({ where: { aprovacaoCorrecaoAulaId: alterada.id } });
  expect(caso).toMatchObject({ matriculaId, alocacaoFonteId: c, solicitacaoId });
  entrar(gestorId);
  expect(await consultarCasoRevisaoProgressao({ casoId: caso.id })).toMatchObject({ ok: true,
    dado: { origem: { tipo: "AULA", decisaoId: alterada.id }, situacao: "PENDENTE_REVISAO", statusNaCorrecao: "EXECUTADA" } });
  const fila = await listarRevisoesPorCorrecao({});
  assertOk(fila);
  expect(fila.dado.itens).toEqual([expect.objectContaining({ tipo: "AULA", matricula: expect.objectContaining({ id: matriculaId }),
    impactos: [expect.objectContaining({ casoId: caso.id, solicitacaoId })] })]);
  entrar(secretariaId);
  expect((await consultarCasoRevisaoProgressao({ casoId: caso.id })).ok).toBe(false);
  entrar(gestorId);
  expect((await revisarResolucaoRevisaoProgressao({ solicitacaoId, acao: "RECONFIRMAR_EXECUTADA" })).ok).toBe(false);
  await publicarCorrecaoAulaTeste(aula.id, "PRESENTE", "q23-progressao-presenca");
  expect(await prisma.casoRevisaoProgressao.count({ where: { solicitacaoId } })).toBe(2);
  entrar(gestorId);
  expect((await revisarResolucaoRevisaoProgressao({ solicitacaoId, acao: "RECONFIRMAR_EXECUTADA" })).ok).toBe(false);
  await confirmarNovoFechamentoC(c, "q23-fechamento-depois-das-correcoes");
  const revisao = await revisarResolucaoRevisaoProgressao({ solicitacaoId, acao: "RECONFIRMAR_EXECUTADA" });
  assertOk(revisao);
  const proposta = await proporResolucaoRevisaoProgressao({ solicitacaoId, acao: "RECONFIRMAR_EXECUTADA",
    estadoHash: revisao.dado.estadoHash, versaoEsperada: revisao.dado.versaoAtual,
    motivo: "Reconfirmar com nova conferência da frequência corrigida.", chaveIdempotencia: "q23-reconfirmacao-progressao" });
  assertOk(proposta);
  entrar(administradorId);
  assertOk(await decidirResolucaoRevisaoProgressao({ propostaId: proposta.dado.id, estadoHash: revisao.dado.estadoHash,
    aprovada: true, motivo: "Administração confere independentemente os dois casos e o fechamento." }));
  expect(await consultarCasoRevisaoProgressao({ casoId: caso.id })).toMatchObject({ ok: true, dado: { situacao: "RESOLVIDA" } });
  expect(await prisma.movimentacaoAluno.findMany({ orderBy: { id: "asc" } })).toEqual(movimentos);
  expect(await prisma.aulaDiario.findUniqueOrThrow({ where: { id: original.id }, include: { registros: true } })).toEqual(original);
});

it("segue A→B→C por aplicações reais e retorna a progressão APROVADA, sem proposta não aplicada ou outra matrícula", async () => {
  // Proposta rejeitada não vira aplicação e tampouco interfere no fechamento.
  const decisaoSemAplicacao = await prepararEquivalenciaSemAplicar(alocacaoAId);
  const alocacaoBId = await aplicarEquivalencia(alocacaoAId, turmaBId, "impactos-aplicacao-a-b");
  const alocacaoCId = await aplicarEquivalencia(alocacaoBId, turmaCId, "impactos-aplicacao-b-c");
  await prisma.turma.update({ where: { id: turmaCId }, data: { status: "EM_ANDAMENTO", dataInicio: inicio } });
  await fecharC(alocacaoCId);
  const solicitacaoId = await aprovarProgressao(alocacaoCId);
  const pendenteOutraMatricula = await criarPendenteOutraMatricula(catalogo);

  const impactos = await prisma.$transaction(tx => carregarImpactosProgressaoPorAproveitamentoTx(tx, {
    matriculaId, alocacaoOrigemId: alocacaoAId,
  }));
  expect(impactos).toEqual([{
    id: solicitacaoId, status: "APROVADA", turmaDestinoId: turmaProgressaoId,
    decididoEm: expect.any(String), executadoEm: null,
  }]);
  expect(await prisma.aplicacaoEquivalenciaAvaliacao.count({ where: { decisaoId: decisaoSemAplicacao } })).toBe(0);
  expect((await prisma.solicitacaoMudancaAcademica.findUniqueOrThrow({ where: { id: pendenteOutraMatricula.id } })).status).toBe("PENDENTE");
  await expect(prisma.$transaction(tx => carregarImpactosProgressaoPorAproveitamentoTx(tx, {
    matriculaId: pendenteOutraMatricula.matriculaId!, alocacaoOrigemId: alocacaoAId,
  }))).rejects.toThrow("Confira a matrícula da fonte de correção.");
});

it("preserva o formato e localiza a mesma progressão depois de EXECUTADA", async () => {
  const alocacaoBId = await aplicarEquivalencia(alocacaoAId, turmaBId, "impactos-executada-a-b");
  const alocacaoCId = await aplicarEquivalencia(alocacaoBId, turmaCId, "impactos-executada-b-c");
  await prisma.turma.update({ where: { id: turmaCId }, data: { status: "EM_ANDAMENTO", dataInicio: inicio } });
  await fecharC(alocacaoCId);
  const solicitacaoId = await aprovarProgressao(alocacaoCId);
  entrar(secretariaId);
  expect(await executarMudancaAcademica(solicitacaoId, {
    motivo: "Secretaria efetiva a progressão usada no teste de impactos.", horarioCompativel: true,
  })).toMatchObject({ ok: true });

  const impactos = await prisma.$transaction(tx => carregarImpactosProgressaoPorAproveitamentoTx(tx, {
    matriculaId, alocacaoOrigemId: alocacaoAId,
  }));
  expect(impactos).toEqual([{
    id: solicitacaoId, status: "EXECUTADA", turmaDestinoId: turmaProgressaoId,
    decididoEm: expect.any(String), executadoEm: expect.any(String),
  }]);
});

it("persiste a revisão da progressão em C quando uma correção aprovada alcança A→B→C", async () => {
  const fonteA = await oficializarFonteAParaCorrecao();
  const alocacaoBId = await aplicarEquivalencia(alocacaoAId, turmaBId, "impactos-caso-a-b");
  const alocacaoCId = await aplicarEquivalencia(alocacaoBId, turmaCId, "impactos-caso-b-c");
  await prisma.turma.update({ where: { id: turmaCId }, data: { status: "EM_ANDAMENTO", dataInicio: inicio } });
  await fecharC(alocacaoCId);
  const solicitacaoId = await aprovarProgressao(alocacaoCId);
  entrar(secretariaId);
  expect(await executarMudancaAcademica(solicitacaoId, {
    motivo: "Secretaria executa a progressão antes da correção transitiva da fonte A.", horarioCompativel: true,
  })).toMatchObject({ ok: true });
  const solicitacaoExecutada = await prisma.solicitacaoMudancaAcademica.findUniqueOrThrow({ where: { id: solicitacaoId } });
  const alocacaoCExecutada = await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: alocacaoCId } });
  const movimentacoesAntesDaCorrecao = await prisma.movimentacaoAluno.findMany({ where: { alunoId }, orderBy: { id: "asc" } });
  expect(solicitacaoExecutada).toMatchObject({ status: "EXECUTADA", executorId: secretariaId });
  expect(alocacaoCExecutada).toMatchObject({ ativa: false });

  entrar(professorId);
  const proposta = await proporCorrecaoNota({
    lancamentoId: fonteA.id, origemHash: fonteA.conteudoHash,
    notas: [{ habilidade: "FALA", nota: "9", comentarioAluno: "Correção oficial posterior à transferência aplicada." }],
    motivo: "A fonte A foi corrigida depois de a progressão em C ser aprovada.",
    versaoEsperada: 0, chaveIdempotencia: "impactos-caso-correcao-a",
  });
  assertOk(proposta);
  entrar(gestorId);
  const revisao = await revisarCorrecaoNota(proposta.dado.id);
  assertOk(revisao);
  expect(revisao.dado.impactos).toEqual([{
    id: solicitacaoId, status: "EXECUTADA", turmaDestinoId: turmaProgressaoId,
    decididoEm: expect.any(String), executadoEm: expect.any(String),
  }]);
  const decisao = await decidirCorrecaoNota({
    propostaId: proposta.dado.id, propostaHash: revisao.dado.propostaHash, impactosHash: revisao.dado.impactosHash,
    aprovada: true, motivo: "Gestão aprova a correção que exige nova revisão da progressão em C.",
  });
  assertOk(decisao);

  const casos = await prisma.$queryRaw<Array<{
    id: string; matriculaId: string; solicitacaoId: string; alocacaoFonteId: string; decisaoCorrecaoNotaId: string | null;
    decisaoCorrecaoRecuperacaoId: string | null; snapshotImpacto: unknown;
  }>>`
    SELECT id, "matriculaId", "solicitacaoId", "alocacaoFonteId", "decisaoCorrecaoNotaId",
      "decisaoCorrecaoRecuperacaoId", "snapshotImpacto"
    FROM "CasoRevisaoProgressao"
    WHERE "solicitacaoId" = ${solicitacaoId}
  `;
  expect(casos).toEqual([expect.objectContaining({
    matriculaId, solicitacaoId, alocacaoFonteId: alocacaoAId,
    decisaoCorrecaoNotaId: decisao.dado.id, decisaoCorrecaoRecuperacaoId: null,
    snapshotImpacto: expect.objectContaining({ id: solicitacaoId, status: "EXECUTADA", turmaDestinoId: turmaProgressaoId }),
  })]);
  const caso = casos[0]!;

  entrar(gestorId);
  expect((await revisarResolucaoRevisaoProgressao({
    solicitacaoId, acao: "RECONFIRMAR_EXECUTADA",
  })).ok).toBe(false);
  const encaminhamento = await revisarResolucaoRevisaoProgressao({
    solicitacaoId, acao: "ENCAMINHAR_REGULARIZACAO",
  });
  assertOk(encaminhamento);
  const propostaAntiga = await proporResolucaoRevisaoProgressao({
    solicitacaoId, acao: "ENCAMINHAR_REGULARIZACAO", estadoHash: encaminhamento.dado.estadoHash,
    versaoEsperada: encaminhamento.dado.versaoAtual,
    motivo: "Proposta que ficará antiga quando uma segunda correção abrir novo caso de revisão.",
    chaveIdempotencia: "impactos-encaminhamento-antigo",
  });
  assertOk(propostaAntiga);
  expect(await listarPropostasResolucaoRevisaoProgressao({ solicitacaoId })).toMatchObject({ ok: true, dado: {
    itens: expect.arrayContaining([expect.objectContaining({ id: propostaAntiga.dado.id, podeDecidir: false })]),
  } });
  const adminLista = (await criarUsuario([Papel.ADMINISTRADOR])).id;
  entrar(adminLista);
  expect(await listarPropostasResolucaoRevisaoProgressao({ solicitacaoId })).toMatchObject({ ok: true, dado: {
    itens: expect.arrayContaining([expect.objectContaining({ id: propostaAntiga.dado.id, podeDecidir: true })]),
  } });

  entrar(professorId);
  const segundaProposta = await proporCorrecaoNota({
    lancamentoId: fonteA.id, origemHash: revisao.dado.propostaHash,
    notas: [{ habilidade: "FALA", nota: "8", comentarioAluno: "Segunda correção oficial depois da proposta de resolução." }],
    motivo: "A segunda correção da fonte A abre outro caso antes da decisão da resolução antiga.",
    versaoEsperada: 1, chaveIdempotencia: "impactos-segunda-correcao-a",
  });
  assertOk(segundaProposta);
  entrar(gestorId);
  const revisaoSegunda = await revisarCorrecaoNota(segundaProposta.dado.id);
  assertOk(revisaoSegunda);
  const segundaDecisao = await decidirCorrecaoNota({
    propostaId: segundaProposta.dado.id, propostaHash: revisaoSegunda.dado.propostaHash,
    impactosHash: revisaoSegunda.dado.impactosHash, aprovada: true,
    motivo: "Gestão aprova a segunda correção que torna a resolução anterior obsoleta.",
  });
  assertOk(segundaDecisao);
  const casosAbertos = await prisma.$queryRaw<Array<{ id: string; decisaoCorrecaoNotaId: string | null }>>`
    SELECT id, "decisaoCorrecaoNotaId" FROM "CasoRevisaoProgressao"
    WHERE "solicitacaoId" = ${solicitacaoId} ORDER BY id ASC
  `;
  expect(casosAbertos).toHaveLength(2);
  expect(casosAbertos.map(item => item.decisaoCorrecaoNotaId).sort()).toEqual([decisao.dado.id, segundaDecisao.dado.id].sort());

  const adminHistorico = (await criarUsuario([Papel.ADMINISTRADOR])).id;
  entrar(adminHistorico);
  expect((await decidirResolucaoRevisaoProgressao({
    propostaId: propostaAntiga.dado.id, estadoHash: encaminhamento.dado.estadoHash,
    aprovada: true, motivo: "Aprovação antiga precisa ser recusada pela mudança dos casos abertos.",
  })).ok).toBe(false);
  expect((await decidirResolucaoRevisaoProgressao({
    propostaId: propostaAntiga.dado.id, estadoHash: encaminhamento.dado.estadoHash,
    aprovada: false, motivo: "Rejeição histórica permitida para preservar a auditoria da proposta desatualizada.",
  })).ok).toBe(true);
  expect(await listarPropostasResolucaoRevisaoProgressao({ solicitacaoId })).toMatchObject({ ok: true, dado: {
    itens: expect.arrayContaining([expect.objectContaining({
      id: propostaAntiga.dado.id, podeDecidir: false, decisao: expect.objectContaining({ aprovada: false }),
    })]),
  } });
  entrar(secretariaId);
  expect((await listarPropostasResolucaoRevisaoProgressao({ solicitacaoId })).ok).toBe(false);

  entrar(gestorId);
  const encaminhamentoAtual = await revisarResolucaoRevisaoProgressao({
    solicitacaoId, acao: "ENCAMINHAR_REGULARIZACAO",
  });
  assertOk(encaminhamentoAtual);
  expect(encaminhamentoAtual.dado.casos).toHaveLength(2);
  const propostaEncaminhamento = await proporResolucaoRevisaoProgressao({
    solicitacaoId, acao: "ENCAMINHAR_REGULARIZACAO", estadoHash: encaminhamentoAtual.dado.estadoHash,
    versaoEsperada: encaminhamentoAtual.dado.versaoAtual,
    motivo: "Encaminhar os dois casos abertos para regularização sem encerrá-los.",
    chaveIdempotencia: "impactos-encaminhar-dois-casos",
  });
  assertOk(propostaEncaminhamento);
  const adminEncaminhamento = (await criarUsuario([Papel.ADMINISTRADOR])).id;
  entrar(adminEncaminhamento);
  const decisaoEncaminhamento = {
    propostaId: propostaEncaminhamento.dado.id, estadoHash: encaminhamentoAtual.dado.estadoHash,
    aprovada: true, motivo: "Administração aprova o encaminhamento idêntico que mantém os dois casos abertos.".padEnd(3000, "x"),
  };
  const [primeiraAprovacao, segundaAprovacao] = await Promise.all([
    prisma.$transaction(tx => decidirResolucaoRevisaoProgressaoTx(tx, adminEncaminhamento, decisaoEncaminhamento)),
    prisma.$transaction(tx => decidirResolucaoRevisaoProgressaoTx(tx, adminEncaminhamento, decisaoEncaminhamento)),
  ]);
  expect(primeiraAprovacao).toEqual(segundaAprovacao);
  expect(await prisma.decisaoResolucaoRevisaoProgressao.findMany({ where: { propostaId: propostaEncaminhamento.dado.id } })).toEqual([
    expect.objectContaining({ id: primeiraAprovacao.id, aprovada: true, decisorId: adminEncaminhamento }),
  ]);

  entrar(gestorId);
  const encaminhamentoConcorrente = await revisarResolucaoRevisaoProgressao({
    solicitacaoId, acao: "ENCAMINHAR_REGULARIZACAO",
  });
  assertOk(encaminhamentoConcorrente);
  const propostaConcorrente = await proporResolucaoRevisaoProgressao({
    solicitacaoId, acao: "ENCAMINHAR_REGULARIZACAO", estadoHash: encaminhamentoConcorrente.dado.estadoHash,
    versaoEsperada: encaminhamentoConcorrente.dado.versaoAtual,
    motivo: "Proposta concorrente para provar que decisões opostas não se duplicam.",
    chaveIdempotencia: "impactos-encaminhamento-oposto",
  });
  assertOk(propostaConcorrente);
  const adminConcorrenteA = (await criarUsuario([Papel.ADMINISTRADOR])).id;
  const adminConcorrenteB = (await criarUsuario([Papel.ADMINISTRADOR])).id;
  const decisaoAprovar = { propostaId: propostaConcorrente.dado.id, estadoHash: encaminhamentoConcorrente.dado.estadoHash, aprovada: true,
    motivo: "Primeira administração decide encaminhar os casos abertos." };
  const decisaoRejeitar = { ...decisaoAprovar, aprovada: false, motivo: "Segunda administração decide rejeitar a mesma proposta." };
  const [resultadoAprovar, resultadoRejeitar] = await Promise.allSettled([
    prisma.$transaction(tx => decidirResolucaoRevisaoProgressaoTx(tx, adminConcorrenteA, decisaoAprovar)),
    prisma.$transaction(tx => decidirResolucaoRevisaoProgressaoTx(tx, adminConcorrenteB, decisaoRejeitar)),
  ]);
  expect([resultadoAprovar, resultadoRejeitar].filter(resultado => resultado.status === "fulfilled")).toHaveLength(1);
  expect([resultadoAprovar, resultadoRejeitar].filter(resultado => resultado.status === "rejected")).toHaveLength(1);
  const decisaoConcorrente = await prisma.decisaoResolucaoRevisaoProgressao.findUniqueOrThrow({ where: { propostaId: propostaConcorrente.dado.id } });
  expect([adminConcorrenteA, adminConcorrenteB]).toContain(decisaoConcorrente.decisorId);
  expect(decisaoConcorrente).toMatchObject(decisaoConcorrente.decisorId === adminConcorrenteA
    ? { aprovada: true, motivo: decisaoAprovar.motivo }
    : { aprovada: false, motivo: decisaoRejeitar.motivo });
  entrar(gestorId);
  expect(await consultarCasoRevisaoProgressao({ casoId: caso.id })).toMatchObject({ ok: true, dado: {
    situacao: "PENDENTE_REVISAO", solicitacao: { id: solicitacaoId, status: "EXECUTADA" },
  } });

  await confirmarNovoFechamentoC(alocacaoCId, "impactos-novo-fechamento-c-apos-correcao");
  const reconfirmacao = await revisarResolucaoRevisaoProgressao({
    solicitacaoId, acao: "RECONFIRMAR_EXECUTADA",
  });
  assertOk(reconfirmacao);
  const propostaReconfirmacao = await proporResolucaoRevisaoProgressao({
    solicitacaoId, acao: "RECONFIRMAR_EXECUTADA", estadoHash: reconfirmacao.dado.estadoHash,
    versaoEsperada: reconfirmacao.dado.versaoAtual,
    motivo: "Reconfirmar a progressão executada após novo fechamento suficiente e atual.",
    chaveIdempotencia: "impactos-reconfirmar-executada",
  });
  assertOk(propostaReconfirmacao);
  const adminReconfirmacao = (await criarUsuario([Papel.ADMINISTRADOR])).id;
  entrar(adminReconfirmacao);
  assertOk(await decidirResolucaoRevisaoProgressao({
    propostaId: propostaReconfirmacao.dado.id, estadoHash: reconfirmacao.dado.estadoHash,
    aprovada: true, motivo: "Administração confirma a resolução terminal da progressão executada.",
  }));
  expect(await consultarCasoRevisaoProgressao({ casoId: caso.id })).toMatchObject({ ok: true, dado: {
    situacao: "RESOLVIDA", solicitacao: { id: solicitacaoId, status: "EXECUTADA" },
  } });
  expect(await prisma.solicitacaoMudancaAcademica.findUniqueOrThrow({ where: { id: solicitacaoId } })).toMatchObject({
    status: "EXECUTADA", executorId: secretariaId, executadoEm: solicitacaoExecutada.executadoEm,
  });
  expect(await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: alocacaoCId } })).toMatchObject({
    ativa: false, encerradaEm: alocacaoCExecutada.encerradaEm,
  });
  expect(await prisma.movimentacaoAluno.findMany({ where: { alunoId }, orderBy: { id: "asc" } })).toEqual(movimentacoesAntesDaCorrecao);
});

it("reconfirma progressão real após corrigir a fonte da reposição, exigindo novo fechamento", async () => {
  const aula = await prisma.encontroAgenda.create({ data: {
    turmaId: turmaAId, professorId, preparadorId: secretariaId,
    inicio: new Date("2026-01-02T10:00:00Z"), fim: new Date("2026-01-02T11:00:00Z"),
    fusoOrigem: "UTC", finalidade: "AULA", status: "PREVISTO", motivo: "Aula com falta regularizada por reposição.",
    chaveIdempotencia: "real-reposicao-origem", entradaHash: "fixture",
    diario: { create: { turmaId: turmaAId, professorId, ocorridaEm: new Date("2026-01-02T10:00:00Z"),
      conteudo: "Aula original preservada.", registros: { create: { alunoId, matriculaId, nomeAluno: "Aluno da cadeia", presente: false, participacao: "FALTA" } } } },
  } });
  await prisma.encontroAgenda.update({ where: { id: aula.id }, data: { status: "MINISTRADO" } });
  const reposicao = await prisma.reposicaoIndividual.create({ data: {
    aulaOriginalId: aula.id, matriculaId, modalidade: "GRAVACAO", solicitanteId: secretariaId,
    motivo: "Reposição da falta original.", evidencia: "Falta registrada.", chaveIdempotencia: "real-reposicao", entradaHash: "fixture",
  } });
  await prisma.decisaoReposicaoIndividual.create({ data: { reposicaoId: reposicao.id, decisorId: gestorId, aprovada: true, motivo: "Gestão autoriza a reposição." } });
  await prisma.designacaoAvaliadorReposicaoIndividual.create({ data: { reposicaoId: reposicao.id, professorId, designadorId: gestorId, inicio, motivo: "Avaliação docente designada." } });
  const conta = await prisma.contaPortalAluno.create({ data: { alunoId } });
  const entrega = await prisma.entregaReposicaoGravacao.create({ data: { reposicaoId: reposicao.id, alunoId, contaPortalAlunoId: conta.id,
    versao: 1, resumo: "Resumo apresentado pelo aluno.", atividade: "Atividade completa.", evidencia: "Entrega original.", entregueEm: new Date("2026-01-03T10:00:00Z") } });
  const conclusao = await prisma.conclusaoReposicaoIndividual.create({ data: { reposicaoId: reposicao.id, versao: 1, concluida: true,
    entregaId: entrega.id, validadaEm: new Date("2026-01-03T11:00:00Z"), validadaPorId: professorId, concluidaPorId: professorId, evidencia: "Professor confirmou a entrega." } });
  const b = await aplicarEquivalencia(alocacaoAId, turmaBId, "real-repo-a-b");
  const c = await aplicarEquivalencia(b, turmaCId, "real-repo-b-c");
  await prisma.turma.update({ where: { id: turmaCId }, data: { status: "EM_ANDAMENTO", dataInicio: inicio } });
  await fecharC(c);
  const solicitacaoId = await aprovarProgressao(c);
  entrar(secretariaId);
  expect(await executarMudancaAcademica(solicitacaoId, { motivo: "Execução da progressão antes da correção da reposição.", horarioCompativel: true })).toMatchObject({ ok: true });
  const movimentos = await prisma.movimentacaoAluno.findMany({ orderBy: { id: "asc" } });
  const fechamentoAnterior = await prisma.fechamentoAcademico.findFirstOrThrow({ where: { matriculaId }, orderBy: { versao: "desc" } });
  entrar(professorId);
  const proposta = await proporCorrecaoConclusaoReposicao({ reposicaoId: reposicao.id, conclusaoId: conclusao.id, versaoAnterior: 0,
    concluida: true, entregaId: entrega.id, validadaEm: "2026-01-03T11:01:00.000Z", motivo: "Corrigir o instante da validação comprovada.", evidencia: "Registro docente comprova o minuto correto." });
  assertOk(proposta);
  entrar(gestorId);
  const conferencia = await consultarCorrecoesConclusaoReposicao({ reposicaoId: reposicao.id });
  assertOk(conferencia);
  assertOk(await decidirCorrecaoConclusaoReposicao({ correcaoId: proposta.dado.id, propostaHash: proposta.dado.propostaHash,
    impactosHash: conferencia.dado.correcoes[0]!.impactosHash!, aprovar: true, motivo: "Aprovação independente da correção e seus impactos." }));
  const caso = await prisma.casoRevisaoProgressao.findFirstOrThrow({ where: { solicitacaoId } });
  expect(caso.decisaoCorrecaoConclusaoReposicaoId).not.toBeNull();
  expect((await revisarResolucaoRevisaoProgressao({ solicitacaoId, acao: "RECONFIRMAR_EXECUTADA" })).ok).toBe(false);
  await confirmarNovoFechamentoC(c, "real-repo-novo-fechamento");
  const novo = await prisma.fechamentoAcademico.findFirstOrThrow({ where: { matriculaId }, orderBy: { versao: "desc" } });
  expect(novo.estadoHash).not.toBe(fechamentoAnterior.estadoHash);
  const revisao = await revisarResolucaoRevisaoProgressao({ solicitacaoId, acao: "RECONFIRMAR_EXECUTADA" });
  assertOk(revisao);
  const resolucao = await proporResolucaoRevisaoProgressao({ solicitacaoId, acao: "RECONFIRMAR_EXECUTADA", estadoHash: revisao.dado.estadoHash,
    versaoEsperada: revisao.dado.versaoAtual, motivo: "Reconfirmar a progressão com a fonte corrigida.", chaveIdempotencia: "real-repo-reconfirmar" });
  assertOk(resolucao);
  const decisao = { propostaId: resolucao.dado.id, estadoHash: revisao.dado.estadoHash, aprovada: true, motivo: "Conferência independente do novo fechamento suficiente." };
  expect((await decidirResolucaoRevisaoProgressao(decisao)).ok).toBe(false);
  entrar(administradorId);
  assertOk(await decidirResolucaoRevisaoProgressao(decisao));
  expect(await consultarCasoRevisaoProgressao({ casoId: caso.id })).toMatchObject({ ok: true, dado: { situacao: "RESOLVIDA" } });
  expect(await prisma.movimentacaoAluno.findMany({ orderBy: { id: "asc" } })).toEqual(movimentos);
  expect(await prisma.conclusaoReposicaoIndividual.findUniqueOrThrow({ where: { id: conclusao.id } })).toEqual(conclusao);
});
