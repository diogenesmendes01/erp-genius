import { beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { consultarSubstituicaoAgendaSegundaChamada, proporSubstituicaoAgendaSegundaChamada,
  decidirSubstituicaoAgendaSegundaChamada } from "./segunda-chamada-substituicao";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import { decidirRegraAvaliacaoTx, prepararRegraAvaliacaoTx } from "./regras-tx";
import { decidirSegundaChamada, proporSegundaChamada } from "./segunda-chamada";
import { disponibilizarSegundaChamada } from "./segunda-chamada-disponibilizacao";
import { consultarPreviaAgendaInicialSegundaChamada, proporAgendaInicialSegundaChamada,
  decidirAgendaInicialSegundaChamada } from "./segunda-chamada-agenda-inicial";
import { solicitarPausaMatriculas, decidirPropostaPausaMatriculas } from "@/server/matricula/pausa-proposta";
import { aplicarPausaMatriculasTx } from "@/server/matricula/pausa-execucao";
import { solicitarRetomadaMatriculas, decidirRetomadaMatriculas } from "@/server/matricula/retomada-proposta";
import { aplicarRetomadaMatriculasTx } from "@/server/matricula/retomada-execucao";
import { instanteUtcSql } from "./segunda-chamada-utc";

let professor: string, gestor: string, administrador: string, alocacaoId: string, matriculaId: string;
const entrar = (usuarioId: string) => authMock.mockResolvedValue({ user: { id: usuarioId } });
const proposta = (chaveIdempotencia = "segunda-chamada-proposta-1") => ({
  alocacaoId, codigoAvaliacao: "I1", motivo: "Ausência justificada na avaliação intermediária.",
  evidencias: "Atestado e comunicação institucional arquivados.", chaveIdempotencia,
});

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "UTC" } });
  professor = (await criarUsuario(["PROFESSOR"])).id;
  gestor = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  administrador = (await criarUsuario(["ADMINISTRADOR"])).id;
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  const regra = await prisma.$transaction(tx => prepararRegraAvaliacaoTx(tx, gestor, {
    nivelId: nivel.id, versaoEsperada: 0, conteudo: { ...regraAvaliacaoTeste(), segundaChamada: { prazoRealizacaoMinutos: 14400, antecedenciaCancelamentoMinutos: 90 } },
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

async function entradaAgenda(
  naoLetivo = false,
  inicioEm = new Date(Date.now() + 60 * 60_000),
  fimEm = new Date(inicioEm.getTime() + 30 * 60_000),
) {
  const fonte = await aprovarEDisponibilizar("fonte-agenda-inicial");
  await prepararCalendario(naoLetivo);
  const referencia = {
    propostaSegundaChamadaId: fonte.id,
    professorId: professor,
    inicio: inicioEm.toISOString(),
    fim: fimEm.toISOString(),
    fusoOrigem: "UTC",
  };
  const previa = await consultarPreviaAgendaInicialSegundaChamada(referencia);
  if (!previa.ok || !previa.dado) throw new Error(JSON.stringify(previa));
  return {
    ...referencia,
    estadoConferido: previa.dado.estadoConferido,
    motivo: "Novo horário para avaliação pendente",
    evidencia: "Horário conferido com o aluno",
    ...(naoLetivo ? { motivoExcecaoNaoLetiva: "Aluno disponível somente nesta data excepcional" } : {}),
    chaveIdempotencia: "proposta-agenda-inicial",
  };
}

async function propostaAgenda(naoLetivo = false, inicioEm?: Date, fimEm?: Date) {
  const entrada = await entradaAgenda(naoLetivo, inicioEm, fimEm);
  const resultado = await proporAgendaInicialSegundaChamada(entrada);
  if (!resultado.ok || !resultado.dado) throw new Error(JSON.stringify(resultado));
  return { entrada, ...resultado.dado };
}

async function agendaAplicada(naoLetivo = false, inicioEm?: Date, fimEm?: Date) {
  const p = await propostaAgenda(naoLetivo, inicioEm, fimEm);
  entrar(administrador);
  const aplicada = await decidirAgendaInicialSegundaChamada({
    propostaId: p.id,
    propostaHash: p.entradaHash,
    aprovada: true,
    autorizarDiaNaoLetivo: naoLetivo,
    motivo: "Agenda inicial conferida para substituição",
  });
  if (!aplicada.ok || !aplicada.dado?.reservaId || !aplicada.dado.encontroId) {
    throw new Error(JSON.stringify(aplicada));
  }
  return { ...p, reservaId: aplicada.dado.reservaId, encontroId: aplicada.dado.encontroId };
}

async function prepararSubstituicao(
  reservaId: string,
  substitutoId: string,
  autorId = gestor,
  chave = "substituicao-docente-teste",
) {
  entrar(autorId);
  const consulta = await consultarSubstituicaoAgendaSegundaChamada({ reservaId, substitutoId });
  if (!consulta.ok || !consulta.dado?.previa) throw new Error(JSON.stringify(consulta));
  const entrada = {
    reservaId,
    substitutoId,
    estadoConferido: consulta.dado.previa.estadoConferido,
    motivo: "Substituição por indisponibilidade do responsável",
    evidencia: "Disponibilidade do novo professor conferida",
    chaveIdempotencia: chave,
  };
  const resultado = await proporSubstituicaoAgendaSegundaChamada(entrada);
  if (!resultado.ok || !resultado.dado) throw new Error(JSON.stringify(resultado));
  return { entrada, ...resultado.dado };
}

const dia = (data: Date, dias: number) =>
  new Date(data.getTime() + dias * 86_400_000).toISOString().slice(0, 10);

async function pausaInterna(base: Date, autorizar: boolean) {
  const pausaEm = dia(base, 1);
  const retornoEm = dia(base, 2);
  const financeiro = (await criarUsuario(["FINANCEIRO"])).id;
  const matricula = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  await prisma.matricula.update({
    where: { id: matriculaId },
    data: { referenciaCobertura: "MES_CIVIL" },
  });

  entrar(administrador);
  const pausa = await solicitarPausaMatriculas(matricula.alunoId, {
    matriculaIds: [matriculaId],
    dataEfetiva: pausaEm,
    motivo: "Pausa interna no intervalo da avaliação",
    chaveIdempotencia: `pausa-interna-${autorizar}`,
  });
  if (!pausa.ok || !pausa.dado) throw new Error(JSON.stringify(pausa));
  entrar(financeiro);
  expect(await decidirPropostaPausaMatriculas(pausa.dado.propostaId, {
    aprovar: true,
    motivo: "Pausa conferida",
  })).toMatchObject({ ok: true });
  await prisma.$transaction((tx) =>
    aplicarPausaMatriculasTx(tx, pausa.dado!.propostaId, administrador, new Date(`${pausaEm}T12:00:00Z`)),
  );

  if (autorizar) {
    entrar(gestor);
    const { autorizarRealizacaoEspecialSegundaChamada } = await import("./segunda-chamada-autorizacao-especial");
    expect(await autorizarRealizacaoEspecialSegundaChamada({
      alocacaoId,
      codigoAvaliacao: "I1",
      prazoAte: new Date(`${dia(base, 3)}T12:00:00Z`).toISOString(),
      motivo: "Autorização para a pausa interna",
      chaveIdempotencia: "autorizacao-interna",
    })).toMatchObject({ ok: true });
  }

  entrar(administrador);
  const retomada = await solicitarRetomadaMatriculas(matricula.alunoId, {
    retorno: retornoEm,
    matriculas: [{ matriculaId, vencimentos: { opcao: "MANTER_VENCIMENTOS" } }],
    motivo: "Retomada após a pausa interna",
    chaveIdempotencia: `retomada-interna-${autorizar}`,
  });
  if (!retomada.ok || !retomada.dado) throw new Error(JSON.stringify(retomada));
  entrar(financeiro);
  expect(await decidirRetomadaMatriculas(retomada.dado.propostaId, {
    aprovar: true,
    motivo: "Retomada conferida",
  })).toMatchObject({ ok: true });
  await prisma.$transaction((tx) =>
    aplicarRetomadaMatriculasTx(tx, retomada.dado!.propostaId, administrador, new Date(`${retornoEm}T12:00:00Z`)),
  );
}

function intervaloComPausaInterna() {
  const base = new Date(Date.now() + 24 * 60 * 60_000);
  return {
    base,
    inicio: new Date(`${dia(base, 0)}T12:00:00Z`),
    fim: new Date(`${dia(base, 3)}T12:00:00Z`),
  };
}

async function coberturaAutorizacao(inicio: Date, fim: Date) {
  return prisma.$queryRaw<{ cobre: boolean }[]>`
    SELECT situacao_autorizacao_segunda_chamada_cobre_intervalo(
      ${matriculaId}, ${alocacaoId}, ${"I1"}, ${instanteUtcSql(inicio)}, ${instanteUtcSql(fim)}
    ) AS cobre
  `;
}

it("recusa no servidor a proposta inicial quando a pausa está dentro do intervalo", async () => {
  const { base, inicio, fim } = intervaloComPausaInterna();
  const entrada = await entradaAgenda(false, inicio, fim);
  await pausaInterna(base, false);
  expect(await coberturaAutorizacao(inicio, fim)).toEqual([{ cobre: false }]);

  entrar(gestor);
  const resultado = await proporAgendaInicialSegundaChamada(entrada);
  expect(resultado).toMatchObject({ ok: false });
  expect(resultado.ok ? "" : resultado.erro).toMatch(/intervalo da agenda exige vínculo ativo ou autorização especial/);
});

it("o trigger rejeita decisão inicial pendente quando a pausa interna não foi autorizada", async () => {
  const { base, inicio, fim } = intervaloComPausaInterna();
  entrar(gestor);
  const propostaPendente = await propostaAgenda(false, inicio, fim);
  await pausaInterna(base, false);
  expect(await coberturaAutorizacao(inicio, fim)).toEqual([{ cobre: false }]);

  await expect(prisma.$executeRaw`
    INSERT INTO "DecisaoAgendaSegundaChamada" (id,"propostaId","decisorId",aprovada,"autorizarDiaNaoLetivo",motivo)
    VALUES (${"decisao-inicial-pausa-interna"},${propostaPendente.id},${administrador},true,false,${"Decisão com pausa interna sem autorização"})
  `).rejects.toThrow(/Situação contratual não permite todo o intervalo/);
  expect(await prisma.reservaSegundaChamada.count()).toBe(0);
  expect(await prisma.encontroAgenda.count({ where: { finalidade: "SEGUNDA_CHAMADA" } })).toBe(0);
});

it("aprova agenda inicial no mesmo intervalo após autorização especial", async () => {
  const { base, inicio, fim } = intervaloComPausaInterna();
  entrar(gestor);
  const propostaPendente = await propostaAgenda(false, inicio, fim);
  await pausaInterna(base, true);
  expect(await coberturaAutorizacao(inicio, fim)).toEqual([{ cobre: true }]);

  entrar(administrador);
  const decisao = await decidirAgendaInicialSegundaChamada({
    propostaId: propostaPendente.id,
    propostaHash: propostaPendente.entradaHash,
    aprovada: true,
    motivo: "Agenda coberta por autorização especial",
  });
  expect(decisao).toMatchObject({ ok: true, dado: { reservaId: expect.any(String), encontroId: expect.any(String) } });
});

it("o trigger rejeita substituição pendente quando a pausa interna não foi autorizada", async () => {
  const { base, inicio, fim } = intervaloComPausaInterna();
  const agenda = await agendaAplicada(false, inicio, fim);
  const substituto = (await criarUsuario(["PROFESSOR"])).id;
  const pendente = await prepararSubstituicao(agenda.reservaId, substituto);
  await pausaInterna(base, false);
  expect(await coberturaAutorizacao(inicio, fim)).toEqual([{ cobre: false }]);

  await expect(prisma.$executeRaw`
    INSERT INTO "DecisaoSubstituicaoAgendaSegundaChamada" (id,"propostaId","decisorId",aprovada,motivo)
    VALUES (${"decisao-substituicao-pausa-interna"},${pendente.id},${administrador},true,${"Substituição com pausa interna sem autorização"})
  `).rejects.toThrow(/Situação contratual da substituição não permite todo o encontro/);
  entrar(gestor);
  const previa = await consultarSubstituicaoAgendaSegundaChamada({ reservaId: agenda.reservaId, substitutoId: substituto });
  expect(previa).toMatchObject({ ok: true, dado: { podePropor: false, previa: { pendencias: expect.arrayContaining([expect.stringContaining("transição contratual")]) } } });
  const encontro = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: agenda.encontroId } });
  expect(encontro.professorId).toBe(professor);
  expect(await prisma.aplicacaoSubstituicaoAgendaSegundaChamada.count()).toBe(0);
});

it("aprova substituição no mesmo intervalo após autorização especial", async () => {
  const { base, inicio, fim } = intervaloComPausaInterna();
  const agenda = await agendaAplicada(false, inicio, fim);
  const substituto = (await criarUsuario(["PROFESSOR"])).id;
  const pendente = await prepararSubstituicao(agenda.reservaId, substituto);
  await pausaInterna(base, true);
  expect(await coberturaAutorizacao(inicio, fim)).toEqual([{ cobre: true }]);

  entrar(administrador);
  const decisao = await decidirSubstituicaoAgendaSegundaChamada({
    propostaId: pendente.id,
    propostaHash: pendente.entradaHash,
    aprovada: true,
    motivo: "Substituição coberta por autorização especial",
  });
  expect(decisao).toMatchObject({ ok: true, dado: { aplicada: true } });
  const encontro = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: agenda.encontroId } });
  expect(encontro.professorId).toBe(substituto);
});
