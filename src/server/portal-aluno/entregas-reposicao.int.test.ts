import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const sessao = vi.hoisted(() => ({ atual: { sessaoId: "sessao-portal", contaId: "", alunoId: "", email: "aluno@example.test" } }));
vi.mock("./sessao", () => ({ exigirSessaoPortalAluno: async () => sessao.atual }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { liberarEntregaReposicaoPausada, prorrogarPrazoEntregaReposicao, registrarEntregaReposicaoPortalAluno } from "./entregas-reposicao";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

const utc = (valor: Date) => Prisma.sql`${valor}::timestamptz AT TIME ZONE 'UTC'`;

it("prorrogação usa união das interrupções sem contar intervalos sobrepostos duas vezes", async () => {
  const agora = Date.now();
  const prazoBase = new Date(agora + 3_600_000);
  const materialId = await prepararReposicao("repo-prorrogar", matriculaId, alunoId, prazoBase);
  for (const [indice, inicio, fim] of [[1, agora-1_800_000, agora-600_000], [2, agora-1_200_000, agora]] as const) {
    const relatoId = `relato-prorrogar-${indice}`;
    await prisma.relatoIndisponibilidadeMaterialReposicao.create({ data: {
      id: relatoId, materialId, contaPortalAlunoId: sessao.atual.contaId, descricao: "Falha confirmada no material",
    } });
    await prisma.indisponibilidadeMaterialReposicao.create({ data: {
      materialId, relatoId, confirmadaPorId: gestorId, inicio: new Date(inicio), fim: new Date(fim), motivo: "Interrupção conferida",
    } });
  }
  authMock.mockResolvedValue({ user: { id: gestorId } });
  const vigente = new Date(prazoBase.getTime()+1_800_000);
  const novo = new Date(vigente.getTime()+600_000);
  const resultado = await prorrogarPrazoEntregaReposicao({ reposicaoId: "repo-prorrogar", prazoAnterior: vigente.toISOString(), novoPrazo: novo.toISOString(), motivo: "Prorrogação pedagógica justificada" });
  expect(resultado, JSON.stringify(resultado)).toMatchObject({ ok: true });
  expect(await prisma.prorrogacaoPrazoReposicao.findFirst({ where: { reposicaoId: "repo-prorrogar" } })).toMatchObject({ prazoAnterior: vigente, novoPrazo: novo });
});
let secretariaId: string, gestorId: string, alunoId: string, outroAlunoId: string, matriculaId: string, outraMatriculaId: string;
let catalogo: Awaited<ReturnType<typeof seedCatalogoMinimo>>;

it("interrupção após prorrogação amplia seu prazo e permite nova extensão com a mesma base no SQL", async () => {
  const agora = Date.now();
  const prazoBase = new Date(agora - 7_200_000);
  const materialId = await prepararReposicao("repo-prorroga-pausa", matriculaId, alunoId, prazoBase);
  const prazoProrrogado = new Date(agora + 3_600_000);
  await prisma.prorrogacaoPrazoReposicao.create({ data: {
    reposicaoId: "repo-prorroga-pausa", versao: 1, prazoAnterior: prazoBase,
    novoPrazo: prazoProrrogado, criadaEm: new Date(agora - 5_400_000),
    motivo: "Primeira prorrogação autorizada", autorizadaPorId: gestorId,
  } });
  const relato = await prisma.relatoIndisponibilidadeMaterialReposicao.create({ data: {
    materialId, contaPortalAlunoId: sessao.atual.contaId, descricao: "Interrupção durante o prazo prorrogado",
  } });
  await prisma.indisponibilidadeMaterialReposicao.create({ data: {
    materialId, relatoId: relato.id, confirmadaPorId: gestorId,
    inicio: new Date(agora - 3_600_000), fim: new Date(agora - 1_800_000), motivo: "Material regularizado após trinta minutos",
  } });
  const prazoVigente = new Date(prazoProrrogado.getTime() + 1_800_000);
  const novoPrazo = new Date(prazoVigente.getTime() + 600_000);
  authMock.mockResolvedValue({ user: { id: gestorId } });
  const resultado = await prorrogarPrazoEntregaReposicao({ reposicaoId: "repo-prorroga-pausa", prazoAnterior: prazoVigente.toISOString(), novoPrazo: novoPrazo.toISOString(), motivo: "Segunda extensão sobre prazo efetivo conferido" });
  expect(resultado, JSON.stringify(resultado)).toMatchObject({ ok: true });
  expect(await prisma.prorrogacaoPrazoReposicao.findFirst({ where: { reposicaoId: "repo-prorroga-pausa", versao: 2 } })).toMatchObject({ prazoAnterior: prazoVigente, novoPrazo });
});

async function prepararReposicao(id: string, donoMatriculaId: string, donoAlunoId: string, prazoAte: Date) {
  const professor = await criarUsuario(["PROFESSOR"]);
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: `N-${id}`, ordem: 1 } });
  const turma = await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: professor.id, dataInicio: new Date("2026-01-01T00:00:00.000Z") } });
  await prisma.alocacaoTurma.create({ data: { alunoId: donoAlunoId, matriculaId: donoMatriculaId, turmaId: turma.id, criadoEm: new Date("2026-01-01T00:00:00.000Z") } });
  const aula = await prisma.encontroAgenda.create({ data: {
    turmaId: turma.id, professorId: professor.id, preparadorId: secretariaId, inicio: new Date("2026-01-02T10:00:00.000Z"), fim: new Date("2026-01-02T11:00:00.000Z"),
    fusoOrigem: "UTC", status: "PREVISTO", motivo: "Aula original", chaveIdempotencia: `aula-${id}`, entradaHash: "fixture",
    diario: { create: { turmaId: turma.id, professorId: professor.id, ocorridaEm: new Date("2026-01-02T10:00:00.000Z"), conteudo: "Aula", registros: { create: { alunoId: donoAlunoId, matriculaId: donoMatriculaId, nomeAluno: "Aluno", presente: false, participacao: "FALTA" } } } },
  } });
  await prisma.encontroAgenda.update({ where: { id: aula.id }, data: { status: "MINISTRADO" } });
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "ReposicaoIndividual" (id,"aulaOriginalId","matriculaId",modalidade,"solicitanteId",motivo,evidencia,"chaveIdempotencia","entradaHash")
    VALUES (${id},${aula.id},${donoMatriculaId},'GRAVACAO'::"ModalidadeReposicaoIndividual",${secretariaId},'Reposição aprovada','Falta comprovada',${`chave-${id}`},'fixture')
  `);
  await prisma.$executeRaw(Prisma.sql`INSERT INTO "DecisaoReposicaoIndividual" (id,"reposicaoId","decisorId",aprovada,motivo) VALUES (${`decisao-${id}`},${id},${gestorId},true,'Aprovação independente')`);
  const material = `material-${id}`;
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "MaterialReposicaoGravacao" (id,"reposicaoId",provedor,"arquivoOficialId",disponivel,"publicadoPorId","publicadoEm")
    VALUES (${material},${id},'GOOGLE_DRIVE','drive-file-${id}',true,${secretariaId},${utc(new Date("2026-09-01T10:00:00.000Z"))})
  `);
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "DisponibilizacaoEntregaReposicao" (id,"reposicaoId","materialId","disponibilizadaEm","prazoBaseMinutos","prazoInicialAte","publicadaPorId")
    VALUES (${`disp-${id}`},${id},${material},${utc(new Date("2026-09-01T10:00:00.000Z"))},120,${utc(prazoAte)},${secretariaId})
  `);
  return material;
}

it.each(["RASCUNHO", "AGUARDANDO", "CANCELADA"] as const)("liberação pontual não abre matrícula %s", async (status) => {
  await prepararReposicao("repo-liberacao-status", matriculaId, alunoId, new Date(Date.now() + 3_600_000));
  await prisma.matricula.update({ where: { id: matriculaId }, data: { status } });
  authMock.mockResolvedValue({ user: { id: gestorId } });
  const resultado = await liberarEntregaReposicaoPausada({ reposicaoId: "repo-liberacao-status", contaId: sessao.atual.contaId, expiraEm: new Date(Date.now() + 3_600_000).toISOString(), motivo: "Verificação do alcance da liberação" });
  expect(resultado).toMatchObject({ ok: false });
  expect(await prisma.liberacaoEntregaReposicao.count()).toBe(0);
});

it("liberação pontual exige conta ativa e preserva a matrícula pausada", async () => {
  await prepararReposicao("repo-liberacao-conta", matriculaId, alunoId, new Date(Date.now() + 3_600_000));
  await prisma.matricula.update({ where: { id: matriculaId }, data: { status: "PAUSADA" } });
  authMock.mockResolvedValue({ user: { id: gestorId } });
  const entrada = { reposicaoId: "repo-liberacao-conta", contaId: sessao.atual.contaId, expiraEm: new Date(Date.now() + 3_600_000).toISOString(), motivo: "Concluir pendência identificada" };
  await prisma.contaPortalAluno.update({ where: { id: entrada.contaId }, data: { ativa: false } });
  expect(await liberarEntregaReposicaoPausada(entrada)).toMatchObject({ ok: false });
  expect(await prisma.liberacaoEntregaReposicao.count()).toBe(0);
  await prisma.contaPortalAluno.update({ where: { id: entrada.contaId }, data: { ativa: true } });
  expect(await liberarEntregaReposicaoPausada(entrada)).toMatchObject({ ok: true });
  expect(await prisma.liberacaoEntregaReposicao.count()).toBe(1);
  expect(await prisma.matricula.findUnique({ where: { id: matriculaId } })).toMatchObject({ status: "PAUSADA" });
});

beforeEach(async () => {
  await truncarBanco();
  catalogo = await seedCatalogoMinimo();
  secretariaId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  gestorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Aluno portal", paisId: catalogo.pais.id } })).id;
  outroAlunoId = (await prisma.aluno.create({ data: { primeiroNome: "Outro aluno", paisId: catalogo.pais.id } })).id;
  matriculaId = (await prisma.matricula.create({ data: { alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } })).id;
  outraMatriculaId = (await prisma.matricula.create({ data: { alunoId: outroAlunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } })).id;
  const conta = await prisma.contaPortalAluno.create({ data: { alunoId, ativa: true } });
  sessao.atual = { sessaoId: "sessao-portal", contaId: conta.id, alunoId, email: "aluno@example.test" };
});

it("recusa entrega em reposição da matrícula de outro aluno mesmo com id conhecido", async () => {
  await prepararReposicao("repo-outro-aluno", outraMatriculaId, outroAlunoId, new Date(Date.now() + 3_600_000));
  await expect(registrarEntregaReposicaoPortalAluno({ reposicaoId: "repo-outro-aluno", resumo: "Resumo de aluno alheio", atividade: "Atividade de aluno alheio", evidencia: "Tentativa cross matrícula" })).rejects.toThrow(/não pertence/i);
  await expect(prisma.$executeRaw(Prisma.sql`
    INSERT INTO "EntregaReposicaoGravacao" (id,"reposicaoId","alunoId",versao,resumo,atividade,evidencia,"entregueEm")
    VALUES ('forja-sem-conta','repo-outro-aluno',${outroAlunoId},1,'Resumo forjado','Atividade forjada','Docente não pode fingir aluno',${utc(new Date())})
  `)).rejects.toThrow(/conta/i);
  expect(await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT COUNT(*)::bigint AS total FROM "EntregaReposicaoGravacao" WHERE "reposicaoId" = 'repo-outro-aluno'`)).toEqual([{ total: BigInt(0) }]);
});

it("bloqueia envio depois do prazo sem criar versão nem oficializar conclusão", async () => {
  await prepararReposicao("repo-vencida", matriculaId, alunoId, new Date(Date.now() - 1_000));
  await expect(registrarEntregaReposicaoPortalAluno({ reposicaoId: "repo-vencida", resumo: "Resumo após prazo", atividade: "Atividade após prazo", evidencia: "Tentativa posterior" })).rejects.toThrow(/prazo/i);
  expect(await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT COUNT(*)::bigint AS total FROM "EntregaReposicaoGravacao" WHERE "reposicaoId" = 'repo-vencida'`)).toEqual([{ total: BigInt(0) }]);
  expect(await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT COUNT(*)::bigint AS total FROM "ConclusaoReposicaoIndividual" WHERE "reposicaoId" = 'repo-vencida'`)).toEqual([{ total: BigInt(0) }]);
});

it("pausa confirmada impede a entrega e a retomada preserva a fonte de aluno", async () => {
  const materialId = await prepararReposicao("repo-pausada", matriculaId, alunoId, new Date(Date.now() + 3_600_000));
  const relatoId = "relato-pausa";
  await prisma.$executeRaw(Prisma.sql`INSERT INTO "RelatoIndisponibilidadeMaterialReposicao" (id,"materialId","contaPortalAlunoId",descricao) VALUES (${relatoId},${materialId},${sessao.atual.contaId},'Arquivo oficial não reproduz')`);
  await prisma.$executeRaw(Prisma.sql`INSERT INTO "IndisponibilidadeMaterialReposicao" (id,"materialId","relatoId","confirmadaPorId",inicio,motivo) VALUES ('pausa-ativa',${materialId},${relatoId},${gestorId},${utc(new Date())},'Falha confirmada pela gestão')`);
  await expect(registrarEntregaReposicaoPortalAluno({ reposicaoId: "repo-pausada", resumo: "Resumo durante falha", atividade: "Atividade durante falha", evidencia: "Não deve registrar" })).rejects.toThrow(/indisponível/i);
  await prisma.$executeRaw(Prisma.sql`UPDATE "IndisponibilidadeMaterialReposicao" SET fim = ${utc(new Date())} WHERE id = 'pausa-ativa'`);
  const entrega = await registrarEntregaReposicaoPortalAluno({ reposicaoId: "repo-pausada", resumo: "Resumo depois da retomada", atividade: "Atividade depois da retomada", evidencia: "Envio do aluno autenticado" });
  const [fonte] = await prisma.$queryRaw<Array<{ alunoId: string; contaId: string | null }>>(Prisma.sql`SELECT "alunoId" AS "alunoId", "contaPortalAlunoId" AS "contaId" FROM "EntregaReposicaoGravacao" WHERE id = ${entrega.id}`);
  expect(fonte).toEqual({ alunoId, contaId: sessao.atual.contaId });
});


it("correção tem prazo próprio mesmo após expirar a primeira entrega", async () => {
  await prepararReposicao("repo-correcao", matriculaId, alunoId, new Date(Date.now() - 1000));
  const primeira = await prisma.entregaReposicaoGravacao.create({ data: {
    reposicaoId: "repo-correcao", alunoId, contaPortalAlunoId: sessao.atual.contaId,
    versao: 1, resumo: "Resumo da primeira entrega", atividade: "Atividade inicial", evidencia: "Entrega anterior",
    entregueEm: new Date(Date.now() - 60_000),
  } });
  const prazo = new Date(Date.now() + 3_600_000);
  const correcao = await prisma.solicitacaoCorrecaoEntregaReposicao.create({ data: {
    reposicaoId: "repo-correcao", entregaId: primeira.id, solicitadaPorId: gestorId,
    comentario: "Revisar as respostas indicadas", prazoBaseMinutos: 60, prazoAte: prazo,
  } });
  const resposta = await registrarEntregaReposicaoPortalAluno({ reposicaoId: "repo-correcao", resumo: "Resumo revisado", atividade: "Atividade corrigida", evidencia: "Resposta à correção" });
  expect(resposta.prazoAte).toBe(prazo.toISOString());
  expect(await prisma.entregaReposicaoGravacao.findUnique({ where: { id: resposta.id } })).toMatchObject({ versao: 2, solicitacaoCorrecaoId: correcao.id });
  expect(await prisma.solicitacaoCorrecaoEntregaReposicao.findUnique({ where: { id: correcao.id } })).toMatchObject({ situacao: "RESPONDIDA" });
});
