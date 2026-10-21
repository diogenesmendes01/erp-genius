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
import { carregarDependenciasFinanceirasAulaTx } from "@/server/diario/correcao-aula-financeiro-tx";
import { aprovarCorrecaoAula, proporCorrecaoAula, revisarCorrecaoAula, revisarImpactosCorrecaoAula } from "@/server/diario/correcao-aula";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { registrarOcorrenciaParticular, consultarOcorrenciasParticular } from "./ocorrencia-particular";
import { proporCancelamentoParticular, decidirCancelamentoParticular } from "@/server/agenda/cancelamento-particular";
let encontroId: string, professorId: string, gestorId: string, matriculaId: string;
const login = (id: string) => authMock.mockResolvedValue({ user: { id } });
const entrada = () => ({ encontroId, versaoAnterior: 0, tipo: "REALIZADA" as const, evidencia: "Aula efetivamente realizada conforme registro docente", chaveIdempotencia: "ocorrencia-teste" });
beforeEach(async () => {
  await truncarBanco(); const c = await seedCatalogoMinimo();
  professorId = (await criarUsuario(["PROFESSOR"])).id; gestorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  const a = await prisma.aluno.create({ data: { primeiroNome: "Aluno particular", paisId: c.pais.id } });
  const m = await prisma.matricula.create({ data: { alunoId: a.id, produtoId: c.produto.id, paisId: c.pais.id, moeda: "CRC", status: "ATIVA" } }); matriculaId = m.id;
  const e = await prisma.encontroAgenda.create({ data: { matriculaId, professorId, preparadorId: gestorId,
    inicio: new Date("2026-01-10T15:00:00Z"), fim: new Date("2026-01-10T16:15:00Z"), fusoOrigem: "America/Sao_Paulo", status: "PREVISTO",
    motivo: "Agenda contratada", chaveIdempotencia: "encontro-ocorrencia", entradaHash: "teste" } });
  encontroId = e.id; login(professorId);
});

it("registra uma vez sob concorrência, sem dinheiro, presença ou consumo; versões anteriores ficam preservadas", async () => {
  const [a, b] = await Promise.all([registrarOcorrenciaParticular(entrada()), registrarOcorrenciaParticular(entrada())]);
  expect(a.ok, a.ok ? undefined : a.erro).toBe(true); expect(b).toEqual(a);
  expect(await prisma.ocorrenciaParticular.count()).toBe(1);
  expect(await prisma.cobranca.count()).toBe(0); expect(await prisma.recebimento.count()).toBe(0);
  expect(await prisma.aulaDiario.count()).toBe(0); expect(await prisma.consumoHorasCompradas.count()).toBe(0);
  const nova = await registrarOcorrenciaParticular({ ...entrada(), versaoAnterior: 1, tipo: "FALTA_ALUNO", evidencia: "Correção do informe ainda não conferido", chaveIdempotencia: "ocorrencia-corrigida" });
  expect(nova).toMatchObject({ ok: true, dado: { versao: 2 } });
  expect(await prisma.ocorrenciaParticular.findMany({ orderBy: { versao: "asc" }, select: { versao: true, tipo: true, matriculaId: true } })).toEqual([
    { versao: 1, tipo: "REALIZADA", matriculaId }, { versao: 2, tipo: "FALTA_ALUNO", matriculaId }]);
  expect((await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } })).status).toBe("PREVISTO");
  const dependencias = await prisma.$transaction(tx => carregarDependenciasFinanceirasAulaTx(tx, encontroId, [matriculaId]));
  expect(dependencias).toMatchObject({ exigeConferenciaFinanceira: true, reservas: [], ocorrencias: [
    { matriculaId, versao: 1, tipo: "REALIZADA", conferenciaId: null, itemFaturadoId: null, emissaoId: null },
    { matriculaId, versao: 2, tipo: "FALTA_ALUNO", conferenciaId: null, itemFaturadoId: null, emissaoId: null },
  ] });
  expect(JSON.stringify(dependencias)).not.toMatch(/valor|moeda|evidencia|snapshot/);
  const consulta = await consultarOcorrenciasParticular({ encontroId });
  expect(consulta).toMatchObject({ ok: true, dado: { versaoAtual: 2, podeInformarAula: true, podeInformarCancelamento: false, historico: [{ versao: 2 }, { versao: 1 }] } });
  if (!consulta.ok || !consulta.dado) throw new Error("Histórico ausente");
  expect(Object.keys(consulta.dado).sort()).toEqual(["conferidaFinanceiramente", "encontroId", "fim", "fuso", "historico", "inicio", "origemCancelamento", "podeInformarAula", "podeInformarCancelamento", "versaoAtual"]);
  await expect(prisma.ocorrenciaParticular.updateMany({ data: { evidencia: "Alteração indevida" } })).rejects.toThrow(/preservadas/);
  await expect(prisma.ocorrenciaParticular.deleteMany()).rejects.toThrow(/preservadas/);
});

it.each([false, true])("publicação Q23 distingue texto de participação e preserva o financeiro: participação alterada=%s", async alteraParticipacao => {
  expect(await registrarOcorrenciaParticular(entrada())).toMatchObject({ ok: true });
  const ocorrencia = await prisma.ocorrenciaParticular.findFirstOrThrow({ where: { encontroId } });
  const matricula = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  await prisma.aulaDiario.create({ data: { encontroId, professorId, ocorridaEm: new Date("2026-01-10T15:00:00Z"),
    conteudo: "Conteúdo da particular realizada.", registros: { create: { alunoId: matricula.alunoId, matriculaId,
      nomeAluno: "Aluno particular", presente: true, participacao: "PRESENTE" } } } });
  await prisma.encontroAgenda.update({ where: { id: encontroId }, data: { status: "MINISTRADO" } });
  const atual = await revisarCorrecaoAula({ encontroId });
  expect(atual).toMatchObject({ ok: true });
  if (!atual.ok || !atual.dado) throw new Error("Conferência ausente");
  const proposta = await proporCorrecaoAula({ encontroId, estadoHash: atual.dado.estadoHash, versaoEsperada: atual.dado.versaoAtual,
    motivo: "Corrigir descrição da aula conforme registro docente.", evidencia: "Registro da aula realizada.", chaveIdempotencia: "financeiro-q23-458",
    alteracao: { conteudo: "Descrição corrigida da particular realizada.", registros: atual.dado.snapshot.registros.map(r => ({
      registroId: r.registroId, participacao: alteraParticipacao ? "FALTA" : r.participacao, observacao: r.observacao ?? "" })) } });
  expect(proposta).toMatchObject({ ok: true });
  if (!proposta.ok || !proposta.dado) throw new Error("Proposta ausente");
  login(gestorId);
  const revisao = await revisarImpactosCorrecaoAula({ propostaId: proposta.dado.id });
  expect(revisao).toMatchObject({ ok: true, dado: { financeiro: { possuiDependenciasFinanceiras: true, exigeConferenciaFinanceira: alteraParticipacao } } });
  if (!revisao.ok || !revisao.dado) throw new Error("Impactos ausentes");
  expect(await aprovarCorrecaoAula({ propostaId: proposta.dado.id, propostaHash: revisao.dado.propostaHash,
    impactosHash: revisao.dado.impactosHash, motivo: "Gestão conferiu o conteúdo e as dependências." }))
    .toMatchObject(alteraParticipacao ? { ok: false, erro: expect.stringMatching(/financeir/i) } : { ok: true });
  expect(await prisma.aprovacaoCorrecaoAula.count()).toBe(alteraParticipacao ? 0 : 1);
  expect(await prisma.ocorrenciaParticular.findUniqueOrThrow({ where: { id: ocorrencia.id } })).toEqual(ocorrencia);
  expect(await prisma.cobranca.count()).toBe(0);
  expect(await prisma.recebimento.count()).toBe(0);
  expect((await prisma.aulaDiario.findUniqueOrThrow({ where: { encontroId } })).conteudo).toBe("Conteúdo da particular realizada.");
});

it("recusa reutilização divergente de chave e versão concorrente", async () => {
  expect(await registrarOcorrenciaParticular(entrada())).toMatchObject({ ok: true });
  expect(await registrarOcorrenciaParticular({ ...entrada(), tipo: "FALTA_ALUNO" })).toMatchObject({ ok: false });
  expect(await registrarOcorrenciaParticular({ ...entrada(), chaveIdempotencia: "outra-versao" })).toMatchObject({ ok: false, erro: expect.stringContaining("mudou") });
});

it("limita ao professor atribuído e revalida acesso inclusive na repetição", async () => {
  login((await criarUsuario(["PROFESSOR"])).id);
  expect(await consultarOcorrenciasParticular({ encontroId })).toMatchObject({ ok: false });
  expect(await registrarOcorrenciaParticular(entrada())).toMatchObject({ ok: false });
  login(gestorId); expect(await registrarOcorrenciaParticular(entrada())).toMatchObject({ ok: false });
  login(professorId); expect(await registrarOcorrenciaParticular(entrada())).toMatchObject({ ok: true });
  await prisma.usuario.update({ where: { id: professorId }, data: { ativo: false } });
  expect(await consultarOcorrenciasParticular({ encontroId })).toMatchObject({ ok: false });
  expect(await registrarOcorrenciaParticular(entrada())).toMatchObject({ ok: false });
});

it("não aceita relógio ou preço do cliente e recusa realização futura", async () => {
  expect(await registrarOcorrenciaParticular({ ...entrada(), valorHora: "10" } as ReturnType<typeof entrada>)).toMatchObject({ ok: false });
  await prisma.encontroAgenda.update({ where: { id: encontroId }, data: { inicio: new Date("2099-01-01T15:00:00Z"), fim: new Date("2099-01-01T16:00:00Z") } });
  expect(await registrarOcorrenciaParticular(entrada())).toMatchObject({ ok: false, erro: expect.stringContaining("término") });
});

it("cancelamento informado exige decisão pedagógica e mantém comunicação sem escolher cobrança", async () => {
  const d = { ...entrada(), tipo: "CANCELAMENTO_ALUNO" as const, comunicadoEm: "2026-01-09T15:00:00Z" };
  expect(await registrarOcorrenciaParticular(d)).toMatchObject({ ok: false, erro: expect.stringContaining("aprovação") });
  const p = await proporCancelamentoParticular({ encontroId, origem: "ALUNO", motivo: "Aluno comunicou cancelamento", chaveIdempotencia: "cancelamento-ocorrencia" });
  if (!p.ok || !p.dado) throw new Error("Proposta ausente");
  login(gestorId); expect(await decidirCancelamentoParticular({ propostaId: p.dado.id, aprovar: true, motivo: "Cancelamento conferido" })).toMatchObject({ ok: true });
  login(professorId); expect(await registrarOcorrenciaParticular(d)).toMatchObject({ ok: true });
  expect(await registrarOcorrenciaParticular({ ...d, tipo: "CANCELAMENTO_ESCOLA", versaoAnterior: 1, chaveIdempotencia: "origem-divergente" })).toMatchObject({ ok: false, erro: expect.stringContaining("mesma origem") });
  const anterior = await prisma.ocorrenciaParticular.findFirstOrThrow();
  await expect(prisma.ocorrenciaParticular.create({ data: { ...anterior, id: "origem-sql", tipo: "CANCELAMENTO_ESCOLA", versao: 2, chaveIdempotencia: "origem-sql" } })).rejects.toThrow(/aprovação pedagógica/);
  expect(await consultarOcorrenciasParticular({ encontroId })).toMatchObject({ ok: true, dado: { podeInformarAula: false, podeInformarCancelamento: true, historico: [{ comunicadoEm: d.comunicadoEm.replace("Z", ".000Z") }] } });
  expect(await prisma.ocorrenciaParticular.findFirst()).toMatchObject({ tipo: "CANCELAMENTO_ALUNO", comunicadoEm: new Date(d.comunicadoEm) });
  expect(await prisma.cobranca.count()).toBe(0);
});

it("SQL rejeita origem e autor divergentes e mantém registro/evento atômicos", async () => {
  await registrarOcorrenciaParticular(entrada());
  const o = await prisma.ocorrenciaParticular.findFirstOrThrow();
  const data = { ...o, id: "registro-direto", versao: 2, chaveIdempotencia: "registro-direto" };
  await expect(prisma.ocorrenciaParticular.create({ data: { ...data, autorId: gestorId } })).rejects.toThrow(/atribuição/);
  await expect(prisma.ocorrenciaParticular.create({ data: { ...data, fim: new Date("2026-01-10T17:00:00Z") } })).rejects.toThrow(/agenda mudou/);
  await expect(prisma.$transaction(async tx => { await tx.ocorrenciaParticular.create({ data }); throw new Error("falha posterior"); })).rejects.toThrow(/falha posterior/);
  expect(await prisma.ocorrenciaParticular.count()).toBe(1);
  expect(await prisma.evento.count({ where: { tipo: "OcorrenciaParticularInformada", agregadoId: matriculaId } })).toBe(1);
});


