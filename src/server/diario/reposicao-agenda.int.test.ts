import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import {
  agendarReposicaoIndividual,
  consultarPreviaAgendaReposicaoIndividual,
  aplicarBeneficioReposicaoParticularMatricula,
  decidirAutorizacaoExcecaoReposicaoParticular,
  decidirExcecaoAgendaReposicaoIndividual,
  decidirRegraBeneficioReposicaoOferta,
  proporAutorizacaoExcecaoReposicaoParticular,
  proporCancelamentoReposicaoIndividual,
  proporExcecaoAgendaReposicaoIndividual,
  proporRegraBeneficioReposicaoOferta,
  decidirCancelamentoReposicaoIndividual,
  decidirRemarcacaoReposicaoIndividual,
  proporRemarcacaoReposicaoIndividual,
} from "./reposicao-agenda";
import { concluirReposicaoIndividual, registrarDiarioReposicaoIndividual, solicitarReposicaoIndividual } from "./reposicao-individual";
import { carregarReposicoesFrequenciaTx } from "@/server/avaliacoes/frequencia-reposicoes-tx";
import { aprovarCorrecaoAula, proporCorrecaoAula, revisarCorrecaoAula, revisarImpactosCorrecaoAula } from "./correcao-aula";

const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
let gestorId: string, adminId: string, secretariaId: string, professorId: string, alunoId: string, matriculaId: string, turmaId: string, produtoPaisId: string;
let aulaId: string, aulaExtraId: string;

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

async function regraESnapshot(chave = "regra-beneficio-001", quantidadePorPeriodo = 3) {
  entrar(gestorId);
  const proposta = await proporRegraBeneficioReposicaoOferta({ produtoPaisId, permiteParticular: true, referencia: "CIVIL", unidade: "MESES", duracaoPeriodo: 1, quantidadePorPeriodo, antecedenciaCancelamentoMinutos: 120, motivo: "Benefício acadêmico mensal de reposição", chaveIdempotencia: chave });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  entrar(adminId);
  expect(await decidirRegraBeneficioReposicaoOferta({ regraId: proposta.dado.id, aprovar: true, motivo: "Regra de oferta conferida independentemente" })).toMatchObject({ ok: true, dado: { aprovada: true } });
  entrar(gestorId);
  const aplicado = await aplicarBeneficioReposicaoParticularMatricula({ matriculaId, regraId: proposta.dado.id, motivo: "Aplicar snapshot da regra aprovada ao vínculo", chaveIdempotencia: `${chave}-snapshot` });
  if (!aplicado.ok || !aplicado.dado) throw new Error(JSON.stringify(aplicado));
  return { regraId: proposta.dado.id, beneficioId: aplicado.dado.id };
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
  produtoPaisId = (await prisma.produtoPais.findUniqueOrThrow({ where: { produtoId_paisId: { produtoId: catalogo.produto.id, paisId: catalogo.pais.id } } })).id;
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  turmaId = (await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId } })).id;
  await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId, turmaId, criadoEm: new Date("2026-09-01T00:00:00.000Z") } });
  aulaId = await criarAulaOriginal("aula-origem-agenda");
  aulaExtraId = await criarAulaOriginal("aula-origem-agenda-extra", "2026-09-11T10:00:00.000Z");
  entrar(secretariaId);
});

afterEach(() => vi.useRealTimers());

it("reserva benefício de oferta aprovada e cria encontro REPOSICAO ligado ao pedido exato", async () => {
  const { beneficioId } = await regraESnapshot();
  await inserirPedido("pedido-normal");
  entrar(secretariaId);
  const agenda = await agendarReposicaoIndividual({ reposicaoId: "pedido-normal", professorId, inicioLocal: "2026-10-06T10:00", fimLocal: "2026-10-06T11:00", fuso: "UTC", motivo: "Secretaria confirmou o horário com o aluno", chaveIdempotencia: "agenda-normal-001" });
  expect(agenda).toMatchObject({ ok: true, dado: { idempotente: false } });
  if (!agenda.ok || !agenda.dado) throw new Error(JSON.stringify(agenda));
  const [linha] = await prisma.$queryRaw<{ beneficioId: string; reposicaoId: string; encontroId: string; status: string; periodoInicio: Date; periodoFimExclusivo: Date; reposicaoIndividualId: string }[]>(Prisma.sql`
    SELECT a."beneficioId" AS "beneficioId",a."reposicaoId" AS "reposicaoId",a."encontroId" AS "encontroId",a."statusBeneficio"::text AS status,a."periodoInicio" AS "periodoInicio",a."periodoFimExclusivo" AS "periodoFimExclusivo",e."reposicaoIndividualId" AS "reposicaoIndividualId"
    FROM "AgendaReposicaoIndividual" a JOIN "EncontroAgenda" e ON e.id=a."encontroId" WHERE a.id=${agenda.dado.agendaId}
  `);
  expect(linha).toMatchObject({ beneficioId, reposicaoId: "pedido-normal", encontroId: agenda.dado.encontroId, reposicaoIndividualId: "pedido-normal", status: "RESERVADA", periodoInicio: new Date("2026-10-01T00:00:00.000Z"), periodoFimExclusivo: new Date("2026-11-01T00:00:00.000Z") });
  expect(await agendarReposicaoIndividual({ reposicaoId: "pedido-normal", professorId, inicioLocal: "2026-10-07T10:00", fimLocal: "2026-10-07T11:00", fuso: "UTC", motivo: "Tentativa duplicada não pode criar outro encontro", chaveIdempotencia: "agenda-normal-002" })).toMatchObject({ ok: false });
});

it("a prévia autenticada informa período, saldo e conflitos antes de confirmar a agenda", async () => {
  await regraESnapshot("regra-previa", 2);
  await inserirPedido("pedido-previa");
  entrar(secretariaId);
  expect(await consultarPreviaAgendaReposicaoIndividual({ reposicaoId: "pedido-previa", professorId, inicioLocal: "2026-10-06T10:00", fimLocal: "2026-10-06T11:00", fuso: "UTC" })).toMatchObject({
    ok: true, dado: { periodo: { inicio: "2026-10-01", fimExclusivo: "2026-11-01" }, quantidadePorPeriodo: 2, saldo: 2,
      conflitos: { encontros: 0, indisponibilidades: 0, reservas: 0 }, podeAgendar: true },
  });
  entrar(gestorId);
  expect(await consultarPreviaAgendaReposicaoIndividual({ reposicaoId: "pedido-previa", professorId, inicioLocal: "2026-10-06T10:00", fimLocal: "2026-10-06T11:00", fuso: "UTC" })).toMatchObject({ ok: false });
});

it("a última cota é reservável uma vez e bloqueia outra origem no mesmo período", async () => {
  await regraESnapshot("regra-uma-cota", 1);
  await inserirPedido("pedido-cota-1");
  entrar(secretariaId);
  expect(await agendarReposicaoIndividual({ reposicaoId: "pedido-cota-1", professorId, inicioLocal: "2026-10-06T10:00", fimLocal: "2026-10-06T11:00", fuso: "UTC", motivo: "Reserva da única cota acadêmica", chaveIdempotencia: "agenda-cota-1" })).toMatchObject({ ok: true });
  await inserirPedido("pedido-cota-2", aulaExtraId);
  expect(await agendarReposicaoIndividual({ reposicaoId: "pedido-cota-2", professorId, inicioLocal: "2026-10-07T10:00", fimLocal: "2026-10-07T11:00", fuso: "UTC", motivo: "Segunda reserva no mesmo período", chaveIdempotencia: "agenda-cota-2" })).toMatchObject({ ok: false });
});

it("dia não letivo exige exceção aprovada e Q34 agenda isenta sem consumir benefício", async () => {
  await prisma.versaoCalendarioEscolar.create({ data: { versao: 2, preparadorId: gestorId, fusoInstitucional: "UTC", periodos: [{ id: "recesso-outubro", nome: "Recesso de outubro", tipo: "RECESSO", inicio: "2026-10-12", fim: "2026-10-12" }], motivo: "Nova versão com recesso de outubro", chaveIdempotencia: "calendario-agenda-reposicao-v2", entradaHash: "fixture", decisao: { create: { decisorId: adminId, aprovada: true, motivo: "Nova versão do calendário conferida" } } } });
  await inserirPedido("pedido-excecao", aulaExtraId);
  entrar(secretariaId);
  const proposta = await proporExcecaoAgendaReposicaoIndividual({ reposicaoId: "pedido-excecao", professorId, inicioLocal: "2026-10-12T10:00", fimLocal: "2026-10-12T11:00", fuso: "UTC", motivo: "Aluno só tem disponibilidade no recesso", evidencia: "Solicitação registrada no atendimento", chaveIdempotencia: "excecao-calendario-001" });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  expect(await agendarReposicaoIndividual({ reposicaoId: "pedido-excecao", professorId, inicioLocal: "2026-10-12T10:00", fimLocal: "2026-10-12T11:00", fuso: "UTC", motivo: "Não pode agendar antes da exceção", chaveIdempotencia: "agenda-sem-excecao" })).toMatchObject({ ok: false });
  entrar(adminId);
  expect(await decidirExcecaoAgendaReposicaoIndividual({ excecaoId: proposta.dado.id, aprovar: true, motivo: "Exceção pontual de calendário conferida" })).toMatchObject({ ok: true });
  entrar(secretariaId);
  const autorizacao = await proporAutorizacaoExcecaoReposicaoParticular({ reposicaoId: "pedido-excecao", motivo: "Benefício excepcional aprovado para esta ausência", evidencia: "Autorização pedagógica documentada", chaveIdempotencia: "q34-proposta-001" });
  if (!autorizacao.ok || !autorizacao.dado) throw new Error(JSON.stringify(autorizacao));
  entrar(adminId);
  expect(await decidirAutorizacaoExcecaoReposicaoParticular({ autorizacaoId: autorizacao.dado.id, aprovar: true, motivo: "Gratuidade excepcional independente aprovada" })).toMatchObject({ ok: true });
  entrar(secretariaId);
  expect(await consultarPreviaAgendaReposicaoIndividual({ reposicaoId: "pedido-excecao", professorId, inicioLocal: "2026-10-12T10:00", fimLocal: "2026-10-12T11:00", fuso: "UTC", autorizacaoExcecaoId: autorizacao.dado.id })).toMatchObject({ ok: true, dado: { diasNaoLetivos: expect.any(Array), excecaoAgendaAprovada: true, podeAgendar: true } });
  const agenda = await agendarReposicaoIndividual({ reposicaoId: "pedido-excecao", professorId, inicioLocal: "2026-10-12T10:00", fimLocal: "2026-10-12T11:00", fuso: "UTC", autorizacaoExcecaoId: autorizacao.dado.id, motivo: "Agenda excepcional autorizada", chaveIdempotencia: "agenda-q34-001" });
  expect(agenda).toMatchObject({ ok: true });
  if (!agenda.ok || !agenda.dado) throw new Error(JSON.stringify(agenda));
  const [isenta] = await prisma.$queryRaw<{ beneficioId: string | null; status: string; autorizacaoId: string | null }[]>(Prisma.sql`SELECT "beneficioId" AS "beneficioId","statusBeneficio"::text AS status,"autorizacaoExcecaoId" AS "autorizacaoId" FROM "AgendaReposicaoIndividual" WHERE id=${agenda.dado.agendaId}`);
  expect(isenta).toEqual({ beneficioId: null, status: "ISENTA_EXCECAO", autorizacaoId: autorizacao.dado.id });
});

it("rejeição Q19 permanece possível e idempotente quando a proposta fica indisponível ou passada", async () => {
  await prisma.versaoCalendarioEscolar.create({ data: { versao: 2, preparadorId: gestorId, fusoInstitucional: "UTC", periodos: [{ id: "recesso-rejeicao", nome: "Recesso para rejeição", tipo: "RECESSO", inicio: "2026-10-12", fim: "2026-10-12" }], motivo: "Calendário para rejeitar proposta obsoleta", chaveIdempotencia: "calendario-rejeicao-q19", entradaHash: "fixture", decisao: { create: { decisorId: adminId, aprovada: true, motivo: "Calendário conferido" } } } });
  await inserirPedido("pedido-rejeitar-conflito");
  entrar(secretariaId);
  const conflito = await proporExcecaoAgendaReposicaoIndividual({ reposicaoId: "pedido-rejeitar-conflito", professorId, inicioLocal: "2026-10-12T10:00", fimLocal: "2026-10-12T11:00", fuso: "UTC", motivo: "Horário inicialmente disponível", evidencia: "Atendimento registrado", chaveIdempotencia: "excecao-rejeitar-conflito" });
  if (!conflito.ok || !conflito.dado) throw new Error(JSON.stringify(conflito));
  await criarAulaOriginal("conflito-posterior-q19", "2026-10-12T10:00:00.000Z");
  entrar(adminId);
  const rejeitada = await decidirExcecaoAgendaReposicaoIndividual({ excecaoId: conflito.dado.id, aprovar: false, motivo: "Conflito posterior impede a aprovação" });
  expect(rejeitada, JSON.stringify(rejeitada)).toMatchObject({ ok: true, dado: { aprovada: false } });
  expect(await decidirExcecaoAgendaReposicaoIndividual({ excecaoId: conflito.dado.id, aprovar: false, motivo: "Conflito posterior impede a aprovação" })).toEqual(rejeitada);

  await inserirPedido("pedido-rejeitar-passado", aulaExtraId);
  entrar(secretariaId);
  const passada = await proporExcecaoAgendaReposicaoIndividual({ reposicaoId: "pedido-rejeitar-passado", professorId, inicioLocal: "2026-10-12T12:00", fimLocal: "2026-10-12T13:00", fuso: "UTC", motivo: "Horário que se tornou obsoleto", evidencia: "Atendimento registrado", chaveIdempotencia: "excecao-rejeitar-passado" });
  if (!passada.ok || !passada.dado) throw new Error(JSON.stringify(passada));
  await prisma.excecaoAgendaReposicaoIndividual.update({ where: { id: passada.dado.id }, data: { inicio: new Date("2026-01-12T12:00:00.000Z"), fim: new Date("2026-01-12T13:00:00.000Z") } });
  entrar(adminId);
  expect(await decidirExcecaoAgendaReposicaoIndividual({ excecaoId: passada.dado.id, aprovar: false, motivo: "Horário passou antes da decisão" })).toMatchObject({ ok: true, dado: { aprovada: false } });
  expect(await prisma.decisaoExcecaoAgendaReposicaoIndividual.count({ where: { excecaoId: passada.dado.id, aprovada: false } })).toBe(1);
});

it("pedido rejeitado é terminal e não permite pendentes simultâneos para a mesma falta", async () => {
  await prisma.$executeRaw(Prisma.sql`INSERT INTO "ReposicaoIndividual" (id,"aulaOriginalId","matriculaId",modalidade,"solicitanteId",motivo,evidencia,"chaveIdempotencia","entradaHash") VALUES ('pedido-rejeitado',${aulaId},${matriculaId},'PARTICULAR'::"ModalidadeReposicaoIndividual",${gestorId},'Pedido anterior','Evidência anterior','pedido-rejeitado','fixture')`);
  await prisma.$executeRaw(Prisma.sql`INSERT INTO "DecisaoReposicaoIndividual" (id,"reposicaoId","decisorId",aprovada,motivo) VALUES ('decisao-rejeitada','pedido-rejeitado',${adminId},false,'Pedido não atendia a condição anterior')`);
  entrar(secretariaId);
  const novo = await solicitarReposicaoIndividual({ aulaOriginalId: aulaId, matriculaId, modalidade: "PARTICULAR", motivo: "Nova solicitação após decisão terminal", evidencia: "Nova documentação da ausência", chaveIdempotencia: "pedido-novo-q51" });
  expect(novo).toMatchObject({ ok: true });
  expect(await solicitarReposicaoIndividual({ aulaOriginalId: aulaId, matriculaId, modalidade: "PARTICULAR", motivo: "Não pode coexistir com pedido pendente", evidencia: "Outra documentação", chaveIdempotencia: "pedido-duplicado-q51" })).toMatchObject({ ok: false });
});

it("SQL direto não altera, remove ou recria saldo do snapshot no período atual", async () => {
  const { beneficioId } = await regraESnapshot("regra-snapshot-imutavel");
  await expect(prisma.beneficioReposicaoParticularMatricula.update({ where: { id: beneficioId }, data: { motivo: "Tentativa direta de alterar o snapshot" } })).rejects.toThrow("histórico");
  await expect(prisma.beneficioReposicaoParticularMatricula.delete({ where: { id: beneficioId } })).rejects.toThrow("histórico");
  await expect(prisma.$executeRaw(Prisma.sql`
    INSERT INTO "BeneficioReposicaoParticularMatricula"
      (id,"matriculaId","regraOfertaId",referencia,unidade,"duracaoPeriodo","referenciaCiclo","quantidadePorPeriodo","antecedenciaCancelamentoMinutos","vigenteAPartirDe","aplicadoPorId",motivo,"chaveIdempotencia","entradaHash")
    SELECT 'snapshot-fraude',b."matriculaId",b."regraOfertaId",b.referencia,b.unidade,b."duracaoPeriodo",b."referenciaCiclo",b."quantidadePorPeriodo",b."antecedenciaCancelamentoMinutos",b."vigenteAPartirDe" + 1,b."aplicadoPorId",'Tentativa de reabrir o saldo atual','snapshot-fraude-chave','fixture'
    FROM "BeneficioReposicaoParticularMatricula" b WHERE b.id=${beneficioId}
  `)).rejects.toThrow("Vigência do snapshot");
});

it("pedido de cancelamento apresentado no prazo devolve a reserva mesmo quando a decisão ocorre depois do limite", async () => {
  await regraESnapshot("regra-cancelamento-no-prazo");
  await inserirPedido("pedido-cancelamento-no-prazo");
  entrar(secretariaId);
  const agenda = await agendarReposicaoIndividual({ reposicaoId: "pedido-cancelamento-no-prazo", professorId, inicioLocal: "2026-10-20T10:00", fimLocal: "2026-10-20T11:00", fuso: "UTC", motivo: "Horário inicialmente confirmado", chaveIdempotencia: "agenda-cancelamento-no-prazo" });
  if (!agenda.ok || !agenda.dado) throw new Error(JSON.stringify(agenda));
  const agendaId = agenda.dado.agendaId;
  if (!agendaId) throw new Error("O agendamento não retornou a agenda criada.");
  const inicio = Date.parse("2026-10-20T10:00:00.000Z");
  vi.setSystemTime(new Date(inicio - 3 * 60 * 60_000));
  const proposta = await proporCancelamentoReposicaoIndividual({ agendaId, motivo: "Aluno avisou o cancelamento com antecedência", evidencia: "Registro do atendimento ao aluno", chaveIdempotencia: "cancelamento-no-prazo-001" });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  vi.setSystemTime(new Date(inicio + 3 * 60 * 60_000));
  entrar(adminId);
  const decisao = await decidirCancelamentoReposicaoIndividual({ propostaId: proposta.dado.id, aprovar: true, motivo: "Gestão confirmou o cancelamento apresentado no prazo" });
  expect(decisao).toMatchObject({ ok: true, dado: { resultado: "DEVOLVE_BENEFICIO" } });
  const [linha] = await prisma.$queryRaw<{ status: string; encontroStatus: string; solicitadaEm: Date; devolvidaEm: Date | null }[]>(Prisma.sql`
    SELECT a."statusBeneficio"::text AS status,e.status::text AS "encontroStatus",p."solicitadaEm" AS "solicitadaEm",a."devolvidaEm" AS "devolvidaEm"
    FROM "AgendaReposicaoIndividual" a JOIN "EncontroAgenda" e ON e.id=a."encontroId"
    JOIN "PropostaCancelamentoAgendaReposicaoIndividual" p ON p."agendaId"=a.id
    WHERE a.id=${agendaId}
  `);
  expect(linha).toMatchObject({ status: "DEVOLVIDA", encontroStatus: "CANCELADO" });
  expect(linha.solicitadaEm.toISOString()).toBe(new Date(inicio - 3 * 60 * 60_000).toISOString());
  expect(linha.devolvidaEm).toBeInstanceOf(Date);
});

it("repetir a mesma decisão de cancelamento devolve o resultado persistido após o encontro já estar cancelado", async () => {
  await regraESnapshot("regra-replay-cancelamento");
  await inserirPedido("pedido-replay-cancelamento");
  entrar(secretariaId);
  const agenda = await agendarReposicaoIndividual({ reposicaoId: "pedido-replay-cancelamento", professorId, inicioLocal: "2026-10-21T10:00", fimLocal: "2026-10-21T11:00", fuso: "UTC", motivo: "Horário inicialmente confirmado", chaveIdempotencia: "agenda-replay-cancelamento" });
  if (!agenda.ok || !agenda.dado) throw new Error(JSON.stringify(agenda));
  const agendaId = agenda.dado.agendaId;
  if (!agendaId) throw new Error("O agendamento não retornou a agenda criada.");
  const proposta = await proporCancelamentoReposicaoIndividual({ agendaId, motivo: "Cancelamento registrado pela Secretaria", evidencia: "Atendimento registrado na matrícula", chaveIdempotencia: "cancelamento-replay-001" });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  entrar(adminId);
  const primeira = await decidirCancelamentoReposicaoIndividual({ propostaId: proposta.dado.id, aprovar: true, motivo: "Gestão confirmou o cancelamento solicitado" });
  const repetida = await decidirCancelamentoReposicaoIndividual({ propostaId: proposta.dado.id, aprovar: true, motivo: "Gestão confirmou o cancelamento solicitado" });
  expect(primeira).toMatchObject({ ok: true, dado: { idempotente: false } });
  expect(repetida).toMatchObject({ ok: true, dado: { idempotente: true } });
  if (!primeira.ok || !primeira.dado || !repetida.ok || !repetida.dado) throw new Error("Decisão de cancelamento não confirmada.");
  expect(repetida.dado.id).toBe(primeira.dado.id);
});

it("remarcação troca a reserva para o período novo, preserva o encontro antigo cancelado e repete a decisão", async () => {
  await regraESnapshot("regra-remarca-periodo", 2);
  await inserirPedido("pedido-remarca-periodo");
  entrar(secretariaId);
  const agenda = await agendarReposicaoIndividual({ reposicaoId: "pedido-remarca-periodo", professorId, inicioLocal: "2026-10-20T10:00", fimLocal: "2026-10-20T11:00", fuso: "UTC", motivo: "Horário original da particular", chaveIdempotencia: "agenda-remarca-periodo" });
  if (!agenda.ok || !agenda.dado?.agendaId || !agenda.dado.encontroId) throw new Error(JSON.stringify(agenda));
  const proposta = await proporRemarcacaoReposicaoIndividual({ agendaId: agenda.dado.agendaId, professorId, inicioLocal: "2026-11-05T10:00", fimLocal: "2026-11-05T11:00", fuso: "UTC", motivo: "Aluno pediu nova data no período seguinte", evidencia: "Atendimento documentado para remarcação", chaveIdempotencia: "remarca-periodo-001" });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  entrar(adminId);
  const primeira = await decidirRemarcacaoReposicaoIndividual({ propostaId: proposta.dado.id, aprovar: true, motivo: "Gestão conferiu disponibilidade e reserva" });
  const replay = await decidirRemarcacaoReposicaoIndividual({ propostaId: proposta.dado.id, aprovar: true, motivo: "Gestão conferiu disponibilidade e reserva" });
  expect(primeira).toMatchObject({ ok: true, dado: { aprovada: true, idempotente: false } });
  expect(replay).toMatchObject({ ok: true, dado: { aprovada: true, idempotente: true } });
  if (!primeira.ok || !primeira.dado?.encontroId) throw new Error(JSON.stringify(primeira));
  expect(replay).toMatchObject({ ok: true, dado: { encontroId: primeira.dado.encontroId } });
  const [linha] = await prisma.$queryRaw<{ encontroId: string; periodoInicio: Date; periodoFim: Date; statusBeneficio: string; antigoStatus: string; novoStatus: string; encontros: bigint }[]>(Prisma.sql`
    SELECT a."encontroId" AS "encontroId",a."periodoInicio" AS "periodoInicio",a."periodoFimExclusivo" AS "periodoFim",a."statusBeneficio"::text AS "statusBeneficio",
      antigo.status::text AS "antigoStatus",novo.status::text AS "novoStatus",
      (SELECT count(*)::bigint FROM "EncontroAgenda" WHERE "reposicaoIndividualId"='pedido-remarca-periodo') AS encontros
    FROM "AgendaReposicaoIndividual" a
    JOIN "EncontroAgenda" antigo ON antigo.id=${agenda.dado.encontroId}
    JOIN "EncontroAgenda" novo ON novo.id=a."encontroId"
    WHERE a.id=${agenda.dado.agendaId}
  `);
  expect(linha).toMatchObject({ encontroId: primeira.dado.encontroId, periodoInicio: new Date("2026-11-01T00:00:00.000Z"), periodoFim: new Date("2026-12-01T00:00:00.000Z"), statusBeneficio: "RESERVADA", antigoStatus: "CANCELADO", novoStatus: "PREVISTO", encontros: BigInt(2) });
  const fontes = await prisma.$transaction(tx => carregarReposicoesFrequenciaTx(tx, { matriculaId, aulaOriginalIds: [aulaId], apuradaEm: new Date("2026-12-01T00:00:00.000Z") }));
  expect(fontes.get(aulaId) ?? []).toHaveLength(0);
});

it("remarcação não troca agenda quando a cota do período novo já foi ocupada", async () => {
  await regraESnapshot("regra-remarca-sem-saldo", 1);
  await inserirPedido("pedido-remarca-sem-saldo");
  await inserirPedido("pedido-ocupante-novembro", aulaExtraId);
  entrar(secretariaId);
  const original = await agendarReposicaoIndividual({ reposicaoId: "pedido-remarca-sem-saldo", professorId, inicioLocal: "2026-10-20T10:00", fimLocal: "2026-10-20T11:00", fuso: "UTC", motivo: "Reserva original no período de outubro", chaveIdempotencia: "agenda-remarca-sem-saldo" });
  const ocupante = await agendarReposicaoIndividual({ reposicaoId: "pedido-ocupante-novembro", professorId, inicioLocal: "2026-11-10T10:00", fimLocal: "2026-11-10T11:00", fuso: "UTC", motivo: "Reserva que ocupa a única cota de novembro", chaveIdempotencia: "agenda-ocupante-novembro" });
  if (!original.ok || !original.dado?.agendaId || !original.dado.encontroId || !ocupante.ok) throw new Error(JSON.stringify({ original, ocupante }));
  const proposta = await proporRemarcacaoReposicaoIndividual({ agendaId: original.dado.agendaId, professorId, inicioLocal: "2026-11-05T10:00", fimLocal: "2026-11-05T11:00", fuso: "UTC", motivo: "Proposta para o período já ocupado", evidencia: "Atendimento documentado para remarcação", chaveIdempotencia: "remarca-sem-saldo-001" });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  entrar(adminId);
  expect(await decidirRemarcacaoReposicaoIndividual({ propostaId: proposta.dado.id, aprovar: true, motivo: "Gestão revalidou a disponibilidade do período" })).toMatchObject({ ok: false });
  const [linha] = await prisma.$queryRaw<{ encontroId: string; status: string; periodoInicio: Date }[]>(Prisma.sql`
    SELECT a."encontroId" AS "encontroId",e.status::text AS status,a."periodoInicio" AS "periodoInicio"
    FROM "AgendaReposicaoIndividual" a JOIN "EncontroAgenda" e ON e.id=a."encontroId" WHERE a.id=${original.dado.agendaId}
  `);
  expect(linha).toEqual({ encontroId: original.dado.encontroId, status: "PREVISTO", periodoInicio: new Date("2026-10-01T00:00:00.000Z") });
  expect(await prisma.encontroAgenda.count({ where: { reposicaoIndividualId: "pedido-remarca-sem-saldo" } })).toBe(1);
});

it("remarcação normal consome benefício ao registrar diário, conclui uma única fonte e não usa o encontro cancelado", async () => {
  // A conclusão SQL usa o relógio real: agendar e remarcar no passado simulado,
  // mas realizar em data já transcorrida também no banco.
  vi.setSystemTime(new Date("2026-09-12T12:00:00.000Z"));
  await regraESnapshot("regra-remarca-consumo", 2);
  await inserirPedido("pedido-remarca-consumo");
  entrar(secretariaId);
  const agenda = await agendarReposicaoIndividual({ reposicaoId: "pedido-remarca-consumo", professorId, inicioLocal: "2026-09-13T10:00", fimLocal: "2026-09-13T11:00", fuso: "UTC", motivo: "Reserva normal para consumo posterior", chaveIdempotencia: "agenda-remarca-consumo" });
  if (!agenda.ok || !agenda.dado?.agendaId || !agenda.dado.encontroId) throw new Error(JSON.stringify(agenda));
  const proposta = await proporRemarcacaoReposicaoIndividual({ agendaId: agenda.dado.agendaId, professorId, inicioLocal: "2026-09-14T10:00", fimLocal: "2026-09-14T11:00", fuso: "UTC", motivo: "Nova data confirmada com o aluno", evidencia: "Atendimento documentado para a nova data", chaveIdempotencia: "remarca-consumo-001" });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  entrar(adminId);
  const decisao = await decidirRemarcacaoReposicaoIndividual({ propostaId: proposta.dado.id, aprovar: true, motivo: "Gestão autorizou a nova data da reposição" });
  if (!decisao.ok || !decisao.dado?.encontroId) throw new Error(JSON.stringify(decisao));
  vi.setSystemTime(new Date("2026-09-14T12:00:00.000Z"));
  entrar(professorId);
  expect(await registrarDiarioReposicaoIndividual({ reposicaoId: "pedido-remarca-consumo", encontroReposicaoId: decisao.dado.encontroId, conteudo: "Reposição individual realizada na data remarcada", participacao: "PRESENTE" })).toMatchObject({ ok: true });
  const conclusao = await concluirReposicaoIndividual({ reposicaoId: "pedido-remarca-consumo", versaoAnterior: 0, encontroReposicaoId: decisao.dado.encontroId, evidencia: "Diário da particular remarcada e presença do aluno" });
  expect(conclusao, JSON.stringify(conclusao)).toMatchObject({ ok: true });
  const [linha] = await prisma.$queryRaw<{ status: string; antigo: string }[]>(Prisma.sql`
    SELECT a."statusBeneficio"::text AS status,antigo.status::text AS antigo
    FROM "AgendaReposicaoIndividual" a JOIN "EncontroAgenda" antigo ON antigo.id=${agenda.dado.encontroId}
    WHERE a.id=${agenda.dado.agendaId}
  `);
  expect(linha).toEqual({ status: "CONSUMIDA", antigo: "CANCELADO" });
  const fontes = await prisma.$transaction(tx => carregarReposicoesFrequenciaTx(tx, { matriculaId, aulaOriginalIds: [aulaId], apuradaEm: new Date("2026-10-24T00:00:00.000Z") }));
  expect(fontes.get(aulaId) ?? []).toHaveLength(1);
  const beneficioConsumido = await prisma.agendaReposicaoIndividual.findUniqueOrThrow({ where: { id: agenda.dado.agendaId } });
  entrar(gestorId);
  const fonte = await revisarCorrecaoAula({ encontroId: aulaId });
  if (!fonte.ok || !fonte.dado) throw new Error(JSON.stringify(fonte));
  const correcao = await proporCorrecaoAula({ encontroId: aulaId, estadoHash: fonte.dado.estadoHash, versaoEsperada: fonte.dado.versaoAtual,
    chaveIdempotencia: "q23-particular-consumida-463", motivo: "Corrigir a presença original preservando a particular já realizada.", evidencia: "Conferência pedagógica da participação.",
    alteracao: { conteudo: fonte.dado.snapshot.conteudo, registros: fonte.dado.snapshot.registros.map(r => ({ registroId: r.registroId,
      participacao: "PRESENTE", observacao: r.observacao })) } });
  if (!correcao.ok || !correcao.dado) throw new Error(JSON.stringify(correcao));
  entrar(adminId);
  const impactos = await revisarImpactosCorrecaoAula({ propostaId: correcao.dado.id });
  if (!impactos.ok || !impactos.dado) throw new Error(JSON.stringify(impactos));
  expect(impactos.dado.reposicoesPreservaveisIds).toEqual(["pedido-remarca-consumo"]);
  expect(await aprovarCorrecaoAula({ propostaId: correcao.dado.id, propostaHash: impactos.dado.propostaHash,
    impactosHash: impactos.dado.impactosHash, motivo: "Administração preserva a particular concluída e a cota consumida.", confirmarPreservacaoReposicoes: true }))
    .toMatchObject({ ok: true });
  expect(await prisma.agendaReposicaoIndividual.findUniqueOrThrow({ where: { id: agenda.dado.agendaId } })).toEqual(beneficioConsumido);
  expect(await prisma.conclusaoReposicaoIndividual.count({ where: { reposicaoId: "pedido-remarca-consumo" } })).toBe(1);
  expect(await prisma.cobranca.count()).toBe(0);
  expect(await prisma.recebimento.count()).toBe(0);
});
