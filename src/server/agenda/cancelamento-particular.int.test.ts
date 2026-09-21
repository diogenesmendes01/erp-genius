import { beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/server/_shared", async original => {
  const real = await original<typeof import("@/server/_shared")>();
  return { ...real, exigirSessaoComPapel: async (...papeis: import("@prisma/client").Papel[]) => {
    const session = await authMock(); const u = await prisma.usuario.findUniqueOrThrow({ where: { id: session.user.id }, select: { id: true, nome: true, papeis: true, ativo: true } });
    if (!u.ativo) throw new real.ErroPermissao(); real.exigirPapel(u, ...papeis); return u;
  } };
});
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { proporCancelamentoParticular, decidirCancelamentoParticular, consultarCancelamentoParticular } from "./cancelamento-particular";
import { consultarEncontrosDocente } from "./encontros-docente";
import { proporRemarcacaoParticular, decidirRemarcacaoParticular, consultarRemarcacoesParticular } from "./remarcacao-particular";
import { prepararCalendarioEscolar } from "./calendario";
import { decidirCalendarioEscolar } from "./calendario-decisao";
let encontroId: string, professorId: string, gestorId: string;
const login = (id: string) => authMock.mockResolvedValue({ user: { id } });
const propor = () => proporCancelamentoParticular({ encontroId, motivo: "Professor indisponível pela escola", chaveIdempotencia: "cancelamento-teste" });
beforeEach(async () => {
  await truncarBanco(); const cat = await seedCatalogoMinimo();
  professorId = (await criarUsuario(["PROFESSOR"])).id; gestorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  const a = await prisma.aluno.create({ data: { primeiroNome: "Aluno particular", paisId: cat.pais.id } });
  const m = await prisma.matricula.create({ data: { alunoId: a.id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "CRC", status: "ATIVA" } });
  const e = await prisma.encontroAgenda.create({ data: { matriculaId: m.id, professorId, preparadorId: gestorId, inicio: new Date("2099-10-10T15:00:00Z"), fim: new Date("2099-10-10T16:00:00Z"), fusoOrigem: "America/Sao_Paulo", status: "PREVISTO", motivo: "Agenda contratada", chaveIdempotencia: "encontro-cancelamento", entradaHash: "teste" } });
  encontroId = e.id; login(professorId);
});

it("solicita e aprova uma única vez, preservando agenda até decisão e sem lançar efeitos financeiros", async () => {
  const [a, b] = await Promise.all([propor(), propor()]);
  expect(a.ok, a.ok ? undefined : a.erro).toBe(true); expect(b).toEqual(a); if (!a.ok || !a.dado) throw new Error("Proposta ausente");
  expect((await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } })).status).toBe("PREVISTO");
  await prisma.usuario.update({ where: { id: professorId }, data: { papeis: ["PROFESSOR", "GERENTE_PEDAGOGICO"] } });
  const d = { propostaId: a.dado.id, aprovar: true, motivo: "Cancelamento conferido pela gestão" };
  expect(await decidirCancelamentoParticular(d)).toMatchObject({ ok: false });
  await expect(prisma.decisaoCancelamentoParticular.create({ data: { propostaId: d.propostaId, decisorId: professorId, aprovada: true, motivo: d.motivo } })).rejects.toThrow("outra pessoa");
  login(gestorId);
  const [c, r] = await Promise.all([decidirCancelamentoParticular(d), decidirCancelamentoParticular(d)]);
  expect(c.ok, c.ok ? undefined : c.erro).toBe(true); expect(r).toEqual(c);
  expect((await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } })).status).toBe("CANCELADO");
  expect(await prisma.decisaoCancelamentoParticular.count()).toBe(1);
  expect(await prisma.recebimento.count()).toBe(0); expect(await prisma.cobranca.count()).toBe(0); expect(await prisma.consumoHorasCompradas.count()).toBe(0);
  await expect(prisma.propostaCancelamentoParticular.update({ where: { id: d.propostaId }, data: { motivo: "Outro motivo" } })).rejects.toThrow("preservadas");
  await expect(prisma.decisaoCancelamentoParticular.deleteMany()).rejects.toThrow("preservadas");
  expect(await consultarCancelamentoParticular({ encontroId })).toMatchObject({ ok: true, dado: { status: "CANCELADO", podePropor: false } });
});

it("recusa estado alterado e permite rejeitar para preparar nova proposta", async () => {
  const a = await propor(); if (!a.ok || !a.dado) throw new Error("Proposta ausente");
  await prisma.encontroAgenda.update({ where: { id: encontroId }, data: { fim: new Date("2099-10-10T16:30:00Z") } });
  login(gestorId); const d = { propostaId: a.dado.id, aprovar: true, motivo: "Conferência de cancelamento" };
  expect(await decidirCancelamentoParticular(d)).toMatchObject({ ok: false, erro: expect.stringContaining("mudou") });
  expect(await prisma.decisaoCancelamentoParticular.count()).toBe(0);
  expect(await decidirCancelamentoParticular({ ...d, aprovar: false })).toMatchObject({ ok: true });
  login(professorId);
  expect(await proporCancelamentoParticular({ encontroId, motivo: "Nova conferência da agenda", chaveIdempotencia: "cancelamento-novo" })).toMatchObject({ ok: true });
});

it("limita professor ao encontro atribuído e secretaria ao preparo, inclusive após revogação", async () => {
  login((await criarUsuario(["PROFESSOR"])).id);
  expect(await consultarCancelamentoParticular({ encontroId })).toMatchObject({ ok: false });
  expect(await propor()).toMatchObject({ ok: false });
  const secretaria = await criarUsuario(["SECRETARIA_ACADEMICA"]); login(secretaria.id);
  expect(await consultarEncontrosDocente()).toMatchObject({ ok: true, dado: { encontros: [{ id: encontroId, particular: true }] } });
  const a = await propor(); expect(a.ok).toBe(true); if (!a.ok || !a.dado) throw new Error("Proposta ausente");
  expect(await decidirCancelamentoParticular({ propostaId: a.dado.id, aprovar: true, motivo: "Conferência pela secretaria" })).toMatchObject({ ok: false });
  await prisma.usuario.update({ where: { id: secretaria.id }, data: { ativo: false } });
  expect(await consultarCancelamentoParticular({ encontroId })).toMatchObject({ ok: false });
});

it("não cancela um encontro cujo diário passou a existir depois da proposta", async () => {
  const a = await propor(); if (!a.ok || !a.dado) throw new Error("Proposta ausente");
  await prisma.aulaDiario.create({ data: { encontroId, professorId, ocorridaEm: new Date("2099-10-10T15:00:00Z"), conteudo: "Registro preservado" } });
  login(gestorId);
  expect(await decidirCancelamentoParticular({ propostaId: a.dado.id, aprovar: true, motivo: "Solicitação de cancelamento" })).toMatchObject({ ok: false, erro: expect.stringContaining("diário") });
  expect((await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } })).status).toBe("PREVISTO");
  expect(await prisma.aulaDiario.count()).toBe(1);
});

async function prepararRemarcacao() {
  const cancelamento = await propor(); if (!cancelamento.ok || !cancelamento.dado) throw new Error("Cancelamento ausente");
  login(gestorId);
  expect(await decidirCancelamentoParticular({ propostaId: cancelamento.dado.id, aprovar: true, motivo: "Cancelamento confirmado pela escola" })).toMatchObject({ ok: true });
  const secretaria = await criarUsuario(["SECRETARIA_ACADEMICA"]); login(secretaria.id);
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "America/Sao_Paulo" } });
  const calendario = await prepararCalendarioEscolar({ fusoConferido: "America/Sao_Paulo", versaoAnterior: 0, motivo: "Calendário para remarcações", chaveIdempotencia: "calendario-remarcacao", periodos: [{ id: "feriado", nome: "Feriado da escola", tipo: "FERIADO", inicio: "2099-10-13", fim: "2099-10-13" }] });
  if (!calendario.ok || !calendario.dado) throw new Error("Calendário ausente");
  login(gestorId); expect(await decidirCalendarioEscolar({ calendarioId: calendario.dado.id, aprovar: true, motivo: "Calendário inicial conferido" })).toMatchObject({ ok: true });
  login(secretaria.id);
  return { secretariaId: secretaria.id, entrada: { encontroOriginalId: encontroId, professorId, data: "2099-10-12", horario: "10:00", fuso: "America/Sao_Paulo", evidenciaEscolha: "Aluno escolheu remarcação no canal institucional", motivo: "Nova data combinada com o aluno", chaveIdempotencia: "remarcacao-teste" } };
}
it("publica remarcação uma vez com aprovação independente, mantendo duração, origem e financeiro", async () => {
  const { entrada, secretariaId } = await prepararRemarcacao();
  const [a, b] = await Promise.all([proporRemarcacaoParticular(entrada), proporRemarcacaoParticular(entrada)]);
  expect(a.ok, a.ok ? undefined : a.erro).toBe(true); expect(b).toEqual(a); if (!a.ok || !a.dado) throw new Error("Proposta ausente");
  expect(await prisma.encontroAgenda.count()).toBe(1);
  await prisma.usuario.update({ where: { id: secretariaId }, data: { papeis: ["SECRETARIA_ACADEMICA", "GERENTE_PEDAGOGICO"] } });
  const d = { propostaId: a.dado.id, aprovar: true, motivo: "Horário e condições conferidos" };
  expect(await decidirRemarcacaoParticular(d)).toMatchObject({ ok: false });
  login(gestorId);
  const [r, repetida] = await Promise.all([decidirRemarcacaoParticular(d), decidirRemarcacaoParticular(d)]);
  expect(r.ok, r.ok ? undefined : r.erro).toBe(true); expect(repetida).toEqual(r); if (!r.ok || !r.dado?.encontroNovoId) throw new Error("Novo encontro ausente");
  const novo = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: r.dado.encontroNovoId } }), original = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } });
  expect(novo.matriculaId).toBe(original.matriculaId); expect(novo.fim.getTime() - novo.inicio.getTime()).toBe(3600000);
  expect(novo.inicio.toISOString()).toBe("2099-10-12T13:00:00.000Z"); expect(novo.status).toBe("PREVISTO"); expect(original.status).toBe("CANCELADO");
  expect(await prisma.cobranca.count()).toBe(0); expect(await prisma.recebimento.count()).toBe(0);
  expect(await proporRemarcacaoParticular({ ...entrada, chaveIdempotencia: "remarcacao-duplicada" })).toMatchObject({ ok: false });
  expect(await consultarRemarcacoesParticular({ encontroOriginalId: encontroId })).toMatchObject({ ok: true, dado: { propostas: [{ decisao: { encontroNovoId: novo.id } }] } });
  await expect(prisma.decisaoRemarcacaoParticular.deleteMany()).rejects.toThrow();
});
it("confere todo o intervalo em feriado e exige exceção explícita antes de publicar", async () => {
  const { entrada } = await prepararRemarcacao();
  const atravessa = { ...entrada, horario: "23:30" };
  expect(await proporRemarcacaoParticular(atravessa)).toMatchObject({ ok: false, erro: expect.stringContaining("não letivo") });
  const a = await proporRemarcacaoParticular({ ...atravessa, motivoExcecaoNaoLetiva: "Encontro excepcional acordado para esta data" });
  expect(a.ok, a.ok ? undefined : a.erro).toBe(true); if (!a.ok || !a.dado) throw new Error("Proposta ausente");
  login(gestorId);
  const r = await decidirRemarcacaoParticular({ propostaId: a.dado.id, aprovar: true, motivo: "Aprovar também a exceção não letiva específica" });
  expect(r.ok, r.ok ? undefined : r.erro).toBe(true); if (!r.ok || !r.dado?.encontroNovoId) throw new Error("Encontro ausente");
  const novo = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: r.dado.encontroNovoId } });
  expect(novo.fim.toISOString()).toBe("2099-10-13T03:30:00.000Z");
});
it("revalida conflito surgido após a proposta e bloqueia professor inativo ou matrícula pausada", async () => {
  const { entrada } = await prepararRemarcacao();
  const a = await proporRemarcacaoParticular(entrada); if (!a.ok || !a.dado) throw new Error("Proposta ausente");
  const original = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } });
  const conflito = await prisma.encontroAgenda.create({ data: { matriculaId: original.matriculaId, professorId, preparadorId: gestorId, inicio: new Date("2099-10-12T13:00:00Z"), fim: new Date("2099-10-12T14:00:00Z"), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Outro encontro publicado", chaveIdempotencia: "conflito-remarcacao", entradaHash: "teste" } });
  login(gestorId); const d = { propostaId: a.dado.id, aprovar: true, motivo: "Conferência de remarcação" };
  expect(await decidirRemarcacaoParticular(d)).toMatchObject({ ok: false, erro: expect.stringContaining("conflitos") });
  await prisma.encontroAgenda.update({ where: { id: conflito.id }, data: { status: "CANCELADO" } });
  await prisma.usuario.update({ where: { id: professorId }, data: { ativo: false } });
  expect(await decidirRemarcacaoParticular(d)).toMatchObject({ ok: false, erro: expect.stringContaining("ativo") });
  await prisma.usuario.update({ where: { id: professorId }, data: { ativo: true } });
  await prisma.matricula.update({ where: { id: original.matriculaId! }, data: { status: "PAUSADA" } });
  expect(await decidirRemarcacaoParticular(d)).toMatchObject({ ok: false });
  expect(await decidirRemarcacaoParticular({ ...d, aprovar: false })).toMatchObject({ ok: true });
  expect(await prisma.encontroAgenda.count()).toBe(2);
});
