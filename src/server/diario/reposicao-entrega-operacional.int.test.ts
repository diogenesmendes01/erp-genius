import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const { authMock, preflightMock } = vi.hoisted(() => ({ authMock: vi.fn(), preflightMock: vi.fn() }));
const driveConfigurado = vi.hoisted(() => ({ id: "drive-escola" }));
vi.mock("@/server/gravacoes/credenciais", () => ({ obterDriveOrganizacaoId: () => driveConfigurado.id }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/server/gravacoes/disponibilidade", () => ({ verificarDisponibilidadeGravacaoDrive: preflightMock }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import {
  confirmarIndisponibilidadeOperacional,
  consultarOperacaoEntregaReposicao,
  liberarEntregaOperacional,
  publicarMaterialOperacional,
  prorrogarEtapaOperacional,
  retomarIndisponibilidadeOperacional,
} from "./reposicao-entrega-operacional";
import { descartarRelatoIndisponibilidadeEquipe, registrarRelatoIndisponibilidadeEquipe } from "./reposicao-operacoes-relatos";

const utc = (valor: Date) => Prisma.sql`${valor}::timestamptz AT TIME ZONE 'UTC'`;
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

let secretariaId: string, gestorId: string, adminId: string, professorId: string, comercialId: string, gestorInativoId: string;
let alunoId: string, outroAlunoId: string, matriculaId: string, outraMatriculaId: string, contaId: string, outraContaId: string;
let catalogo: Awaited<ReturnType<typeof seedCatalogoMinimo>>;
let ordemNivel = 0;

async function prepararReposicao(id: string, donoMatriculaId: string, donoAlunoId: string, publicarMaterial = true) {
  ordemNivel += 1;
  const professorDaReposicao = (await criarUsuario(["PROFESSOR"])).id;
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: `OP-${id}`, ordem: ordemNivel } });
  const turma = await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: professorDaReposicao } });
  await prisma.alocacaoTurma.create({ data: { alunoId: donoAlunoId, matriculaId: donoMatriculaId, turmaId: turma.id, criadoEm: new Date("2026-01-01T00:00:00.000Z") } });
  const aula = await prisma.encontroAgenda.create({ data: {
    turmaId: turma.id, professorId: professorDaReposicao, preparadorId: secretariaId, inicio: new Date("2026-01-02T10:00:00.000Z"), fim: new Date("2026-01-02T11:00:00.000Z"), fusoOrigem: "UTC", status: "PREVISTO",
    motivo: "Aula que originou a reposição gravada", chaveIdempotencia: `aula-op-${id}`, entradaHash: "fixture",
    diario: { create: { turmaId: turma.id, professorId: professorDaReposicao, ocorridaEm: new Date("2026-01-02T10:00:00.000Z"), conteudo: "Aula com ausência", registros: { create: { alunoId: donoAlunoId, matriculaId: donoMatriculaId, nomeAluno: "Aluno", presente: false, participacao: "FALTA" } } } },
  } });
  await prisma.encontroAgenda.update({ where: { id: aula.id }, data: { status: "MINISTRADO" } });
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "ReposicaoIndividual" (id,"aulaOriginalId","matriculaId",modalidade,"solicitanteId",motivo,evidencia,"chaveIdempotencia","entradaHash")
    VALUES (${id},${aula.id},${donoMatriculaId},'GRAVACAO'::"ModalidadeReposicaoIndividual",${secretariaId},'Reposição gravada autorizada','Ausência de origem conferida',${`pedido-op-${id}`},'fixture')
  `);
  await prisma.$executeRaw(Prisma.sql`INSERT INTO "DecisaoReposicaoIndividual" (id,"reposicaoId","decisorId",aprovada,motivo) VALUES (${`decisao-op-${id}`},${id},${gestorId},true,'Gestão autorizou a reposição gravada')`);
  const materialId = `material-op-${id}`, arquivoOficialId = `drive-op-${id}`;
  if (!publicarMaterial) return { materialId, arquivoOficialId };
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "MaterialReposicaoGravacao" (id,"reposicaoId",provedor,"arquivoOficialId",disponivel,"publicadoPorId","publicadoEm")
    VALUES (${materialId},${id},'GOOGLE_DRIVE',${arquivoOficialId},true,${secretariaId},${utc(new Date("2026-09-01T10:00:00.000Z"))})
  `);
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "DisponibilizacaoEntregaReposicao" (id,"reposicaoId","materialId","disponibilizadaEm","prazoBaseMinutos","prazoInicialAte","publicadaPorId")
    VALUES (${`disp-op-${id}`},${id},${materialId},${utc(new Date("2026-09-01T10:00:00.000Z"))},120,${utc(new Date(Date.now()+3_600_000))},${secretariaId})
  `);
  return { materialId, arquivoOficialId };
}

beforeEach(async () => {
  driveConfigurado.id = "drive-escola";
  preflightMock.mockReset();
  preflightMock.mockResolvedValue(undefined);
  await truncarBanco();
  catalogo = await seedCatalogoMinimo();
  secretariaId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  gestorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  adminId = (await criarUsuario(["ADMINISTRADOR"])).id;
  professorId = (await criarUsuario(["PROFESSOR"])).id;
  comercialId = (await criarUsuario(["GERENTE_COMERCIAL"])).id;
  gestorInativoId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  await prisma.usuario.update({ where: { id: gestorInativoId }, data: { ativo: false } });
  alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Aluno operacional", paisId: catalogo.pais.id } })).id;
  outroAlunoId = (await prisma.aluno.create({ data: { primeiroNome: "Outro aluno operacional", paisId: catalogo.pais.id } })).id;
  matriculaId = (await prisma.matricula.create({ data: { alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } })).id;
  outraMatriculaId = (await prisma.matricula.create({ data: { alunoId: outroAlunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } })).id;
  contaId = (await prisma.contaPortalAluno.create({ data: { alunoId, ativa: true } })).id;
  outraContaId = (await prisma.contaPortalAluno.create({ data: { alunoId: outroAlunoId, ativa: true } })).id;
  ordemNivel = 0;
  await prisma.configuracaoOperacional.upsert({ where: { id: "escola" }, create: { id: "escola", fusoInstitucional: "UTC" }, update: { fusoInstitucional: "UTC" } });
});

it("publicação pelo painel exige prazo configurado e preserva o início da primeira entrega ao repetir", async () => {
  await prepararReposicao("repo-op-publicacao", matriculaId, alunoId, false);
  entrar(gestorId);
  const entrada = { reposicaoId: "repo-op-publicacao", arquivoOficialId: "drive-material-oficial" };
  expect(await publicarMaterialOperacional(entrada)).toMatchObject({ ok: false });
  expect(await prisma.materialReposicaoGravacao.count()).toBe(0);
  expect(await prisma.disponibilizacaoEntregaReposicao.count()).toBe(0);
  await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { prazoPrimeiraEntregaReposicaoMinutos: 120 } });
  const publicado = await publicarMaterialOperacional(entrada);
  expect(publicado, JSON.stringify(publicado)).toMatchObject({ ok: true });
  const original = await prisma.disponibilizacaoEntregaReposicao.findFirst({ where: { reposicaoId: entrada.reposicaoId } });
  expect(original).not.toBeNull();
  expect(original!.prazoInicialAte.getTime() - original!.disponibilizadaEm.getTime()).toBe(120 * 60_000);
  expect(await publicarMaterialOperacional(entrada)).toMatchObject({ ok: false, erro: expect.stringContaining("já possui material publicado") });
  expect(await prisma.materialReposicaoGravacao.count()).toBe(1);
  expect(await prisma.disponibilizacaoEntregaReposicao.findFirst({ where: { reposicaoId: entrada.reposicaoId } })).toEqual(original);
});

it("falha de preflight do Drive não publica material nem inicia a janela", async () => {
  await prepararReposicao("repo-op-preflight-falha", matriculaId, alunoId, false);
  await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { prazoPrimeiraEntregaReposicaoMinutos: 120 } });
  preflightMock.mockRejectedValueOnce(new Error("falha remota não deve vazar"));
  entrar(gestorId);

  const resultado = await publicarMaterialOperacional({ reposicaoId: "repo-op-preflight-falha", arquivoOficialId: "drive-preflight-falha" });

  expect(resultado).toMatchObject({ ok: false });
  expect(preflightMock).toHaveBeenCalledWith("drive-preflight-falha");
  expect(await prisma.materialReposicaoGravacao.count({ where: { reposicaoId: "repo-op-preflight-falha" } })).toBe(0);
  expect(await prisma.disponibilizacaoEntregaReposicao.count({ where: { reposicaoId: "repo-op-preflight-falha" } })).toBe(0);
  expect(await prisma.evento.count({ where: { tipo: "MaterialReposicaoGravacaoDisponibilizado" } })).toBe(0);
});

it.each(["permissao", "configuracao"] as const)("revalida %s alterada enquanto o Drive responde, sem iniciar o prazo", async (alteracao) => {
  const reposicaoId = `repo-op-corrida-${alteracao}`;
  await prepararReposicao(reposicaoId, matriculaId, alunoId, false);
  await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { prazoPrimeiraEntregaReposicaoMinutos: 120 } });
  entrar(gestorId);
  preflightMock.mockImplementationOnce(async () => {
    if (alteracao === "permissao") {
      await prisma.usuario.update({ where: { id: gestorId }, data: { ativo: false } });
    } else {
      await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { prazoPrimeiraEntregaReposicaoMinutos: null } });
    }
  });
  expect(await publicarMaterialOperacional({ reposicaoId, arquivoOficialId: "drive-corrida" })).toMatchObject({ ok: false });
  expect(preflightMock).toHaveBeenCalledTimes(1);
  expect(await prisma.materialReposicaoGravacao.count()).toBe(0);
  expect(await prisma.disponibilizacaoEntregaReposicao.count()).toBe(0);
  expect(await prisma.evento.count({ where: { tipo: "MaterialReposicaoGravacaoDisponibilizado" } })).toBe(0);
});

it("gestão consulta somente a reposição da matrícula conferida e o DTO não expõe conta nem arquivo", async () => {
  const propria = await prepararReposicao("repo-op-consulta", matriculaId, alunoId);
  for (const ator of [gestorId, adminId]) {
    entrar(ator);
    const resultado = await consultarOperacaoEntregaReposicao({ reposicaoId: "repo-op-consulta", matriculaId });
    expect(resultado, JSON.stringify(resultado)).toMatchObject({ ok: true, dado: { reposicaoId: "repo-op-consulta", matriculaStatus: "ATIVA", material: { disponivel: true } } });
    if (!resultado.ok || !resultado.dado) throw new Error(JSON.stringify(resultado));
    const dto = JSON.stringify(resultado.dado);
    expect(dto).not.toContain(contaId);
    expect(dto).not.toContain(propria.arquivoOficialId);
    expect(dto).not.toMatch(/contaId|arquivoOficialId/i);
  }
  entrar(gestorId);
  expect(await consultarOperacaoEntregaReposicao({ reposicaoId: "repo-op-consulta", matriculaId: outraMatriculaId })).toMatchObject({ ok: false });
});

it("painel operacional recusa professor, comercial e gestão inativa", async () => {
  await prepararReposicao("repo-op-papeis", matriculaId, alunoId);
  for (const ator of [professorId, comercialId, gestorInativoId]) {
    entrar(ator);
    expect(await consultarOperacaoEntregaReposicao({ reposicaoId: "repo-op-papeis", matriculaId })).toMatchObject({ ok: false });
  }
});

it("confirmação operacional não aceita relato de material de outra reposição", async () => {
  await prepararReposicao("repo-op-alvo", matriculaId, alunoId);
  const outra = await prepararReposicao("repo-op-outro-material", outraMatriculaId, outroAlunoId);
  await prisma.relatoIndisponibilidadeMaterialReposicao.create({ data: { id: "relato-op-outro", materialId: outra.materialId, relatadoPorId: secretariaId, descricao: "Equipe relata falha no material de outra matrícula" } });
  entrar(gestorId);
  expect(await confirmarIndisponibilidadeOperacional({ reposicaoId: "repo-op-alvo", relatoId: "relato-op-outro", motivo: "Tentativa de confirmar relato de outra reposição" })).toMatchObject({ ok: false });
  expect(await prisma.indisponibilidadeMaterialReposicao.count()).toBe(0);
});

it("wrapper libera matrícula pausada com a conta derivada no servidor, sem contaId no cliente", async () => {
  await prepararReposicao("repo-op-liberacao", matriculaId, alunoId);
  await prisma.matricula.update({ where: { id: matriculaId }, data: { status: "PAUSADA" } });
  entrar(gestorId);
  const expiraEm = new Date(Date.now() + 3_600_000).toISOString();
  const entrada = { reposicaoId: "repo-op-liberacao", expiraEm, motivo: "Permitir conclusão pontual durante a pausa" };
  expect(Object.hasOwn(entrada, "contaId")).toBe(false);
  const resultado = await liberarEntregaOperacional(entrada);
  expect(resultado).toMatchObject({ ok: true, dado: { expiraEm } });
  const liberacao = await prisma.liberacaoEntregaReposicao.findFirst({ where: { reposicaoId: "repo-op-liberacao" } });
  expect(liberacao).toMatchObject({ contaId, reposicaoId: "repo-op-liberacao" });
  expect(liberacao?.contaId).not.toBe(outraContaId);
});

it("confirma e retoma relato existente pelo wrapper, refletindo pausa, fim e eventos da matrícula", async () => {
  const propria = await prepararReposicao("repo-op-pausa", matriculaId, alunoId);
  await prisma.relatoIndisponibilidadeMaterialReposicao.create({ data: {
    id: "relato-op-pausa", materialId: propria.materialId, contaPortalAlunoId: contaId,
    descricao: "Aluno relatou falha persistente ao abrir o material gravado",
  } });
  entrar(gestorId);
  const confirmacao = await confirmarIndisponibilidadeOperacional({ reposicaoId: "repo-op-pausa", relatoId: "relato-op-pausa", motivo: "Gestão reproduziu a falha relatada pelo aluno" });
  expect(confirmacao).toMatchObject({ ok: true });
  if (!confirmacao.ok || !confirmacao.dado) throw new Error(JSON.stringify(confirmacao));
  expect(await prisma.relatoIndisponibilidadeMaterialReposicao.findUnique({ where: { id: "relato-op-pausa" } })).toMatchObject({ situacao: "CONFIRMADO", confirmadoEm: expect.any(Date) });
  const durante = await consultarOperacaoEntregaReposicao({ reposicaoId: "repo-op-pausa", matriculaId });
  expect(durante).toMatchObject({ ok: true, dado: { indisponibilidade: { id: confirmacao.dado.id } } });
  expect(await prisma.evento.findFirst({ where: { tipo: "IndisponibilidadeMaterialReposicaoConfirmada", agregadoTipo: "Matricula", agregadoId: matriculaId, autorId: gestorId } })).toBeTruthy();
  const retomada = await retomarIndisponibilidadeOperacional({ reposicaoId: "repo-op-pausa", indisponibilidadeId: confirmacao.dado.id, motivo: "Material restabelecido após confirmação técnica" });
  expect(retomada).toMatchObject({ ok: true });
  expect(await prisma.indisponibilidadeMaterialReposicao.findUnique({ where: { id: confirmacao.dado.id } })).toMatchObject({ fim: expect.any(Date) });
  const depois = await consultarOperacaoEntregaReposicao({ reposicaoId: "repo-op-pausa", matriculaId });
  expect(depois).toMatchObject({ ok: true, dado: { indisponibilidade: null } });
  expect(await prisma.evento.findFirst({ where: { tipo: "MaterialReposicaoGravacaoRetomado", agregadoTipo: "Matricula", agregadoId: matriculaId, autorId: gestorId } })).toBeTruthy();
});

it.each(["FALHA_DRIVE", "GESTOR_REVOGADO", "MATERIAL_RETIRADO", "DRIVE_ALTERADO", "RETOMADA_CONCORRENTE"])(
  "preserva a pausa ou decisão concorrente quando a conferência perde validade: %s", async (caso) => {
    const propria = await prepararReposicao("repo-retomada", matriculaId, alunoId);
    await prisma.relatoIndisponibilidadeMaterialReposicao.create({ data: {
      id: "relato-retomada", materialId: propria.materialId, contaPortalAlunoId: contaId,
      descricao: "Gravação indisponível para o aluno autorizado",
    } });
    entrar(gestorId);
    const confirmacao = await confirmarIndisponibilidadeOperacional({ reposicaoId: "repo-retomada", relatoId: "relato-retomada", motivo: "Falha confirmada pela gestão pedagógica" });
    if (!confirmacao.ok || !confirmacao.dado) throw new Error(JSON.stringify(confirmacao));
    const entrada = { reposicaoId: "repo-retomada", indisponibilidadeId: confirmacao.dado.id, motivo: "Fonte novamente acessível após conferência" };
    preflightMock.mockImplementationOnce(async (_arquivo: string, deps: { obterDriveId: () => string }) => {
      expect(deps.obterDriveId()).toBe("drive-escola");
      if (caso === "FALHA_DRIVE") throw new Error("Gravação inacessível");
      if (caso === "GESTOR_REVOGADO") await prisma.usuario.update({ where: { id: gestorId }, data: { ativo: false } });
      if (caso === "MATERIAL_RETIRADO") await prisma.materialReposicaoGravacao.update({ where: { id: propria.materialId }, data: { disponivel: false } });
      if (caso === "DRIVE_ALTERADO") driveConfigurado.id = "novo-drive";
      if (caso === "RETOMADA_CONCORRENTE") expect(await retomarIndisponibilidadeOperacional(entrada)).toMatchObject({ ok: true });
    });
    expect(await retomarIndisponibilidadeOperacional(entrada)).toMatchObject({ ok: false });
    const pausa = await prisma.indisponibilidadeMaterialReposicao.findUniqueOrThrow({ where: { id: entrada.indisponibilidadeId } });
    expect(pausa.fim).toEqual(caso === "RETOMADA_CONCORRENTE" ? expect.any(Date) : null);
    expect(await prisma.evento.count({ where: { tipo: "MaterialReposicaoGravacaoRetomado", agregadoId: matriculaId } })).toBe(caso === "RETOMADA_CONCORRENTE" ? 1 : 0);
  },
);

it("equipe e professor designado vigente registram relato sem confirmar nem pausar o material", async () => {
  const propria = await prepararReposicao("repo-op-relato-autores", matriculaId, alunoId);
  await prisma.designacaoAvaliadorReposicaoIndividual.create({ data: {
    reposicaoId: "repo-op-relato-autores", professorId, designadorId: gestorId,
    inicio: new Date(Date.now() - 60_000), motivo: "Professor designado para avaliar a gravação",
  } });
  entrar(secretariaId);
  const relatoEquipe = await registrarRelatoIndisponibilidadeEquipe({ reposicaoId: "repo-op-relato-autores", descricao: "Equipe não conseguiu abrir o arquivo institucional de gravação" });
  expect(relatoEquipe).toMatchObject({ ok: true });
  entrar(professorId);
  const relatoProfessor = await registrarRelatoIndisponibilidadeEquipe({ reposicaoId: "repo-op-relato-autores", descricao: "Professor designado também encontrou falha ao conferir o material" });
  expect(relatoProfessor).toMatchObject({ ok: true });
  expect(await prisma.indisponibilidadeMaterialReposicao.count({ where: { materialId: propria.materialId } })).toBe(0);
  expect(await prisma.relatoIndisponibilidadeMaterialReposicao.count({ where: { materialId: propria.materialId, situacao: "ABERTO" } })).toBe(2);
  expect(await prisma.evento.findFirst({ where: { tipo: "RelatoIndisponibilidadeMaterialReposicaoRegistradoPelaEquipe", agregadoTipo: "Matricula", agregadoId: matriculaId, autorId: professorId } })).toMatchObject({ payload: expect.objectContaining({ reposicaoId: "repo-op-relato-autores", origem: "PROFESSOR" }) });
});

it("relato docente recusa professor de outra reposição e designação encerrada", async () => {
  await prepararReposicao("repo-op-relato-professor", matriculaId, alunoId);
  const outroProfessor = (await criarUsuario(["PROFESSOR"])).id;
  entrar(outroProfessor);
  expect(await registrarRelatoIndisponibilidadeEquipe({ reposicaoId: "repo-op-relato-professor", descricao: "Professor sem vínculo tentou relatar indisponibilidade do material" })).toMatchObject({ ok: false });
  await prisma.designacaoAvaliadorReposicaoIndividual.create({ data: {
    reposicaoId: "repo-op-relato-professor", professorId, designadorId: gestorId,
    inicio: new Date(Date.now() - 120_000), fim: new Date(Date.now() - 60_000), motivo: "Designação anterior encerrada",
  } });
  entrar(professorId);
  expect(await registrarRelatoIndisponibilidadeEquipe({ reposicaoId: "repo-op-relato-professor", descricao: "Professor com designação encerrada tentou relatar indisponibilidade" })).toMatchObject({ ok: false });
  expect(await prisma.relatoIndisponibilidadeMaterialReposicao.count()).toBe(0);
});

it("descarte exige relato aberto da mesma reposição e preserva autor e motivo em Evento sem criar pausa", async () => {
  const propria = await prepararReposicao("repo-op-descarte", matriculaId, alunoId);
  const outra = await prepararReposicao("repo-op-descarte-outra", outraMatriculaId, outroAlunoId);
  await prisma.relatoIndisponibilidadeMaterialReposicao.create({ data: { id: "relato-op-descarte", materialId: propria.materialId, relatadoPorId: secretariaId, descricao: "Falha relatada pela equipe e ainda pendente" } });
  await prisma.relatoIndisponibilidadeMaterialReposicao.create({ data: { id: "relato-op-descarte-outro", materialId: outra.materialId, relatadoPorId: secretariaId, descricao: "Relato aberto de outra reposição" } });
  entrar(gestorId);
  expect(await descartarRelatoIndisponibilidadeEquipe({ reposicaoId: "repo-op-descarte", relatoId: "relato-op-descarte-outro", motivo: "Tentativa cruzada não pode decidir outro material" })).toMatchObject({ ok: false });
  expect(await prisma.relatoIndisponibilidadeMaterialReposicao.findUnique({ where: { id: "relato-op-descarte-outro" } })).toMatchObject({ situacao: "ABERTO" });
  const motivo = "Falha não pôde ser reproduzida na fonte institucional conferida";
  expect(await descartarRelatoIndisponibilidadeEquipe({ reposicaoId: "repo-op-descarte", relatoId: "relato-op-descarte", motivo })).toMatchObject({ ok: true, dado: { situacao: "DESCARTADO" } });
  expect(await prisma.relatoIndisponibilidadeMaterialReposicao.findUnique({ where: { id: "relato-op-descarte" } })).toMatchObject({ situacao: "DESCARTADO" });
  expect(await prisma.indisponibilidadeMaterialReposicao.count({ where: { materialId: propria.materialId } })).toBe(0);
  expect(await prisma.evento.findFirst({ where: { tipo: "RelatoIndisponibilidadeMaterialReposicaoDescartado", agregadoTipo: "Matricula", agregadoId: matriculaId, autorId: gestorId } })).toMatchObject({ payload: expect.objectContaining({ relatoId: "relato-op-descarte", motivo, situacao: "DESCARTADO" }) });
});

it("descarte não altera relato já confirmado nem a pausa existente", async () => {
  const propria = await prepararReposicao("repo-op-descarte-confirmado", matriculaId, alunoId);
  await prisma.relatoIndisponibilidadeMaterialReposicao.create({ data: { id: "relato-op-confirmado", materialId: propria.materialId, contaPortalAlunoId: contaId, descricao: "Aluno relatou indisponibilidade que foi confirmada" } });
  entrar(gestorId);
  expect(await confirmarIndisponibilidadeOperacional({ reposicaoId: "repo-op-descarte-confirmado", relatoId: "relato-op-confirmado", motivo: "Falha técnica foi reproduzida pela gestão" })).toMatchObject({ ok: true });
  expect(await descartarRelatoIndisponibilidadeEquipe({ reposicaoId: "repo-op-descarte-confirmado", relatoId: "relato-op-confirmado", motivo: "Tentativa posterior não pode reabrir nem descartar relato confirmado" })).toMatchObject({ ok: false });
  expect(await prisma.relatoIndisponibilidadeMaterialReposicao.findUnique({ where: { id: "relato-op-confirmado" } })).toMatchObject({ situacao: "CONFIRMADO" });
  expect(await prisma.indisponibilidadeMaterialReposicao.count({ where: { materialId: propria.materialId, fim: null } })).toBe(1);
  expect(await prisma.evento.count({ where: { tipo: "RelatoIndisponibilidadeMaterialReposicaoDescartado" } })).toBe(0);
});

it("wrapper prorroga a etapa base da reposição conferida sem expor conta do portal", async () => {
  await prepararReposicao("repo-op-prorroga", matriculaId, alunoId);
  const disponibilidade = await prisma.disponibilizacaoEntregaReposicao.findUniqueOrThrow({ where: { reposicaoId: "repo-op-prorroga" } });
  const novoPrazo = new Date(disponibilidade.prazoInicialAte.getTime() + 3_600_000).toISOString();
  entrar(gestorId);
  const resultado = await prorrogarEtapaOperacional({ reposicaoId: "repo-op-prorroga", solicitacaoCorrecaoId: null, prazoAnterior: disponibilidade.prazoInicialAte.toISOString(), novoPrazo, motivo: "Prorrogação pedagógica da etapa de entrega" });
  expect(resultado).toMatchObject({ ok: true, dado: { novoPrazo } });
  const prorroga = await prisma.prorrogacaoPrazoReposicao.findFirst({ where: { reposicaoId: "repo-op-prorroga" } });
  expect(prorroga).toMatchObject({ novoPrazo: new Date(novoPrazo), autorizadaPorId: gestorId });
  expect(JSON.stringify(resultado)).not.toContain(contaId);
});
