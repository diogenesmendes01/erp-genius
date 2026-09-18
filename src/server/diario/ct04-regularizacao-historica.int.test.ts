import { beforeEach, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { salvarAulaDiario } from "./acoes";
import { listarChamadaEncontro } from "./chamada-encontro";
import { designarRegularizacaoAula } from "./regularizacao-designacao";

const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

let encontroId: string;
let outroEncontroId: string;
let turmaOrigemId: string;
let alunoId: string;
let professorOriginalId: string;
let professorDesignadoId: string;
let professorTitularAtualId: string;
let gestaoId: string;

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  professorOriginalId = (await criarUsuario([Papel.PROFESSOR], "Professor original CT04")).id;
  professorDesignadoId = (await criarUsuario([Papel.PROFESSOR], "Professor designado CT04")).id;
  professorTitularAtualId = (await criarUsuario([Papel.PROFESSOR], "Professor titular atual CT04")).id;
  const professorDestinoId = (await criarUsuario([Papel.PROFESSOR], "Professor destino CT04")).id;
  gestaoId = (await criarUsuario([Papel.GERENTE_PEDAGOGICO], "Gestão CT04")).id;
  const secretariaId = (await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria CT04")).id;
  const nivelOrigem = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "CT04-O", ordem: 1 } });
  const nivelDestino = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "CT04-D", ordem: 2 } });
  const inicioVinculo = new Date("2026-01-01T00:00:00.000Z");
  const inicioEncontro = new Date("2026-01-10T10:00:00.000Z");
  const fimEncontro = new Date("2026-01-10T11:00:00.000Z");
  const transferenciaEm = new Date("2026-01-11T10:00:00.000Z");
  const turmaOrigem = await prisma.turma.create({ data: {
    codigo: "CT04-ORIGEM", modalidadeId: catalogo.modalidade.id, nivelId: nivelOrigem.id,
    professorId: professorOriginalId, status: "EM_ANDAMENTO",
    vinculosDocentes: { create: { professorId: professorOriginalId, inicio: inicioVinculo } },
  } });
  turmaOrigemId = turmaOrigem.id;
  const turmaDestino = await prisma.turma.create({ data: {
    codigo: "CT04-DESTINO", modalidadeId: catalogo.modalidade.id, nivelId: nivelDestino.id,
    professorId: professorDestinoId, status: "EM_ANDAMENTO",
    vinculosDocentes: { create: { professorId: professorDestinoId, inicio: inicioVinculo } },
  } });
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno", sobrenome: "Histórico CT04", paisId: catalogo.pais.id } });
  alunoId = aluno.id;
  const matricula = await prisma.matricula.create({ data: {
    alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA", ativadaEm: inicioVinculo,
  } });
  const origem = await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId: matricula.id, turmaId: turmaOrigem.id, criadoEm: inicioVinculo } });
  const encontro = await prisma.encontroAgenda.create({ data: {
    turmaId: turmaOrigem.id, professorId: professorOriginalId, preparadorId: secretariaId,
    inicio: inicioEncontro, fim: fimEncontro, fusoOrigem: "UTC", finalidade: "AULA", status: "PREVISTO",
    motivo: "Aula antiga cuja primeira chamada ainda precisa de regularização.", chaveIdempotencia: "ct04-encontro-historico", entradaHash: "fixture-ct04",
  } });
  encontroId = encontro.id;
  const outro = await prisma.encontroAgenda.create({ data: {
    turmaId: turmaOrigem.id, professorId: professorOriginalId, preparadorId: secretariaId,
    inicio: new Date("2026-01-12T10:00:00.000Z"), fim: new Date("2026-01-12T11:00:00.000Z"), fusoOrigem: "UTC", finalidade: "AULA", status: "PREVISTO",
    motivo: "Outra aula não atribuída ao regularizador.", chaveIdempotencia: "ct04-outro-encontro", entradaHash: "fixture-ct04",
  } });
  outroEncontroId = outro.id;

  await prisma.$transaction(async (tx) => {
    await tx.alocacaoTurma.update({ where: { id: origem.id }, data: { ativa: false, encerradaEm: transferenciaEm } });
    await tx.alocacaoTurma.create({ data: { alunoId, matriculaId: matricula.id, turmaId: turmaDestino.id, criadoEm: transferenciaEm } });
    await tx.vinculoDocente.updateMany({ where: { turmaId: turmaOrigem.id, fim: null }, data: { fim: transferenciaEm } });
    await tx.vinculoDocente.create({ data: { turmaId: turmaOrigem.id, professorId: professorTitularAtualId, inicio: transferenciaEm } });
    await tx.turma.update({ where: { id: turmaOrigem.id }, data: { professorId: professorTitularAtualId } });
  });
  await prisma.usuario.update({ where: { id: professorOriginalId }, data: { ativo: false } });
});

it("CT04 regulariza a primeira chamada histórica após transferência sem reabrir acesso do professor original", async () => {
  const designacaoEntrada = {
    encontroId,
    responsavelId: professorDesignadoId,
    motivo: "Professor pontual confere a primeira chamada histórica após a transferência do aluno.",
    chaveIdempotencia: "ct04-designacao-historica",
  };
  entrar(gestaoId);
  const primeiraDesignacao = await designarRegularizacaoAula(designacaoEntrada);
  expect(primeiraDesignacao.ok, primeiraDesignacao.ok ? undefined : primeiraDesignacao.erro).toBe(true);
  if (!primeiraDesignacao.ok || !primeiraDesignacao.dado) throw new Error("Designação histórica ausente.");
  expect(await designarRegularizacaoAula(designacaoEntrada)).toEqual(primeiraDesignacao);
  expect(await prisma.designacaoRegularizacaoAula.count({ where: { encontroId } })).toBe(1);

  entrar(professorOriginalId);
  expect(await listarChamadaEncontro({ encontroId })).toMatchObject({ ok: false });
  expect(await salvarAulaDiario({
    encontroId, turmaId: turmaOrigemId, ocorridaEm: "2026-01-10T10:00:00.000Z", conteudo: "Tentativa do professor que saiu.",
    registros: [{ alunoId, presente: true }],
  })).toMatchObject({ ok: false });

  entrar(professorDesignadoId);
  const chamada = await listarChamadaEncontro({ encontroId });
  expect(chamada).toMatchObject({
    ok: true,
    dado: { alunos: [{ alunoId, nomeAluno: "Aluno Histórico CT04", podeEditar: true, podeClassificar: true }] },
  });
  expect(await listarChamadaEncontro({ encontroId: outroEncontroId })).toMatchObject({ ok: false });

  const salvo = await salvarAulaDiario({
    encontroId, turmaId: turmaOrigemId, ocorridaEm: "2026-01-10T10:00:00.000Z",
    conteudo: "Chamada histórica conferida pelo docente pontualmente designado.",
    registros: [{ alunoId, presente: true, observacao: "Presença registrada na primeira chamada histórica." }],
  });
  expect(salvo.ok, salvo.ok ? undefined : salvo.erro).toBe(true);
  if (!salvo.ok || !salvo.dado) throw new Error("Chamada histórica ausente.");

  expect(await prisma.aulaDiario.findUniqueOrThrow({ where: { id: salvo.dado.id } })).toMatchObject({
    encontroId,
    turmaId: turmaOrigemId,
    professorId: professorOriginalId,
  });
  expect(await prisma.registroAulaAluno.findUniqueOrThrow({ where: { aulaId_alunoId: { aulaId: salvo.dado.id, alunoId } } })).toMatchObject({
    nomeAluno: "Aluno Histórico CT04",
    matriculaId: expect.any(String),
    presente: true,
  });
  const evento = await prisma.evento.findFirstOrThrow({ where: { tipo: "AulaDiarioRegistrada", autorId: professorDesignadoId } });
  expect(evento.agregadoId).toBe(turmaOrigemId);
  expect(evento.payload).toMatchObject({ aulaId: salvo.dado.id, atorId: professorDesignadoId, designacaoId: primeiraDesignacao.dado.id });
  expect(await prisma.turma.findUniqueOrThrow({ where: { id: turmaOrigemId } })).toMatchObject({ professorId: professorTitularAtualId });
  const vinculos = await prisma.vinculoDocente.findMany({ where: { turmaId: turmaOrigemId }, orderBy: { inicio: "asc" } });
  expect(vinculos).toEqual([
    expect.objectContaining({ professorId: professorOriginalId, inicio: new Date("2026-01-01T00:00:00.000Z"), fim: new Date("2026-01-11T10:00:00.000Z") }),
    expect.objectContaining({ professorId: professorTitularAtualId, inicio: new Date("2026-01-11T10:00:00.000Z"), fim: null }),
  ]);
  expect(await prisma.alocacaoTurma.findFirstOrThrow({ where: { alunoId, turmaId: turmaOrigemId } })).toMatchObject({ ativa: false, encerradaEm: new Date("2026-01-11T10:00:00.000Z") });
  const alocacaoDestino = await prisma.alocacaoTurma.findFirstOrThrow({ where: { alunoId, ativa: true } });
  expect(alocacaoDestino.turmaId).not.toBe(turmaOrigemId);
});
