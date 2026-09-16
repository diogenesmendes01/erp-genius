import { beforeEach, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mocks = vi.hoisted(() => ({ authMock: vi.fn(), portalCookie: "" }));
vi.mock("@/lib/auth", () => ({ auth: mocks.authMock }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (nome: string) => nome === "portal_aluno_session" && mocks.portalCookie ? { value: mocks.portalCookie } : undefined, delete: vi.fn() }),
}));

import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HABILIDADES } from "@/server/avaliacoes/calculo";
import { confirmarFechamentoAcademico, revisarFechamentoAcademico } from "@/server/avaliacoes/fechamento";
import { carregarFrequenciaNivelTx } from "@/server/avaliacoes/frequencia-nivel-tx";
import { salvarLancamentoAvaliacao, oficializarLancamentoAvaliacao } from "@/server/avaliacoes/lancamentos";
import { decidirEquivalenciaTransferencia } from "@/server/avaliacoes/equivalencia-decisao";
import { executarEquivalenciaTransferencia } from "@/server/avaliacoes/equivalencia-execucao";
import { proporEquivalenciaTransferencia, revisarEquivalenciaTransferencia } from "@/server/avaliacoes/equivalencia-proposta";
import { decidirRegraAvaliacaoTx, prepararRegraAvaliacaoTx } from "@/server/avaliacoes/regras-tx";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { consultarFechamentosPortalAluno } from "./fechamentos";
import { criarSessaoPortalAlunoTx } from "./sessao";

let professorId: string;
let gestorId: string;
let administradorId: string;
let secretariaId: string;
let alunoId: string;
let matriculaId: string;
let nivelId: string;
let turmaAId: string;
let turmaBId: string;
let alocacaoAId: string;
let contaPortalId: string;

const inicio = new Date("2026-01-01T00:00:00.000Z");
const entrar = (id: string) => mocks.authMock.mockResolvedValue({ user: { id } });

function assertOk<T extends { ok: boolean; dado?: unknown }>(resultado: T): asserts resultado is T & { ok: true; dado: NonNullable<T["dado"]> } {
  expect(resultado, JSON.stringify(resultado)).toMatchObject({ ok: true });
  if (!resultado.ok || resultado.dado === undefined || resultado.dado === null) throw new Error(JSON.stringify(resultado));
}

async function registrarPresenca(turmaId: string, alocacaoId: string, chave: string, instante: Date) {
  const encontro = await prisma.encontroAgenda.create({ data: {
    turmaId, professorId, preparadorId: gestorId, inicio: instante, fim: new Date(instante.getTime() + 1),
    fusoOrigem: "UTC", status: "PREVISTO", finalidade: "AULA", motivo: "Aula conferida na trajetória A para B.", chaveIdempotencia: chave, entradaHash: `fixture-${chave}`,
  } });
  await prisma.aulaDiario.create({ data: {
    encontroId: encontro.id, turmaId, professorId, ocorridaEm: instante, conteudo: "Aula realizada com presença conferida.",
    registros: { create: { alunoId, matriculaId, nomeAluno: "Aluna transferida", presente: true, participacao: "PRESENTE" } },
  } });
  await prisma.encontroAgenda.update({ where: { id: encontro.id }, data: { status: "MINISTRADO" } });
  expect((await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: alocacaoId } })).matriculaId).toBe(matriculaId);
}

async function oficializar(codigoAvaliacao: "I1" | "F1", nota: string, chave: string) {
  entrar(professorId);
  const salvo = await salvarLancamentoAvaliacao({
    alocacaoId: alocacaoAId,
    codigoAvaliacao,
    realizadaEm: "2026-01-11T10:00:00.000Z",
    notas: codigoAvaliacao === "I1"
      ? [{ habilidade: "FALA", nota, comentarioAluno: "Nota oficial de fala da turma A." }]
      : HABILIDADES.map(habilidade => ({ habilidade, nota, comentarioAluno: `Nota oficial ${habilidade} da turma A.` })),
    submetida: true,
    versaoEsperada: 0,
    chaveIdempotencia: chave,
  });
  assertOk(salvo);
  const lancamento = await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: salvo.dado.id } });
  entrar(gestorId);
  assertOk(await oficializarLancamentoAvaliacao({ lancamentoId: lancamento.id, conteudoHash: lancamento.conteudoHash, aprovada: true, motivo: "Gestão conferiu a fonte oficial da turma A." }));
  return lancamento;
}

async function confirmar(alocacaoId: string, chave: string) {
  entrar(gestorId);
  const revisao = await revisarFechamentoAcademico({ alocacaoId });
  assertOk(revisao);
  const fechamento = await confirmarFechamentoAcademico({ alocacaoId, estadoHash: revisao.dado.estadoHash, versaoEsperada: revisao.dado.versaoAtual,
    motivo: "Fechamento acadêmico conferido na trajetória entre turmas do mesmo nível.", chaveIdempotencia: chave });
  assertOk(fechamento);
  return fechamento.dado;
}

async function iniciarSessaoPortal() {
  const sessao = await prisma.$transaction(tx => criarSessaoPortalAlunoTx(tx, {
    contaId: contaPortalId, versaoConta: 1,
    prazos: { sessaoMinutos: 60, conviteMinutos: 60, recuperacaoMinutos: 60, validacaoEmailMinutos: 60 },
  }));
  mocks.portalCookie = sessao.segredo;
}

beforeEach(async () => {
  mocks.portalCookie = ""; mocks.authMock.mockReset();
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  professorId = (await criarUsuario([Papel.PROFESSOR], "Professor A e B")).id;
  gestorId = (await criarUsuario([Papel.GERENTE_PEDAGOGICO], "Gestão da transferência")).id;
  administradorId = (await criarUsuario([Papel.ADMINISTRADOR], "Direção da transferência")).id;
  secretariaId = (await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria da transferência")).id;
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  nivelId = nivel.id;
  const regra = await prisma.$transaction(tx => prepararRegraAvaliacaoTx(tx, gestorId, { nivelId, versaoEsperada: 0, conteudo: regraAvaliacaoTeste(),
    motivo: "Regra publicada para o fechamento após aproveitamento no mesmo nível.", chaveIdempotencia: "regra-fechamentos-transferencia" }));
  const versaoRegra = await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: regra.id } });
  await prisma.$transaction(tx => decidirRegraAvaliacaoTx(tx, administradorId, { regraId: regra.id, conteudoHash: versaoRegra.conteudoHash, aprovada: true, motivo: "Direção publica a regra da trajetória A para B." }));
  const criarTurma = async (nome: string, status: "ABERTA" | "EM_ANDAMENTO") => {
    // A trigger vincula a regra vigente quando a turma ainda está no futuro;
    // só então a fixture torna a turma disponível no calendário histórico.
    const turma = await prisma.turma.create({ data: { nome, modalidadeId: catalogo.modalidade.id, nivelId, professorId, dataInicio: new Date("2099-01-01T00:00:00.000Z"), capacidade: 10, vinculosDocentes: { create: { professorId, inicio } } } });
    await prisma.turma.update({ where: { id: turma.id }, data: { status, dataInicio: inicio } });
    return turma.id;
  };
  turmaAId = await criarTurma("Turma A origem", "EM_ANDAMENTO");
  turmaBId = await criarTurma("Turma B destino", "ABERTA");
  alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Aluna transferida", paisId: catalogo.pais.id, email: "transferida@portal.test" } })).id;
  matriculaId = (await prisma.matricula.create({ data: { alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", codigo: "M-TRAJ-A-B", status: "ATIVA", ativadaEm: inicio } })).id;
  alocacaoAId = (await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId, turmaId: turmaAId, criadoEm: inicio } })).id;
  contaPortalId = (await prisma.contaPortalAluno.create({ data: { alunoId, emailVerificado: "transferida@portal.test", emailVerificadoEm: new Date(), senhaHash: "hash-servidor", ativa: true } })).id;
  await iniciarSessaoPortal();
});

it("agrega frequência A→B no mesmo nível e exige nova versão de fechamento após a transferência", async () => {
  await registrarPresenca(turmaAId, alocacaoAId, "fechamentos-transferencia-presenca-a", new Date("2026-01-10T10:00:00.000Z"));
  const intermediaria = await oficializar("I1", "8", "fechamentos-transferencia-i1");
  const final = await oficializar("F1", "8", "fechamentos-transferencia-f1");
  const fechamentoA = await confirmar(alocacaoAId, "fechamentos-transferencia-a-v1");
  expect(fechamentoA).toMatchObject({ versao: 1, resultadoSuficiente: true });

  entrar(gestorId);
  const base = {
    matriculaId, alocacaoOrigemId: alocacaoAId, turmaDestinoId: turmaBId,
    mapeamentos: [
      { referenciaFonteId: `${intermediaria.id}:FALA`, codigoAvaliacaoDestino: "I1", habilidadeDestino: "FALA" as const },
      ...HABILIDADES.map(habilidade => ({ referenciaFonteId: `${final.id}:${habilidade}`, codigoAvaliacaoDestino: "F1", habilidadeDestino: habilidade })),
    ],
  };
  const revisaoEquivalencia = await revisarEquivalenciaTransferencia(base);
  assertOk(revisaoEquivalencia);
  const proposta = await proporEquivalenciaTransferencia({ ...base, estadoHash: revisaoEquivalencia.dado.estadoHash, versaoEsperada: revisaoEquivalencia.dado.versaoAtual,
    motivo: "Aproveitamento integral aprovado entre turmas do mesmo nível.", chaveIdempotencia: "fechamentos-transferencia-equivalencia" });
  assertOk(proposta);
  entrar(administradorId);
  const decisao = await decidirEquivalenciaTransferencia({ propostaId: proposta.dado.id, estadoHash: revisaoEquivalencia.dado.estadoHash, aprovar: true, motivo: "Direção aprova aproveitamento independente da turma A." });
  assertOk(decisao);
  entrar(secretariaId);
  const executada = await executarEquivalenciaTransferencia({ decisaoId: decisao.dado.id, motivo: "Secretaria executa transferência para a turma B.", horarioCompativel: true });
  assertOk(executada);
  const alocacaoBId = executada.dado.alocacaoDestinoId;

  await new Promise(resolve => setTimeout(resolve, 30));
  const agora = new Date();
  await registrarPresenca(turmaBId, alocacaoBId, "fechamentos-transferencia-presenca-b", new Date(agora.getTime() - 10));
  const antesDoNovoFechamento = await consultarFechamentosPortalAluno();
  expect(antesDoNovoFechamento).toEqual([expect.objectContaining({ matriculaId, nivelId, estado: "EM_REVISAO", versao: 1, resumo: null })]);

  const frequencia = await prisma.$transaction(tx => carregarFrequenciaNivelTx(tx, { matriculaId, nivelId, minimoPercentual: "75" }));
  expect(frequencia).toMatchObject({ base: 2, presencas: 2, faltas: 0, regularizadas: 0, percentual: { numerador: "200", denominador: "2" }, alocacoesIds: [alocacaoAId, alocacaoBId] });
  const fechamentoB = await confirmar(alocacaoBId, "fechamentos-transferencia-b-v2");
  expect(fechamentoB).toMatchObject({ versao: 2, resultadoSuficiente: true });
  const atual = await consultarFechamentosPortalAluno();
  expect(atual).toEqual([expect.objectContaining({
    matriculaId, nivelId, estado: "CONFIRMADO_SUFICIENTE", versao: 2,
    resumo: expect.objectContaining({ frequencia: expect.objectContaining({ base: 2, presencas: 2, faltas: 0, percentual: { numerador: "200", denominador: "2" } }) }),
  })]);
});
