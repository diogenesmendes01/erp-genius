import { beforeEach, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));

vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { prepararCalendarioEscolar } from "./calendario";
import { decidirCalendarioEscolar } from "./calendario-decisao";
import { decidirGradeInicialTurma } from "./grade-decisao";
import { prepararGradeInicialTurma } from "./grade-proposta";
import { decidirEAplicarReplanejamentoConjunto } from "./replanejamento-decisao";
import { preverReplanejamentoCalendario } from "./replanejamento-consulta";
import { registrarRascunhoReplanejamento } from "./replanejamento-rascunho";

const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

let secretariaId: string;
let gestaoId: string;
let calendarioId: string;
let turmaAId: string;
let turmaBId: string;
let catalogo: Awaited<ReturnType<typeof seedCatalogoMinimo>>;

async function publicarGrade(codigo: string, ordem: number) {
  const professor = await criarUsuario(["PROFESSOR"], `Professor ${codigo}`);
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo, ordem } });
  const turma = await prisma.turma.create({ data: {
    codigo,
    modalidadeId: catalogo.modalidade.id,
    nivelId: nivel.id,
    professorId: professor.id,
    diasSemana: [4],
    horarioInicio: "19:00",
    dataInicio: new Date("2099-10-01T00:00:00.000Z"),
  } });
  entrar(secretariaId);
  const proposta = await prepararGradeInicialTurma({
    turmaId: turma.id,
    fusoOrigem: "UTC",
    versaoAnterior: 0,
    motivo: `Publicar grade inicial da turma ${codigo}.`,
    chaveIdempotencia: `ct05-grade-${codigo}`,
  });
  expect(proposta.ok, proposta.ok ? undefined : proposta.erro).toBe(true);
  if (!proposta.ok || !proposta.dado) throw new Error("Proposta de grade ausente.");
  entrar(gestaoId);
  expect(await decidirGradeInicialTurma({
    propostaId: proposta.dado.id,
    aprovar: true,
    motivo: `Aprovação independente da grade ${codigo}.`,
  })).toMatchObject({ ok: true });
  return { turma, professor };
}

beforeEach(async () => {
  await truncarBanco();
  catalogo = await seedCatalogoMinimo();
  await prisma.modalidade.update({
    where: { id: catalogo.modalidade.id },
    data: { frequencia: "1x/semana", aulasPorNivel: 2, horasAula: 1 },
  });
  await prisma.configuracaoOperacional.upsert({
    where: { id: "escola" },
    create: { id: "escola", fusoInstitucional: "UTC" },
    update: { fusoInstitucional: "UTC" },
  });
  secretariaId = (await criarUsuario(["SECRETARIA_ACADEMICA"], "Secretaria CT05")).id;
  gestaoId = (await criarUsuario(["GERENTE_PEDAGOGICO"], "Gestão CT05")).id;
  entrar(secretariaId);
  const base = await prepararCalendarioEscolar({
    fusoConferido: "UTC", versaoAnterior: 0, periodos: [],
    motivo: "Calendário vigente que servirá de base para o conjunto CT05.",
    chaveIdempotencia: "ct05-calendario-base",
  });
  expect(base.ok, base.ok ? undefined : base.erro).toBe(true);
  if (!base.ok || !base.dado) throw new Error("Calendário base ausente.");
  entrar(gestaoId);
  expect(await decidirCalendarioEscolar({
    calendarioId: base.dado.id,
    aprovar: true,
    motivo: "Aprovação independente do calendário base CT05.",
  })).toMatchObject({ ok: true });
  const [a, b] = await Promise.all([publicarGrade("CT05-A", 1), publicarGrade("CT05-B", 2)]);
  turmaAId = a.turma.id;
  turmaBId = b.turma.id;

  const passado = await prisma.encontroAgenda.create({ data: {
    turmaId: turmaAId,
    professorId: a.professor.id,
    preparadorId: secretariaId,
    inicio: new Date("2026-01-10T19:00:00.000Z"),
    fim: new Date("2026-01-10T20:00:00.000Z"),
    fusoOrigem: "UTC",
    finalidade: "AULA",
    status: "PREVISTO",
    motivo: "Encontro passado que não participa da remarcação.",
    chaveIdempotencia: "ct05-passado",
    entradaHash: "fixture-ct05",
  } });
  await prisma.aulaDiario.create({ data: {
    encontroId: passado.id,
    turmaId: turmaAId,
    professorId: a.professor.id,
    ocorridaEm: passado.inicio,
    conteudo: "Diário histórico que precisa permanecer imutável.",
  } });
  await prisma.encontroAgenda.update({ where: { id: passado.id }, data: { status: "MINISTRADO" } });
});

it("CT05 bloqueia o conjunto inteiro, reconfere fotografia e aplica as duas turmas sem tocar o histórico", async () => {
  const primeiroFuturo = await prisma.encontroAgenda.findFirstOrThrow({
    where: { turmaId: turmaAId, status: "PREVISTO" },
    orderBy: { inicio: "asc" },
  });
  entrar(secretariaId);
  const calendario = await prepararCalendarioEscolar({
    fusoConferido: "UTC",
    versaoAnterior: 1,
    motivo: "Feriado que exige replanejar o conjunto de duas turmas CT05.",
    chaveIdempotencia: "ct05-calendario-conjunto",
    periodos: [{
      id: "ct05-feriado",
      nome: "Feriado CT05",
      tipo: "FERIADO",
      inicio: primeiroFuturo.inicio.toISOString().slice(0, 10),
      fim: primeiroFuturo.inicio.toISOString().slice(0, 10),
    }],
  });
  expect(calendario.ok, calendario.ok ? undefined : calendario.erro).toBe(true);
  if (!calendario.ok || !calendario.dado) throw new Error("Calendário de replanejamento ausente.");
  calendarioId = calendario.dado.id;

  const antesHistorico = await prisma.encontroAgenda.findFirstOrThrow({ where: { turmaId: turmaAId, status: "MINISTRADO" } });
  const diarioHistoricoAntes = await prisma.aulaDiario.findUniqueOrThrow({ where: { encontroId: antesHistorico.id } });
  const primeiraPrevia = await preverReplanejamentoCalendario({ calendarioId });
  expect(primeiraPrevia.ok, primeiraPrevia.ok ? undefined : primeiraPrevia.erro).toBe(true);
  if (!primeiraPrevia.ok || !primeiraPrevia.dado) throw new Error("Prévia inicial ausente.");
  const revisoesIniciais = primeiraPrevia.dado.revisoes.filter((r) => r.turmaId === turmaAId || r.turmaId === turmaBId);
  expect(revisoesIniciais).toHaveLength(2);
  const propostaB = revisoesIniciais.find((r) => r.turmaId === turmaBId)?.previsao?.propostas.find((p) => p.alterado);
  if (!propostaB) throw new Error("Proposta alterada da turma B ausente.");
  const encontroB = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: propostaB.encontroId } });
  const alunoConflito = await prisma.aluno.create({ data: { primeiroNome: "Aluno conflito CT05", paisId: catalogo.pais.id } });
  const matriculaConflito = await prisma.matricula.create({ data: {
    alunoId: alunoConflito.id,
    produtoId: catalogo.produto.id,
    paisId: catalogo.pais.id,
    moeda: "CRC",
    status: "ATIVA",
  } });
  const conflito = await prisma.encontroAgenda.create({ data: {
    matriculaId: matriculaConflito.id,
    professorId: encontroB.professorId,
    preparadorId: secretariaId,
    inicio: new Date(propostaB.inicioProposto),
    fim: new Date(propostaB.fimProposto),
    fusoOrigem: "UTC",
    finalidade: "AULA",
    status: "PREVISTO",
    motivo: "Conflito posterior que impede a aplicação coletiva.",
    chaveIdempotencia: "ct05-conflito",
    entradaHash: "fixture-ct05",
  } });

  const previaComConflito = await preverReplanejamentoCalendario({ calendarioId });
  expect(previaComConflito.ok, previaComConflito.ok ? undefined : previaComConflito.erro).toBe(true);
  if (!previaComConflito.ok || !previaComConflito.dado) throw new Error("Prévia com conflito ausente.");
  expect(previaComConflito.dado.recursos.externos).toContainEqual({ encontroPropostoId: propostaB.encontroId, encontroExistenteId: conflito.id });
  const rascunhoConflito = await registrarRascunhoReplanejamento({
    calendarioId,
    estadoHash: previaComConflito.dado.estadoHash,
    versaoAnterior: 0,
    motivo: "Fotografia com conflito externo ainda pendente.",
    chaveIdempotencia: "ct05-rascunho-conflito",
  });
  expect(rascunhoConflito.ok, rascunhoConflito.ok ? undefined : rascunhoConflito.erro).toBe(true);
  if (!rascunhoConflito.ok || !rascunhoConflito.dado) throw new Error("Rascunho com conflito ausente.");
  const futurosAntesFalha = await prisma.encontroAgenda.findMany({
    where: { turmaId: { in: [turmaAId, turmaBId] }, status: "PREVISTO" },
    orderBy: { id: "asc" },
  });
  entrar(gestaoId);
  expect(await decidirEAplicarReplanejamentoConjunto({
    calendarioId,
    revisaoId: rascunhoConflito.dado.id,
    aprovar: true,
    motivo: "Tentativa que não pode ignorar o conflito da turma B.",
    excecoesAutorizadas: [],
  })).toMatchObject({ ok: false, erro: expect.stringContaining("Resolver conflitos") });
  expect(await prisma.aplicacaoReplanejamentoConjunto.count()).toBe(0);
  expect(await prisma.decisaoReplanejamentoConjunto.count()).toBe(0);
  expect(await prisma.encontroAgenda.findMany({ where: { id: { in: futurosAntesFalha.map((e) => e.id) }, status: "PREVISTO" }, orderBy: { id: "asc" } })).toEqual(futurosAntesFalha);

  await prisma.encontroAgenda.update({ where: { id: conflito.id }, data: { status: "CANCELADO" } });
  entrar(secretariaId);
  const previaResolvida = await preverReplanejamentoCalendario({ calendarioId });
  expect(previaResolvida.ok, previaResolvida.ok ? undefined : previaResolvida.erro).toBe(true);
  if (!previaResolvida.ok || !previaResolvida.dado) throw new Error("Prévia resolvida ausente.");
  expect(previaResolvida.dado.estadoHash).not.toBe(previaComConflito.dado.estadoHash);
  expect(previaResolvida.dado.recursos.externos).toEqual([]);
  const rascunhoResolvido = await registrarRascunhoReplanejamento({
    calendarioId,
    estadoHash: previaResolvida.dado.estadoHash,
    versaoAnterior: rascunhoConflito.dado.versao,
    motivo: "Nova fotografia após resolver o conflito externo.",
    chaveIdempotencia: "ct05-rascunho-resolvido",
  });
  expect(rascunhoResolvido.ok, rascunhoResolvido.ok ? undefined : rascunhoResolvido.erro).toBe(true);
  if (!rascunhoResolvido.ok || !rascunhoResolvido.dado) throw new Error("Rascunho resolvido ausente.");
  const propostasResolvidas = previaResolvida.dado.revisoes
    .filter((r) => r.turmaId === turmaAId || r.turmaId === turmaBId)
    .flatMap((r) => r.previsao?.propostas.filter((p) => p.alterado) ?? []);
  expect(new Set(propostasResolvidas.map((p) => p.encontroId)).size).toBeGreaterThanOrEqual(2);
  expect(new Set(previaResolvida.dado.revisoes.filter((r) => r.turmaId === turmaAId || r.turmaId === turmaBId).map((r) => r.turmaId))).toEqual(new Set([turmaAId, turmaBId]));

  entrar(gestaoId);
  const entradaDecisao = {
    calendarioId,
    revisaoId: rascunhoResolvido.dado.id,
    aprovar: true,
    motivo: "Aprovação independente do conjunto após nova fotografia.",
    excecoesAutorizadas: [],
  };
  const aplicada = await decidirEAplicarReplanejamentoConjunto(entradaDecisao);
  expect(aplicada, aplicada.ok ? undefined : aplicada.erro).toMatchObject({ ok: true, dado: { aprovada: true, aplicada: true } });
  expect(await decidirEAplicarReplanejamentoConjunto(entradaDecisao)).toEqual(aplicada);
  expect(await prisma.aplicacaoReplanejamentoConjunto.count()).toBe(1);
  expect(await prisma.decisaoReplanejamentoConjunto.count()).toBe(1);
  expect(await prisma.evento.count({ where: { tipo: "ReplanejamentoConjuntoAplicado" } })).toBe(1);
  const aplicados = await prisma.encontroAgenda.findMany({ where: { id: { in: propostasResolvidas.map((p) => p.encontroId) } } });
  expect(aplicados.map((e) => ({ id: e.id, inicio: e.inicio.toISOString(), fim: e.fim.toISOString() })).sort((a, b) => a.id.localeCompare(b.id))).toEqual(
    propostasResolvidas.map((p) => ({ id: p.encontroId, inicio: p.inicioProposto, fim: p.fimProposto })).sort((a, b) => a.id.localeCompare(b.id)),
  );
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: antesHistorico.id } })).toEqual(antesHistorico);
  expect(await prisma.aulaDiario.findUniqueOrThrow({ where: { id: diarioHistoricoAntes.id } })).toEqual(diarioHistoricoAntes);
});
