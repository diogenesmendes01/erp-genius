import { beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { registrarRelatoIndisponibilidadeOferta, consultarRelatosIndisponibilidadeOferta } from "./indisponibilidade-oferta-relato";
import { confirmarRelatoIndisponibilidadeOferta } from "./indisponibilidade-oferta-confirmacao";
import { conferirIndisponibilidadeOfertaTx } from "./indisponibilidade-oferta-estado";
import * as sessao from "@/server/_shared/sessao";

let matriculaId: string, autorId: string;
const entrada = () => ({ matriculaId, inicio: "2026-10-01", fim: null, motivo: "Não há turma para continuidade", evidenciaTexto: "Equipe constatou indisponibilidade do próximo nível", chaveIdempotencia: "relato-oferta-caso-1" });
beforeEach(async () => {
  await truncarBanco();
  const c = await seedCatalogoMinimo();
  autorId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  const a = await prisma.aluno.create({ data: { primeiroNome: "Oferta", paisId: c.pais.id } });
  matriculaId = (await prisma.matricula.create({ data: { alunoId: a.id, paisId: c.pais.id, produtoId: c.produto.id, moeda: "CRC" } })).id;
  authMock.mockResolvedValue({ user: { id: autorId } });
});

it("registra relato aberto uma única vez sem alterar matrícula ou cobrança", async () => {
  const antes = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const criado = await registrarRelatoIndisponibilidadeOferta(entrada());
  expect(criado, JSON.stringify(criado)).toMatchObject({ ok: true });
  expect(await registrarRelatoIndisponibilidadeOferta(entrada())).toEqual(criado);
  expect(await registrarRelatoIndisponibilidadeOferta({ ...entrada(), motivo: "Outro motivo para mesma operação" })).toMatchObject({ ok: false });
  expect(await prisma.registroIndisponibilidadeOfertaMatricula.count()).toBe(1);
  expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toEqual(antes);
  expect(await prisma.cobranca.count()).toBe(0);
  await expect(prisma.registroIndisponibilidadeOfertaMatricula.updateMany({ data: { fim: new Date("2026-10-31") } })).rejects.toThrow();
  await expect(prisma.registroIndisponibilidadeOfertaMatricula.deleteMany()).rejects.toThrow();
});

it("preserva um dia de indisponibilidade e recusa intervalo invertido ou autor revogado", async () => {
  expect(await registrarRelatoIndisponibilidadeOferta({ ...entrada(), fim: "2026-09-30" })).toMatchObject({ ok: false });
  expect(await registrarRelatoIndisponibilidadeOferta({ ...entrada(), fim: "2026-10-01" })).toMatchObject({ ok: true });
  await prisma.usuario.update({ where: { id: autorId }, data: { ativo: false } });
  expect(await registrarRelatoIndisponibilidadeOferta({ ...entrada(), chaveIdempotencia: "outro-relato-oferta" })).toMatchObject({ ok: false });
});

it("Financeiro consulta sem registrar e professor não acessa estes relatos", async () => {
  expect(await registrarRelatoIndisponibilidadeOferta(entrada())).toMatchObject({ ok: true });
  authMock.mockResolvedValue({ user: { id: (await criarUsuario(["FINANCEIRO"])).id } });
  expect(await consultarRelatosIndisponibilidadeOferta({ matriculaId })).toMatchObject({ ok: true, dado: { podeRegistrar: false } });
  expect(await registrarRelatoIndisponibilidadeOferta({ ...entrada(), chaveIdempotencia: "financeiro-relato" })).toMatchObject({ ok: false });
  authMock.mockResolvedValue({ user: { id: (await criarUsuario(["PROFESSOR"])).id } });
  expect(await consultarRelatosIndisponibilidadeOferta({ matriculaId })).toMatchObject({ ok: false });
});

it("confirma por outra pessoa, preserva decisão e não altera cobranças", async () => {
  expect(await registrarRelatoIndisponibilidadeOferta(entrada())).toMatchObject({ ok: true });
  const relato = await prisma.registroIndisponibilidadeOfertaMatricula.findFirstOrThrow();
  const d = { registroId: relato.id, confirmada: true, motivo: "Conferência pedagógica realizada", evidenciaTexto: "Oferta não disponível no intervalo informado" };
  await prisma.usuario.update({ where: { id: autorId }, data: { papeis: ["SECRETARIA_ACADEMICA", "ADMINISTRADOR"] } });
  expect(await confirmarRelatoIndisponibilidadeOferta(d)).toMatchObject({ ok: false });
  await expect(prisma.confirmacaoIndisponibilidadeOfertaMatricula.create({ data: { ...d, confirmadorId: autorId, entradaHash: "a".repeat(64) } })).rejects.toThrow();
  const gestor = await criarUsuario(["GERENTE_PEDAGOGICO"]);
  authMock.mockResolvedValue({ user: { id: gestor.id } });
  const confirmado = await confirmarRelatoIndisponibilidadeOferta(d);
  expect(confirmado, JSON.stringify(confirmado)).toMatchObject({ ok: true });
  expect(await confirmarRelatoIndisponibilidadeOferta(d)).toEqual(confirmado);
  expect(await confirmarRelatoIndisponibilidadeOferta({ ...d, confirmada: false })).toMatchObject({ ok: false });
  await expect(prisma.confirmacaoIndisponibilidadeOfertaMatricula.updateMany({ data: { confirmada: false } })).rejects.toThrow();
  await expect(prisma.confirmacaoIndisponibilidadeOfertaMatricula.deleteMany()).rejects.toThrow();
  expect(await prisma.cobranca.count()).toBe(0);
});

it("Financeiro não confirma e revogação do papel impede confirmar", async () => {
  await registrarRelatoIndisponibilidadeOferta(entrada());
  const relato = await prisma.registroIndisponibilidadeOfertaMatricula.findFirstOrThrow();
  const d = { registroId: relato.id, confirmada: false, motivo: "Relato não foi comprovado", evidenciaTexto: "Há oferta registrada para o intervalo" };
  const financeiro = await criarUsuario(["FINANCEIRO"]);
  authMock.mockResolvedValue({ user: { id: financeiro.id } });
  expect(await confirmarRelatoIndisponibilidadeOferta(d)).toMatchObject({ ok: false });
  const gestor = await criarUsuario(["GERENTE_PEDAGOGICO"]);
  authMock.mockResolvedValue({ user: { id: gestor.id } });
  await prisma.usuario.update({ where: { id: gestor.id }, data: { ativo: false } });
  expect(await confirmarRelatoIndisponibilidadeOferta(d)).toMatchObject({ ok: false });
  expect(await prisma.confirmacaoIndisponibilidadeOfertaMatricula.count()).toBe(0);
});

it("serializa confirmações concorrentes sem duplicar decisão ou evento", async () => {
  await registrarRelatoIndisponibilidadeOferta(entrada());
  const relato = await prisma.registroIndisponibilidadeOfertaMatricula.findFirstOrThrow();
  const gestor = await criarUsuario(["GERENTE_PEDAGOGICO"]);
  authMock.mockResolvedValue({ user: { id: gestor.id } });
  const decisao = { registroId: relato.id, confirmada: true, motivo: "Oferta indisponível verificada", evidenciaTexto: "Gestão conferiu a ausência de turma compatível" };
  // O import dinâmico de NextAuth no runner não suporta duas resoluções mockadas
  // simultâneas. Fixar somente a sessão aqui mantém transações e guard fresco reais.
  const autenticacao = vi.spyOn(sessao, "exigirSessaoComPapel").mockResolvedValue({ id: gestor.id, nome: gestor.nome, papeis: gestor.papeis });
  try {
    const [primeira, repetida] = await Promise.all([
      confirmarRelatoIndisponibilidadeOferta(decisao), confirmarRelatoIndisponibilidadeOferta(decisao),
    ]);
    expect(primeira).toMatchObject({ ok: true });
    expect(repetida, JSON.stringify(repetida)).toEqual(primeira);
  } finally {
    autenticacao.mockRestore();
  }
  expect(await prisma.confirmacaoIndisponibilidadeOfertaMatricula.count()).toBe(1);
  expect(await prisma.evento.count({ where: { agregadoId: matriculaId, tipo: "RelatoIndisponibilidadeOfertaConfirmado" } })).toBe(1);
  expect(await prisma.cobranca.count()).toBe(0);
});

it("considera somente intervalos sobrepostos e não deixa recusa como pendência", async () => {
  await registrarRelatoIndisponibilidadeOferta({ ...entrada(), fim: "2026-10-01" });
  const relato = await prisma.registroIndisponibilidadeOfertaMatricula.findFirstOrThrow();
  const estado = (id: string, dia: string) => prisma.$transaction(tx => conferirIndisponibilidadeOfertaTx(tx, { matriculaId: id, inicio: new Date(dia), fim: new Date(dia) }));
  expect(await estado(matriculaId, "2026-10-01")).toMatchObject({ estado: "PENDENTE_CONFERENCIA" });
  expect(await estado(matriculaId, "2026-10-02")).toMatchObject({ estado: "SEM_RELATO" });
  const origem = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const outra = await prisma.matricula.create({ data: { alunoId: origem.alunoId, paisId: origem.paisId, produtoId: origem.produtoId, moeda: origem.moeda } });
  expect(await estado(outra.id, "2026-10-01")).toMatchObject({ estado: "SEM_RELATO" });
  authMock.mockResolvedValue({ user: { id: (await criarUsuario(["ADMINISTRADOR"])).id } });
  expect(await confirmarRelatoIndisponibilidadeOferta({ registroId: relato.id, confirmada: false,
    motivo: "A falta de oferta não foi comprovada", evidenciaTexto: "A gestão verificou o relato e não confirmou" })).toMatchObject({ ok: true });
  expect(await estado(matriculaId, "2026-10-01")).toMatchObject({ estado: "SEM_RELATO", registros: [] });
});
