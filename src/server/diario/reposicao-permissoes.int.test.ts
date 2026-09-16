import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { prisma } from "@/lib/prisma";
import { criarAgendaParticularIsentaFixture } from "@/test/reposicao-agenda";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { concluirReposicaoIndividual, solicitarReposicaoIndividual } from "./reposicao-individual";
import { consultarReposicoesEquipe, consultarFilaReposicoesDocente } from "./reposicao-consulta";
import { exigirReposicaoDoPortalAluno } from "@/server/portal-aluno/reposicoes";

let gestorId: string, adminId: string, professorId: string, alunoId: string, contaPortalAlunoId: string, matriculaId: string, turmaId: string, aulaId: string;
const inicio = new Date("2026-01-10T10:00:00.000Z");
const fim = new Date("2026-01-10T11:00:00.000Z");
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const utc = (iso: string) => Prisma.sql`${iso}::timestamptz AT TIME ZONE 'UTC'`;

it.each(["PAUSADA", "ENCERRADA"] as const)("docente mantém avaliação de entrega histórica em matrícula %s", async status => {
  await inserirReposicao("entrega-historica", gestorId, "GRAVACAO");
  await autorizarReposicao("entrega-historica", adminId);
  await prisma.designacaoAvaliadorReposicaoIndividual.create({ data: {
    reposicaoId: "entrega-historica", professorId, designadorId: gestorId,
    inicio: new Date("2026-01-11T00:00:00Z"), motivo: "Docente designado para esta entrega",
  } });
  const entrega = await prisma.entregaReposicaoGravacao.create({ data: {
    reposicaoId: "entrega-historica", alunoId, contaPortalAlunoId, versao: 1,
    resumo: "Resumo registrado antes da pausa", atividade: "Atividade enviada pelo aluno",
    evidencia: "Entrega preservada", entregueEm: new Date("2026-01-12T10:00:00Z"),
  } });
  await prisma.matricula.update({ where: { id: matriculaId }, data: { status } });
  entrar(professorId);
  expect(await consultarFilaReposicoesDocente()).toMatchObject({ ok: true, dado: { itens: [{
    id: "entrega-historica", origem: { matriculaId }, entrega: { id: entrega.id },
  }] } });
  const outroProfessor = await criarUsuario(["PROFESSOR"]);
  entrar(outroProfessor.id);
  expect(await consultarFilaReposicoesDocente()).toMatchObject({ ok: true, dado: { itens: [] } });
  await prisma.designacaoAvaliadorReposicaoIndividual.create({ data: { reposicaoId: "entrega-historica", professorId: outroProfessor.id, designadorId: gestorId, inicio: new Date("2026-01-11T00:00:00Z"), fim: new Date("2026-02-01T00:00:00Z"), motivo: "Designação histórica já encerrada" } });
  entrar(outroProfessor.id);
  expect(await consultarFilaReposicoesDocente()).toMatchObject({ ok: true, dado: { itens: [] } });
  entrar(professorId);
  const resultado = await concluirReposicaoIndividual({ reposicaoId: "entrega-historica", versaoAnterior: 0, entregaId: entrega.id, validadaEm: new Date().toISOString(), evidencia: "Entrega histórica avaliada pelo docente designado" });
  expect(resultado, JSON.stringify(resultado)).toMatchObject({ ok: true });
  expect(await prisma.conclusaoReposicaoIndividual.count({ where: { reposicaoId: "entrega-historica", entregaId: entrega.id, concluida: true } })).toBe(1);
  expect(await prisma.matricula.findUnique({ where: { id: matriculaId } })).toMatchObject({ status });
});

async function outraOrigem() {
  const aula = await prisma.encontroAgenda.create({ data: { turmaId, professorId, preparadorId: gestorId,
    inicio: new Date("2026-01-11T10:00:00Z"), fim: new Date("2026-01-11T11:00:00Z"), fusoOrigem: "UTC", status: "PREVISTO",
    motivo: "Outra ausência independente", chaveIdempotencia: crypto.randomUUID(), entradaHash: "fixture",
    diario: { create: { turmaId, professorId, ocorridaEm: new Date("2026-01-11T10:00:00Z"), conteudo: "Outra aula",
      registros: { create: { alunoId, matriculaId, nomeAluno: "Aluno reposição", presente: false, participacao: "FALTA" } } } } } });
  await prisma.encontroAgenda.update({ where: { id: aula.id }, data: { status: "MINISTRADO" } });
  return aula.id;
}

async function inserirReposicao(id: string, solicitanteId = gestorId, modalidade: "PARTICULAR" | "GRAVACAO" = "PARTICULAR", origemId = aulaId) {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "ReposicaoIndividual" (id,"aulaOriginalId","matriculaId",modalidade,"solicitanteId",motivo,evidencia,"chaveIdempotencia","entradaHash")
    VALUES (${id},${origemId},${matriculaId},${modalidade}::"ModalidadeReposicaoIndividual",${solicitanteId},'Ausência conferida para reposição','Evidência da solicitação','chave-' || ${id},'fixture')`);
}

async function autorizarReposicao(id: string, decisorId: string) {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "DecisaoReposicaoIndividual" (id,"reposicaoId","decisorId",aprovada,motivo)
    VALUES ('decisao-' || ${id},${id},${decisorId},true,'Decisão independente da reposição')`);
}

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  gestorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  adminId = (await criarUsuario(["ADMINISTRADOR"])).id;
  professorId = (await criarUsuario(["PROFESSOR"])).id;
  alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Aluno reposição", paisId: catalogo.pais.id } })).id;
  contaPortalAlunoId = (await prisma.contaPortalAluno.create({ data: { alunoId } })).id;
  matriculaId = (await prisma.matricula.create({ data: { alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA", ativadaEm: inicio } })).id;
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  turmaId = (await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId, dataInicio: inicio } })).id;
  await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId, turmaId, criadoEm: inicio } });
  const aula = await prisma.encontroAgenda.create({ data: { turmaId, professorId, preparadorId: gestorId, inicio, fim, fusoOrigem: "UTC", status: "PREVISTO", motivo: "Aula coletiva concluída", chaveIdempotencia: "aula-reposicao", entradaHash: "fixture",
    diario: { create: { turmaId, professorId, ocorridaEm: inicio, conteudo: "Aula original", registros: { create: { alunoId, matriculaId, nomeAluno: "Aluno reposição", presente: false, participacao: "FALTA" } } } } } });
  await prisma.encontroAgenda.update({ where: { id: aula.id }, data: { status: "MINISTRADO" } });
  aulaId = aula.id;
  entrar(gestorId);
});

it("consulta da equipe conserva matrícula e recusa docente ou papel revogado", async () => {
  await inserirReposicao("consulta-pedido");
  expect(await consultarReposicoesEquipe({ matriculaId })).toMatchObject({ ok: true, dado: { matricula: { id: matriculaId }, reposicoes: [{ id: "consulta-pedido", origem: { matriculaId, aulaOriginalId: aulaId }, podeDecidir: false }] } });
  entrar(adminId);
  const r = await consultarReposicoesEquipe({ matriculaId });
  expect(r).toMatchObject({ ok: true, dado: { reposicoes: [{ podeDecidir: true }] } });
  expect(JSON.stringify(r)).not.toMatch(/senhaHash|telefone|documento|responsavelFinanceiro/);
  entrar(professorId);
  expect((await consultarReposicoesEquipe({ matriculaId })).ok).toBe(false);
  expect(await consultarFilaReposicoesDocente()).toMatchObject({ ok: true, dado: { itens: [] } });
  entrar(gestorId);
  await prisma.usuario.update({ where: { id: gestorId }, data: { ativo: false } });
  expect((await consultarReposicoesEquipe({ matriculaId })).ok).toBe(false);
});

it("consulta da equipe usa correção aprovada sem restaurar a data anulada", async () => {
  await inserirReposicao("consulta-corrigida", gestorId, "GRAVACAO");
  await autorizarReposicao("consulta-corrigida", adminId);
  await prisma.designacaoAvaliadorReposicaoIndividual.create({ data: { reposicaoId: "consulta-corrigida", professorId, designadorId: gestorId, inicio: new Date("2026-01-11T00:00:00Z"), motivo: "Designação para avaliação" } });
  const entrega = await prisma.entregaReposicaoGravacao.create({ data: { reposicaoId: "consulta-corrigida", alunoId, contaPortalAlunoId, versao: 1, resumo: "Resumo escrito pelo aluno", atividade: "Atividade respondida pelo aluno", evidencia: "Entrega original preservada", entregueEm: new Date("2026-01-12T10:00:00Z") } });
  const conclusao = await prisma.conclusaoReposicaoIndividual.create({ data: { reposicaoId: "consulta-corrigida", versao: 1, concluida: true, entregaId: entrega.id, validadaEm: new Date("2026-01-12T11:00:00Z"), validadaPorId: professorId, concluidaPorId: professorId, evidencia: "Validação original registrada" } });
  const correcao = await prisma.correcaoConclusaoReposicaoIndividual.create({ data: { conclusaoId: conclusao.id, autorId: gestorId, versao: 1, concluida: false, evidencia: "Revisão confirmou erro de avaliação", motivo: "Retirar conclusão incorreta", entradaHash: "fixture-correcao-consulta" } });
  const identidadePortal = { sessaoId: "sessao-fixture", contaId: contaPortalAlunoId, alunoId, email: "aluno@example.test" };
  expect(await exigirReposicaoDoPortalAluno("consulta-corrigida", identidadePortal)).toMatchObject({ concluida: true, dataResultado: new Date("2026-01-12T11:00:00Z") });
  expect(await consultarReposicoesEquipe({ matriculaId })).toMatchObject({ ok: true, dado: { reposicoes: [{ conclusao: { concluida: true, dataResultado: "2026-01-12T11:00:00.000Z" } }] } });
  entrar(professorId);
  expect(await consultarFilaReposicoesDocente()).toMatchObject({ ok: true, dado: { itens: [] } });
  entrar(gestorId);
  await prisma.decisaoCorrecaoConclusaoReposicao.create({ data: { correcaoId: correcao.id, decisorId: adminId, aprovada: true, motivo: "Correção conferida independentemente" } });
  expect(await exigirReposicaoDoPortalAluno("consulta-corrigida", identidadePortal)).toMatchObject({ concluida: false, dataResultado: null });
  expect(await consultarReposicoesEquipe({ matriculaId })).toMatchObject({ ok: true, dado: { reposicoes: [{ conclusao: { concluida: false, dataResultado: null } }] } });
  expect((await prisma.conclusaoReposicaoIndividual.findUniqueOrThrow({ where: { id: conclusao.id } })).validadaEm).toEqual(new Date("2026-01-12T11:00:00Z"));
  entrar(professorId);
  expect(await consultarFilaReposicoesDocente()).toMatchObject({ ok: true, dado: { itens: [{ id: "consulta-corrigida", versaoAnterior: 1, entrega: null }] } });
  const novaEntrega = await prisma.entregaReposicaoGravacao.create({ data: { reposicaoId: "consulta-corrigida", alunoId, contaPortalAlunoId, versao: 2,
    resumo: "Nova entrega para reavaliação", atividade: "Atividade revisada", evidencia: "Entrega posterior à correção",
    entregueEm: new Date("2026-01-13T10:00:00Z") } });
  expect(await consultarFilaReposicoesDocente()).toMatchObject({ ok: true, dado: { itens: [{ id: "consulta-corrigida", entrega: { id: novaEntrega.id } }] } });
});

it("consulta pagina pedidos sem repetir registros e mantém histórico da matrícula pausada", async () => {
  await inserirReposicao("pagina-primeiro");
  await inserirReposicao("pagina-segundo", gestorId, "PARTICULAR", await outraOrigem());
  entrar(adminId);
  const primeira = await consultarReposicoesEquipe({ matriculaId, limite: 1 });
  if (!primeira.ok || !primeira.dado?.proximoCursor) throw new Error(JSON.stringify(primeira));
  const segunda = await consultarReposicoesEquipe({ matriculaId, limite: 1, cursor: primeira.dado.proximoCursor });
  if (!segunda.ok || !segunda.dado) throw new Error(JSON.stringify(segunda));
  expect(primeira.dado.reposicoes).toHaveLength(1);
  expect(segunda.dado.reposicoes).toHaveLength(1);
  expect(new Set([...primeira.dado.reposicoes, ...segunda.dado.reposicoes].map(r => r.id))).toEqual(new Set(["pagina-primeiro", "pagina-segundo"]));
  expect(segunda.dado.proximoCursor).toBeNull();
  await prisma.matricula.update({ where: { id: matriculaId }, data: { status: "PAUSADA" } });
  const pausada = await consultarReposicoesEquipe({ matriculaId });
  expect(pausada).toMatchObject({ ok: true, dado: { matricula: { ativa: false }, reposicoes: [{ podeDecidir: false }, { podeDecidir: false }] } });
});

it("pagina ausências independentemente dos pedidos sem perder a aula anterior", async () => {
  const outra = await prisma.encontroAgenda.create({ data: {
    turmaId, professorId, preparadorId: gestorId,
    inicio: new Date("2026-01-11T10:00:00Z"), fim: new Date("2026-01-11T11:00:00Z"),
    fusoOrigem: "UTC", status: "PREVISTO", motivo: "Outra aula com ausência",
    chaveIdempotencia: "outra-origem-paginacao", entradaHash: "fixture",
    diario: { create: { turmaId, professorId, ocorridaEm: new Date("2026-01-11T10:00:00Z"),
      conteudo: "Outra aula original", registros: { create: { alunoId, matriculaId,
        nomeAluno: "Aluno reposição", presente: false, participacao: "FALTA" } } } },
  } });
  await prisma.encontroAgenda.update({ where: { id: outra.id }, data: { status: "MINISTRADO" } });
  const primeira = await consultarReposicoesEquipe({ matriculaId, limite: 1 });
  if (!primeira.ok || !primeira.dado?.proximoOrigemCursor) throw new Error(JSON.stringify(primeira));
  expect(primeira.dado.origensElegiveis.map(o => o.aulaOriginalId)).toEqual([outra.id]);
  expect(primeira.dado.proximoCursor).toBeNull();
  const segunda = await consultarReposicoesEquipe({ matriculaId, limite: 1, origemCursor: primeira.dado.proximoOrigemCursor });
  if (!segunda.ok || !segunda.dado) throw new Error(JSON.stringify(segunda));
  expect(segunda.dado.origensElegiveis.map(o => o.aulaOriginalId)).toEqual([aulaId]);
  expect(segunda.dado.proximoOrigemCursor).toBeNull();
  expect(segunda.dado.reposicoes).toEqual([]);
});

it("permite nova solicitação após rejeição preservando o pedido anterior", async () => {
  await inserirReposicao("pedido-rejeitado");
  await expect(inserirReposicao("duplicado-sql")).rejects.toThrow("já possui reposição");
  expect(await consultarReposicoesEquipe({ matriculaId })).toMatchObject({ ok: true, dado: { origensElegiveis: [] } });
  expect(await solicitarReposicaoIndividual({ aulaOriginalId: aulaId, matriculaId, modalidade: "PARTICULAR",
    motivo: "Não duplicar solicitação em aberto", evidencia: "A decisão anterior ainda está pendente",
    chaveIdempotencia: "bloquear-duplicidade-pendente" })).toMatchObject({ ok: false, erro: expect.stringContaining("pendente") });
  await prisma.decisaoReposicaoIndividual.create({ data: { reposicaoId: "pedido-rejeitado", decisorId: adminId,
    aprovada: false, motivo: "Solicitação precisa de documentação complementar" } });
  const consulta = await consultarReposicoesEquipe({ matriculaId });
  expect(consulta).toMatchObject({ ok: true, dado: { origensElegiveis: [{ aulaOriginalId: aulaId }],
    reposicoes: [{ id: "pedido-rejeitado", decisao: { aprovada: false } }] } });
  const novo = await solicitarReposicaoIndividual({ aulaOriginalId: aulaId, matriculaId, modalidade: "PARTICULAR",
    motivo: "Novo pedido com documentação complementar", evidencia: "Complementação conferida pela secretaria",
    chaveIdempotencia: "nova-solicitacao-apos-rejeicao" });
  expect(novo.ok, JSON.stringify(novo)).toBe(true);
  expect(await consultarReposicoesEquipe({ matriculaId })).toMatchObject({ ok: true, dado: { origensElegiveis: [] } });
  expect(await prisma.reposicaoIndividual.count({ where: { aulaOriginalId: aulaId, matriculaId } })).toBe(2);
});

it("SQL recusa decisão por docente, pessoa inativa e autoaprovação", async () => {
  await inserirReposicao("r-docente");
  await expect(autorizarReposicao("r-docente", professorId)).rejects.toThrow();

  const inativo = await criarUsuario(["GERENTE_PEDAGOGICO"]);
  await prisma.usuario.update({ where: { id: inativo.id }, data: { ativo: false } });
  await inserirReposicao("r-inativo", gestorId, "PARTICULAR", await outraOrigem());
  await expect(autorizarReposicao("r-inativo", inativo.id)).rejects.toThrow();

  await inserirReposicao("r-auto", gestorId, "PARTICULAR", await outraOrigem());
  await expect(autorizarReposicao("r-auto", gestorId)).rejects.toThrow();
});

it("não aceita pedido para outro contrato do mesmo aluno", async () => {
  const atual = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const outroContrato = await prisma.matricula.create({ data: { alunoId, produtoId: atual.produtoId, paisId: atual.paisId, moeda: atual.moeda, status: "ATIVA" } });
  entrar(gestorId);
  expect((await solicitarReposicaoIndividual({ aulaOriginalId: aulaId, matriculaId: outroContrato.id, modalidade: "PARTICULAR", motivo: "Não confundir contratos do mesmo aluno", evidencia: "A chamada pertence ao contrato original", chaveIdempotencia: "outro-contrato-reposicao" })).ok).toBe(false);
  await expect(prisma.$executeRaw(Prisma.sql`
    INSERT INTO "ReposicaoIndividual" (id,"aulaOriginalId","matriculaId",modalidade,"solicitanteId",motivo,evidencia,"chaveIdempotencia","entradaHash")
    VALUES ('r-outro-contrato',${aulaId},${outroContrato.id},'PARTICULAR'::"ModalidadeReposicaoIndividual",${gestorId},'Outro contrato','Não reutilizar chamada','outro-contrato-sql','fixture')`)).rejects.toThrow();
});

it("bloqueia conclusão após pausa e gravação sem avaliador designado", async () => {
  await inserirReposicao("r-pausada");
  await autorizarReposicao("r-pausada", adminId);
  const secretaria = await criarUsuario(["SECRETARIA_ACADEMICA"]);
  const encontroReposicao = await criarAgendaParticularIsentaFixture({ reposicaoId: "r-pausada", matriculaId, alunoId, professorId,
    secretariaId: secretaria.id, decisorId: adminId, inicio: new Date("2026-01-12T10:00:00Z"), fim: new Date("2026-01-12T11:00:00Z") });
  await prisma.matricula.update({ where: { id: matriculaId }, data: { status: "PAUSADA" } });
  entrar(professorId);
  expect((await concluirReposicaoIndividual({ reposicaoId: "r-pausada", versaoAnterior: 0, encontroReposicaoId: encontroReposicao.encontroId, evidencia: "Diário da reposição realizada" })).ok).toBe(false);

  // A tabela deve recusar a fonte gravada enquanto não houver designação vigente.
  await prisma.matricula.update({ where: { id: matriculaId }, data: { status: "ATIVA" } });
  await inserirReposicao("r-gravacao", gestorId, "GRAVACAO", await outraOrigem());
  await autorizarReposicao("r-gravacao", adminId);
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "EntregaReposicaoGravacao" (id,"reposicaoId","alunoId","contaPortalAlunoId",versao,resumo,atividade,evidencia,"entregueEm")
    VALUES ('entrega-sem-designacao','r-gravacao',${alunoId},${contaPortalAlunoId},1,'Resumo do aluno','Atividade entregue','Arquivo enviado',${utc("2026-01-12T10:30:00.000Z")})`);
  await expect(prisma.$executeRaw(Prisma.sql`
    INSERT INTO "ConclusaoReposicaoIndividual" (id,"reposicaoId",versao,concluida,"entregaId","validadaEm","validadaPorId","concluidaPorId",evidencia)
    VALUES ('sem-designacao','r-gravacao',1,true,'entrega-sem-designacao',${utc("2026-01-12T11:00:00.000Z")},${professorId},${professorId},'Tentativa sem avaliador')`)).rejects.toThrow("docente ativo designado na validação");
});
