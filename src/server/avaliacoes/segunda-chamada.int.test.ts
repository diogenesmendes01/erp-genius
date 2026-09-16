import { beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { instanteUtcSql } from "./segunda-chamada-utc";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import { decidirRegraAvaliacaoTx, prepararRegraAvaliacaoTx } from "./regras-tx";
import { consultarSegundasChamadas, consultarAutorizacoesEspeciaisSegundaChamada, decidirSegundaChamada, proporSegundaChamada } from "./segunda-chamada";
import { estadoSegundaChamadaTx } from "./segunda-chamada-tx";
import { proporProrrogacaoSegundaChamada, decidirProrrogacaoSegundaChamada } from "./segunda-chamada-prorrogacao";
import { consultarHistoricoReservasSegundaChamada } from "./segunda-chamada-historico";
import { disponibilizarSegundaChamada } from "./segunda-chamada-disponibilizacao";
import { consultarPreviaAgendaInicialSegundaChamada, decidirAgendaInicialSegundaChamada, proporAgendaInicialSegundaChamada } from "./segunda-chamada-agenda-inicial";
import { registrarRealizacaoSegundaChamada, salvarNotaOriginalSegundaChamada } from "./segunda-chamada-realizacao";
import { oficializarLancamentoAvaliacao } from "./lancamentos";
import { autorizarRealizacaoEspecialSegundaChamada, autorizacaoEspecialSegundaChamadaVigente } from "./segunda-chamada-autorizacao-especial";
import { autorizarSegundaChamadaEspecialLocal } from "./segunda-chamada-autorizacao-local";
import { designarProfessorSegundaChamada } from "./segunda-chamada-designacao";
import { realizarSegundaChamadaLocal } from "./segunda-chamada-docente-local";
import { listarSegundasChamadasDocente, consultarSegundaChamadaDocente } from "./segunda-chamada-docente";
import { iniciarTurmasDaAgenda } from "@/server/agenda/inicio-turmas";
import { conferirConclusaoTurma } from "@/server/turmas/conclusao-agenda";
import { prepararCalendarioEscolar } from "@/server/agenda/calendario";
import { decidirCalendarioEscolar } from "@/server/agenda/calendario-decisao";

let professor: string, gestor: string, administrador: string, alocacaoId: string, turmaId: string, matriculaId: string;
const entrar = (usuarioId: string) => authMock.mockResolvedValue({ user: { id: usuarioId } });
const proposta = (chaveIdempotencia = "segunda-chamada-proposta-1") => ({
  alocacaoId, codigoAvaliacao: "I1", motivo: "Ausência justificada na avaliação intermediária.",
  evidencias: "Atestado e comunicação institucional arquivados.", chaveIdempotencia,
});

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  professor = (await criarUsuario(["PROFESSOR"])).id;
  gestor = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  administrador = (await criarUsuario(["ADMINISTRADOR"])).id;
  await prisma.configuracaoOperacional.upsert({
    where: { id: "escola" },
    create: { id: "escola", fusoInstitucional: "UTC" },
    update: { fusoInstitucional: "UTC" },
  });
  entrar(gestor);
  const calendario = await prepararCalendarioEscolar({
    fusoConferido: "UTC", versaoAnterior: 0, periodos: [],
    motivo: "Calendário aprovado para as agendas de segunda chamada.",
    chaveIdempotencia: "calendario-segunda-chamada-integracao",
  });
  if (!calendario.ok || !calendario.dado) throw new Error("Calendário de teste ausente");
  entrar(administrador);
  expect((await decidirCalendarioEscolar({
    calendarioId: calendario.dado.id, aprovar: true, motivo: "Aprovação independente do calendário de teste.",
  })).ok).toBe(true);
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  const regra = await prisma.$transaction(tx => prepararRegraAvaliacaoTx(tx, gestor, {
    nivelId: nivel.id, versaoEsperada: 0, conteudo: regraAvaliacaoTeste(),
    motivo: "Regra de teste da segunda chamada", chaveIdempotencia: "regra-segunda-chamada-teste",
  }));
  const versao = await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: regra.id } });
  await prisma.$transaction(tx => decidirRegraAvaliacaoTx(tx, administrador, {
    regraId: versao.id, conteudoHash: versao.conteudoHash, aprovada: true, motivo: "Publicação independente da regra",
  }));
  const turma = await prisma.turma.create({ data: {
    modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: professor,
    dataInicio: new Date("2099-01-01T00:00:00Z"),
    vinculosDocentes: { create: { professorId: professor, inicio: new Date("2026-01-01T00:00:00Z") } },
  } });
  await prisma.turma.update({ where: { id: turma.id }, data: { status: "EM_ANDAMENTO", dataInicio: new Date("2026-01-01T00:00:00Z") } });
  turmaId = turma.id;
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno segunda chamada", paisId: catalogo.pais.id } });
  const matricula = await prisma.matricula.create({ data: {
    alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA", ativadaEm: new Date("2026-01-01T00:00:00Z"),
  } });
  matriculaId = matricula.id;
  alocacaoId = (await prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, matriculaId: matricula.id, turmaId: turma.id, criadoEm: new Date("2026-01-01T00:00:00Z") } })).id;
  entrar(professor);
});

it("autoriza independentemente uma avaliação pendente e não cria recuperação, agenda ou nota", async () => {
  const criada = await proporSegundaChamada(proposta());
  expect(criada.ok, JSON.stringify(criada)).toBe(true);
  if (!criada.ok || !criada.dado) throw new Error("Proposta ausente");
  const [fonte] = await prisma.$queryRaw<{ id: string; entradaHash: string }[]>`SELECT id, "entradaHash" AS "entradaHash" FROM "PropostaSegundaChamada" WHERE id=${criada.dado.id}`;
  entrar(gestor);
  expect((await decidirSegundaChamada({ propostaId: fonte.id, propostaHash: fonte.entradaHash, aprovada: true, motivo: "Autorização pedagógica independente." })).ok).toBe(true);
  expect(await prisma.propostaPlanoRecuperacao.count()).toBe(0);
  expect(await prisma.reservaTentativaRecuperacao.count()).toBe(0);
  expect(await prisma.registroAvaliacaoMatricula.count()).toBe(0);
  expect(await prisma.encontroAgenda.count()).toBe(0);
});

it("veda autoaprovação, reaproveita somente o reenvio idêntico e expõe histórico paginado", async () => {
  const criada = await proporSegundaChamada(proposta());
  if (!criada.ok || !criada.dado) throw new Error("Proposta ausente");
  const [fonte] = await prisma.$queryRaw<{ id: string; entradaHash: string }[]>`SELECT id, "entradaHash" AS "entradaHash" FROM "PropostaSegundaChamada" WHERE id=${criada.dado.id}`;
  expect(await proporSegundaChamada(proposta())).toEqual(criada);
  expect((await proporSegundaChamada({ ...proposta(), motivo: "Motivo diferente com a mesma chave de idempotência." })).ok).toBe(false);
  await prisma.usuario.update({ where: { id: professor }, data: { papeis: ["PROFESSOR", "GERENTE_PEDAGOGICO"] } });
  expect((await decidirSegundaChamada({ propostaId: fonte.id, propostaHash: fonte.entradaHash, aprovada: true, motivo: "Tentativa de autoaprovação." })).ok).toBe(false);
  entrar(gestor);
  const consulta = await consultarSegundasChamadas({ alocacaoId, codigoAvaliacao: "I1" });
  expect(consulta).toMatchObject({ ok: true, dado: { itens: [{ id: fonte.id, podeDecidir: true }] } });
});

it("não presume saldo: uma regra publicada com limite zero bloqueia a proposta sem criar autorização", async () => {
  const atual = await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: alocacaoId }, select: { turma: { select: { nivelId: true, modalidadeId: true } } } });
  const conteudo = regraAvaliacaoTeste();
  conteudo.avaliacoes.find(a => a.codigo === "I1")!.limiteSegundasChamadas = 0;
  const nova = await prisma.$transaction(tx => prepararRegraAvaliacaoTx(tx, gestor, {
    nivelId: atual.turma.nivelId, versaoEsperada: 1, conteudo, motivo: "Regra sem cota automática",
    chaveIdempotencia: "regra-segunda-chamada-sem-limite",
  }));
  const regra = await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: nova.id } });
  await prisma.$transaction(tx => decidirRegraAvaliacaoTx(tx, administrador, {
    regraId: regra.id, conteudoHash: regra.conteudoHash, aprovada: true, motivo: "Publicação independente sem cota",
  }));
  const turma = await prisma.turma.create({ data: {
    modalidadeId: atual.turma.modalidadeId, nivelId: atual.turma.nivelId, professorId: professor,
    dataInicio: new Date("2026-01-01T00:00:00Z"), status: "EM_ANDAMENTO",
    vinculosDocentes: { create: { professorId: professor, inicio: new Date("2026-01-01T00:00:00Z") } },
  } });
  const origem = await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: alocacaoId }, select: { aluno: { select: { paisId: true } }, matricula: { select: { produtoId: true, paisId: true, moeda: true } } } });
  turmaId = turma.id;
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno sem cota", paisId: origem.aluno.paisId } });
  const matricula = await prisma.matricula.create({ data: {
    alunoId: aluno.id, produtoId: origem.matricula!.produtoId, paisId: origem.matricula!.paisId, moeda: origem.matricula!.moeda, status: "ATIVA", ativadaEm: new Date("2026-01-01T00:00:00Z"),
  } });
  const novaAlocacao = await prisma.alocacaoTurma.create({ data: {
    alunoId: aluno.id, matriculaId: matricula.id, turmaId: turma.id, criadoEm: new Date("2026-01-01T00:00:00Z"),
  } });
  entrar(professor);
  expect(await prisma.$transaction(tx => estadoSegundaChamadaTx(tx, novaAlocacao.id, "I1"))).toMatchObject({ limiteBase: 0, extrasAprovados: 0, reservasOcupadas: 0, saldo: 0 });
});







async function aprovarEDisponibilizar(chave: string) {
  entrar(professor); const criada = await proporSegundaChamada(proposta(chave));
  if (!criada.ok || !criada.dado) throw new Error("proposta ausente");
  const [fonte] = await prisma.$queryRaw<{ id: string; entradaHash: string }[]>`SELECT id,"entradaHash" AS "entradaHash" FROM "PropostaSegundaChamada" WHERE id=${criada.dado.id}`;
  entrar(gestor); expect((await decidirSegundaChamada({ propostaId: fonte.id, propostaHash: fonte.entradaHash, aprovada: true, motivo: "Decisão independente de teste." })).ok).toBe(true);
  expect((await disponibilizarSegundaChamada({ propostaId: fonte.id, propostaHash: fonte.entradaHash, disponibilizadaEm: new Date().toISOString(), condicoes: "Condições oferecidas pela escola.", evidenciaComunicacao: "Comunicação registrada para o aluno." })).ok).toBe(true);
  return fonte;
}

async function aprovarAgendaInicial(
  fonte: { id: string; entradaHash: string },
  chave: string,
  professorEncontro = professor,
  inicio = new Date(Date.now() + 1_200),
  fim = new Date(inicio.getTime() + 5 * 60_000),
): Promise<{ decisaoId: string; encontroId: string; reservaId: string; agendaId: string; inicio: Date; fim: Date; propostaId: string; propostaHash: string }> {
  entrar(gestor);
  const previa = await consultarPreviaAgendaInicialSegundaChamada({
    propostaSegundaChamadaId: fonte.id, professorId: professorEncontro,
    inicio: inicio.toISOString(), fim: fim.toISOString(), fusoOrigem: "UTC",
  });
  if (!previa.ok || !previa.dado) throw new Error(JSON.stringify(previa));
  const propostaAgenda = await proporAgendaInicialSegundaChamada({
    propostaSegundaChamadaId: fonte.id, professorId: professorEncontro,
    estadoConferido: previa.dado.estadoConferido,
    inicio: inicio.toISOString(), fim: fim.toISOString(), fusoOrigem: "UTC",
    motivo: "Agenda exclusiva para a segunda chamada autorizada.",
    evidencia: "Conferência pedagógica registrada para a agenda proposta.",
    chaveIdempotencia: chave,
  });
  if (!propostaAgenda.ok || !propostaAgenda.dado) throw new Error(JSON.stringify(propostaAgenda));
  entrar(administrador);
  const decisao = await decidirAgendaInicialSegundaChamada({
    propostaId: propostaAgenda.dado.id, propostaHash: propostaAgenda.dado.entradaHash,
    aprovada: true, motivo: "Aprovação independente da agenda inicial.",
  });
  if (!decisao.ok || !decisao.dado || !decisao.dado.encontroId || !decisao.dado.reservaId || !decisao.dado.agendaId) {
    throw new Error(JSON.stringify(decisao));
  }
  return {
    decisaoId: decisao.dado.decisaoId,
    encontroId: decisao.dado.encontroId,
    reservaId: decisao.dado.reservaId,
    agendaId: decisao.dado.agendaId,
    inicio, fim, propostaId: propostaAgenda.dado.id, propostaHash: propostaAgenda.dado.entradaHash,
  };
}

/**
 * A partir da migração 126 não há encontro de segunda chamada antes de uma
 * proposta e decisão independentes. Estes adaptadores mantêm os cenários
 * antigos legíveis, mas exercitam exclusivamente o fluxo 125: a primeira
 * etapa só persiste a proposta; a segunda aplica encontro, reserva e agenda
 * de forma atômica.
 */
async function proporEncontroInicialParaTeste(input: {
  propostaId: string; propostaHash: string; professorId: string; inicio: string; fim: string;
  fusoOrigem: string; motivo: string; chaveIdempotencia: string;
}): Promise<Awaited<ReturnType<typeof proporAgendaInicialSegundaChamada>>> {
  entrar(gestor);
  const previa = await consultarPreviaAgendaInicialSegundaChamada({
    propostaSegundaChamadaId: input.propostaId, professorId: input.professorId,
    inicio: input.inicio, fim: input.fim, fusoOrigem: input.fusoOrigem,
  });
  if (!previa.ok || !previa.dado) return { ok: false, erro: "Prévia da agenda inicial não disponível." };
  return proporAgendaInicialSegundaChamada({
    propostaSegundaChamadaId: input.propostaId, professorId: input.professorId,
    estadoConferido: previa.dado.estadoConferido,
    inicio: input.inicio, fim: input.fim, fusoOrigem: input.fusoOrigem,
    motivo: input.motivo, evidencia: "Evidência institucional da agenda inicial proposta.",
    chaveIdempotencia: input.chaveIdempotencia,
  });
}

async function aprovarAgendaInicialParaTeste(input: {
  encontroId: string; motivo: string; propostaId: string; propostaHash: string;
}): Promise<Awaited<ReturnType<typeof decidirAgendaInicialSegundaChamada>>> {
  const propostaAgenda = await prisma.propostaAgendaSegundaChamada.findUnique({
    where: { id: input.encontroId }, select: { entradaHash: true },
  });
  if (!propostaAgenda) return { ok: false, erro: "Proposta de agenda não encontrada." };
  entrar(administrador);
  return decidirAgendaInicialSegundaChamada({
    propostaId: input.encontroId, propostaHash: propostaAgenda.entradaHash,
    aprovada: true, motivo: input.motivo,
  });
}

it("não reutiliza AULA e a aprovação da agenda cria uma única reserva atômica", async () => {
  const fonte = await aprovarEDisponibilizar("segunda-chamada-agenda-adversarial");
  const inicio = new Date(Date.now() + 15 * 60_000), fim = new Date(inicio.getTime() + 60 * 60_000);
  const aula = await prisma.encontroAgenda.create({ data: { turmaId, professorId: professor, preparadorId: gestor, inicio, fim, fusoOrigem: "UTC", status: "PREVISTO", motivo: "Aula comum não reutilizável", chaveIdempotencia: "aula-nao-segunda", entradaHash: "fixture" } });
  const agenda = await aprovarAgendaInicial(fonte, "agenda-inicial-segunda-adversarial", professor, new Date(fim.getTime() + 60_000), new Date(fim.getTime() + 61 * 60_000));
  expect(agenda.encontroId).not.toBe(aula.id);
  const [contagem] = await prisma.$queryRaw<{ total: bigint }[]>`SELECT count(*) AS total FROM "ReservaSegundaChamada"`;
  expect(contagem.total).toBe(1n);
});


async function reservarRealizavel(chave: string, professorEncontro = professor): Promise<string> {
  const fonte = await aprovarEDisponibilizar(chave);
  if (professorEncontro !== professor) {
    entrar(gestor);
    expect(await designarProfessorSegundaChamada({ propostaId: fonte.id, professorId: professorEncontro, inicio: new Date().toISOString(), motivo: "Designação limitada para aplicar segunda chamada", chaveIdempotencia: `${chave}-designacao` })).toMatchObject({ ok: true });
  }
  const agenda = await aprovarAgendaInicial(fonte, `${chave}-agenda-inicial`, professorEncontro);
  await new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, agenda.inicio.getTime() - Date.now() + 200)));
  return agenda.reservaId!;
}

async function reservarFutura(chave: string, inicio: Date, fim: Date, professorEncontro = professor): Promise<string> {
  const fonte = await aprovarEDisponibilizar(chave);
  if (professorEncontro !== professor) {
    entrar(gestor);
    expect(await designarProfessorSegundaChamada({ propostaId: fonte.id, professorId: professorEncontro, inicio: new Date().toISOString(), motivo: "Designação vigente para a agenda futura", chaveIdempotencia: `${chave}-designacao` })).toMatchObject({ ok: true });
  }
  const agenda = await aprovarAgendaInicial(fonte, `${chave}-agenda-inicial`, professorEncontro, inicio, fim);
  return agenda.reservaId!;
}

async function criarGradeReferenciaAprovada() {
  const calendario = await prisma.versaoCalendarioEscolar.findFirstOrThrow({ where: { decisao: { aprovada: true } } });
  await prisma.propostaGradeTurma.create({ data: {
    turmaId, calendarioId: calendario.id, preparadorId: gestor, versao: 1, fusoOrigem: "UTC",
    motivo: "Meta aprovada de uma aula regular", chaveIdempotencia: "grade-segunda-conclusao", entradaHash: "fixture",
    snapshot: { origem: { quantidadeAulas: 1 } },
    decisao: { create: { decisorId: administrador, aprovada: true, motivo: "Meta conferida independentemente" } },
  } });
}

it("realização de segunda chamada não inicia turma planejada", async () => {
  const reservaId = await reservarRealizavel("segunda-nao-inicia-turma");
  entrar(professor);
  expect(await registrarRealizacaoSegundaChamada({
    reservaId, realizadaEm: new Date().toISOString(), evidencia: "Ata da realização registrada.",
  })).toMatchObject({ ok: true });
  await prisma.turma.update({ where: { id: turmaId }, data: { status: "PLANEJADA" } });

  expect(await iniciarTurmasDaAgenda(new Date())).toMatchObject({ iniciadas: 0 });
  expect(await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } })).toMatchObject({ status: "PLANEJADA" });
});

it("realização de segunda chamada não cumpre nem bloqueia a meta de aulas da turma", async () => {
  const reservaId = await reservarRealizavel("segunda-nao-conclui-turma");
  entrar(professor);
  expect(await registrarRealizacaoSegundaChamada({
    reservaId, realizadaEm: new Date().toISOString(), evidencia: "Ata da realização registrada.",
  })).toMatchObject({ ok: true });
  await criarGradeReferenciaAprovada();

  await expect(prisma.$transaction(tx => conferirConclusaoTurma(tx, turmaId)))
    .rejects.toThrow("quantidade exigida de aulas ministradas");

  const matricula = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId }, select: { alunoId: true } });
  const inicio = new Date("2020-01-03T13:00:00Z");
  const aula = await prisma.encontroAgenda.create({ data: {
    turmaId, professorId: professor, preparadorId: gestor, inicio, fim: new Date("2020-01-03T14:00:00Z"),
    fusoOrigem: "UTC", finalidade: "AULA", status: "PREVISTO", motivo: "Aula regular da meta",
    chaveIdempotencia: "aula-regular-conclusao", entradaHash: "fixture",
  } });
  await prisma.aulaDiario.create({ data: {
    turmaId, professorId: professor, encontroId: aula.id, ocorridaEm: inicio, conteudo: "Conteúdo ministrado na aula regular",
    registros: { create: { alunoId: matricula.alunoId, matriculaId, nomeAluno: "Aluno segunda chamada", presente: true } },
  } });
  await prisma.encontroAgenda.update({ where: { id: aula.id }, data: { status: "MINISTRADO" } });

  await expect(prisma.$transaction(tx => conferirConclusaoTurma(tx, turmaId))).resolves.toMatchObject({
    quantidadeExigida: 1,
    encontrosMinistrados: [aula.id],
  });
});

it("recusa realização dentro de indisponibilidade docente aprovada", async () => {
  const reservaId = await reservarRealizavel("segunda-indisponibilidade");
  const ausenciaId = "ausencia-segunda-chamada";
  await prisma.$executeRaw`INSERT INTO "IndisponibilidadeDocente" (id,"professorId","preparadorId",inicio,fim,"fusoOrigem",motivo,"chaveIdempotencia","entradaHash") VALUES (${ausenciaId},${professor},${gestor},(clock_timestamp() AT TIME ZONE 'UTC')-interval '2 minutes',(clock_timestamp() AT TIME ZONE 'UTC')+interval '2 minutes','UTC','Indisponibilidade aprovada para o teste.','ausencia-segunda-chamada','fixture')`;
  await prisma.$executeRaw`INSERT INTO "DecisaoIndisponibilidadeDocente" (id,"indisponibilidadeId","decisorId",aprovada,motivo,"encontrosAfetados","reservasAfetadas") VALUES ('decisao-ausencia-segunda',${ausenciaId},${administrador},true,'Conferência independente.', '[]'::jsonb, '[]'::jsonb)`;
  entrar(professor);
  expect((await registrarRealizacaoSegundaChamada({ reservaId, realizadaEm: new Date().toISOString(), evidencia: "Ata da aplicação." })).ok).toBe(false);
  await expect(prisma.$transaction(async tx => {
    await tx.$executeRaw`UPDATE "ReservaSegundaChamada" SET status='CONSUMIDA_REALIZACAO' WHERE id=${reservaId}`;
    await tx.$executeRaw`INSERT INTO "RealizacaoSegundaChamada" (id,"reservaId","professorId","registradaPorId","realizadaEm",evidencia) VALUES ('realizacao-durante-ausencia',${reservaId},${professor},${professor},clock_timestamp() AT TIME ZONE 'UTC','Ata indevida durante ausência aprovada')`;
  })).rejects.toThrow();
});

it("matrícula pausada exige autorização especial identificada para realização", async () => {
  const reservaId = await reservarRealizavel("segunda-pausa");
  const m = await prisma.matricula.update({ where: { id: matriculaId }, data: { referenciaCobertura: "MES_CIVIL" } });
  const financeiro = (await criarUsuario(["FINANCEIRO"])).id;
  const { solicitarPausaMatriculas, decidirPropostaPausaMatriculas } = await import("@/server/matricula/pausa-proposta");
  const { aplicarPausaMatriculasTx } = await import("@/server/matricula/pausa-execucao");
  entrar(administrador);
  const pausa = await solicitarPausaMatriculas(m.alunoId, { matriculaIds: [matriculaId], dataEfetiva: new Date().toISOString().slice(0, 10), motivo: "Pausa com segunda chamada pendente", chaveIdempotencia: "segunda-chamada-pausa-real" });
  if (!pausa.ok || !pausa.dado) throw new Error(JSON.stringify(pausa));
  entrar(financeiro);
  expect(await decidirPropostaPausaMatriculas(pausa.dado.propostaId, { aprovar: true, motivo: "Pausa conferida independentemente" })).toMatchObject({ ok: true });
  await prisma.$transaction(tx => aplicarPausaMatriculasTx(tx, pausa.dado!.propostaId, administrador, new Date()));
  entrar(professor);
  expect((await registrarRealizacaoSegundaChamada({ reservaId, realizadaEm: new Date().toISOString(), evidencia: "Ata da aplicação." })).ok).toBe(false);
  entrar(gestor);
  const autorizacao = await autorizarRealizacaoEspecialSegundaChamada({ alocacaoId, codigoAvaliacao: "I1", prazoAte: new Date(Date.now() + 86400000).toISOString(), motivo: "Realizar somente a avaliação pendente", chaveIdempotencia: "segunda-autorizacao-data" });
  if (!autorizacao.ok || !autorizacao.dado) throw new Error(JSON.stringify(autorizacao));
  const local = { alocacaoId, codigoAvaliacao: "I1", prazoLocal: autorizacao.dado.prazoAte.slice(0, -1), fuso: "UTC", motivo: "Realizar somente a avaliação pendente", chaveIdempotencia: "segunda-autorizacao-data" };
  expect(await autorizarSegundaChamadaEspecialLocal(local)).toEqual(autorizacao);
  expect(await consultarAutorizacoesEspeciaisSegundaChamada({ alocacaoId, codigoAvaliacao: "I1" })).toMatchObject({ ok: true, dado: { podeAutorizar: true, historico: [{ id: autorizacao.dado.id, prazoAte: autorizacao.dado.prazoAte }] } });
  expect(await autorizarSegundaChamadaEspecialLocal({ ...local, motivo: "Outra finalidade para a chave" })).toMatchObject({ ok: false });
  expect(await autorizarSegundaChamadaEspecialLocal({ ...local, fuso: "Inexistente/Fuso" })).toMatchObject({ ok: false });
  entrar(professor);
  expect(await autorizarSegundaChamadaEspecialLocal(local)).toMatchObject({ ok: false });
  expect(await consultarAutorizacoesEspeciaisSegundaChamada({ alocacaoId, codigoAvaliacao: "I1" })).toMatchObject({ ok: false });
  entrar(gestor);
  const [fonte] = await prisma.$queryRaw<{ criadaEm: Date; prazoAte: Date }[]>`SELECT "criadaEm", "prazoAte" FROM "AutorizacaoEspecialSegundaChamada" WHERE id=${autorizacao.dado.id}`;
  expect(Math.abs(Date.now() - fonte.criadaEm.getTime())).toBeLessThan(10_000);
  const vigente = (quando: Date, codigo = "I1") => prisma.$transaction(tx => autorizacaoEspecialSegundaChamadaVigente(tx, alocacaoId, codigo, quando));
  expect(await vigente(new Date(fonte.criadaEm.getTime() - 1))).toBe(false);
  expect(await vigente(fonte.criadaEm)).toBe(true);
  expect(await vigente(new Date(fonte.prazoAte.getTime() + 1))).toBe(false);
  expect(await vigente(fonte.criadaEm, "F1")).toBe(false);
  await prisma.usuario.update({ where: { id: gestor }, data: { ativo: false } });
  expect(await vigente(fonte.criadaEm)).toBe(false);
  await prisma.usuario.update({ where: { id: gestor }, data: { ativo: true } });
  entrar(professor);
  const antes = new Date(fonte.criadaEm.getTime() - 1).toISOString();
  expect(await registrarRealizacaoSegundaChamada({ reservaId, realizadaEm: antes, evidencia: "Autorização posterior não valida fato anterior" })).toMatchObject({ ok: false });
  await expect(prisma.$transaction(async tx => {
    await tx.$executeRaw`UPDATE "ReservaSegundaChamada" SET status='CONSUMIDA_REALIZACAO' WHERE id=${reservaId}`;
    await tx.$executeRaw`INSERT INTO "RealizacaoSegundaChamada" (id,"reservaId","professorId","registradaPorId","realizadaEm",evidencia) VALUES ('segunda-retroativa',${reservaId},${professor},${professor},${instanteUtcSql(antes)},'Autorização posterior não valida fato anterior')`;
  })).rejects.toThrow(/autorização especial válida na data/);
  await new Promise(resolve => setTimeout(resolve, 5));
  expect(await registrarRealizacaoSegundaChamada({ reservaId, realizadaEm: new Date().toISOString(), evidencia: "Aplicação posterior à autorização especial" })).toMatchObject({ ok: true });
  expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toMatchObject({ status: "PAUSADA" });
});

it("pagina histórico de autorização da segunda chamada isolando a avaliação e o cursor", async () => {
  await reservarRealizavel("segunda-historico");
  await prisma.matricula.update({ where: { id: matriculaId }, data: { status: "PAUSADA" } });
  entrar(gestor);
  const prazoLocal = new Date(Date.now() + 86400000).toISOString().slice(0, -1);
  for (let i = 0; i < 21; i++) expect(await autorizarSegundaChamadaEspecialLocal({ alocacaoId, codigoAvaliacao: "I1", prazoLocal, fuso: "UTC", motivo: `Autorização histórica ${i}`, chaveIdempotencia: `segunda-historico-${i}` })).toMatchObject({ ok: true });
  const primeira = await consultarAutorizacoesEspeciaisSegundaChamada({ alocacaoId, codigoAvaliacao: "I1" });
  if (!primeira.ok || !primeira.dado?.proximoId) throw new Error(JSON.stringify(primeira));
  expect(primeira.dado.historico).toHaveLength(20);
  expect(primeira.dado.identificacao).toMatchObject({ matriculaId, aluno: "Aluno segunda chamada" });
  const segunda = await consultarAutorizacoesEspeciaisSegundaChamada({ alocacaoId, codigoAvaliacao: "I1", depoisId: primeira.dado.proximoId });
  if (!segunda.ok || !segunda.dado) throw new Error(JSON.stringify(segunda));
  expect(segunda.dado.historico).toHaveLength(1);
  expect(segunda.dado.proximoId).toBeNull();
  const esperadas = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "AutorizacaoEspecialSegundaChamada" WHERE "alocacaoId"=${alocacaoId} AND "codigoAvaliacao"='I1' ORDER BY "criadaEm" DESC,id DESC`;
  expect([...primeira.dado.historico, ...segunda.dado.historico].map(a => a.id)).toEqual(esperadas.map(a => a.id));
  expect(JSON.stringify(primeira)).not.toMatch(/entradaHash|chaveIdempotencia/);
  expect(await consultarAutorizacoesEspeciaisSegundaChamada({ alocacaoId, codigoAvaliacao: "F1" })).toMatchObject({ ok: true, dado: { historico: [] } });
  expect(await consultarAutorizacoesEspeciaisSegundaChamada({ alocacaoId, codigoAvaliacao: "F1", depoisId: primeira.dado.proximoId })).toMatchObject({ ok: false });
  expect(await consultarAutorizacoesEspeciaisSegundaChamada({ alocacaoId, codigoAvaliacao: "I1", depoisId: "inexistente" })).toMatchObject({ ok: false });
});

it("realização consome uma vez e a nota submetida fica vinculada ao lançamento original", async () => {
  const reservaId = await reservarRealizavel("segunda-link-nota");
  entrar(professor);
  const realizada = await registrarRealizacaoSegundaChamada({ reservaId, realizadaEm: new Date().toISOString(), evidencia: "Ata da aplicação." });
  if (!realizada.ok || !realizada.dado) throw new Error(JSON.stringify(realizada));
  expect((await registrarRealizacaoSegundaChamada({ reservaId, realizadaEm: new Date().toISOString(), evidencia: "Ata repetida." })).ok).toBe(false);
  const [fonteRealizacao] = await prisma.$queryRaw<{ realizadaEm: Date }[]>`SELECT "realizadaEm" AS "realizadaEm" FROM "RealizacaoSegundaChamada" WHERE id=${realizada.dado.id}`;
  const nota = await salvarNotaOriginalSegundaChamada({ realizacaoId: realizada.dado.id, lancamento: { alocacaoId, codigoAvaliacao: "I1", realizadaEm: fonteRealizacao.realizadaEm.toISOString(), notas: [{ habilidade: "FALA", nota: "7", comentarioAluno: "Nota original da segunda chamada." }], submetida: true, versaoEsperada: 0, chaveIdempotencia: "nota-original-segunda-link" } });
  expect(nota.ok, JSON.stringify(nota)).toBe(true);
  if (!nota.ok || !nota.dado) throw new Error("nota ausente");
  const [v] = await prisma.$queryRaw<{ segundaChamadaRealizacaoId: string | null }[]>`SELECT "segundaChamadaRealizacaoId" AS "segundaChamadaRealizacaoId" FROM "VersaoLancamentoAvaliacao" WHERE id=${nota.dado.id}`;
  expect(v.segundaChamadaRealizacaoId).toBe(realizada.dado.id);
  const versao = await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: nota.dado.id }, select: { conteudoHash: true } });
  await prisma.usuario.update({ where: { id: professor }, data: { papeis: ["PROFESSOR", "ADMINISTRADOR"] } });
  entrar(professor);
  const autoOficializacao = await oficializarLancamentoAvaliacao({ lancamentoId: nota.dado.id, conteudoHash: versao.conteudoHash, aprovada: true, motivo: "Tentativa do próprio realizador com papel administrativo." });
  expect(autoOficializacao).toMatchObject({ ok: false, erro: expect.stringContaining("Outra pessoa") });
  await expect(prisma.decisaoLancamentoAvaliacao.create({ data: { lancamentoId: nota.dado.id, decisorId: professor, aprovada: true, motivo: "Tentativa SQL do próprio realizador administrativo." } })).rejects.toThrow("Oficialização exige outra pessoa");
  expect(await prisma.decisaoLancamentoAvaliacao.count({ where: { lancamentoId: nota.dado.id, aprovada: true } })).toBe(0);
});




it("prorrogação rejeitada não estende o prazo vigente da reserva", async () => {
  const fonte = await aprovarEDisponibilizar("segunda-prorrogacao-rejeitada");
  const [disp] = await prisma.$queryRaw<{ id: string; prazoAte: Date }[]>`SELECT id,"prazoAte" AS "prazoAte" FROM "DisponibilizacaoSegundaChamada" WHERE "propostaId"=${fonte.id}`;
  await prisma.$executeRaw`INSERT INTO "PropostaProrrogacaoSegundaChamada" (id,"disponibilizacaoId","preparadorId",versao,"prazoAnterior","novoPrazo",motivo,"chaveIdempotencia","entradaHash") VALUES ('prorroga-rejeitada',${disp.id},${professor},1,${disp.prazoAte},(clock_timestamp() AT TIME ZONE 'UTC')+interval '90 days','Prorrogação recusada.','prorroga-rejeitada','fixture')`;
  await prisma.$executeRaw`INSERT INTO "DecisaoProrrogacaoSegundaChamada" (id,"propostaId","decisorId",aprovada,motivo) VALUES ('decisao-prorroga-rejeitada','prorroga-rejeitada',${gestor},false,'Recusada após conferência.')`;
  const [vigente] = await prisma.$queryRaw<{ prazoAte: Date }[]>`SELECT COALESCE((SELECT p."novoPrazo" FROM "PropostaProrrogacaoSegundaChamada" p JOIN "DecisaoProrrogacaoSegundaChamada" d ON d."propostaId"=p.id AND d.aprovada WHERE p."disponibilizacaoId"=${disp.id} ORDER BY p.versao DESC LIMIT 1),"prazoAte") AS "prazoAte" FROM "DisponibilizacaoSegundaChamada" WHERE id=${disp.id}`;
  expect(vigente.prazoAte).toEqual(disp.prazoAte);
});



it("professor designado registra somente sua segunda chamada enquanto mantém atribuição", async () => {
  const substituto = (await criarUsuario(["PROFESSOR"])).id;
  const terceiro = (await criarUsuario(["PROFESSOR"])).id;
  const reservaId = await reservarRealizavel("segunda-substituto", substituto);
  await new Promise(resolve => setTimeout(resolve, 5));
  entrar(terceiro);
  expect(await listarSegundasChamadasDocente({})).toMatchObject({ ok: true, dado: { itens: [] } });
  expect(await consultarSegundaChamadaDocente({ reservaId })).toMatchObject({ ok: false });
  entrar(substituto);
  expect(await listarSegundasChamadasDocente({})).toMatchObject({ ok: true, dado: { itens: [{ reservaId, codigoAvaliacao: "I1", podeRealizar: true }] } });
  expect(await listarSegundasChamadasDocente({ depoisId: reservaId })).toMatchObject({ ok: true, dado: { itens: [], proximoId: null } });
  const detalhe = await consultarSegundaChamadaDocente({ reservaId });
  expect(detalhe).toMatchObject({ ok: true, dado: { identificacao: { matriculaId, aluno: "Aluno segunda chamada" }, podeRealizar: true, podeLancarNota: false, habilidadesNecessarias: ["FALA"] } });
  expect(JSON.stringify(detalhe)).not.toMatch(/entradaHash|snapshot|telefone|responsavelFinanceiro|chaveIdempotencia/);
  const realizada = await registrarRealizacaoSegundaChamada({ reservaId, realizadaEm: new Date().toISOString(), evidencia: "Aplicada pelo professor designado" });
  if (!realizada.ok || !realizada.dado) throw new Error(JSON.stringify(realizada));
  const [fonte] = await prisma.$queryRaw<{ realizadaEm: Date; propostaId: string }[]>`SELECT sc."realizadaEm",rs."propostaId" FROM "RealizacaoSegundaChamada" sc JOIN "ReservaSegundaChamada" rs ON rs.id=sc."reservaId" WHERE sc.id=${realizada.dado.id}`;
  expect(await consultarSegundaChamadaDocente({ reservaId })).toMatchObject({ ok: true, dado: { podeRealizar: false, podeLancarNota: true } });
  expect(await realizarSegundaChamadaLocal({ reservaId, dataHora: fonte.realizadaEm.toISOString().slice(0, -1), fuso: "UTC", evidencia: "Aplicada pelo professor designado" })).toEqual(realizada);
  const lancamento = { alocacaoId, codigoAvaliacao: "I1", realizadaEm: fonte.realizadaEm.toISOString(), notas: [{ habilidade: "FALA" as const, nota: "8", comentarioAluno: "Resultado com professor designado" }], submetida: true, versaoEsperada: 0, chaveIdempotencia: "nota-segunda-substituto" };
  const { salvarLancamentoAvaliacao } = await import("./lancamentos");
  expect(await salvarLancamentoAvaliacao(lancamento)).toMatchObject({ ok: false });
  entrar(gestor);
  expect(await designarProfessorSegundaChamada({ propostaId: fonte.propostaId, professorId: terceiro, inicio: new Date().toISOString(), motivo: "Novo responsável pela pendência", chaveIdempotencia: "troca-designado-segunda" })).toMatchObject({ ok: true });
  entrar(substituto);
  expect(await listarSegundasChamadasDocente({})).toMatchObject({ ok: true, dado: { itens: [] } });
  expect(await consultarSegundaChamadaDocente({ reservaId })).toMatchObject({ ok: false });
  expect(await salvarNotaOriginalSegundaChamada({ realizacaoId: realizada.dado.id, lancamento })).toMatchObject({ ok: false });
  entrar(gestor);
  expect(await designarProfessorSegundaChamada({ propostaId: fonte.propostaId, professorId: substituto, inicio: new Date().toISOString(), motivo: "Designação para registrar a própria avaliação", chaveIdempotencia: "retorno-designado-segunda" })).toMatchObject({ ok: true });
  entrar(substituto);
  const nota = await salvarNotaOriginalSegundaChamada({ realizacaoId: realizada.dado.id, lancamento });
  if (!nota.ok || !nota.dado) throw new Error(JSON.stringify(nota));
  expect(await consultarSegundaChamadaDocente({ reservaId })).toMatchObject({ ok: true, dado: { podeLancarNota: false, notaOriginal: { id: nota.dado.id, status: "SUBMETIDA" } } });
  expect(await salvarNotaOriginalSegundaChamada({ realizacaoId: realizada.dado.id, lancamento })).toEqual(nota);
  expect(await salvarNotaOriginalSegundaChamada({ realizacaoId: realizada.dado.id, lancamento: { ...lancamento, notas: [{ habilidade: "FALA", nota: "9", comentarioAluno: "Alteração no reenvio" }] } })).toMatchObject({ ok: false });
  await expect(prisma.$executeRaw`INSERT INTO "VersaoLancamentoAvaliacao" (id,"registroId",versao,"autorId","realizadaPorId","realizadaEm",notas,submetida,"conteudoHash","chaveIdempotencia","entradaHash","segundaChamadaRealizacaoId") SELECT ${"sql-direto-segunda-pendente"},"registroId",2,"autorId","realizadaPorId","realizadaEm",notas,submetida,"conteudoHash",${"sql-direto-segunda-pendente-chave"},"entradaHash","segundaChamadaRealizacaoId" FROM "VersaoLancamentoAvaliacao" WHERE id=${nota.dado.id}`).rejects.toThrow("exige rejeição");
  expect(await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: nota.dado.id } })).toMatchObject({ autorId: substituto, realizadaPorId: substituto, segundaChamadaRealizacaoId: realizada.dado.id });
  expect(await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } })).toMatchObject({ professorId: professor });
  expect(await prisma.vinculoDocente.count({ where: { professorId: substituto } })).toBe(0);
  const original = await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: nota.dado.id } });
  expect(await salvarNotaOriginalSegundaChamada({ realizacaoId: realizada.dado.id, lancamento: { ...lancamento, versaoEsperada: 1, chaveIdempotencia: "segunda-ainda-em-conferencia" } })).toMatchObject({ ok: false });
  entrar(gestor);
  expect(await oficializarLancamentoAvaliacao({ lancamentoId: original.id, conteudoHash: original.conteudoHash, aprovada: false, motivo: "Conferir nota antes da oficialização" })).toMatchObject({ ok: true });
  entrar(substituto);
  expect(await consultarSegundaChamadaDocente({ reservaId })).toMatchObject({ ok: true, dado: { podeLancarNota: true, versaoEsperada: 1, notaOriginal: { id: original.id, status: "REJEITADA", motivoDecisao: "Conferir nota antes da oficialização" } } });
  const revisao = { ...lancamento, notas: [{ habilidade: "FALA" as const, nota: "9", comentarioAluno: "Nota revisada após conferência" }], versaoEsperada: 1, chaveIdempotencia: "segunda-nota-revisada" };
  const revisada = await salvarNotaOriginalSegundaChamada({ realizacaoId: realizada.dado.id, lancamento: revisao });
  if (!revisada.ok || !revisada.dado) throw new Error(JSON.stringify(revisada));
  expect(await salvarNotaOriginalSegundaChamada({ realizacaoId: realizada.dado.id, lancamento: revisao })).toEqual(revisada);
  expect(await salvarNotaOriginalSegundaChamada({ realizacaoId: realizada.dado.id, lancamento })).toEqual(nota);
  expect(await prisma.$queryRaw<{ quantidade: number }[]>`SELECT count(*)::integer AS quantidade FROM "Evento" WHERE tipo='NotaOriginalSegundaChamadaSubmetida' AND payload->>'realizacaoId'=${realizada.dado.id}`).toEqual([{ quantidade: 2 }]);
  expect(await prisma.versaoLancamentoAvaliacao.count({ where: { segundaChamadaRealizacaoId: realizada.dado.id } })).toBe(2);
  expect(await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: original.id } })).toEqual(original);
  expect(await listarSegundasChamadasDocente({})).toMatchObject({ ok: true, dado: { itens: [{ reservaId }] } });
  const filaRevisada = await listarSegundasChamadasDocente({});
  if (!filaRevisada.ok || !filaRevisada.dado) throw new Error(JSON.stringify(filaRevisada));
  expect(filaRevisada.dado.itens).toHaveLength(1);
  const novaVersao = await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: revisada.dado.id } });
  const { carregarPendenciasFechamentoTx } = await import("./pendencias-fechamento-tx");
  const turma = await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } });
  const pendencias = () => prisma.$transaction(tx => carregarPendenciasFechamentoTx(tx, { alocacaoId, matriculaId, nivelId: turma.nivelId, regraId: turma.regraAvaliacaoId! }));
  expect(await pendencias()).toMatchObject({ pendenciasSegundaChamada: { realizacoesSemNotaOficial: 1 } });
  entrar(gestor);
  expect(await oficializarLancamentoAvaliacao({ lancamentoId: novaVersao.id, conteudoHash: novaVersao.conteudoHash, aprovada: true, motivo: "Nota revisada conferida independentemente" })).toMatchObject({ ok: true });
  expect(await pendencias()).toMatchObject({ pendenciasSegundaChamada: { realizacoesSemNotaOficial: 0 } });
  const { consultarDesignacoesSegundaChamada } = await import("./segunda-chamada-designacao-consulta");
  expect(await consultarDesignacoesSegundaChamada({ propostaId: fonte.propostaId })).toMatchObject({ ok: true, dado: { podeDesignar: false } });
  expect(await designarProfessorSegundaChamada({ propostaId: fonte.propostaId, professorId: terceiro, inicio: new Date().toISOString(), motivo: "Não reabrir avaliação já oficializada", chaveIdempotencia: "designacao-oficial-bloqueada" })).toMatchObject({ ok: false });
  entrar(substituto);
  expect(await consultarSegundaChamadaDocente({ reservaId })).toMatchObject({ ok: true, dado: { podeLancarNota: false, notaOriginal: { status: "OFICIALIZADA" } } });
  expect(await salvarNotaOriginalSegundaChamada({ realizacaoId: realizada.dado.id, lancamento: { ...revisao, versaoEsperada: 2, chaveIdempotencia: "segunda-oficial-nao-revisar" } })).toMatchObject({ ok: false });
  await prisma.usuario.update({ where: { id: substituto }, data: { ativo: false } });
  expect(await listarSegundasChamadasDocente({})).toMatchObject({ ok: false });
  expect(await consultarSegundaChamadaDocente({ reservaId })).toMatchObject({ ok: false });
});

it("registra nota de segunda chamada autorizada após encerramento sem reativar contratos", async () => {
  const reservaId = await reservarRealizavel("segunda-encerramento");
  const original = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const alunoId = original.alunoId;
  const outro = await prisma.matricula.create({ data: { alunoId, produtoId: original.produtoId, paisId: original.paisId, moeda: original.moeda, status: "ATIVA", ativadaEm: new Date("2026-01-01T00:00:00Z") } });
  const financeiro = (await criarUsuario(["FINANCEIRO"])).id;
  const documento = await prisma.documento.create({ data: { matriculaId, categoria: "CONTRATO", nome: "Contrato sintético Q151", url: "/api/files/q151.pdf" } });
  await prisma.matricula.update({ where: { id: matriculaId }, data: { referenciaCobertura: "MES_CIVIL", contratoOk: true, contratoDocumentoId: documento.id, confirmacaoContratoEm: new Date(), confirmacaoContratoPorId: administrador } });
  const condicoes = await prisma.condicoesEncerramentoMatricula.create({ data: {
    matriculaId, documentoId: documento.id, preparadorId: financeiro, decisorId: administrador, status: "APROVADA", decididaEm: new Date(), motivoDecisao: "Contrato conferido independentemente", versao: 1, motivo: "Condições de encerramento do contrato",
    regras: { diaEncerramento: "EXCLUIR", metodoDesconto: "ANTES_DO_PROPORCIONAL", condicoesDescontos: "Conforme contrato sintético", multa: { tipo: "SEM_PREVISAO", motivo: "Sem previsão contratual de multa" } },
  } });
  const { solicitarEncerramentoMatriculas } = await import("@/server/matricula/encerramento-solicitacao");
  const { salvarRascunhoAcertoEncerramento } = await import("@/server/matricula/encerramento-rascunho");
  const { decidirAcertoEncerramento } = await import("@/server/matricula/encerramento-decisao");
  const { efetivarAcertoEncerramento } = await import("@/server/matricula/encerramento-efetivar");
  entrar(administrador);
  const pedido = await solicitarEncerramentoMatriculas({ alunoId, matriculaIds: [matriculaId], dataSolicitada: new Date().toISOString().slice(0,10), motivo: "Encerramento solicitado com pendência acadêmica", evidenciaPedido: "Solicitação institucional identificada", chaveIdempotencia: "q151-encerramento-pedido" });
  if (!pedido.ok || !pedido.dado) throw new Error(JSON.stringify(pedido));
  entrar(financeiro);
  const rascunho = await salvarRascunhoAcertoEncerramento({ alunoId, solicitacaoId: pedido.dado.solicitacaoId, contratos: [{ matriculaId, condicoesId: condicoes.id, parcelas: [], multa: { tipo: "SEM_PREVISAO" }, outrasCobrancas: [] }], chaveIdempotencia: "q151-encerramento-acerto", motivo: "Acerto sem cobranças pendentes", versaoAnterior: 0 });
  if (!rascunho.ok || !rascunho.dado) throw new Error(JSON.stringify(rascunho));
  entrar(administrador);
  const decisao = await decidirAcertoEncerramento({ alunoId, rascunhoId: rascunho.dado.id, aprovar: true, motivo: "Acerto conferido por outra pessoa" });
  if (!decisao.ok || !decisao.dado) throw new Error(JSON.stringify(decisao));
  entrar(financeiro);
  const efetivacao = await efetivarAcertoEncerramento({ alunoId, decisaoId: decisao.dado.id });
  if (!efetivacao.ok) throw new Error(JSON.stringify(efetivacao));
  const encerrada = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const alocacao = await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: alocacaoId } });
  expect(encerrada.status).toBe("ENCERRADA"); expect(alocacao.ativa).toBe(false);
  expect(await prisma.$queryRaw<{ situacao: string }[]>`SELECT situacao_matricula_no_instante(${matriculaId}, (clock_timestamp() AT TIME ZONE 'UTC')::timestamp) AS situacao`).toEqual([{ situacao: "ENCERRADA" }]);
  entrar(gestor);
  const autorizacao = await autorizarRealizacaoEspecialSegundaChamada({ alocacaoId, codigoAvaliacao: "I1", prazoAte: new Date(Date.now()+86400000).toISOString(), motivo: "Concluir avaliação pendente após encerramento", chaveIdempotencia: "segunda-encerrada-autorizacao" });
  if (!autorizacao.ok) throw new Error(JSON.stringify(autorizacao));
  await new Promise(resolve => setTimeout(resolve, 5));
  entrar(professor);
  const realizada = await registrarRealizacaoSegundaChamada({ reservaId, realizadaEm: new Date().toISOString(), evidencia: "Aplicação autorizada após encerramento" });
  if (!realizada.ok || !realizada.dado) throw new Error(JSON.stringify(realizada));
  const [r] = await prisma.$queryRaw<{ realizadaEm: Date }[]>`SELECT "realizadaEm" FROM "RealizacaoSegundaChamada" WHERE id=${realizada.dado.id}`;
  const { salvarLancamentoAvaliacao } = await import("./lancamentos");
  expect(await salvarLancamentoAvaliacao({ alocacaoId, codigoAvaliacao: "I1", realizadaEm: r.realizadaEm.toISOString(), notas: [{ habilidade: "FALA", nota: "7", comentarioAluno: "Tentativa sem vínculo à realização" }], submetida: true, versaoEsperada: 0, chaveIdempotencia: "sem-vinculo-segunda-encerrada" })).toMatchObject({ ok: false, erro: expect.stringContaining("vínculo histórico") });
  const nota = await salvarNotaOriginalSegundaChamada({ realizacaoId: realizada.dado.id, lancamento: { alocacaoId, codigoAvaliacao: "I1", realizadaEm: r.realizadaEm.toISOString(), notas: [{ habilidade: "FALA", nota: "7", comentarioAluno: "Avaliação concluída após encerramento" }], submetida: true, versaoEsperada: 0, chaveIdempotencia: "nota-segunda-encerrada" } });
  if (!nota.ok || !nota.dado) throw new Error(JSON.stringify(nota));
  const versao = await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: nota.dado.id } });
  entrar(gestor);
  expect(await oficializarLancamentoAvaliacao({ lancamentoId: versao.id, conteudoHash: versao.conteudoHash, aprovada: true, motivo: "Conferência independente da nota original" })).toMatchObject({ ok: true });
  expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toEqual(encerrada);
  expect(await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: alocacaoId } })).toEqual(alocacao);
  expect(await prisma.matricula.findUniqueOrThrow({ where: { id: outro.id } })).toEqual(outro);
});


it("regulariza nota de segunda chamada por designação específica sem trocar o realizador", async () => {
  const aplicador = (await criarUsuario(["PROFESSOR"])).id;
  const regularizador = (await criarUsuario(["PROFESSOR", "GERENTE_PEDAGOGICO"])).id;
  const estranho = (await criarUsuario(["PROFESSOR"])).id;
  const reservaId = await reservarRealizavel("segunda-regularizacao", aplicador);
  entrar(aplicador);
  const realizada = await registrarRealizacaoSegundaChamada({ reservaId, realizadaEm: new Date().toISOString(), evidencia: "Avaliação aplicada antes da saída do professor" });
  if (!realizada.ok || !realizada.dado) throw new Error(JSON.stringify(realizada));
  const fonte = await prisma.realizacaoSegundaChamada.findUniqueOrThrow({ where: { id: realizada.dado.id } });
  const reserva = await prisma.reservaSegundaChamada.findUniqueOrThrow({ where: { id: reservaId } });
  const lancamento = { alocacaoId, codigoAvaliacao: "I1", realizadaEm: fonte.realizadaEm.toISOString(), notas: [{ habilidade: "FALA" as const, nota: "8", comentarioAluno: "Resultado conferido nas evidências" }], submetida: true, versaoEsperada: 0, chaveIdempotencia: "regularizacao-segunda-nota", motivoRegularizacao: "Professor aplicador deixou a escola", evidenciasRegularizacao: "Registro pedagógico da avaliação realizada" };
  entrar(regularizador);
  expect(await consultarSegundaChamadaDocente({ reservaId })).toMatchObject({ ok: false });
  expect(await salvarNotaOriginalSegundaChamada({ realizacaoId: fonte.id, lancamento })).toMatchObject({ ok: false });
  const { designarAvaliador } = await import("./designacao");
  entrar(gestor);
  expect(await designarAvaliador({ alocacaoId, codigoAvaliacao: "I1", professorId: regularizador, versaoEsperada: 0, motivo: "Regularizar avaliação identificada do professor ausente", chaveIdempotencia: "designacao-regularizacao-segunda" })).toMatchObject({ ok: true });
  await prisma.usuario.update({ where: { id: aplicador }, data: { ativo: false } });
  entrar(regularizador);
  expect(await listarSegundasChamadasDocente({})).toMatchObject({ ok: true, dado: { itens: [{ reservaId, podeRealizar: false }] } });
  expect(await consultarSegundaChamadaDocente({ reservaId })).toMatchObject({ ok: true, dado: { podeLancarNota: true, podeRealizar: false, regularizacao: true } });
  expect(await consultarSegundaChamadaDocente({ reservaId: "reserva-sem-atribuicao" })).toMatchObject({ ok: false });
  expect(await listarSegundasChamadasDocente({ depoisId: reservaId })).toMatchObject({ ok: true, dado: { itens: [], proximoId: null } });
  expect(await salvarNotaOriginalSegundaChamada({ realizacaoId: fonte.id, lancamento: { ...lancamento, motivoRegularizacao: undefined, evidenciasRegularizacao: undefined } })).toMatchObject({ ok: false });
  expect(await salvarNotaOriginalSegundaChamada({ realizacaoId: fonte.id, lancamento: { ...lancamento, realizadaPorId: regularizador } })).toMatchObject({ ok: false });
  const registro = await prisma.registroAvaliacaoMatricula.findFirstOrThrow({ where: { alocacaoId, codigoAvaliacao: "I1" } });
  await expect(prisma.$executeRaw`INSERT INTO "VersaoLancamentoAvaliacao" (id,"registroId",versao,"autorId","realizadaPorId","realizadaEm",notas,submetida,"conteudoHash","chaveIdempotencia","entradaHash","segundaChamadaRealizacaoId") SELECT 'regularizacao-sql-sem-evidencia',${registro.id},1,${regularizador},sc."professorId",sc."realizadaEm",${JSON.stringify(lancamento.notas)}::jsonb,true,'fixture','regularizacao-sql-sem-evidencia','fixture',sc.id FROM "RealizacaoSegundaChamada" sc WHERE sc.id=${fonte.id}`).rejects.toThrow();
  const nota = await salvarNotaOriginalSegundaChamada({ realizacaoId: fonte.id, lancamento });
  if (!nota.ok || !nota.dado) throw new Error(JSON.stringify(nota));
  expect(await salvarNotaOriginalSegundaChamada({ realizacaoId: fonte.id, lancamento })).toEqual(nota);
  const versao = await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: nota.dado.id } });
  expect(versao).toMatchObject({ autorId: regularizador, realizadaPorId: aplicador, realizadaEm: fonte.realizadaEm, segundaChamadaRealizacaoId: fonte.id, motivoRegularizacao: lancamento.motivoRegularizacao, evidenciasRegularizacao: lancamento.evidenciasRegularizacao });
  expect(await prisma.realizacaoSegundaChamada.findUniqueOrThrow({ where: { id: fonte.id } })).toEqual(fonte);
  expect(await prisma.reservaSegundaChamada.findUniqueOrThrow({ where: { id: reservaId } })).toEqual(reserva);
  expect(await prisma.vinculoDocente.count({ where: { turmaId, professorId: regularizador } })).toBe(0);
  expect(await oficializarLancamentoAvaliacao({ lancamentoId: versao.id, conteudoHash: versao.conteudoHash, aprovada: true, motivo: "Tentativa de autoaprovação do regularizador" })).toMatchObject({ ok: false });
  entrar(estranho);
  expect(await consultarSegundaChamadaDocente({ reservaId })).toMatchObject({ ok: false });
  entrar(gestor);
  expect(await designarAvaliador({ alocacaoId, codigoAvaliacao: "I1", professorId: null, versaoEsperada: 1, motivo: "Revogar acesso após entrega da regularização", chaveIdempotencia: "revogar-regularizacao-segunda" })).toMatchObject({ ok: true });
  entrar(regularizador);
  expect(await consultarSegundaChamadaDocente({ reservaId })).toMatchObject({ ok: false });
  expect(await salvarNotaOriginalSegundaChamada({ realizacaoId: fonte.id, lancamento })).toMatchObject({ ok: false });
  entrar(gestor);
  expect(await oficializarLancamentoAvaliacao({ lancamentoId: versao.id, conteudoHash: versao.conteudoHash, aprovada: true, motivo: "Conferência independente das evidências históricas" })).toMatchObject({ ok: true });
});


it("não restaura designação antiga quando a substituição mais recente expira", async () => {
  const primeiro = (await criarUsuario(["PROFESSOR"])).id;
  const segundo = (await criarUsuario(["PROFESSOR"])).id;
  const reservaId = await reservarRealizavel("segunda-designacao-expirada", primeiro);
  const atribuicoes = await prisma.designacaoSegundaChamada.findMany({ where: { professorId: primeiro } });
  expect(atribuicoes).toHaveLength(1);
  expect(Math.abs(atribuicoes[0].criadaEm.getTime() - atribuicoes[0].inicio.getTime())).toBeLessThan(10_000);
  entrar(primeiro);
  const realizada = await registrarRealizacaoSegundaChamada({ reservaId, realizadaEm: new Date().toISOString(), evidencia: "Aplicada durante a primeira atribuição vigente" });
  if (!realizada.ok || !realizada.dado) throw new Error(JSON.stringify(realizada));
  const fonte = await prisma.realizacaoSegundaChamada.findUniqueOrThrow({ where: { id: realizada.dado.id } });
  const reserva = await prisma.reservaSegundaChamada.findUniqueOrThrow({ where: { id: reservaId } });
  entrar(gestor);
  const fim = new Date(Date.now() + 300);
  expect(await designarProfessorSegundaChamada({ propostaId: reserva.propostaId, professorId: segundo, inicio: new Date().toISOString(), fim: fim.toISOString(), motivo: "Substituição de vigência limitada para pendência", chaveIdempotencia: "segunda-substituicao-expira" })).toMatchObject({ ok: true });
  await new Promise(resolve => setTimeout(resolve, Math.max(0, fim.getTime() - Date.now()) + 30));
  const { instanteUtcSql } = await import("./segunda-chamada-utc");
  expect(await prisma.$queryRaw`SELECT professor_segunda_chamada_no_instante(${reserva.propostaId},(clock_timestamp() AT TIME ZONE 'UTC')) AS professor`).toEqual([{ professor: null }]);
  expect(await prisma.$queryRaw`SELECT professor_segunda_chamada_no_instante(${reserva.propostaId},${instanteUtcSql(fonte.realizadaEm)}) AS professor`).toEqual([{ professor: primeiro }]);
  expect(await prisma.$queryRaw`SELECT professor_segunda_chamada_no_instante(${reserva.propostaId},(clock_timestamp() AT TIME ZONE 'UTC')+interval '1 day') AS professor`).toEqual([{ professor: null }]);
  entrar(primeiro);
  expect(await listarSegundasChamadasDocente({})).toMatchObject({ ok: true, dado: { itens: [] } });
  expect(await consultarSegundaChamadaDocente({ reservaId })).toMatchObject({ ok: false });
  expect(await salvarNotaOriginalSegundaChamada({ realizacaoId: fonte.id, lancamento: { alocacaoId, codigoAvaliacao: "I1", realizadaEm: fonte.realizadaEm.toISOString(), notas: [{ habilidade: "FALA", nota: "8", comentarioAluno: "Nota sem atribuição atual" }], submetida: true, versaoEsperada: 0, chaveIdempotencia: "segunda-nota-atribuicao-expirada" } })).toMatchObject({ ok: false });
  entrar(segundo);
  expect(await consultarSegundaChamadaDocente({ reservaId })).toMatchObject({ ok: false });
});


it("gestão consulta a designação temporal com histórico paginado e projeção limitada", async () => {
  const fonte = await aprovarEDisponibilizar("segunda-consulta-designacao");
  const { consultarDesignacoesSegundaChamada } = await import("./segunda-chamada-designacao-consulta");
  entrar(professor);
  expect(await consultarDesignacoesSegundaChamada({ propostaId: fonte.id })).toMatchObject({ ok: false });
  entrar(administrador);
  expect(await consultarDesignacoesSegundaChamada({ propostaId: "proposta-inexistente" })).toMatchObject({ ok: false });
  const substituto = (await criarUsuario(["PROFESSOR"])).id;
  for (let i = 0; i < 22; i++) {
    expect(await designarProfessorSegundaChamada({ propostaId: fonte.id, professorId: i % 2 ? professor : substituto, inicio: new Date().toISOString(), motivo: `Designação institucional identificada ${i}`, chaveIdempotencia: `consulta-designacao-segunda-${i}` })).toMatchObject({ ok: true });
  }
  const primeira = await consultarDesignacoesSegundaChamada({ propostaId: fonte.id });
  if (!primeira.ok || !primeira.dado) throw new Error(JSON.stringify(primeira));
  expect(primeira.dado).toMatchObject({ propostaId: fonte.id, codigoAvaliacao: "I1", podeDesignar: true, atual: { versao: 22, professor: { id: professor } }, vigenteProfessorId: professor });
  expect(primeira.dado.historico).toHaveLength(20);
  expect(primeira.dado.proximaVersao).not.toBeNull();
  const segunda = await consultarDesignacoesSegundaChamada({ propostaId: fonte.id, depoisVersao: primeira.dado.proximaVersao! });
  if (!segunda.ok || !segunda.dado) throw new Error(JSON.stringify(segunda));
  expect(segunda.dado.historico).toHaveLength(2);
  expect(segunda.dado.proximaVersao).toBeNull();
  expect(JSON.stringify(primeira.dado)).not.toMatch(/entradaHash|chaveIdempotencia|senha|telefone|responsavelFinanceiro/);
  const { designarProfessorSegundaChamadaLocal } = await import("./segunda-chamada-designacao-local");
  const local = { propostaId: fonte.id, professorId: substituto, inicioLocal: "2026-01-01T09:00", fimLocal: "2099-01-01T09:00", fuso: "America/Costa_Rica", motivo: "Designação com fuso explícito conferido", chaveIdempotencia: "designacao-local-costa-rica" };
  const designada = await designarProfessorSegundaChamadaLocal(local);
  if (!designada.ok || !designada.dado) throw new Error(JSON.stringify(designada));
  expect(await designarProfessorSegundaChamadaLocal(local)).toEqual(designada);
  const registro = await prisma.designacaoSegundaChamada.findUniqueOrThrow({ where: { id: designada.dado.id } });
  expect(registro.inicio.toISOString()).toBe("2026-01-01T15:00:00.000Z");
  expect(registro.fim?.toISOString()).toBe("2099-01-01T15:00:00.000Z");
  await expect(prisma.designacaoSegundaChamada.update({ where: { id: registro.id }, data: { motivo: "Tentativa de apagar a justificativa original" } })).rejects.toThrow();
  await expect(prisma.designacaoSegundaChamada.delete({ where: { id: registro.id } })).rejects.toThrow();
  await expect(prisma.$executeRaw`INSERT INTO "DesignacaoSegundaChamada" (id,"propostaId","professorId","gestorId",versao,inicio,fim,motivo,"chaveIdempotencia","entradaHash") SELECT 'designacao-sql-gestor-invalido',"propostaId","professorId",${professor},versao+1,inicio,fim,motivo,'designacao-sql-gestor-invalido',"entradaHash" FROM "DesignacaoSegundaChamada" WHERE id=${registro.id}`).rejects.toThrow();
  await expect(prisma.$executeRaw`INSERT INTO "DesignacaoSegundaChamada" (id,"propostaId","professorId","gestorId",versao,inicio,fim,motivo,"chaveIdempotencia","entradaHash") SELECT 'designacao-sql-versao-invalida',"propostaId","professorId","gestorId",versao+2,inicio,fim,motivo,'designacao-sql-versao-invalida',"entradaHash" FROM "DesignacaoSegundaChamada" WHERE id=${registro.id}`).rejects.toThrow();
  await prisma.$executeRaw`INSERT INTO "DesignacaoSegundaChamada" (id,"propostaId","professorId","gestorId",versao,inicio,fim,motivo,"chaveIdempotencia","entradaHash","criadaEm") SELECT 'designacao-sql-data-servidor',"propostaId","professorId","gestorId",versao+1,inicio,fim,motivo,'designacao-sql-data-servidor',"entradaHash",'2000-01-01'::timestamp FROM "DesignacaoSegundaChamada" WHERE id=${registro.id}`;
  const criadaServidor = await prisma.designacaoSegundaChamada.findUniqueOrThrow({ where: { id: "designacao-sql-data-servidor" } });
  expect(Math.abs(Date.now() - criadaServidor.criadaEm.getTime())).toBeLessThan(10_000);
  expect(await prisma.designacaoSegundaChamada.findUniqueOrThrow({ where: { id: registro.id } })).toEqual(registro);
  expect(await designarProfessorSegundaChamadaLocal({ ...local, fuso: "Fuso/Inexistente", chaveIdempotencia: "designacao-fuso-invalido" })).toMatchObject({ ok: false });
  await prisma.usuario.update({ where: { id: administrador }, data: { ativo: false } });
  expect(await consultarDesignacoesSegundaChamada({ propostaId: fonte.id })).toMatchObject({ ok: false });
});


it.each([
  ["FALTA", false, "CONSUMIDA_FALTA"],
  ["IMPEDIMENTO_ESCOLA", false, "PENDENCIA_ESCOLA"],
] as const)("registra %s com evidência real e preserva o consumo %s", async (tipo, futuro, status) => {
  const reservaId = await reservarRealizavel(`ocorrencia-${tipo}-${futuro}`);
  const { registrarOcorrenciaSegundaChamadaLocal } = await import("./segunda-chamada-ocorrencia-local");
  const dados = { reservaId, tipo, dataHoraLocal: new Date().toISOString().slice(0,-1), fuso: "UTC", motivo: "Solicitação da ocorrência informada pela equipe", evidencia: "Protocolo institucional específico desta ocorrência" };
  entrar(professor);
  expect(await registrarOcorrenciaSegundaChamadaLocal(dados)).toMatchObject({ ok: false });
  entrar(gestor);
  expect(await registrarOcorrenciaSegundaChamadaLocal({ ...dados, evidencia: "" })).toMatchObject({ ok: false });
  const { registrarOcorrenciaSegundaChamadaTx } = await import("./segunda-chamada-ocorrencia-tx");
  const entrada = { reservaId, tipo, ocorridaEm: dados.dataHoraLocal + "Z", motivo: dados.motivo, evidencia: dados.evidencia };
  // Concorrência exercita a mesma transação da ação sem a importação dinâmica de NextAuth do ambiente de teste.
  const [primeiroRegistro, segundoRegistro] = await Promise.all([1, 2].map(() => prisma.$transaction(tx => registrarOcorrenciaSegundaChamadaTx(tx, gestor, entrada))));
  expect(segundoRegistro).toEqual(primeiroRegistro);
  const resultado = await registrarOcorrenciaSegundaChamadaLocal(dados);
  expect(resultado).toMatchObject({ ok: true, dado: primeiroRegistro });
  if (!resultado.ok || !resultado.dado) throw new Error(JSON.stringify(resultado));
  expect(resultado.dado.status).toBe(status);
  expect(await registrarOcorrenciaSegundaChamadaLocal(dados)).toEqual(resultado);
  expect(await registrarOcorrenciaSegundaChamadaLocal({ ...dados, motivo: "Conteúdo diferente no reenvio" })).toMatchObject({ ok: false });
  const ocorrencias = await prisma.ocorrenciaSegundaChamada.findMany({ where: { reservaId } });
  expect(ocorrencias).toHaveLength(1);
  expect(ocorrencias[0]).toMatchObject({ status, motivo: dados.motivo, evidencia: dados.evidencia, registradaPorId: gestor });
  expect(ocorrencias[0].ocorridaEm.toISOString()).toBe(dados.dataHoraLocal+"Z");
  expect(await prisma.realizacaoSegundaChamada.count()).toBe(0);
  expect(await prisma.versaoLancamentoAvaliacao.count()).toBe(0);
  expect(await prisma.$queryRaw`SELECT count(*)::integer AS total FROM "Evento" WHERE tipo='SegundaChamadaOcorrenciaRegistrada' AND payload->>'reservaId'=${reservaId}`).toEqual([{ total: 1 }]);
});

it("não registra falta antes do encontro nem ocorrência futura", async () => {
  const inicio = new Date(Date.now() + 24 * 60 * 60_000);
  const reservaId = await reservarFutura("ocorrencia-futura-invalida", inicio, new Date(inicio.getTime() + 60 * 60_000));
  const { registrarOcorrenciaSegundaChamada } = await import("./segunda-chamada-ocorrencia");
  entrar(gestor);
  const dados = { reservaId, tipo: "FALTA" as const, ocorridaEm: new Date().toISOString(), motivo: "Ocorrência precisa ser confirmada", evidencia: "Relato específico recebido pela gestão" };
  expect(await registrarOcorrenciaSegundaChamada(dados)).toMatchObject({ ok: false });
  expect(await registrarOcorrenciaSegundaChamada({ ...dados, tipo: "CANCELAMENTO_ESCOLA", ocorridaEm: new Date(Date.now()+86400000).toISOString() })).toMatchObject({ ok: false });
  expect(await prisma.ocorrenciaSegundaChamada.count()).toBe(0);
  expect(await prisma.reservaSegundaChamada.findUniqueOrThrow({ where: { id: reservaId } })).toMatchObject({ status: "RESERVADA" });
});


it("banco preserva a reserva e exige ocorrência correspondente ao consumo", async () => {
  const reservaId = await reservarRealizavel("guard-ocorrencia-segunda");
  const original = await prisma.reservaSegundaChamada.findUniqueOrThrow({ where: { id: reservaId } });
  await expect(prisma.reservaSegundaChamada.update({ where: { id: reservaId }, data: { regraCancelamentoMinutos: original.regraCancelamentoMinutos + 1 } })).rejects.toThrow();
  await expect(prisma.reservaSegundaChamada.update({ where: { id: reservaId }, data: { reservadaEm: new Date("2000-01-01T00:00:00Z") } })).rejects.toThrow();
  await expect(prisma.reservaSegundaChamada.delete({ where: { id: reservaId } })).rejects.toThrow();
  await expect(prisma.reservaSegundaChamada.update({ where: { id: reservaId }, data: { status: "CONSUMIDA_FALTA" } })).rejects.toThrow();
  expect(await prisma.reservaSegundaChamada.findUniqueOrThrow({ where: { id: reservaId } })).toEqual(original);
  for (const registradaPorId of [professor, gestor]) {
    await expect(prisma.$transaction(async tx => {
      await tx.$executeRaw`UPDATE "ReservaSegundaChamada" SET status='CONSUMIDA_FALTA' WHERE id=${reservaId}`;
      await tx.$executeRaw`INSERT INTO "OcorrenciaSegundaChamada" (id,"reservaId","registradaPorId",status,"ocorridaEm",motivo,evidencia) VALUES (${`occ-sql-invalida-${registradaPorId}`},${reservaId},${registradaPorId},'CONSUMIDA_FALTA',(clock_timestamp() AT TIME ZONE 'UTC')+CASE WHEN ${registradaPorId === professor} THEN interval '0 seconds' ELSE interval '1 day' END,'Teste de ocorrência indevida','Evidência da tentativa inválida')`;
    })).rejects.toThrow();
  }
  entrar(gestor);
  const { registrarOcorrenciaSegundaChamada } = await import("./segunda-chamada-ocorrencia");
  const resultado = await registrarOcorrenciaSegundaChamada({ reservaId, tipo: "FALTA", ocorridaEm: new Date().toISOString(), motivo: "Ausência confirmada pela gestão", evidencia: "Registro da aplicação e do aluno ausente" });
  if (!resultado.ok || !resultado.dado) throw new Error(JSON.stringify(resultado));
  const ocorrencia = await prisma.ocorrenciaSegundaChamada.findUniqueOrThrow({ where: { id: resultado.dado.id } });
  await expect(prisma.ocorrenciaSegundaChamada.update({ where: { id: ocorrencia.id }, data: { motivo: "Alteração de fato histórico" } })).rejects.toThrow();
  await expect(prisma.ocorrenciaSegundaChamada.delete({ where: { id: ocorrencia.id } })).rejects.toThrow();
  await expect(prisma.$executeRaw`INSERT INTO "OcorrenciaSegundaChamada" (id,"reservaId","registradaPorId",status,"ocorridaEm",motivo,evidencia) SELECT 'segunda-ocorrencia-duplicada',"reservaId","registradaPorId",status,"ocorridaEm",motivo,evidencia FROM "OcorrenciaSegundaChamada" WHERE id=${ocorrencia.id}`).rejects.toThrow();
  await expect(prisma.reservaSegundaChamada.update({ where: { id: reservaId }, data: { status: "RESERVADA" } })).rejects.toThrow();
  expect(await prisma.ocorrenciaSegundaChamada.findUniqueOrThrow({ where: { id: ocorrencia.id } })).toEqual(ocorrencia);
});


it("banco exige realizador, intervalo e evidência corretos antes de consumir a segunda chamada", async () => {
  const reservaId = await reservarRealizavel("guard-realizacao-segunda");
  const agenda = await prisma.agendaSegundaChamada.findUniqueOrThrow({ where: { reservaId } });
  await expect(prisma.encontroAgenda.update({ where: { id: agenda.encontroId }, data: { status: "MINISTRADO" } })).rejects.toThrow();
  const estranho = (await criarUsuario(["PROFESSOR"])).id;
  for (const caso of ["PROFESSOR", "AUTOR", "FUTURO", "ANTES", "EVIDENCIA"] as const) {
    await expect(prisma.$transaction(async tx => {
      await tx.$executeRaw`UPDATE "ReservaSegundaChamada" SET status='CONSUMIDA_REALIZACAO' WHERE id=${reservaId}`;
      await tx.$executeRaw`INSERT INTO "RealizacaoSegundaChamada" (id,"reservaId","professorId","registradaPorId","realizadaEm",evidencia)
        VALUES (${`realizacao-sql-${caso}`},${reservaId},${caso === "PROFESSOR" ? estranho : professor},${caso === "AUTOR" ? estranho : professor},
        (clock_timestamp() AT TIME ZONE 'UTC') + CASE WHEN ${caso === "FUTURO"} THEN interval '1 day' WHEN ${caso === "ANTES"} THEN interval '-1 day' ELSE interval '0 seconds' END,
        ${caso === "EVIDENCIA" ? "" : "Evidência real da avaliação realizada"})`;
    })).rejects.toThrow();
    expect(await prisma.reservaSegundaChamada.findUniqueOrThrow({ where: { id: reservaId } })).toMatchObject({ status: "RESERVADA" });
    expect(await prisma.realizacaoSegundaChamada.count()).toBe(0);
  }
  entrar(professor);
  const realizada = await registrarRealizacaoSegundaChamada({ reservaId, realizadaEm: new Date().toISOString(), evidencia: "Avaliação aplicada no encontro pelo docente autorizado" });
  if (!realizada.ok || !realizada.dado) throw new Error(JSON.stringify(realizada));
  const fonte = await prisma.realizacaoSegundaChamada.findUniqueOrThrow({ where: { id: realizada.dado.id } });
  expect(Math.abs(Date.now() - fonte.criadaEm.getTime())).toBeLessThan(10_000);
  const encontro = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: agenda.encontroId } });
  expect(encontro.status).toBe("MINISTRADO");
  await expect(prisma.agendaSegundaChamada.delete({ where: { id: agenda.id } })).rejects.toThrow();
  await expect(prisma.agendaSegundaChamada.update({ where: { id: agenda.id }, data: { agendadaPorId: administrador } })).rejects.toThrow();
  for (const data of [{ status: "PREVISTO" as const }, { status: "CANCELADO" as const }, { professorId: estranho }, { inicio: new Date(encontro.inicio.getTime() - 60000) }]) {
    await expect(prisma.encontroAgenda.update({ where: { id: encontro.id }, data })).rejects.toThrow();
  }
  await expect(prisma.encontroAgenda.delete({ where: { id: encontro.id } })).rejects.toThrow();
  expect(await prisma.aulaDiario.count()).toBe(0);
  expect(await prisma.cobranca.count()).toBe(0);
  expect(await prisma.registroAvaliacaoMatricula.count()).toBe(0);
  await expect(prisma.realizacaoSegundaChamada.update({ where: { id: fonte.id }, data: { professorId: estranho } })).rejects.toThrow();
  await expect(prisma.realizacaoSegundaChamada.delete({ where: { id: fonte.id } })).rejects.toThrow();
  expect(await prisma.realizacaoSegundaChamada.findUniqueOrThrow({ where: { id: fonte.id } })).toEqual(fonte);
});


it("reenvia disponibilização idêntica sem duplicar prazo ou evento e rejeita mudanças", async () => {
  const criada = await proporSegundaChamada(proposta());
  if (!criada.ok || !criada.dado) throw new Error(JSON.stringify(criada));
  const fonte = await prisma.propostaSegundaChamada.findUniqueOrThrow({ where: { id: criada.dado.id } });
  entrar(gestor);
  expect(await decidirSegundaChamada({ propostaId: fonte.id, propostaHash: fonte.entradaHash, aprovada: true, motivo: "Conferência real das condições de avaliação" })).toMatchObject({ ok: true });
  const dados = { propostaId: fonte.id, propostaHash: fonte.entradaHash, disponibilizadaEm: new Date().toISOString(), condicoes: "Professor e material disponíveis para a avaliação", evidenciaComunicacao: "Comunicação ao aluno registrada pela equipe" };
  const resultado = await disponibilizarSegundaChamada(dados);
  expect(resultado).toMatchObject({ ok: true });
  expect(await disponibilizarSegundaChamada(dados)).toEqual(resultado);
  expect(await disponibilizarSegundaChamada({ ...dados, condicoes: "Condições alteradas após disponibilizar" })).toMatchObject({ ok: false });
  expect(await disponibilizarSegundaChamada({ ...dados, evidenciaComunicacao: "Outra comunicação posterior registrada" })).toMatchObject({ ok: false });
  expect(await disponibilizarSegundaChamada({ ...dados, disponibilizadaEm: new Date(new Date(dados.disponibilizadaEm).getTime() - 1).toISOString() })).toMatchObject({ ok: false });
  entrar(administrador);
  expect(await disponibilizarSegundaChamada(dados)).toMatchObject({ ok: false });
  entrar(gestor);
  await prisma.usuario.update({ where: { id: gestor }, data: { ativo: false } });
  expect(await disponibilizarSegundaChamada(dados)).toMatchObject({ ok: false });
  expect(await prisma.disponibilizacaoSegundaChamada.count({ where: { propostaId: fonte.id } })).toBe(1);
  expect(await prisma.evento.count({ where: { tipo: "SegundaChamadaDisponibilizada", agregadoId: matriculaId } })).toBe(1);
});


it("cancelamento pela escola exige aprovação independente e aplica agenda e oportunidade juntas", async () => {
  const reservaId = await reservarRealizavel("cancelamento-escola-aprovado");
  const { consultarCancelamentosAgendaSegundaChamada, proporCancelamentoAgendaSegundaChamada, decidirCancelamentoAgendaSegundaChamada } = await import("./segunda-chamada-cancelamento");
  const { registrarOcorrenciaSegundaChamada } = await import("./segunda-chamada-ocorrencia");
  entrar(gestor);
  const consulta = await consultarCancelamentosAgendaSegundaChamada({ reservaId });
  if (!consulta.ok || !consulta.dado) throw new Error(JSON.stringify(consulta));
  const dados = { reservaId, estadoConferido: consulta.dado.estadoConferido, ocorridaEm: new Date().toISOString(), motivo: "Escola não poderá aplicar este encontro", evidencia: "Ocorrência conferida pela gestão da escola", chaveIdempotencia: "cancelamento-escola-proposta" };
  expect(await registrarOcorrenciaSegundaChamada({ reservaId, tipo: "CANCELAMENTO_ESCOLA", ocorridaEm: dados.ocorridaEm, motivo: dados.motivo, evidencia: dados.evidencia })).toMatchObject({ ok: false });
  const criada = await proporCancelamentoAgendaSegundaChamada(dados);
  if (!criada.ok || !criada.dado) throw new Error(JSON.stringify(criada));
  expect(await proporCancelamentoAgendaSegundaChamada(dados)).toEqual(criada);
  const [fonte] = await prisma.$queryRaw<{ id: string; entradaHash: string }[]>`SELECT id,"entradaHash" FROM "PropostaCancelamentoAgendaSegundaChamada" WHERE id=${criada.dado.id}`;
  const decisao = { propostaId: fonte.id, propostaHash: fonte.entradaHash, aprovada: true, motivo: "Cancelamento conferido por outra pessoa" };
  expect(await decidirCancelamentoAgendaSegundaChamada(decisao)).toMatchObject({ ok: false });
  const agenda = await prisma.agendaSegundaChamada.findUniqueOrThrow({ where: { reservaId } });
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: agenda.encontroId } })).toMatchObject({ status: "PREVISTO" });
  entrar(administrador);
  const aprovada = await decidirCancelamentoAgendaSegundaChamada(decisao);
  expect(aprovada).toMatchObject({ ok: true });
  expect(await decidirCancelamentoAgendaSegundaChamada(decisao)).toEqual(aprovada);
  await expect(prisma.$executeRaw`UPDATE "PropostaCancelamentoAgendaSegundaChamada" SET motivo='Alteração sem revisão' WHERE id=${fonte.id}`).rejects.toThrow();
  await expect(prisma.$executeRaw`DELETE FROM "DecisaoCancelamentoAgendaSegundaChamada" WHERE "propostaId"=${fonte.id}`).rejects.toThrow();
  expect(await prisma.evento.count({ where: { tipo: "CancelamentoAgendaSegundaChamadaAprovado", agregadoId: matriculaId } })).toBe(1);
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: agenda.encontroId } })).toMatchObject({ status: "CANCELADO" });
  expect(await prisma.reservaSegundaChamada.findUniqueOrThrow({ where: { id: reservaId } })).toMatchObject({ status: "LIBERADA_CANCELAMENTO_ESCOLA" });
  expect(await prisma.ocorrenciaSegundaChamada.count({ where: { reservaId } })).toBe(1);
  await expect(prisma.agendaSegundaChamada.delete({ where: { id: agenda.id } })).rejects.toThrow();
  await expect(prisma.encontroAgenda.update({ where: { id: agenda.encontroId }, data: { status: "PREVISTO" } })).rejects.toThrow();
  expect(await prisma.cobranca.count()).toBe(0);
  expect(await prisma.registroAvaliacaoMatricula.count()).toBe(0);
  expect(await prisma.$transaction(tx => estadoSegundaChamadaTx(tx, alocacaoId, "I1"))).toMatchObject({ reservasOcupadas: 0 });
  const historico = await consultarSegundasChamadas({ alocacaoId, codigoAvaliacao: "I1" });
  expect(historico).toMatchObject({ ok: true, dado: { itens: [{ reserva: { id: reservaId, status: "LIBERADA_CANCELAMENTO_ESCOLA" } }] } });
});


it("cancelamento recusa professor e mutação direta da agenda, exigindo decisão independente", async () => {
  const reservaId = await reservarRealizavel("cancelamento-escola-revisao");
  const { consultarCancelamentosAgendaSegundaChamada, proporCancelamentoAgendaSegundaChamada, decidirCancelamentoAgendaSegundaChamada } = await import("./segunda-chamada-cancelamento");
  entrar(professor);
  expect(await consultarCancelamentosAgendaSegundaChamada({ reservaId })).toMatchObject({ ok: false });
  entrar(gestor);
  const consulta = await consultarCancelamentosAgendaSegundaChamada({ reservaId });
  if (!consulta.ok || !consulta.dado) throw new Error(JSON.stringify(consulta));
  const criada = await proporCancelamentoAgendaSegundaChamada({ reservaId, estadoConferido: consulta.dado.estadoConferido, ocorridaEm: new Date().toISOString(), motivo: "Cancelamento proposto antes de mudar a agenda", evidencia: "Conferência da indisponibilidade da escola", chaveIdempotencia: "cancelamento-escola-desatualizado" });
  if (!criada.ok || !criada.dado) throw new Error(JSON.stringify(criada));
  await expect(prisma.$transaction(async tx => {
    await tx.$executeRaw`UPDATE "ReservaSegundaChamada" SET status='LIBERADA_CANCELAMENTO_ESCOLA' WHERE id=${reservaId}`;
    await tx.$executeRaw`INSERT INTO "OcorrenciaSegundaChamada" (id,"reservaId","registradaPorId",status,"ocorridaEm",motivo,evidencia) VALUES ('cancelamento-sem-aprovacao',${reservaId},${gestor},'LIBERADA_CANCELAMENTO_ESCOLA',clock_timestamp() AT TIME ZONE 'UTC','Sem decisão independente','Evidência insuficiente para dispensar decisão')`;
  })).rejects.toThrow();
  const agenda = await prisma.agendaSegundaChamada.findUniqueOrThrow({ where: { reservaId } });
  await expect(prisma.encontroAgenda.update({ where: { id: agenda.encontroId }, data: { status: "CANCELADO" } })).rejects.toThrow();
  // A agenda aprovada é imutável; um fato concorrente válido é uma remarcação já decidida.
  await expect(prisma.$executeRaw`UPDATE "EncontroAgenda" SET fim=fim+interval '1 minute' WHERE id=${agenda.encontroId}`).rejects.toThrow();
  const remarcacao = await import("./segunda-chamada-remarcacao");
  const conferenciaRemarcacao = await remarcacao.consultarRemarcacoesAgendaSegundaChamada({ reservaId });
  if (!conferenciaRemarcacao.ok || !conferenciaRemarcacao.dado) throw new Error(JSON.stringify(conferenciaRemarcacao));
  const inicioRemarcado = new Date(Date.now() + 2 * 60 * 60_000);
  const propostaRemarcacao = await remarcacao.proporRemarcacaoAgendaSegundaChamada({
    reservaId, estadoConferido: conferenciaRemarcacao.dado.estadoHash,
    inicio: inicioRemarcado.toISOString(), fim: new Date(inicioRemarcado.getTime() + 30 * 60_000).toISOString(),
    fusoOrigem: "UTC", motivo: "Horário revisto após a proposta de cancelamento.",
    evidencia: "Nova disponibilidade conferida antes da decisão.", chaveIdempotencia: "cancelamento-escola-remarcacao-concorrente",
  });
  if (!propostaRemarcacao.ok || !propostaRemarcacao.dado) throw new Error(JSON.stringify(propostaRemarcacao));
  entrar(administrador);
  const [remarcacaoPersistida] = await prisma.$queryRaw<{ entradaHash: string }[]>`
    SELECT "entradaHash" AS "entradaHash" FROM "PropostaRemarcacaoAgendaSegundaChamada" WHERE id=${propostaRemarcacao.dado.id}`;
  expect(await remarcacao.decidirRemarcacaoAgendaSegundaChamada({
    propostaId: propostaRemarcacao.dado.id, propostaHash: remarcacaoPersistida.entradaHash,
    aprovada: true, motivo: "Revisão independente do novo horário.",
  })).toMatchObject({ ok: true });
  const [fonte] = await prisma.$queryRaw<{ entradaHash: string }[]>`SELECT "entradaHash" FROM "PropostaCancelamentoAgendaSegundaChamada" WHERE id=${criada.dado.id}`;
  const decisao = { propostaId: criada.dado.id, propostaHash: fonte.entradaHash, aprovada: true, motivo: "Conferência de proposta anterior à alteração" };
  expect(await decidirCancelamentoAgendaSegundaChamada(decisao)).toMatchObject({ ok: false });
  expect(await decidirCancelamentoAgendaSegundaChamada({ ...decisao, aprovada: false, motivo: "Rejeitada após a remarcação válida" })).toMatchObject({ ok: true });
  expect(await prisma.reservaSegundaChamada.findUniqueOrThrow({ where: { id: reservaId } })).toMatchObject({ status: "RESERVADA" });
  expect(await prisma.ocorrenciaSegundaChamada.count()).toBe(0);
});


it("decisão SQL concorrente respeita bloqueio da reserva antes da proposta", async () => {
  const reservaId = await reservarRealizavel("cancelamento-concorrente-locks");
  const { consultarCancelamentosAgendaSegundaChamada, proporCancelamentoAgendaSegundaChamada } = await import("./segunda-chamada-cancelamento");
  entrar(gestor);
  const consulta = await consultarCancelamentosAgendaSegundaChamada({ reservaId });
  if (!consulta.ok || !consulta.dado) throw new Error(JSON.stringify(consulta));
  const proposta = await proporCancelamentoAgendaSegundaChamada({ reservaId, estadoConferido: consulta.dado.estadoConferido, ocorridaEm: new Date().toISOString(), motivo: "Cancelamento para teste de decisão concorrente", evidencia: "Condições conferidas para cancelar o encontro", chaveIdempotencia: "cancelamento-locks-proposta" });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  const propostaId = proposta.dado.id;
  let liberarReserva!: () => void, iniciarDecisao!: () => void;
  const reservaBloqueada = new Promise<void>(resolve => { liberarReserva = resolve; });
  const decisaoIniciada = new Promise<void>(resolve => { iniciarDecisao = resolve; });
  const revisao = prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "ReservaSegundaChamada" WHERE id=${reservaId} FOR UPDATE`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola',0))`;
    liberarReserva();
    await decisaoIniciada;
    await new Promise(resolve => setTimeout(resolve, 150));
    await tx.$queryRaw`SELECT id FROM "PropostaCancelamentoAgendaSegundaChamada" WHERE id=${propostaId} FOR UPDATE`;
  }, { timeout: 10000 });
  const decisao = prisma.$transaction(async tx => {
    await reservaBloqueada;
    iniciarDecisao();
    await tx.$executeRaw`INSERT INTO "DecisaoCancelamentoAgendaSegundaChamada" (id,"propostaId","decisorId",aprovada,motivo) VALUES ('decisao-concorrente-cancelamento',${propostaId},${administrador},true,'Aprovação independente concorrente')`;
  }, { timeout: 10000 });
  expect((await Promise.allSettled([revisao, decisao])).map(r => r.status)).toEqual(["fulfilled", "fulfilled"]);
  expect(await prisma.reservaSegundaChamada.findUniqueOrThrow({ where: { id: reservaId } })).toMatchObject({ status: "LIBERADA_CANCELAMENTO_ESCOLA" });
  expect(await prisma.ocorrenciaSegundaChamada.count({ where: { reservaId } })).toBe(1);
});


it.each([
  [-1, "LIBERADA_CANCELAMENTO_TEMPESTIVO", 0],
  [0, "LIBERADA_CANCELAMENTO_TEMPESTIVO", 0],
  [1, "CONSUMIDA_CANCELAMENTO_TARDIO", 1],
] as const)("cancelamento do aluno usa instante original na fronteira de antecedência %i ms", async (desvio, esperado, ocupadas) => {
  const ocorridaEm = new Date(Date.now() + 2_000);
  const inicio = new Date(ocorridaEm.getTime() + regraAvaliacaoTeste().segundaChamada.antecedenciaCancelamentoMinutos * 60_000 - desvio);
  const fonteAgenda = await aprovarEDisponibilizar(`cancelamento-aluno-limite-${desvio}`);
  const aplicadaAgenda = await aprovarAgendaInicial(
    fonteAgenda, `cancelamento-aluno-limite-${desvio}-agenda`, professor, inicio, new Date(inicio.getTime() + 3_600_000),
  );
  const reservaId = aplicadaAgenda.reservaId!;
  const agenda = await prisma.agendaSegundaChamada.findUniqueOrThrow({ where: { reservaId } });
  await new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ocorridaEm.getTime() - Date.now() + 50)));
  const { consultarCancelamentosAgendaSegundaChamada, proporCancelamentoAgendaSegundaChamada, decidirCancelamentoAgendaSegundaChamada } = await import("./segunda-chamada-cancelamento");
  const { registrarOcorrenciaSegundaChamada } = await import("./segunda-chamada-ocorrencia");
  entrar(gestor);
  const consulta = await consultarCancelamentosAgendaSegundaChamada({ reservaId });
  if (!consulta.ok || !consulta.dado) throw new Error(JSON.stringify(consulta));
  await expect(prisma.$transaction(async tx => {
    await tx.$executeRaw`UPDATE "ReservaSegundaChamada" SET status=${esperado}::"StatusReservaSegundaChamada" WHERE id=${reservaId}`;
    await tx.$executeRaw`INSERT INTO "OcorrenciaSegundaChamada" (id,"reservaId","registradaPorId",status,"ocorridaEm",motivo,evidencia) VALUES (${`cancelamento-aluno-direto-${desvio}`},${reservaId},${gestor},${esperado}::"StatusReservaSegundaChamada",${instanteUtcSql(ocorridaEm)},'Tentativa sem decisão aprovada','Pedido sem proposta autorizada')`;
  })).rejects.toThrow();
  const dados = { reservaId, origem: "ALUNO" as const, ocorridaEm: ocorridaEm.toISOString(), estadoConferido: consulta.dado.estadoConferido, motivo: "Aluno solicitou cancelar esta avaliação", evidencia: "Pedido do aluno com instante conferido", chaveIdempotencia: `cancelamento-aluno-proposta-${desvio}` };
  expect(await registrarOcorrenciaSegundaChamada({ reservaId, tipo: "CANCELAMENTO_ALUNO", ocorridaEm: dados.ocorridaEm, motivo: dados.motivo, evidencia: dados.evidencia })).toMatchObject({ ok: false });
  const proposta = await proporCancelamentoAgendaSegundaChamada(dados);
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  expect(await proporCancelamentoAgendaSegundaChamada(dados)).toEqual(proposta);
  expect(await proporCancelamentoAgendaSegundaChamada({ ...dados, origem: "ESCOLA" })).toMatchObject({ ok: false });
  const [fonte] = await prisma.$queryRaw<{ entradaHash: string; origem: string }[]>`SELECT "entradaHash",origem FROM "PropostaCancelamentoAgendaSegundaChamada" WHERE id=${proposta.dado.id}`;
  expect(fonte.origem).toBe("ALUNO");
  expect(await prisma.reservaSegundaChamada.findUniqueOrThrow({ where: { id: reservaId } })).toMatchObject({ status: "RESERVADA" });
  await new Promise(resolve => setTimeout(resolve, 10));
  entrar(administrador);
  const decisao = { propostaId: proposta.dado.id, propostaHash: fonte.entradaHash, aprovada: true, motivo: "Pedido e horário conferidos independentemente" };
  expect(await decidirCancelamentoAgendaSegundaChamada(decisao)).toMatchObject({ ok: true });
  expect(await decidirCancelamentoAgendaSegundaChamada(decisao)).toMatchObject({ ok: true });
  expect(await prisma.reservaSegundaChamada.findUniqueOrThrow({ where: { id: reservaId } })).toMatchObject({ status: esperado });
  expect(await prisma.ocorrenciaSegundaChamada.findMany({ where: { reservaId } })).toMatchObject([{ status: esperado, ocorridaEm, propostaCancelamentoId: proposta.dado.id }]);
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: agenda.encontroId } })).toMatchObject({ status: "CANCELADO" });
  await expect(prisma.agendaSegundaChamada.delete({ where: { id: agenda.id } })).rejects.toThrow();
  await expect(prisma.encontroAgenda.update({ where: { id: agenda.encontroId }, data: { status: "PREVISTO" } })).rejects.toThrow();
  expect(await prisma.$transaction(tx => estadoSegundaChamadaTx(tx, alocacaoId, "I1"))).toMatchObject({ reservasOcupadas: ocupadas });
  expect(await prisma.cobranca.count()).toBe(0);
  expect(await prisma.registroAvaliacaoMatricula.count()).toBe(0);
});


it("falta encerra encontro como não realizado sem inventar nota, aula ou cobrança", async () => {
 const reservaId = await reservarRealizavel("falta-encontro-nao-realizado");
 const agenda = await prisma.agendaSegundaChamada.findUniqueOrThrow({ where: { reservaId } });
 await expect(prisma.$executeRaw`UPDATE "EncontroAgenda" SET status='NAO_REALIZADO' WHERE id=${agenda.encontroId}`).rejects.toThrow();
 await expect(prisma.$executeRaw`INSERT INTO "EncontroAgenda" (id,"turmaId","professorId","preparadorId",inicio,fim,"fusoOrigem",finalidade,status,motivo,"chaveIdempotencia","entradaHash") SELECT 'nao-realizado-sem-fonte',"turmaId","professorId","preparadorId",inicio,fim,"fusoOrigem",'AULA','NAO_REALIZADO','Tentativa de estado indevido','nao-realizado-sem-fonte','fixture' FROM "EncontroAgenda" WHERE id=${agenda.encontroId}`).rejects.toThrow();
 entrar(gestor);
 const { registrarOcorrenciaSegundaChamada } = await import("./segunda-chamada-ocorrencia");
 const dados = { reservaId, tipo: "FALTA" as const, ocorridaEm: new Date().toISOString(), motivo: "Aluno ausente na aplicação agendada", evidencia: "Conferência da ausência feita pela equipe" };
 const resultado = await registrarOcorrenciaSegundaChamada(dados);
 expect(resultado).toMatchObject({ ok: true });
 expect(await registrarOcorrenciaSegundaChamada(dados)).toEqual(resultado);
 expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: agenda.encontroId } })).toMatchObject({ status: "NAO_REALIZADO" });
 expect(await prisma.reservaSegundaChamada.findUniqueOrThrow({ where: { id: reservaId } })).toMatchObject({ status: "CONSUMIDA_FALTA" });
 await expect(prisma.agendaSegundaChamada.delete({ where: { id: agenda.id } })).rejects.toThrow();
 await expect(prisma.encontroAgenda.update({ where: { id: agenda.encontroId }, data: { status: "PREVISTO" } })).rejects.toThrow();
 await expect(prisma.encontroAgenda.delete({ where: { id: agenda.encontroId } })).rejects.toThrow();
 expect(await prisma.realizacaoSegundaChamada.count()).toBe(0);
 expect(await prisma.aulaDiario.count()).toBe(0);
 expect(await prisma.registroAvaliacaoMatricula.count()).toBe(0);
 expect(await prisma.cobranca.count()).toBe(0);
 expect(await prisma.$transaction(tx => estadoSegundaChamadaTx(tx, alocacaoId, "I1"))).toMatchObject({ reservasOcupadas: 1 });
});


it("não mantém uma lista de encontros avulsos: a proposta só cria agenda após decisão independente", async () => {
  const fonte = await aprovarEDisponibilizar("agenda-inicial-sem-encontro-avulso");
  const propostaAgenda = await proporEncontroInicialParaTeste({
    propostaId: fonte.id, propostaHash: fonte.entradaHash, professorId: professor,
    inicio: new Date(Date.now() + 10 * 60_000).toISOString(), fim: new Date(Date.now() + 40 * 60_000).toISOString(),
    fusoOrigem: "UTC", motivo: "Horário individual conferido para segunda chamada.", chaveIdempotencia: "agenda-inicial-sem-avulso",
  });
  expect(propostaAgenda).toMatchObject({ ok: true });
  expect(await prisma.encontroAgenda.count({ where: { finalidade: "SEGUNDA_CHAMADA" } })).toBe(0);
  if (!propostaAgenda.ok || !propostaAgenda.dado) throw new Error(JSON.stringify(propostaAgenda));
  const aplicada = await aprovarAgendaInicialParaTeste({
    propostaId: fonte.id, propostaHash: fonte.entradaHash, encontroId: propostaAgenda.dado.id,
    motivo: "Aprovação independente da única agenda proposta.",
  });
  expect(aplicada).toMatchObject({ ok: true, dado: { encontroId: expect.any(String), reservaId: expect.any(String) } });
});


it("impedimento escolar encerra encontro e libera oportunidade sem inventar nota, aula ou cobrança", async () => {
 const reservaId = await reservarRealizavel("impedimento-encontro-preservado");
 const agenda = await prisma.agendaSegundaChamada.findUniqueOrThrow({ where: { reservaId } });
 await expect(prisma.$executeRaw`UPDATE "EncontroAgenda" SET status='IMPEDIDO_ESCOLA' WHERE id=${agenda.encontroId}`).rejects.toThrow();
 await expect(prisma.$executeRaw`INSERT INTO "EncontroAgenda" (id,"turmaId","professorId","preparadorId",inicio,fim,"fusoOrigem",finalidade,status,motivo,"chaveIdempotencia","entradaHash") SELECT 'nao-realizado-sem-fonte',"turmaId","professorId","preparadorId",inicio,fim,"fusoOrigem",'AULA','IMPEDIDO_ESCOLA','Tentativa de estado indevido','nao-realizado-sem-fonte','fixture' FROM "EncontroAgenda" WHERE id=${agenda.encontroId}`).rejects.toThrow();
 entrar(gestor);
 const { registrarOcorrenciaSegundaChamada } = await import("./segunda-chamada-ocorrencia");
 const dados = { reservaId, tipo: "IMPEDIMENTO_ESCOLA" as const, ocorridaEm: new Date().toISOString(), motivo: "Escola impedida de oferecer aplicação agendada", evidencia: "Conferência do impedimento feita pela equipe" };
 const resultado = await registrarOcorrenciaSegundaChamada(dados);
 expect(resultado).toMatchObject({ ok: true });
 expect(await registrarOcorrenciaSegundaChamada(dados)).toEqual(resultado);
 expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: agenda.encontroId } })).toMatchObject({ status: "IMPEDIDO_ESCOLA" });
 expect(await prisma.reservaSegundaChamada.findUniqueOrThrow({ where: { id: reservaId } })).toMatchObject({ status: "PENDENCIA_ESCOLA" });
 await expect(prisma.agendaSegundaChamada.delete({ where: { id: agenda.id } })).rejects.toThrow();
 await expect(prisma.encontroAgenda.update({ where: { id: agenda.encontroId }, data: { status: "PREVISTO" } })).rejects.toThrow();
 await expect(prisma.encontroAgenda.delete({ where: { id: agenda.encontroId } })).rejects.toThrow();
 expect(await prisma.realizacaoSegundaChamada.count()).toBe(0);
 expect(await prisma.aulaDiario.count()).toBe(0);
 expect(await prisma.registroAvaliacaoMatricula.count()).toBe(0);
 expect(await prisma.cobranca.count()).toBe(0);
 expect(await prisma.$transaction(tx => estadoSegundaChamadaTx(tx, alocacaoId, "I1"))).toMatchObject({ reservasOcupadas: 0 });
});

it.each(["FALTA", "IMPEDIMENTO_ESCOLA"] as const)("serializa realização concorrente com %s sem perder o fato vencedor", async (tipo) => {
  const reservaId = await reservarRealizavel(`concorrencia-realizacao-${tipo}`);
  const agenda = await prisma.agendaSegundaChamada.findUniqueOrThrow({ where: { reservaId } });
  const { registrarOcorrenciaSegundaChamadaTx } = await import("./segunda-chamada-ocorrencia-tx");
  const quando = new Date();
  const resultados = await Promise.allSettled([
    prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "ReservaSegundaChamada" WHERE id=${reservaId} FOR UPDATE`;
      await tx.$executeRaw`UPDATE "ReservaSegundaChamada" SET status='CONSUMIDA_REALIZACAO' WHERE id=${reservaId}`;
      await tx.$executeRaw`INSERT INTO "RealizacaoSegundaChamada" (id,"reservaId","professorId","registradaPorId","realizadaEm",evidencia) VALUES (${`realizacao-concorrente-${tipo}`},${reservaId},${professor},${professor},${instanteUtcSql(quando)},'Ata da avaliação conferida pelo professor')`;
    }),
    prisma.$transaction(tx => registrarOcorrenciaSegundaChamadaTx(tx, gestor, { reservaId, tipo, ocorridaEm: quando.toISOString(), motivo: "Ocorrência concorrente informada pela gestão", evidencia: "Protocolo institucional da ocorrência" })),
  ]);
  expect(resultados.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(resultados.filter(r => r.status === "rejected")).toHaveLength(1);
  const reserva = await prisma.reservaSegundaChamada.findUniqueOrThrow({ where: { id: reservaId } });
  const encontro = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: agenda.encontroId } });
  const realizadas = await prisma.realizacaoSegundaChamada.count({ where: { reservaId } });
  const ocorrencias = await prisma.ocorrenciaSegundaChamada.count({ where: { reservaId } });
  expect(realizadas + ocorrencias).toBe(1);
  if (realizadas) {
    expect(reserva.status).toBe("CONSUMIDA_REALIZACAO");
    expect(encontro.status).toBe("MINISTRADO");
  } else {
    expect(reserva.status).toBe(tipo === "FALTA" ? "CONSUMIDA_FALTA" : "PENDENCIA_ESCOLA");
    expect(encontro.status).toBe(tipo === "FALTA" ? "NAO_REALIZADO" : "IMPEDIDO_ESCOLA");
  }
  await expect(prisma.agendaSegundaChamada.delete({ where: { id: agenda.id } })).rejects.toThrow();
  expect(await prisma.registroAvaliacaoMatricula.count()).toBe(0);
  expect(await prisma.cobranca.count()).toBe(0);
});


it.each(["CRIAR", "AGENDAR", "DESIGNAR", "DECIDIR", "PRORROGAR"] as const)("%s não bloqueia a proposta antes da reserva/calendário em uso", async (operacao) => {
  const reservaId = await reservarRealizavel(`ordem-bloqueios-${operacao}`);
  const reserva = await prisma.reservaSegundaChamada.findUniqueOrThrow({ where: { id: reservaId }, include: { proposta: true, agenda: true } });
  const encontroInicial = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: reserva.agenda!.encontroId } });
  const agendaInicial = await prisma.propostaAgendaSegundaChamada.findUniqueOrThrow({ where: { id: encontroInicial.propostaAgendaSegundaChamadaId! } });
  const decisaoInicial = await prisma.decisaoAgendaSegundaChamada.findUniqueOrThrow({ where: { propostaId: agendaInicial.id } });
  let prorrogacao: { id: string; entradaHash: string } | null = null;
  if (operacao === "PRORROGAR") {
    entrar(gestor);
    const disponibilizacao = await prisma.disponibilizacaoSegundaChamada.findUniqueOrThrow({ where: { propostaId: reserva.propostaId } });
    const propostaPrazo = await proporProrrogacaoSegundaChamada({ disponibilizacaoId: disponibilizacao.id, prazoAnterior: disponibilizacao.prazoAte.toISOString(), novoPrazo: new Date(disponibilizacao.prazoAte.getTime() + 3600000).toISOString(), versaoEsperada: 0, motivo: "Prazo conferido para teste de bloqueios", chaveIdempotencia: "prazo-ordem-bloqueios" });
    if (!propostaPrazo.ok || !propostaPrazo.dado) throw new Error(JSON.stringify(propostaPrazo));
    prorrogacao = await prisma.propostaProrrogacaoSegundaChamada.findUniqueOrThrow({ where: { id: propostaPrazo.dado.id } });
  }
  let sinalizarBloqueio!: () => void;
  const bloqueado = new Promise<void>(resolve => { sinalizarBloqueio = resolve; });
  const leitor = prisma.$transaction(async tx => {
    const [sessao] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
    await tx.$queryRaw`SELECT id FROM "ReservaSegundaChamada" WHERE id=${reservaId} FOR UPDATE`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola',0))`;
    sinalizarBloqueio();
    let esperaConfirmada = false;
    let atividades: Array<{ pid: number; state: string; waitEventType: string | null; waitEvent: string | null; query: string; bloqueadores: number[] }> = [];
    for (let tentativa = 0; tentativa < 100; tentativa++) {
      atividades = await prisma.$queryRaw<typeof atividades>`
        SELECT a.pid,a.state,a.wait_event_type AS "waitEventType",a.wait_event AS "waitEvent",
          left(a.query, 240) AS query,pg_blocking_pids(a.pid) AS bloqueadores
        FROM pg_stat_activity a
        WHERE a.datname=current_database() AND a.pid<>${sessao.pid} AND a.pid<>pg_backend_pid()
      `;
      if (atividades.some((a) => a.bloqueadores.includes(sessao.pid))) { esperaConfirmada = true; break; }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    expect(esperaConfirmada, JSON.stringify(atividades)).toBe(true);
    // Mesma ordem do guard de realização: reserva, calendário, proposta.
    await tx.$queryRaw`SELECT id FROM "PropostaSegundaChamada" WHERE id=${reserva.propostaId} FOR SHARE`;
  }, { timeout: 10000 });
  await bloqueado;
  entrar(operacao === "PRORROGAR" || operacao === "AGENDAR" ? administrador : gestor);
  const inicio = new Date(Date.now() + 600_000);
  const operacaoPendente = operacao === "CRIAR"
    ? consultarPreviaAgendaInicialSegundaChamada({ propostaSegundaChamadaId: reserva.propostaId, professorId: professor, inicio: inicio.toISOString(), fim: new Date(inicio.getTime() + 60_000).toISOString(), fusoOrigem: "UTC" })
    : operacao === "DESIGNAR" ? designarProfessorSegundaChamada({ propostaId: reserva.propostaId, professorId: professor, inicio: new Date().toISOString(), motivo: "Designação conferida para teste concorrente", chaveIdempotencia: "designacao-ordem-bloqueios" })
    : operacao === "DECIDIR" ? decidirSegundaChamada({ propostaId: reserva.propostaId, propostaHash: reserva.proposta.entradaHash, aprovada: true, motivo: "Decisão independente de teste." })
    : operacao === "PRORROGAR" ? decidirProrrogacaoSegundaChamada({ propostaId: prorrogacao!.id, propostaHash: prorrogacao!.entradaHash, aprovada: true, motivo: "Decisão independente de prazo concorrente" })
    : decidirAgendaInicialSegundaChamada({ propostaId: agendaInicial.id, propostaHash: agendaInicial.entradaHash, aprovada: true, motivo: decisaoInicial.motivo });
  const [conclusao, resultado] = await Promise.all([leitor, operacaoPendente]);
  expect(conclusao).toBeUndefined();
  if (operacao === "CRIAR") expect(resultado).toMatchObject({ ok: false, erro: expect.stringContaining("saldo") });
  else expect(resultado, JSON.stringify(resultado)).toMatchObject({ ok: true });
  expect(await prisma.reservaSegundaChamada.count({ where: { propostaId: reserva.propostaId } })).toBe(1);
});


it("histórico conserva impedimento anterior quando a mesma proposta ganha nova reserva", async () => {
  const antiga = await reservarRealizavel("historico-reserva-impedida");
  entrar(gestor);
  const { registrarOcorrenciaSegundaChamada } = await import("./segunda-chamada-ocorrencia");
  const motivo = "Professor indisponível por ocorrência institucional";
  const evidencia = "Protocolo conferido e preservado pela gestão";
  expect(await registrarOcorrenciaSegundaChamada({ reservaId: antiga, tipo: "IMPEDIMENTO_ESCOLA", ocorridaEm: new Date().toISOString(), motivo, evidencia })).toMatchObject({ ok: true });
  const reserva = await prisma.reservaSegundaChamada.findUniqueOrThrow({ where: { id: antiga }, include: { proposta: true } });
  const inicio = new Date(Date.now() + 600_000);
  const encontro = await proporEncontroInicialParaTeste({ propostaId: reserva.propostaId, propostaHash: reserva.proposta.entradaHash, professorId: professor, inicio: inicio.toISOString(), fim: new Date(inicio.getTime() + 60000).toISOString(), fusoOrigem: "UTC", motivo: "Nova oferta de segunda chamada disponível", chaveIdempotencia: "historico-nova-oferta" });
  if (!encontro.ok || !encontro.dado) throw new Error(JSON.stringify(encontro));
  const nova = await aprovarAgendaInicialParaTeste({ propostaId: reserva.propostaId, propostaHash: reserva.proposta.entradaHash, encontroId: encontro.dado.id, motivo: "Nova reserva após impedimento escolar" });
  if (!nova.ok || !nova.dado) throw new Error(JSON.stringify(nova));
  const historico = await consultarHistoricoReservasSegundaChamada({ alocacaoId, codigoAvaliacao: "I1" });
  expect(historico).toMatchObject({ ok: true, dado: { proximoId: null, itens: [
    { id: nova.dado.reservaId!, status: "RESERVADA", ocorrencia: null },
    { id: antiga, status: "PENDENCIA_ESCOLA", encontro: { status: "IMPEDIDO_ESCOLA" }, ocorrencia: { motivo, evidencia, registradaPor: (await prisma.usuario.findUniqueOrThrow({ where: { id: gestor } })).nome } },
  ] } });
  expect(await consultarHistoricoReservasSegundaChamada({ alocacaoId, codigoAvaliacao: "I1", antesId: nova.dado.reservaId! })).toMatchObject({ ok: true, dado: { itens: [{ id: antiga }] } });
  expect(await consultarHistoricoReservasSegundaChamada({ alocacaoId, codigoAvaliacao: "F1", antesId: antiga })).toMatchObject({ ok: false });
  entrar(professor);
  expect(await consultarHistoricoReservasSegundaChamada({ alocacaoId, codigoAvaliacao: "I1" })).toMatchObject({ ok: false });
  const vendedor = await criarUsuario(["VENDEDOR"]); entrar(vendedor.id);
  expect(await consultarHistoricoReservasSegundaChamada({ alocacaoId, codigoAvaliacao: "I1" })).toMatchObject({ ok: false });
  entrar(gestor); await prisma.usuario.update({ where: { id: gestor }, data: { ativo: false } });
  expect(await consultarHistoricoReservasSegundaChamada({ alocacaoId, codigoAvaliacao: "I1" })).toMatchObject({ ok: false });
});

it("histórico distingue realização de nota e preserva autoria e evidência", async () => {
  const reservaId = await reservarRealizavel("historico-realizacao");
  entrar(professor);
  const evidencia = "Ata da aplicação arquivada pela escola";
  const realizadaEm = new Date().toISOString();
  expect(await registrarRealizacaoSegundaChamada({ reservaId, realizadaEm, evidencia })).toMatchObject({ ok: true });
  entrar(administrador);
  const resultado = await consultarHistoricoReservasSegundaChamada({ alocacaoId, codigoAvaliacao: "I1" });
  expect(resultado).toMatchObject({ ok: true, dado: { itens: [{ id: reservaId, status: "CONSUMIDA_REALIZACAO", ocorrencia: null, encontro: { status: "MINISTRADO" }, realizacao: { realizadaEm, evidencia, professor: (await prisma.usuario.findUniqueOrThrow({ where: { id: professor } })).nome } }] } });
  expect(await prisma.registroAvaliacaoMatricula.count()).toBe(0);
});


async function reservarParaRemarcacao(chave: string, inicio = new Date(Date.now() + 60 * 60_000)) {
  const fonte = await aprovarEDisponibilizar(chave);
  const fim = new Date(inicio.getTime() + 30 * 60_000);
  const encontro = await proporEncontroInicialParaTeste({ propostaId: fonte.id, propostaHash: fonte.entradaHash,
    professorId: professor, inicio: inicio.toISOString(), fim: fim.toISOString(), fusoOrigem: "UTC",
    motivo: "Encontro futuro a ser remarcado", chaveIdempotencia: `${chave}-encontro` });
  if (!encontro.ok || !encontro.dado) throw new Error(JSON.stringify(encontro));
  const reserva = await aprovarAgendaInicialParaTeste({ propostaId: fonte.id, propostaHash: fonte.entradaHash,
    encontroId: encontro.dado.id, motivo: "Reserva da oportunidade original" });
  if (!reserva.ok || !reserva.dado || !reserva.dado.reservaId || !reserva.dado.encontroId || !reserva.dado.agendaId) throw new Error(JSON.stringify(reserva));
  return { ...reserva.dado, reservaId: reserva.dado.reservaId, encontroId: reserva.dado.encontroId, agendaId: reserva.dado.agendaId, inicio, fim };
}

async function proporRemarcacaoTeste(reservaId: string, chave: string) {
  const acoes = await import("./segunda-chamada-remarcacao");
  entrar(gestor);
  const consulta = await acoes.consultarRemarcacoesAgendaSegundaChamada({ reservaId });
  if (!consulta.ok || !consulta.dado) throw new Error(JSON.stringify(consulta));
  const inicio = new Date(Date.now() + 3 * 60 * 60_000), fim = new Date(inicio.getTime() + 30 * 60_000);
  const entrada = { reservaId, estadoConferido: consulta.dado.estadoHash, inicio: inicio.toISOString(),
    fim: fim.toISOString(), fusoOrigem: "UTC", motivo: "Alteração de horário solicitada pela escola",
    evidencia: "Comunicação institucional registrada", chaveIdempotencia: chave };
  const proposta = await acoes.proporRemarcacaoAgendaSegundaChamada(entrada);
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  const [persistida] = await prisma.$queryRaw<{ id: string; entradaHash: string }[]>`
    SELECT id,"entradaHash" AS "entradaHash" FROM "PropostaRemarcacaoAgendaSegundaChamada" WHERE id=${proposta.dado.id}`;
  return { acoes, entrada, proposta, persistida };
}

it("remarcação aplica agenda atomicamente sem duplicar oportunidade e conserva o encontro anterior", async () => {
  const reserva = await reservarParaRemarcacao("remarcacao-atomica");
  const secretaria = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  entrar(secretaria);
  const { acoes, entrada, proposta, persistida } = await proporRemarcacaoTeste(reserva.reservaId, "remarcacao-atomica-proposta");
  expect(await acoes.proporRemarcacaoAgendaSegundaChamada(entrada)).toEqual(proposta);
  expect(await acoes.proporRemarcacaoAgendaSegundaChamada({ ...entrada, motivo: "Outro conteúdo com mesma chave" })).toMatchObject({ ok: false });
  expect((await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: reserva.encontroId } })).status).toBe("PREVISTO");
  await prisma.usuario.update({ where: { id: secretaria }, data: { papeis: ["SECRETARIA_ACADEMICA", "GERENTE_PEDAGOGICO"] } });
  const decisao = { propostaId: persistida.id, propostaHash: persistida.entradaHash, aprovada: true, motivo: "Horário e condições conferidos pela gestão" };
  expect(await acoes.decidirRemarcacaoAgendaSegundaChamada(decisao)).toMatchObject({ ok: false });
  entrar(administrador);
  const aplicada = await acoes.decidirRemarcacaoAgendaSegundaChamada(decisao);
  expect(aplicada, JSON.stringify(aplicada)).toMatchObject({ ok: true });
  expect(await acoes.decidirRemarcacaoAgendaSegundaChamada(decisao)).toEqual(aplicada);
  const [agenda] = await prisma.$queryRaw<{ encontroId: string; status: string }[]>`
    SELECT a."encontroId" AS "encontroId", r.status::text AS status FROM "AgendaSegundaChamada" a
    JOIN "ReservaSegundaChamada" r ON r.id=a."reservaId" WHERE r.id=${reserva.reservaId}`;
  expect(agenda.status).toBe("RESERVADA");
  expect(agenda.encontroId).not.toBe(reserva.encontroId);
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: agenda.encontroId } })).toMatchObject({
    status: "PREVISTO", professorId: professor, matriculaId, inicio: new Date(entrada.inicio), fim: new Date(entrada.fim),
  });
  expect((await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: reserva.encontroId } })).status).toBe("CANCELADO");
  expect(await prisma.$transaction(tx => estadoSegundaChamadaTx(tx, alocacaoId, "I1"))).toMatchObject({ reservasOcupadas: 1, saldo: 0 });
  expect(await prisma.registroAvaliacaoMatricula.count()).toBe(0);
  expect(await prisma.cobranca.count()).toBe(0);
  await expect(prisma.encontroAgenda.update({ where: { id: reserva.encontroId }, data: { status: "PREVISTO" } })).rejects.toThrow();
  await expect(prisma.encontroAgenda.delete({ where: { id: reserva.encontroId } })).rejects.toThrow();
  await expect(prisma.agendaSegundaChamada.update({ where: { reservaId: reserva.reservaId }, data: { encontroId: reserva.encontroId } })).rejects.toThrow();
});

it("remarcação revalida conflito surgido depois da proposta e não persiste aprovação parcial", async () => {
  const reserva = await reservarParaRemarcacao("remarcacao-conflito");
  const { acoes, entrada, persistida } = await proporRemarcacaoTeste(reserva.reservaId, "remarcacao-conflito-proposta");
  await prisma.encontroAgenda.create({ data: { turmaId, professorId: professor, preparadorId: gestor,
    inicio: new Date(entrada.inicio), fim: new Date(entrada.fim), fusoOrigem: "UTC", status: "PREVISTO",
    motivo: "Compromisso surgido após a proposta", chaveIdempotencia: "conflito-remarcacao", entradaHash: "fixture" } });
  entrar(administrador);
  expect(await acoes.decidirRemarcacaoAgendaSegundaChamada({ propostaId: persistida.id,
    propostaHash: persistida.entradaHash, aprovada: true, motivo: "Tentativa de aprovar após conflito" })).toMatchObject({ ok: false });
  const [contagem] = await prisma.$queryRaw<{ total: bigint }[]>`SELECT count(*) AS total FROM "DecisaoRemarcacaoAgendaSegundaChamada"`;
  expect(contagem.total).toBe(0n);
  const [agenda] = await prisma.$queryRaw<{ encontroId: string }[]>`SELECT "encontroId" AS "encontroId" FROM "AgendaSegundaChamada" WHERE "reservaId"=${reserva.reservaId}`;
  expect(agenda.encontroId).toBe(reserva.encontroId);
});


it("remarcação recusa proposta desatualizada e permite rejeição sem modificar o horário", async () => {
  const reserva = await reservarParaRemarcacao("remarcacao-versao");
  const primeira = await proporRemarcacaoTeste(reserva.reservaId, "remarcacao-versao-primeira");
  const segunda = await proporRemarcacaoTeste(reserva.reservaId, "remarcacao-versao-segunda");
  entrar(administrador);
  expect(await primeira.acoes.decidirRemarcacaoAgendaSegundaChamada({ propostaId: primeira.persistida.id,
    propostaHash: primeira.persistida.entradaHash, aprovada: true, motivo: "Aprovação independente da primeira proposta" })).toMatchObject({ ok: true });
  const [agenda] = await prisma.$queryRaw<{ encontroId: string }[]>`SELECT "encontroId" AS "encontroId" FROM "AgendaSegundaChamada" WHERE "reservaId"=${reserva.reservaId}`;
  expect(await segunda.acoes.decidirRemarcacaoAgendaSegundaChamada({ propostaId: segunda.persistida.id,
    propostaHash: segunda.persistida.entradaHash, aprovada: true, motivo: "Tentativa de aprovar estado anterior" })).toMatchObject({ ok: false });
  expect(await segunda.acoes.decidirRemarcacaoAgendaSegundaChamada({ propostaId: segunda.persistida.id,
    propostaHash: segunda.persistida.entradaHash, aprovada: false, motivo: "Proposta rejeitada porque o estado mudou" })).toMatchObject({ ok: true });
  const [final] = await prisma.$queryRaw<{ encontroId: string }[]>`SELECT "encontroId" AS "encontroId" FROM "AgendaSegundaChamada" WHERE "reservaId"=${reserva.reservaId}`;
  expect(final.encontroId).toBe(agenda.encontroId);
});

it("remarcação restringe consulta e proposta a equipe autorizada e recusa prazo excedido", async () => {
  const reserva = await reservarParaRemarcacao("remarcacao-permissoes");
  const { acoes, entrada } = await proporRemarcacaoTeste(reserva.reservaId, "remarcacao-permissoes-proposta");
  entrar(professor);
  expect(await acoes.consultarRemarcacoesAgendaSegundaChamada({ reservaId: reserva.reservaId })).toMatchObject({ ok: false });
  expect(await acoes.proporRemarcacaoAgendaSegundaChamada({ ...entrada, chaveIdempotencia: "remarcacao-professor-negada" })).toMatchObject({ ok: false });
  entrar(gestor);
  const inicio = new Date(Date.now() + 7 * 86_400_000), fim = new Date(inicio.getTime() + 30 * 60_000);
  expect(await acoes.proporRemarcacaoAgendaSegundaChamada({ ...entrada, inicio: inicio.toISOString(), fim: fim.toISOString(),
    chaveIdempotencia: "remarcacao-prazo-negada" })).toMatchObject({ ok: false });
  expect((await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: reserva.encontroId } })).inicio).toEqual(reserva.inicio);
});


it("remarcação concorrente com realização conserva somente o resultado válido", async () => {
  const inicio = new Date(Date.now() + 1_200);
  const reserva = await reservarParaRemarcacao("remarcacao-concorrente-realizacao", inicio);
  await new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, inicio.getTime() - Date.now() + 200)));
  const { acoes, persistida } = await proporRemarcacaoTeste(reserva.reservaId, "remarcacao-concorrente-proposta");
  entrar(administrador);
  const quando = new Date();
  const [realizacao, remarcacao] = await Promise.allSettled([
    prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "ReservaSegundaChamada" WHERE id=${reserva.reservaId} FOR UPDATE`;
      await tx.$executeRaw`UPDATE "ReservaSegundaChamada" SET status='CONSUMIDA_REALIZACAO' WHERE id=${reserva.reservaId}`;
      await tx.$executeRaw`INSERT INTO "RealizacaoSegundaChamada" (id,"reservaId","professorId","registradaPorId","realizadaEm",evidencia) VALUES ('realizacao-concorrente-remarcacao',${reserva.reservaId},${professor},${professor},${instanteUtcSql(quando)},'Aplicação presencial confirmada pelo docente')`;
    }),
    acoes.decidirRemarcacaoAgendaSegundaChamada({ propostaId: persistida.id, propostaHash: persistida.entradaHash,
      aprovada: true, motivo: "Remarcação concorrente com realização docente" }),
  ]);
  const ganhouRealizacao = realizacao.status === "fulfilled";
  const ganhouRemarcacao = remarcacao.status === "fulfilled" && remarcacao.value.ok;
  expect(Number(ganhouRealizacao) + Number(ganhouRemarcacao)).toBe(1);
  const atual = await prisma.reservaSegundaChamada.findUniqueOrThrow({ where: { id: reserva.reservaId } });
  const agenda = await prisma.agendaSegundaChamada.findUniqueOrThrow({ where: { reservaId: reserva.reservaId } });
  expect(atual.status).toBe(ganhouRealizacao ? "CONSUMIDA_REALIZACAO" : "RESERVADA");
  expect(await prisma.realizacaoSegundaChamada.count()).toBe(ganhouRealizacao ? 1 : 0);
  const [decisoes] = await prisma.$queryRaw<{ total: bigint }[]>`SELECT count(*) AS total FROM "DecisaoRemarcacaoAgendaSegundaChamada" WHERE aprovada`;
  expect(decisoes.total).toBe(ganhouRemarcacao ? 1n : 0n);
  if (ganhouRealizacao) expect(agenda.encontroId).toBe(reserva.encontroId);
  else expect(agenda.encontroId).not.toBe(reserva.encontroId);
  expect(await prisma.$transaction(tx => estadoSegundaChamadaTx(tx, alocacaoId, "I1"))).toMatchObject({ reservasOcupadas: 1 });
});


it("pagina todo o histórico de remarcação sem perder propostas quando chegam novas versões", async () => {
  const reserva = await reservarParaRemarcacao("remarcacao-paginacao");
  const { acoes, entrada, persistida } = await proporRemarcacaoTeste(reserva.reservaId, "remarcacao-paginacao-1");
  for (let i = 2; i <= 21; i++) {
    expect(await acoes.proporRemarcacaoAgendaSegundaChamada({ ...entrada,
      chaveIdempotencia: `remarcacao-paginacao-${i}` })).toMatchObject({ ok: true, dado: { versao: i } });
  }
  const primeira = await acoes.consultarRemarcacoesAgendaSegundaChamada({ reservaId: reserva.reservaId });
  if (!primeira.ok || !primeira.dado) throw new Error(JSON.stringify(primeira));
  expect(primeira.dado.itens.map(p => p.versao)).toEqual(Array.from({ length: 20 }, (_, i) => 21 - i));
  expect(primeira.dado.proximoId).toBe(primeira.dado.itens[19].id);
  expect(await acoes.proporRemarcacaoAgendaSegundaChamada({ ...entrada,
    chaveIdempotencia: "remarcacao-paginacao-22" })).toMatchObject({ ok: true });
  const segunda = await acoes.consultarRemarcacoesAgendaSegundaChamada({ reservaId: reserva.reservaId,
    antesId: primeira.dado.proximoId! });
  expect(segunda).toMatchObject({ ok: true, dado: { proximoId: null, itens: [{ id: persistida.id, versao: 1 }] } });
  if (!segunda.ok || !segunda.dado) throw new Error(JSON.stringify(segunda));
  expect(segunda.dado.itens).toHaveLength(1);
  expect(await acoes.consultarRemarcacoesAgendaSegundaChamada({ reservaId: reserva.reservaId,
    antesId: "cursor-inexistente" })).toMatchObject({ ok: false });
}, 60_000);


it("remarcação em dia não letivo exige justificativa e autorização específica independente", async () => {
  const reserva = await reservarParaRemarcacao("remarcacao-excecao-calendario");
  const { acoes, entrada } = await proporRemarcacaoTeste(reserva.reservaId, "remarcacao-antes-feriado");
  const dia = entrada.inicio.slice(0, 10);
  const calendario = await prisma.versaoCalendarioEscolar.create({ data: {
    versao: 2, preparadorId: gestor, fusoInstitucional: "UTC",
    periodos: [{ id: "feriado-escola", nome: "Feriado institucional de teste", tipo: "FERIADO", inicio: dia, fim: dia },
      { id: "a-recesso", nome: "Recesso coincidente de teste", tipo: "RECESSO", inicio: dia, fim: dia }],
    motivo: "Publicação de dia não letivo", chaveIdempotencia: "calendario-feriado-remarcacao", entradaHash: "fixture",
    decisao: { create: { decisorId: administrador, aprovada: true, motivo: "Calendário conferido independentemente" } },
  } });
  entrar(gestor);
  expect(await acoes.proporRemarcacaoAgendaSegundaChamada({ ...entrada, chaveIdempotencia: "remarcacao-feriado-sem-motivo" })).toMatchObject({ ok: false });
  const proposta = await acoes.proporRemarcacaoAgendaSegundaChamada({ ...entrada,
    motivoExcecaoNaoLetiva: "Aluno e professor disponíveis excepcionalmente no feriado",
    chaveIdempotencia: "remarcacao-feriado-justificada" });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  const [fonte] = await prisma.$queryRaw<{ entradaHash: string }[]>`SELECT "entradaHash" AS "entradaHash" FROM "PropostaRemarcacaoAgendaSegundaChamada" WHERE id=${proposta.dado.id}`;
  entrar(administrador);
  const decisao = { propostaId: proposta.dado.id, propostaHash: fonte.entradaHash, aprovada: true,
    motivo: "Exceção específica conferida pela gestão" };
  expect(await acoes.decidirRemarcacaoAgendaSegundaChamada(decisao)).toMatchObject({ ok: false });
  await expect(prisma.$executeRaw`INSERT INTO "DecisaoRemarcacaoAgendaSegundaChamada" (id,"propostaId","decisorId",aprovada,motivo) VALUES ('sem-excecao-explicita',${proposta.dado.id},${administrador},true,'Tentativa direta sem autorizar exceção')`).rejects.toThrow();
  await expect(prisma.$executeRaw`UPDATE "PropostaRemarcacaoAgendaSegundaChamada" SET "motivoExcecaoNaoLetiva"='Justificativa substituída indevidamente' WHERE id=${proposta.dado.id}`).rejects.toThrow();
  expect(await acoes.decidirRemarcacaoAgendaSegundaChamada({ ...decisao, autorizarDiaNaoLetivo: true })).toMatchObject({ ok: true });
  expect((await prisma.versaoCalendarioEscolar.findUniqueOrThrow({ where: { id: calendario.id } })).periodos).toEqual([
    { id: "feriado-escola", nome: "Feriado institucional de teste", tipo: "FERIADO", inicio: dia, fim: dia },
    { id: "a-recesso", nome: "Recesso coincidente de teste", tipo: "RECESSO", inicio: dia, fim: dia },
  ]);
  expect(await prisma.$transaction(tx => estadoSegundaChamadaTx(tx, alocacaoId, "I1"))).toMatchObject({ reservasOcupadas: 1 });
});

it("remarcação exige nova conferência quando muda a versão do calendário após a proposta", async () => {
  const reserva = await reservarParaRemarcacao("remarcacao-calendario-mudou");
  const { acoes, persistida } = await proporRemarcacaoTeste(reserva.reservaId, "remarcacao-calendario-conferido");
  await prisma.versaoCalendarioEscolar.create({ data: {
    versao: 2, preparadorId: gestor, fusoInstitucional: "UTC", periodos: [],
    motivo: "Nova referência institucional", chaveIdempotencia: "calendario-nova-versao-remarcacao", entradaHash: "fixture",
    decisao: { create: { decisorId: administrador, aprovada: true, motivo: "Nova versão conferida independentemente" } },
  } });
  entrar(administrador);
  expect(await acoes.decidirRemarcacaoAgendaSegundaChamada({ propostaId: persistida.id,
    propostaHash: persistida.entradaHash, aprovada: true, motivo: "Tentativa com calendário desatualizado" })).toMatchObject({ ok: false });
  expect((await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: reserva.encontroId } })).status).toBe("PREVISTO");
});


it("fila administrativa permite Secretaria localizar a reserva sem abrir notas ou financeiro", async () => {
  const reserva = await reservarParaRemarcacao("fila-secretaria-segunda");
  const { listarAgendasSegundaChamada } = await import("./segunda-chamada-agendas");
  const secretaria = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  entrar(secretaria);
  const r = await listarAgendasSegundaChamada({});
  expect(r).toMatchObject({ ok: true, dado: { proximoCursor: null,
    itens: [{ reservaId: reserva.reservaId, codigoAvaliacao: "I1", statusReserva: "RESERVADA" }] } });
  if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
  expect(Object.keys(r.dado.itens[0]).sort()).toEqual([
    "reservaId", "statusReserva", "codigoAvaliacao", "reservadaEm", "matricula", "aluno", "turma", "agenda",
  ].sort());
  expect(await listarAgendasSegundaChamada({ cursor: "inexistente" })).toMatchObject({ ok: false });
  entrar(professor);
  expect(await listarAgendasSegundaChamada({})).toMatchObject({ ok: false });
  await prisma.usuario.update({ where: { id: secretaria }, data: { ativo: false } });
  entrar(secretaria);
  expect(await listarAgendasSegundaChamada({})).toMatchObject({ ok: false });
});


it("agenda não recupera designação antiga quando a última não cobre o intervalo", async () => {
  const fonte = await aprovarEDisponibilizar("escopo-sem-fallback");
  const antigo = (await criarUsuario(["PROFESSOR"])).id;
  const atual = (await criarUsuario(["PROFESSOR"])).id;
  const inicio = new Date(Date.now() + 60 * 60_000), fim = new Date(inicio.getTime() + 30 * 60_000);
  expect(await designarProfessorSegundaChamada({ propostaId: fonte.id, professorId: antigo,
    inicio: new Date().toISOString(), motivo: "Primeira designação sem término definido",
    chaveIdempotencia: "escopo-antigo-sem-fim" })).toMatchObject({ ok: true });
  expect(await designarProfessorSegundaChamada({ propostaId: fonte.id, professorId: atual,
    inicio: new Date().toISOString(), fim: inicio.toISOString(), motivo: "Substituição termina antes do encontro",
    chaveIdempotencia: "escopo-atual-limitado" })).toMatchObject({ ok: true });
  for (const docente of [antigo, atual]) {
    expect(await proporEncontroInicialParaTeste({ propostaId: fonte.id, propostaHash: fonte.entradaHash,
      professorId: docente, inicio: inicio.toISOString(), fim: fim.toISOString(), fusoOrigem: "UTC",
      motivo: "Nenhuma designação cobre a agenda proposta", chaveIdempotencia: `sem-fallback-${docente}` })).toMatchObject({ ok: false });
  }
  expect(await prisma.encontroAgenda.count()).toBe(0);
});

it.each(["VINCULO", "DESIGNACAO"] as const)("escopo docente %s precisa cobrir todo encontro de segunda chamada", async (tipo) => {
  const fonte = await aprovarEDisponibilizar(`escopo-integral-${tipo}`);
  const inicio = new Date(Date.now() + 60 * 60_000), fim = new Date(inicio.getTime() + 30 * 60_000);
  const docente = tipo === "VINCULO" ? professor : (await criarUsuario(["PROFESSOR"])).id;
  if (tipo === "VINCULO") {
    await prisma.vinculoDocente.updateMany({ where: { turmaId, professorId: professor }, data: { fim } });
  } else {
    expect(await designarProfessorSegundaChamada({ propostaId: fonte.id, professorId: docente,
      inicio: new Date().toISOString(), fim: fim.toISOString(), motivo: "Designação limitada ao intervalo conferido",
      chaveIdempotencia: `designacao-integral-${tipo}` })).toMatchObject({ ok: true });
  }
  const dados = { propostaId: fonte.id, propostaHash: fonte.entradaHash, professorId: docente,
    inicio: inicio.toISOString(), fim: new Date(fim.getTime() + 1).toISOString(), fusoOrigem: "UTC",
    motivo: "Conferir cobertura integral da atribuição docente", chaveIdempotencia: `encontro-escopo-${tipo}` };
  expect(await proporEncontroInicialParaTeste(dados)).toMatchObject({ ok: false });
  const criado = await proporEncontroInicialParaTeste({ ...dados, fim: fim.toISOString() });
  if (!criado.ok || !criado.dado) throw new Error(JSON.stringify(criado));
  // Não existe encontro mutável entre proposta e decisão: a decisão aplica o intervalo conferido.
  expect(await aprovarAgendaInicialParaTeste({ propostaId: fonte.id, propostaHash: fonte.entradaHash,
    encontroId: criado.dado.id, motivo: "Reservar com fim exatamente no limite docente" })).toMatchObject({ ok: true });
  expect(await prisma.reservaSegundaChamada.count()).toBe(1);
});

it("segunda chamada exige que o término também caiba no prazo ao criar e ao agendar", async () => {
  const fonte = await aprovarEDisponibilizar("agenda-prazo-integral");
  const [disponivel] = await prisma.$queryRaw<{ prazoAte: Date }[]>`SELECT "prazoAte" AS "prazoAte" FROM "DisponibilizacaoSegundaChamada" WHERE "propostaId"=${fonte.id}`;
  const dados = { propostaId: fonte.id, propostaHash: fonte.entradaHash, professorId: professor,
    inicio: new Date(disponivel.prazoAte.getTime() - 5 * 60_000).toISOString(),
    fim: new Date(disponivel.prazoAte.getTime() + 5 * 60_000).toISOString(), fusoOrigem: "UTC",
    motivo: "Encontro atravessaria o prazo autorizado", chaveIdempotencia: "agenda-termino-fora-prazo" };
  expect(await proporEncontroInicialParaTeste(dados)).toMatchObject({ ok: false });
  expect(await prisma.encontroAgenda.count()).toBe(0);
  const criado = await proporEncontroInicialParaTeste({ ...dados, fim: disponivel.prazoAte.toISOString(),
    chaveIdempotencia: "agenda-termino-no-prazo" });
  if (!criado.ok || !criado.dado) throw new Error(JSON.stringify(criado));
  expect(await aprovarAgendaInicialParaTeste({ propostaId: fonte.id, propostaHash: fonte.entradaHash,
    encontroId: criado.dado.id, motivo: "Aprovar intervalo que termina exatamente no prazo" })).toMatchObject({ ok: true });
  expect(await prisma.reservaSegundaChamada.count()).toBe(1);
});

it("reenvio idêntico da criação de encontro não falha só porque o horário já passou", async () => {
  const fonte = await aprovarEDisponibilizar("agenda-reenvio-historico");
  const inicio = new Date(Date.now() + 60_000), fim = new Date(inicio.getTime() + 30 * 60_000);
  entrar(gestor);
  const previa = await consultarPreviaAgendaInicialSegundaChamada({
    propostaSegundaChamadaId: fonte.id, professorId: professor, inicio: inicio.toISOString(), fim: fim.toISOString(), fusoOrigem: "UTC",
  });
  if (!previa.ok || !previa.dado) throw new Error(JSON.stringify(previa));
  const dados = { propostaSegundaChamadaId: fonte.id, estadoConferido: previa.dado.estadoConferido, professorId: professor,
    inicio: inicio.toISOString(), fim: fim.toISOString(), fusoOrigem: "UTC",
    motivo: "Agenda para testar repetição histórica", evidencia: "Evidência institucional da agenda histórica", chaveIdempotencia: "agenda-reenvio-historico-encontro" };
  const criado = await proporAgendaInicialSegundaChamada(dados);
  expect(criado).toMatchObject({ ok: true });
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    vi.setSystemTime(new Date(fim.getTime() + 60_000));
    expect(await proporAgendaInicialSegundaChamada(dados)).toEqual(criado);
    expect(await proporAgendaInicialSegundaChamada({ ...dados, chaveIdempotencia: "agenda-passada-nova-chave" })).toMatchObject({ ok: false });
    expect(await proporAgendaInicialSegundaChamada({ ...dados, motivo: "Mesmo identificador com novo motivo" })).toMatchObject({ ok: false });
  } finally { vi.useRealTimers(); }
  expect(await prisma.encontroAgenda.count({ where: { finalidade: "SEGUNDA_CHAMADA" } })).toBe(0);
});


it("avaliação individual de outro aluno da mesma turma não bloqueia quem tem outro professor", async () => {
  const fonte = await aprovarEDisponibilizar("agenda-individual-isolada");
  const inicio = new Date(Date.now() + 60 * 60_000), fim = new Date(inicio.getTime() + 30 * 60_000);
  const origem = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const outroAluno = await prisma.aluno.create({ data: { primeiroNome: "Colega com avaliação individual", paisId: origem.paisId } });
  const outroContrato = await prisma.matricula.create({ data: { alunoId: outroAluno.id, produtoId: origem.produtoId,
    paisId: origem.paisId, moeda: origem.moeda, status: "ATIVA", ativadaEm: origem.ativadaEm } });
  const outroProfessor = (await criarUsuario(["PROFESSOR"])).id;
  const alocacaoOriginal = alocacaoId;
  alocacaoId = (await prisma.alocacaoTurma.create({ data: { alunoId: outroAluno.id, matriculaId: outroContrato.id,
    turmaId, criadoEm: new Date("2026-01-01T00:00:00Z") } })).id;
  let fonteOutro: { id: string; entradaHash: string };
  try { fonteOutro = await aprovarEDisponibilizar("colega-segunda-chamada-aprovada"); }
  finally { alocacaoId = alocacaoOriginal; }
  entrar(gestor);
  expect(await designarProfessorSegundaChamada({ propostaId: fonteOutro!.id, professorId: outroProfessor,
    inicio: new Date().toISOString(), motivo: "Professor da avaliação individual de outro aluno",
    chaveIdempotencia: "colega-individual-designacao" })).toMatchObject({ ok: true });
  await aprovarAgendaInicial(fonteOutro!, "colega-individual-agenda", outroProfessor, inicio, fim);
  const criado = await proporEncontroInicialParaTeste({ propostaId: fonte.id, propostaHash: fonte.entradaHash,
    professorId: professor, inicio: inicio.toISOString(), fim: fim.toISOString(), fusoOrigem: "UTC",
    motivo: "Avaliação sem conflito com colega", chaveIdempotencia: "individual-sem-conflito" });
  if (!criado.ok || !criado.dado) throw new Error(JSON.stringify(criado));
  expect(await aprovarAgendaInicialParaTeste({ propostaId: fonte.id, propostaHash: fonte.entradaHash,
    encontroId: criado.dado.id, motivo: "Reservar oportunidade individual sem conflito" })).toMatchObject({ ok: true });
});

it.each(["PROFESSOR", "ALUNO"] as const)("confere conflito de %s na criação e novamente na reserva da segunda chamada", async (tipo) => {
  const fonte = await aprovarEDisponibilizar(`agenda-conflito-${tipo}`);
  const inicio = new Date(Date.now() + 60 * 60_000), fim = new Date(inicio.getTime() + 30 * 60_000);
  const origem = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const alunoOutro = await prisma.aluno.create({ data: { primeiroNome: "Outro aluno do conflito", paisId: origem.paisId } });
  const contratoOutro = await prisma.matricula.create({ data: { alunoId: alunoOutro.id, produtoId: origem.produtoId,
    paisId: origem.paisId, moeda: origem.moeda, status: "ATIVA", ativadaEm: origem.ativadaEm } });
  const outroProfessor = (await criarUsuario(["PROFESSOR"])).id;
  const colisao = await prisma.encontroAgenda.create({ data: {
    ...(tipo === "PROFESSOR" ? { matriculaId: contratoOutro.id, professorId: professor } : { turmaId, professorId: outroProfessor }),
    preparadorId: gestor, inicio, fim, fusoOrigem: "UTC", status: "PREVISTO", motivo: "Outro compromisso confirmado",
    chaveIdempotencia: `colisao-${tipo}`, entradaHash: "fixture",
  } });
  const dados = { propostaId: fonte.id, propostaHash: fonte.entradaHash, professorId: professor,
    inicio: inicio.toISOString(), fim: fim.toISOString(), fusoOrigem: "UTC", motivo: "Segunda chamada com conferência de disponibilidade",
    chaveIdempotencia: `segunda-colisao-${tipo}` };
  expect(await proporEncontroInicialParaTeste(dados)).toMatchObject({ ok: false });
  await prisma.encontroAgenda.update({ where: { id: colisao.id }, data: {
    inicio: new Date(fim.getTime() + 60_000), fim: new Date(fim.getTime() + 31 * 60_000),
  } });
  const criado = await proporEncontroInicialParaTeste(dados);
  if (!criado.ok || !criado.dado) throw new Error(JSON.stringify(criado));
  await prisma.encontroAgenda.update({ where: { id: colisao.id }, data: { inicio, fim } });
  expect(await aprovarAgendaInicialParaTeste({ propostaId: fonte.id, propostaHash: fonte.entradaHash,
    encontroId: criado.dado.id, motivo: "Revalidar conflito surgido antes da reserva" })).toMatchObject({ ok: false });
  expect(await prisma.reservaSegundaChamada.count()).toBe(0);
});
