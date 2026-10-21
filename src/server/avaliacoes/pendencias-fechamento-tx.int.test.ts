import { beforeEach, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import { disponibilizarSegundaChamada } from "./segunda-chamada-disponibilizacao";
import { consultarPreviaAgendaInicialSegundaChamada, decidirAgendaInicialSegundaChamada, proporAgendaInicialSegundaChamada } from "./segunda-chamada-agenda-inicial";
import { proporExtraSegundaChamada } from "./segunda-chamada-extra";
import { registrarOcorrenciaSegundaChamada } from "./segunda-chamada-ocorrencia";
import { registrarRealizacaoSegundaChamada } from "./segunda-chamada-realizacao";
import { decidirRegraAvaliacaoTx, prepararRegraAvaliacaoTx } from "./regras-tx";
import { decidirSegundaChamada, proporSegundaChamada } from "./segunda-chamada";
import { carregarPendenciasFechamentoTx } from "./pendencias-fechamento-tx";
import { consultarConsolidadoAvaliacoes } from "./consolidado";

let professorId: string;
let gestorId: string;
let administradorId: string;
let turmaId: string;
let matriculaId: string;
let alocacaoId: string;
let nivelId: string;
let regraId: string;
let paisId: string;
let produtoId: string;

const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const proposta = (chaveIdempotencia: string, codigoAvaliacao = "I1") => ({
  alocacaoId,
  codigoAvaliacao,
  motivo: "Ausência justificada na avaliação obrigatória.",
  evidencias: "Evidência institucional registrada para a proposta.",
  chaveIdempotencia,
});
const contexto = () => ({ alocacaoId, matriculaId, nivelId, regraId });
const carregar = () => prisma.$transaction((tx) => carregarPendenciasFechamentoTx(tx, contexto()));

async function fonteDaProposta(chaveIdempotencia: string, codigoAvaliacao = "I1") {
  entrar(professorId);
  const criada = await proporSegundaChamada(proposta(chaveIdempotencia, codigoAvaliacao));
  expect(criada.ok, JSON.stringify(criada)).toBe(true);
  if (!criada.ok || !criada.dado) throw new Error("Proposta de segunda chamada ausente.");
  return prisma.propostaSegundaChamada.findUniqueOrThrow({
    where: { id: criada.dado.id },
    select: { id: true, entradaHash: true },
  });
}

async function aprovarEDisponibilizar(chaveIdempotencia: string, codigoAvaliacao = "I1") {
  const fonte = await fonteDaProposta(chaveIdempotencia, codigoAvaliacao);
  entrar(gestorId);
  expect((await decidirSegundaChamada({
    propostaId: fonte.id, propostaHash: fonte.entradaHash, aprovada: true,
    motivo: "Autorização independente da segunda chamada.",
  })).ok).toBe(true);
  expect((await disponibilizarSegundaChamada({
    propostaId: fonte.id, propostaHash: fonte.entradaHash, disponibilizadaEm: new Date().toISOString(),
    condicoes: "Condições da oportunidade comunicadas pela escola.",
    evidenciaComunicacao: "Comunicado institucional arquivado para a matrícula.",
  })).ok).toBe(true);
  return fonte;
}

async function reservar(fonte: { id: string; entradaHash: string }, chaveIdempotencia: string, inicioEmMs = 20 * 60_000) {
  await prisma.configuracaoOperacional.upsert({ where: { id: "escola" }, create: { id: "escola", fusoInstitucional: "UTC" }, update: {} });
  const versao = await prisma.versaoCalendarioEscolar.count() + 1;
  await prisma.versaoCalendarioEscolar.create({ data: {
    versao, preparadorId: gestorId, fusoInstitucional: "UTC", periodos: [],
    motivo: "Calendário aprovado para a agenda inicial de teste.", chaveIdempotencia: `calendario-${chaveIdempotencia}`, entradaHash: "fixture",
    decisao: { create: { decisorId: administradorId, aprovada: true, motivo: "Calendário revisado independentemente." } },
  } });
  entrar(gestorId);
  const inicio = new Date(Date.now() + inicioEmMs);
  const fim = new Date(inicio.getTime() + 60 * 60_000);
  const referencia = { propostaSegundaChamadaId: fonte.id, professorId, inicio: inicio.toISOString(), fim: fim.toISOString(), fusoOrigem: "UTC" };
  const previa = await consultarPreviaAgendaInicialSegundaChamada(referencia);
  expect(previa.ok, JSON.stringify(previa)).toBe(true);
  if (!previa.ok || !previa.dado) throw new Error("Prévia da agenda inicial ausente.");
  const propostaAgenda = await proporAgendaInicialSegundaChamada({ ...referencia, estadoConferido: previa.dado.estadoConferido,
    motivo: "Encontro próprio da segunda chamada de teste.", evidencia: "Disponibilidade conferida para o encontro.", chaveIdempotencia });
  expect(propostaAgenda.ok, JSON.stringify(propostaAgenda)).toBe(true);
  if (!propostaAgenda.ok || !propostaAgenda.dado) throw new Error("Proposta de agenda inicial ausente.");
  entrar(administradorId);
  const aplicada = await decidirAgendaInicialSegundaChamada({ propostaId: propostaAgenda.dado.id, propostaHash: propostaAgenda.dado.entradaHash,
    aprovada: true, motivo: "Aprovação independente da agenda inicial." });
  expect(aplicada.ok, JSON.stringify(aplicada)).toBe(true);
  if (!aplicada.ok || !aplicada.dado?.reservaId || !aplicada.dado.encontroId) throw new Error("Reserva da segunda chamada ausente.");
  return { reservaId: aplicada.dado.reservaId, encontroId: aplicada.dado.encontroId };
}

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  paisId = catalogo.pais.id;
  produtoId = catalogo.produto.id;
  professorId = (await criarUsuario(["PROFESSOR"])).id;
  gestorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  administradorId = (await criarUsuario(["ADMINISTRADOR"])).id;
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  nivelId = nivel.id;
  const regra = await prisma.$transaction((tx) => prepararRegraAvaliacaoTx(tx, gestorId, {
    nivelId, versaoEsperada: 0, conteudo: regraAvaliacaoTeste(),
    motivo: "Regra isolada para pendências de fechamento.", chaveIdempotencia: "regra-pendencias-fechamento",
  }));
  const versao = await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: regra.id } });
  await prisma.$transaction((tx) => decidirRegraAvaliacaoTx(tx, administradorId, {
    regraId: versao.id, conteudoHash: versao.conteudoHash, aprovada: true,
    motivo: "Publicação independente da regra de teste.",
  }));
  regraId = versao.id;
  const turma = await prisma.turma.create({ data: {
    modalidadeId: catalogo.modalidade.id, nivelId, professorId,
    dataInicio: new Date("2099-01-01T00:00:00Z"),
    vinculosDocentes: { create: { professorId, inicio: new Date("2026-01-01T00:00:00Z") } },
  } });
  await prisma.turma.update({ where: { id: turma.id }, data: { status: "EM_ANDAMENTO", dataInicio: new Date("2026-01-01T00:00:00Z") } });
  turmaId = turma.id;
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno pendências", paisId } });
  const matricula = await prisma.matricula.create({ data: {
    alunoId: aluno.id, produtoId, paisId, moeda: "CRC", status: "ATIVA",
    ativadaEm: new Date("2026-01-01T00:00:00Z"),
  } });
  matriculaId = matricula.id;
  alocacaoId = (await prisma.alocacaoTurma.create({ data: {
    alunoId: aluno.id, matriculaId, turmaId, criadoEm: new Date("2026-01-01T00:00:00Z"),
  } })).id;
  entrar(professorId);
});

it("coleta só etapas abertas e ignora decisão rejeitada ou reserva corretamente liberada", async () => {
  const rejeitada = await fonteDaProposta("segunda-rejeitada", "F1");
  entrar(gestorId);
  expect((await decidirSegundaChamada({
    propostaId: rejeitada.id, propostaHash: rejeitada.entradaHash, aprovada: false,
    motivo: "Proposta rejeitada para este teste.",
  })).ok).toBe(true);
  expect((await carregar()).pendenciasSegundaChamada).toMatchObject({
    propostasAguardandoDecisao: 0, autorizacoesAguardandoAgenda: 0, reservasAguardandoRealizacao: 0,
    ocorrenciasAguardandoEscola: 0, realizacoesSemNotaOficial: 0,
  });

  const aguardando = await fonteDaProposta("segunda-aguardando");
  expect((await carregar()).pendenciasSegundaChamada.propostasAguardandoDecisao).toBe(1);
  entrar(gestorId);
  expect((await decidirSegundaChamada({
    propostaId: aguardando.id, propostaHash: aguardando.entradaHash, aprovada: true,
    motivo: "Decisão aprovada e ainda não disponibilizada.",
  })).ok).toBe(true);
  expect((await carregar()).pendenciasSegundaChamada).toMatchObject({
    propostasAguardandoDecisao: 0, autorizacoesAguardandoAgenda: 1,
  });

  expect((await disponibilizarSegundaChamada({
    propostaId: aguardando.id, propostaHash: aguardando.entradaHash, disponibilizadaEm: new Date().toISOString(),
    condicoes: "Condições comunicadas para a nova oportunidade.",
    evidenciaComunicacao: "Comunicado registrado para o aluno e a equipe.",
  })).ok).toBe(true);
  expect((await carregar()).pendenciasSegundaChamada.autorizacoesAguardandoAgenda).toBe(1);
  const reserva = await reservar(aguardando, "encontro-pendencias-liberada");
  expect((await carregar()).pendenciasSegundaChamada).toMatchObject({
    autorizacoesAguardandoAgenda: 0, reservasAguardandoRealizacao: 1,
  });
  const { consultarCancelamentosAgendaSegundaChamada, proporCancelamentoAgendaSegundaChamada, decidirCancelamentoAgendaSegundaChamada } = await import("./segunda-chamada-cancelamento");
  // A proposta e a decisão são de pessoas diferentes, como no fluxo real.
  entrar(gestorId);
  const consultaCancelamento = await consultarCancelamentosAgendaSegundaChamada({ reservaId: reserva.reservaId });
  if (!consultaCancelamento.ok || !consultaCancelamento.dado) throw new Error(JSON.stringify(consultaCancelamento));
  const propostaCancelamento = await proporCancelamentoAgendaSegundaChamada({ reservaId: reserva.reservaId, estadoConferido: consultaCancelamento.dado.estadoConferido, ocorridaEm: new Date().toISOString(), motivo: "Escola precisou cancelar com antecedência.", evidencia: "Registro institucional do cancelamento.", chaveIdempotencia: "cancelamento-pendencia-liberada" });
  if (!propostaCancelamento.ok || !propostaCancelamento.dado) throw new Error(JSON.stringify(propostaCancelamento));
  const [cancelamento] = await prisma.$queryRaw<{entradaHash:string}[]>`SELECT "entradaHash" FROM "PropostaCancelamentoAgendaSegundaChamada" WHERE id=${propostaCancelamento.dado.id}`;
  entrar(administradorId);
  expect(await decidirCancelamentoAgendaSegundaChamada({ propostaId: propostaCancelamento.dado.id, propostaHash: cancelamento.entradaHash, aprovada: true, motivo: "Conferência independente do cancelamento" })).toMatchObject({ ok: true });
  expect((await carregar()).pendenciasSegundaChamada).toMatchObject({
    reservasAguardandoRealizacao: 0, ocorrenciasAguardandoEscola: 0,
  });
});

it("mantém realização sem lançamento oficial, pendência da escola e extra no contexto acadêmico exato", async () => {
  const fonte = await aprovarEDisponibilizar("segunda-realizacao-sem-nota");
  const reserva = await reservar(fonte, "encontro-pendencias-realizacao", 1_000);
  // A realização exige o início real do encontro; aguardamos o instante criado
  // pelo fluxo aprovado, sem alterar o horário persistido.
  await new Promise(resolve => setTimeout(resolve, 1_200));
  entrar(professorId);
  expect((await registrarRealizacaoSegundaChamada({
    reservaId: reserva.reservaId, realizadaEm: new Date().toISOString(), evidencia: "Ata da aplicação da segunda chamada.",
  })).ok).toBe(true);
  entrar(professorId);
  expect((await proporExtraSegundaChamada({
    alocacaoId, codigoAvaliacao: "I1", quantidade: 1,
    motivo: "Solicitação excepcional ainda sem decisão.", evidencias: "Documentação pedagógica disponível.",
    chaveIdempotencia: "extra-segunda-pendente",
  })).ok).toBe(true);
  expect((await carregar()).pendenciasSegundaChamada).toMatchObject({
    reservasAguardandoRealizacao: 0, realizacoesSemNotaOficial: 1, extrasAguardandoDecisao: 1,
  });
  const acompanhamento = await consultarConsolidadoAvaliacoes(alocacaoId);
  expect(acompanhamento.ok, JSON.stringify(acompanhamento)).toBe(true);
  if (!acompanhamento.ok) throw new Error("Acompanhamento acadêmico indisponível.");
  expect(acompanhamento.dado?.pendenciasSegundaChamada).toMatchObject({
    realizacoesSemNotaOficial: 1, extrasAguardandoDecisao: 1,
  });

  const pendenciaEscola = await aprovarEDisponibilizar("segunda-impedimento-escola", "F1");
  // A realização anterior ainda mantém encontro e docente ocupados; esta
  // oferta usa intervalo independente para testar somente o impedimento.
  const reservaEscola = await reservar(pendenciaEscola, "encontro-pendencias-escola", 2 * 60 * 60_000);
  entrar(gestorId);
  expect((await registrarOcorrenciaSegundaChamada({
    reservaId: reservaEscola.reservaId, tipo: "IMPEDIMENTO_ESCOLA", ocorridaEm: new Date().toISOString(),
    motivo: "A escola impediu a realização no encontro marcado.", evidencia: "Ocorrência institucional documentada.",
  })).ok).toBe(true);
  expect((await carregar()).pendenciasSegundaChamada.ocorrenciasAguardandoEscola).toBe(1);
});

it("não incorpora propostas de segunda chamada de outra matrícula, alocação, nível ou regra", async () => {
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Outro contexto", paisId } });
  const outraMatricula = await prisma.matricula.create({ data: {
    alunoId: aluno.id, produtoId, paisId, moeda: "CRC", status: "ATIVA",
    ativadaEm: new Date("2026-01-01T00:00:00Z"),
  } });
  const outraAlocacao = await prisma.alocacaoTurma.create({ data: {
    alunoId: aluno.id, matriculaId: outraMatricula.id, turmaId, criadoEm: new Date("2026-01-01T00:00:00Z"),
  } });
  entrar(professorId);
  const criada = await proporSegundaChamada({
    alocacaoId: outraAlocacao.id, codigoAvaliacao: "I1", motivo: "Pendência de outro contrato acadêmico.",
    evidencias: "Evidência restrita ao outro contrato.", chaveIdempotencia: "segunda-outro-contexto",
  });
  expect(criada.ok, JSON.stringify(criada)).toBe(true);
  expect((await carregar()).pendenciasSegundaChamada).toMatchObject({
    propostasAguardandoDecisao: 0, autorizacoesAguardandoAgenda: 0, reservasAguardandoRealizacao: 0,
    ocorrenciasAguardandoEscola: 0, realizacoesSemNotaOficial: 0, extrasAguardandoDecisao: 0,
  });
});
