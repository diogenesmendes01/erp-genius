import { beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { consultarSubstituicaoAgendaSegundaChamada, proporSubstituicaoAgendaSegundaChamada,
  decidirSubstituicaoAgendaSegundaChamada } from "./segunda-chamada-substituicao";
import { registrarRealizacaoSegundaChamada } from "./segunda-chamada-realizacao";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import { decidirRegraAvaliacaoTx, prepararRegraAvaliacaoTx } from "./regras-tx";
import { decidirSegundaChamada, proporSegundaChamada } from "./segunda-chamada";
import { disponibilizarSegundaChamada } from "./segunda-chamada-disponibilizacao";
import { consultarPreviaAgendaInicialSegundaChamada, proporAgendaInicialSegundaChamada,
  decidirAgendaInicialSegundaChamada } from "./segunda-chamada-agenda-inicial";

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

async function aprovarEDisponibilizar(chave: string) {
  entrar(professor); const criada = await proporSegundaChamada(proposta(chave));
  if (!criada.ok || !criada.dado) throw new Error("proposta ausente");
  const [fonte] = await prisma.$queryRaw<{ id: string; entradaHash: string }[]>`SELECT id,"entradaHash" AS "entradaHash" FROM "PropostaSegundaChamada" WHERE id=${criada.dado.id}`;
  entrar(gestor); expect((await decidirSegundaChamada({ propostaId: fonte.id, propostaHash: fonte.entradaHash, aprovada: true, motivo: "Decisão independente de teste." })).ok).toBe(true);
  expect((await disponibilizarSegundaChamada({ propostaId: fonte.id, propostaHash: fonte.entradaHash, disponibilizadaEm: new Date().toISOString(), condicoes: "Condições oferecidas pela escola.", evidenciaComunicacao: "Comunicação registrada para o aluno." })).ok).toBe(true);
  return fonte;
}

async function prepararCalendario(naoLetivo = false, versao = 1) {
  await prisma.configuracaoOperacional.upsert({ where: { id: "escola" }, create: { id: "escola", fusoInstitucional: "UTC" }, update: {} });
  const dia = new Date(Date.now() + 60 * 60_000).toISOString().slice(0, 10);
  return prisma.versaoCalendarioEscolar.create({ data: {
    versao, preparadorId: gestor, fusoInstitucional: "UTC",
    periodos: naoLetivo ? [{ id: "feriado-teste", tipo: "FERIADO", nome: "Feriado institucional", inicio: dia, fim: dia }] : [],
    motivo: "Calendário aprovado para agenda inicial", chaveIdempotencia: `calendario-inicial-${versao}`, entradaHash: "fixture",
    decisao: { create: { decisorId: administrador, aprovada: true, motivo: "Conferência administrativa independente" } },
  } });
}

async function entradaAgenda(naoLetivo = false, inicioEm = new Date(Date.now() + 60 * 60_000)) {
  const fonte = await aprovarEDisponibilizar("fonte-agenda-inicial");
  await prepararCalendario(naoLetivo);
  const inicio = inicioEm, fim = new Date(inicio.getTime() + 30 * 60_000);
  const referencia = { propostaSegundaChamadaId: fonte.id, professorId: professor,
    inicio: inicio.toISOString(), fim: fim.toISOString(), fusoOrigem: "UTC" };
  const previa = await consultarPreviaAgendaInicialSegundaChamada(referencia);
  if (!previa.ok || !previa.dado) throw new Error(JSON.stringify(previa));
  return { ...referencia, estadoConferido: previa.dado.estadoConferido,
    motivo: "Novo horário para avaliação pendente", evidencia: "Horário conferido com o aluno",
    ...(naoLetivo ? { motivoExcecaoNaoLetiva: "Aluno disponível somente nesta data excepcional" } : {}),
    chaveIdempotencia: "proposta-agenda-inicial" };
}

async function propostaAgenda(naoLetivo = false, inicioEm?: Date) {
  const entrada = await entradaAgenda(naoLetivo, inicioEm);
  const resultado = await proporAgendaInicialSegundaChamada(entrada);
  if (!resultado.ok || !resultado.dado) throw new Error(JSON.stringify(resultado));
  return { entrada, ...resultado.dado };
}


async function agendaAplicada(naoLetivo = false, inicioEm?: Date) {
  const p = await propostaAgenda(naoLetivo, inicioEm);
  entrar(administrador);
  const aplicada = await decidirAgendaInicialSegundaChamada({ propostaId: p.id, propostaHash: p.entradaHash,
    aprovada: true, autorizarDiaNaoLetivo: naoLetivo, motivo: "Agenda inicial conferida para substituição" });
  if (!aplicada.ok || !aplicada.dado?.reservaId || !aplicada.dado.encontroId) throw new Error(JSON.stringify(aplicada));
  return { ...p, reservaId: aplicada.dado.reservaId, encontroId: aplicada.dado.encontroId };
}

async function prepararSubstituicao(reservaId: string, substitutoId: string, autorId = gestor, chave = "substituicao-docente-teste") {
  entrar(autorId);
  const consulta = await consultarSubstituicaoAgendaSegundaChamada({ reservaId, substitutoId });
  if (!consulta.ok || !consulta.dado?.previa) throw new Error(JSON.stringify(consulta));
  const entrada = { reservaId, substitutoId, estadoConferido: consulta.dado.previa.estadoConferido,
    motivo: "Substituição por indisponibilidade do responsável", evidencia: "Disponibilidade do novo professor conferida",
    chaveIdempotencia: chave };
  const proposta = await proporSubstituicaoAgendaSegundaChamada(entrada);
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  return { entrada, ...proposta.dado };
}
const decisaoSubstituicao = (p: { id: string; entradaHash: string }, aprovada = true) => ({
  propostaId: p.id, propostaHash: p.entradaHash, aprovada, motivo: "Revisão independente do professor substituto",
});

it("Secretaria prepara sem efeitos; outra gestão aplica somente o novo professor e a atribuição limitada", async () => {
  const agenda = await agendaAplicada();
  const substituto = (await criarUsuario(["PROFESSOR"])).id;
  const secretaria = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  const original = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: agenda.encontroId } });
  const reserva = await prisma.reservaSegundaChamada.findUniqueOrThrow({ where: { id: agenda.reservaId } });
  const p = await prepararSubstituicao(agenda.reservaId, substituto, secretaria);
  expect(await proporSubstituicaoAgendaSegundaChamada(p.entrada)).toMatchObject({ ok: true, dado: { id: p.id } });
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: agenda.encontroId } })).toEqual(original);
  expect(await prisma.designacaoSegundaChamada.count()).toBe(0);
  expect(await decidirSubstituicaoAgendaSegundaChamada(decisaoSubstituicao(p))).toMatchObject({ ok: false });
  entrar(administrador);
  const resultado = await decidirSubstituicaoAgendaSegundaChamada(decisaoSubstituicao(p));
  expect(resultado, JSON.stringify(resultado)).toMatchObject({ ok: true, dado: { aplicada: true } });
  expect(await decidirSubstituicaoAgendaSegundaChamada(decisaoSubstituicao(p))).toEqual(resultado);
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: agenda.encontroId } })).toEqual({ ...original, professorId: substituto });
  expect(await prisma.reservaSegundaChamada.findUniqueOrThrow({ where: { id: agenda.reservaId } })).toEqual(reserva);
  expect(await prisma.turma.findUniqueOrThrow({ where: { id: turmaId } })).toMatchObject({ professorId: professor });
  expect(await prisma.vinculoDocente.count({ where: { turmaId, professorId: substituto } })).toBe(0);
  expect(await prisma.designacaoSegundaChamada.findMany()).toMatchObject([{ professorId: substituto, propostaId: reserva.propostaId }]);
  expect(await prisma.$queryRaw`SELECT count(*)::int AS total FROM "AplicacaoSubstituicaoAgendaSegundaChamada"`).toEqual([{ total: 1 }]);
  expect(await prisma.registroAvaliacaoMatricula.count()).toBe(0);
  expect(await prisma.cobranca.count()).toBe(0);
  const historico = await consultarSubstituicaoAgendaSegundaChamada({ reservaId: agenda.reservaId });
  expect(historico).toMatchObject({ ok: true, dado: { itens: [{ snapshot: {
    inicio: original.inicio.toISOString(), fim: original.fim.toISOString(), fusoOrigem: "UTC",
  }, decisao: { aprovada: true, aplicada: true } }] } });
});

it("nega autoaprovação, professor, usuário desativado e alteração direta da cadeia", async () => {
  const agenda = await agendaAplicada();
  const substituto = (await criarUsuario(["PROFESSOR"])).id;
  const p = await prepararSubstituicao(agenda.reservaId, substituto);
  expect(await decidirSubstituicaoAgendaSegundaChamada(decisaoSubstituicao(p))).toMatchObject({ ok: false });
  entrar(substituto);
  expect(await consultarSubstituicaoAgendaSegundaChamada({ reservaId: agenda.reservaId })).toMatchObject({ ok: false });
  expect(await proporSubstituicaoAgendaSegundaChamada(p.entrada)).toMatchObject({ ok: false });
  await prisma.usuario.update({ where: { id: gestor }, data: { ativo: false } });
  entrar(gestor);
  expect(await proporSubstituicaoAgendaSegundaChamada({ ...p.entrada, chaveIdempotencia: "proposta-com-gestor-inativo" })).toMatchObject({ ok: false });
  await expect(prisma.$executeRaw`UPDATE "PropostaSubstituicaoAgendaSegundaChamada" SET motivo='Motivo adulterado' WHERE id=${p.id}`).rejects.toThrow();
  await expect(prisma.$executeRaw`INSERT INTO "DecisaoSubstituicaoAgendaSegundaChamada" (id,"propostaId","decisorId",aprovada,motivo) VALUES ('decisao-direta-propria',${p.id},${gestor},true,'Autoaprovação direta indevida')`).rejects.toThrow();
  await expect(prisma.encontroAgenda.update({ where: { id: agenda.encontroId }, data: { professorId: substituto } })).rejects.toThrow();
  expect(await prisma.designacaoSegundaChamada.count()).toBe(0);
});

it("conflito posterior à proposta impede aplicação, permite rejeição e preserva o responsável", async () => {
  const agenda = await agendaAplicada();
  const substituto = (await criarUsuario(["PROFESSOR"])).id;
  const p = await prepararSubstituicao(agenda.reservaId, substituto);
  await prisma.encontroAgenda.create({ data: { turmaId, professorId: substituto, preparadorId: gestor,
    inicio: new Date(agenda.entrada.inicio), fim: new Date(agenda.entrada.fim), fusoOrigem: "UTC", status: "PREVISTO",
    motivo: "Compromisso surgido depois da proposta", chaveIdempotencia: "colisao-substituto", entradaHash: "fixture" } });
  entrar(administrador);
  expect(await decidirSubstituicaoAgendaSegundaChamada(decisaoSubstituicao(p))).toMatchObject({ ok: false });
  expect(await prisma.designacaoSegundaChamada.count()).toBe(0);
  expect(await decidirSubstituicaoAgendaSegundaChamada(decisaoSubstituicao(p, false))).toMatchObject({ ok: true, dado: { aplicada: false } });
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: agenda.encontroId } })).toMatchObject({ professorId: professor, status: "PREVISTO" });
});

it("docente desativado depois da revisão impede inclusive aprovação SQL direta", async () => {
  const agenda = await agendaAplicada();
  const substituto = (await criarUsuario(["PROFESSOR"])).id;
  const p = await prepararSubstituicao(agenda.reservaId, substituto);
  await prisma.usuario.update({ where: { id: substituto }, data: { ativo: false } });
  entrar(administrador);
  expect(await decidirSubstituicaoAgendaSegundaChamada(decisaoSubstituicao(p))).toMatchObject({ ok: false });
  await expect(prisma.$executeRaw`INSERT INTO "DecisaoSubstituicaoAgendaSegundaChamada" (id,"propostaId","decisorId",aprovada,motivo) VALUES ('decisao-professor-inativo',${p.id},${administrador},true,'Decisão SQL sobre professor desativado')`).rejects.toThrow();
  expect(await prisma.designacaoSegundaChamada.count()).toBe(0);
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: agenda.encontroId } })).toMatchObject({ professorId: professor });
});

it("substituto realiza no horário aprovado; responsável anterior não pode realizar por ele", async () => {
  const inicio = new Date(Date.now() + 3_000);
  const agenda = await agendaAplicada(false, inicio);
  const substituto = (await criarUsuario(["PROFESSOR"])).id;
  const p = await prepararSubstituicao(agenda.reservaId, substituto);
  entrar(administrador);
  expect(await decidirSubstituicaoAgendaSegundaChamada(decisaoSubstituicao(p))).toMatchObject({ ok: true });
  await new Promise<void>(resolve => setTimeout(resolve, Math.max(0, inicio.getTime() - Date.now() + 100)));
  const realizadaEm = new Date().toISOString();
  entrar(professor);
  expect(await registrarRealizacaoSegundaChamada({ reservaId: agenda.reservaId, realizadaEm, evidencia: "Tentativa do professor anteriormente responsável" })).toMatchObject({ ok: false });
  entrar(substituto);
  const realizada = await registrarRealizacaoSegundaChamada({ reservaId: agenda.reservaId, realizadaEm, evidencia: "Avaliação realizada pelo substituto aprovado" });
  expect(realizada, JSON.stringify(realizada)).toMatchObject({ ok: true });
  expect(await prisma.realizacaoSegundaChamada.findMany({ where: { reservaId: agenda.reservaId } })).toMatchObject([{ professorId: substituto }]);
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: agenda.encontroId } })).toMatchObject({ status: "MINISTRADO", professorId: substituto });
  expect(await prisma.registroAvaliacaoMatricula.count()).toBe(0);
});


it("preserva duas substituições sucessivas e reenvio da primeira não restaura o antigo professor", async () => {
  const agenda = await agendaAplicada();
  const primeiro = (await criarUsuario(["PROFESSOR"])).id;
  const segundo = (await criarUsuario(["PROFESSOR"])).id;
  const p1 = await prepararSubstituicao(agenda.reservaId, primeiro);
  entrar(administrador);
  const aplicada1 = await decidirSubstituicaoAgendaSegundaChamada(decisaoSubstituicao(p1));
  expect(aplicada1, JSON.stringify(aplicada1)).toMatchObject({ ok: true });
  const p2 = await prepararSubstituicao(agenda.reservaId, segundo, gestor, "segunda-substituicao-mesmo-encontro");
  entrar(administrador);
  const aplicada2 = await decidirSubstituicaoAgendaSegundaChamada(decisaoSubstituicao(p2));
  expect(aplicada2, JSON.stringify(aplicada2)).toMatchObject({ ok: true });
  expect(await decidirSubstituicaoAgendaSegundaChamada(decisaoSubstituicao(p1))).toEqual(aplicada1);
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: agenda.encontroId } })).toMatchObject({ professorId: segundo });
  expect(await prisma.designacaoSegundaChamada.count()).toBe(2);
  expect(await prisma.$queryRaw`SELECT "professorAnteriorId","professorNovoId" FROM "AplicacaoSubstituicaoAgendaSegundaChamada" ORDER BY "aplicadaEm",id`).toEqual([
    { professorAnteriorId: professor, professorNovoId: primeiro }, { professorAnteriorId: primeiro, professorNovoId: segundo },
  ]);
  await expect(prisma.$executeRaw`DELETE FROM "AplicacaoSubstituicaoAgendaSegundaChamada" WHERE "encontroId"=${agenda.encontroId}`).rejects.toThrow();
  await expect(prisma.$executeRaw`UPDATE "DecisaoSubstituicaoAgendaSegundaChamada" SET aprovada=false WHERE "propostaId"=${p1.id}`).rejects.toThrow();
  expect(await prisma.reservaSegundaChamada.count()).toBe(1);
});

it("mantém exceção de calendário já aprovada e recusa calendário alterado após proposta", async () => {
  const agenda = await agendaAplicada(true);
  const substituto = (await criarUsuario(["PROFESSOR"])).id;
  const p = await prepararSubstituicao(agenda.reservaId, substituto);
  entrar(administrador);
  expect(await decidirSubstituicaoAgendaSegundaChamada(decisaoSubstituicao(p))).toMatchObject({ ok: true });
  const proximo = (await criarUsuario(["PROFESSOR"])).id;
  const pendente = await prepararSubstituicao(agenda.reservaId, proximo, gestor, "substituicao-calendario-alterado");
  await prepararCalendario(false, 2);
  entrar(administrador);
  expect(await decidirSubstituicaoAgendaSegundaChamada(decisaoSubstituicao(pendente))).toMatchObject({ ok: false });
  expect(await prisma.designacaoSegundaChamada.count()).toBe(1);
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: agenda.encontroId } })).toMatchObject({ professorId: substituto });
});

it("indisponibilidade docente aprovada depois da revisão impede aplicação sem efeitos parciais", async () => {
  const agenda = await agendaAplicada();
  const substituto = (await criarUsuario(["PROFESSOR"])).id;
  const p = await prepararSubstituicao(agenda.reservaId, substituto);
  await prisma.indisponibilidadeDocente.create({ data: {
    professorId: substituto, preparadorId: substituto, inicio: new Date(agenda.entrada.inicio), fim: new Date(agenda.entrada.fim),
    fusoOrigem: "UTC", motivo: "Indisponibilidade confirmada posteriormente", chaveIdempotencia: "ausencia-substituto-segunda", entradaHash: "fixture",
    decisao: { create: { decisorId: administrador, aprovada: true, motivo: "Período de ausência confirmado", encontrosAfetados: [], reservasAfetadas: [] } },
  } });
  entrar(administrador);
  expect(await decidirSubstituicaoAgendaSegundaChamada(decisaoSubstituicao(p))).toMatchObject({ ok: false });
  await expect(prisma.$executeRaw`INSERT INTO "DecisaoSubstituicaoAgendaSegundaChamada" (id,"propostaId","decisorId",aprovada,motivo) VALUES ('decisao-ausencia-confirmada',${p.id},${administrador},true,'Aprovação SQL confronta indisponibilidade')`).rejects.toThrow();
  expect(await prisma.designacaoSegundaChamada.count()).toBe(0);
});


it("duas decisões concorrentes não aplicam substituições sobre o mesmo estado antigo", async () => {
  const agenda = await agendaAplicada();
  const primeiro = (await criarUsuario(["PROFESSOR"])).id;
  const segundo = (await criarUsuario(["PROFESSOR"])).id;
  const p1 = await prepararSubstituicao(agenda.reservaId, primeiro);
  const p2 = await prepararSubstituicao(agenda.reservaId, segundo, gestor, "substituicao-concorrente-outra");
  const resultados = await Promise.allSettled([p1, p2].map((p, i) => prisma.$transaction(tx => tx.$executeRaw`
    INSERT INTO "DecisaoSubstituicaoAgendaSegundaChamada" (id,"propostaId","decisorId",aprovada,motivo)
    VALUES (${`decisao-substituicao-concorrente-${i}`},${p.id},${administrador},true,'Decisão concorrente independente')`)));
  expect(resultados.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(resultados.filter(r => r.status === "rejected")).toHaveLength(1);
  const encontro = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: agenda.encontroId } });
  expect([primeiro, segundo]).toContain(encontro.professorId);
  expect(await prisma.designacaoSegundaChamada.count()).toBe(1);
  expect(await prisma.$queryRaw`SELECT count(*)::int AS total FROM "AplicacaoSubstituicaoAgendaSegundaChamada"`).toEqual([{ total: 1 }]);
  expect(await prisma.reservaSegundaChamada.count()).toBe(1);
  expect(await prisma.ocorrenciaSegundaChamada.count()).toBe(0);
});


it("pausa exige autorização especial que cubra também o fim do encontro", async () => {
  const agenda = await agendaAplicada();
  const substituto = (await criarUsuario(["PROFESSOR"])).id;
  const m = await prisma.matricula.update({ where: { id: matriculaId }, data: { referenciaCobertura: "MES_CIVIL" } });
  const financeiro = (await criarUsuario(["FINANCEIRO"])).id;
  const { solicitarPausaMatriculas, decidirPropostaPausaMatriculas } = await import("@/server/matricula/pausa-proposta");
  const { aplicarPausaMatriculasTx } = await import("@/server/matricula/pausa-execucao");
  const { autorizarRealizacaoEspecialSegundaChamada } = await import("./segunda-chamada-autorizacao-especial");
  entrar(administrador);
  const pausa = await solicitarPausaMatriculas(m.alunoId, { matriculaIds: [matriculaId], dataEfetiva: new Date().toISOString().slice(0, 10),
    motivo: "Pausa com avaliação pendente agendada", chaveIdempotencia: "pausa-substituicao-segunda" });
  if (!pausa.ok || !pausa.dado) throw new Error(JSON.stringify(pausa));
  entrar(financeiro);
  expect(await decidirPropostaPausaMatriculas(pausa.dado.propostaId, { aprovar: true, motivo: "Pausa conferida por outra pessoa" })).toMatchObject({ ok: true });
  await prisma.$transaction(tx => aplicarPausaMatriculasTx(tx, pausa.dado!.propostaId, administrador, new Date()));
  entrar(gestor);
  expect(await autorizarRealizacaoEspecialSegundaChamada({ alocacaoId, codigoAvaliacao: "I1",
    prazoAte: new Date(new Date(agenda.entrada.inicio).getTime() + 60_000).toISOString(),
    motivo: "Autorização curta não cobre toda a avaliação", chaveIdempotencia: "autorizacao-parcial-substituicao" })).toMatchObject({ ok: true });
  const parcial = await consultarSubstituicaoAgendaSegundaChamada({ reservaId: agenda.reservaId, substitutoId: substituto });
  expect(parcial).toMatchObject({ ok: true, dado: { podePropor: false, previa: { pendencias: expect.arrayContaining([expect.stringContaining("fim")]) } } });
  expect(await autorizarRealizacaoEspecialSegundaChamada({ alocacaoId, codigoAvaliacao: "I1", prazoAte: agenda.entrada.fim,
    motivo: "Autorização completa para avaliação identificada", chaveIdempotencia: "autorizacao-integral-substituicao" })).toMatchObject({ ok: true });
  const p = await prepararSubstituicao(agenda.reservaId, substituto);
  entrar(administrador);
  const resultado = await decidirSubstituicaoAgendaSegundaChamada(decisaoSubstituicao(p));
  expect(resultado, JSON.stringify(resultado)).toMatchObject({ ok: true });
  expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toMatchObject({ status: "PAUSADA" });
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: agenda.encontroId } })).toMatchObject({ professorId: substituto });
});


it("nova versão do calendário sem impacto no encontro permite nova revisão, mas não reutiliza proposta antiga", async () => {
  const agenda = await agendaAplicada();
  const substituto = (await criarUsuario(["PROFESSOR"])).id;
  const antiga = await prepararSubstituicao(agenda.reservaId, substituto);
  const diaSemEncontro = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  await prisma.versaoCalendarioEscolar.create({ data: {
    versao: 2, preparadorId: gestor, fusoInstitucional: "UTC",
    periodos: [{ id: "feriado-outra-data", tipo: "FERIADO", nome: "Feriado fora do encontro", inicio: diaSemEncontro, fim: diaSemEncontro }],
    motivo: "Ajuste sem impacto nesta segunda chamada", chaveIdempotencia: "calendario-sem-impacto-segunda", entradaHash: "fixture",
    decisao: { create: { decisorId: administrador, aprovada: true, motivo: "Novo calendário conferido independentemente" } },
  } });
  entrar(administrador);
  expect(await decidirSubstituicaoAgendaSegundaChamada(decisaoSubstituicao(antiga))).toMatchObject({ ok: false });
  expect(await decidirSubstituicaoAgendaSegundaChamada(decisaoSubstituicao(antiga, false))).toMatchObject({ ok: true });
  const nova = await prepararSubstituicao(agenda.reservaId, substituto, gestor, "nova-revisao-calendario-sem-impacto");
  entrar(administrador);
  const resultado = await decidirSubstituicaoAgendaSegundaChamada(decisaoSubstituicao(nova));
  expect(resultado, JSON.stringify(resultado)).toMatchObject({ ok: true, dado: { aplicada: true } });
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: agenda.encontroId } })).toMatchObject({
    professorId: substituto, inicio: new Date(agenda.entrada.inicio), fim: new Date(agenda.entrada.fim),
  });
  expect(await prisma.versaoCalendarioEscolar.count()).toBe(2);
  expect(await prisma.designacaoSegundaChamada.count()).toBe(1);
});
