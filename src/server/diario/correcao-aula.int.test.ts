import { beforeEach, expect, it, vi } from "vitest";
import { Papel, Prisma } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
// O carregamento dinâmico do next-auth não é estável entre duas actions
// concorrentes no runner. A identidade continua vindo do mock de sessão,
// enquanto atividade e papéis são relidos do PostgreSQL real.
vi.mock("@/server/_shared/sessao", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/_shared/sessao")>();
  const sessao = async () => {
    const id = (await authMock())?.user?.id;
    const usuario = id && await prisma.usuario.findUnique({ where: { id }, select: { id: true, nome: true, ativo: true, papeis: true } });
    if (!usuario?.ativo) throw new original.ErroAutenticacao();
    return usuario;
  };
  return { ...original, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const usuario = await sessao(); original.exigirPapel(usuario, ...papeis); return usuario;
  } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { aprovarCorrecaoAula, consultarHistoricoCorrecaoAula, proporCorrecaoAula, rejeitarCorrecaoAula, revisarCorrecaoAula, revisarImpactosCorrecaoAula } from "./correcao-aula";
import { carregarFrequenciaNivelTx, simularFrequenciaCorrecaoAulaTx } from "@/server/avaliacoes/frequencia-nivel-tx";
import { prepararRegraAvaliacaoTx, decidirRegraAvaliacaoTx } from "@/server/avaliacoes/regras-tx";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import { HABILIDADES } from "@/server/avaliacoes/calculo";
import { salvarLancamentoAvaliacao, oficializarLancamentoAvaliacao } from "@/server/avaliacoes/lancamentos";
import { listarAulasDiario } from "./consultas";
import { carregarImpactosCorrecaoAulaTx } from "./correcao-aula-impactos-tx";
import { carregarCorrecoesAulaEfetivasTx } from "./correcao-aula-efetiva-tx";
import { solicitarReposicaoIndividual, decidirReposicaoIndividual, proporCorrecaoConclusaoReposicao, decidirCorrecaoConclusaoReposicao } from "./reposicao-individual";
import { consultarReposicoesEquipe } from "./reposicao-consulta";
import { criarAgendaParticularIsentaFixture } from "@/test/reposicao-agenda";

const inicio = new Date("2026-01-01T00:00:00.000Z");
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

let professorId: string;
let secretariaId: string;
let financeiroId: string;
let turmaId: string;
let encontroId: string;
let diarioId: string;
let registroFaltaId: string;
let registroPresenteId: string;
let vinculoId: string;
let regraId: string;

function assertOk<T extends { ok: boolean; dado?: unknown }>(resultado: T): asserts resultado is T & { ok: true; dado: NonNullable<T["dado"]> } {
  expect(resultado, JSON.stringify(resultado)).toMatchObject({ ok: true });
  if (!resultado.ok || resultado.dado === undefined || resultado.dado === null) throw new Error(JSON.stringify(resultado));
}

async function conferenciaAtual() {
  const resultado = await revisarCorrecaoAula({ encontroId });
  assertOk(resultado);
  return resultado.dado;
}

function entrada(dado: Awaited<ReturnType<typeof conferenciaAtual>>, chaveIdempotencia = "correcao-aula-445") {
  const falta = dado.snapshot.registros.find((registro) => registro.registroId === registroFaltaId);
  const presente = dado.snapshot.registros.find((registro) => registro.registroId === registroPresenteId);
  if (!falta || !presente) throw new Error("Registros da fixture não foram carregados.");
  return {
    encontroId, estadoHash: dado.estadoHash, versaoEsperada: dado.versaoAtual,
    alteracao: {
      conteudo: "Conteúdo corrigido após conferência pedagógica.",
      registros: [
        { registroId: falta.registroId, participacao: "PRESENTE" as const, observacao: "Presença corrigida após conferência." },
        { registroId: presente.registroId, participacao: "PRESENTE" as const, observacao: "Presença originalmente confirmada." },
      ],
    },
    motivo: "A chamada original foi conferida com a documentação da aula.",
    evidencia: "Registro pedagógico da conferência anexado ao processo.",
    chaveIdempotencia,
  };
}

// Exercita a persistência interna inclusive com dependências cuja resolução
// ainda não está disponível na publicação pública.
async function persistirPublicacaoTeste(propostaId: string, decisorId: string) {
  return prisma.$transaction(async tx => {
    const impactos = await carregarImpactosCorrecaoAulaTx(tx, decisorId, propostaId);
    const { impactosHash, ...snapshotImpactos } = impactos;
    return tx.aprovacaoCorrecaoAula.create({ data: { propostaId, decisorId,
      motivo: "Conferência independente da correção na integração.",
      propostaHash: impactos.propostaHash, impactosHash,
      impactos: snapshotImpactos as Prisma.InputJsonValue } });
  });
}

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  professorId = (await criarUsuario([Papel.PROFESSOR])).id;
  secretariaId = (await criarUsuario([Papel.SECRETARIA_ACADEMICA])).id;
  financeiroId = (await criarUsuario([Papel.FINANCEIRO])).id;
  const alunoFalta = await prisma.aluno.create({ data: { primeiroNome: "Aluna falta", paisId: catalogo.pais.id } });
  const alunoPresente = await prisma.aluno.create({ data: { primeiroNome: "Aluno presente", paisId: catalogo.pais.id } });
  const [matriculaFalta, matriculaPresente] = await Promise.all([alunoFalta, alunoPresente].map((aluno) => prisma.matricula.create({ data: {
    alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA", ativadaEm: inicio,
  } })));
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1-CORR-AULA", ordem: 1 } });
  const gestorRegra = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);
  const adminRegra = await criarUsuario([Papel.ADMINISTRADOR]);
  const propostaRegra = await prisma.$transaction(tx => prepararRegraAvaliacaoTx(tx, gestorRegra.id, { nivelId: nivel.id, versaoEsperada: 0,
    conteudo: { ...regraAvaliacaoTeste(), frequenciaMinimaPercentual: "83" }, motivo: "Regra institucional da fixture de correção.", chaveIdempotencia: "q23-regra-fixture" }));
  const regra = await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: propostaRegra.id } });
  await prisma.$transaction(tx => decidirRegraAvaliacaoTx(tx, adminRegra.id, { regraId: regra.id, conteudoHash: regra.conteudoHash,
    aprovada: true, motivo: "Publicação independente da regra de avaliação." }));
  regraId = regra.id;
  const turma = await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId,
    dataInicio: new Date("2099-01-01T00:00:00Z"), status: "ABERTA" } });
  await prisma.turma.update({ where: { id: turma.id }, data: { dataInicio: inicio, status: "EM_ANDAMENTO" } });
  turmaId = turma.id;
  vinculoId = (await prisma.vinculoDocente.create({ data: { turmaId, professorId, inicio } })).id;
  await prisma.alocacaoTurma.createMany({ data: [
    { alunoId: alunoFalta.id, matriculaId: matriculaFalta.id, turmaId, criadoEm: inicio },
    { alunoId: alunoPresente.id, matriculaId: matriculaPresente.id, turmaId, criadoEm: inicio },
  ] });
  const encontro = await prisma.encontroAgenda.create({ data: {
    turmaId, professorId, preparadorId: secretariaId, finalidade: "AULA", status: "PREVISTO",
    inicio: new Date("2026-01-10T10:00:00.000Z"), fim: new Date("2026-01-10T11:00:00.000Z"), fusoOrigem: "UTC",
    motivo: "Aula ministrada para correção da chamada.", chaveIdempotencia: "aula-445", entradaHash: "fixture-445",
    diario: { create: { turmaId, professorId, ocorridaEm: new Date("2026-01-10T10:00:00.000Z"), conteudo: "Conteúdo original da aula.", registros: { create: [
      { alunoId: alunoFalta.id, matriculaId: matriculaFalta.id, nomeAluno: "Aluna falta", presente: false, participacao: "FALTA", observacao: "Ausência registrada." },
      { alunoId: alunoPresente.id, matriculaId: matriculaPresente.id, nomeAluno: "Aluno presente", presente: true, participacao: "PRESENTE", observacao: "Presença registrada." },
    ] } } },
  } });
  encontroId = encontro.id;
  await prisma.encontroAgenda.update({ where: { id: encontroId }, data: { status: "MINISTRADO" } });
  const diario = await prisma.aulaDiario.findUniqueOrThrow({ where: { encontroId }, include: { registros: { orderBy: { alunoId: "asc" } } } });
  diarioId = diario.id;
  const falta = diario.registros.find((registro) => registro.participacao === "FALTA");
  const presente = diario.registros.find((registro) => registro.participacao === "PRESENTE");
  if (!falta || !presente) throw new Error("Fixture sem registros de falta e presença.");
  registroFaltaId = falta.id;
  registroPresenteId = presente.id;
  entrar(professorId);
});

async function entradaPublicacao(propostaId: string) {
  const revisao = await revisarImpactosCorrecaoAula({ propostaId });
  assertOk(revisao);
  return { propostaId, propostaHash: revisao.dado.propostaHash, impactosHash: revisao.dado.impactosHash,
    motivo: "Gestão confere e aprova a correção apresentada." };
}

it("publicação pública concorrente preserva original, projeta correção e registra uma decisão e evento", async () => {
  const original = await conferenciaAtual();
  const proposta = await proporCorrecaoAula(entrada(original, "publica-458"));
  assertOk(proposta);
  const gestor = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);
  entrar(gestor.id);
  const dados = await entradaPublicacao(proposta.dado.id);
  const [primeira, segunda] = await Promise.all([aprovarCorrecaoAula(dados), aprovarCorrecaoAula(dados)]);
  assertOk(primeira);
  expect(segunda).toEqual(primeira);
  expect(await prisma.aprovacaoCorrecaoAula.count()).toBe(1);
  expect(await prisma.evento.count({ where: { agregadoId: encontroId, tipo: "CorrecaoAulaAprovada" } })).toBe(1);
  expect((await conferenciaAtual()).snapshot.registros.find(r => r.registroId === registroFaltaId)?.participacao).toBe("PRESENTE");
  expect(await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registroFaltaId } })).toMatchObject({ presente: false, participacao: "FALTA" });
  expect((await prisma.aulaDiario.findUniqueOrThrow({ where: { id: diarioId } })).conteudo).toBe(original.snapshot.conteudo);
  expect(await aprovarCorrecaoAula({ ...dados, motivo: "Outra justificativa não substitui a decisão." })).toMatchObject({ ok: false });
  expect(await aprovarCorrecaoAula({ ...dados, impactosHash: "0".repeat(64) })).toMatchObject({ ok: false });
  entrar((await criarUsuario([Papel.ADMINISTRADOR])).id);
  expect(await aprovarCorrecaoAula(dados)).toMatchObject({ ok: false });
  await prisma.usuario.update({ where: { id: gestor.id }, data: { ativo: false } });
  entrar(gestor.id);
  expect(await aprovarCorrecaoAula(dados)).toMatchObject({ ok: false });
});

it("publicação exige gestão independente, hashes atuais e proposta não superada", async () => {
  await prisma.usuario.update({ where: { id: professorId }, data: { papeis: [Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO] } });
  const proposta = await proporCorrecaoAula(entrada(await conferenciaAtual(), "publica-permissoes-458"));
  assertOk(proposta);
  const dados = await entradaPublicacao(proposta.dado.id);
  expect(await aprovarCorrecaoAula(dados)).toMatchObject({ ok: false });
  for (const id of [secretariaId, financeiroId]) {
    entrar(id);
    expect(await aprovarCorrecaoAula(dados)).toMatchObject({ ok: false });
  }
  entrar((await criarUsuario([Papel.GERENTE_PEDAGOGICO])).id);
  expect(await aprovarCorrecaoAula({ ...dados, propostaHash: "0".repeat(64) })).toMatchObject({ ok: false });
  expect(await aprovarCorrecaoAula({ ...dados, impactosHash: "0".repeat(64) })).toMatchObject({ ok: false });
  entrar(professorId);
  assertOk(await proporCorrecaoAula(entrada(await conferenciaAtual(), "publica-superada-458")));
  entrar((await criarUsuario([Papel.GERENTE_PEDAGOGICO])).id);
  expect(await aprovarCorrecaoAula(dados)).toMatchObject({ ok: false });
  expect(await prisma.aprovacaoCorrecaoAula.count()).toBe(0);
});

it("dependência de reposição nova invalida a conferência e impede publicar participação sem resolução", async () => {
  const proposta = await proporCorrecaoAula(entrada(await conferenciaAtual(), "publica-reposicao-458"));
  assertOk(proposta);
  const gestor = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);
  entrar(gestor.id);
  const anterior = await entradaPublicacao(proposta.dado.id);
  const registro = await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registroFaltaId } });
  entrar(secretariaId);
  assertOk(await solicitarReposicaoIndividual({ aulaOriginalId: encontroId, matriculaId: registro.matriculaId!, modalidade: "GRAVACAO",
    motivo: "Aluno solicita reposição antes da decisão da correção.", evidencia: "Pedido do aluno e chamada original.", chaveIdempotencia: "dependencia-publica-458" }));
  entrar(gestor.id);
  expect(await aprovarCorrecaoAula(anterior)).toMatchObject({ ok: false });
  const atual = await entradaPublicacao(proposta.dado.id);
  expect(atual.impactosHash).not.toBe(anterior.impactosHash);
  expect(await aprovarCorrecaoAula(atual)).toMatchObject({ ok: false, erro: expect.stringMatching(/reposi/i) });
  expect(await prisma.aprovacaoCorrecaoAula.count()).toBe(0);
  expect(await prisma.evento.count({ where: { tipo: "CorrecaoAulaAprovada" } })).toBe(0);
  expect((await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registroFaltaId } })).participacao).toBe("FALTA");
});

it.each([false, true])("decisão da reposição entra na conferência e só rejeição terminal libera publicação: aprovada=%s", async (aprovar) => {
  const registro = await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registroFaltaId } });
  entrar(secretariaId);
  const pedido = await solicitarReposicaoIndividual({ aulaOriginalId: encontroId, matriculaId: registro.matriculaId!, modalidade: "GRAVACAO",
    motivo: "Pedido de reposição registrado para análise pedagógica.", evidencia: "Solicitação e chamada serão conferidas.", chaveIdempotencia: "resolucao-q23-459" });
  assertOk(pedido);
  entrar(professorId);
  const proposta = await proporCorrecaoAula(entrada(await conferenciaAtual(), "resolucao-publicacao-459"));
  assertOk(proposta);
  entrar((await criarUsuario([Papel.GERENTE_PEDAGOGICO])).id);
  const antes = await entradaPublicacao(proposta.dado.id);
  assertOk(await decidirReposicaoIndividual({ reposicaoId: pedido.dado.id, aprovar,
    motivo: aprovar ? "Pedido autorizado após conferência da ausência." : "Pedido indevido conforme evidência da correção proposta." }));
  const decisao = await prisma.decisaoReposicaoIndividual.findUniqueOrThrow({ where: { reposicaoId: pedido.dado.id } });
  expect(await aprovarCorrecaoAula(antes)).toMatchObject({ ok: false });
  const depois = await entradaPublicacao(proposta.dado.id);
  expect(depois.impactosHash).not.toBe(antes.impactosHash);
  const resultado = await aprovarCorrecaoAula(depois);
  if (aprovar) {
    expect(resultado).toMatchObject({ ok: false, erro: expect.stringMatching(/reposi/i) });
    expect(await prisma.aprovacaoCorrecaoAula.count()).toBe(0);
  } else {
    assertOk(resultado);
    const persistida = await prisma.aprovacaoCorrecaoAula.findUniqueOrThrow({ where: { id: resultado.dado.id } });
    expect(persistida.impactos).toMatchObject({ reposicoes: [{ id: pedido.dado.id, decisao: { id: decisao.id, aprovada: false } }] });
    expect((await conferenciaAtual()).snapshot.registros.find(r => r.registroId === registroFaltaId)?.participacao).toBe("PRESENTE");
    expect(await decidirReposicaoIndividual({ reposicaoId: pedido.dado.id, aprovar: true, motivo: "Tentativa de reabrir pedido rejeitado." })).toMatchObject({ ok: false });
  }
  expect(await prisma.decisaoReposicaoIndividual.findUniqueOrThrow({ where: { id: decisao.id } })).toEqual(decisao);
  expect(await prisma.reposicaoIndividual.count()).toBe(1);
  expect(await prisma.conclusaoReposicaoIndividual.count()).toBe(0);
  expect((await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registroFaltaId } })).participacao).toBe("FALTA");
});

it("reposição existente não impede correção apenas textual sem mudança de participação", async () => {
  const registro = await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registroFaltaId } });
  entrar(secretariaId);
  assertOk(await solicitarReposicaoIndividual({ aulaOriginalId: encontroId, matriculaId: registro.matriculaId!, modalidade: "GRAVACAO",
    motivo: "Aluno solicita regularização da falta original.", evidencia: "Pedido registrado pela Secretaria.", chaveIdempotencia: "textual-reposicao-458" }));
  entrar(professorId);
  const fonte = await conferenciaAtual();
  const dados = entrada(fonte, "publica-textual-458");
  const proposta = await proporCorrecaoAula({ ...dados, alteracao: { ...dados.alteracao,
    registros: fonte.snapshot.registros.map(r => ({ registroId: r.registroId, participacao: r.participacao, observacao: r.observacao ?? "" })) } });
  assertOk(proposta);
  entrar((await criarUsuario([Papel.GERENTE_PEDAGOGICO])).id);
  assertOk(await aprovarCorrecaoAula(await entradaPublicacao(proposta.dado.id)));
  expect(await prisma.reposicaoIndividual.count()).toBe(1);
  expect(await prisma.casoRevisaoProgressao.count()).toBe(0);
  expect((await conferenciaAtual()).snapshot.conteudo).toBe(dados.alteracao.conteudo);
});

it.each(["GRAVACAO", "PARTICULAR"] as const)("classificação da ausência mantém reposição autorizada %s somente com confirmação", async modalidade => {
  const registro = await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registroFaltaId } });
  const gestor = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);
  const pedido = await prisma.reposicaoIndividual.create({ data: { aulaOriginalId: encontroId, matriculaId: registro.matriculaId!, modalidade,
    solicitanteId: secretariaId, motivo: "Reposição autorizada para uma ausência registrada.", evidencia: "Solicitação do aluno.", chaveIdempotencia: "continuidade-464", entradaHash: "fixture" } });
  const decisao = await prisma.decisaoReposicaoIndividual.create({ data: { reposicaoId: pedido.id, decisorId: gestor.id, aprovada: true,
    motivo: "Gestão autorizou o atendimento da ausência." } });
  for (const participacao of ["IMPEDIDO_POR_RESTRICAO", "FALTA"] as const) {
    entrar(professorId);
    const fonte = await conferenciaAtual();
    const proposta = await proporCorrecaoAula({ ...entrada(fonte, `continuidade-464-${participacao}`), alteracao: {
      conteudo: fonte.snapshot.conteudo, registros: fonte.snapshot.registros.map(r => ({ registroId: r.registroId,
        participacao: r.registroId === registroFaltaId ? participacao : r.participacao, observacao: r.observacao })) } });
    assertOk(proposta);
    entrar(gestor.id);
    const revisao = await revisarImpactosCorrecaoAula({ propostaId: proposta.dado.id });
    assertOk(revisao);
    expect(revisao.dado.reposicoesContinuaveisIds).toEqual([pedido.id]);
    expect(revisao.dado.reposicoesPreservaveisIds).toEqual([]);
    const d = await entradaPublicacao(proposta.dado.id);
    expect(await aprovarCorrecaoAula(d)).toMatchObject({ ok: false, erro: expect.stringMatching(/preserva/i) });
    const publicada = await aprovarCorrecaoAula({ ...d, confirmarPreservacaoReposicoes: true });
    assertOk(publicada);
    expect(await aprovarCorrecaoAula({ ...d, confirmarPreservacaoReposicoes: true })).toEqual(publicada);
    expect(await aprovarCorrecaoAula(d)).toMatchObject({ ok: false });
    expect((await prisma.aprovacaoCorrecaoAula.findUniqueOrThrow({ where: { id: publicada.dado.id } })).impactos)
      .toMatchObject({ continuidadeReposicoesAutorizadas: [pedido.id] });
    expect((await conferenciaAtual()).snapshot.registros.find(r => r.registroId === registroFaltaId)?.participacao).toBe(participacao);
  }
  expect(await prisma.reposicaoIndividual.findUniqueOrThrow({ where: { id: pedido.id } })).toEqual(pedido);
  expect(await prisma.decisaoReposicaoIndividual.findUniqueOrThrow({ where: { id: decisao.id } })).toEqual(decisao);
  expect(await prisma.conclusaoReposicaoIndividual.count()).toBe(0);
  expect(await prisma.cobranca.count()).toBe(0);
  expect((await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registroFaltaId } })).participacao).toBe("FALTA");
});

it("publicação interna projeta frequência e encadeia novas correções sem editar o original", async () => {
  const original = await conferenciaAtual();
  const registro = await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registroFaltaId } });
  const turma = await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } });
  const contexto = { matriculaId: registro.matriculaId!, nivelId: turma.nivelId, minimoPercentual: "83" };
  const primeira = await proporCorrecaoAula(entrada(original, "publicacao-cadeia-1"));
  assertOk(primeira);
  const gestor = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);
  expect((await prisma.$transaction(tx => carregarFrequenciaNivelTx(tx, contexto))).presencas).toBe(0);
  const decisao = await persistirPublicacaoTeste(primeira.dado.id, gestor.id);
  const vigente = await conferenciaAtual();
  expect(vigente.snapshot.registros.find(r => r.registroId === registroFaltaId)?.participacao).toBe("PRESENTE");
  expect(vigente.estadoHash).not.toBe(original.estadoHash);
  expect(vigente.propostas[0]).toMatchObject({ podeRejeitar: false, aprovacao: { id: decisao.id } });
  expect(await prisma.$transaction(tx => carregarFrequenciaNivelTx(tx, contexto))).toMatchObject({ presencas: 1, faltas: 0 });
  const segundaEntrada = entrada(vigente, "publicacao-cadeia-2");
  segundaEntrada.alteracao.conteudo = "Segunda correção preserva a presença já publicada.";
  const segunda = await proporCorrecaoAula(segundaEntrada);
  assertOk(segunda);
  expect((await prisma.propostaCorrecaoAula.findUniqueOrThrow({ where: { id: segunda.dado.id } })).snapshotAnterior).toEqual(vigente.snapshot);
  // Uma proposta mais recente ainda não aprovada não altera a fonte efetiva.
  expect((await conferenciaAtual()).snapshot).toEqual(vigente.snapshot);
  const decisao2 = await persistirPublicacaoTeste(segunda.dado.id, gestor.id);
  const efetivas = await prisma.$transaction(tx => carregarCorrecoesAulaEfetivasTx(tx, [encontroId]));
  expect(efetivas.get(encontroId)).toMatchObject({ aprovacaoId: decisao2.id, versao: 2,
    snapshot: { conteudo: segundaEntrada.alteracao.conteudo } });
  const docente = await prisma.usuario.findUniqueOrThrow({ where: { id: professorId }, select: { id: true, nome: true, ativo: true, papeis: true } });
  expect((await listarAulasDiario(docente)).aulas.find(a => a.id === diarioId)).toMatchObject({
    conteudo: segundaEntrada.alteracao.conteudo, correcaoPublicada: { versao: 2 }, podeEditar: false,
    registros: expect.arrayContaining([expect.objectContaining({ alunoId: registro.alunoId, participacao: "PRESENTE", presente: true })]),
  });
  expect((await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registroFaltaId } }))).toEqual(registro);
  expect((await prisma.aulaDiario.findUniqueOrThrow({ where: { id: diarioId } })).conteudo).toBe(original.snapshot.conteudo);
});

it("aprovação é independente, imutável e incompatível com rejeição", async () => {
  const primeira = await proporCorrecaoAula(entrada(await conferenciaAtual(), "publicacao-guards-1"));
  assertOk(primeira);
  const gestor = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);
  await prisma.usuario.update({ where: { id: professorId }, data: { papeis: [Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO] } });
  await expect(persistirPublicacaoTeste(primeira.dado.id, professorId)).rejects.toThrow();
  expect(await prisma.aprovacaoCorrecaoAula.count()).toBe(0);
  const decisao = await persistirPublicacaoTeste(primeira.dado.id, gestor.id);
  await expect(prisma.aprovacaoCorrecaoAula.update({ where: { id: decisao.id }, data: { motivo: "Tentativa de alterar decisão." } })).rejects.toThrow();
  await expect(prisma.aprovacaoCorrecaoAula.delete({ where: { id: decisao.id } })).rejects.toThrow();
  entrar(gestor.id);
  expect(await rejeitarCorrecaoAula({ propostaId: primeira.dado.id, propostaHash: decisao.propostaHash, motivo: "Tentativa de rejeitar publicação." })).toMatchObject({ ok: false });
  await expect(prisma.rejeicaoCorrecaoAula.create({ data: { propostaId: primeira.dado.id, propostaHash: decisao.propostaHash,
    decisorId: gestor.id, motivo: "Tentativa direta de decisão contraditória." } })).rejects.toThrow();
  expect(await revisarImpactosCorrecaoAula({ propostaId: primeira.dado.id })).toMatchObject({ ok: false });
  expect(await prisma.rejeicaoCorrecaoAula.count()).toBe(0);
  entrar(professorId);
  const novaEntrada = entrada(await conferenciaAtual(), "publicacao-guards-2");
  novaEntrada.alteracao.conteudo = "Nova proposta destinada a rejeição independente.";
  const segunda = await proporCorrecaoAula(novaEntrada);
  assertOk(segunda);
  const revisao = await prisma.$transaction(tx => carregarImpactosCorrecaoAulaTx(tx, gestor.id, segunda.dado.id));
  entrar(gestor.id);
  assertOk(await rejeitarCorrecaoAula({ propostaId: segunda.dado.id, propostaHash: revisao.propostaHash, motivo: "Gestão rejeita a nova alteração proposta." }));
  const { impactosHash, ...impactos } = revisao;
  await expect(prisma.aprovacaoCorrecaoAula.create({ data: { propostaId: segunda.dado.id, decisorId: gestor.id,
    propostaHash: revisao.propostaHash, impactosHash, impactos: impactos as Prisma.InputJsonValue,
    motivo: "Tentativa de aprovar uma proposta rejeitada." } })).rejects.toThrow();
  expect(await prisma.aprovacaoCorrecaoAula.count()).toBe(1);
});

it("decisões concorrentes de aprovação e rejeição produzem um único resultado terminal", async () => {
  const proposta = await proporCorrecaoAula(entrada(await conferenciaAtual(), "q23-decisao-concorrente"));
  assertOk(proposta);
  const gestor = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);
  const outro = await criarUsuario([Papel.ADMINISTRADOR]);
  const { impactosHash, ...impactos } = await prisma.$transaction(tx => carregarImpactosCorrecaoAulaTx(tx, gestor.id, proposta.dado.id));
  const resultados = await Promise.allSettled([
    prisma.aprovacaoCorrecaoAula.create({ data: { propostaId: proposta.dado.id, decisorId: gestor.id,
      propostaHash: impactos.propostaHash, impactosHash, impactos: impactos as Prisma.InputJsonValue,
      motivo: "Aprovação concorrente da proposta revisada." } }),
    prisma.rejeicaoCorrecaoAula.create({ data: { propostaId: proposta.dado.id, decisorId: outro.id,
      propostaHash: impactos.propostaHash, motivo: "Rejeição concorrente da mesma proposta." } }),
  ]);
  expect(resultados.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(resultados.filter(r => r.status === "rejected")).toHaveLength(1);
  const aprovadas = await prisma.aprovacaoCorrecaoAula.count();
  expect(aprovadas + await prisma.rejeicaoCorrecaoAula.count()).toBe(1);
  expect((await conferenciaAtual()).snapshot.registros.find(r => r.registroId === registroFaltaId)?.participacao)
    .toBe(aprovadas ? "PRESENTE" : "FALTA");
});

it("reposição consulta a participação publicada e conserva o pedido anterior para resolução", async () => {
  const falta = await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registroFaltaId } });
  const presente = await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registroPresenteId } });
  const pedido = { aulaOriginalId: encontroId, matriculaId: falta.matriculaId!, modalidade: "GRAVACAO" as const,
    motivo: "Reposição solicitada para ausência conferida.", evidencia: "Chamada original com falta registrada.", chaveIdempotencia: "q23-reposicao-preexistente" };
  entrar(secretariaId);
  const anterior = await solicitarReposicaoIndividual(pedido);
  assertOk(anterior);
  entrar(professorId);
  const dados = entrada(await conferenciaAtual(), "q23-alterna-participacoes");
  const proposta = await proporCorrecaoAula({ ...dados, alteracao: { ...dados.alteracao,
    registros: dados.alteracao.registros.map(r => r.registroId === registroPresenteId ? { ...r, participacao: "FALTA" as const } : r) } });
  assertOk(proposta);
  const gestor = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);
  await persistirPublicacaoTeste(proposta.dado.id, gestor.id);
  entrar(gestor.id);
  expect(await decidirReposicaoIndividual({ reposicaoId: anterior.dado.id, aprovar: true, motivo: "Não pode aprovar falta corrigida para presença." })).toMatchObject({ ok: false });
  assertOk(await decidirReposicaoIndividual({ reposicaoId: anterior.dado.id, aprovar: false, motivo: "Pedido rejeitado porque a participação foi corrigida." }));
  entrar(secretariaId);
  expect(await solicitarReposicaoIndividual({ ...pedido, chaveIdempotencia: "q23-novo-pedido-bloqueado" })).toMatchObject({ ok: false });
  await expect(prisma.reposicaoIndividual.create({ data: { ...pedido, solicitanteId: secretariaId,
    chaveIdempotencia: "q23-sql-pedido-bloqueado", entradaHash: "fixture" } })).rejects.toThrow();
  const permitido = await solicitarReposicaoIndividual({ ...pedido, matriculaId: presente.matriculaId!, chaveIdempotencia: "q23-falta-publicada-permitida" });
  assertOk(permitido);
  const historico = await consultarReposicoesEquipe({ matriculaId: falta.matriculaId! });
  assertOk(historico);
  expect(historico.dado.reposicoes).toEqual([expect.objectContaining({ id: anterior.dado.id,
    origem: expect.objectContaining({ participacao: "PRESENTE" }), decisao: expect.objectContaining({ aprovada: false }) })]);
  expect(historico.dado.origensElegiveis).toEqual([]);
  expect(await prisma.reposicaoIndividual.count()).toBe(2);
  expect((await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registroFaltaId } })).participacao).toBe("FALTA");
  expect((await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registroPresenteId } })).participacao).toBe("PRESENTE");
});

it("pedido SQL aguardando calendário relê a correção confirmada antes de inserir", async () => {
  const proposta = await proporCorrecaoAula(entrada(await conferenciaAtual(), "q23-concorrencia-pedido"));
  assertOk(proposta);
  const gestor = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);
  const registro = await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registroFaltaId } });
  let anunciar!: () => void;
  let liberar!: () => void;
  const pronto = new Promise<void>(resolve => { anunciar = resolve; });
  const verificacao = new Promise<void>(resolve => { liberar = resolve; });
  let pid = 0;
  const publicacao = prisma.$transaction(async tx => {
    const { impactosHash, ...impactos } = await carregarImpactosCorrecaoAulaTx(tx, gestor.id, proposta.dado.id);
    const [conexao] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
    pid = conexao.pid;
    anunciar();
    await verificacao;
    return tx.aprovacaoCorrecaoAula.create({ data: { propostaId: proposta.dado.id, decisorId: gestor.id,
      propostaHash: impactos.propostaHash, impactosHash, impactos: impactos as Prisma.InputJsonValue,
      motivo: "Publicação antes da nova solicitação concorrente." } });
  }, { timeout: 10000 });
  await Promise.race([pronto, publicacao]);
  const pedido = prisma.reposicaoIndividual.create({ data: { aulaOriginalId: encontroId, matriculaId: registro.matriculaId!,
    modalidade: "GRAVACAO", solicitanteId: secretariaId, motivo: "Solicitação que espera a publicação concorrente.",
    evidencia: "Conferir participação vigente depois da espera.", chaveIdempotencia: "q23-pedido-sql-concorrente", entradaHash: "fixture" } }).then(r => ({ ok: true, r }), erro => ({ ok: false, erro }));
  try {
    let aguardou = false;
    const limite = Date.now() + 3000;
    while (Date.now() < limite) {
      const [estado] = await prisma.$queryRaw<{ aguardando: boolean }[]>`
        SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE ${pid} = ANY(pg_blocking_pids(pid))) AS aguardando`;
      if (estado.aguardando) { aguardou = true; break; }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    expect(aguardou).toBe(true);
  } finally {
    liberar();
    const [resultadoPublicacao, resultadoPedido] = await Promise.all([publicacao, pedido]);
    expect(resultadoPublicacao.propostaId).toBe(proposta.dado.id);
    expect(resultadoPedido.ok).toBe(false);
  }
  expect(await prisma.reposicaoIndividual.count()).toBe(0);
});

it("prepara snapshot completo, preserva diário original e repete a mesma proposta", async () => {
  const conferencia = await conferenciaAtual();
  expect(conferencia.snapshot).toMatchObject({ conteudo: "Conteúdo original da aula.", registros: expect.arrayContaining([
    expect.objectContaining({ registroId: registroFaltaId, participacao: "FALTA", presente: false }),
    expect.objectContaining({ registroId: registroPresenteId, participacao: "PRESENTE", presente: true }),
  ]) });
  const dados = entrada(conferencia);
  const primeira = await proporCorrecaoAula(dados);
  assertOk(primeira);
  const replay = await proporCorrecaoAula(dados);
  expect(replay).toEqual(primeira);
  expect(await prisma.propostaCorrecaoAula.count({ where: { encontroId } })).toBe(1);
  expect(await prisma.aulaDiario.findUniqueOrThrow({ where: { id: diarioId }, include: { registros: true } })).toMatchObject({
    conteudo: "Conteúdo original da aula.", registros: expect.arrayContaining([
      expect.objectContaining({ id: registroFaltaId, participacao: "FALTA", presente: false }),
      expect.objectContaining({ id: registroPresenteId, participacao: "PRESENTE", presente: true }),
    ]),
  });
  const proposta = await prisma.propostaCorrecaoAula.findUniqueOrThrow({ where: { id: primeira.dado.id } });
  expect((await conferenciaAtual()).propostas).toEqual([expect.objectContaining({ id: proposta.id, versao: 1,
    motivo: dados.motivo, evidencia: dados.evidencia, snapshotAnterior: conferencia.snapshot })]);
  expect(proposta.snapshotAnterior).toMatchObject({ diarioId, conteudo: "Conteúdo original da aula." });
  expect(proposta.snapshotNovo).toMatchObject({ diarioId, conteudo: dados.alteracao.conteudo, registros: expect.arrayContaining([expect.objectContaining({ registroId: registroFaltaId, participacao: "PRESENTE", presente: true })]) });
});

it("recusa papéis sem escopo, docente revogado e vínculo docente encerrado", async () => {
  const docente = await prisma.usuario.findUniqueOrThrow({ where: { id: professorId } });
  expect((await listarAulasDiario(docente)).aulas.find(a => a.id === diarioId)?.encontroParaCorrecao).toBe(encontroId);
  entrar(secretariaId);
  expect((await revisarCorrecaoAula({ encontroId })).ok).toBe(false);
  entrar(financeiroId);
  expect((await revisarCorrecaoAula({ encontroId })).ok).toBe(false);
  await prisma.usuario.update({ where: { id: professorId }, data: { ativo: false } });
  entrar(professorId);
  expect((await revisarCorrecaoAula({ encontroId })).ok).toBe(false);
  await prisma.usuario.update({ where: { id: professorId }, data: { ativo: true } });
  await prisma.vinculoDocente.update({ where: { id: vinculoId }, data: { fim: new Date("2026-02-01T00:00:00.000Z") } });
  expect((await revisarCorrecaoAula({ encontroId })).ok).toBe(false);
  expect((await listarAulasDiario(docente)).aulas.find(a => a.id === diarioId)?.encontroParaCorrecao).toBeNull();
});

it("recusa hash e versão obsoletos, registros de outra chamada e proposta sem mudança", async () => {
  const conferencia = await conferenciaAtual();
  const dados = entrada(conferencia, "correcao-stale-445");
  expect((await proporCorrecaoAula({ ...dados, estadoHash: "0".repeat(64) })).ok).toBe(false);

  const atual = await conferenciaAtual();
  const primeira = await proporCorrecaoAula(entrada(atual, "correcao-versao-445"));
  assertOk(primeira);
  expect((await proporCorrecaoAula({ ...entrada(atual, "correcao-versao-445-segunda"), versaoEsperada: 0 })).ok).toBe(false);

  const registroOriginal = await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registroFaltaId } });
  const outraAula = await prisma.encontroAgenda.create({ data: {
    turmaId, professorId, preparadorId: secretariaId, finalidade: "AULA", status: "PREVISTO",
    inicio: new Date("2026-01-11T10:00:00.000Z"), fim: new Date("2026-01-11T11:00:00.000Z"), fusoOrigem: "UTC",
    motivo: "Outra aula da mesma turma.", chaveIdempotencia: "outra-aula-445", entradaHash: "fixture-outra-445",
    diario: { create: { turmaId, professorId, ocorridaEm: new Date("2026-01-11T10:00:00.000Z"), conteudo: "Outra aula", registros: { create: { alunoId: registroOriginal.alunoId, matriculaId: registroOriginal.matriculaId, nomeAluno: "Outro", presente: true, participacao: "PRESENTE" } } } },
  } });
  const outroRegistro = await prisma.registroAulaAluno.findFirstOrThrow({ where: { aula: { encontroId: outraAula.id } } });
  const comOutroRegistro = entrada(await conferenciaAtual(), "correcao-outro-registro");
  comOutroRegistro.alteracao.registros[0]!.registroId = outroRegistro.id;
  expect((await proporCorrecaoAula(comOutroRegistro)).ok).toBe(false);

  const conferenciaSemMudanca = await conferenciaAtual();
  const semMudanca = {
    encontroId, estadoHash: conferenciaSemMudanca.estadoHash, versaoEsperada: conferenciaSemMudanca.versaoAtual,
    alteracao: { conteudo: conferenciaSemMudanca.snapshot.conteudo, registros: conferenciaSemMudanca.snapshot.registros.map((registro) => ({ registroId: registro.registroId, participacao: registro.participacao, observacao: registro.observacao })) },
    motivo: "A chamada original foi conferida com a documentação da aula.", evidencia: "Registro pedagógico da conferência anexado ao processo.", chaveIdempotencia: "correcao-sem-mudanca",
  };
  expect((await proporCorrecaoAula(semMudanca)).ok).toBe(false);
});

it("protege a proposta contra update e delete SQL", async () => {
  const proposta = await proporCorrecaoAula(entrada(await conferenciaAtual(), "correcao-imutavel-445"));
  assertOk(proposta);
  await expect(prisma.$executeRaw(Prisma.sql`UPDATE "PropostaCorrecaoAula" SET motivo='tentativa inválida' WHERE id=${proposta.dado.id}`)).rejects.toThrow();
  await expect(prisma.$executeRaw(Prisma.sql`DELETE FROM "PropostaCorrecaoAula" WHERE id=${proposta.dado.id}`)).rejects.toThrow();
  await expect(prisma.$executeRaw(Prisma.sql`
    INSERT INTO "PropostaCorrecaoAula" (id,"encontroId","diarioId","autorId",versao,"snapshotAnterior","snapshotNovo","estadoHash",motivo,evidencia,"chaveIdempotencia","entradaHash")
    VALUES ('proposta-aula-invalida',${encontroId},${diarioId},${professorId},99,'{}'::jsonb,'{}'::jsonb,${"0".repeat(64)},'Motivo inválido','Evidência inválida','chave-aula-invalida',${"1".repeat(64)})
  `)).rejects.toThrow();
  await expect(prisma.$executeRaw(Prisma.sql`
    INSERT INTO "PropostaCorrecaoAula" (id,"encontroId","diarioId","autorId",versao,"snapshotAnterior","snapshotNovo","estadoHash",motivo,evidencia,"chaveIdempotencia","entradaHash")
    SELECT 'q23-sem-participacao',"encontroId","diarioId","autorId",versao+1,"snapshotAnterior",
      "snapshotNovo" #- '{registros,0,participacao}',"estadoHash",motivo,evidencia,'q23-sem-participacao',"entradaHash"
    FROM "PropostaCorrecaoAula" WHERE id=${proposta.dado.id}
  `)).rejects.toThrow("Registros da correção de aula estão inválidos");
  await expect(prisma.$executeRaw(Prisma.sql`
    INSERT INTO "PropostaCorrecaoAula" (id,"encontroId","diarioId","autorId",versao,"snapshotAnterior","snapshotNovo","estadoHash",motivo,evidencia,"chaveIdempotencia","entradaHash")
    SELECT 'q23-financeiro',"encontroId","diarioId",${financeiroId},versao+1,"snapshotAnterior","snapshotNovo",
      "estadoHash",motivo,evidencia,'q23-financeiro',"entradaHash"
    FROM "PropostaCorrecaoAula" WHERE id=${proposta.dado.id}
  `)).rejects.toThrow("Correção exige gestão ativa ou professor responsável");
  expect(await prisma.propostaCorrecaoAula.findUniqueOrThrow({ where: { id: proposta.dado.id } })).toMatchObject({ motivo: "A chamada original foi conferida com a documentação da aula." });
});

it("preserva os originais concluídos contra edição direta e reabertura", async () => {
  const antes = await conferenciaAtual();
  await expect(prisma.aulaDiario.update({ where: { id: diarioId }, data: { conteudo: "Alteração sem decisão independente" } })).rejects.toThrow();
  await expect(prisma.registroAulaAluno.update({ where: { id: registroFaltaId }, data: { presente: true, participacao: "PRESENTE" } })).rejects.toThrow();
  await expect(prisma.registroAulaAluno.delete({ where: { id: registroFaltaId } })).rejects.toThrow();
  await expect(prisma.aulaDiario.delete({ where: { id: diarioId } })).rejects.toThrow();
  await expect(prisma.aulaDiario.update({ where: { id: diarioId }, data: { encontroId: null } })).rejects.toThrow();
  for (const data of [{ status: "PREVISTO" as const }, { finalidade: "REPOSICAO" as const }, { inicio: new Date("2026-01-10T12:00:00Z") }]) {
    await expect(prisma.encontroAgenda.update({ where: { id: encontroId }, data })).rejects.toThrow();
  }
  await expect(prisma.encontroAgenda.delete({ where: { id: encontroId } })).rejects.toThrow();
  const registro = await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registroFaltaId } });
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno não incluído na chamada", paisId: (await prisma.aluno.findUniqueOrThrow({ where: { id: registro.alunoId } })).paisId } });
  const matricula = await prisma.matricula.findUniqueOrThrow({ where: { id: registro.matriculaId! } });
  const outra = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: matricula.produtoId, paisId: matricula.paisId, moeda: matricula.moeda, status: "ATIVA", ativadaEm: inicio } });
  await prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, matriculaId: outra.id, turmaId, criadoEm: inicio } });
  await expect(prisma.registroAulaAluno.create({ data: { aulaId: diarioId, alunoId: aluno.id, matriculaId: outra.id,
    nomeAluno: aluno.primeiroNome, presente: true, participacao: "PRESENTE" } })).rejects.toThrow();
  expect((await conferenciaAtual()).snapshot).toEqual(antes.snapshot);
  assertOk(await proporCorrecaoAula(entrada(await conferenciaAtual(), "originais-imutaveis-proposta")));
});

it("rejeição independente preserva a fonte, permite nova proposta e repete apenas a mesma decisão", async () => {
  const original = await conferenciaAtual();
  const proposta = await proporCorrecaoAula(entrada(original, "proposta-para-rejeitar"));
  assertOk(proposta);
  const fonte = await prisma.propostaCorrecaoAula.findUniqueOrThrow({ where: { id: proposta.dado.id } });
  const gestor = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);
  entrar(gestor.id);
  const dados = { propostaId: fonte.id, propostaHash: fonte.entradaHash, motivo: "Evidência insuficiente para a alteração solicitada." };
  const decisao = await rejeitarCorrecaoAula(dados);
  assertOk(decisao);
  expect(await rejeitarCorrecaoAula(dados)).toEqual(decisao);
  expect(await rejeitarCorrecaoAula({ ...dados, motivo: "Outro motivo não pode substituir a decisão registrada." })).toMatchObject({ ok: false });
  expect(await revisarImpactosCorrecaoAula({ propostaId: fonte.id })).toMatchObject({ ok: false, erro: expect.stringContaining("rejeitada") });
  const historico = await conferenciaAtual();
  expect(historico.snapshot).toEqual(original.snapshot);
  expect(historico.propostas[0]).toMatchObject({ id: fonte.id, podeRejeitar: false,
    rejeicao: { id: decisao.dado.id, motivo: dados.motivo, decisor: { nome: gestor.nome } } });
  entrar(professorId);
  assertOk(await proporCorrecaoAula(entrada(await conferenciaAtual(), "nova-proposta-apos-rejeicao")));
  expect((await conferenciaAtual()).versaoAtual).toBe(2);
  expect(await prisma.rejeicaoCorrecaoAula.count()).toBe(1);
  expect(await prisma.fechamentoAcademico.count()).toBe(0);
});

it("rejeição recusa autoaprovação, hash incorreto, papel revogado e proposta superada", async () => {
  await prisma.usuario.update({ where: { id: professorId }, data: { papeis: [Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR] } });
  const proposta = await proporCorrecaoAula(entrada(await conferenciaAtual(), "proposta-autodecisao"));
  assertOk(proposta);
  const fonte = await prisma.propostaCorrecaoAula.findUniqueOrThrow({ where: { id: proposta.dado.id } });
  const dados = { propostaId: fonte.id, propostaHash: fonte.entradaHash, motivo: "Conferência independente da evidência apresentada." };
  expect((await conferenciaAtual()).propostas[0].podeRejeitar).toBe(false);
  expect(await rejeitarCorrecaoAula(dados)).toMatchObject({ ok: false, erro: expect.stringContaining("Outra pessoa") });
  entrar(financeiroId);
  expect(await rejeitarCorrecaoAula(dados)).toMatchObject({ ok: false });
  const gestor = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);
  entrar(gestor.id);
  expect(await rejeitarCorrecaoAula({ ...dados, propostaHash: "0".repeat(64) })).toMatchObject({ ok: false });
  await prisma.usuario.update({ where: { id: gestor.id }, data: { ativo: false } });
  expect(await rejeitarCorrecaoAula(dados)).toMatchObject({ ok: false });
  await prisma.usuario.update({ where: { id: gestor.id }, data: { ativo: true } });
  entrar(professorId);
  assertOk(await proporCorrecaoAula(entrada(await conferenciaAtual(), "proposta-mais-recente-rejeicao")));
  entrar(gestor.id);
  expect(await rejeitarCorrecaoAula(dados)).toMatchObject({ ok: false, erro: expect.stringContaining("mais recente") });
  expect(await prisma.rejeicaoCorrecaoAula.count()).toBe(0);
});

it("banco protege rejeição imutável e valida a independência sem depender da ação", async () => {
  const proposta = await proporCorrecaoAula(entrada(await conferenciaAtual(), "proposta-rejeicao-sql"));
  assertOk(proposta);
  const fonte = await prisma.propostaCorrecaoAula.findUniqueOrThrow({ where: { id: proposta.dado.id } });
  const gestor = await criarUsuario([Papel.ADMINISTRADOR]);
  const inserir = (decisorId: string, propostaHash = fonte.entradaHash) => prisma.rejeicaoCorrecaoAula.create({ data: {
    propostaId: fonte.id, decisorId, propostaHash, motivo: "Evidências avaliadas na decisão independente." } });
  await expect(inserir(financeiroId)).rejects.toThrow("gestor pedagógico");
  await prisma.usuario.update({ where: { id: professorId }, data: { papeis: [Papel.PROFESSOR, Papel.ADMINISTRADOR] } });
  await expect(inserir(professorId)).rejects.toThrow("Autor da proposta");
  await expect(inserir(gestor.id, "0".repeat(64))).rejects.toThrow("Hash");
  const decisao = await inserir(gestor.id);
  await expect(prisma.rejeicaoCorrecaoAula.update({ where: { id: decisao.id }, data: { motivo: "Tentativa de alterar histórico" } })).rejects.toThrow("imutáveis");
  await expect(prisma.rejeicaoCorrecaoAula.delete({ where: { id: decisao.id } })).rejects.toThrow("imutáveis");
  expect(await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registroFaltaId } })).toMatchObject({ participacao: "FALTA", presente: false });
});

it("rejeições concorrentes da mesma pessoa persistem uma decisão e um evento", async () => {
  const proposta = await proporCorrecaoAula(entrada(await conferenciaAtual(), "proposta-rejeicao-concorrente"));
  assertOk(proposta);
  const fonte = await prisma.propostaCorrecaoAula.findUniqueOrThrow({ where: { id: proposta.dado.id } });
  entrar((await criarUsuario([Papel.GERENTE_PEDAGOGICO])).id);
  const dados = { propostaId: fonte.id, propostaHash: fonte.entradaHash, motivo: "A conferência independente não autoriza esta alteração." };
  const resultados = await Promise.all([rejeitarCorrecaoAula(dados), rejeitarCorrecaoAula(dados)]);
  assertOk(resultados[0]);
  expect(resultados[1]).toEqual(resultados[0]);
  expect(await prisma.rejeicaoCorrecaoAula.count({ where: { propostaId: fonte.id } })).toBe(1);
  expect(await prisma.evento.count({ where: { agregadoId: encontroId, tipo: "CorrecaoAulaRejeitada" } })).toBe(1);
});

it("professor desvinculado consulta apenas o histórico da própria aula sem recuperar escrita", async () => {
  const fonte = await conferenciaAtual();
  assertOk(await proporCorrecaoAula(entrada(fonte, "historico-docente-desvinculado")));
  await prisma.vinculoDocente.update({ where: { id: vinculoId }, data: { fim: new Date("2026-02-01T00:00:00Z") } });
  const leitura = await consultarHistoricoCorrecaoAula({ encontroId });
  assertOk(leitura);
  expect(leitura.dado).toMatchObject({ podePropor: false, snapshot: fonte.snapshot, propostas: [{ versao: 1, podeRejeitar: false }] });
  expect(await proporCorrecaoAula(entrada(leitura.dado, "historico-nao-libera-escrita"))).toMatchObject({ ok: false });
  expect(await revisarCorrecaoAula({ encontroId })).toMatchObject({ ok: false });
  const docente = await prisma.usuario.findUniqueOrThrow({ where: { id: professorId } });
  expect((await listarAulasDiario(docente)).aulas.find(a => a.id === diarioId)).toMatchObject({
    encontroParaCorrecao: null, encontroParaHistoricoCorrecao: encontroId, podeEditar: false,
  });
  entrar((await criarUsuario([Papel.PROFESSOR])).id);
  expect(await consultarHistoricoCorrecaoAula({ encontroId })).toMatchObject({ ok: false });
  entrar(secretariaId);
  expect(await consultarHistoricoCorrecaoAula({ encontroId })).toMatchObject({ ok: false });
  entrar(professorId);
  await prisma.usuario.update({ where: { id: professorId }, data: { ativo: false } });
  expect(await consultarHistoricoCorrecaoAula({ encontroId })).toMatchObject({ ok: false });
});

it("pagina propostas por versão sem duplicar histórico ou tratar página antiga como proposta atual", async () => {
  for (let versao = 1; versao <= 21; versao++) {
    assertOk(await proporCorrecaoAula(entrada(await conferenciaAtual(), `historico-paginado-${versao}`)));
  }
  const gestor = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);
  entrar(gestor.id);
  const primeira = await consultarHistoricoCorrecaoAula({ encontroId });
  assertOk(primeira);
  expect(primeira.dado.propostas.map(p => p.versao)).toEqual(Array.from({ length: 20 }, (_, i) => 21 - i));
  expect(primeira.dado.proximaVersao).toBe(2);
  expect(primeira.dado.propostas.filter(p => p.podeRejeitar).map(p => p.versao)).toEqual([21]);
  entrar(professorId);
  assertOk(await proporCorrecaoAula(entrada(await conferenciaAtual(), "historico-nova-entre-paginas")));
  entrar(gestor.id);
  const segunda = await consultarHistoricoCorrecaoAula({ encontroId, antesDaVersao: primeira.dado.proximaVersao! });
  assertOk(segunda);
  expect(segunda.dado).toMatchObject({ versaoAtual: 22, proximaVersao: null, propostas: [{ versao: 1, podeRejeitar: false }] });
  expect(await consultarHistoricoCorrecaoAula({ encontroId, antesDaVersao: 0 })).toMatchObject({ ok: false });
  expect(await consultarHistoricoCorrecaoAula({ encontroId, antesDaVersao: 1.5 })).toMatchObject({ ok: false });
});

it("gestão prepara correção após saída do professor e propostas concorrentes não compartilham versão", async () => {
  const gestor = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);
  await prisma.usuario.update({ where: { id: professorId }, data: { ativo: false } });
  entrar(gestor.id);
  const conferencia = await conferenciaAtual();
  const resultados = await Promise.all([
    proporCorrecaoAula(entrada(conferencia, "gestao-concorrente-um")),
    proporCorrecaoAula(entrada(conferencia, "gestao-concorrente-dois")),
  ]);
  expect(resultados.filter(r => r.ok)).toHaveLength(1);
  expect(resultados.filter(r => !r.ok)).toHaveLength(1);
  expect(await prisma.propostaCorrecaoAula.findMany({ where: { encontroId }, select: { autorId: true, versao: true } }))
    .toEqual([{ autorId: gestor.id, versao: 1 }]);
  expect((await prisma.aulaDiario.findUniqueOrThrow({ where: { id: diarioId } })).professorId).toBe(professorId);
});

it("conferência institucional identifica dependência nova e recusa professor e proposta superada", async () => {
  const proposta = await proporCorrecaoAula(entrada(await conferenciaAtual(), "impactos-q23-proposta"));
  assertOk(proposta);
  expect((await revisarImpactosCorrecaoAula({ propostaId: proposta.dado.id })).ok).toBe(false);
  const gestor = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);
  entrar(gestor.id);
  const antes = await revisarImpactosCorrecaoAula({ propostaId: proposta.dado.id });
  assertOk(antes);
  expect(antes.dado.progressao).toHaveLength(2);
  expect(antes.dado.reposicoes).toEqual([]);
  const simulacao = antes.dado.simulacoes.find(s => s.matriculaId === antes.dado.comparacao.registros.find(r => r.registroId === registroFaltaId)!.matriculaId);
  expect(simulacao).toMatchObject({ regraId, pendencia: null,
    antes: { base: 1, contabilizadas: 0, atendeMinimo: false, minimoPercentual: "83" },
    depois: { base: 1, contabilizadas: 1, atendeMinimo: true, minimoPercentual: "83", simulacao: true } });
  expect(simulacao?.fechamento).toMatchObject({ pendencia: null, depois: { elegibilidade: { podeProgredir: false, pendencias: expect.arrayContaining(["NOTAS_INCOMPLETAS"]) } } });
  const preservada = antes.dado.simulacoes.find(s => s.matriculaId !== simulacao?.matriculaId)?.fechamento;
  expect(preservada?.antes?.estadoHash).toBeTruthy();
  expect(preservada?.depois?.estadoHash).toBe(preservada?.antes?.estadoHash);
  expect((await revisarImpactosCorrecaoAula({ propostaId: proposta.dado.id }))).toMatchObject({ ok: true, dado: { impactosHash: antes.dado.impactosHash } });
  const registro = await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registroFaltaId } });
  const reposicao = await prisma.reposicaoIndividual.create({ data: { aulaOriginalId: encontroId, matriculaId: registro.matriculaId!,
    modalidade: "GRAVACAO", solicitanteId: secretariaId, motivo: "Reposição solicitada depois da conferência.", evidencia: "Falta comprovada na chamada.",
    chaveIdempotencia: "q23-impacto-reposicao", entradaHash: "fixture" } });
  const depois = await revisarImpactosCorrecaoAula({ propostaId: proposta.dado.id });
  assertOk(depois);
  expect(depois.dado.impactosHash).not.toBe(antes.dado.impactosHash);
  expect(depois.dado.reposicoes).toEqual([expect.objectContaining({ id: reposicao.id, matriculaId: registro.matriculaId, concluida: false })]);
  expect(depois.dado.comparacao.registros.find(r => r.registroId === registroFaltaId)).toMatchObject({
    antes: { participacao: "FALTA" }, depois: { participacao: "PRESENTE" }, participacaoAlterada: true,
    reposicoesParaConferencia: [{ id: reposicao.id, conclusaoRegistrada: false, motivo: "ORIGEM_PASSA_A_PRESENCA" }],
  });
  assertOk(await proporCorrecaoAula(entrada(await conferenciaAtual(), "q23-proposta-supera")));
  expect((await revisarImpactosCorrecaoAula({ propostaId: proposta.dado.id })).ok).toBe(false);
  expect((await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registroFaltaId } })).participacao).toBe("FALTA");
});

it("helper transacional relê rejeição não confirmada e não concede conferência ao professor", async () => {
  const proposta = await proporCorrecaoAula(entrada(await conferenciaAtual(), "impactos-helper-rejeicao"));
  assertOk(proposta);
  const fonte = await prisma.propostaCorrecaoAula.findUniqueOrThrow({ where: { id: proposta.dado.id } });
  const gestor = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);

  await expect(prisma.$transaction(tx => carregarImpactosCorrecaoAulaTx(tx, professorId, fonte.id)))
    .rejects.toThrow("gestão pedagógica");
  expect(await prisma.rejeicaoCorrecaoAula.count({ where: { propostaId: fonte.id } })).toBe(0);

  await expect(prisma.$transaction(async (tx) => {
    await tx.rejeicaoCorrecaoAula.create({ data: {
      propostaId: fonte.id,
      propostaHash: fonte.entradaHash,
      decisorId: gestor.id,
      motivo: "A gestão rejeita a proposta na própria transação de conferência.",
    } });
    await expect(carregarImpactosCorrecaoAulaTx(tx, gestor.id, fonte.id)).rejects.toThrow("proposta foi rejeitada");
    throw new Error("rollback proposital da rejeição transitória");
  })).rejects.toThrow("rollback proposital");

  expect(await prisma.rejeicaoCorrecaoAula.count({ where: { propostaId: fonte.id } })).toBe(0);
});

it("helper usa um instante único para mover aula prevista de pendência futura para chamada pendente", async () => {
  const proxima = await prisma.encontroAgenda.create({ data: {
    turmaId,
    professorId,
    preparadorId: secretariaId,
    finalidade: "AULA",
    status: "PREVISTO",
    inicio: new Date("2026-01-11T10:00:00.000Z"),
    fim: new Date("2026-01-11T11:00:00.000Z"),
    fusoOrigem: "UTC",
    motivo: "Aula prevista para conferir a fronteira temporal da correção.",
    chaveIdempotencia: "q23-impactos-instante-unico",
    entradaHash: "fixture-q23-impactos-instante-unico",
  } });
  const proposta = await proporCorrecaoAula(entrada(await conferenciaAtual(), "impactos-helper-instante"));
  assertOk(proposta);
  const gestor = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);
  const fonte = await prisma.propostaCorrecaoAula.findUniqueOrThrow({ where: { id: proposta.dado.id } });
  const matriculaId = (await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registroFaltaId } })).matriculaId!;

  const antes = await prisma.$transaction(tx => carregarImpactosCorrecaoAulaTx(tx, gestor.id, fonte.id, new Date("2026-01-11T10:59:00.000Z")));
  const depois = await prisma.$transaction(tx => carregarImpactosCorrecaoAulaTx(tx, gestor.id, fonte.id, new Date("2026-01-11T11:01:00.000Z")));
  const simulacaoAntes = antes.simulacoes.find(simulacao => simulacao.matriculaId === matriculaId);
  const simulacaoDepois = depois.simulacoes.find(simulacao => simulacao.matriculaId === matriculaId);

  expect(simulacaoAntes).toMatchObject({
    antes: { pendenciasHistoricas: expect.arrayContaining([{ origemId: proxima.id, motivo: "ENCONTROS_A_REALIZAR" }]) },
    fechamento: { antes: { elegibilidade: { pendencias: expect.arrayContaining(["FREQUENCIA_HISTORICA_PENDENTE"]) } } },
  });
  expect(simulacaoDepois).toMatchObject({
    antes: { pendencias: expect.arrayContaining([{ aulaId: proxima.id, motivo: "CONCLUSAO_DA_AULA" }]),
      pendenciasHistoricas: expect.not.arrayContaining([expect.objectContaining({ origemId: proxima.id, motivo: "ENCONTROS_A_REALIZAR" })]) },
    fechamento: { antes: { elegibilidade: { pendencias: expect.arrayContaining(["CHAMADA_PENDENTE"]) } } },
  });
  expect((await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registroFaltaId } })).participacao).toBe("FALTA");
  expect(await prisma.aulaDiario.count({ where: { encontroId: proxima.id } })).toBe(0);
});

it("simula frequência do nível sem mudar chamada oficial e recusa fonte de outro contrato", async () => {
  const registro = await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registroFaltaId } });
  const turma = await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } });
  const parametros = { matriculaId: registro.matriculaId!, nivelId: turma.nivelId, minimoPercentual: "75", agora: new Date("2026-02-01T00:00:00Z") };
  const antes = await prisma.$transaction(tx => carregarFrequenciaNivelTx(tx, parametros));
  const chamada = { encontroId, registroId: registro.id, matriculaId: registro.matriculaId!, participacao: "PRESENTE" as const };
  const depois = await prisma.$transaction(tx => simularFrequenciaCorrecaoAulaTx(tx, parametros, chamada));
  expect(antes).toMatchObject({ base: 1, faltas: 1, presencas: 0, atendeMinimo: false });
  expect(depois).toMatchObject({ base: 1, faltas: 0, presencas: 1, atendeMinimo: true, simulacao: true });
  expect(depois.fonteHash).not.toBe(antes.fonteHash);
  expect(await prisma.$transaction(tx => carregarFrequenciaNivelTx(tx, parametros))).toEqual(antes);
  await expect(prisma.$transaction(tx => simularFrequenciaCorrecaoAulaTx(tx, parametros, { ...chamada, registroId: registroPresenteId }))).rejects.toThrow();
  await expect(prisma.$transaction(tx => simularFrequenciaCorrecaoAulaTx(tx, parametros, { ...chamada, matriculaId: "outra" }))).rejects.toThrow();
  expect((await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registro.id } })).participacao).toBe("FALTA");
});

it("agenda de particular entra na conferência da correção e invalida a revisão anterior", async () => {
  const registro = await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registroFaltaId } });
  const gestor = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);
  const reposicao = await prisma.reposicaoIndividual.create({ data: { aulaOriginalId: encontroId, matriculaId: registro.matriculaId!,
    modalidade: "PARTICULAR", solicitanteId: secretariaId, motivo: "Reposição particular autorizada para o aluno.", evidencia: "Pedido registrado.",
    chaveIdempotencia: "q23-agenda-inventario-460", entradaHash: "fixture" } });
  await prisma.decisaoReposicaoIndividual.create({ data: { reposicaoId: reposicao.id, decisorId: gestor.id, aprovada: true, motivo: "Gestão autoriza a particular." } });
  const proposta = await proporCorrecaoAula(entrada(await conferenciaAtual(), "q23-agenda-460"));
  assertOk(proposta);
  entrar(gestor.id);
  const antes = await entradaPublicacao(proposta.dado.id);
  const agenda = await criarAgendaParticularIsentaFixture({ reposicaoId: reposicao.id, matriculaId: registro.matriculaId!, alunoId: registro.alunoId,
    professorId, secretariaId, decisorId: gestor.id, inicio: new Date("2026-01-12T10:00:00Z"), fim: new Date("2026-01-12T11:00:00Z") });
  const revisao = await revisarImpactosCorrecaoAula({ propostaId: proposta.dado.id });
  assertOk(revisao);
  expect(revisao.dado.impactosHash).not.toBe(antes.impactosHash);
  expect(JSON.stringify(revisao.dado.inventarioReposicoes)).toContain(agenda.agendaId);
  expect(JSON.stringify(revisao.dado.inventarioReposicoes)).toContain(agenda.encontroId);
  expect(JSON.stringify(revisao.dado.inventarioReposicoes)).toContain("ISENTA_EXCECAO");
  expect(await aprovarCorrecaoAula(antes)).toMatchObject({ ok: false });
  expect(await aprovarCorrecaoAula(await entradaPublicacao(proposta.dado.id))).toMatchObject({ ok: false, erro: expect.stringMatching(/reposi/i) });
  expect(await prisma.aprovacaoCorrecaoAula.count()).toBe(0);
  expect(await prisma.conclusaoReposicaoIndividual.count()).toBe(0);
  const agendaOriginal = await prisma.agendaReposicaoIndividual.findUniqueOrThrow({ where: { id: agenda.agendaId } });
  const encontroOriginal = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: agenda.encontroId } });
  const conclusao = await prisma.conclusaoReposicaoIndividual.create({ data: { reposicaoId: reposicao.id, versao: 1, concluida: true,
    encontroReposicaoId: agenda.encontroId, realizadaEm: encontroOriginal.fim, concluidaPorId: professorId,
    evidencia: "Presença conferida na particular efetivamente realizada." } });
  const pronta = await revisarImpactosCorrecaoAula({ propostaId: proposta.dado.id });
  assertOk(pronta);
  expect(pronta.dado.reposicoesPreservaveisIds).toEqual([reposicao.id]);
  assertOk(await aprovarCorrecaoAula({ ...await entradaPublicacao(proposta.dado.id), confirmarPreservacaoReposicoes: true }));
  expect(await prisma.agendaReposicaoIndividual.findUniqueOrThrow({ where: { id: agenda.agendaId } })).toEqual(agendaOriginal);
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: agenda.encontroId } })).toEqual(encontroOriginal);
  expect(await prisma.conclusaoReposicaoIndividual.findUniqueOrThrow({ where: { id: conclusao.id } })).toEqual(conclusao);
  expect((await conferenciaAtual()).snapshot.registros.find(r => r.registroId === registroFaltaId)?.participacao).toBe("PRESENTE");
});

it("designação e entrega posteriores invalidam a revisão textual sem expor o conteúdo do aluno", async () => {
  const registro = await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registroFaltaId } });
  const gestor = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);
  const reposicao = await prisma.reposicaoIndividual.create({ data: { aulaOriginalId: encontroId, matriculaId: registro.matriculaId!,
    modalidade: "GRAVACAO", solicitanteId: secretariaId, motivo: "Reposição para conferir dependências vigentes.", evidencia: "Pedido registrado.",
    chaveIdempotencia: "q23-inventario-460", entradaHash: "fixture" } });
  await prisma.decisaoReposicaoIndividual.create({ data: { reposicaoId: reposicao.id, decisorId: gestor.id, aprovada: true, motivo: "Gestão autoriza o pedido." } });
  const fonte = await conferenciaAtual();
  const proposta = await proporCorrecaoAula({ ...entrada(fonte, "q23-texto-inventario-460"), alteracao: {
    conteudo: "Conteúdo ajustado sem corrigir a participação.", registros: fonte.snapshot.registros.map(r => ({ registroId: r.registroId,
      participacao: r.participacao, observacao: r.observacao })) } });
  assertOk(proposta);
  entrar(gestor.id);
  const antes = await entradaPublicacao(proposta.dado.id);
  const designacao = await prisma.designacaoAvaliadorReposicaoIndividual.create({ data: { reposicaoId: reposicao.id, professorId, designadorId: gestor.id,
    inicio, motivo: "Professor assume avaliação com acesso limitado." } });
  const aposDesignacao = await entradaPublicacao(proposta.dado.id);
  expect(aposDesignacao.impactosHash).not.toBe(antes.impactosHash);
  expect(await aprovarCorrecaoAula(antes)).toMatchObject({ ok: false });
  const material = await prisma.materialReposicaoGravacao.create({ data: { reposicaoId: reposicao.id, provedor: "GOOGLE_DRIVE",
    arquivoOficialId: "ARQUIVO_PRIVADO_460", disponivel: true, publicadoPorId: secretariaId, publicadoEm: new Date("2026-01-11T09:00:00Z") } });
  const aposMaterial = await entradaPublicacao(proposta.dado.id);
  expect(aposMaterial.impactosHash).not.toBe(aposDesignacao.impactosHash);
  const disponibilizacao = await prisma.disponibilizacaoEntregaReposicao.create({ data: { reposicaoId: reposicao.id, materialId: material.id,
    disponibilizadaEm: new Date("2026-01-11T09:00:00Z"), prazoBaseMinutos: 120, prazoInicialAte: new Date("2026-01-11T11:00:00Z"), publicadaPorId: secretariaId } });
  const aposPrazo = await entradaPublicacao(proposta.dado.id);
  expect(aposPrazo.impactosHash).not.toBe(aposMaterial.impactosHash);
  const conta = await prisma.contaPortalAluno.create({ data: { alunoId: registro.alunoId } });
  const entrega = await prisma.entregaReposicaoGravacao.create({ data: { reposicaoId: reposicao.id, alunoId: registro.alunoId, contaPortalAlunoId: conta.id,
    versao: 1, resumo: "RESUMO_RESTRITO_460", atividade: "ATIVIDADE_RESTRITA_460", evidencia: "EVIDENCIA_RESTRITA_460", entregueEm: new Date("2026-01-11T10:00:00Z") } });
  const revisao = await revisarImpactosCorrecaoAula({ propostaId: proposta.dado.id });
  assertOk(revisao);
  expect(revisao.dado.impactosHash).not.toBe(aposPrazo.impactosHash);
  expect(JSON.stringify(revisao.dado)).toContain(designacao.id);
  expect(JSON.stringify(revisao.dado)).toContain(entrega.id);
  expect(JSON.stringify(revisao.dado)).toContain(material.id);
  expect(JSON.stringify(revisao.dado)).toContain(disponibilizacao.id);
  expect(JSON.stringify(revisao.dado)).not.toMatch(/RESUMO_RESTRITO_460|ATIVIDADE_RESTRITA_460|EVIDENCIA_RESTRITA_460|ARQUIVO_PRIVADO_460/);
  expect(await aprovarCorrecaoAula(aposDesignacao)).toMatchObject({ ok: false });
  let ultima = await entradaPublicacao(proposta.dado.id);
  const conferirMudanca = async () => {
    const nova = await entradaPublicacao(proposta.dado.id);
    expect(nova.impactosHash).not.toBe(ultima.impactosHash);
    expect(await aprovarCorrecaoAula(ultima)).toMatchObject({ ok: false });
    ultima = nova;
  };
  const correcaoEntrega = await prisma.solicitacaoCorrecaoEntregaReposicao.create({ data: { reposicaoId: reposicao.id, entregaId: entrega.id,
    solicitadaPorId: professorId, comentario: "COMENTARIO_PRIVADO_461", prazoBaseMinutos: 120,
    prazoAte: new Date(Date.now() + 120 * 60_000) } });
  await conferirMudanca();
  await prisma.prorrogacaoPrazoReposicao.create({ data: { reposicaoId: reposicao.id, solicitacaoCorrecaoId: correcaoEntrega.id, versao: 1,
    prazoAnterior: correcaoEntrega.prazoAte, novoPrazo: new Date(correcaoEntrega.prazoAte.getTime() + 60_000), motivo: "PRAZO_PRIVADO_461", autorizadaPorId: gestor.id } });
  await conferirMudanca();
  const relato = await prisma.relatoIndisponibilidadeMaterialReposicao.create({ data: { materialId: material.id,
    relatadoPorId: secretariaId, descricao: "DESCRICAO_PRIVADA_461" } });
  const interrupcao = await prisma.indisponibilidadeMaterialReposicao.create({ data: { materialId: material.id, relatoId: relato.id,
    confirmadaPorId: gestor.id, inicio: new Date("2026-01-12T10:00:00Z"), motivo: "MOTIVO_PRIVADO_461" } });
  await conferirMudanca();
  await prisma.indisponibilidadeMaterialReposicao.update({ where: { id: interrupcao.id }, data: { fim: new Date("2026-01-12T11:00:00Z") } });
  await conferirMudanca();
  const final = await revisarImpactosCorrecaoAula({ propostaId: proposta.dado.id });
  assertOk(final);
  expect(JSON.stringify(final.dado)).not.toMatch(/PRAZO_PRIVADO_461|COMENTARIO_PRIVADO_461|DESCRICAO_PRIVADA_461|MOTIVO_PRIVADO_461/);
  assertOk(await aprovarCorrecaoAula(ultima));
  expect(await prisma.entregaReposicaoGravacao.findUniqueOrThrow({ where: { id: entrega.id } })).toEqual(entrega);
  expect(await prisma.designacaoAvaliadorReposicaoIndividual.findUniqueOrThrow({ where: { id: designacao.id } })).toEqual(designacao);
  expect(await prisma.conclusaoReposicaoIndividual.count()).toBe(0);
});

it.each([false, true])("reposição concluída preserva regularização sem duplicar frequência; revisão Q54=%s", async (conferirQ54) => {
  const registro = await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registroFaltaId } });
  const gestor = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);
  const reposicao = await prisma.reposicaoIndividual.create({ data: { aulaOriginalId: encontroId, matriculaId: registro.matriculaId!,
    modalidade: "GRAVACAO", solicitanteId: secretariaId, motivo: "Reposição da aula com ausência.", evidencia: "Ausência registrada na chamada.",
    chaveIdempotencia: "q23-reposicao-valida", entradaHash: "fixture" } });
  await prisma.decisaoReposicaoIndividual.create({ data: { reposicaoId: reposicao.id, decisorId: gestor.id, aprovada: true, motivo: "Gestão autoriza a reposição individual." } });
  await prisma.designacaoAvaliadorReposicaoIndividual.create({ data: { reposicaoId: reposicao.id, professorId, designadorId: gestor.id, inicio,
    motivo: "Docente designado para avaliação da entrega." } });
  const conta = await prisma.contaPortalAluno.create({ data: { alunoId: registro.alunoId } });
  const entrega = await prisma.entregaReposicaoGravacao.create({ data: { reposicaoId: reposicao.id, alunoId: registro.alunoId, contaPortalAlunoId: conta.id,
    versao: 1, resumo: "Resumo completo apresentado.", atividade: "Atividade realizada.", evidencia: "Entrega registrada.", entregueEm: new Date("2026-01-11T10:00:00Z") } });
  const conclusao = await prisma.conclusaoReposicaoIndividual.create({ data: { reposicaoId: reposicao.id, versao: 1, concluida: true,
    entregaId: entrega.id, validadaEm: new Date("2026-01-11T11:00:00Z"), validadaPorId: professorId, concluidaPorId: professorId, evidencia: "Professor confirmou resumo e atividade." } });
  const proposta = await proporCorrecaoAula(entrada(await conferenciaAtual(), "q23-corrige-reposta"));
  assertOk(proposta);
  entrar(gestor.id);
  const revisao = await revisarImpactosCorrecaoAula({ propostaId: proposta.dado.id });
  assertOk(revisao);
  expect(revisao.dado.simulacoes.find(s => s.matriculaId === registro.matriculaId)).toMatchObject({
    antes: { base: 1, presencas: 0, regularizadas: 1, contabilizadas: 1, atendeMinimo: true },
    depois: { base: 1, presencas: 1, regularizadas: 0, contabilizadas: 1, atendeMinimo: true },
  });
  expect(revisao.dado.comparacao.registros.find(r => r.registroId === registro.id)?.reposicoesParaConferencia)
    .toEqual([{ id: reposicao.id, conclusaoRegistrada: true, motivo: "ORIGEM_PASSA_A_PRESENCA" }]);
  expect(await prisma.conclusaoReposicaoIndividual.findUniqueOrThrow({ where: { id: conclusao.id } })).toEqual(conclusao);
  expect((await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registro.id } })).participacao).toBe("FALTA");
  expect(revisao.dado.reposicoesPreservaveisIds).toEqual([reposicao.id]);
  if (conferirQ54) {
    entrar(professorId);
    const correcao = await proporCorrecaoConclusaoReposicao({ reposicaoId: reposicao.id, conclusaoId: conclusao.id, versaoAnterior: 0,
      concluida: false, motivo: "Conferir uma dúvida sobre a validação anterior.", evidencia: "Evidência pedagógica apresentada para revisão." });
    assertOk(correcao);
    entrar(gestor.id);
    const pendente = await revisarImpactosCorrecaoAula({ propostaId: proposta.dado.id });
    assertOk(pendente);
    expect(pendente.dado.reposicoesPreservaveisIds).toEqual([]);
    expect(await aprovarCorrecaoAula({ ...await entradaPublicacao(proposta.dado.id), confirmarPreservacaoReposicoes: true })).toMatchObject({ ok: false });
    assertOk(await decidirCorrecaoConclusaoReposicao({ correcaoId: correcao.dado.id, propostaHash: correcao.dado.propostaHash,
      aprovar: false, motivo: "Conferência mantém a conclusão original da reposição." }));
  }
  const publicacao = await entradaPublicacao(proposta.dado.id);
  expect(await aprovarCorrecaoAula(publicacao)).toMatchObject({ ok: false, erro: expect.stringMatching(/preserva/i) });
  const publicada = await aprovarCorrecaoAula({ ...publicacao, confirmarPreservacaoReposicoes: true });
  assertOk(publicada);
  expect(await aprovarCorrecaoAula({ ...publicacao, confirmarPreservacaoReposicoes: true })).toEqual(publicada);
  expect(await aprovarCorrecaoAula(publicacao)).toMatchObject({ ok: false });
  const decisao = await prisma.aprovacaoCorrecaoAula.findUniqueOrThrow({ where: { id: publicada.dado.id } });
  expect(decisao.impactos).toMatchObject({ preservacaoReposicoesConcluidas: [reposicao.id] });
  const turma = await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } });
  expect(await prisma.$transaction(tx => carregarFrequenciaNivelTx(tx, { matriculaId: registro.matriculaId!, nivelId: turma.nivelId, minimoPercentual: "83" })))
    .toMatchObject({ base: 1, presencas: 1, regularizadas: 0, contabilizadas: 1 });
  expect(await prisma.conclusaoReposicaoIndividual.findUniqueOrThrow({ where: { id: conclusao.id } })).toEqual(conclusao);
  expect(await prisma.entregaReposicaoGravacao.findUniqueOrThrow({ where: { id: entrega.id } })).toEqual(entrega);
});

it("simula elegibilidade com notas oficiais suficientes sem confirmar fechamento ou progressão", async () => {
  const registro = await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registroFaltaId } });
  const alocacao = await prisma.alocacaoTurma.findFirstOrThrow({ where: { turmaId, matriculaId: registro.matriculaId } });
  const gestor = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);
  for (const codigoAvaliacao of ["I1", "F1"]) {
    entrar(professorId);
    const notas = (codigoAvaliacao === "I1" ? ["FALA" as const] : HABILIDADES).map(habilidade => ({ habilidade, nota: "8", comentarioAluno: "Resultado conferido." }));
    const lancamento = await salvarLancamentoAvaliacao({ alocacaoId: alocacao.id, codigoAvaliacao, realizadaEm: new Date().toISOString(),
      notas, submetida: true, versaoEsperada: 0, chaveIdempotencia: `q23-notas-${codigoAvaliacao}` });
    assertOk(lancamento);
    const fonte = await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: lancamento.dado.id } });
    entrar(gestor.id);
    assertOk(await oficializarLancamentoAvaliacao({ lancamentoId: fonte.id, conteudoHash: fonte.conteudoHash, aprovada: true, motivo: "Conferência independente das notas da avaliação." }));
  }
  entrar(professorId);
  const proposta = await proporCorrecaoAula(entrada(await conferenciaAtual(), "q23-fechamento-simulado"));
  assertOk(proposta);
  entrar(gestor.id);
  const revisao = await revisarImpactosCorrecaoAula({ propostaId: proposta.dado.id });
  assertOk(revisao);
  expect(revisao.dado.simulacoes.find(s => s.matriculaId === registro.matriculaId)?.fechamento).toMatchObject({
    pendencia: null, antes: { elegibilidade: { podeFechar: true, podeProgredir: false, insuficiencias: ["FREQUENCIA_MINIMA"] } },
    depois: { simulacao: true, elegibilidade: { podeFechar: true, podeProgredir: true, pendencias: [], insuficiencias: [] } },
  });
  expect(await prisma.fechamentoAcademico.count()).toBe(0);
  expect(await prisma.solicitacaoMudancaAcademica.count()).toBe(0);
  expect((await prisma.registroAulaAluno.findUniqueOrThrow({ where: { id: registro.id } })).participacao).toBe("FALTA");
});
