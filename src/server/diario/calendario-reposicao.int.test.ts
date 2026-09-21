import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { agendarReposicaoIndividual } from "./reposicao-agenda";

const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
let gestorId: string, adminId: string, secretariaId: string, professorId: string, alunoId: string, matriculaId: string, turmaId: string;
let aulaId: string;

async function inserirPedido(id: string, aulaOriginalId = aulaId) {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "ReposicaoIndividual" (id,"aulaOriginalId","matriculaId",modalidade,"solicitanteId",motivo,evidencia,"chaveIdempotencia","entradaHash")
    VALUES (${id},${aulaOriginalId},${matriculaId},'PARTICULAR'::"ModalidadeReposicaoIndividual",${secretariaId},'Falta comprovada para reposição','Registro da falta original','pedido-' || ${id},'fixture')
  `);
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "DecisaoReposicaoIndividual" (id,"reposicaoId","decisorId",aprovada,motivo)
    VALUES ('decisao-' || ${id},${id},${adminId},true,'Gestão autorizou a reposição individual')
  `);
}

async function criarAulaOriginal(chave: string, inicio = "2026-09-10T10:00:00.000Z") {
  const aula = await prisma.encontroAgenda.create({ data: {
    turmaId, professorId, preparadorId: gestorId, inicio: new Date(inicio), fim: new Date(new Date(inicio).getTime() + 60 * 60000), fusoOrigem: "UTC", status: "PREVISTO",
    motivo: "Aula coletiva realizada", chaveIdempotencia: chave, entradaHash: "fixture",
    diario: { create: { turmaId, professorId, ocorridaEm: new Date(inicio), conteudo: "Aula com falta", registros: { create: { alunoId, matriculaId, nomeAluno: "Aluno", presente: false, participacao: "FALTA" } } } },
  } });
  await prisma.encontroAgenda.update({ where: { id: aula.id }, data: { status: "MINISTRADO" } });
  return aula.id;
}

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  gestorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  adminId = (await criarUsuario(["ADMINISTRADOR"])).id;
  secretariaId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  professorId = (await criarUsuario(["PROFESSOR"])).id;
  await prisma.configuracaoOperacional.upsert({ where: { id: "escola" }, create: { id: "escola", fusoInstitucional: "UTC" }, update: { fusoInstitucional: "UTC" } });
  await prisma.versaoCalendarioEscolar.create({ data: { versao: 1, preparadorId: gestorId, fusoInstitucional: "UTC", periodos: [], motivo: "Calendário institucional publicado", chaveIdempotencia: "calendario-agenda-reposicao", entradaHash: "fixture", decisao: { create: { decisorId: adminId, aprovada: true, motivo: "Calendário conferido" } } } });
  alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Aluno agenda", paisId: catalogo.pais.id } })).id;
  matriculaId = (await prisma.matricula.create({ data: { alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } })).id;
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  turmaId = (await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId } })).id;
  await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId, turmaId, criadoEm: new Date("2026-09-01T00:00:00.000Z") } });
  aulaId = await criarAulaOriginal("aula-origem-agenda");
  entrar(secretariaId);
});

async function publicarCalendario(versao: number, periodos: Prisma.InputJsonValue, aprovada = true) {
  await prisma.versaoCalendarioEscolar.create({ data: {
    versao, preparadorId: gestorId, fusoInstitucional: "UTC", periodos,
    motivo: "Revisão do calendário institucional", chaveIdempotencia: `calendario-regressao-${versao}`, entradaHash: "fixture",
    decisao: { create: { decisorId: adminId, aprovada, motivo: "Conferência independente do calendário" } },
  } });
}

it.each([true, false])("usa apenas calendário aprovado vigente; feriado removido=%s", async (removido) => {
  const feriado = [{ id: "feriado", nome: "Dia não letivo", tipo: "FERIADO", inicio: "2026-10-12", fim: "2026-10-12" }];
  await publicarCalendario(2, feriado);
  await publicarCalendario(3, removido ? [] : feriado);
  // Uma proposta posterior rejeitada não restaura o feriado.
  await publicarCalendario(4, removido ? feriado : [], false);
  await inserirPedido("pedido-calendario-vigente");
  const autorizacao = await prisma.autorizacaoExcecaoReposicaoParticular.create({ data: {
    reposicaoId: "pedido-calendario-vigente", solicitanteId: secretariaId, versao: 1,
    motivo: "Particular excepcional por material irrecuperável", evidencia: "Gestão confirmou indisponibilidade",
    chaveIdempotencia: "autorizacao-calendario-vigente", entradaHash: "fixture",
    decisao: { create: { decisorId: adminId, aprovada: true, motivo: "Gratuidade excepcional autorizada" } },
  } });
  entrar(secretariaId);
  const resultado = await agendarReposicaoIndividual({
    reposicaoId: "pedido-calendario-vigente", professorId,
    inicioLocal: "2026-10-12T10:00", fimLocal: "2026-10-12T11:00", fuso: "UTC",
    autorizacaoExcecaoId: autorizacao.id, motivo: "Data letiva após revisão aprovada",
    chaveIdempotencia: "agenda-calendario-vigente",
  });
  expect(resultado).toMatchObject({ ok: removido });
  if (!removido) {
    expect(await prisma.agendaReposicaoIndividual.count()).toBe(0);
    return;
  }
  const agenda = await prisma.agendaReposicaoIndividual.findUniqueOrThrow({ where: { reposicaoId: "pedido-calendario-vigente" } });
  expect(agenda.excecaoId).toBeNull();
});
