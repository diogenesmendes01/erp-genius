import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const portal = vi.hoisted(() => ({ sessao: null as null | { sessaoId: string; contaId: string; alunoId: string; email: string } }));
const drive = vi.hoisted(() => ({ id: "drive-escola" }));
vi.mock("@/server/gravacoes/credenciais", () => ({ obterDriveOrganizacaoId: () => drive.id }));
vi.mock("@/server/portal-aluno/sessao", () => ({
  exigirSessaoPortalAluno: async () => {
    if (!portal.sessao) throw new Error("Sessão do portal revogada.");
    return portal.sessao;
  },
}));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { autorizarReproducaoGravacao } from "./autorizacao";

const utc = (valor: Date) => Prisma.sql`${valor}::timestamptz AT TIME ZONE 'UTC'`;

let secretariaId: string;
let gestorId: string;
let alunoId: string;
let outraAlunoId: string;
let matriculaAtivaId: string;
let matriculaBloqueadaId: string;
let matriculaOutraAlunoId: string;
let contaId: string;
let catalogo: Awaited<ReturnType<typeof seedCatalogoMinimo>>;
let sequenciaReposicao = 0;

async function prepararReposicao(
  id: string,
  matriculaId: string,
  donoAlunoId: string,
  opcoes: { aprovada?: boolean; publicada?: boolean; fonteOriginal?: boolean } = {},
) {
  const vinculada = await prisma.alocacaoTurma.findFirst({
    where: { alunoId: donoAlunoId, matriculaId, ativa: true, encerradaEm: null },
    select: { turmaId: true, turma: { select: { professorId: true } } },
  });
  let turmaId = vinculada?.turmaId;
  let professorId = vinculada?.turma.professorId;
  if (!turmaId || !professorId) {
    const professor = await criarUsuario(["PROFESSOR"], `Professor ${id}`);
    const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: `R-${id}`, ordem: 1 } });
    const turma = await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: professor.id, dataInicio: new Date("2026-01-01T00:00:00.000Z") } });
    turmaId = turma.id;
    professorId = professor.id;
    await prisma.alocacaoTurma.create({ data: { alunoId: donoAlunoId, matriculaId, turmaId, criadoEm: new Date("2026-01-01T00:00:00.000Z") } });
  }
  sequenciaReposicao += 1;
  const inicio = new Date(Date.UTC(2026, 0, 2 + sequenciaReposicao, 10));
  const fim = new Date(inicio.getTime() + 3_600_000);
  const aula = await prisma.encontroAgenda.create({ data: {
    turmaId, professorId, preparadorId: secretariaId,
    inicio, fim, fusoOrigem: "UTC", status: "PREVISTO",
    motivo: "Aula original", chaveIdempotencia: `aula-${id}`, entradaHash: "fixture",
    diario: { create: { turmaId, professorId, ocorridaEm: inicio, conteudo: "Aula", registros: { create: { alunoId: donoAlunoId, matriculaId, nomeAluno: "Aluno", presente: false, participacao: "FALTA" } } } },
  } });
  let publicacaoAulaId: string | null = null;
  if (opcoes.fonteOriginal) {
    const diario = await prisma.aulaDiario.findUniqueOrThrow({ where: { encontroId: aula.id } });
    const publicacao = await prisma.publicacaoGravacaoAula.create({ data: {
      encontroId: aula.id, publicadorId: professorId, arquivoOficialId: `drive-${id}`,
      driveOrganizacaoId: "drive-escola", mimeType: "video/mp4", chaveIdempotencia: `publicacao-${id}`,
      entradaHash: "a".repeat(64), snapshot: { encontroId: aula.id, diarioId: diario.id },
    } });
    publicacaoAulaId = publicacao.id;
  }
  await prisma.encontroAgenda.update({ where: { id: aula.id }, data: { status: "MINISTRADO" } });
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "ReposicaoIndividual" (id,"aulaOriginalId","matriculaId",modalidade,"solicitanteId",motivo,evidencia,"chaveIdempotencia","entradaHash")
    VALUES (${id},${aula.id},${matriculaId},'GRAVACAO'::"ModalidadeReposicaoIndividual",${secretariaId},'Reposição gravada autorizada','Falta comprovada',${`repo-${id}`},'fixture')
  `);
  if (opcoes.aprovada !== false) await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "DecisaoReposicaoIndividual" (id,"reposicaoId","decisorId",aprovada,motivo)
    VALUES (${`decisao-${id}`},${id},${gestorId},true,'Decisão independente aprovada')
  `);
  const materialId = `material-${id}`;
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "MaterialReposicaoGravacao" (id,"reposicaoId",provedor,"arquivoOficialId",disponivel,"publicadoPorId","publicadoEm","publicacaoAulaId")
    VALUES (${materialId},${id},'GOOGLE_DRIVE',${`drive-${id}`},true,${secretariaId},${utc(new Date("2026-09-01T10:00:00.000Z"))},${publicacaoAulaId})
  `);
  if (opcoes.publicada !== false) await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "DisponibilizacaoEntregaReposicao" (id,"reposicaoId","materialId","disponibilizadaEm","prazoBaseMinutos","prazoInicialAte","publicadaPorId")
    VALUES (${`disp-${id}`},${id},${materialId},${utc(new Date("2026-09-01T10:00:00.000Z"))},120,${utc(new Date("2026-09-01T12:00:00.000Z"))},${secretariaId})
  `);
  return { materialId, fileId: `drive-${id}` };
}

beforeEach(async () => {
  drive.id = "drive-escola";
  await truncarBanco();
  catalogo = await seedCatalogoMinimo();
  secretariaId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  gestorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Aluno do portal", paisId: catalogo.pais.id } })).id;
  outraAlunoId = (await prisma.aluno.create({ data: { primeiroNome: "Outro aluno", paisId: catalogo.pais.id } })).id;
  const criarMatricula = (aluno: string) => prisma.matricula.create({ data: { alunoId: aluno, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } });
  matriculaAtivaId = (await criarMatricula(alunoId)).id;
  matriculaBloqueadaId = (await criarMatricula(alunoId)).id;
  matriculaOutraAlunoId = (await criarMatricula(outraAlunoId)).id;
  contaId = (await prisma.contaPortalAluno.create({ data: { alunoId, ativa: true } })).id;
  sequenciaReposicao = 0;
  portal.sessao = { sessaoId: "sessao-portal", contaId, alunoId, email: "aluno@example.test" };
});

it("autoriza somente a reposição gravada aprovada e publicada da matrícula ativa exata", async () => {
  const propria = await prepararReposicao("repo-ativa", matriculaAtivaId, alunoId);
  const autorizacao = await autorizarReproducaoGravacao("repo-ativa");

  expect(autorizacao).toEqual({ fileId: propria.fileId, reposicaoId: "repo-ativa", matriculaId: matriculaAtivaId });
});

it("vincula a reprodução ao drive oficial publicado e recusa mudança de repositório", async () => {
  await prepararReposicao("repo-original", matriculaAtivaId, alunoId, { fonteOriginal: true });
  expect(await autorizarReproducaoGravacao("repo-original")).toEqual({
    fileId: "drive-repo-original", reposicaoId: "repo-original", matriculaId: matriculaAtivaId, driveId: "drive-escola",
  });
  drive.id = "outro-drive";
  await expect(autorizarReproducaoGravacao("repo-original")).rejects.toThrow(/não autorizada/i);
});

it("isola dois contratos do mesmo aluno e nega cada origem de bloqueio", async () => {
  await prepararReposicao("repo-livre", matriculaAtivaId, alunoId);
  await prepararReposicao("repo-bloqueada", matriculaBloqueadaId, alunoId);

  await expect(autorizarReproducaoGravacao("repo-livre")).resolves.toMatchObject({ matriculaId: matriculaAtivaId });
  for (const bloqueio of [
    { acessoBloqueado: true },
    { acessoBloqueioManual: true },
    { acessoBloqueioAutomatico: true },
  ]) {
    await prisma.matricula.update({ where: { id: matriculaBloqueadaId }, data: {
      acessoBloqueado: false, acessoBloqueioManual: false, acessoBloqueioAutomatico: false, ...bloqueio,
    } });
    await expect(autorizarReproducaoGravacao("repo-bloqueada")).rejects.toThrow(/não autorizada/i);
  }
});

it("recusa outra pessoa, decisão pendente e fonte sem publicação", async () => {
  await prepararReposicao("repo-outro-aluno", matriculaOutraAlunoId, outraAlunoId);
  await prepararReposicao("repo-sem-decisao", matriculaAtivaId, alunoId, { aprovada: false });
  await prepararReposicao("repo-sem-publicacao", matriculaAtivaId, alunoId, { publicada: false });

  await expect(autorizarReproducaoGravacao("repo-outro-aluno")).rejects.toThrow(/não autorizada/i);
  await expect(autorizarReproducaoGravacao("repo-sem-decisao")).rejects.toThrow(/não autorizada/i);
  await expect(autorizarReproducaoGravacao("repo-sem-publicacao")).rejects.toThrow(/não autorizada/i);
});

it("recusa material indisponível ou com indisponibilidade confirmada em aberto", async () => {
  const fonte = await prepararReposicao("repo-material", matriculaAtivaId, alunoId);
  await prisma.materialReposicaoGravacao.update({ where: { id: fonte.materialId }, data: { disponivel: false } });
  await expect(autorizarReproducaoGravacao("repo-material")).rejects.toThrow(/não autorizada/i);
  await prisma.materialReposicaoGravacao.update({ where: { id: fonte.materialId }, data: { disponivel: true } });
  const relato = await prisma.relatoIndisponibilidadeMaterialReposicao.create({ data: {
    materialId: fonte.materialId, contaPortalAlunoId: contaId, descricao: "A gravação não inicia no player autorizado.",
  } });
  await prisma.indisponibilidadeMaterialReposicao.create({ data: {
    materialId: fonte.materialId, relatoId: relato.id, confirmadaPorId: gestorId, inicio: new Date(), motivo: "Falha confirmada pela gestão",
  } });
  await expect(autorizarReproducaoGravacao("repo-material")).rejects.toThrow(/não autorizada/i);
});

it("recusa sessão revogada pelo helper antes de resolver a fonte", async () => {
  await prepararReposicao("repo-sessao", matriculaAtivaId, alunoId);
  portal.sessao = null;
  await expect(autorizarReproducaoGravacao("repo-sessao")).rejects.toThrow(/sessão.*revogada/i);
});

it("aplica D+30 por cada cobrança, sem esperar o controle agendado", async () => {
  await prepararReposicao("repo-d30", matriculaAtivaId, alunoId);
  const agora = new Date("2040-06-30T12:00:00.000Z");
  const cobranca = await prisma.cobranca.create({ data: {
    matriculaId: matriculaAtivaId, tipo: "MENSALIDADE", status: "ATRASADO", moeda: "CRC",
    valorOriginal: 100, valorNegociado: 100, valorRecebido: 60, saldo: 40,
    vencimento: new Date(agora.getTime() - 29 * 86_400_000),
  } });

  await expect(autorizarReproducaoGravacao("repo-d30", agora)).resolves.toMatchObject({ matriculaId: matriculaAtivaId });
  await prisma.cobranca.update({ where: { id: cobranca.id }, data: { vencimento: new Date(agora.getTime() - 30 * 86_400_000) } });
  await expect(autorizarReproducaoGravacao("repo-d30", agora)).rejects.toThrow(/não autorizada/i);
});

it("nega pausa e encerramento mesmo com liberação de entrega, que não é concessão de vídeo", async () => {
  await prepararReposicao("repo-pausada", matriculaAtivaId, alunoId);
  await prisma.matricula.update({ where: { id: matriculaAtivaId }, data: { status: "PAUSADA" } });
  await expect(autorizarReproducaoGravacao("repo-pausada")).rejects.toThrow(/não autorizada/i);
  await prisma.matricula.update({ where: { id: matriculaAtivaId }, data: { status: "ENCERRADA" } });
  await expect(autorizarReproducaoGravacao("repo-pausada")).rejects.toThrow(/não autorizada/i);
});
