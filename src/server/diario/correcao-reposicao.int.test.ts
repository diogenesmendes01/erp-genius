import { beforeEach, expect, it, vi } from "vitest";
import { Papel, Prisma } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { prisma } from "@/lib/prisma";
import { carregarFrequenciaVinculoTx } from "@/server/avaliacoes/frequencia-tx";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { concluirReposicaoIndividual, decidirCorrecaoConclusaoReposicao, proporCorrecaoConclusaoReposicao } from "./reposicao-individual";
import { consultarCorrecoesConclusaoReposicao, listarReposicoesConcluidasDesignadas } from "./correcao-reposicao-consulta";

const inicio = new Date("2026-01-01T00:00:00.000Z");
const entregaOriginalEm = new Date("2026-01-14T10:00:00.000Z");
const validadaOriginalEm = new Date("2026-01-15T10:00:00.000Z");
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

let secretariaId: string;
let gestorId: string;
let professorId: string;
let alunoId: string;
let contaPortalAlunoId: string;
let matriculaId: string;
let turmaId: string;
let alocacaoId: string;

function assertOk<T extends { ok: boolean; dado?: unknown }>(resultado: T): asserts resultado is T & { ok: true; dado: NonNullable<T["dado"]> } {
  expect(resultado, JSON.stringify(resultado)).toMatchObject({ ok: true });
  if (!resultado.ok || resultado.dado === undefined || resultado.dado === null) throw new Error(JSON.stringify(resultado));
}

async function decidirComConferencia(input: Parameters<typeof decidirCorrecaoConclusaoReposicao>[0]) {
  const proposta = await prisma.correcaoConclusaoReposicaoIndividual.findUniqueOrThrow({ where: { id: input.correcaoId }, select: { conclusao: { select: { reposicaoId: true } } } });
  const consulta = await consultarCorrecoesConclusaoReposicao({ reposicaoId: proposta.conclusao.reposicaoId });
  const impactosHash = consulta.ok ? consulta.dado?.correcoes.find(c => c.id === input.correcaoId)?.impactosHash : null;
  return decidirCorrecaoConclusaoReposicao({ ...input, ...(input.aprovar && impactosHash ? { impactosHash } : {}) });
}

async function carregarFrequencia() {
  const alocacao = await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: alocacaoId } });
  if (!alocacao.matriculaId) throw new Error("Fixture sem matrícula.");
  return prisma.$transaction(tx => carregarFrequenciaVinculoTx(tx, { ...alocacao, matriculaId: alocacao.matriculaId! }, "nivel-correcao", "75", new Date("2026-02-01T00:00:00.000Z")));
}

async function criarFonteGravacao(sufixo = "principal") {
  const aula = await prisma.encontroAgenda.create({ data: {
    turmaId, professorId, preparadorId: secretariaId,
    inicio: new Date("2026-01-10T10:00:00.000Z"), fim: new Date("2026-01-10T11:00:00.000Z"),
    fusoOrigem: "UTC", status: "PREVISTO", finalidade: "AULA", motivo: `Aula original ${sufixo}`,
    chaveIdempotencia: `aula-correcao-${sufixo}`, entradaHash: `fixture-${sufixo}`,
    diario: { create: { turmaId, professorId, ocorridaEm: new Date("2026-01-10T10:00:00.000Z"), conteudo: "Aula original",
      registros: { create: { alunoId, matriculaId, nomeAluno: "Aluno reposição", presente: false, participacao: "FALTA" } } } },
  } });
  await prisma.encontroAgenda.update({ where: { id: aula.id }, data: { status: "MINISTRADO" } });
  const reposicaoId = `reposicao-${sufixo}`;
  await prisma.reposicaoIndividual.create({ data: {
    id: reposicaoId, aulaOriginalId: aula.id, matriculaId, modalidade: "GRAVACAO", solicitanteId: secretariaId,
    motivo: "Reposição gravada autorizada para correção.", evidencia: "Falta original conferida.",
    chaveIdempotencia: `pedido-correcao-${sufixo}`, entradaHash: `fixture-${sufixo}`,
  } });
  await prisma.decisaoReposicaoIndividual.create({ data: {
    reposicaoId, decisorId: gestorId, aprovada: true, motivo: "Gestão autorizou a reposição gravada.",
  } });
  await prisma.designacaoAvaliadorReposicaoIndividual.create({ data: {
    reposicaoId, professorId, designadorId: gestorId, inicio,
    motivo: "Professor designado para validar a gravação.",
  } });
  const entrega = await prisma.entregaReposicaoGravacao.create({ data: {
    reposicaoId, alunoId, contaPortalAlunoId, versao: 1, resumo: "Resumo feito pelo aluno.",
    atividade: "Atividade entregue pelo aluno.", evidencia: "Entrega original preservada.", entregueEm: entregaOriginalEm,
  } });
  const conclusao = await prisma.conclusaoReposicaoIndividual.create({ data: {
    reposicaoId, versao: 1, concluida: true, entregaId: entrega.id, validadaEm: validadaOriginalEm,
    validadaPorId: professorId, concluidaPorId: professorId, evidencia: "Validação docente original.",
  } });
  return { reposicaoId, conclusaoId: conclusao.id, entregaId: entrega.id, aulaId: aula.id };
}

async function criarEntregaNova(reposicaoId: string, versao: number, entregueEm: Date, aluno = alunoId) {
  return prisma.entregaReposicaoGravacao.create({ data: {
    reposicaoId, alunoId: aluno, contaPortalAlunoId: aluno === alunoId ? contaPortalAlunoId : null, versao,
    resumo: "Resumo da entrega corrigida pelo aluno.", atividade: "Atividade corrigida pelo aluno.",
    evidencia: "Arquivo da entrega corrigida.", entregueEm,
  } });
}

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  secretariaId = (await criarUsuario([Papel.SECRETARIA_ACADEMICA])).id;
  gestorId = (await criarUsuario([Papel.GERENTE_PEDAGOGICO])).id;
  professorId = (await criarUsuario([Papel.PROFESSOR])).id;
  alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Aluno da correção", paisId: catalogo.pais.id } })).id;
  contaPortalAlunoId = (await prisma.contaPortalAluno.create({ data: { alunoId } })).id;
  matriculaId = (await prisma.matricula.create({ data: {
    alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA", ativadaEm: inicio,
  } })).id;
  await prisma.nivel.create({ data: { id: "nivel-correcao", idiomaId: catalogo.idioma.id, codigo: "A1-COR", ordem: 1 } });
  turmaId = (await prisma.turma.create({ data: {
    modalidadeId: catalogo.modalidade.id, nivelId: "nivel-correcao", professorId, dataInicio: inicio, status: "EM_ANDAMENTO",
  } })).id;
  alocacaoId = (await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId, turmaId, criadoEm: inicio } })).id;
  entrar(professorId);
});

it("aplica validação gravada corrigida e retirada aprovada somente depois de decisão independente", async () => {
  const fonte = await criarFonteGravacao();
  expect(await carregarFrequencia()).toMatchObject({ base: 1, regularizadas: 1, faltas: 0 });
  const entregaCorrigida = await criarEntregaNova(fonte.reposicaoId, 2, new Date("2026-01-16T09:00:00.000Z"));

  entrar(professorId);
  const c1 = await proporCorrecaoConclusaoReposicao({
    reposicaoId: fonte.reposicaoId, conclusaoId: fonte.conclusaoId, versaoAnterior: 0, concluida: true,
    entregaId: entregaCorrigida.id, validadaEm: "2026-01-16T10:00:00.000Z",
    evidencia: "Validação corrigida da nova entrega.", motivo: "A versão correta é a entrega revisada do aluno.",
  });
  assertOk(c1);
  expect(c1.dado).toMatchObject({ versao: 1, propostaHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
  expect(await carregarFrequencia()).toMatchObject({ regularizadas: 1, faltas: 0 });
  expect((await decidirComConferencia({
    correcaoId: c1.dado.id, propostaHash: c1.dado.propostaHash, aprovar: true, motivo: "Autopromoção indevida.",
  })).ok).toBe(false);

  entrar(gestorId);
  expect((await decidirCorrecaoConclusaoReposicao({
    correcaoId: c1.dado.id, propostaHash: c1.dado.propostaHash, aprovar: true,
    motivo: "Aprovação sem conferência das dependências deve ser recusada.",
  })).ok).toBe(false);
  expect((await decidirCorrecaoConclusaoReposicao({
    correcaoId: c1.dado.id, propostaHash: c1.dado.propostaHash, impactosHash: "0".repeat(64), aprovar: true,
    motivo: "Token de dependências divergente deve ser recusado.",
  })).ok).toBe(false);
  const decisaoC1 = await decidirComConferencia({
    correcaoId: c1.dado.id, propostaHash: c1.dado.propostaHash, aprovar: true,
    motivo: "Gestão conferiu de forma independente a validação da entrega revisada.",
  });
  assertOk(decisaoC1);
  expect(await carregarFrequencia()).toMatchObject({ regularizadas: 1, faltas: 0 });

  entrar(professorId);
  const c2 = await proporCorrecaoConclusaoReposicao({
    reposicaoId: fonte.reposicaoId, conclusaoId: fonte.conclusaoId, versaoAnterior: 1, concluida: false,
    evidencia: "A revisão concluiu que a validação deve ser retirada.", motivo: "Retirada fundamentada da conclusão gravada.",
  });
  assertOk(c2);
  expect(await carregarFrequencia()).toMatchObject({ regularizadas: 1, faltas: 0 });
  entrar(gestorId);
  const decisaoC2 = await decidirComConferencia({
    correcaoId: c2.dado.id, propostaHash: c2.dado.propostaHash, aprovar: true,
    motivo: "Gestão aprova a retirada da conclusão após revisar a evidência.",
  });
  assertOk(decisaoC2);
  expect(await decidirComConferencia({
    correcaoId: c2.dado.id, propostaHash: c2.dado.propostaHash, aprovar: true,
    motivo: "Gestão aprova a retirada da conclusão após revisar a evidência.",
  })).toEqual(decisaoC2);
  expect(await carregarFrequencia()).toMatchObject({ base: 1, regularizadas: 0, faltas: 1 });
  expect(await prisma.registroAulaAluno.findFirstOrThrow({ where: { matriculaId, aula: { encontroId: fonte.aulaId } } })).toMatchObject({
    participacao: "FALTA", presente: false,
  });
});

it("recusa aprovação antiga de C1 depois de C2 e preserva a fonte até a decisão atual", async () => {
  const fonte = await criarFonteGravacao("stale");
  const entregaCorrigida = await criarEntregaNova(fonte.reposicaoId, 2, new Date("2026-01-16T09:00:00.000Z"));
  entrar(professorId);
  const c1 = await proporCorrecaoConclusaoReposicao({
    reposicaoId: fonte.reposicaoId, conclusaoId: fonte.conclusaoId, versaoAnterior: 0, concluida: true,
    entregaId: entregaCorrigida.id, validadaEm: "2026-01-16T10:00:00.000Z",
    evidencia: "Primeira correção válida.", motivo: "C1 será superada antes de aprovação.",
  });
  assertOk(c1);
  const c2 = await proporCorrecaoConclusaoReposicao({
    reposicaoId: fonte.reposicaoId, conclusaoId: fonte.conclusaoId, versaoAnterior: 1, concluida: false,
    evidencia: "Segunda correção atual.", motivo: "C2 retira a conclusão e torna C1 antiga.",
  });
  assertOk(c2);
  entrar(gestorId);
  expect((await decidirComConferencia({
    correcaoId: c1.dado.id, propostaHash: c1.dado.propostaHash, aprovar: true,
    motivo: "Aprovação tardia de C1 não pode prevalecer sobre C2.",
  })).ok).toBe(false);
  expect(await carregarFrequencia()).toMatchObject({ regularizadas: 1, faltas: 0 });
  assertOk(await decidirComConferencia({
    correcaoId: c2.dado.id, propostaHash: c2.dado.propostaHash, aprovar: true,
    motivo: "Aprovação independente da correção C2 atual.",
  }));
  expect(await carregarFrequencia()).toMatchObject({ regularizadas: 0, faltas: 1 });
});

it("recusa fontes gravadas de outra reposição, outro aluno, data incompatível e professor revogado", async () => {
  const fonte = await criarFonteGravacao("fonte");
  const outra = await criarFonteGravacao("outra");
  const entregaOutraReposicao = await criarEntregaNova(outra.reposicaoId, 2, new Date("2026-01-16T09:00:00.000Z"));
  const outroAluno = (await prisma.aluno.create({ data: { primeiroNome: "Outro aluno", paisId: (await prisma.aluno.findUniqueOrThrow({ where: { id: alunoId } })).paisId } })).id;
  await expect(criarEntregaNova(fonte.reposicaoId, 2, new Date("2026-01-16T09:00:00.000Z"), outroAluno)).rejects.toThrow();
  const entregaTardia = await criarEntregaNova(fonte.reposicaoId, 2, new Date("2026-01-16T11:00:00.000Z"));
  entrar(professorId);
  const comum = { reposicaoId: fonte.reposicaoId, conclusaoId: fonte.conclusaoId, versaoAnterior: 0, concluida: true,
    evidencia: "Fonte submetida para uma correção.", motivo: "A correção precisa rejeitar fonte incompatível.", validadaEm: "2026-01-16T10:00:00.000Z" };
  expect((await proporCorrecaoConclusaoReposicao({ ...comum, entregaId: entregaOutraReposicao.id })).ok).toBe(false);
  expect((await proporCorrecaoConclusaoReposicao({ ...comum, entregaId: entregaTardia.id })).ok).toBe(false);
  await prisma.usuario.update({ where: { id: professorId }, data: { ativo: false } });
  expect((await proporCorrecaoConclusaoReposicao({ ...comum, entregaId: fonte.entregaId })).ok).toBe(false);
  expect(await prisma.correcaoConclusaoReposicaoIndividual.count({ where: { conclusaoId: fonte.conclusaoId } })).toBe(0);
});

it("SQL recusa correção gravada concluída sem fonte válida", async () => {
  const fonte = await criarFonteGravacao("sql");
  await expect(prisma.$executeRaw(Prisma.sql`
    INSERT INTO "CorrecaoConclusaoReposicaoIndividual"
      (id,"conclusaoId","autorId",versao,concluida,evidencia,motivo,"entradaHash")
    VALUES ('correcao-sem-fonte',${fonte.conclusaoId},${professorId},1,true,'Evidência de teste','Fonte gravada inválida',${"a".repeat(64)})
  `)).rejects.toThrow();
  expect(await prisma.correcaoConclusaoReposicaoIndividual.count({ where: { conclusaoId: fonte.conclusaoId } })).toBe(0);
});

it("revalida o autor na aprovação e permite recusar a proposta após revogação", async () => {
  const fonte = await criarFonteGravacao("autor-revogado");
  const proposta = await proporCorrecaoConclusaoReposicao({
    reposicaoId: fonte.reposicaoId, conclusaoId: fonte.conclusaoId, versaoAnterior: 0,
    concluida: false, evidencia: "Conferência da conclusão anterior.", motivo: "Retirar a conclusão para nova avaliação.",
  });
  assertOk(proposta);
  await prisma.usuario.update({ where: { id: professorId }, data: { ativo: false } });
  entrar(gestorId);
  const decisao = { correcaoId: proposta.dado.id, propostaHash: proposta.dado.propostaHash,
    aprovar: true, motivo: "Revisão independente da proposta recebida." };
  expect((await decidirComConferencia(decisao)).ok).toBe(false);
  expect(await prisma.decisaoCorrecaoConclusaoReposicao.count()).toBe(0);
  expect(await carregarFrequencia()).toMatchObject({ regularizadas: 1, faltas: 0 });
  assertOk(await decidirComConferencia({ ...decisao, aprovar: false }));
  expect(await carregarFrequencia()).toMatchObject({ regularizadas: 1, faltas: 0 });
});

it("acumular papéis não permite autoaprovação e hash diferente não publica a correção", async () => {
  const fonte = await criarFonteGravacao("independencia");
  await prisma.usuario.update({ where: { id: professorId }, data: { papeis: [Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO] } });
  const proposta = await proporCorrecaoConclusaoReposicao({
    reposicaoId: fonte.reposicaoId, conclusaoId: fonte.conclusaoId, versaoAnterior: 0,
    concluida: false, evidencia: "Evidência para revisar a conclusão.", motivo: "Correção proposta por professor e gestor.",
  });
  assertOk(proposta);
  const decisao = { correcaoId: proposta.dado.id, propostaHash: proposta.dado.propostaHash,
    aprovar: true, motivo: "A decisão exige pessoa distinta e versão exata." };
  expect((await decidirComConferencia(decisao)).ok).toBe(false);
  entrar(gestorId);
  expect((await decidirComConferencia({ ...decisao, propostaHash: "0".repeat(64) })).ok).toBe(false);
  expect(await prisma.decisaoCorrecaoConclusaoReposicao.count()).toBe(0);
  assertOk(await decidirComConferencia(decisao));
  expect(await carregarFrequencia()).toMatchObject({ regularizadas: 0, faltas: 1 });
});

it("não permite trocar a entrega por nova conclusão, mas permite reavaliar após retirada aprovada", async () => {
  const fonte = await criarFonteGravacao("sem-bypass");
  const entrega = await criarEntregaNova(fonte.reposicaoId, 2, new Date("2026-01-16T09:00:00.000Z"));
  const nova = { reposicaoId: fonte.reposicaoId, versaoAnterior: 1, entregaId: entrega.id,
    validadaEm: "2026-01-16T10:00:00.000Z", evidencia: "Nova avaliação da entrega corrigida." };
  expect((await concluirReposicaoIndividual(nova)).ok).toBe(false);
  await expect(prisma.conclusaoReposicaoIndividual.create({ data: {
    reposicaoId: fonte.reposicaoId, versao: 2, concluida: true, entregaId: entrega.id,
    validadaEm: new Date(nova.validadaEm), validadaPorId: professorId, concluidaPorId: professorId, evidencia: nova.evidencia,
  } })).rejects.toThrow();
  const retirada = await proporCorrecaoConclusaoReposicao({
    reposicaoId: fonte.reposicaoId, conclusaoId: fonte.conclusaoId, versaoAnterior: 0, concluida: false,
    evidencia: "Revisão exige nova avaliação da entrega.", motivo: "Retirar a conclusão anterior com aprovação.",
  });
  assertOk(retirada);
  entrar(gestorId);
  assertOk(await decidirComConferencia({ correcaoId: retirada.dado.id,
    propostaHash: retirada.dado.propostaHash, aprovar: true, motivo: "Gestão confere a retirada antes da reavaliação." }));
  entrar(professorId);
  const pendente = await proporCorrecaoConclusaoReposicao({
    reposicaoId: fonte.reposicaoId, conclusaoId: fonte.conclusaoId, versaoAnterior: 1, concluida: false,
    evidencia: "Evidência complementar antes da reavaliação.", motivo: "Proposta que permanecerá histórica sem decisão.",
  });
  assertOk(pendente);
  assertOk(await concluirReposicaoIndividual(nova));
  expect(await prisma.conclusaoReposicaoIndividual.count({ where: { reposicaoId: fonte.reposicaoId } })).toBe(2);
  expect(await carregarFrequencia()).toMatchObject({ regularizadas: 1, faltas: 0 });
  entrar(gestorId);
  const historico = await consultarCorrecoesConclusaoReposicao({ reposicaoId: fonte.reposicaoId, conclusaoVersao: 1, limite: 1 });
  assertOk(historico);
  expect(historico.dado).toMatchObject({ consultaHistorica: true, podePropor: false,
    ultimaConclusaoVersao: 2, conclusaoAnteriorVersao: null, conclusaoSeguinteVersao: 2,
    conclusao: { id: fonte.conclusaoId, versao: 1 }, vigente: { fonte: { concluida: false } }, proximaAntesVersao: 2 });
  expect(historico.dado.correcoes).toEqual([expect.objectContaining({ id: pendente.dado.id, podeAprovar: false, podeRejeitar: false })]);
  const paginaAnterior = await consultarCorrecoesConclusaoReposicao({ reposicaoId: fonte.reposicaoId, conclusaoVersao: 1, antesVersao: 2, limite: 1 });
  assertOk(paginaAnterior);
  expect(paginaAnterior.dado.correcoes.map(c => c.id)).toEqual([retirada.dado.id]);
  expect(paginaAnterior.dado.proximaAntesVersao).toBeNull();
  const atual = await consultarCorrecoesConclusaoReposicao({ reposicaoId: fonte.reposicaoId });
  assertOk(atual);
  expect(atual.dado).toMatchObject({ consultaHistorica: false, podePropor: true, conclusaoAnteriorVersao: 1,
    conclusaoSeguinteVersao: null, conclusao: { versao: 2 }, vigente: { fonte: { concluida: true } } });
  expect((await consultarCorrecoesConclusaoReposicao({ reposicaoId: fonte.reposicaoId, conclusaoVersao: 3 })).ok).toBe(false);
  expect((await proporCorrecaoConclusaoReposicao({ reposicaoId: fonte.reposicaoId, conclusaoId: fonte.conclusaoId,
    versaoAnterior: 2, concluida: false, evidencia: "Tentativa sobre conclusão histórica.", motivo: "Esta versão antiga não pode receber proposta." })).ok).toBe(false);
});

it("consulta de correções limita o professor à designação vigente e exclui Secretaria e financeiro", async () => {
  const fonte = await criarFonteGravacao("consulta-acesso");
  const consulta = await consultarCorrecoesConclusaoReposicao({ reposicaoId: fonte.reposicaoId });
  assertOk(consulta);
  expect(consulta.dado.conclusao.id).toBe(fonte.conclusaoId);
  expect(consulta.dado).not.toHaveProperty("matricula");
  expect(consulta.dado).not.toHaveProperty("aluno");
  expect(consulta.dado.fontesDisponiveis.entregas.map(e => e.id)).toEqual([fonte.entregaId]);
  entrar(secretariaId);
  expect((await consultarCorrecoesConclusaoReposicao({ reposicaoId: fonte.reposicaoId })).ok).toBe(false);
  const financeiro = await criarUsuario([Papel.FINANCEIRO]);
  entrar(financeiro.id);
  expect((await consultarCorrecoesConclusaoReposicao({ reposicaoId: fonte.reposicaoId })).ok).toBe(false);
  const outro = await criarUsuario([Papel.PROFESSOR]);
  entrar(outro.id);
  expect((await consultarCorrecoesConclusaoReposicao({ reposicaoId: fonte.reposicaoId })).ok).toBe(false);
  await prisma.usuario.update({ where: { id: professorId }, data: { ativo: false } });
  entrar(professorId);
  expect((await consultarCorrecoesConclusaoReposicao({ reposicaoId: fonte.reposicaoId })).ok).toBe(false);
  entrar(gestorId);
  assertOk(await consultarCorrecoesConclusaoReposicao({ reposicaoId: fonte.reposicaoId }));
});

it("fila docente pagina somente suas conclusões e revalida a atribuição", async () => {
  const primeira = await criarFonteGravacao("fila-a");
  const segunda = await criarFonteGravacao("fila-b");
  const pagina1 = await listarReposicoesConcluidasDesignadas({ limite: 1 });
  assertOk(pagina1);
  expect(pagina1.dado.itens.map(r => r.id)).toEqual([segunda.reposicaoId]);
  expect(pagina1.dado.proximoAntesId).toBe(segunda.reposicaoId);
  const pagina2 = await listarReposicoesConcluidasDesignadas({ limite: 1, antesId: pagina1.dado.proximoAntesId! });
  assertOk(pagina2);
  expect(pagina2.dado.itens.map(r => r.id)).toEqual([primeira.reposicaoId]);
  expect(pagina2.dado.proximoAntesId).toBeNull();
  expect(Object.keys(pagina2.dado.itens[0]!).sort()).toEqual(["id", "modalidade", "origem"]);
  const outro = await criarUsuario([Papel.PROFESSOR]);
  entrar(outro.id);
  const semAtribuicao = await listarReposicoesConcluidasDesignadas();
  assertOk(semAtribuicao);
  expect(semAtribuicao.dado.itens).toEqual([]);
  entrar(secretariaId);
  expect((await listarReposicoesConcluidasDesignadas()).ok).toBe(false);
  entrar(professorId);
  await prisma.usuario.update({ where: { id: professorId }, data: { ativo: false } });
  expect((await listarReposicoesConcluidasDesignadas()).ok).toBe(false);
});

it("exige nova conferência se o nível da fonte mudar após a revisão", async () => {
  const fonte = await criarFonteGravacao("contexto-mudou");
  const proposta = await proporCorrecaoConclusaoReposicao({ reposicaoId: fonte.reposicaoId,
    conclusaoId: fonte.conclusaoId, versaoAnterior: 0, concluida: false,
    evidencia: "Evidência de retirada da conclusão.", motivo: "Revisão independente das dependências do nível." });
  assertOk(proposta);
  entrar(gestorId);
  const revisao = await consultarCorrecoesConclusaoReposicao({ reposicaoId: fonte.reposicaoId });
  assertOk(revisao);
  const token = revisao.dado.correcoes[0]!.impactosHash!;
  expect(token).toMatch(/^[a-f0-9]{64}$/);
  const nivelOriginal = await prisma.nivel.findUniqueOrThrow({ where: { id: "nivel-correcao" } });
  const outroNivel = await prisma.nivel.create({ data: { idiomaId: nivelOriginal.idiomaId, codigo: "A2-CTX", ordem: 2 } });
  await prisma.turma.update({ where: { id: turmaId }, data: { nivelId: outroNivel.id } });
  expect((await decidirCorrecaoConclusaoReposicao({ correcaoId: proposta.dado.id, propostaHash: proposta.dado.propostaHash,
    impactosHash: token, aprovar: true, motivo: "Tentativa com a conferência do nível anterior." })).ok).toBe(false);
  expect(await prisma.decisaoCorrecaoConclusaoReposicao.count()).toBe(0);
  assertOk(await decidirComConferencia({ correcaoId: proposta.dado.id, propostaHash: proposta.dado.propostaHash,
    aprovar: true, motivo: "Aprovação depois de conferir novamente o contexto." }));
});
