import { beforeEach, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";

const utc = (valor: Date) => Prisma.sql`${valor}::timestamptz AT TIME ZONE 'UTC'`;

let secretariaId: string, gestorId: string, alunoId: string, outroAlunoId: string, matriculaId: string, outraMatriculaId: string;
let contaId: string, outraContaId: string;
let catalogo: Awaited<ReturnType<typeof seedCatalogoMinimo>>;
let sequenciaPausa = 0;

async function prepararReposicao(reposicaoId: string, donoMatriculaId: string, donoAlunoId: string, aprovada = true) {
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
  if (aprovada) await prisma.$executeRaw(Prisma.sql`INSERT INTO "DecisaoReposicaoIndividual" (id,"reposicaoId","decisorId",aprovada,motivo) VALUES (${`decisao-${reposicaoId}`},${reposicaoId},${gestorId},true,'Aprovação independente')`);
  const materialId = `material-${reposicaoId}`;
  const disponibilizadaEm = new Date();
  const prazoAte = new Date(disponibilizadaEm.getTime() + 3_600_000);
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "MaterialReposicaoGravacao" (id,"reposicaoId",provedor,"arquivoOficialId",disponivel,"publicadoPorId","publicadoEm")
    VALUES (${materialId},${reposicaoId},'GOOGLE_DRIVE',${`drive-${reposicaoId}`},true,${secretariaId},${utc(disponibilizadaEm)})
  `);
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "DisponibilizacaoEntregaReposicao" (id,"reposicaoId","materialId","disponibilizadaEm","prazoBaseMinutos","prazoInicialAte","publicadaPorId")
    VALUES (${`disp-${reposicaoId}`},${reposicaoId},${materialId},${utc(disponibilizadaEm)},60,${utc(prazoAte)},${secretariaId})
  `);
  return { materialId, prazoAte };
}

async function criarPausa(materialId: string, inicio: Date, fim: Date) {
  sequenciaPausa += 1;
  const relato = await prisma.relatoIndisponibilidadeMaterialReposicao.create({ data: {
    id: `relato-pausa-190-${sequenciaPausa}`, materialId, contaPortalAlunoId: contaId, descricao: "Falha confirmada para teste de prazo",
  } });
  await prisma.indisponibilidadeMaterialReposicao.create({ data: {
    id: `pausa-190-${sequenciaPausa}`, materialId, relatoId: relato.id, confirmadaPorId: gestorId, inicio, fim, motivo: "Interrupção confirmada",
  } });
}

async function prazoEtapa(reposicaoId: string, prazoBase: Date, inicioEtapa: Date) {
  const [linha] = await prisma.$queryRaw<Array<{ prazo: Date }>>(Prisma.sql`
    SELECT prazo_etapa_reposicao_190(${utc(prazoBase)}, ${utc(inicioEtapa)}, ${reposicaoId}, NULL::timestamp) AS prazo
  `);
  return linha?.prazo;
}

beforeEach(async () => {
  await truncarBanco();
  catalogo = await seedCatalogoMinimo();
  secretariaId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  gestorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Aluno A", paisId: catalogo.pais.id } })).id;
  outroAlunoId = (await prisma.aluno.create({ data: { primeiroNome: "Aluno B", paisId: catalogo.pais.id } })).id;
  matriculaId = (await prisma.matricula.create({ data: { alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } })).id;
  outraMatriculaId = (await prisma.matricula.create({ data: { alunoId: outroAlunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } })).id;
  contaId = (await prisma.contaPortalAluno.create({ data: { alunoId, ativa: true } })).id;
  outraContaId = (await prisma.contaPortalAluno.create({ data: { alunoId: outroAlunoId, ativa: true } })).id;
  sequenciaPausa = 0;
});

it("SQL recusa relato de conta de outro aluno e ainda aceita relato de equipe ativa no material autorizado", async () => {
  const propria = await prepararReposicao("repo-190-a", matriculaId, alunoId);
  const outra = await prepararReposicao("repo-190-b", outraMatriculaId, outroAlunoId);

  await expect(prisma.$executeRaw(Prisma.sql`
    INSERT INTO "RelatoIndisponibilidadeMaterialReposicao" (id,"materialId","contaPortalAlunoId",descricao)
    VALUES ('relato-cross-190',${outra.materialId},${contaId},'Tentativa de relatar material de outra matrícula')
  `)).rejects.toThrow(/conta ativa/i);
  await expect(prisma.$executeRaw(Prisma.sql`
    INSERT INTO "RelatoIndisponibilidadeMaterialReposicao" (id,"materialId","relatadoPorId",descricao)
    VALUES ('relato-equipe-190',${propria.materialId},${secretariaId},'Equipe confirmou falha inicial no material')
  `)).resolves.toBe(1);
  await expect(prisma.$executeRaw(Prisma.sql`DELETE FROM "RelatoIndisponibilidadeMaterialReposicao" WHERE id = 'relato-equipe-190'`)).rejects.toThrow(/históricas/i);
});

it("SQL não ressuscita etapa por pausa fechada após o vencimento", async () => {
  const propria = await prepararReposicao("repo-190-pausa-tardia", matriculaId, alunoId);
  const inicioEtapa = new Date("2026-09-15T09:00:00.000Z");
  const prazoBase = new Date("2026-09-15T12:00:00.000Z");
  await criarPausa(propria.materialId, new Date("2026-09-15T12:01:00.000Z"), new Date("2026-09-15T14:01:00.000Z"));

  expect((await prazoEtapa("repo-190-pausa-tardia", prazoBase, inicioEtapa))?.toISOString()).toBe(prazoBase.toISOString());
});

it("SQL une pausas fechadas sobrepostas sem somar o trecho repetido", async () => {
  const propria = await prepararReposicao("repo-190-pausas-sobrepostas", matriculaId, alunoId);
  const inicioEtapa = new Date("2026-09-15T09:00:00.000Z");
  const prazoBase = new Date("2026-09-15T12:00:00.000Z");
  await criarPausa(propria.materialId, new Date("2026-09-15T11:00:00.000Z"), new Date("2026-09-15T11:30:00.000Z"));
  await criarPausa(propria.materialId, new Date("2026-09-15T11:20:00.000Z"), new Date("2026-09-15T11:50:00.000Z"));

  expect((await prazoEtapa("repo-190-pausas-sobrepostas", prazoBase, inicioEtapa))?.toISOString()).toBe("2026-09-15T12:50:00.000Z");
});

it("SQL recusa prorrogação de correção ligada a outra reposição e autor de gestão inativo", async () => {
  const propria = await prepararReposicao("repo-190-prazo-a", matriculaId, alunoId);
  await prepararReposicao("repo-190-prazo-b", outraMatriculaId, outroAlunoId);
  const entregaOutra = await prisma.entregaReposicaoGravacao.create({ data: {
    reposicaoId: "repo-190-prazo-b", alunoId: outroAlunoId, contaPortalAlunoId: outraContaId, versao: 1,
    resumo: "Resumo entregue pelo aluno B", atividade: "Atividade entregue pelo aluno B", evidencia: "Evidência de entrega", entregueEm: new Date(),
  } });
  const correcaoOutra = await prisma.solicitacaoCorrecaoEntregaReposicao.create({ data: {
    reposicaoId: "repo-190-prazo-b", entregaId: entregaOutra.id, solicitadaPorId: gestorId,
    comentario: "Corrigir o exercício indicado", prazoBaseMinutos: 60, prazoAte: new Date(Date.now() + 3_600_000),
  } });
  await expect(prisma.$executeRaw(Prisma.sql`
    INSERT INTO "ProrrogacaoPrazoReposicao" (id,"reposicaoId","solicitacaoCorrecaoId",versao,"prazoAnterior","novoPrazo",motivo,"autorizadaPorId")
    VALUES ('prorroga-cross-190','repo-190-prazo-a',${correcaoOutra.id},1,${utc(correcaoOutra.prazoAte)},${utc(new Date(correcaoOutra.prazoAte.getTime() + 3_600_000))},'Prorrogação forjada de outra etapa',${gestorId})
  `)).rejects.toThrow(/etapa atual/i);

  const gestorInativo = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  await prisma.usuario.update({ where: { id: gestorInativo }, data: { ativo: false } });
  await expect(prisma.$executeRaw(Prisma.sql`
    INSERT INTO "ProrrogacaoPrazoReposicao" (id,"reposicaoId",versao,"prazoAnterior","novoPrazo",motivo,"autorizadaPorId")
    VALUES ('prorroga-inativa-190','repo-190-prazo-a',1,${utc(propria.prazoAte)},${utc(new Date(propria.prazoAte.getTime() + 3_600_000))},'Autorização de usuário inativo',${gestorInativo})
  `)).rejects.toThrow(/Gerência Pedagógica|Administração/i);
});

it("SQL permite a prorrogação da etapa base pelo gestor ativo e preserva seu registro", async () => {
  const propria = await prepararReposicao("repo-190-prorroga-valida", matriculaId, alunoId);
  const novoPrazo = new Date(propria.prazoAte.getTime() + 3_600_000);

  await expect(prisma.$executeRaw(Prisma.sql`
    INSERT INTO "ProrrogacaoPrazoReposicao" (id,"reposicaoId",versao,"prazoAnterior","novoPrazo",motivo,"autorizadaPorId")
    VALUES ('prorroga-valida-190','repo-190-prorroga-valida',1,${utc(propria.prazoAte)},${utc(novoPrazo)},'Prorrogação pedagógica justificada',${gestorId})
  `)).resolves.toBe(1);
  expect(await prisma.prorrogacaoPrazoReposicao.findUnique({ where: { id: "prorroga-valida-190" } })).toMatchObject({ reposicaoId: "repo-190-prorroga-valida", autorizadaPorId: gestorId, novoPrazo });
  await expect(prisma.$executeRaw(Prisma.sql`UPDATE "ProrrogacaoPrazoReposicao" SET motivo = 'Alteração posterior' WHERE id = 'prorroga-valida-190'`)).rejects.toThrow(/históricas/i);
});

it("SQL rejeita conta de outra matrícula e período expirado na liberação, mas aceita a liberação vigente correta", async () => {
  await prepararReposicao("repo-190-liberacao", matriculaId, alunoId);
  await prepararReposicao("repo-190-liberacao-sem-decisao", outraMatriculaId, outroAlunoId, false);
  const agora = new Date();
  await prisma.matricula.update({ where: { id: matriculaId }, data: { status: "PAUSADA" } });
  await prisma.matricula.update({ where: { id: outraMatriculaId }, data: { status: "PAUSADA" } });
  await expect(prisma.$executeRaw(Prisma.sql`
    INSERT INTO "LiberacaoEntregaReposicao" (id,"reposicaoId","contaId",inicio,"expiraEm",motivo,"autorizadaPorId")
    VALUES ('liberacao-cross-190','repo-190-liberacao',${outraContaId},${utc(new Date(agora.getTime() - 60_000))},${utc(new Date(agora.getTime() + 3_600_000))},'Conta de outra matrícula',${gestorId})
  `)).rejects.toThrow(/conta ativa da matrícula/i);
  await expect(prisma.$executeRaw(Prisma.sql`
    INSERT INTO "LiberacaoEntregaReposicao" (id,"reposicaoId","contaId",inicio,"expiraEm",motivo,"autorizadaPorId")
    VALUES ('liberacao-expirada-190','repo-190-liberacao',${contaId},${utc(new Date(agora.getTime() - 7_200_000))},${utc(new Date(agora.getTime() - 3_600_000))},'Período já encerrado',${gestorId})
  `)).rejects.toThrow(/período vigente/i);
  await expect(prisma.$executeRaw(Prisma.sql`
    INSERT INTO "LiberacaoEntregaReposicao" (id,"reposicaoId","contaId",inicio,"expiraEm",motivo,"autorizadaPorId")
    VALUES ('liberacao-sem-decisao-190','repo-190-liberacao-sem-decisao',${outraContaId},${utc(new Date(agora.getTime() - 60_000))},${utc(new Date(agora.getTime() + 3_600_000))},'Não há autorização da reposição',${gestorId})
  `)).rejects.toThrow(/período vigente/i);
  await expect(prisma.$executeRaw(Prisma.sql`
    INSERT INTO "LiberacaoEntregaReposicao" (id,"reposicaoId","contaId",inicio,"expiraEm",motivo,"autorizadaPorId")
    VALUES ('liberacao-valida-190','repo-190-liberacao',${contaId},${utc(new Date(agora.getTime() - 60_000))},${utc(new Date(agora.getTime() + 3_600_000))},'Liberação pontual para concluir pendência',${gestorId})
  `)).resolves.toBe(1);
});
