import { beforeEach, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { instanteUtcSql } from "./segunda-chamada-utc";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import { decidirRegraAvaliacaoTx, prepararRegraAvaliacaoTx } from "./regras-tx";
import { autorizarRealizacaoEspecialSegundaChamada } from "./segunda-chamada-autorizacao-especial";
import { solicitarPausaMatriculas, decidirPropostaPausaMatriculas } from "@/server/matricula/pausa-proposta";
import { aplicarPausaMatriculasTx } from "@/server/matricula/pausa-execucao";
import { solicitarRetomadaMatriculas, decidirRetomadaMatriculas } from "@/server/matricula/retomada-proposta";
import { aplicarRetomadaMatriculasTx } from "@/server/matricula/retomada-execucao";

let administrador: string, financeiro: string, gestor: string, alunoId: string, matriculaId: string, alocacaoId: string;
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const dia = (data: Date, soma: number) => new Date(data.getTime() + soma * 86_400_000).toISOString().slice(0, 10);

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  administrador = (await criarUsuario(["ADMINISTRADOR"])).id;
  financeiro = (await criarUsuario(["FINANCEIRO"])).id;
  gestor = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  const professor = (await criarUsuario(["PROFESSOR"])).id;
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "UTC" } });
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  const regra = await prisma.$transaction((tx) => prepararRegraAvaliacaoTx(tx, gestor, {
    nivelId: nivel.id, versaoEsperada: 0, conteudo: regraAvaliacaoTeste(), motivo: "Regra para intervalo contratual", chaveIdempotencia: "regra-intervalo-contratual",
  }));
  const versao = await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: regra.id } });
  await prisma.$transaction((tx) => decidirRegraAvaliacaoTx(tx, administrador, {
    regraId: versao.id, conteudoHash: versao.conteudoHash, aprovada: true, motivo: "Publicação independente da regra",
  }));
  const turma = await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: professor, dataInicio: new Date(Date.now() + 86400000) } });
  await prisma.turma.update({ where: { id: turma.id }, data: { status: "EM_ANDAMENTO", dataInicio: new Date("2026-01-01T00:00:00Z") } });
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno intervalo", paisId: catalogo.pais.id } });
  alunoId = aluno.id;
  const matricula = await prisma.matricula.create({ data: {
    alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA", ativadaEm: new Date("2026-01-01T00:00:00Z"), referenciaCobertura: "MES_CIVIL",
  } });
  matriculaId = matricula.id;
  alocacaoId = (await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId, turmaId: turma.id, criadoEm: new Date("2026-01-01T00:00:00Z") } })).id;
});

async function pausaERetomadaFuturas(base: Date, comAutorizacao: boolean) {
  const pausaEm = dia(base, 1), retornoEm = dia(base, 2);
  entrar(administrador);
  const pausa = await solicitarPausaMatriculas(alunoId, { matriculaIds: [matriculaId], dataEfetiva: pausaEm, motivo: "Pausa planejada dentro do intervalo de segunda chamada", chaveIdempotencia: "pausa-intervalo-interno" });
  if (!pausa.ok || !pausa.dado) throw new Error(JSON.stringify(pausa));
  entrar(financeiro);
  expect(await decidirPropostaPausaMatriculas(pausa.dado.propostaId, { aprovar: true, motivo: "Pausa conferida por pessoa independente" })).toMatchObject({ ok: true });
  await prisma.$transaction((tx) => aplicarPausaMatriculasTx(tx, pausa.dado!.propostaId, administrador, new Date(`${pausaEm}T12:00:00Z`)));

  if (comAutorizacao) {
    entrar(gestor);
    const autorizacao = await autorizarRealizacaoEspecialSegundaChamada({
      alocacaoId, codigoAvaliacao: "I1", prazoAte: new Date(`${dia(base, 3)}T12:00:00Z`).toISOString(),
      motivo: "Autorização cobre a pausa interna e preserva as bordas ativas", chaveIdempotencia: "autorizacao-intervalo-interno",
    });
    expect(autorizacao, JSON.stringify(autorizacao)).toMatchObject({ ok: true });
  }

  entrar(administrador);
  const retomada = await solicitarRetomadaMatriculas(alunoId, { retorno: retornoEm, matriculas: [{ matriculaId, vencimentos: { opcao: "MANTER_VENCIMENTOS" } }], motivo: "Retomada posterior à pausa interna", chaveIdempotencia: "retomada-intervalo-interno" });
  if (!retomada.ok || !retomada.dado) throw new Error(JSON.stringify(retomada));
  entrar(financeiro);
  expect(await decidirRetomadaMatriculas(retomada.dado.propostaId, { aprovar: true, motivo: "Retomada conferida por pessoa independente" })).toMatchObject({ ok: true });
  await prisma.$transaction((tx) => aplicarRetomadaMatriculasTx(tx, retomada.dado!.propostaId, administrador, new Date(`${retornoEm}T12:00:00Z`)));
  return { pausaEm, retornoEm };
}

async function consultarIntervalo(base: Date) {
  const inicio = new Date(`${dia(base, 0)}T12:00:00Z`), fim = new Date(`${dia(base, 3)}T12:00:00Z`);
  const resultado = await prisma.$queryRaw<{ cobre: boolean }[]>`
    SELECT situacao_autorizacao_segunda_chamada_cobre_intervalo(${matriculaId},${alocacaoId},${"I1"},${instanteUtcSql(inicio)},${instanteUtcSql(fim)}) AS cobre
  `;
  return { inicio, fim, resultado };
}

it("nega intervalo ativo nas bordas que contém pausa interna sem autorização", async () => {
  const agora = new Date();
  const { pausaEm, retornoEm } = await pausaERetomadaFuturas(agora, false);
  const { inicio, resultado } = await consultarIntervalo(agora);

  expect(resultado).toEqual([{ cobre: false }]);
  expect(await prisma.$queryRaw<{ inicio: string; meio: string; fim: string }[]>`
    SELECT situacao_matricula_no_instante(${matriculaId},${instanteUtcSql(inicio)}) AS inicio,
      situacao_matricula_no_instante(${matriculaId},${instanteUtcSql(new Date(`${pausaEm}T12:00:00Z`))}) AS meio,
      situacao_matricula_no_instante(${matriculaId},${instanteUtcSql(new Date(`${retornoEm}T12:00:00Z`))}) AS fim
  `).toEqual([{ inicio: "ATIVA", meio: "PAUSADA", fim: "ATIVA" }]);

});

it("aceita a mesma pausa interna quando a autorização foi emitida durante a pausa", async () => {
  const agora = new Date();
  await pausaERetomadaFuturas(agora, true);
  expect((await consultarIntervalo(agora)).resultado).toEqual([{ cobre: true }]);
});
