import { beforeEach, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import { prepararRegraAvaliacaoTx, decidirRegraAvaliacaoTx } from "./regras-tx";
import { proporSegundaChamada, decidirSegundaChamada } from "./segunda-chamada";
import { disponibilizarSegundaChamada } from "./segunda-chamada-disponibilizacao";
import { consultarPreviaAgendaInicialSegundaChamada, proporAgendaInicialSegundaChamada, decidirAgendaInicialSegundaChamada } from "./segunda-chamada-agenda-inicial";
import { consultarRemarcacoesAgendaSegundaChamada, proporRemarcacaoAgendaSegundaChamada, decidirRemarcacaoAgendaSegundaChamada } from "./segunda-chamada-remarcacao";
import { autorizarRealizacaoEspecialSegundaChamada } from "./segunda-chamada-autorizacao-especial";

let professor: string, gestor: string, administrador: string, alocacaoId: string, matriculaId: string;
const entrar = (usuarioId: string) => authMock.mockResolvedValue({ user: { id: usuarioId } });

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  professor = (await criarUsuario(["PROFESSOR"])).id;
  gestor = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  administrador = (await criarUsuario(["ADMINISTRADOR"])).id;
  await prisma.configuracaoOperacional.upsert({ where: { id: "escola" }, create: { id: "escola", fusoInstitucional: "UTC" }, update: { fusoInstitucional: "UTC" } });
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  const regra = await prisma.$transaction(tx => prepararRegraAvaliacaoTx(tx, gestor, { nivelId: nivel.id, versaoEsperada: 0, conteudo: regraAvaliacaoTeste(), motivo: "Regra para remarcação sob pausa", chaveIdempotencia: "regra-remarcacao-autorizacao" }));
  const versao = await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: regra.id } });
  await prisma.$transaction(tx => decidirRegraAvaliacaoTx(tx, administrador, { regraId: versao.id, conteudoHash: versao.conteudoHash, aprovada: true, motivo: "Regra aprovada independentemente" }));
  const turma = await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: professor, dataInicio: new Date("2099-01-01T00:00:00Z"), vinculosDocentes: { create: { professorId: professor, inicio: new Date("2026-01-01T00:00:00Z") } } } });
  await prisma.turma.update({ where: { id: turma.id }, data: { status: "EM_ANDAMENTO", dataInicio: new Date("2026-01-01T00:00:00Z") } });
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno em pausa", paisId: catalogo.pais.id } });
  const matricula = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA", ativadaEm: new Date("2026-01-01T00:00:00Z") } });
  matriculaId = matricula.id;
  alocacaoId = (await prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, matriculaId, turmaId: turma.id, criadoEm: new Date("2026-01-01T00:00:00Z") } })).id;
  await prisma.versaoCalendarioEscolar.create({ data: { versao: 1, preparadorId: gestor, fusoInstitucional: "UTC", periodos: [], motivo: "Calendário aprovado", chaveIdempotencia: "cal-remarcacao-autorizacao", entradaHash: "fixture", decisao: { create: { decisorId: administrador, aprovada: true, motivo: "Calendário decidido" } } } });
});

async function agendaOriginal() {
  entrar(professor);
  const criada = await proporSegundaChamada({ alocacaoId, codigoAvaliacao: "I1", motivo: "Ausência justificada para remarcação", evidencias: "Documento institucional arquivado", chaveIdempotencia: "fonte-remarcacao-autorizacao" });
  if (!criada.ok || !criada.dado) throw new Error(JSON.stringify(criada));
  const fonte = await prisma.propostaSegundaChamada.findUniqueOrThrow({ where: { id: criada.dado.id } });
  entrar(gestor);
  if (!(await decidirSegundaChamada({ propostaId: fonte.id, propostaHash: fonte.entradaHash, aprovada: true, motivo: "Decisão independente da fonte" })).ok) throw new Error("Fonte não aprovada");
  if (!(await disponibilizarSegundaChamada({ propostaId: fonte.id, propostaHash: fonte.entradaHash, disponibilizadaEm: new Date().toISOString(), condicoes: "Condições confirmadas", evidenciaComunicacao: "Comunicação registrada" })).ok) throw new Error("Fonte não disponibilizada");
  const inicio = new Date(Date.now() + 60 * 60_000), fim = new Date(inicio.getTime() + 30 * 60_000);
  const previa = await consultarPreviaAgendaInicialSegundaChamada({ propostaSegundaChamadaId: fonte.id, professorId: professor, inicio: inicio.toISOString(), fim: fim.toISOString(), fusoOrigem: "UTC" });
  if (!previa.ok || !previa.dado) throw new Error(JSON.stringify(previa));
  const proposta = await proporAgendaInicialSegundaChamada({ propostaSegundaChamadaId: fonte.id, professorId: professor, estadoConferido: previa.dado.estadoConferido, inicio: inicio.toISOString(), fim: fim.toISOString(), fusoOrigem: "UTC", motivo: "Agenda original conferida", evidencia: "Registro institucional da agenda", chaveIdempotencia: "agenda-original-remarcacao" });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  entrar(administrador);
  const aplicada = await decidirAgendaInicialSegundaChamada({ propostaId: proposta.dado.id, propostaHash: proposta.dado.entradaHash, aprovada: true, motivo: "Agenda decidida por outra pessoa" });
  if (!aplicada.ok || !aplicada.dado?.reservaId || !aplicada.dado.encontroId) throw new Error(JSON.stringify(aplicada));
  return { reservaId: aplicada.dado.reservaId, encontroId: aplicada.dado.encontroId, inicio, fim };
}

async function pausarMatricula() {
  const matricula = await prisma.matricula.update({ where: { id: matriculaId }, data: { referenciaCobertura: "MES_CIVIL" } });
  const financeiro = (await criarUsuario(["FINANCEIRO"])).id;
  const { solicitarPausaMatriculas, decidirPropostaPausaMatriculas } = await import("@/server/matricula/pausa-proposta");
  const { aplicarPausaMatriculasTx } = await import("@/server/matricula/pausa-execucao");
  entrar(administrador);
  const pausa = await solicitarPausaMatriculas(matricula.alunoId, { matriculaIds: [matriculaId], dataEfetiva: new Date().toISOString().slice(0, 10), motivo: "Pausa com segunda chamada pendente", chaveIdempotencia: "pausa-remarcacao-autorizacao" });
  if (!pausa.ok || !pausa.dado) throw new Error(JSON.stringify(pausa));
  entrar(financeiro);
  if (!(await decidirPropostaPausaMatriculas(pausa.dado.propostaId, { aprovar: true, motivo: "Pausa decidida independentemente" })).ok) throw new Error("Pausa não aprovada");
  await prisma.$transaction(tx => aplicarPausaMatriculasTx(tx, pausa.dado!.propostaId, administrador, new Date()));
}

async function entradaRemarcacao(reservaId: string, chave: string) {
  entrar(gestor);
  const consulta = await consultarRemarcacoesAgendaSegundaChamada({ reservaId });
  if (!consulta.ok || !consulta.dado) throw new Error(JSON.stringify(consulta));
  const inicio = new Date(Date.now() + 3 * 60 * 60_000), fim = new Date(inicio.getTime() + 30 * 60_000);
  return { reservaId, estadoConferido: consulta.dado.estadoHash, inicio: inicio.toISOString(), fim: fim.toISOString(), fusoOrigem: "UTC", motivo: "Remarcação da avaliação pendente", evidencia: "Disponibilidade conferida para a nova agenda", chaveIdempotencia: chave };
}

it("nega remarcação pausada sem autorização integral e aprova quando ela cobre o novo encontro", async () => {
  const agenda = await agendaOriginal();
  await pausarMatricula();
  const entrada = await entradaRemarcacao(agenda.reservaId, "remarcacao-pausa-sem-autorizacao");
  expect(await proporRemarcacaoAgendaSegundaChamada(entrada)).toMatchObject({ ok: false });
  entrar(gestor);
  expect(await autorizarRealizacaoEspecialSegundaChamada({ alocacaoId, codigoAvaliacao: "I1", prazoAte: new Date(new Date(entrada.inicio).getTime() + 60_000).toISOString(), motivo: "Autorização parcial", chaveIdempotencia: "autorizacao-parcial-remarcacao" })).toMatchObject({ ok: true });
  expect(await proporRemarcacaoAgendaSegundaChamada({ ...entrada, chaveIdempotencia: "remarcacao-pausa-autorizacao-parcial" })).toMatchObject({ ok: false });
  expect(await autorizarRealizacaoEspecialSegundaChamada({ alocacaoId, codigoAvaliacao: "I1", prazoAte: entrada.fim, motivo: "Autorização integral da avaliação pendente", chaveIdempotencia: "autorizacao-integral-remarcacao" })).toMatchObject({ ok: true });
  const proposta = await proporRemarcacaoAgendaSegundaChamada({ ...entrada, chaveIdempotencia: "remarcacao-pausa-autorizacao-integral" });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  const [propostaPersistida] = await prisma.$queryRaw<{ entradaHash: string }[]>`SELECT "entradaHash" AS "entradaHash" FROM "PropostaRemarcacaoAgendaSegundaChamada" WHERE id=${proposta.dado.id}`;
  entrar(administrador);
  expect(await decidirRemarcacaoAgendaSegundaChamada({ propostaId: proposta.dado.id, propostaHash: propostaPersistida.entradaHash, aprovada: true, motivo: "Decisão independente com autorização vigente" })).toMatchObject({ ok: true });
  expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toMatchObject({ status: "PAUSADA" });
});

it("revalida a autorização na decisão e o SQL direto não contorna a autorização revogada", async () => {
  const agenda = await agendaOriginal();
  await pausarMatricula();
  const entrada = await entradaRemarcacao(agenda.reservaId, "remarcacao-pausa-revalidacao");
  entrar(gestor);
  const autorizacao = await autorizarRealizacaoEspecialSegundaChamada({ alocacaoId, codigoAvaliacao: "I1", prazoAte: entrada.fim, motivo: "Autorização conferida antes da proposta", chaveIdempotencia: "autorizacao-revalidacao-remarcacao" });
  if (!autorizacao.ok) throw new Error(JSON.stringify(autorizacao));
  const proposta = await proporRemarcacaoAgendaSegundaChamada(entrada);
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  const [propostaPersistida] = await prisma.$queryRaw<{ entradaHash: string }[]>`SELECT "entradaHash" AS "entradaHash" FROM "PropostaRemarcacaoAgendaSegundaChamada" WHERE id=${proposta.dado.id}`;
  await prisma.usuario.update({ where: { id: gestor }, data: { ativo: false } });
  entrar(administrador);
  const decisao = { propostaId: proposta.dado.id, propostaHash: propostaPersistida.entradaHash, aprovada: true, motivo: "Decisão após revogação da autorização" };
  expect(await decidirRemarcacaoAgendaSegundaChamada(decisao)).toMatchObject({ ok: false });
  await expect(prisma.$executeRaw`INSERT INTO "DecisaoRemarcacaoAgendaSegundaChamada" (id,"propostaId","decisorId",aprovada,motivo) VALUES ('decisao-direta-autorizacao-revogada',${proposta.dado.id},${administrador},true,'Tentativa SQL após revogação')`).rejects.toThrow();
  expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toMatchObject({ status: "PAUSADA" });
});

it("INSERT SQL não aprova proposta ativa antes da pausa quando a autorização só alcança o início", async () => {
  const agenda = await agendaOriginal();
  const entrada = await entradaRemarcacao(agenda.reservaId, "remarcacao-pausa-posterior-autorizacao-parcial");
  const proposta = await proporRemarcacaoAgendaSegundaChamada(entrada);
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  await pausarMatricula();
  entrar(gestor);
  expect(await autorizarRealizacaoEspecialSegundaChamada({
    alocacaoId, codigoAvaliacao: "I1", prazoAte: entrada.inicio,
    motivo: "Autorização limitada ao início da remarcação", chaveIdempotencia: "autorizacao-inicio-remarcacao",
  })).toMatchObject({ ok: true });
  await expect(prisma.$executeRaw`INSERT INTO "DecisaoRemarcacaoAgendaSegundaChamada" (id,"propostaId","decisorId",aprovada,motivo)
    VALUES ('decisao-direta-autorizacao-somente-inicio',${proposta.dado.id},${administrador},true,'Tentativa SQL sem cobertura do fim')`).rejects.toThrow(/Situação contratual não permite todo o intervalo/);
  expect(await prisma.decisaoRemarcacaoAgendaSegundaChamada.count({ where: { propostaId: proposta.dado.id } })).toBe(0);
  expect(await prisma.reservaSegundaChamada.findUniqueOrThrow({ where: { id: agenda.reservaId } })).toMatchObject({ status: "RESERVADA" });
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: agenda.encontroId } })).toMatchObject({ status: "PREVISTO" });
  expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toMatchObject({ status: "PAUSADA" });
});
