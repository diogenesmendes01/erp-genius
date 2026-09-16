import { beforeEach, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { prisma } from "@/lib/prisma";
import { salvarLancamentoAvaliacao, oficializarLancamentoAvaliacao } from "./lancamentos";
import { decidirEquivalenciaTransferencia } from "./equivalencia-decisao";
import { proporEquivalenciaTransferencia, revisarEquivalenciaTransferencia } from "./equivalencia-proposta";
import { decidirRegraAvaliacaoTx, prepararRegraAvaliacaoTx } from "./regras-tx";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";

let professorId: string, preparadorId: string, decisorId: string, alunoId: string;
let matriculaId: string, alocacaoOrigemId: string, turmaDestinoId: string;
const inicio = new Date("2026-01-01T00:00:00.000Z");
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

async function prepararProposta(chave: string) {
  entrar(preparadorId);
  const revisao = await revisarEquivalenciaTransferencia({
    matriculaId, alocacaoOrigemId, turmaDestinoId,
    mapeamentos: [{ referenciaFonteId: `${lancamentoId}:FALA`, codigoAvaliacaoDestino: "I1", habilidadeDestino: "FALA" }],
  });
  if (!revisao.ok || !revisao.dado) throw new Error(JSON.stringify(revisao));
  const proposta = await proporEquivalenciaTransferencia({
    matriculaId, alocacaoOrigemId, turmaDestinoId,
    mapeamentos: [{ referenciaFonteId: `${lancamentoId}:FALA`, codigoAvaliacaoDestino: "I1", habilidadeDestino: "FALA" }],
    estadoHash: revisao.dado.estadoHash, versaoEsperada: revisao.dado.versaoAtual,
    motivo: "Mapeamento de aproveitamento conferido pela gestão", chaveIdempotencia: chave,
  });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  return { propostaId: proposta.dado.id, estadoHash: revisao.dado.estadoHash };
}

let lancamentoId: string;
beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  professorId = (await criarUsuario(["PROFESSOR"])).id;
  preparadorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  decisorId = (await criarUsuario(["ADMINISTRADOR"])).id;
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  const regraPreparada = await prisma.$transaction(tx => prepararRegraAvaliacaoTx(tx, preparadorId, {
    nivelId: nivel.id, versaoEsperada: 0, conteudo: regraAvaliacaoTeste(), motivo: "Regra para decisão de equivalência",
    chaveIdempotencia: "regra-equivalencia-decisao",
  }));
  const regra = await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: regraPreparada.id } });
  await prisma.$transaction(tx => decidirRegraAvaliacaoTx(tx, decisorId, {
    regraId: regra.id, conteudoHash: regra.conteudoHash, aprovada: true, motivo: "Regra publicada por outra pessoa",
  }));
  const origem = await prisma.turma.create({ data: {
    nome: "Origem da equivalência", modalidadeId: catalogo.modalidade.id, nivelId: nivel.id,
    professorId, dataInicio: new Date("2099-01-01T00:00:00.000Z"), capacidade: 10,
    vinculosDocentes: { create: { professorId, inicio } },
  } });
  await prisma.turma.update({ where: { id: origem.id }, data: { dataInicio: inicio, status: "EM_ANDAMENTO" } });
  const destino = await prisma.turma.create({ data: {
    nome: "Destino da equivalência", modalidadeId: catalogo.modalidade.id, nivelId: nivel.id,
    professorId, status: "ABERTA", dataInicio: new Date("2099-01-01T00:00:00.000Z"), capacidade: 10,
  } });
  turmaDestinoId = destino.id;
  alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Aluna de equivalência", paisId: catalogo.pais.id } })).id;
  matriculaId = (await prisma.matricula.create({ data: {
    alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", codigo: "M-EQUIV-DECISAO", status: "ATIVA", ativadaEm: inicio,
  } })).id;
  alocacaoOrigemId = (await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId, turmaId: origem.id, criadoEm: inicio } })).id;

  entrar(professorId);
  const salvo = await salvarLancamentoAvaliacao({
    alocacaoId: alocacaoOrigemId, codigoAvaliacao: "I1", realizadaEm: "2026-01-10T10:00:00.000Z",
    notas: [{ habilidade: "FALA", nota: "8", comentarioAluno: "Fonte oficial" }], submetida: true,
    versaoEsperada: 0, chaveIdempotencia: "lancamento-equivalencia-decisao",
  });
  if (!salvo.ok || !salvo.dado) throw new Error(JSON.stringify(salvo));
  lancamentoId = salvo.dado.id;
  const lancamento = await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: lancamentoId } });
  entrar(decisorId);
  expect(await oficializarLancamentoAvaliacao({
    lancamentoId, conteudoHash: lancamento.conteudoHash, aprovada: true, motivo: "Fonte oficial conferida pela gestão",
  })).toMatchObject({ ok: true });
});

it("exige revisão hash, decisão independente e repete somente a mesma decisão", async () => {
  const proposta = await prepararProposta("equivalencia-decisao-independente");
  await prisma.usuario.update({ where: { id: preparadorId }, data: { papeis: ["GERENTE_PEDAGOGICO", "ADMINISTRADOR"] } });
  expect(await decidirEquivalenciaTransferencia({ propostaId: proposta.propostaId, estadoHash: proposta.estadoHash,
    aprovar: true, motivo: "Decisão não pode ser da pessoa preparadora" })).toMatchObject({ ok: false });

  entrar(decisorId);
  const entrada = { propostaId: proposta.propostaId, estadoHash: proposta.estadoHash, aprovar: true, motivo: "Fontes e mapeamento conferidos por outra pessoa" };
  const decisao = await decidirEquivalenciaTransferencia(entrada);
  expect(decisao, JSON.stringify(decisao)).toMatchObject({ ok: true, dado: { aprovada: true } });
  expect(await decidirEquivalenciaTransferencia(entrada)).toEqual(decisao);
  expect(await decidirEquivalenciaTransferencia({ ...entrada, motivo: "Tentativa de reescrever histórico" })).toMatchObject({ ok: false });
  expect(await prisma.decisaoEquivalenciaAvaliacao.count({ where: { propostaId: proposta.propostaId } })).toBe(1);
});

it("recusa aprovação com estado alterado, mas preserva rejeição histórica", async () => {
  const proposta = await prepararProposta("equivalencia-decisao-obsoleta");
  await prisma.turma.update({ where: { id: turmaDestinoId }, data: { nome: "Destino alterado após revisão" } });
  entrar(decisorId);
  const aprovar = { propostaId: proposta.propostaId, estadoHash: proposta.estadoHash, aprovar: true, motivo: "Aprovação com estado vencido" };
  expect(await decidirEquivalenciaTransferencia(aprovar)).toMatchObject({ ok: false });
  const rejeitar = { ...aprovar, aprovar: false, motivo: "Estado mudou antes da aprovação" };
  const decisao = await decidirEquivalenciaTransferencia(rejeitar);
  expect(decisao, JSON.stringify(decisao)).toMatchObject({ ok: true, dado: { aprovada: false } });
  expect(await decidirEquivalenciaTransferencia(rejeitar)).toEqual(decisao);
  expect(await prisma.decisaoEquivalenciaAvaliacao.findUniqueOrThrow({ where: { propostaId: proposta.propostaId } })).toMatchObject({
    aprovada: false, decisorId,
  });
});

it("exige proponente atual para aprovar, mas ainda permite rejeitar sua proposta", async () => {
  const proposta = await prepararProposta("equivalencia-decisao-preparador-inativo");
  await prisma.usuario.update({ where: { id: preparadorId }, data: { ativo: false } });
  entrar(decisorId);
  const aprovar = { propostaId: proposta.propostaId, estadoHash: proposta.estadoHash, aprovar: true, motivo: "Aprovação requer proponente atual" };
  expect(await decidirEquivalenciaTransferencia(aprovar)).toMatchObject({ ok: false });
  expect(await decidirEquivalenciaTransferencia({ ...aprovar, aprovar: false, motivo: "Registro histórico rejeitado após inativação" })).toMatchObject({ ok: true, dado: { aprovada: false } });
});
