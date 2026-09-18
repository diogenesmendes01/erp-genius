import { beforeEach, expect, it, vi } from "vitest";
import { ModalidadeReposicaoIndividual, Papel } from "@prisma/client";

const { authMock, fixarMock, consultarMock } = vi.hoisted(() => ({ authMock: vi.fn(), fixarMock: vi.fn(), consultarMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("./credenciais", () => ({ obterDriveOrganizacaoId: () => "drive-escola", obterTokenDrive: vi.fn() }));
vi.mock("./credenciais-publicacao", () => ({ obterTokenPublicacaoDrive: vi.fn() }));
vi.mock("./drive-revisao", () => ({ fixarRevisaoDriveOrganizacional: fixarMock, consultarRevisaoDriveFixada: consultarMock }));
vi.mock("@/server/_shared/sessao", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/_shared/sessao")>();
  const sessao = async () => {
    const id = (await authMock())?.user?.id;
    const usuario = id && await prisma.usuario.findUnique({ where: { id }, select: { id: true, nome: true, ativo: true, papeis: true } });
    if (!usuario?.ativo) throw new original.ErroAutenticacao();
    return usuario;
  };
  return { ...original, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const usuario = await sessao(); original.exigirPapel(usuario, ...papeis); return usuario;
  } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { decidirRegularizacaoFonteGravacao, proporRegularizacaoFonteGravacao } from "./regularizacao-fonte";

let professorId: string;
let gestorId: string;
let administradorId: string;
let publicacaoId: string;
let materialId: string;
let encontroId: string;
let catalogo: Awaited<ReturnType<typeof seedCatalogoMinimo>>;
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const fonteFixa = { fileId: "arquivo-novo-q23", driveId: "drive-escola", revisionId: "revisao-nova-q23", md5Checksum: "b".repeat(32), size: 42, mimeType: "video/mp4" };

async function criarPublicacao(professor: string, chave: string, horario = { inicio: new Date("2026-01-10T10:00:00Z"), fim: new Date("2026-01-10T11:00:00Z") }) {
  const aluno = await prisma.aluno.create({ data: { primeiroNome: `Aluno ${chave}`, paisId: catalogo.pais.id } });
  const matricula = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } });
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: `Q23-${chave}`, ordem: Math.floor(Math.random() * 1_000_000) } });
  const turma = await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: professor, status: "EM_ANDAMENTO", dataInicio: new Date("2025-01-01T00:00:00Z") } });
  await prisma.vinculoDocente.create({ data: { turmaId: turma.id, professorId: professor, inicio: new Date("2025-01-01T00:00:00Z") } });
  const encontro = await prisma.encontroAgenda.create({ data: {
    turmaId: turma.id, professorId: professor, preparadorId: gestorId, finalidade: "AULA", status: "PREVISTO",
    inicio: horario.inicio, fim: horario.fim, fusoOrigem: "UTC",
    motivo: "Aula concluída com gravação oficial.", chaveIdempotencia: `encontro-${chave}`, entradaHash: "a".repeat(64),
    diario: { create: { turmaId: turma.id, professorId: professor, ocorridaEm: horario.inicio, conteudo: "Conteúdo da aula.", registros: { create: { alunoId: aluno.id, matriculaId: matricula.id, nomeAluno: aluno.primeiroNome, presente: false, participacao: "FALTA" } } } },
  } });
  const diario = await prisma.aulaDiario.findUniqueOrThrow({ where: { encontroId: encontro.id }, select: { id: true } });
  const publicacao = await prisma.publicacaoGravacaoAula.create({ data: {
    encontroId: encontro.id, publicadorId: professor, arquivoOficialId: `arquivo-original-${chave}`, driveOrganizacaoId: "drive-escola", driveRevisionId: `revisao-original-${chave}`,
    driveRevisionMd5: "a".repeat(32), driveRevisionSize: 10n, mimeType: "video/mp4", chaveIdempotencia: `publicacao-${chave}`, entradaHash: "c".repeat(64), snapshot: { encontroId: encontro.id, diarioId: diario.id },
  } });
  await prisma.encontroAgenda.update({ where: { id: encontro.id }, data: { status: "MINISTRADO" } });
  await prisma.fonteRevisaoGravacao.create({ data: { alvo: "PUBLICACAO_AULA", publicacaoAulaId: publicacao.id, versao: 1, arquivoOficialId: `arquivo-original-${chave}`, driveOrganizacaoId: "drive-escola", driveRevisionId: `revisao-original-${chave}`, driveRevisionMd5: "a".repeat(32), driveRevisionSize: 10n, mimeType: "video/mp4" } });
  return { publicacaoId: publicacao.id, encontroId: encontro.id, matriculaId: matricula.id };
}

beforeEach(async () => {
  await truncarBanco();
  catalogo = await seedCatalogoMinimo();
  professorId = (await criarUsuario([Papel.PROFESSOR])).id;
  gestorId = (await criarUsuario([Papel.GERENTE_PEDAGOGICO])).id;
  administradorId = (await criarUsuario([Papel.ADMINISTRADOR])).id;
  const principal = await criarPublicacao(professorId, "principal");
  publicacaoId = principal.publicacaoId; encontroId = principal.encontroId;
  materialId = (await prisma.materialReposicaoGravacao.create({ data: {
    reposicao: { create: {
      aulaOriginalId: principal.encontroId, matriculaId: principal.matriculaId, modalidade: ModalidadeReposicaoIndividual.GRAVACAO,
      solicitanteId: gestorId, motivo: "Material da reposição existente.", evidencia: "Registro válido para testar o alvo material.",
      chaveIdempotencia: "reposicao-q23-material", entradaHash: "d".repeat(64),
    } },
    provedor: "GOOGLE_DRIVE", arquivoOficialId: "arquivo-material-q23", disponivel: true,
    publicadoPor: { connect: { id: gestorId } }, publicadoEm: new Date("2026-01-11T10:00:00Z"),
  } })).id;
  fixarMock.mockResolvedValue(fonteFixa);
  consultarMock.mockResolvedValue(fonteFixa);
  entrar(professorId);
});

const entrada = (alvoId = publicacaoId, chaveIdempotencia = "q23-docente-proposta") => ({ alvo: "PUBLICACAO_AULA" as const, alvoId, arquivoOficialId: fonteFixa.fileId, motivo: "O docente conferiu a gravação institucional da aula.", chaveIdempotencia });

async function inserirPropostaDireta(alvo: "PUBLICACAO_AULA" | "MATERIAL_REPOSICAO", alvoId: string, chaveIdempotencia: string, timezone?: string) {
  return prisma.$transaction(async (tx) => {
    if (timezone) await tx.$executeRaw`SELECT set_config('TimeZone', ${timezone}, true)`;
    return tx.propostaRegularizacaoFonteGravacao.create({ data: {
      alvo, ...(alvo === "PUBLICACAO_AULA" ? { publicacaoAulaId: alvoId } : { materialReposicaoId: alvoId }),
      versaoEsperada: 1, arquivoOficialId: fonteFixa.fileId, driveOrganizacaoId: fonteFixa.driveId,
      driveRevisionId: fonteFixa.revisionId, driveRevisionMd5: fonteFixa.md5Checksum,
      driveRevisionSize: BigInt(fonteFixa.size), mimeType: fonteFixa.mimeType,
      motivo: "Prova direta do guard SQL da correção de fonte.", preparadorId: professorId, chaveIdempotencia,
    } });
  });
}

it("Q23 docente vigente prepara fonte da própria aula e gestão independente fixa a próxima versão", async () => {
  const proposta = await proporRegularizacaoFonteGravacao(entrada());
  expect(proposta, proposta.ok ? undefined : proposta.erro).toMatchObject({ ok: true });
  if (!proposta.ok || !proposta.dado) throw new Error(proposta.ok ? "Proposta ausente" : proposta.erro);
  expect(await proporRegularizacaoFonteGravacao(entrada())).toEqual(proposta);
  entrar(administradorId);
  expect(await decidirRegularizacaoFonteGravacao({ propostaId: proposta.dado.id, aprovar: true, motivo: "Gestão conferiu a revisão fixada de forma independente." })).toMatchObject({ ok: true });
  expect(await prisma.fonteRevisaoGravacao.findMany({ where: { publicacaoAulaId: publicacaoId }, orderBy: { versao: "asc" } })).toMatchObject([
    { versao: 1, arquivoOficialId: "arquivo-original-principal" }, { versao: 2, propostaId: proposta.dado.id, arquivoOficialId: fonteFixa.fileId, driveRevisionId: fonteFixa.revisionId },
  ]);
  expect(await prisma.decisaoRegularizacaoFonteGravacao.findFirstOrThrow({ where: { propostaId: proposta.dado.id } })).toMatchObject({ decisorId: administradorId, aprovada: true });
});

it("recusa ex-professor, outra aula e material; revogação durante I/O não persiste proposta", async () => {
  await prisma.vinculoDocente.updateMany({ where: { professorId }, data: { fim: new Date("2026-02-01T00:00:00Z") } });
  expect(await proporRegularizacaoFonteGravacao(entrada())).toMatchObject({ ok: false });
  await prisma.vinculoDocente.updateMany({ where: { professorId }, data: { fim: null } });
  const outroProfessor = (await criarUsuario([Papel.PROFESSOR])).id;
  const outra = await criarPublicacao(outroProfessor, "outra");
  expect(await proporRegularizacaoFonteGravacao(entrada(outra.publicacaoId, "q23-outra-aula"))).toMatchObject({ ok: false });
  expect(await proporRegularizacaoFonteGravacao({ ...entrada(publicacaoId, "q23-material"), alvo: "MATERIAL_REPOSICAO", alvoId: materialId })).toMatchObject({ ok: false });
  fixarMock.mockImplementationOnce(async () => {
    await prisma.usuario.update({ where: { id: professorId }, data: { ativo: false } });
    return fonteFixa;
  });
  expect(await proporRegularizacaoFonteGravacao(entrada(publicacaoId, "q23-revogado-io"))).toMatchObject({ ok: false });
  expect(await prisma.propostaRegularizacaoFonteGravacao.count()).toBe(0);
  expect(await prisma.fonteRevisaoGravacao.count({ where: { publicacaoAulaId: publicacaoId } })).toBe(1);
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } })).toMatchObject({ status: "MINISTRADO" });
});

it("guard SQL aceita docente vigente em fuso não UTC e rejeita vínculo encerrado ou material", async () => {
  const agora = Date.now();
  const publicacaoFuso = await criarPublicacao(professorId, "fuso-sql", {
    inicio: new Date(agora - 2 * 60 * 60 * 1_000), fim: new Date(agora - 60 * 60 * 1_000),
  });
  await expect(inserirPropostaDireta("PUBLICACAO_AULA", publicacaoFuso.publicacaoId, "q23-sql-fuso", "America/Adak"))
    .resolves.toMatchObject({ publicacaoAulaId: publicacaoFuso.publicacaoId, preparadorId: professorId });

  await prisma.vinculoDocente.updateMany({ where: { professorId }, data: { fim: new Date("2026-02-01T00:00:00Z") } });
  await expect(inserirPropostaDireta("PUBLICACAO_AULA", publicacaoId, "q23-sql-ex-professor"))
    .rejects.toThrow("Preparador sem gestão ativa ou vínculo docente vigente da aula");
  await expect(inserirPropostaDireta("MATERIAL_REPOSICAO", materialId, "q23-sql-material"))
    .rejects.toThrow("Material exige preparador de gestão ativo");
});
