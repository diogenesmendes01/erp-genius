import { beforeEach, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { criarAgendaParticularIsentaFixture } from "@/test/reposicao-agenda";
import { carregarFrequenciaVinculoTx } from "./frequencia-tx";

// Requer a migration 20260914234000_regularizacao_reposicao. Usa SQL para que
// este arquivo também seja compilável antes do `prisma generate` central.
let gestor: string, secretaria: string, administrador: string, professor: string, alunoId: string, contaPortalAlunoId: string, matriculaId: string, turmaId: string, alocacaoId: string;
const inicio = new Date("2026-01-01T00:00:00.000Z");
const fimOriginal = new Date("2026-01-10T11:00:00.000Z");
const utc = (valor: Date) => Prisma.sql`${valor}::timestamptz AT TIME ZONE 'UTC'`;

async function contexto() {
  const a = await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: alocacaoId } });
  const matricula = a.matriculaId;
  if (!matricula) throw new Error("Fixture sem matrícula.");
  return prisma.$transaction(tx => carregarFrequenciaVinculoTx(tx, { ...a, matriculaId: matricula }, "nivel-1", "75", new Date("2026-02-01T00:00:00.000Z")));
}

async function inserirFonte({ correcaoAprovada = false, correcaoRejeitada = false, modalidade = "PARTICULAR" as "PARTICULAR" | "GRAVACAO" } = {}) {
  const original = await prisma.encontroAgenda.create({ data: { turmaId, professorId: professor, preparadorId: gestor,
    inicio: new Date("2026-01-10T10:00:00.000Z"), fim: fimOriginal, fusoOrigem: "UTC", status: "PREVISTO", motivo: "Aula original", chaveIdempotencia: "frequencia-origem", entradaHash: "fixture",
    diario: { create: { turmaId, professorId: professor, ocorridaEm: new Date("2026-01-10T10:00:00.000Z"), conteudo: "Aula", registros: { create: { alunoId, matriculaId, nomeAluno: "Aluno", presente: false, participacao: "FALTA" } } } },
  } });
  await prisma.encontroAgenda.update({ where: { id: original.id }, data: { status: "MINISTRADO" } });
  const encontroReposicaoId = "repor-encontro";
  const reposicaoId = "repor-1", conclusaoId = "conclusao-1";
  const decisorReposicao = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "ReposicaoIndividual" (id, "aulaOriginalId", "matriculaId", modalidade, "solicitanteId", motivo, evidencia, "chaveIdempotencia", "entradaHash")
    VALUES (${reposicaoId}, ${original.id}, ${matriculaId}, ${modalidade}::"ModalidadeReposicaoIndividual", ${gestor}, 'Falta conferida', 'Pedido autorizado', 'reposicao-1', 'fixture')
  `);
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "DecisaoReposicaoIndividual" (id, "reposicaoId", "decisorId", aprovada, motivo)
    VALUES ('decisao-1', ${reposicaoId}, ${decisorReposicao}, true, 'Aprovação independente')
  `);
  if (modalidade === "PARTICULAR") await criarAgendaParticularIsentaFixture({
    reposicaoId, matriculaId, alunoId, professorId: professor, secretariaId: secretaria, decisorId: administrador,
    inicio: new Date("2026-01-15T10:00:00.000Z"), fim: new Date("2026-01-15T11:00:00.000Z"), encontroId: encontroReposicaoId, agendaId: "agenda-repor-1", autorizacaoId: "autorizacao-repor-1", chave: "reposicao-frequencia",
  });
  if (modalidade === "PARTICULAR") {
    const encontro = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroReposicaoId }, select: { fim: true } });
    await prisma.conclusaoReposicaoIndividual.create({ data: {
      id: conclusaoId, reposicaoId, versao: 1, concluida: true, encontroReposicaoId,
      realizadaEm: encontro.fim, concluidaPorId: professor, evidencia: "Diário e chamada",
    } });
  }
  else {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "EntregaReposicaoGravacao" (id, "reposicaoId", "alunoId", "contaPortalAlunoId", versao, resumo, atividade, evidencia, "entregueEm")
      VALUES ('entrega-1', ${reposicaoId}, ${alunoId}, ${contaPortalAlunoId}, 1, 'Resumo próprio do aluno', 'Atividade respondida', 'Arquivo enviado', ${utc(new Date("2026-01-14T11:00:00.000Z"))})
    `);
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "DesignacaoAvaliadorReposicaoIndividual" (id, "reposicaoId", "professorId", "designadorId", inicio, motivo)
      VALUES ('designacao-1', ${reposicaoId}, ${professor}, ${gestor}, ${utc(new Date("2026-01-11T00:00:00.000Z"))}, 'Avaliar gravação')
    `);
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "ConclusaoReposicaoIndividual" (id, "reposicaoId", versao, concluida, "entregaId", "validadaEm", "validadaPorId", "concluidaPorId", evidencia)
      VALUES (${conclusaoId}, ${reposicaoId}, 1, true, 'entrega-1', ${utc(new Date("2026-01-15T11:00:00.000Z"))}, ${professor}, ${professor}, 'Validação docente')
    `);
  }
  if (correcaoAprovada || correcaoRejeitada) {
    const decisorCorrecao = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "CorrecaoConclusaoReposicaoIndividual" (id, "conclusaoId", "autorId", versao, concluida, evidencia, motivo, "entradaHash")
      VALUES ('correcao-1', ${conclusaoId}, ${gestor}, 1, false, 'Correção da realização', 'Particular não ocorreu', 'fixture')
    `);
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "DecisaoCorrecaoConclusaoReposicao" (id, "correcaoId", "decisorId", aprovada, motivo)
      VALUES ('decisao-correcao-1', 'correcao-1', ${decisorCorrecao}, ${correcaoAprovada}, 'Conferência independente')
    `);
  }
  return { original };
}

beforeEach(async () => {
  await truncarBanco();
  const c = await seedCatalogoMinimo();
  gestor = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  secretaria = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  administrador = (await criarUsuario(["ADMINISTRADOR"])).id;
  professor = (await criarUsuario(["PROFESSOR"])).id;
  const nivel = await prisma.nivel.create({ data: { id: "nivel-1", idiomaId: c.idioma.id, codigo: "A1", ordem: 1 } });
  turmaId = (await prisma.turma.create({ data: { modalidadeId: c.modalidade.id, nivelId: nivel.id, professorId: professor, dataInicio: inicio } })).id;
  alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Aluno", paisId: c.pais.id } })).id;
  contaPortalAlunoId = (await prisma.contaPortalAluno.create({ data: { alunoId } })).id;
  matriculaId = (await prisma.matricula.create({ data: { alunoId, produtoId: c.produto.id, paisId: c.pais.id, moeda: "CRC", status: "ATIVA", ativadaEm: inicio } })).id;
  alocacaoId = (await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId, turmaId, criadoEm: inicio } })).id;
});

it("particular de reposição autorizada e realizada regulariza uma única aula e preserva a falta", async () => {
  const { original } = await inserirFonte();
  const r = await contexto();
  expect(r).toMatchObject({ base: 1, faltas: 0, regularizadas: 1, contabilizadas: 1 });
  expect((await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: "repor-encontro" } })).inicio).toEqual(new Date("2026-01-15T10:00:00.000Z"));
  expect(r.memoria).toContainEqual(expect.objectContaining({ aulaId: original.id, participacaoOriginal: "FALTA", resultado: "REPOSTA" }));
});

it("gravação entregue pelo aluno e validada pelo docente designado regulariza sem criar presença", async () => {
  const { original } = await inserirFonte({ modalidade: "GRAVACAO" });
  const r = await contexto();
  expect(r).toMatchObject({ base: 1, presencas: 0, faltas: 0, regularizadas: 1, contabilizadas: 1 });
  expect(r.memoria).toContainEqual(expect.objectContaining({ aulaId: original.id, participacaoOriginal: "FALTA", resultado: "REPOSTA" }));
  expect(r.memoria).toContainEqual(expect.objectContaining({ aulaId: original.id, repostaEm: "2026-01-15T11:00:00.000Z" }));
  const [datas] = await prisma.$queryRaw<{ entregueEm: Date; validadaEm: Date }[]>(Prisma.sql`
    SELECT entrega."entregueEm" AS "entregueEm", conclusao."validadaEm" AS "validadaEm"
    FROM "EntregaReposicaoGravacao" entrega JOIN "ConclusaoReposicaoIndividual" conclusao ON conclusao."entregaId" = entrega.id
    WHERE entrega.id = 'entrega-1' AND conclusao.id = 'conclusao-1'
  `);
  expect(datas).toMatchObject({ entregueEm: new Date("2026-01-14T11:00:00.000Z"), validadaEm: new Date("2026-01-15T11:00:00.000Z") });
});

it("correção aprovada remove a regularização; rejeitada conserva a conclusão anterior", async () => {
  await inserirFonte({ correcaoAprovada: true });
  expect(await contexto()).toMatchObject({ base: 1, faltas: 1, regularizadas: 0 });
  await truncarBanco();
  // a segunda fixture prova que a decisão rejeitada não apaga a conclusão real.
  const c = await seedCatalogoMinimo();
  gestor = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id; secretaria = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id; administrador = (await criarUsuario(["ADMINISTRADOR"])).id; professor = (await criarUsuario(["PROFESSOR"])).id;
  const nivel = await prisma.nivel.create({ data: { id: "nivel-1", idiomaId: c.idioma.id, codigo: "A1", ordem: 1 } });
  turmaId = (await prisma.turma.create({ data: { modalidadeId: c.modalidade.id, nivelId: nivel.id, professorId: professor, dataInicio: inicio } })).id;
  alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Aluno", paisId: c.pais.id } })).id;
  contaPortalAlunoId = (await prisma.contaPortalAluno.create({ data: { alunoId } })).id;
  matriculaId = (await prisma.matricula.create({ data: { alunoId, produtoId: c.produto.id, paisId: c.pais.id, moeda: "CRC", status: "ATIVA", ativadaEm: inicio } })).id;
  alocacaoId = (await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId, turmaId, criadoEm: inicio } })).id;
  await inserirFonte({ correcaoRejeitada: true });
  expect(await contexto()).toMatchObject({ base: 1, faltas: 0, regularizadas: 1 });
});
