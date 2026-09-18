import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const portal = vi.hoisted(() => ({
  sessao: null as null | { sessaoId: string; contaId: string; alunoId: string; email: string },
}));
const drive = vi.hoisted(() => ({ abrir: vi.fn() }));

vi.mock("@/server/portal-aluno/sessao", () => ({
  exigirSessaoPortalAluno: async () => {
    if (!portal.sessao) throw new Error("Sessão do portal revogada.");
    return portal.sessao;
  },
  revalidarSessaoPortalAlunoTx: async (_tx: unknown, sessao: { sessaoId: string; contaId: string }) => {
    if (!portal.sessao || portal.sessao.sessaoId !== sessao.sessaoId || portal.sessao.contaId !== sessao.contaId) {
      throw new Error("Sessão do portal revogada.");
    }
  },
}));
vi.mock("@/server/gravacoes/credenciais", () => ({
  obterDriveOrganizacaoId: () => "drive-escola",
  obterTokenDrive: async () => "token-sintetico-local",
}));
vi.mock("@/server/gravacoes/drive-revisao-stream", () => ({ abrirVideoRevisaoDrive: drive.abrir }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { GET } from "./route";

const utc = (valor: Date) => Prisma.sql`${valor}::timestamptz AT TIME ZONE 'UTC'`;

let secretariaId: string;
let gestorId: string;
let alunoId: string;
let contaId: string;
let catalogo: Awaited<ReturnType<typeof seedCatalogoMinimo>>;
let sequencia = 0;

async function prepararReposicao(id: string, matriculaId: string, donoAlunoId: string) {
  const professor = await criarUsuario(["PROFESSOR"], `Professor ${id}`);
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: `CT03-${id}`, ordem: sequencia + 1 } });
  const turma = await prisma.turma.create({ data: {
    modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: professor.id,
    dataInicio: new Date("2026-01-01T00:00:00.000Z"),
  } });
  await prisma.alocacaoTurma.create({ data: { alunoId: donoAlunoId, matriculaId, turmaId: turma.id, criadoEm: new Date("2026-01-01T00:00:00.000Z") } });
  sequencia += 1;
  const inicio = new Date(Date.UTC(2026, 0, sequencia + 2, 10));
  const aula = await prisma.encontroAgenda.create({ data: {
    turmaId: turma.id, professorId: professor.id, preparadorId: secretariaId, inicio,
    fim: new Date(inicio.getTime() + 3_600_000), fusoOrigem: "UTC", status: "PREVISTO",
    motivo: "Aula da fixture CT03", chaveIdempotencia: `aula-${id}`, entradaHash: "fixture-ct03",
    diario: { create: { turmaId: turma.id, professorId: professor.id, ocorridaEm: inicio, conteudo: "Aula CT03", registros: {
      create: { alunoId: donoAlunoId, matriculaId, nomeAluno: "Aluno CT03", presente: false, participacao: "FALTA" },
    } } },
  } });
  await prisma.encontroAgenda.update({ where: { id: aula.id }, data: { status: "MINISTRADO" } });
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "ReposicaoIndividual" (id,"aulaOriginalId","matriculaId",modalidade,"solicitanteId",motivo,evidencia,"chaveIdempotencia","entradaHash")
    VALUES (${id},${aula.id},${matriculaId},'GRAVACAO'::"ModalidadeReposicaoIndividual",${secretariaId},'Reposição CT03','Falta comprovada',${`repo-${id}`},'fixture-ct03')
  `);
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "DecisaoReposicaoIndividual" (id,"reposicaoId","decisorId",aprovada,motivo)
    VALUES (${`decisao-${id}`},${id},${gestorId},true,'Aprovação independente CT03')
  `);
  const materialId = `material-${id}`;
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "MaterialReposicaoGravacao" (id,"reposicaoId",provedor,"arquivoOficialId","driveOrganizacaoId","driveRevisionId","driveRevisionMd5","driveRevisionSize","mimeType",disponivel,"publicadoPorId","publicadoEm")
    VALUES (${materialId},${id},'GOOGLE_DRIVE',${`arquivo-${id}`},'drive-escola',${`revisao-${id}`},${"a".repeat(32)},2,'video/mp4',true,${secretariaId},${utc(new Date("2026-09-01T10:00:00.000Z"))})
  `);
  await prisma.fonteRevisaoGravacao.create({ data: {
    alvo: "MATERIAL_REPOSICAO", materialReposicaoId: materialId, versao: 1, arquivoOficialId: `arquivo-${id}`,
    driveOrganizacaoId: "drive-escola", driveRevisionId: `revisao-${id}`, driveRevisionMd5: "a".repeat(32),
    driveRevisionSize: 2n, mimeType: "video/mp4",
  } });
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "DisponibilizacaoEntregaReposicao" (id,"reposicaoId","materialId","disponibilizadaEm","prazoBaseMinutos","prazoInicialAte","publicadaPorId")
    VALUES (${`disp-${id}`},${id},${materialId},${utc(new Date("2026-09-01T10:00:00.000Z"))},120,${utc(new Date("2099-09-01T12:00:00.000Z"))},${secretariaId})
  `);
}

const requisicao = (id: string) => new Request(`http://localhost/api/portal-aluno/reposicoes/${id}/video`, {
  headers: { "sec-fetch-site": "same-origin" },
});
const contexto = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(async () => {
  vi.resetAllMocks();
  drive.abrir.mockResolvedValue({
    status: 200,
    headers: new Headers({ "Content-Type": "video/mp4", "Content-Length": "2" }),
    body: new ReadableStream<Uint8Array>({ start(controlador) { controlador.enqueue(new Uint8Array([3, 9])); controlador.close(); } }),
  });
  await truncarBanco();
  catalogo = await seedCatalogoMinimo();
  secretariaId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  gestorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Aluno CT03", paisId: catalogo.pais.id } })).id;
  contaId = (await prisma.contaPortalAluno.create({ data: { alunoId, ativa: true } })).id;
  portal.sessao = { sessaoId: "sessao-portal-ct03", contaId, alunoId, email: "ct03@example.test" };
  sequencia = 0;
});

it("CT03 isola a rota de vídeo entre contratos do mesmo aluno e de outro aluno antes do Drive", async () => {
  const criarMatricula = (donoId: string) => prisma.matricula.create({ data: {
    alunoId: donoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA",
  } });
  const matriculaPausada = await criarMatricula(alunoId);
  const matriculaAtiva = await criarMatricula(alunoId);
  const outroAluno = await prisma.aluno.create({ data: { primeiroNome: "Outro CT03", paisId: catalogo.pais.id } });
  const matriculaOutroAluno = await criarMatricula(outroAluno.id);
  await prepararReposicao("repo-ct03-pausada", matriculaPausada.id, alunoId);
  await prepararReposicao("repo-ct03-ativa", matriculaAtiva.id, alunoId);
  await prepararReposicao("repo-ct03-outro", matriculaOutroAluno.id, outroAluno.id);
  await prisma.matricula.update({ where: { id: matriculaPausada.id }, data: { status: "PAUSADA" } });

  const pausada = await GET(requisicao("repo-ct03-pausada"), contexto("repo-ct03-pausada"));
  expect(pausada.status).toBe(403);
  expect(drive.abrir).not.toHaveBeenCalled();

  const ativa = await GET(requisicao("repo-ct03-ativa"), contexto("repo-ct03-ativa"));
  expect(ativa.status).toBe(200);
  expect(drive.abrir).toHaveBeenCalledOnce();
  expect(drive.abrir).toHaveBeenCalledWith(expect.objectContaining({
    fonte: expect.objectContaining({ fileId: "arquivo-repo-ct03-ativa", revisionId: "revisao-repo-ct03-ativa" }),
  }));
  expect(new Uint8Array(await ativa.arrayBuffer())).toEqual(new Uint8Array([3, 9]));

  const outro = await GET(requisicao("repo-ct03-outro"), contexto("repo-ct03-outro"));
  expect(outro.status).toBe(403);
  expect(drive.abrir).toHaveBeenCalledTimes(1);
});
