import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const portal = vi.hoisted(() => ({ sessao: { sessaoId: "sessao", contaId: "", alunoId: "", email: "aluno@example.test" } }));
vi.mock("./sessao", () => ({ exigirSessaoPortalAluno: async () => portal.sessao }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { consultarEntregaGravacaoPortalAluno, exigirReposicaoDoPortalAluno, listarReposicoesDoPortalAluno } from "./reposicoes";

const utc = (valor: Date) => Prisma.sql`${valor}::timestamptz AT TIME ZONE 'UTC'`;

let secretariaId: string;
let gestorId: string;
let adminId: string;
let professorId: string;
let alunoId: string;
let matriculaId: string;
let contaId: string;
let catalogo: Awaited<ReturnType<typeof seedCatalogoMinimo>>;

async function prepararReposicao() {
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "CONCLUSAO-A1", ordem: 1 } });
  const turma = await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId, dataInicio: new Date("2026-01-01T00:00:00.000Z") } });
  await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId, turmaId: turma.id, criadoEm: new Date("2026-01-01T00:00:00.000Z") } });
  const aula = await prisma.encontroAgenda.create({ data: {
    turmaId: turma.id, professorId, preparadorId: secretariaId,
    inicio: new Date("2026-01-02T10:00:00.000Z"), fim: new Date("2026-01-02T11:00:00.000Z"), fusoOrigem: "UTC", status: "PREVISTO",
    motivo: "Aula original", chaveIdempotencia: "aula-conclusao-portal", entradaHash: "fixture",
    diario: { create: { turmaId: turma.id, professorId, ocorridaEm: new Date("2026-01-02T10:00:00.000Z"), conteudo: "Aula", registros: { create: { alunoId, matriculaId, nomeAluno: "Aluno", presente: false, participacao: "FALTA" } } } },
  } });
  await prisma.encontroAgenda.update({ where: { id: aula.id }, data: { status: "MINISTRADO" } });
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "ReposicaoIndividual" (id,"aulaOriginalId","matriculaId",modalidade,"solicitanteId",motivo,evidencia,"chaveIdempotencia","entradaHash")
    VALUES ('repo-conclusao-portal',${aula.id},${matriculaId},'GRAVACAO'::"ModalidadeReposicaoIndividual",${secretariaId},'Reposição gravada autorizada','Falta comprovada','repo-conclusao-portal','fixture')
  `);
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "DecisaoReposicaoIndividual" (id,"reposicaoId","decisorId",aprovada,motivo)
    VALUES ('decisao-conclusao-portal','repo-conclusao-portal',${gestorId},true,'Aprovação independente')
  `);
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "MaterialReposicaoGravacao" (id,"reposicaoId",provedor,"arquivoOficialId",disponivel,"publicadoPorId","publicadoEm")
    VALUES ('material-conclusao-portal','repo-conclusao-portal','GOOGLE_DRIVE','drive-conclusao-portal',true,${secretariaId},${utc(new Date("2026-09-01T10:00:00.000Z"))})
  `);
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "DisponibilizacaoEntregaReposicao" (id,"reposicaoId","materialId","disponibilizadaEm","prazoBaseMinutos","prazoInicialAte","publicadaPorId")
    VALUES ('disp-conclusao-portal','repo-conclusao-portal','material-conclusao-portal',${utc(new Date("2026-09-01T10:00:00.000Z"))},120,${utc(new Date("2026-09-01T12:00:00.000Z"))},${secretariaId})
  `);
}

beforeEach(async () => {
  await truncarBanco();
  catalogo = await seedCatalogoMinimo();
  secretariaId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  gestorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  adminId = (await criarUsuario(["ADMINISTRADOR"])).id;
  professorId = (await criarUsuario(["PROFESSOR"])).id;
  alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Aluno conclusão", paisId: catalogo.pais.id } })).id;
  matriculaId = (await prisma.matricula.create({ data: { alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } })).id;
  contaId = (await prisma.contaPortalAluno.create({ data: { alunoId, ativa: true } })).id;
  portal.sessao = { sessaoId: "sessao", contaId, alunoId, email: "aluno@example.test" };
});

it("mostra somente a versão da entrega que fundamenta a conclusão efetiva e a remove após correção aprovada", async () => {
  await prepararReposicao();
  await prisma.designacaoAvaliadorReposicaoIndividual.create({ data: {
    reposicaoId: "repo-conclusao-portal", professorId, designadorId: gestorId, inicio: new Date("2026-01-01T00:00:00.000Z"), motivo: "Avaliação da reposição gravada",
  } });
  const primeira = await prisma.entregaReposicaoGravacao.create({ data: {
    reposicaoId: "repo-conclusao-portal", alunoId, contaPortalAlunoId: contaId, versao: 1,
    resumo: "Resumo da primeira entrega", atividade: "Atividade da primeira entrega", evidencia: "Entrega v1", entregueEm: new Date("2026-09-01T10:00:00.000Z"),
  } });
  const segunda = await prisma.entregaReposicaoGravacao.create({ data: {
    reposicaoId: "repo-conclusao-portal", alunoId, contaPortalAlunoId: contaId, versao: 2,
    resumo: "Resumo revisado", atividade: "Atividade revisada", evidencia: "Entrega v2", entregueEm: new Date("2026-09-01T11:00:00.000Z"),
  } });
  const conclusao = await prisma.conclusaoReposicaoIndividual.create({ data: {
    reposicaoId: "repo-conclusao-portal", versao: 1, concluida: true, entregaId: primeira.id,
    validadaEm: new Date("2026-09-01T10:30:00.000Z"), validadaPorId: professorId, concluidaPorId: professorId, evidencia: "Validação da entrega original",
  } });
  const correcaoMantem = await prisma.correcaoConclusaoReposicaoIndividual.create({ data: {
    conclusaoId: conclusao.id, autorId: gestorId, versao: 1, concluida: true, entregaId: segunda.id,
    validadaEm: new Date("2026-09-01T11:30:00.000Z"), validadaPorId: professorId, evidencia: "Reavaliação da v2", motivo: "Aprovar versão revisada", entradaHash: "mantem-v2",
  } });
  expect((await consultarEntregaGravacaoPortalAluno("repo-conclusao-portal"))?.entregaValidada).toMatchObject({ entregaId: primeira.id, versao: 1 });
  await prisma.decisaoCorrecaoConclusaoReposicao.create({ data: { correcaoId: correcaoMantem.id, decisorId: adminId, aprovada: true, motivo: "Reavaliação conferida" } });

  const detalhe = await consultarEntregaGravacaoPortalAluno("repo-conclusao-portal");
  expect(detalhe?.entregaValidada).toEqual({ entregaId: segunda.id, versao: 2, validadaEm: "2026-09-01T11:30:00.000Z" });
  expect(detalhe?.entregas.map((entrega) => entrega.id)).toEqual([segunda.id, primeira.id]);
  expect(await exigirReposicaoDoPortalAluno("repo-conclusao-portal")).toMatchObject({ concluida: true, entregaValidadaId: segunda.id, versaoEntregaValidada: 2, dataResultado: new Date("2026-09-01T11:30:00.000Z") });
  expect(await listarReposicoesDoPortalAluno()).toEqual(expect.arrayContaining([expect.objectContaining({ id: "repo-conclusao-portal", entregaValidadaId: segunda.id, versaoEntregaValidada: 2 })]));

  const correcaoRetira = await prisma.correcaoConclusaoReposicaoIndividual.create({ data: {
    conclusaoId: conclusao.id, autorId: gestorId, versao: 2, concluida: false,
    evidencia: "Conclusão precisa ser retirada", motivo: "Nova conferência encontrou inconsistência", entradaHash: "retira-resultado",
  } });
  expect((await consultarEntregaGravacaoPortalAluno("repo-conclusao-portal"))?.entregaValidada).toMatchObject({ entregaId: segunda.id, versao: 2 });
  await prisma.decisaoCorrecaoConclusaoReposicao.create({ data: { correcaoId: correcaoRetira.id, decisorId: adminId, aprovada: true, motivo: "Retirada conferida" } });

  expect(await exigirReposicaoDoPortalAluno("repo-conclusao-portal")).toMatchObject({ concluida: false, dataResultado: null, entregaValidadaId: null, versaoEntregaValidada: null });
  expect((await consultarEntregaGravacaoPortalAluno("repo-conclusao-portal"))?.entregaValidada).toBeNull();
  expect((await consultarEntregaGravacaoPortalAluno("repo-conclusao-portal"))?.entregas.map((entrega) => entrega.id)).toEqual([segunda.id, primeira.id]);
});
