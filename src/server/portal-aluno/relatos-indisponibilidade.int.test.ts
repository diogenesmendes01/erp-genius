import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const sessao = vi.hoisted(() => ({ atual: { sessaoId: "sessao-portal", contaId: "", alunoId: "", email: "aluno@example.test" } }));
vi.mock("./sessao", () => ({ exigirSessaoPortalAluno: async () => sessao.atual }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { relatarIndisponibilidadeMaterialPortalAluno } from "./entregas-reposicao";
import { consultarEntregaGravacaoPortalAluno } from "./reposicoes";

const utc = (valor: Date) => Prisma.sql`${valor}::timestamptz AT TIME ZONE 'UTC'`;

let secretariaId: string, gestorId: string, alunoId: string, outroAlunoId: string, matriculaId: string, outraMatriculaId: string;
let catalogo: Awaited<ReturnType<typeof seedCatalogoMinimo>>;

async function prepararReposicao(reposicaoId: string, donoMatriculaId: string, donoAlunoId: string, publicada = true) {
  const professor = await criarUsuario(["PROFESSOR"]);
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: `N-${reposicaoId}`, ordem: 1 } });
  const turma = await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: professor.id, dataInicio: new Date("2026-01-01T00:00:00.000Z") } });
  await prisma.alocacaoTurma.create({ data: { alunoId: donoAlunoId, matriculaId: donoMatriculaId, turmaId: turma.id, criadoEm: new Date("2026-01-01T00:00:00.000Z") } });
  const aula = await prisma.encontroAgenda.create({ data: {
    turmaId: turma.id, professorId: professor.id, preparadorId: secretariaId,
    inicio: new Date("2026-01-02T10:00:00.000Z"), fim: new Date("2026-01-02T11:00:00.000Z"), fusoOrigem: "UTC", status: "PREVISTO",
    motivo: "Aula original", chaveIdempotencia: `aula-${reposicaoId}`, entradaHash: "fixture",
    diario: { create: { turmaId: turma.id, professorId: professor.id, ocorridaEm: new Date("2026-01-02T10:00:00.000Z"), conteudo: "Aula", registros: { create: { alunoId: donoAlunoId, matriculaId: donoMatriculaId, nomeAluno: "Aluno", presente: false, participacao: "FALTA" } } } },
  } });
  await prisma.encontroAgenda.update({ where: { id: aula.id }, data: { status: "MINISTRADO" } });
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "ReposicaoIndividual" (id,"aulaOriginalId","matriculaId",modalidade,"solicitanteId",motivo,evidencia,"chaveIdempotencia","entradaHash")
    VALUES (${reposicaoId},${aula.id},${donoMatriculaId},'GRAVACAO'::"ModalidadeReposicaoIndividual",${secretariaId},'Reposição aprovada','Falta comprovada',${`chave-${reposicaoId}`},'fixture')
  `);
  await prisma.$executeRaw(Prisma.sql`INSERT INTO "DecisaoReposicaoIndividual" (id,"reposicaoId","decisorId",aprovada,motivo) VALUES (${`decisao-${reposicaoId}`},${reposicaoId},${gestorId},true,'Aprovação independente')`);
  const materialId = `material-${reposicaoId}`;
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "MaterialReposicaoGravacao" (id,"reposicaoId",provedor,"arquivoOficialId","driveOrganizacaoId","driveRevisionId","driveRevisionMd5","driveRevisionSize","mimeType",disponivel,"publicadoPorId","publicadoEm")
    VALUES (${materialId},${reposicaoId},'GOOGLE_DRIVE',${`drive-${reposicaoId}`},'drive-escola',${`revisao-${reposicaoId}`},${"a".repeat(32)},10,'video/mp4',true,${secretariaId},${utc(new Date())})
  `);
  await prisma.fonteRevisaoGravacao.create({ data: {
    alvo: "MATERIAL_REPOSICAO", materialReposicaoId: materialId, versao: 1,
    arquivoOficialId: `drive-${reposicaoId}`, driveOrganizacaoId: "drive-escola",
    driveRevisionId: `revisao-${reposicaoId}`, driveRevisionMd5: "a".repeat(32),
    driveRevisionSize: 10n, mimeType: "video/mp4",
  } });
  if (publicada) await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "DisponibilizacaoEntregaReposicao" (id,"reposicaoId","materialId","disponibilizadaEm","prazoBaseMinutos","prazoInicialAte","publicadaPorId")
    VALUES (${`disp-${reposicaoId}`},${reposicaoId},${materialId},${utc(new Date("2026-09-01T10:00:00.000Z"))},120,${utc(new Date("2026-09-01T12:00:00.000Z"))},${secretariaId})
  `);
  return materialId;
}

beforeEach(async () => {
  await truncarBanco();
  catalogo = await seedCatalogoMinimo();
  secretariaId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  gestorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Aluno do portal", paisId: catalogo.pais.id } })).id;
  outroAlunoId = (await prisma.aluno.create({ data: { primeiroNome: "Outro aluno", paisId: catalogo.pais.id } })).id;
  matriculaId = (await prisma.matricula.create({ data: { alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } })).id;
  outraMatriculaId = (await prisma.matricula.create({ data: { alunoId: outroAlunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } })).id;
  const conta = await prisma.contaPortalAluno.create({ data: { alunoId, ativa: true } });
  sessao.atual = { sessaoId: "sessao-portal", contaId: conta.id, alunoId, email: "aluno@example.test" };
});

it("registra relato somente no material da reposição da própria matrícula", async () => {
  const materialId = await prepararReposicao("repo-propria", matriculaId, alunoId);

  const relato = await relatarIndisponibilidadeMaterialPortalAluno({ reposicaoId: "repo-propria", descricao: "A gravação autorizada não inicia no navegador." });

  expect(await prisma.relatoIndisponibilidadeMaterialReposicao.findUnique({ where: { id: relato.id } })).toMatchObject({
    materialId, contaPortalAlunoId: sessao.atual.contaId, situacao: "ABERTO",
  });
});

it("devolve à conta somente seus relatos e as pausas confirmadas do próprio material", async () => {
  const materialId = await prepararReposicao("repo-historico-proprio", matriculaId, alunoId);
  const relato = await relatarIndisponibilidadeMaterialPortalAluno({ reposicaoId: "repo-historico-proprio", descricao: "O vídeo oficial para no meio da reprodução." });
  const inicio = new Date("2026-09-15T12:00:00.000Z");
  const pausa = await prisma.indisponibilidadeMaterialReposicao.create({ data: {
    materialId, relatoId: relato.id, confirmadaPorId: gestorId, inicio, fim: new Date("2026-09-15T12:20:00.000Z"), motivo: "Falha conferida pela escola",
  } });

  const detalhe = await consultarEntregaGravacaoPortalAluno("repo-historico-proprio");

  expect(detalhe?.relatosIndisponibilidade).toEqual([expect.objectContaining({ id: relato.id, descricao: "O vídeo oficial para no meio da reprodução.", situacao: "ABERTO" })]);
  expect(detalhe?.pausasMaterial).toEqual([expect.objectContaining({ id: pausa.id, inicio: expect.any(String), fim: expect.any(String) })]);
});

it("recusa relato para a reposição de outra matrícula, mesmo conhecendo seu id", async () => {
  await prepararReposicao("repo-outra-matricula", outraMatriculaId, outroAlunoId);

  await expect(relatarIndisponibilidadeMaterialPortalAluno({ reposicaoId: "repo-outra-matricula", descricao: "Tentativa de consultar material de outro aluno." })).rejects.toThrow(/não autorizada/i);
  expect(await prisma.relatoIndisponibilidadeMaterialReposicao.count()).toBe(0);
});

it.each(["PAUSADA", "ENCERRADA", "BLOQUEADA", "CONTA_INATIVA", "SEM_PUBLICACAO", "D30"])(
  "recusa relato sem autorização de material: %s", async (caso) => {
    await prepararReposicao("repo-restrita", matriculaId, alunoId, caso !== "SEM_PUBLICACAO");
    if (caso === "PAUSADA" || caso === "ENCERRADA") {
      await prisma.matricula.update({ where: { id: matriculaId }, data: { status: caso } });
    }
    if (caso === "BLOQUEADA") await prisma.matricula.update({ where: { id: matriculaId }, data: { acessoBloqueioManual: true } });
    if (caso === "CONTA_INATIVA") await prisma.contaPortalAluno.update({ where: { id: sessao.atual.contaId }, data: { ativa: false } });
    if (caso === "D30") await prisma.cobranca.create({ data: {
      matriculaId, tipo: "MENSALIDADE", status: "ATRASADO", moeda: "CRC", valorOriginal: 100,
      valorNegociado: 100, valorRecebido: 0, saldo: 100, vencimento: new Date(Date.now() - 31 * 86400000),
    } });
    await expect(relatarIndisponibilidadeMaterialPortalAluno({ reposicaoId: "repo-restrita", descricao: "Relato de material sem acesso autorizado" })).rejects.toThrow(/não autorizada/i);
    expect(await prisma.relatoIndisponibilidadeMaterialReposicao.count()).toBe(0);
  },
);
