import { beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
const { metadataMock, disponibilidadeMock } = vi.hoisted(() => ({ metadataMock: vi.fn(), disponibilidadeMock: vi.fn() }));
const { tokenPublicacaoMock } = vi.hoisted(() => ({ tokenPublicacaoMock: vi.fn() }));
vi.mock("@/server/gravacoes/credenciais", () => ({ obterDriveOrganizacaoId: () => "drive-escola", obterTokenDrive: vi.fn() }));
vi.mock("@/server/gravacoes/credenciais-publicacao", () => ({ obterTokenPublicacaoDrive: tokenPublicacaoMock }));
vi.mock("@/server/gravacoes/disponibilidade", () => ({ verificarDisponibilidadeGravacaoDrive: disponibilidadeMock }));
vi.mock("@/server/gravacoes/drive-revisao", () => ({ fixarRevisaoDriveOrganizacional: metadataMock, consultarRevisaoDriveFixada: metadataMock }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared", async original => {
  const real = await original<typeof import("@/server/_shared")>();
  return { ...real, exigirSessaoComPapel: async (...papeis: import("@prisma/client").Papel[]) => {
    const session = await authMock();
    const u = await prisma.usuario.findUniqueOrThrow({ where: { id: session.user.id }, select: { id: true, nome: true, papeis: true, ativo: true } });
    if (!u.ativo) throw new real.ErroPermissao();
    real.exigirPapel(u, ...papeis); return u;
  } };
});
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { designarRegularizacaoAula, revogarRegularizacaoAula } from "./regularizacao-designacao";
import { listarChamadaEncontro } from "./chamada-encontro";
import { salvarAulaDiario } from "./acoes";
import { salvarDiarioParticular } from "./particular";
import { listarRegularizacoesAula, consultarDesignacoesAula } from "./regularizacao-consultas";
import { registrarGravacaoAula } from "./gravacao-aula";
import { revisarCorrecaoAula, proporCorrecaoAula, revisarImpactosCorrecaoAula, aprovarCorrecaoAula } from "./correcao-aula";
import { autorizarVideoAulaInstitucional } from "@/server/gravacoes/aula-institucional";
import { publicarMaterialReposicaoGravacao } from "@/server/portal-aluno/entregas-reposicao";
import { solicitarReposicaoIndividual, decidirReposicaoIndividual } from "./reposicao-individual";
import { solicitarConclusaoSemGravacao, decidirConclusaoSemGravacao } from "./excecao-gravacao";

let gestorId: string, professorId: string, responsavelId: string, secretariaId: string, encontroId: string;
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const entrada = () => ({ encontroId, responsavelId, motivo: "Responsável designado para conferir os registros pendentes.", chaveIdempotencia: "regularizacao-466" });

beforeEach(async () => {
  metadataMock.mockReset().mockResolvedValue({ fileId: "video-oficial", driveId: "drive-escola", revisionId: "revisao-video-1", md5Checksum: "a".repeat(32), size: "10", mimeType: "video/mp4" });
  tokenPublicacaoMock.mockReset();
  disponibilidadeMock.mockReset().mockResolvedValue(undefined);
  await truncarBanco(); const c = await seedCatalogoMinimo();
  gestorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  professorId = (await criarUsuario(["PROFESSOR"])).id;
  responsavelId = (await criarUsuario(["PROFESSOR"])).id;
  secretariaId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  const nivel = await prisma.nivel.create({ data: { idiomaId: c.idioma.id, codigo: "A1-Q24", ordem: 1 } });
  const turma = await prisma.turma.create({ data: { modalidadeId: c.modalidade.id, nivelId: nivel.id, professorId } });
  const encontro = await prisma.encontroAgenda.create({ data: { turmaId: turma.id, professorId, preparadorId: secretariaId,
    inicio: new Date("2026-01-01T10:00:00Z"), fim: new Date("2026-01-01T11:00:00Z"), finalidade: "AULA", status: "PREVISTO", fusoOrigem: "UTC",
    motivo: "Aula antiga que aguarda regularização do diário.", chaveIdempotencia: "aula-q24-466", entradaHash: "fixture" } });
  encontroId = encontro.id; entrar(gestorId);
});

it("designa uma vez, preserva a aula e revoga sem apagar a atribuição original", async () => {
  const original = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } });
  const [a, b] = await Promise.all([designarRegularizacaoAula(entrada()), designarRegularizacaoAula(entrada())]);
  expect(a).toMatchObject({ ok: true, dado: { revogada: false } }); expect(b).toEqual(a);
  if (!a.ok || !a.dado) throw new Error(JSON.stringify(a));
  expect(await prisma.designacaoRegularizacaoAula.count()).toBe(1);
  expect(await prisma.evento.count({ where: { tipo: "RegularizacaoAulaDesignada" } })).toBe(1);
  expect(await designarRegularizacaoAula({ ...entrada(), chaveIdempotencia: "segunda-atribuicao-466" })).toMatchObject({ ok: false });
  const pedidoRevogacao = { designacaoId: a.dado.id, motivo: "A gestão encerra esta atribuição limitada." };
  const revogacao = await revogarRegularizacaoAula(pedidoRevogacao);
  expect(revogacao).toMatchObject({ ok: true });
  expect(await revogarRegularizacaoAula(pedidoRevogacao)).toEqual(revogacao);
  expect(await designarRegularizacaoAula(entrada())).toMatchObject({ ok: true, dado: { id: a.dado.id, revogada: true } });
  expect(await designarRegularizacaoAula({ ...entrada(), chaveIdempotencia: "novo-responsavel-466" })).toMatchObject({ ok: true });
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } })).toEqual(original);
  expect(await prisma.aulaDiario.count()).toBe(0);
  expect((await prisma.turma.findUniqueOrThrow({ where: { id: original.turmaId! } })).professorId).toBe(professorId);
});

it("recusa papel indevido, responsável inativo e aula futura", async () => {
  for (const id of [professorId, secretariaId]) { entrar(id); expect(await designarRegularizacaoAula(entrada())).toMatchObject({ ok: false }); }
  entrar(gestorId);
  expect(await designarRegularizacaoAula({ ...entrada(), responsavelId: secretariaId })).toMatchObject({ ok: false });
  await prisma.usuario.update({ where: { id: responsavelId }, data: { ativo: false } });
  expect(await designarRegularizacaoAula(entrada())).toMatchObject({ ok: false });
  await prisma.usuario.update({ where: { id: responsavelId }, data: { ativo: true } });
  await prisma.encontroAgenda.update({ where: { id: encontroId }, data: { inicio: new Date("2099-01-01T10:00:00Z"), fim: new Date("2099-01-01T11:00:00Z") } });
  expect(await designarRegularizacaoAula(entrada())).toMatchObject({ ok: false });
  expect(await prisma.designacaoRegularizacaoAula.count()).toBe(0);
});

it("banco protege a designação e a revogação contra reescrita e valida papéis", async () => {
  await expect(prisma.designacaoRegularizacaoAula.create({ data: { ...entrada(), designadorId: secretariaId, entradaHash: "a".repeat(64) } })).rejects.toThrow();
  const a = await designarRegularizacaoAula(entrada());
  if (!a.ok || !a.dado) throw new Error(JSON.stringify(a));
  await expect(prisma.designacaoRegularizacaoAula.create({ data: { ...entrada(), chaveIdempotencia: "duplicada-direta-466", designadorId: gestorId, entradaHash: "b".repeat(64) } })).rejects.toThrow();
  await expect(prisma.designacaoRegularizacaoAula.update({ where: { id: a.dado.id }, data: { responsavelId: professorId } })).rejects.toThrow();
  await expect(prisma.designacaoRegularizacaoAula.delete({ where: { id: a.dado.id } })).rejects.toThrow();
  await expect(prisma.revogacaoDesignacaoRegularizacaoAula.create({ data: { designacaoId: a.dado.id, revogadorId: secretariaId, motivo: "Secretaria tenta revogar indevidamente." } })).rejects.toThrow();
  const r = await revogarRegularizacaoAula({ designacaoId: a.dado.id, motivo: "Revogação registrada pela gestão responsável." });
  if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
  await expect(prisma.revogacaoDesignacaoRegularizacaoAula.delete({ where: { id: r.dado.id } })).rejects.toThrow();
  await expect(prisma.revogacaoDesignacaoRegularizacaoAula.update({ where: { id: r.dado.id }, data: { motivo: "Alteração indevida" } })).rejects.toThrow();
  await prisma.usuario.update({ where: { id: gestorId }, data: { ativo: false } });
  expect(await designarRegularizacaoAula(entrada())).toMatchObject({ ok: false });
});

it.each(["PROFESSOR", "GERENTE_PEDAGOGICO", "ADMINISTRADOR"] as const)("designado %s consulta e regulariza somente a aula atribuída, preservando autoria", async papel => {
  await prisma.usuario.update({ where: { id: responsavelId }, data: { papeis: [papel] } });
  const encontro = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } });
  const pais = await prisma.pais.findFirstOrThrow();
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno", sobrenome: "Histórico", paisId: pais.id,
    documento: "DOCUMENTO-NAO-DIVULGAR", email: "privado@example.test", telefoneE164: "+5511999999999",
    alocacoes: { create: { turmaId: encontro.turmaId!, criadoEm: new Date("2025-12-01T00:00:00Z") } } } });
  const dados = { encontroId, turmaId: encontro.turmaId!, ocorridaEm: encontro.inicio.toISOString(), conteudo: "Conteúdo conferido nos registros da aula",
    registros: [{ alunoId: aluno.id, presente: true }] };
  entrar(responsavelId);
  expect(await listarChamadaEncontro({ encontroId })).toMatchObject({ ok: false });
  expect(await salvarAulaDiario(dados)).toMatchObject({ ok: false });
  entrar(gestorId);
  const atribuicao = await designarRegularizacaoAula(entrada());
  if (!atribuicao.ok || !atribuicao.dado) throw new Error(JSON.stringify(atribuicao));
  entrar(responsavelId);
  const chamada = await listarChamadaEncontro({ encontroId });
  expect(chamada).toMatchObject({ ok: true, dado: { alunos: [{ alunoId: aluno.id }] } });
  expect(JSON.stringify(chamada)).not.toContain("DOCUMENTO-NAO-DIVULGAR");
  expect(JSON.stringify(chamada)).not.toContain("privado@example.test");
  const salvo = await salvarAulaDiario(dados);
  expect(salvo).toMatchObject({ ok: true });
  if (!salvo.ok || !salvo.dado) throw new Error(JSON.stringify(salvo));
  expect((await prisma.aulaDiario.findUniqueOrThrow({ where: { id: salvo.dado.id } })).professorId).toBe(professorId);
  expect((await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } })).professorId).toBe(professorId);
  const evento = await prisma.evento.findFirstOrThrow({ where: { tipo: "AulaDiarioRegistrada", autorId: responsavelId } });
  expect(JSON.stringify(evento.payload)).toContain(atribuicao.dado.id);
  const outra = await prisma.encontroAgenda.create({ data: { turmaId: encontro.turmaId, professorId, preparadorId: gestorId,
    inicio: new Date("2026-01-02T10:00:00Z"), fim: new Date("2026-01-02T11:00:00Z"), fusoOrigem: "UTC", status: "PREVISTO",
    motivo: "Outra aula não atribuída ao responsável", chaveIdempotencia: "outra-aula-q24-467", entradaHash: "fixture" } });
  expect(await listarChamadaEncontro({ encontroId: outra.id })).toMatchObject({ ok: false });
  const atual = await listarChamadaEncontro({ encontroId });
  if (!atual.ok || !atual.dado) throw new Error(JSON.stringify(atual));
  const edicao = { ...dados, aulaId: salvo.dado.id, estadoAnterior: atual.dado.estadoAnterior!, conteudo: "Complemento de regularização" };
  expect(await salvarAulaDiario(edicao)).toMatchObject({ ok: true });
  const excecao = await solicitarConclusaoSemGravacao({ encontroId, motivo: "Gravação não recuperável; registros de aula conferidos", chaveIdempotencia: "excecao-designado-467" });
  expect(excecao).toMatchObject({ ok: true });
  if (!excecao.ok || !excecao.dado) throw new Error(JSON.stringify(excecao));
  expect(await decidirConclusaoSemGravacao({ excecaoId: excecao.dado.id, aprovar: true, motivo: "Tentativa de autoaprovação indevida" })).toMatchObject({ ok: false });
  entrar(gestorId);
  expect(await revogarRegularizacaoAula({ designacaoId: atribuicao.dado.id, motivo: "Encerrada a autorização de regularização" })).toMatchObject({ ok: true });
  entrar(responsavelId);
  expect(await listarChamadaEncontro({ encontroId })).toMatchObject({ ok: false });
  expect(await salvarAulaDiario(edicao)).toMatchObject({ ok: false });
  expect(await solicitarConclusaoSemGravacao({ encontroId, motivo: "Nova solicitação após revogação", chaveIdempotencia: "excecao-revogada-467" })).toMatchObject({ ok: false });
  expect((await prisma.aulaDiario.findUniqueOrThrow({ where: { id: salvo.dado.id } })).conteudo).toBe(edicao.conteudo);
  entrar(gestorId);
  expect(await decidirConclusaoSemGravacao({ excecaoId: excecao.dado.id, aprovar: true, motivo: "Registros conferidos por outra pessoa da gestão" })).toMatchObject({ ok: true, dado: { concluida: true } });
  expect((await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } })).status).toBe("MINISTRADO");
  expect(await listarRegularizacoesAula()).toMatchObject({ ok: true, dado: { itens: [{ id: outra.id }] } });
  expect(await listarRegularizacoesAula({ modo: "HISTORICO" })).toMatchObject({ ok: true, dado: { modo: "HISTORICO", itens: [{ id: encontroId, status: "MINISTRADO", podeRegularizar: false, podeGerir: false }] } });
  expect(await consultarDesignacoesAula({ encontroId })).toMatchObject({ ok: true, dado: { podeGerir: false, responsaveis: [], historico: [{ id: atribuicao.dado.id }] } });
  expect(await designarRegularizacaoAula({ ...entrada(), chaveIdempotencia: "reabrir-concluida-469" })).toMatchObject({ ok: false });
  entrar(professorId);
  expect(await listarRegularizacoesAula({ modo: "HISTORICO" })).toMatchObject({ ok: false });
});

it("designação de particular preserva contrato, professor e financeiro", async () => {
  const pais = await prisma.pais.findFirstOrThrow();
  const produto = await prisma.produto.findFirstOrThrow();
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno", sobrenome: "Particular", paisId: pais.id } });
  const m = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: produto.id, paisId: pais.id, moeda: "CRC", status: "ATIVA", ativadaEm: new Date("2025-12-01T00:00:00Z") } });
  const e = await prisma.encontroAgenda.create({ data: { matriculaId: m.id, professorId, preparadorId: gestorId,
    inicio: new Date("2026-01-03T10:00:00Z"), fim: new Date("2026-01-03T11:00:00Z"), status: "PREVISTO", fusoOrigem: "UTC",
    motivo: "Particular pendente de regularização", chaveIdempotencia: "particular-q24-467", entradaHash: "fixture" } });
  const a = await designarRegularizacaoAula({ ...entrada(), encontroId: e.id });
  if (!a.ok || !a.dado) throw new Error(JSON.stringify(a));
  entrar(responsavelId);
  expect(await listarChamadaEncontro({ encontroId: e.id })).toMatchObject({ ok: true, dado: { alunos: [{ alunoId: aluno.id }] } });
  const d = { encontroId: e.id, ocorridaEm: e.inicio.toISOString(), conteudo: "Conteúdo recuperado da aula particular", registros: [{ alunoId: aluno.id, presente: true }] };
  const r = await salvarDiarioParticular(d);
  if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
  expect(await prisma.aulaDiario.findUnique({ where: { id: r.dado.id } })).toMatchObject({ professorId, encontroId: e.id, turmaId: null });
  expect(await prisma.registroAulaAluno.findFirst({ where: { aulaId: r.dado.id } })).toMatchObject({ alunoId: aluno.id, matriculaId: m.id });
  expect(await prisma.cobranca.count()).toBe(0);
  expect(await prisma.recebimento.count()).toBe(0);
  entrar(gestorId);
  expect(await revogarRegularizacaoAula({ designacaoId: a.dado.id, motivo: "Regularização da particular encerrada" })).toMatchObject({ ok: true });
  entrar(responsavelId);
  expect(await listarChamadaEncontro({ encontroId: e.id })).toMatchObject({ ok: false });
  expect(await salvarDiarioParticular(d)).toMatchObject({ ok: false });
});

it("fila limita professor às designações vigentes e histórico fica com a gestão", async () => {
  entrar(responsavelId);
  expect(await listarRegularizacoesAula()).toMatchObject({ ok: true, dado: { gestao: false, itens: [] } });
  expect(await consultarDesignacoesAula({ encontroId })).toMatchObject({ ok: false });
  entrar(gestorId);
  expect(await listarRegularizacoesAula()).toMatchObject({ ok: true, dado: { gestao: true, itens: [{ id: encontroId, podeRegularizar: false, designacao: null }] } });
  const a = await designarRegularizacaoAula(entrada());
  if (!a.ok || !a.dado) throw new Error(JSON.stringify(a));
  const historico = await consultarDesignacoesAula({ encontroId });
  expect(historico).toMatchObject({ ok: true, dado: { historico: [{ id: a.dado.id, revogacao: null }] } });
  if (!historico.ok || !historico.dado) throw new Error(JSON.stringify(historico));
  expect(historico.dado.responsaveis.some(u => u.id === secretariaId)).toBe(false);
  expect(JSON.stringify(historico)).not.toContain("chaveIdempotencia");
  entrar(responsavelId);
  expect(await listarRegularizacoesAula()).toMatchObject({ ok: true, dado: { itens: [{ id: encontroId, podeRegularizar: true, designacao: { id: a.dado.id } }] } });
  await prisma.usuario.update({ where: { id: responsavelId }, data: { ativo: false } });
  expect(await listarRegularizacoesAula()).toMatchObject({ ok: false });
  await prisma.usuario.update({ where: { id: responsavelId }, data: { ativo: true } });
  entrar(gestorId);
  await revogarRegularizacaoAula({ designacaoId: a.dado.id, motivo: "Encerrar acesso à fila desta pendência" });
  expect(await consultarDesignacoesAula({ encontroId })).toMatchObject({ ok: true, dado: { historico: [{ id: a.dado.id, revogacao: { motivo: "Encerrar acesso à fila desta pendência" } }] } });
  entrar(responsavelId);
  expect(await listarRegularizacoesAula()).toMatchObject({ ok: true, dado: { itens: [] } });
  entrar(secretariaId);
  expect(await listarRegularizacoesAula()).toMatchObject({ ok: false });
  expect(await listarRegularizacoesAula({ modo: "HISTORICO" })).toMatchObject({ ok: false });
});

it("pagina pendências sem duplicar encontros nem devolver histórico na fila", async () => {
  const e = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } });
  for (let i = 1; i <= 30; i++) {
    await prisma.encontroAgenda.create({ data: { turmaId: e.turmaId, professorId, preparadorId: gestorId, fusoOrigem: "UTC", status: "PREVISTO",
      inicio: new Date(e.inicio.getTime() + i * 86400000), fim: new Date(e.fim.getTime() + i * 86400000),
      motivo: "Aula pendente para paginação", chaveIdempotencia: `fila-q24-468-${i}`, entradaHash: "fixture" } });
  }
  const primeira = await listarRegularizacoesAula();
  if (!primeira.ok || !primeira.dado?.proximoCursor) throw new Error(JSON.stringify(primeira));
  expect(primeira.dado.itens).toHaveLength(30);
  const segunda = await listarRegularizacoesAula({ cursor: primeira.dado.proximoCursor });
  if (!segunda.ok || !segunda.dado) throw new Error(JSON.stringify(segunda));
  expect(segunda.dado.itens).toHaveLength(1);
  expect(segunda.dado.proximoCursor).toBeNull();
  expect(new Set([...primeira.dado.itens, ...segunda.dado.itens].map(e => e.id)).size).toBe(31);
  expect(JSON.stringify(primeira)).not.toContain("registros");
});

it.each(["sucesso", "sucesso-concorrente", "sucesso-reposicao", "indisponivel", "chamada-alterada", "papel-revogado"])("registro de gravação confere fonte, chamada e autorização: %s", async caso => {
  const sucesso = caso.startsWith("sucesso");
  const e = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } });
  const pais = await prisma.pais.findFirstOrThrow();
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno", sobrenome: "Gravação", paisId: pais.id,
    alocacoes: { create: { turmaId: e.turmaId!, criadoEm: new Date("2025-12-01T00:00:00Z") } } } });
  const produto = await prisma.produto.findFirstOrThrow();
  const matricula = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: produto.id, paisId: pais.id, moeda: "CRC", status: "ATIVA", ativadaEm: new Date("2025-12-01T00:00:00Z") } });
  await prisma.alocacaoTurma.updateMany({ where: { alunoId: aluno.id }, data: { matriculaId: matricula.id } });
  const entradaVideo = { encontroId, arquivoOficialId: "video-oficial", chaveIdempotencia: "gravacao-aula-471" };
  entrar(professorId);
  expect(await registrarGravacaoAula(entradaVideo)).toMatchObject({ ok: false });
  expect(metadataMock).not.toHaveBeenCalled();
  const diario = await salvarAulaDiario({ encontroId, turmaId: e.turmaId!, ocorridaEm: e.inicio.toISOString(), conteudo: "Aula com vídeo institucional",
    registros: [{ alunoId: aluno.id, presente: caso !== "sucesso-reposicao", participacao: caso === "sucesso-reposicao" ? "FALTA" : "PRESENTE" }] });
  if (!diario.ok || !diario.dado) throw new Error(JSON.stringify(diario));
  if (caso === "indisponivel") metadataMock.mockRejectedValueOnce(new Error("Vídeo indisponível"));
  if (caso === "chamada-alterada") metadataMock.mockImplementationOnce(async () => {
    await prisma.aulaDiario.update({ where: { id: diario.dado!.id }, data: { conteudo: "Aula alterada durante conferência" } });
    return { fileId: "video-oficial", driveId: "drive-escola", revisionId: "revisao-video-1", md5Checksum: "a".repeat(32), size: "10", mimeType: "video/mp4" };
  });
  if (caso === "papel-revogado") metadataMock.mockImplementationOnce(async () => {
    await prisma.usuario.update({ where: { id: professorId }, data: { ativo: false } });
    return { fileId: "video-oficial", driveId: "drive-escola", revisionId: "revisao-video-1", md5Checksum: "a".repeat(32), size: "10", mimeType: "video/mp4" };
  });
  const resultados = caso === "sucesso-concorrente" ? await Promise.all([registrarGravacaoAula(entradaVideo), registrarGravacaoAula(entradaVideo)]) : [await registrarGravacaoAula(entradaVideo)];
  const r = resultados[0];
  if (caso === "sucesso-concorrente") expect(resultados[1]).toEqual(r);
  if (!sucesso) {
    expect(r).toMatchObject({ ok: false });
    expect(await prisma.publicacaoGravacaoAula.count()).toBe(0);
  } else {
    expect(r).toMatchObject({ ok: true });
    expect(await registrarGravacaoAula(entradaVideo)).toEqual(r);
    expect(metadataMock).toHaveBeenCalledTimes(caso === "sucesso-concorrente" ? 2 : 1);
    expect(metadataMock).toHaveBeenCalledWith(expect.objectContaining({ token: tokenPublicacaoMock }));
    expect(await prisma.publicacaoGravacaoAula.count()).toBe(1);
    const p = await prisma.publicacaoGravacaoAula.findFirstOrThrow();
    expect(p).toMatchObject({ encontroId, publicadorId: professorId, arquivoOficialId: "video-oficial", driveOrganizacaoId: "drive-escola" });
    await expect(prisma.publicacaoGravacaoAula.update({ where: { id: p.id }, data: { arquivoOficialId: "video-outro" } })).rejects.toThrow();
    await expect(prisma.publicacaoGravacaoAula.delete({ where: { id: p.id } })).rejects.toThrow();
    expect(await prisma.evento.count({ where: { tipo: "GravacaoAulaRegistrada" } })).toBe(1);
  }
  expect((await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } })).status).toBe(sucesso ? "MINISTRADO" : "PREVISTO");
  if (sucesso) {
    expect(await prisma.evento.count({ where: { tipo: "AulaConcluidaComGravacao" } })).toBe(1);
    entrar(gestorId);
    const revisao = await revisarCorrecaoAula({ encontroId });
    if (!revisao.ok || !revisao.dado) throw new Error(JSON.stringify(revisao));
    const fonte = await prisma.publicacaoGravacaoAula.findUniqueOrThrow({ where: { encontroId } });
    expect(revisao.dado.snapshot.gravacao).toEqual({ tipo: "OFICIAL", publicacaoId: fonte.id });
    expect(JSON.stringify(revisao)).not.toContain("video-oficial");
    const proposta = await proporCorrecaoAula({ encontroId, estadoHash: revisao.dado.estadoHash, versaoEsperada: revisao.dado.versaoAtual,
      alteracao: { conteudo: "Conteúdo corrigido preservando vídeo oficial", registros: revisao.dado.snapshot.registros.map(r => ({ registroId: r.registroId, participacao: r.participacao, observacao: r.observacao })) },
      motivo: "Correção do texto após conferência", evidencia: "Conteúdo conferido pela gestão pedagógica", chaveIdempotencia: "correcao-video-oficial-472" });
    if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
    entrar((await criarUsuario(["ADMINISTRADOR"])).id);
    const impacto = await revisarImpactosCorrecaoAula({ propostaId: proposta.dado.id });
    if (!impacto.ok || !impacto.dado) throw new Error(JSON.stringify(impacto));
    expect(await aprovarCorrecaoAula({ propostaId: proposta.dado.id, propostaHash: impacto.dado.propostaHash, impactosHash: impacto.dado.impactosHash, motivo: "Aprovação independente do texto corrigido" })).toMatchObject({ ok: true });
    const efetiva = await revisarCorrecaoAula({ encontroId });
    expect(efetiva).toMatchObject({ ok: true, dado: { snapshot: { gravacao: { tipo: "OFICIAL", publicacaoId: fonte.id }, conteudo: "Conteúdo corrigido preservando vídeo oficial" } } });
    expect(await prisma.publicacaoGravacaoAula.findUniqueOrThrow({ where: { encontroId } })).toEqual(fonte);
    if (caso === "sucesso-reposicao") {
      await prisma.configuracaoOperacional.upsert({ where: { id: "escola" }, create: { id: "escola", prazoPrimeiraEntregaReposicaoMinutos: 120 }, update: { prazoPrimeiraEntregaReposicaoMinutos: 120 } });
      entrar(secretariaId);
      const pedido = await solicitarReposicaoIndividual({ aulaOriginalId: encontroId, matriculaId: matricula.id, modalidade: "GRAVACAO",
        motivo: "Aluno solicita reposição da aula perdida", evidencia: "Solicitação do aluno registrada", chaveIdempotencia: "reposicao-gravacao-original-475" });
      if (!pedido.ok || !pedido.dado) throw new Error(JSON.stringify(pedido));
      expect(await publicarMaterialReposicaoGravacao({ reposicaoId: pedido.dado.id, usarGravacaoAulaOriginal: true })).toMatchObject({ ok: false });
      entrar(gestorId);
      const decisao = await decidirReposicaoIndividual({ reposicaoId: pedido.dado.id, aprovar: true, motivo: "Reposição autorizada pela gestão" });
      if (!decisao.ok) throw new Error(JSON.stringify(decisao));
      const material = await publicarMaterialReposicaoGravacao({ reposicaoId: pedido.dado.id, usarGravacaoAulaOriginal: true });
      if (!material.ok || !material.dado) throw new Error(JSON.stringify(material));
      expect(await prisma.materialReposicaoGravacao.findUnique({ where: { id: material.dado.materialId } })).toMatchObject({ publicacaoAulaId: fonte.id, arquivoOficialId: "video-oficial" });
      expect(await publicarMaterialReposicaoGravacao({ reposicaoId: pedido.dado.id, usarGravacaoAulaOriginal: true })).toMatchObject({ ok: false });
      await expect(prisma.materialReposicaoGravacao.update({ where: { id: material.dado.materialId }, data: { publicacaoAulaId: null } })).rejects.toThrow();
      expect(await prisma.disponibilizacaoEntregaReposicao.count({ where: { reposicaoId: pedido.dado.id } })).toBe(1);
      expect(await prisma.conclusaoReposicaoIndividual.count({ where: { reposicaoId: pedido.dado.id } })).toBe(0);
    }
    expect(await autorizarVideoAulaInstitucional(encontroId)).toMatchObject({ fileId: "video-oficial", driveId: "drive-escola", revisionId: "revisao-video-1" });
    entrar(professorId);
    expect(await autorizarVideoAulaInstitucional(encontroId)).toMatchObject({ fileId: "video-oficial", driveId: "drive-escola", revisionId: "revisao-video-1" });
    entrar(responsavelId);
    await expect(autorizarVideoAulaInstitucional(encontroId)).rejects.toThrow();
    entrar(secretariaId);
    await expect(autorizarVideoAulaInstitucional(encontroId)).rejects.toThrow();
    entrar(professorId);
    await prisma.usuario.update({ where: { id: professorId }, data: { ativo: false } });
    await expect(autorizarVideoAulaInstitucional(encontroId)).rejects.toThrow();
  }
});
