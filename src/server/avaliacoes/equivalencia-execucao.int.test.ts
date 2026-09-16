import { beforeEach, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
// O teste concorrente exercita as transações reais. Resolve a identidade sem
// imports dinâmicos simultâneos do NextAuth pelo runner; preserva papel/ativo.
vi.mock("@/server/_shared", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/_shared")>();
  return { ...real, exigirSessaoComPapel: async (...papeis: import("@prisma/client").Papel[]) => {
    const sessao = await authMock();
    const atual = await prisma.usuario.findUnique({ where: { id: sessao.user.id }, select: { id: true, nome: true, ativo: true, papeis: true } });
    if (!atual?.ativo) throw new real.ErroPermissao();
    real.exigirPapel(atual, ...papeis);
    return atual;
  } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import { decidirEquivalenciaTransferencia } from "./equivalencia-decisao";
import { executarEquivalenciaTransferencia } from "./equivalencia-execucao";
import { proporEquivalenciaTransferencia, revisarEquivalenciaTransferencia } from "./equivalencia-proposta";
import { decidirRegraAvaliacaoTx, prepararRegraAvaliacaoTx } from "./regras-tx";

let gestorId: string;
let aprovadorId: string;
let secretariaId: string;
let alunoId: string;
let matriculaId: string;
let alocacaoOrigemId: string;
let turmaOrigemId: string;
let turmaDestinoId: string;

const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

async function prepararDecisao(chave: string) {
  entrar(gestorId);
  const base = { matriculaId, alocacaoOrigemId, turmaDestinoId, mapeamentos: [] };
  const revisao = await revisarEquivalenciaTransferencia(base);
  expect(revisao.ok, JSON.stringify(revisao)).toBe(true);
  if (!revisao.ok || !revisao.dado) throw new Error("Prévia de equivalência ausente.");
  const proposta = await proporEquivalenciaTransferencia({
    ...base, estadoHash: revisao.dado.estadoHash, versaoEsperada: revisao.dado.versaoAtual,
    motivo: "Aproveitamento aprovado para transferência equivalente.", chaveIdempotencia: chave,
  });
  expect(proposta.ok, JSON.stringify(proposta)).toBe(true);
  if (!proposta.ok || !proposta.dado) throw new Error("Proposta de equivalência ausente.");
  entrar(aprovadorId);
  const decisao = await decidirEquivalenciaTransferencia({
    propostaId: proposta.dado.id, estadoHash: revisao.dado.estadoHash, aprovar: true,
    motivo: "Decisão independente para a equivalência.",
  });
  expect(decisao.ok, JSON.stringify(decisao)).toBe(true);
  if (!decisao.ok || !decisao.dado) throw new Error("Decisão de equivalência ausente.");
  return decisao.dado.id;
}

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  gestorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  aprovadorId = (await criarUsuario(["ADMINISTRADOR"])).id;
  secretariaId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  const professorId = (await criarUsuario(["PROFESSOR"])).id;
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  const regra = await prisma.$transaction((tx) => prepararRegraAvaliacaoTx(tx, gestorId, {
    nivelId: nivel.id, versaoEsperada: 0, conteudo: regraAvaliacaoTeste(),
    motivo: "Regra de equivalência para execução.", chaveIdempotencia: "regra-equivalencia-execucao",
  }));
  const versao = await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: regra.id } });
  await prisma.$transaction((tx) => decidirRegraAvaliacaoTx(tx, aprovadorId, {
    regraId: versao.id, conteudoHash: versao.conteudoHash, aprovada: true,
    motivo: "Publicação independente da regra para execução.",
  }));
  const origem = await prisma.turma.create({ data: {
    modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId,
    dataInicio: new Date("2099-01-01T00:00:00.000Z"),
    vinculosDocentes: { create: { professorId, inicio: new Date("2026-01-01T00:00:00.000Z") } },
  } });
  await prisma.turma.update({ where: { id: origem.id }, data: { status: "EM_ANDAMENTO", dataInicio: new Date("2026-01-01T00:00:00.000Z") } });
  turmaOrigemId = origem.id;
  turmaDestinoId = (await prisma.turma.create({ data: {
    modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId,
    dataInicio: new Date("2099-01-01T00:00:00.000Z"), status: "ABERTA", capacidade: 10,
  } })).id;
  alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Aluna equivalência", paisId: catalogo.pais.id } })).id;
  matriculaId = (await prisma.matricula.create({ data: {
    alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA",
    ativadaEm: new Date("2026-01-01T00:00:00.000Z"),
  } })).id;
  alocacaoOrigemId = (await prisma.alocacaoTurma.create({ data: {
    alunoId, matriculaId, turmaId: turmaOrigemId, criadoEm: new Date("2026-01-01T00:00:00.000Z"),
  } })).id;
});

it("efetiva uma única decisão aprovada com vínculos cronológicos, aplicação e eventos", async () => {
  const decisaoId = await prepararDecisao("equivalencia-execucao-positiva");
  entrar(secretariaId);
  const executar = () => executarEquivalenciaTransferencia({
    decisaoId, motivo: "Secretaria executou a decisão de equivalência.", horarioCompativel: true,
  });
  const [executada, simultanea] = await Promise.all([executar(), executar()]);
  expect(executada.ok, JSON.stringify(executada)).toBe(true);
  expect(simultanea).toEqual(executada);
  if (!executada.ok || !executada.dado) throw new Error("Aplicação ausente.");
  const aplicacao = await prisma.aplicacaoEquivalenciaAvaliacao.findUniqueOrThrow({
    where: { decisaoId }, include: { alocacaoOrigem: true, alocacaoDestino: true, movimentacao: true },
  });
  expect(aplicacao).toMatchObject({
    id: executada.dado.aplicacaoId, matriculaId, alocacaoOrigemId, turmaOrigemId, turmaDestinoId,
    aplicadoPorId: secretariaId, alocacaoOrigem: { ativa: false }, alocacaoDestino: { ativa: true, turmaId: turmaDestinoId },
    movimentacao: { tipo: "TROCA_TURMA", alunoId, matriculaId, usuarioId: secretariaId },
  });
  expect(aplicacao.alocacaoOrigem.encerradaEm?.getTime()).toBe(aplicacao.alocacaoDestino.criadoEm.getTime());
  expect(await prisma.evento.count({ where: { agregadoId: matriculaId, tipo: "EquivalenciaAvaliacaoAplicada" } })).toBe(1);
  expect(await prisma.evento.count({ where: { agregadoId: alunoId, tipo: "TrocaTurma" } })).toBe(1);

  const repetida = await executarEquivalenciaTransferencia({
    decisaoId, motivo: "Reenvio não deve duplicar a aplicação.", horarioCompativel: true,
  });
  expect(repetida).toEqual({ ok: true, dado: executada.dado });
  expect(await prisma.aplicacaoEquivalenciaAvaliacao.count({ where: { decisaoId } })).toBe(1);
  expect(await prisma.alocacaoTurma.count({ where: { matriculaId, turmaId: turmaDestinoId, ativa: true } })).toBe(1);
});

it("recusa uma decisão aprovada quando o destino mudou depois do snapshot", async () => {
  const decisaoId = await prepararDecisao("equivalencia-execucao-desatualizada");
  await prisma.turma.update({ where: { id: turmaDestinoId }, data: { capacidade: 11 } });
  entrar(secretariaId);
  expect(await executarEquivalenciaTransferencia({
    decisaoId, motivo: "Não execute snapshot alterado.", horarioCompativel: true,
  })).toMatchObject({ ok: false, erro: expect.stringContaining("mudaram") });
  expect(await prisma.aplicacaoEquivalenciaAvaliacao.count()).toBe(0);
  expect(await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: alocacaoOrigemId }, select: { ativa: true } })).toEqual({ ativa: true });
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
