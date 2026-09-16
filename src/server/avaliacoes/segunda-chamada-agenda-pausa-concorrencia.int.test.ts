import { beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { consultarSubstituicaoAgendaSegundaChamada, proporSubstituicaoAgendaSegundaChamada,
  } from "./segunda-chamada-substituicao";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import { decidirRegraAvaliacaoTx, prepararRegraAvaliacaoTx } from "./regras-tx";
import { decidirSegundaChamada, proporSegundaChamada } from "./segunda-chamada";
import { disponibilizarSegundaChamada } from "./segunda-chamada-disponibilizacao";
import { consultarPreviaAgendaInicialSegundaChamada, proporAgendaInicialSegundaChamada,
  decidirAgendaInicialSegundaChamada } from "./segunda-chamada-agenda-inicial";
import { consultarRemarcacoesAgendaSegundaChamada, proporRemarcacaoAgendaSegundaChamada } from "./segunda-chamada-remarcacao";
import { solicitarPausaMatriculas, decidirPropostaPausaMatriculas } from "@/server/matricula/pausa-proposta";
import { aplicarPausaMatriculasTx } from "@/server/matricula/pausa-execucao";

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

async function propostaRemarcacao(reservaId: string) {
  entrar(gestor);
  const consulta = await consultarRemarcacoesAgendaSegundaChamada({ reservaId });
  if (!consulta.ok || !consulta.dado) throw new Error(JSON.stringify(consulta));
  const inicio = new Date(Date.now() + 2 * 60 * 60_000);
  const entrada = {
    reservaId,
    estadoConferido: consulta.dado.estadoHash,
    inicio: inicio.toISOString(),
    fim: new Date(inicio.getTime() + 30 * 60_000).toISOString(),
    fusoOrigem: "UTC",
    motivo: "Remarcação pendente antes da pausa concorrente",
    evidencia: "Disponibilidade conferida antes da decisão",
    chaveIdempotencia: "remarcacao-pausa-concorrente",
  };
  const criada = await proporRemarcacaoAgendaSegundaChamada(entrada);
  if (!criada.ok || !criada.dado) throw new Error(JSON.stringify(criada));
  const [persistida] = await prisma.$queryRaw<{ entradaHash: string }[]>`
    SELECT "entradaHash" AS "entradaHash"
    FROM "PropostaRemarcacaoAgendaSegundaChamada" WHERE id=${criada.dado.id}
  `;
  if (!persistida) throw new Error("Proposta de remarcação ausente.");
  return { ...criada.dado, entradaHash: persistida.entradaHash };
}

async function prepararPausa() {
  const financeiro = (await criarUsuario(["FINANCEIRO"])).id;
  const matricula = await prisma.matricula.update({
    where: { id: matriculaId },
    data: { referenciaCobertura: "MES_CIVIL" },
  });
  entrar(administrador);
  const criada = await solicitarPausaMatriculas(matricula.alunoId, {
    matriculaIds: [matriculaId],
    dataEfetiva: new Date().toISOString().slice(0, 10),
    motivo: "Pausa concorrente à decisão de segunda chamada",
    chaveIdempotencia: "pausa-concorrencia",
  });
  if (!criada.ok || !criada.dado) throw new Error(JSON.stringify(criada));
  entrar(financeiro);
  expect(await decidirPropostaPausaMatriculas(criada.dado.propostaId, {
    aprovar: true,
    motivo: "Pausa conferida pela área financeira",
  })).toMatchObject({ ok: true });
  return criada.dado.propostaId;
}

async function segurarPausa(propostaId: string) {
  let concluir!: (confirmar: boolean) => void;
  let sinalizar!: () => void;
  const conclusao = new Promise<boolean>((resolve) => { concluir = resolve; });
  const aplicada = new Promise<void>((resolve) => { sinalizar = resolve; });
  const transacao = prisma.$transaction(async (tx) => {
    await aplicarPausaMatriculasTx(tx, propostaId, administrador, new Date());
    sinalizar();
    if (!await conclusao) throw new Error("rollback-intencional-da-pausa");
  }, { timeout: 10_000 });
  await Promise.race([
    aplicada,
    transacao.then(
      () => { throw new Error("A pausa encerrou antes de liberar a decisão concorrente."); },
      (erro) => { throw erro; },
    ),
  ]);
  let confirmada: boolean | undefined;
  return {
    finalizar: async (confirmar: boolean) => {
      if (confirmada === undefined) {
        confirmada = confirmar;
        concluir(confirmar);
      }
      if (confirmada) return transacao;
      await expect(transacao).rejects.toThrow("rollback-intencional-da-pausa");
    },
    transacao,
  };
}

function iniciarSql(sql: Promise<unknown>) {
  return sql.then(
    () => ({ ok: true as const }),
    (erro: unknown) => ({ ok: false as const, erro }),
  );
}

async function aguardarBloqueio(query: string) {
  let esperando = false;
  for (let tentativa = 0; tentativa < 100; tentativa++) {
    const [estado] = await prisma.$queryRaw<{ esperando: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM pg_stat_activity a
        WHERE a.datname=current_database()
          AND a.state='active'
          AND a.wait_event_type='Lock'
          AND a.query LIKE ${`%${query}%`}
          AND cardinality(pg_blocking_pids(a.pid)) > 0
      ) AS esperando
    `;
    if (estado?.esperando) {
      esperando = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  expect(esperando).toBe(true);
}

it("decisão SQL inicial bloqueada aprova quando a pausa concorrente faz rollback", async () => {
  const pendente = await propostaAgenda();
  const pausa = await segurarPausa(await prepararPausa());
  const decisao = iniciarSql(prisma.$executeRaw`
    INSERT INTO "DecisaoAgendaSegundaChamada" (id,"propostaId","decisorId",aprovada,"autorizarDiaNaoLetivo",motivo)
    VALUES (${"decisao-inicial-pausa-rollback"},${pendente.id},${administrador},true,false,${"Decisão após rollback da pausa"})
  `);
  try {
    await aguardarBloqueio("DecisaoAgendaSegundaChamada");
    await pausa.finalizar(false);
    expect(await decisao).toEqual({ ok: true });
  } finally {
    await pausa.finalizar(false).catch(() => undefined);
  }
  expect(await prisma.reservaSegundaChamada.count()).toBe(1);
  expect(await prisma.encontroAgenda.count({ where: { finalidade: "SEGUNDA_CHAMADA" } })).toBe(1);
});

it("decisão SQL inicial espera a pausa concorrente e é negada após o commit", async () => {
  const pendente = await propostaAgenda();
  const pausa = await segurarPausa(await prepararPausa());
  const decisao = iniciarSql(prisma.$executeRaw`
    INSERT INTO "DecisaoAgendaSegundaChamada" (id,"propostaId","decisorId",aprovada,"autorizarDiaNaoLetivo",motivo)
    VALUES (${"decisao-inicial-pausa-concorrente"},${pendente.id},${administrador},true,false,${"Decisão bloqueada pela pausa"})
  `);
  try {
    await aguardarBloqueio("DecisaoAgendaSegundaChamada");
    await pausa.finalizar(true);
    const resultado = await decisao;
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.erro).toMatchObject({ message: expect.stringMatching(/Situação contratual não permite todo o intervalo da agenda inicial/) });
  } finally {
    await pausa.finalizar(false).catch(() => undefined);
  }
  expect(await prisma.reservaSegundaChamada.count()).toBe(0);
  expect(await prisma.encontroAgenda.count({ where: { finalidade: "SEGUNDA_CHAMADA" } })).toBe(0);
});

it("decisão SQL de remarcação espera a pausa concorrente e preserva a agenda anterior", async () => {
  const agenda = await agendaAplicada();
  const pendente = await propostaRemarcacao(agenda.reservaId);
  const pausa = await segurarPausa(await prepararPausa());
  const decisao = iniciarSql(prisma.$executeRaw`
    INSERT INTO "DecisaoRemarcacaoAgendaSegundaChamada" (id,"propostaId","decisorId",aprovada,motivo)
    VALUES (${"decisao-remarcacao-pausa-concorrente"},${pendente.id},${administrador},true,${"Remarcação bloqueada pela pausa"})
  `);
  try {
    await aguardarBloqueio("DecisaoRemarcacaoAgendaSegundaChamada");
    await pausa.finalizar(true);
    const resultado = await decisao;
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.erro).toMatchObject({ message: expect.stringMatching(/Situação contratual não permite todo o intervalo/) });
  } finally {
    await pausa.finalizar(false).catch(() => undefined);
  }
  expect(await prisma.decisaoRemarcacaoAgendaSegundaChamada.count({ where: { propostaId: pendente.id } })).toBe(0);
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: agenda.encontroId } })).toMatchObject({ status: "PREVISTO" });
});

it("decisão SQL de substituição espera a pausa concorrente e não troca o professor", async () => {
  const agenda = await agendaAplicada();
  const substituto = (await criarUsuario(["PROFESSOR"])).id;
  const pendente = await prepararSubstituicao(agenda.reservaId, substituto);
  const pausa = await segurarPausa(await prepararPausa());
  const decisao = iniciarSql(prisma.$executeRaw`
    INSERT INTO "DecisaoSubstituicaoAgendaSegundaChamada" (id,"propostaId","decisorId",aprovada,motivo)
    VALUES (${"decisao-substituicao-pausa-concorrente"},${pendente.id},${administrador},true,${"Substituição bloqueada pela pausa"})
  `);
  try {
    await aguardarBloqueio("DecisaoSubstituicaoAgendaSegundaChamada");
    await pausa.finalizar(true);
    const resultado = await decisao;
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.erro).toMatchObject({ message: expect.stringMatching(/Substituição desatualizada exige nova proposta/) });
  } finally {
    await pausa.finalizar(false).catch(() => undefined);
  }
  expect(await prisma.aplicacaoSubstituicaoAgendaSegundaChamada.count()).toBe(0);
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: agenda.encontroId } })).toMatchObject({ professorId: professor });
});

it("decisão direta não bloqueia proposta antes do calendário e não inverte a ordem do servidor", async () => {
  const agenda = await agendaAplicada();
  const substituto = (await criarUsuario(["PROFESSOR"])).id;
  const pendente = await prepararSubstituicao(agenda.reservaId, substituto);
  let pronta!: () => void, liberar!: () => void, conferir!: () => void;
  const pronto = new Promise<void>(resolve => { pronta = resolve; });
  const liberacao = new Promise<void>(resolve => { liberar = resolve; });
  const conferencia = new Promise<void>(resolve => { conferir = resolve; });
  let conferida!: () => void;
  const lockConferido = new Promise<void>(resolve => { conferida = resolve; });
  const bloqueio = prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola',0))`;
    pronta();
    await conferencia;
    await tx.$queryRaw`SELECT id FROM "PropostaSubstituicaoAgendaSegundaChamada" WHERE id=${pendente.id} FOR UPDATE NOWAIT`;
    conferida();
    await liberacao;
  }, { timeout: 10000 });
  const observarFalha = bloqueio.then(() => { throw new Error("Bloqueio terminou antes da conferência"); });
  observarFalha.catch(() => undefined);
  await Promise.race([pronto, observarFalha]);
  const decisao = iniciarSql(prisma.$executeRaw`
    INSERT INTO "DecisaoSubstituicaoAgendaSegundaChamada" (id,"propostaId","decisorId",aprovada,motivo)
    VALUES ('substituicao-ordem-bloqueios',${pendente.id},${administrador},true,'Conferência de ordem sem inversão')
  `);
  try {
    await aguardarBloqueio("DecisaoSubstituicaoAgendaSegundaChamada");
    conferir();
    await Promise.race([lockConferido, observarFalha]);
    liberar();
    await bloqueio;
    expect(await decisao).toEqual({ ok: true });
  } finally {
    conferir(); liberar();
    await bloqueio.catch(() => undefined);
    await decisao;
  }
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: agenda.encontroId } })).toMatchObject({ professorId: substituto });
});

it.each(["INICIAL", "REMARCACAO", "SUBSTITUICAO"] as const)("%s rejeita proposta obsoleta sem autorizar sua aplicação", async tipo => {
  let propostaId: string;
  const tabelas = {
    INICIAL: '"DecisaoAgendaSegundaChamada"',
    REMARCACAO: '"DecisaoRemarcacaoAgendaSegundaChamada"',
    SUBSTITUICAO: '"DecisaoSubstituicaoAgendaSegundaChamada"',
  };
  if (tipo === "INICIAL") propostaId = (await propostaAgenda()).id;
  else {
    const agenda = await agendaAplicada();
    if (tipo === "REMARCACAO") propostaId = (await propostaRemarcacao(agenda.reservaId)).id;
    else propostaId = (await prepararSubstituicao(agenda.reservaId, (await criarUsuario(["PROFESSOR"])).id)).id;
  }
  const antiga = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const outra = await prisma.matricula.create({ data: {
    alunoId: antiga.alunoId, produtoId: antiga.produtoId, paisId: antiga.paisId,
    moeda: antiga.moeda, status: "ATIVA", ativadaEm: antiga.ativadaEm,
  } });
  await prisma.alocacaoTurma.update({ where: { id: alocacaoId }, data: { matriculaId: outra.id } });
  const tabela = Prisma.raw(tabelas[tipo]);
  await expect(prisma.$executeRaw(Prisma.sql`
    INSERT INTO ${tabela} (id,"propostaId","decisorId",aprovada,motivo)
    VALUES (${`aprovacao-obsoleta-${tipo}`},${propostaId},${administrador},true,'Tentativa de aplicação com vínculo alterado')
  `)).rejects.toThrow(/Contexto da segunda chamada mudou/);
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO ${tabela} (id,"propostaId","decisorId",aprovada,motivo)
    VALUES (${`rejeicao-obsoleta-${tipo}`},${propostaId},${administrador},false,'Rejeição da proposta cujo vínculo foi alterado')
  `);
  expect(await prisma.$queryRaw(Prisma.sql`SELECT aprovada FROM ${tabela} WHERE "propostaId"=${propostaId}`)).toEqual([{ aprovada: false }]);
  expect(await prisma.aplicacaoRemarcacaoAgendaSegundaChamada.count()).toBe(0);
  expect(await prisma.aplicacaoSubstituicaoAgendaSegundaChamada.count()).toBe(0);
  expect(await prisma.encontroAgenda.count({ where: { finalidade: "SEGUNDA_CHAMADA" } })).toBe(tipo === "INICIAL" ? 0 : 1);
  expect(await prisma.cobranca.count()).toBe(0);
});
