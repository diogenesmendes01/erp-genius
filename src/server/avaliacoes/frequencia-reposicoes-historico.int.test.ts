import { beforeEach, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { carregarReposicoesFrequenciaTx } from "./frequencia-reposicoes-tx";

const inicio = new Date("2026-01-01T00:00:00.000Z");
const apuradaEm = new Date("2026-02-01T00:00:00.000Z");
let secretariaId: string;
let gestorId: string;
let administradorId: string;
let professorId: string;
let alunoId: string;
let contaPortalAlunoId: string;
let matriculaId: string;
let turmaId: string;

async function carregar(aulaOriginalId: string) {
  return prisma.$transaction(tx => carregarReposicoesFrequenciaTx(tx, { matriculaId, aulaOriginalIds: [aulaOriginalId], apuradaEm }));
}

async function criarFonte({ segundaConclusao = false, retiradaDaMaisRecente = false } = {}) {
  const original = await prisma.encontroAgenda.create({ data: {
    turmaId, professorId, preparadorId: secretariaId,
    inicio: new Date("2026-01-10T10:00:00.000Z"), fim: new Date("2026-01-10T11:00:00.000Z"),
    fusoOrigem: "UTC", finalidade: "AULA", status: "PREVISTO", motivo: "Aula original com falta.",
    chaveIdempotencia: `frequencia-historico-${segundaConclusao}-${retiradaDaMaisRecente}`, entradaHash: "fixture",
    diario: { create: { turmaId, professorId, ocorridaEm: new Date("2026-01-10T10:00:00.000Z"), conteudo: "Aula original",
      registros: { create: { alunoId, matriculaId, nomeAluno: "Aluno histórico", presente: false, participacao: "FALTA" } } } },
  } });
  await prisma.encontroAgenda.update({ where: { id: original.id }, data: { status: "MINISTRADO" } });
  const reposicao = await prisma.reposicaoIndividual.create({ data: {
    aulaOriginalId: original.id, matriculaId, modalidade: "GRAVACAO", solicitanteId: secretariaId,
    motivo: "Reposição gravada autorizada.", evidencia: "Falta conferida na aula original.",
    chaveIdempotencia: `pedido-historico-${segundaConclusao}-${retiradaDaMaisRecente}`, entradaHash: "fixture",
  } });
  await prisma.decisaoReposicaoIndividual.create({ data: {
    reposicaoId: reposicao.id, decisorId: gestorId, aprovada: true, motivo: "Aprovação independente da reposição.",
  } });
  await prisma.designacaoAvaliadorReposicaoIndividual.create({ data: {
    reposicaoId: reposicao.id, professorId, designadorId: gestorId, inicio,
    motivo: "Designação vigente na validação histórica.",
  } });
  const entrega1 = await prisma.entregaReposicaoGravacao.create({ data: {
    reposicaoId: reposicao.id, alunoId, contaPortalAlunoId, versao: 1, resumo: "Resumo da primeira entrega.",
    atividade: "Atividade da primeira entrega.", evidencia: "Arquivo v1", entregueEm: new Date("2026-01-14T10:00:00.000Z"),
  } });
  await prisma.conclusaoReposicaoIndividual.create({ data: {
    reposicaoId: reposicao.id, versao: 1, concluida: true, entregaId: entrega1.id,
    validadaEm: new Date("2026-01-15T10:00:00.000Z"), validadaPorId: professorId, concluidaPorId: professorId,
    evidencia: "Validação histórica v1.",
  } });
  if (!segundaConclusao) return { originalId: original.id, reposicaoId: reposicao.id };

  const conclusao1 = await prisma.conclusaoReposicaoIndividual.findUniqueOrThrow({ where: {
    reposicaoId_versao: { reposicaoId: reposicao.id, versao: 1 },
  } });
  const retirada1 = await prisma.correcaoConclusaoReposicaoIndividual.create({ data: {
    conclusaoId: conclusao1.id, autorId: gestorId, versao: 1, concluida: false,
    evidencia: "A conclusão v1 foi retirada antes de nova validação.", motivo: "Retirada aprovada para permitir a conclusão v2.", entradaHash: "a".repeat(64),
  } });
  await prisma.decisaoCorrecaoConclusaoReposicao.create({ data: {
    correcaoId: retirada1.id, decisorId: administradorId, aprovada: true,
    motivo: "Administração aprova a retirada da conclusão v1.",
  } });

  const entrega2 = await prisma.entregaReposicaoGravacao.create({ data: {
    reposicaoId: reposicao.id, alunoId, contaPortalAlunoId, versao: 2, resumo: "Resumo da segunda entrega.",
    atividade: "Atividade da segunda entrega.", evidencia: "Arquivo v2", entregueEm: new Date("2026-01-16T10:00:00.000Z"),
  } });
  const conclusao2 = await prisma.conclusaoReposicaoIndividual.create({ data: {
    reposicaoId: reposicao.id, versao: 2, concluida: true, entregaId: entrega2.id,
    validadaEm: new Date("2026-01-16T11:00:00.000Z"), validadaPorId: professorId, concluidaPorId: professorId,
    evidencia: "Validação histórica v2.",
  } });
  if (retiradaDaMaisRecente) {
    const correcao = await prisma.correcaoConclusaoReposicaoIndividual.create({ data: {
      conclusaoId: conclusao2.id, autorId: gestorId, versao: 1, concluida: false,
      evidencia: "A validação mais recente foi retirada.", motivo: "Retirada aprovada da conclusão v2.", entradaHash: "b".repeat(64),
    } });
    await prisma.decisaoCorrecaoConclusaoReposicao.create({ data: {
      correcaoId: correcao.id, decisorId: administradorId, aprovada: true,
      motivo: "Administração decide de forma independente a retirada da v2.",
    } });
  }
  return { originalId: original.id, reposicaoId: reposicao.id };
}

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  secretariaId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  gestorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  administradorId = (await criarUsuario(["ADMINISTRADOR"])).id;
  professorId = (await criarUsuario(["PROFESSOR"])).id;
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1-HIST", ordem: 1 } });
  turmaId = (await prisma.turma.create({ data: {
    modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId, dataInicio: inicio, status: "EM_ANDAMENTO",
  } })).id;
  alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Aluno histórico", paisId: catalogo.pais.id } })).id;
  contaPortalAlunoId = (await prisma.contaPortalAluno.create({ data: { alunoId } })).id;
  matriculaId = (await prisma.matricula.create({ data: {
    alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA", ativadaEm: inicio,
  } })).id;
  await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId, turmaId, criadoEm: inicio } });
});

it("preserva a regularização gravada já validada quando o professor é desativado depois", async () => {
  const fonte = await criarFonte();
  expect((await carregar(fonte.originalId)).get(fonte.originalId)).toEqual([expect.objectContaining({
    aulaOriginalId: fonte.originalId, matriculaId, modalidade: "GRAVACAO", validadaEm: "2026-01-15T10:00:00.000Z",
  })]);
  await prisma.usuario.update({ where: { id: professorId }, data: { ativo: false } });
  expect((await carregar(fonte.originalId)).get(fonte.originalId)).toEqual([expect.objectContaining({
    aulaOriginalId: fonte.originalId, matriculaId, modalidade: "GRAVACAO", validadaEm: "2026-01-15T10:00:00.000Z",
  })]);
});

it("não ressuscita uma conclusão anterior quando a conclusão mais recente foi retirada", async () => {
  const fonte = await criarFonte({ segundaConclusao: true, retiradaDaMaisRecente: true });
  expect((await carregar(fonte.originalId)).get(fonte.originalId)).toBeUndefined();
});
