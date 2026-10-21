import { beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { salvarDiarioParticular } from "@/server/diario/particular";
import { listarChamadaEncontro } from "@/server/diario/chamada-encontro";
import { registrarOcorrenciaParticular, consultarOcorrenciasParticular } from "@/server/matricula/ocorrencia-particular";
import { consultarOcorrenciasFinanceiras } from "@/server/matricula/ocorrencia-financeira-consulta";
import { proporCancelamentoParticular } from "./cancelamento-particular";
import { carregarImpactosAcademicosEncerramentoTx } from "@/server/matricula/encerramento-impactos-academicos";
import { conferirAgendaEncerramentoTx } from "@/server/matricula/encerramento-agenda";

let professorId: string, gestorId: string, financeiroId: string, matriculaId: string, alunoId: string;
const inicio = new Date("2026-01-10T10:00:00Z"), fim = new Date("2026-01-10T11:00:00Z");
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
beforeEach(async () => {
  await truncarBanco(); const c = await seedCatalogoMinimo();
  professorId = (await criarUsuario(["PROFESSOR"])).id; gestorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id; financeiroId = (await criarUsuario(["FINANCEIRO"])).id;
  alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Aluno teste finalidade", paisId: c.pais.id } })).id;
  matriculaId = (await prisma.matricula.create({ data: { alunoId, produtoId: c.produto.id, paisId: c.pais.id, moeda: "CRC", status: "ATIVA" } })).id;
  entrar(professorId);
});
const encontro = (chave: string) => ({ matriculaId, professorId, preparadorId: gestorId, inicio, fim, fusoOrigem: "UTC", motivo: "Encontro de teste de finalidade", chaveIdempotencia: chave, entradaHash: "fixture" });

it("preserva aulas existentes e impede trocar finalidade ou publicar recuperação sem aprovação própria", async () => {
  const aula = await prisma.encontroAgenda.create({ data: { ...encontro("aula-original"), status: "PREVISTO" } });
  expect(aula.finalidade).toBe("AULA");
  await expect(prisma.encontroAgenda.update({ where: { id: aula.id }, data: { finalidade: "RECUPERACAO", status: "RASCUNHO" } })).rejects.toThrow("imutável");
  const recuperacao = await prisma.encontroAgenda.create({ data: { ...encontro("rascunho-recuperacao"), finalidade: "RECUPERACAO" } });
  await expect(prisma.encontroAgenda.update({ where: { id: recuperacao.id }, data: { status: "PREVISTO" } })).rejects.toThrow("fluxo específico");
  await expect(prisma.encontroAgenda.create({ data: { ...encontro("publicacao-recuperacao"), finalidade: "RECUPERACAO", status: "MINISTRADO" } })).rejects.toThrow("fluxo específico");
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: aula.id } })).toEqual(aula);
});

it("recuperação não entra em chamada, diário ou ocorrência financeira pelas ações e pelo SQL", async () => {
  const e = await prisma.encontroAgenda.create({ data: { ...encontro("recuperacao-diario"), finalidade: "RECUPERACAO" } });
  expect((await listarChamadaEncontro({ encontroId: e.id })).ok).toBe(false);
  expect((await salvarDiarioParticular({ encontroId: e.id, ocorridaEm: inicio.toISOString(), conteudo: "Avaliação não é aula ministrada", registros: [{ alunoId, presente: true }] })).ok).toBe(false);
  expect(await consultarOcorrenciasParticular({ encontroId: e.id })).toMatchObject({ ok: true, dado: null });
  expect((await registrarOcorrenciaParticular({ encontroId: e.id, versaoAnterior: 0, tipo: "REALIZADA", evidencia: "Avaliação não gera cobrança de particular", chaveIdempotencia: "ocorrencia-nao-aula" })).ok).toBe(false);
  await expect(prisma.aulaDiario.create({ data: { encontroId: e.id, professorId, ocorridaEm: inicio, conteudo: "Tentativa direta de diário indevido" } })).rejects.toThrow("Operação exige encontro de aula");
  await expect(prisma.ocorrenciaParticular.create({ data: { encontroId: e.id, matriculaId, autorId: professorId, versao: 1, inicio, fim, tipo: "REALIZADA", evidencia: "Tentativa direta de ocorrência indevida", chaveIdempotencia: "ocorrencia-direta-nao-aula", entradaHash: "fixture" } })).rejects.toThrow("Operação exige encontro de aula");
  entrar(gestorId);
  expect((await proporCancelamentoParticular({ encontroId: e.id, motivo: "Não usar cancelamento de aula", chaveIdempotencia: "cancelamento-nao-aula" })).ok).toBe(false);
  await expect(prisma.propostaCancelamentoParticular.create({ data: { encontroId: e.id, preparadorId: gestorId, motivo: "Não usar fluxo de particular", chaveIdempotencia: "cancelamento-direto-nao-aula", entradaHash: "fixture", estado: "fixture" } })).rejects.toThrow("Operação exige encontro de aula");
  expect(await prisma.aulaDiario.count()).toBe(0); expect(await prisma.ocorrenciaParticular.count()).toBe(0);
  expect(await prisma.cobranca.count()).toBe(0); expect(await prisma.consumoHorasCompradas.count()).toBe(0);
});

it("financeiro lista somente aulas da contratação e recusa cursor de recuperação", async () => {
  const aula = await prisma.encontroAgenda.create({ data: encontro("aula-fila-financeira") });
  const r = await prisma.encontroAgenda.create({ data: { ...encontro("recuperacao-fila-financeira"), finalidade: "RECUPERACAO" } });
  entrar(financeiroId);
  expect(await consultarOcorrenciasFinanceiras({ matriculaId })).toMatchObject({ ok: true, dado: { encontros: [{ id: aula.id }] } });
  expect((await consultarOcorrenciasFinanceiras({ matriculaId, cursor: r.id })).ok).toBe(false);
});

it("encerramento separa recuperação das horas contratadas sem alterar origens antigas", async () => {
  const aula = await prisma.encontroAgenda.create({ data: encontro("aula-impactos-encerramento") });
  const antes = await prisma.$transaction(tx => carregarImpactosAcademicosEncerramentoTx(tx, alunoId, matriculaId));
  expect(antes).not.toHaveProperty("encontrosRecuperacao");
  const recuperacao = await prisma.encontroAgenda.create({ data: { ...encontro("recuperacao-impactos-encerramento"), finalidade: "RECUPERACAO" } });
  const impactos = await prisma.$transaction(tx => carregarImpactosAcademicosEncerramentoTx(tx, alunoId, matriculaId));
  expect(impactos.encontrosParticulares).toEqual(antes.encontrosParticulares);
  expect(impactos.encontrosParticulares.map(e => e.id)).toEqual([aula.id]);
  expect(impactos.encontrosRecuperacao).toEqual([{ id: recuperacao.id, inicio: inicio.toISOString(), fim: fim.toISOString(), status: "RASCUNHO", professorId, fusoOrigem: "UTC" }]);
  const rascunho = await prisma.$transaction(tx => conferirAgendaEncerramentoTx(tx, impactos, "2026-01-09", "UTC", false));
  expect(rascunho).toMatchObject({ encontrosARegularizar: [], destinacoesHoras: [], pendencias: [] });
  // Exercita a futura origem publicada na conferência, sem publicar ou contornar
  // a proteção SQL que ainda exige implementar a aprovação de recuperação.
  const origemPublicada = { ...impactos, regimeCobranca: "HORA_PARTICULAR" as const, encontrosRecuperacao: impactos.encontrosRecuperacao!.map(e => ({ ...e, status: "PREVISTO" as const })) };
  const revista = await prisma.$transaction(tx => conferirAgendaEncerramentoTx(tx, origemPublicada, "2026-01-09", "UTC", false));
  expect(revista).toMatchObject({ encontrosARegularizar: [], destinacoesHoras: [], recuperacoesARegularizar: [recuperacao.id], pendencias: [expect.stringContaining("autorização acadêmica específica")] });
  expect(revista.pendencias.join(" ")).not.toContain("sem destinação financeira");
  expect((await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: recuperacao.id } })).status).toBe("RASCUNHO");
  expect(await prisma.cobranca.count()).toBe(0);
});
