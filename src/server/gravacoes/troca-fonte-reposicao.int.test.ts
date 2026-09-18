import { beforeEach, expect, it, vi } from "vitest";
import { ModalidadeReposicaoIndividual, Papel, Prisma } from "@prisma/client";

const { authMock, consultarMock } = vi.hoisted(() => ({ authMock: vi.fn(), consultarMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("./credenciais", () => ({ obterTokenDrive: vi.fn(), obterDriveOrganizacaoId: () => "drive-escola" }));
vi.mock("./drive-revisao", () => ({ consultarRevisaoDriveFixada: consultarMock }));
vi.mock("@/server/_shared/sessao", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/_shared/sessao")>();
  const sessao = async () => {
    const usuarioId = (await authMock())?.user?.id;
    const usuario = usuarioId && await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { id: true, nome: true, ativo: true, papeis: true } });
    if (!usuario?.ativo) throw new original.ErroAutenticacao();
    return usuario;
  };
  return { ...original, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const usuario = await sessao(); original.exigirPapel(usuario, ...papeis); return usuario;
  } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { autorizarReproducaoGravacaoTx } from "./autorizacao";
import { consultarTrocaFonteReposicaoGravacao, decidirTrocaFonteReposicaoGravacao, proporTrocaFonteReposicaoGravacao } from "./troca-fonte-reposicao";

let catalogo: Awaited<ReturnType<typeof seedCatalogoMinimo>>;
let preparadorId: string;
let decisorId: string;
let administradorId: string;
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const md5A = "a".repeat(32), md5B = "b".repeat(32);

async function criarCenario(chave: string) {
  const professorId = (await criarUsuario([Papel.PROFESSOR], `Professor ${chave}`)).id;
  const aluno = await prisma.aluno.create({ data: { primeiroNome: `Aluno ${chave}`, paisId: catalogo.pais.id } });
  const matricula = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } });
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: `TROCA-${chave}`, ordem: Math.floor(Math.random() * 1_000_000) } });
  const turma = await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId, status: "EM_ANDAMENTO", dataInicio: new Date("2026-01-01T00:00:00Z") } });
  const inicio = new Date("2026-02-10T10:00:00Z");
  const encontro = await prisma.encontroAgenda.create({ data: {
    turmaId: turma.id, professorId, preparadorId, finalidade: "AULA", status: "PREVISTO", inicio, fim: new Date("2026-02-10T11:00:00Z"), fusoOrigem: "UTC",
    motivo: "Aula original da reposição gravada.", chaveIdempotencia: `encontro-${chave}`, entradaHash: "e".repeat(64),
    diario: { create: { turmaId: turma.id, professorId, ocorridaEm: inicio, conteudo: "Conteúdo original.", registros: { create: { alunoId: aluno.id, matriculaId: matricula.id, nomeAluno: aluno.primeiroNome, presente: false, participacao: "FALTA" } } } },
  } });
  const diario = await prisma.aulaDiario.findUniqueOrThrow({ where: { encontroId: encontro.id } });
  const publicacao = await prisma.publicacaoGravacaoAula.create({ data: {
    encontroId: encontro.id, publicadorId: professorId, arquivoOficialId: `arquivo-aula-${chave}`, driveOrganizacaoId: "drive-escola", driveRevisionId: `aula-r1-${chave}`,
    driveRevisionMd5: md5A, driveRevisionSize: 100n, mimeType: "video/mp4", chaveIdempotencia: `publicacao-${chave}`, entradaHash: "b".repeat(64), snapshot: { encontroId: encontro.id, diarioId: diario.id },
  } });
  await prisma.encontroAgenda.update({ where: { id: encontro.id }, data: { status: "MINISTRADO" } });
  const fontePublicacaoOriginal = await prisma.fonteRevisaoGravacao.create({ data: {
    alvo: "PUBLICACAO_AULA", publicacaoAulaId: publicacao.id, versao: 1, arquivoOficialId: publicacao.arquivoOficialId,
    driveOrganizacaoId: "drive-escola", driveRevisionId: `aula-r1-${chave}`, driveRevisionMd5: md5A, driveRevisionSize: 100n, mimeType: "video/mp4",
  } });
  const reposicao = await prisma.reposicaoIndividual.create({ data: {
    aulaOriginalId: encontro.id, matriculaId: matricula.id, modalidade: ModalidadeReposicaoIndividual.GRAVACAO, solicitanteId: preparadorId,
    motivo: "Reposição gravada aprovada para a matrícula.", evidencia: "Ocorrência pedagógica registrada.", chaveIdempotencia: `reposicao-${chave}`, entradaHash: "c".repeat(64),
  } });
  await prisma.decisaoReposicaoIndividual.create({ data: { reposicaoId: reposicao.id, decisorId, aprovada: true, motivo: "Gestão aprova a reposição gravada." } });
  const material = await prisma.materialReposicaoGravacao.create({ data: {
    reposicaoId: reposicao.id, publicacaoAulaId: publicacao.id, provedor: "GOOGLE_DRIVE", arquivoOficialId: publicacao.arquivoOficialId,
    driveOrganizacaoId: "drive-escola", driveRevisionId: `aula-r1-${chave}`, driveRevisionMd5: md5A, driveRevisionSize: 100n, mimeType: "video/mp4",
    disponivel: true, publicadoPorId: preparadorId, publicadoEm: new Date("2026-02-11T10:00:00Z"),
  } });
  const fonteMaterialOriginal = await prisma.fonteRevisaoGravacao.create({ data: {
    alvo: "MATERIAL_REPOSICAO", materialReposicaoId: material.id, versao: 1, arquivoOficialId: publicacao.arquivoOficialId,
    driveOrganizacaoId: "drive-escola", driveRevisionId: `aula-r1-${chave}`, driveRevisionMd5: md5A, driveRevisionSize: 100n, mimeType: "video/mp4",
  } });
  await prisma.disponibilizacaoEntregaReposicao.create({ data: { reposicaoId: reposicao.id, materialId: material.id, disponibilizadaEm: new Date("2026-02-11T10:00:00Z"), prazoBaseMinutos: 120, prazoInicialAte: new Date("2026-02-11T12:00:00Z"), publicadaPorId: preparadorId } });
  const conta = await prisma.contaPortalAluno.create({ data: { alunoId: aluno.id, ativa: true } });
  await prisma.designacaoAvaliadorReposicaoIndividual.create({ data: { reposicaoId: reposicao.id, professorId, designadorId: preparadorId, inicio: new Date("2026-02-11T10:00:00Z"), motivo: "Professor preservado para avaliar a entrega." } });
  const entrega = await prisma.entregaReposicaoGravacao.create({ data: { reposicaoId: reposicao.id, alunoId: aluno.id, contaPortalAlunoId: conta.id, versao: 1, resumo: "Resumo original da entrega.", atividade: "Atividade original entregue.", evidencia: "Evidência preservada.", entregueEm: new Date("2026-02-11T11:00:00Z") } });
  const conclusao = await prisma.conclusaoReposicaoIndividual.create({ data: { reposicaoId: reposicao.id, versao: 1, concluida: true, entregaId: entrega.id, validadaEm: new Date("2026-02-11T11:30:00Z"), validadaPorId: professorId, concluidaPorId: professorId, evidencia: "Avaliação docente preservada." } });
  return { alunoId: aluno.id, matriculaId: matricula.id, contaId: conta.id, reposicaoId: reposicao.id, materialId: material.id, publicacaoId: publicacao.id, entregaId: entrega.id, conclusaoId: conclusao.id, fontePublicacaoOriginal, fonteMaterialOriginal };
}

async function corrigirPublicacao(publicacaoId: string, chave: string) {
  const proposta = await prisma.propostaRegularizacaoFonteGravacao.create({ data: {
    alvo: "PUBLICACAO_AULA", publicacaoAulaId: publicacaoId, versaoEsperada: 1, arquivoOficialId: `arquivo-corrigido-${chave}`,
    driveOrganizacaoId: "drive-escola", driveRevisionId: `aula-r2-${chave}`, driveRevisionMd5: md5B, driveRevisionSize: 120n, mimeType: "video/mp4",
    motivo: "Publicação corrigida antes de adotar no material.", preparadorId, chaveIdempotencia: `correcao-publicacao-${chave}`,
  } });
  await prisma.decisaoRegularizacaoFonteGravacao.create({ data: { propostaId: proposta.id, decisorId, aprovada: true, motivo: "Outra gestão conferiu a revisão publicada." } });
  return prisma.fonteRevisaoGravacao.create({ data: {
    alvo: "PUBLICACAO_AULA", publicacaoAulaId: publicacaoId, versao: 2, propostaId: proposta.id, arquivoOficialId: `arquivo-corrigido-${chave}`,
    driveOrganizacaoId: "drive-escola", driveRevisionId: `aula-r2-${chave}`, driveRevisionMd5: md5B, driveRevisionSize: 120n, mimeType: "video/mp4",
  } });
}

const entrada = (reposicaoId: string, chave = "troca-fonte-260") => ({ reposicaoId, motivo: "Adotar no material a revisão publicada e corrigida da aula original.", chaveIdempotencia: chave });

beforeEach(async () => {
  await truncarBanco();
  catalogo = await seedCatalogoMinimo();
  preparadorId = (await criarUsuario([Papel.GERENTE_PEDAGOGICO], "Gestão preparadora")).id;
  decisorId = (await criarUsuario([Papel.GERENTE_PEDAGOGICO], "Gestão decisora")).id;
  administradorId = (await criarUsuario([Papel.ADMINISTRADOR], "Admin independente")).id;
  consultarMock.mockResolvedValue({ fileId: "arquivo", driveId: "drive-escola", revisionId: "r", md5Checksum: md5B, size: "120", mimeType: "video/mp4" });
  entrar(preparadorId);
});

it("Q23/Q57 aprova a nova fonte MATERIAL sem alterar material, disponibilização, entregas ou prazo e o portal resolve só depois", async () => {
  const cenario = await criarCenario("principal");
  const publicaCorrigida = await corrigirPublicacao(cenario.publicacaoId, "principal");
  const antes = await autorizarReproducaoGravacaoTx(prisma, { sessaoId: "s", contaId: cenario.contaId, alunoId: cenario.alunoId, email: "aluno@test" }, cenario.reposicaoId);
  expect(antes).toMatchObject({ revisionId: "aula-r1-principal", size: "100" });
  const proposta = await proporTrocaFonteReposicaoGravacao(entrada(cenario.reposicaoId));
  expect(proposta, proposta.ok ? undefined : proposta.erro).toMatchObject({ ok: true });
  if (!proposta.ok || !proposta.dado) throw new Error("proposta ausente");
  entrar(decisorId);
  const decisao = await decidirTrocaFonteReposicaoGravacao({ propostaId: proposta.dado.id, aprovar: true, motivo: "Revisão da publicação conferida antes de adotar no material." });
  expect(decisao, decisao.ok ? undefined : decisao.erro).toMatchObject({ ok: true, dado: { aprovada: true } });
  const fontes = await prisma.fonteRevisaoGravacao.findMany({ where: { materialReposicaoId: cenario.materialId }, orderBy: { versao: "asc" } });
  expect(fontes).toMatchObject([{ versao: 1, driveRevisionId: "aula-r1-principal" }, { versao: 2, origemPublicacaoId: publicaCorrigida.id, driveRevisionId: "aula-r2-principal" }]);
  expect(await prisma.materialReposicaoGravacao.findUniqueOrThrow({ where: { id: cenario.materialId } })).toMatchObject({ disponivel: true, arquivoOficialId: `arquivo-aula-principal` });
  expect(await prisma.disponibilizacaoEntregaReposicao.count({ where: { materialId: cenario.materialId } })).toBe(1);
  expect(await prisma.entregaReposicaoGravacao.findUniqueOrThrow({ where: { id: cenario.entregaId } })).toMatchObject({ versao: 1, resumo: "Resumo original da entrega.", atividade: "Atividade original entregue." });
  expect(await prisma.conclusaoReposicaoIndividual.findUniqueOrThrow({ where: { id: cenario.conclusaoId } })).toMatchObject({ versao: 1, concluida: true, evidencia: "Avaliação docente preservada." });
  await expect(autorizarReproducaoGravacaoTx(prisma, { sessaoId: "s", contaId: cenario.contaId, alunoId: cenario.alunoId, email: "aluno@test" }, cenario.reposicaoId)).resolves.toMatchObject({ revisionId: "aula-r2-principal", size: "120" });
  entrar(decisorId);
  await expect(consultarTrocaFonteReposicaoGravacao({ reposicaoId: cenario.reposicaoId })).resolves.toMatchObject({
    contexto: { jaAdotaPublicacaoAtual: true, fonteMaterialAtual: { versao: 2 }, fontePublicacaoAtual: { versao: 2 } },
    propostas: [expect.objectContaining({ decisao: expect.objectContaining({ aprovada: true }), fonteMaterial: expect.objectContaining({ versao: 2 }) })],
  });
  entrar(preparadorId);
  expect(await proporTrocaFonteReposicaoGravacao(entrada(cenario.reposicaoId))).toMatchObject({ ok: true, dado: { id: proposta.dado.id } });
});

it("recusa autoaprovação, indisponibilidade inicial ou posterior e retirada de papel durante o preflight", async () => {
  const cenario = await criarCenario("negativos");
  await corrigirPublicacao(cenario.publicacaoId, "negativos");
  const propria = await proporTrocaFonteReposicaoGravacao(entrada(cenario.reposicaoId, "troca-propria"));
  expect(propria.ok).toBe(true);
  if (!propria.ok || !propria.dado) throw new Error("proposta ausente");
  await expect(decidirTrocaFonteReposicaoGravacao({ propostaId: propria.dado.id, aprovar: true, motivo: "O preparador não pode decidir a própria adoção." })).resolves.toMatchObject({ ok: false });
  await prisma.materialReposicaoGravacao.update({ where: { id: cenario.materialId }, data: { disponivel: false } });
  expect(await proporTrocaFonteReposicaoGravacao(entrada(cenario.reposicaoId, "troca-indisponivel"))).toMatchObject({ ok: false });
  await prisma.materialReposicaoGravacao.update({ where: { id: cenario.materialId }, data: { disponivel: true } });
  const propostaIndisponivelDepois = await proporTrocaFonteReposicaoGravacao(entrada(cenario.reposicaoId, "troca-indisponivel-depois"));
  expect(propostaIndisponivelDepois.ok).toBe(true);
  if (!propostaIndisponivelDepois.ok || !propostaIndisponivelDepois.dado) throw new Error("proposta ausente");
  await prisma.materialReposicaoGravacao.update({ where: { id: cenario.materialId }, data: { disponivel: false } });
  entrar(decisorId);
  await expect(decidirTrocaFonteReposicaoGravacao({ propostaId: propostaIndisponivelDepois.dado.id, aprovar: true, motivo: "Material indisponível não pode receber nova fonte." })).resolves.toMatchObject({ ok: false });
  await prisma.materialReposicaoGravacao.update({ where: { id: cenario.materialId }, data: { disponivel: true } });
  entrar(preparadorId);
  const propostaPreparadorRevogado = await proporTrocaFonteReposicaoGravacao(entrada(cenario.reposicaoId, "troca-preparador-revogado"));
  expect(propostaPreparadorRevogado.ok).toBe(true);
  if (!propostaPreparadorRevogado.ok || !propostaPreparadorRevogado.dado) throw new Error("proposta ausente");
  await prisma.usuario.update({ where: { id: preparadorId }, data: { ativo: false } });
  entrar(decisorId);
  await expect(decidirTrocaFonteReposicaoGravacao({ propostaId: propostaPreparadorRevogado.dado.id, aprovar: false, motivo: "Preparador revogado não deixa decisão institucional válida." })).resolves.toMatchObject({ ok: false });
  await prisma.usuario.update({ where: { id: preparadorId }, data: { ativo: true } });
  entrar(preparadorId);
  const proposta = await proporTrocaFonteReposicaoGravacao(entrada(cenario.reposicaoId, "troca-revogada"));
  expect(proposta.ok).toBe(true);
  if (!proposta.ok || !proposta.dado) throw new Error("proposta ausente");
  entrar(decisorId);
  consultarMock.mockImplementationOnce(async () => { await prisma.usuario.update({ where: { id: decisorId }, data: { ativo: false } }); return { fileId: "arquivo", driveId: "drive-escola", revisionId: "r", md5Checksum: md5B, size: "120", mimeType: "video/mp4" }; });
  await expect(decidirTrocaFonteReposicaoGravacao({ propostaId: proposta.dado.id, aprovar: true, motivo: "A retirada de papel durante a consulta invalida a decisão." })).resolves.toMatchObject({ ok: false });
  expect(await prisma.decisaoTrocaFonteReposicaoGravacao.count({ where: { propostaId: proposta.dado.id } })).toBe(0);
});

it("a foto obsoleta por nova publicação e as chamadas concorrentes não criam duas fontes", async () => {
  const cenario = await criarCenario("concorrencia");
  await corrigirPublicacao(cenario.publicacaoId, "concorrencia");
  const propostaAntiga = await proporTrocaFonteReposicaoGravacao(entrada(cenario.reposicaoId, "troca-antiga"));
  expect(propostaAntiga.ok).toBe(true);
  if (!propostaAntiga.ok || !propostaAntiga.dado) throw new Error("proposta ausente");
  await prisma.propostaRegularizacaoFonteGravacao.create({ data: {
    alvo: "PUBLICACAO_AULA", publicacaoAulaId: cenario.publicacaoId, versaoEsperada: 2, arquivoOficialId: "arquivo-r3-concorrencia", driveOrganizacaoId: "drive-escola", driveRevisionId: "aula-r3-concorrencia", driveRevisionMd5: "c".repeat(32), driveRevisionSize: 130n, mimeType: "video/mp4", motivo: "Outra correção torna a foto anterior obsoleta.", preparadorId, chaveIdempotencia: "correcao-r3-concorrencia",
  } }).then(async (p) => {
    await prisma.decisaoRegularizacaoFonteGravacao.create({ data: { propostaId: p.id, decisorId, aprovada: true, motivo: "Decisão independente da correção posterior." } });
    await prisma.fonteRevisaoGravacao.create({ data: { alvo: "PUBLICACAO_AULA", publicacaoAulaId: cenario.publicacaoId, versao: 3, propostaId: p.id, arquivoOficialId: "arquivo-r3-concorrencia", driveOrganizacaoId: "drive-escola", driveRevisionId: "aula-r3-concorrencia", driveRevisionMd5: "c".repeat(32), driveRevisionSize: 130n, mimeType: "video/mp4" } });
  });
  entrar(decisorId);
  await expect(decidirTrocaFonteReposicaoGravacao({ propostaId: propostaAntiga.dado.id, aprovar: true, motivo: "A foto antiga não pode ser aplicada." })).resolves.toMatchObject({ ok: false });
  entrar(preparadorId);
  const propostaNova = await proporTrocaFonteReposicaoGravacao(entrada(cenario.reposicaoId, "troca-nova"));
  expect(propostaNova.ok).toBe(true);
  if (!propostaNova.ok || !propostaNova.dado) throw new Error("proposta ausente");
  entrar(administradorId);
  const resultados = await Promise.all(["um", "dois"].map((sufixo) => decidirTrocaFonteReposicaoGravacao({ propostaId: propostaNova.dado!.id, aprovar: true, motivo: `Decisão concorrente ${sufixo} da nova fonte.` })));
  expect(resultados.filter((resultado) => resultado.ok).length).toBe(1);
  expect(await prisma.fonteRevisaoGravacao.count({ where: { materialReposicaoId: cenario.materialId } })).toBe(2);
});

it("serializa a nova publicação concorrente contra a adoção MATERIAL pela âncora e não aplica fotografia vencida", async () => {
  const cenario = await criarCenario("barreira");
  await corrigirPublicacao(cenario.publicacaoId, "barreira");
  const propostaTroca = await proporTrocaFonteReposicaoGravacao(entrada(cenario.reposicaoId, "troca-barreira"));
  expect(propostaTroca.ok).toBe(true);
  if (!propostaTroca.ok || !propostaTroca.dado) throw new Error("proposta ausente");
  const propostaR3 = await prisma.propostaRegularizacaoFonteGravacao.create({ data: {
    alvo: "PUBLICACAO_AULA", publicacaoAulaId: cenario.publicacaoId, versaoEsperada: 2, arquivoOficialId: "arquivo-r3-barreira",
    driveOrganizacaoId: "drive-escola", driveRevisionId: "aula-r3-barreira", driveRevisionMd5: "c".repeat(32), driveRevisionSize: 130n, mimeType: "video/mp4",
    motivo: "A publicação concorrente mantém a âncora bloqueada até concluir.", preparadorId, chaveIdempotencia: "correcao-r3-barreira",
  } });
  await prisma.decisaoRegularizacaoFonteGravacao.create({ data: { propostaId: propostaR3.id, decisorId, aprovada: true, motivo: "Outra gestão aprova a revisão concorrente." } });
  let liberarInsercao!: () => void;
  const inserida = new Promise<void>((resolve) => { liberarInsercao = resolve; });
  const origemConcorrente = prisma.$transaction(async (tx) => {
    await tx.fonteRevisaoGravacao.create({ data: {
      alvo: "PUBLICACAO_AULA", publicacaoAulaId: cenario.publicacaoId, versao: 3, propostaId: propostaR3.id, arquivoOficialId: "arquivo-r3-barreira",
      driveOrganizacaoId: "drive-escola", driveRevisionId: "aula-r3-barreira", driveRevisionMd5: "c".repeat(32), driveRevisionSize: 130n, mimeType: "video/mp4",
    } });
    liberarInsercao();
    await tx.$executeRaw`SELECT pg_sleep(1.2)`;
  });
  await inserida;
  entrar(administradorId);
  const adocao = decidirTrocaFonteReposicaoGravacao({ propostaId: propostaTroca.dado.id, aprovar: true, motivo: "Adoção disputa a âncora da publicação corrigida." });
  let bloqueada = false;
  for (let tentativa = 0; tentativa < 20 && !bloqueada; tentativa += 1) {
    const [estado] = await prisma.$queryRaw<Array<{ bloqueada: boolean }>>`SELECT EXISTS (SELECT 1 FROM pg_stat_activity atividade WHERE atividade.query LIKE '%FonteRevisaoGravacao%' AND cardinality(pg_blocking_pids(atividade.pid)) > 0) AS bloqueada`;
    bloqueada = !!estado?.bloqueada;
    if (!bloqueada) await new Promise((resolve) => setTimeout(resolve, 25));
  }
  expect(bloqueada).toBe(true);
  await origemConcorrente;
  await expect(adocao).resolves.toMatchObject({ ok: false });
  expect(await prisma.fonteRevisaoGravacao.count({ where: { materialReposicaoId: cenario.materialId } })).toBe(1);
  expect(await prisma.fonteRevisaoGravacao.findFirstOrThrow({ where: { publicacaoAulaId: cenario.publicacaoId }, orderBy: { versao: "desc" } })).toMatchObject({ versao: 3 });
});

it("SQL recusa origem cruzada, duas fontes de proposta e aplicação com aprovador revogado", async () => {
  const primeira = await criarCenario("sql-a");
  const segunda = await criarCenario("sql-b");
  const publicaA = await corrigirPublicacao(primeira.publicacaoId, "sql-a");
  const publicaB = await corrigirPublicacao(segunda.publicacaoId, "sql-b");
  await expect(prisma.propostaTrocaFonteReposicaoGravacao.create({ data: {
    materialReposicaoId: primeira.materialId, fontePublicacaoId: publicaB.id, fonteMaterialAnteriorId: primeira.fonteMaterialOriginal.id,
    versaoMaterialEsperada: 1, fotografia: {}, fotografiaHash: "d".repeat(64), motivo: "A origem de outra aula não pode ser adotada neste material.", preparadorId, chaveIdempotencia: "troca-origem-cruzada",
  } })).rejects.toThrow(/mesma aula|fotografia/i);
  await expect(prisma.propostaTrocaFonteReposicaoGravacao.create({ data: {
    materialReposicaoId: primeira.materialId, fontePublicacaoId: publicaA.id, fonteMaterialAnteriorId: primeira.fonteMaterialOriginal.id,
    versaoMaterialEsperada: 1,
    fotografia: {
      materialId: primeira.materialId, reposicaoId: primeira.reposicaoId, matriculaId: primeira.matriculaId, aulaOriginalId: (await prisma.reposicaoIndividual.findUniqueOrThrow({ where: { id: primeira.reposicaoId } })).aulaOriginalId,
      publicacaoAulaId: primeira.publicacaoId, materialDisponivel: true, disponibilizacaoId: (await prisma.disponibilizacaoEntregaReposicao.findUniqueOrThrow({ where: { materialId: primeira.materialId } })).id,
      fonteMaterialAnterior: { id: primeira.fonteMaterialOriginal.id, versao: 1 }, fontePublicacao: { id: publicaA.id, versao: 2, arquivoOficialId: "arquivo-corrigido-sql-a", driveOrganizacaoId: "drive-escola", driveRevisionId: "aula-r2-sql-a", driveRevisionMd5: md5B, driveRevisionSize: "120", mimeType: "video/mp4" },
    }, fotografiaHash: "0".repeat(64), motivo: "Hash arbitrário não pode criar proposta aplicável.", preparadorId, chaveIdempotencia: "troca-hash-arbitrario",
  } })).rejects.toThrow(/Fotografia/i);

  entrar(preparadorId);
  const propostaValida = await proporTrocaFonteReposicaoGravacao(entrada(primeira.reposicaoId, "troca-sql-valida"));
  expect(propostaValida.ok).toBe(true);
  if (!propostaValida.ok || !propostaValida.dado) throw new Error("proposta ausente");
  const generica = await prisma.propostaRegularizacaoFonteGravacao.create({ data: {
    alvo: "MATERIAL_REPOSICAO", materialReposicaoId: primeira.materialId, versaoEsperada: 1,
    arquivoOficialId: "arquivo-corrigido-sql-a", driveOrganizacaoId: "drive-escola", driveRevisionId: "aula-r2-sql-a", driveRevisionMd5: md5B, driveRevisionSize: 120n, mimeType: "video/mp4",
    motivo: "A segunda origem não pode ocupar a mesma fonte material.", preparadorId, chaveIdempotencia: "regularizacao-duplicada-troca",
  } });
  await expect(prisma.fonteRevisaoGravacao.create({ data: {
    alvo: "MATERIAL_REPOSICAO", materialReposicaoId: primeira.materialId, versao: 2, propostaId: generica.id,
    propostaTrocaReposicaoId: propostaValida.dado.id, origemPublicacaoId: publicaA.id, arquivoOficialId: "arquivo-corrigido-sql-a",
    driveOrganizacaoId: "drive-escola", driveRevisionId: "aula-r2-sql-a", driveRevisionMd5: md5B, driveRevisionSize: 120n, mimeType: "video/mp4",
  } })).rejects.toThrow(/propostas exclusivas|troca contextual|check/i);
  await prisma.decisaoTrocaFonteReposicaoGravacao.create({ data: { propostaId: propostaValida.dado.id, decisorId, aprovada: true, motivo: "Decisão direta que será revogada antes de aplicar." } });
  await prisma.usuario.update({ where: { id: decisorId }, data: { ativo: false } });
  await expect(prisma.fonteRevisaoGravacao.create({ data: {
    alvo: "MATERIAL_REPOSICAO", materialReposicaoId: primeira.materialId, versao: 2, propostaTrocaReposicaoId: propostaValida.dado.id,
    origemPublicacaoId: publicaA.id, arquivoOficialId: "arquivo-corrigido-sql-a", driveOrganizacaoId: "drive-escola", driveRevisionId: "aula-r2-sql-a", driveRevisionMd5: md5B, driveRevisionSize: 120n, mimeType: "video/mp4",
  } })).rejects.toThrow(/papéis vigentes|decisor vigente/i);
});
