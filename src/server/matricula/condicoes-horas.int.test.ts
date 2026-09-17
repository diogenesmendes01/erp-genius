import { beforeEach, expect, it, vi } from "vitest";
import { carregarDependenciasFinanceirasAulaTx } from "@/server/diario/correcao-aula-financeiro-tx";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared", async original => {
  const real = await original<typeof import("@/server/_shared")>();
  return { ...real, exigirSessaoComPapel: async (...papeis: import("@prisma/client").Papel[]) => {
    const session = await authMock(); const u = await prisma.usuario.findUniqueOrThrow({ where: { id: session.user.id }, select: { id: true, nome: true, papeis: true, ativo: true } });
    if (!u.ativo) throw new real.ErroPermissao(); real.exigirPapel(u, ...papeis); return u;
  } };
});
import { prepararCondicoesHoras, decidirCondicoesHoras, consultarCondicoesHoras } from "./condicoes-horas";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
let matriculaId: string, documentoId: string, secretariaId: string, adminId: string;
const regras = { valorHora: "125.00", moeda: "CRC", unidadeMinutos: 60 as const, vigenteDesde: "2026-01-01T00:00:00Z", antecedenciaCancelamentoMinutos: 90, clausulaPreco: "Cláusula de preço da hora", clausulaCancelamento: "Cláusula de antecedência" };
const input = () => ({ matriculaId, documentoId, regras, motivo: "Transcrição das condições aceitas" });
const login = (id: string) => authMock.mockResolvedValue({ user: { id } });
beforeEach(async () => {
  await truncarBanco(); const c = await seedCatalogoMinimo();
  secretariaId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id; adminId = (await criarUsuario(["ADMINISTRADOR"])).id;
  const a = await prisma.aluno.create({ data: { primeiroNome: "Condições por hora", paisId: c.pais.id } });
  const m = await prisma.matricula.create({ data: { alunoId: a.id, paisId: c.pais.id, produtoId: c.produto.id, moeda: "CRC" } }); matriculaId = m.id;
  documentoId = (await prisma.documento.create({ data: { matriculaId, categoria: "CONTRATO", nome: "Contrato", url: "/api/files/contrato-horas.pdf" } })).id;
  await prisma.matricula.update({ where: { id: matriculaId }, data: { contratoOk: true, contratoDocumentoId: documentoId, confirmacaoContratoPorId: secretariaId, confirmacaoContratoEm: new Date() } }); login(secretariaId);
});
it("prepara versão pendente e exige outra pessoa para aprovar, preservando as condições", async () => {
  const p = await prepararCondicoesHoras(input()); expect(p.ok, p.ok ? undefined : p.erro).toBe(true);
  if (!p.ok || !p.dado) throw new Error("Proposta ausente");
  expect(await consultarCondicoesHoras(matriculaId)).toMatchObject({ ok: true, dado: { podePreparar: false, versoes: [{ regras, podeDecidir: false }] } });
  expect(await prepararCondicoesHoras(input())).toMatchObject({ ok: false });
  await prisma.usuario.update({ where: { id: secretariaId }, data: { papeis: ["ADMINISTRADOR"] } });
  const d = { id: p.dado.id, aprovar: true, motivo: "Contrato conferido" };
  expect(await decidirCondicoesHoras(d)).toMatchObject({ ok: false });
  await expect(prisma.condicoesHorasMatricula.update({ where: { id: d.id }, data: { status: "APROVADA", decisorId: secretariaId, decididaEm: new Date(), motivoDecisao: d.motivo } })).rejects.toThrow(/Outra pessoa/);
  login(adminId);
  expect(await consultarCondicoesHoras(matriculaId)).toMatchObject({ ok: true, dado: { versoes: [{ podeDecidir: true }] } });
  expect(await decidirCondicoesHoras(d)).toMatchObject({ ok: true });
  expect(await prisma.condicoesHorasMatricula.findUnique({ where: { id: d.id } })).toMatchObject({ status: "APROVADA", regras });
  await expect(prisma.condicoesHorasMatricula.update({ where: { id: d.id }, data: { regras: { ...regras, valorHora: "999" } } })).rejects.toThrow(/preservadas/);
  await expect(prisma.condicoesHorasMatricula.deleteMany()).rejects.toThrow(/preservadas/);
  expect(await prisma.cobranca.count()).toBe(0);
  expect(await consultarCondicoesHoras(matriculaId)).toMatchObject({ ok: true, dado: { versoes: [{ status: "APROVADA", podeDecidir: false }] } });
});

it("consulta financeira é somente leitura e professor não consulta preços contratuais", async () => {
  await prepararCondicoesHoras(input());
  login((await criarUsuario(["FINANCEIRO"])).id);
  expect(await consultarCondicoesHoras(matriculaId)).toMatchObject({ ok: true, dado: { podePreparar: false, versoes: [{ podeDecidir: false }] } });
  login((await criarUsuario(["PROFESSOR"])).id);
  expect(await consultarCondicoesHoras(matriculaId)).toMatchObject({ ok: false });
  login(secretariaId); await prisma.usuario.update({ where: { id: secretariaId }, data: { ativo: false } });
  expect(await consultarCondicoesHoras(matriculaId)).toMatchObject({ ok: false });
});
it("exige parâmetros completos e não usa outra moeda ou contrato não confirmado", async () => {
  expect(await prepararCondicoesHoras({ ...input(), regras: { ...regras, antecedenciaCancelamentoMinutos: undefined } } as never)).toMatchObject({ ok: false });
  expect(await prepararCondicoesHoras({ ...input(), regras: { ...regras, moeda: "BRL" } })).toMatchObject({ ok: false });
  await prisma.matricula.update({ where: { id: matriculaId }, data: { contratoOk: false } });
  expect(await prepararCondicoesHoras(input())).toMatchObject({ ok: false });
});
it("serializa preparações, recusa fonte alterada e permite rejeitar a transcrição pendente", async () => {
  const resultados = await Promise.all([prepararCondicoesHoras(input()), prepararCondicoesHoras(input())]);
  expect(resultados.filter(r => r.ok)).toHaveLength(1);
  const p = await prisma.condicoesHorasMatricula.findFirstOrThrow();
  await prisma.documento.update({ where: { id: documentoId }, data: { arquivado: true } });
  login(adminId); expect(await decidirCondicoesHoras({ id: p.id, aprovar: true, motivo: "Conferência atual" })).toMatchObject({ ok: false });
  expect(await decidirCondicoesHoras({ id: p.id, aprovar: false, motivo: "Fonte indisponível" })).toMatchObject({ ok: true });
});
it("banco exige preparação regular e moeda válida, sem aceitar aprovação direta", async () => {
  const data = { ...input(), preparadorId: secretariaId, versao: 1 };
  await expect(prisma.condicoesHorasMatricula.create({ data: { ...data, status: "APROVADA", decisorId: adminId, decididaEm: new Date(), motivoDecisao: "Direto indevido" } })).rejects.toThrow(/Prepare/);
  await expect(prisma.condicoesHorasMatricula.create({ data: { ...data, regras: { ...regras, moeda: "BRL" } } })).rejects.toThrow(/incompatíveis/);
  await prisma.usuario.update({ where: { id: secretariaId }, data: { ativo: false } });
  expect(await prepararCondicoesHoras(input())).toMatchObject({ ok: false });
});

async function prepararPreviaFinanceira() {
  const p = await prepararCondicoesHoras(input()); if (!p.ok || !p.dado) throw new Error("Condições ausentes");
  login(adminId); await decidirCondicoesHoras({ id: p.dado.id, aprovar: true, motivo: "Transcrição conferida" });
  const professor = await criarUsuario(["PROFESSOR"]);
  const e = await prisma.encontroAgenda.create({ data: { matriculaId, professorId: professor.id, preparadorId: adminId,
    inicio: new Date("2026-01-10T15:00:00Z"), fim: new Date("2026-01-10T16:15:00Z"), fusoOrigem: "America/Sao_Paulo", status: "PREVISTO",
    motivo: "Agenda contratada", chaveIdempotencia: "previa-horas-encontro", entradaHash: "fixture" } });
  login(professor.id);
  const { registrarOcorrenciaParticular } = await import("./ocorrencia-particular");
  const o = await registrarOcorrenciaParticular({ encontroId: e.id, versaoAnterior: 0, tipo: "REALIZADA", evidencia: "Informe do professor", chaveIdempotencia: "previa-horas-informe" });
  if (!o.ok || !o.dado) throw new Error("Informe ausente");
  const m = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  login(adminId);
  return { d: { alunoId: m.alunoId, matriculaId, ocorrenciaId: o.dado.id, condicoesId: p.dado.id }, e, professor };
}
it("prévia usa preço e versão aceitos, preservando 75 minutos e recusando condição futura", async () => {
  const { d } = await prepararPreviaFinanceira();
  const { preverConferenciaOcorrenciaHoras } = await import("./ocorrencia-financeira-previa");
  expect(await preverConferenciaOcorrenciaHoras(d)).toMatchObject({ ok: true, dado: { minutos: 75, valorApurado: "156.25", conferenciaRegistrada: false, emiteCobranca: false, classificacao: { desfecho: "REALIZADA" } } });
  login(secretariaId); const futura = await prepararCondicoesHoras({ ...input(), regras: { ...regras, vigenteDesde: "2099-01-01T00:00:00Z", valorHora: "900" } });
  if (!futura.ok || !futura.dado) throw new Error("Condições futuras ausentes");
  login(adminId); await decidirCondicoesHoras({ id: futura.dado.id, aprovar: true, motivo: "Vigência futura transcrita" });
  expect(await preverConferenciaOcorrenciaHoras(d)).toMatchObject({ ok: true, dado: { valorApurado: "156.25" } });
  expect(await preverConferenciaOcorrenciaHoras({ ...d, condicoesId: futura.dado.id })).toMatchObject({ ok: false, erro: expect.stringContaining("ainda não valiam") });
  await prisma.documento.update({ where: { id: documentoId }, data: { arquivado: true } });
  expect(await preverConferenciaOcorrenciaHoras(d)).toMatchObject({ ok: false });
  expect(await prisma.cobranca.count()).toBe(0);
});
it("prévia recusa outro aluno, professor e informe superado, mantendo o anterior", async () => {
  const { d, e, professor } = await prepararPreviaFinanceira();
  const { preverConferenciaOcorrenciaHoras } = await import("./ocorrencia-financeira-previa");
  expect(await preverConferenciaOcorrenciaHoras({ ...d, alunoId: "outro" })).toMatchObject({ ok: false });
  login(professor.id); expect(await preverConferenciaOcorrenciaHoras(d)).toMatchObject({ ok: false });
  const { registrarOcorrenciaParticular } = await import("./ocorrencia-particular");
  await registrarOcorrenciaParticular({ encontroId: e.id, versaoAnterior: 1, tipo: "FALTA_ALUNO", evidencia: "Correção do informe", chaveIdempotencia: "previa-horas-nova-versao" });
  login(adminId); expect(await preverConferenciaOcorrenciaHoras(d)).toMatchObject({ ok: false, erro: expect.stringContaining("mais recente") });
  expect(await prisma.ocorrenciaParticular.count()).toBe(2);
});

it("prévia classifica cancelamento do aluno pelo prazo contratual e bloqueia vigência conflitante", async () => {
  const { d, e, professor } = await prepararPreviaFinanceira();
  const { proporCancelamentoParticular, decidirCancelamentoParticular } = await import("@/server/agenda/cancelamento-particular");
  login(professor.id);
  const p = await proporCancelamentoParticular({ encontroId: e.id, origem: "ALUNO", motivo: "Cancelamento informado pelo aluno", chaveIdempotencia: "previa-cancelamento" });
  if (!p.ok || !p.dado) throw new Error("Proposta ausente");
  login(adminId); await decidirCancelamentoParticular({ propostaId: p.dado.id, aprovar: true, motivo: "Cancelamento conferido" });
  login(professor.id);
  const { registrarOcorrenciaParticular } = await import("./ocorrencia-particular");
  const o = await registrarOcorrenciaParticular({ encontroId: e.id, versaoAnterior: 1, tipo: "CANCELAMENTO_ALUNO", comunicadoEm: "2026-01-10T14:00:00Z", evidencia: "Comunicação registrada", chaveIdempotencia: "previa-cancelamento-informe" });
  if (!o.ok || !o.dado) throw new Error("Informe ausente");
  const consulta = { ...d, ocorrenciaId: o.dado.id };
  const { preverConferenciaOcorrenciaHoras } = await import("./ocorrencia-financeira-previa");
  login(adminId);
  expect(await preverConferenciaOcorrenciaHoras(consulta)).toMatchObject({ ok: true, dado: { valorApurado: "156.25", classificacao: { desfecho: "CANCELAMENTO_TARDIO", limiteCancelamento: "2026-01-10T13:30:00.000Z" } } });
  login(secretariaId);
  await prepararCondicoesHoras({ ...input(), regras: { ...regras, vigenteDesde: "2026-01-10T15:30:00Z" } });
  login(adminId);
  expect(await preverConferenciaOcorrenciaHoras(consulta)).toMatchObject({ ok: false, erro: expect.stringContaining("outra versão") });
});

it("persiste conferência concorrente uma vez, revalida a prévia e protege informe e agenda", async () => {
  const { d, e, professor } = await prepararPreviaFinanceira();
  const { preverConferenciaOcorrenciaHoras } = await import("./ocorrencia-financeira-previa");
  const { conferirOcorrenciaHoras } = await import("./ocorrencia-financeira-conferir");
  const p = await preverConferenciaOcorrenciaHoras(d); if (!p.ok || !p.dado) throw new Error("Prévia ausente");
  const entrada = { ...d, estadoPrevia: p.dado.estadoPrevia, motivo: "Ocorrência e cláusulas conferidas", chaveIdempotencia: "conferencia-horas-teste" };
  const { estadoPrevia, ...snapshot } = p.dado;
  await expect(prisma.conferenciaOcorrenciaHoras.create({ data: { encontroId: e.id, ocorrenciaId: d.ocorrenciaId, condicoesId: d.condicoesId, conferenteId: adminId,
    minutos: 75, valor: "999", moeda: "CRC", desfecho: "REALIZADA", snapshot, estadoPrevia, motivo: entrada.motivo, chaveIdempotencia: "conferencia-sql-invalida", entradaHash: "teste" } })).rejects.toThrow(/Cálculo financeiro divergente/);
  expect(await conferirOcorrenciaHoras({ ...entrada, estadoPrevia: "0".repeat(64) })).toMatchObject({ ok: false });
  const [a,b] = await Promise.all([conferirOcorrenciaHoras(entrada), conferirOcorrenciaHoras(entrada)]);
  expect(a.ok, a.ok ? undefined : a.erro).toBe(true); expect(b).toEqual(a);
  expect(await prisma.conferenciaOcorrenciaHoras.count()).toBe(1);
  const { consultarOcorrenciasFinanceiras } = await import("./ocorrencia-financeira-consulta");
  expect(await consultarOcorrenciasFinanceiras({ matriculaId })).toMatchObject({ ok: true, dado: { matricula: { id: matriculaId, alunoId: d.alunoId }, encontros: [{ conferencia: { valor: "156.25", minutos: 75, ocorrenciaId: d.ocorrenciaId, condicoesId: d.condicoesId } }] } });
  expect(await consultarOcorrenciasFinanceiras({ matriculaId, cursor: "outro-encontro" })).toMatchObject({ ok: false });
  expect(await prisma.conferenciaOcorrenciaHoras.findFirst()).toMatchObject({ minutos: 75, desfecho: "REALIZADA", moeda: "CRC" });
  expect(await prisma.cobranca.count()).toBe(0); expect(await prisma.recebimento.count()).toBe(0);
  await expect(prisma.conferenciaOcorrenciaHoras.deleteMany()).rejects.toThrow(/preservadas/);
  await expect(prisma.encontroAgenda.update({ where: { id: e.id }, data: { fim: new Date("2026-01-10T17:00:00Z") } })).rejects.toThrow(/revisão/);
  login(professor.id);
  const { registrarOcorrenciaParticular, consultarOcorrenciasParticular } = await import("./ocorrencia-particular");
  expect(await consultarOcorrenciasFinanceiras({ matriculaId })).toMatchObject({ ok: false });
  expect(await registrarOcorrenciaParticular({ encontroId: e.id, tipo: "FALTA_ALUNO", versaoAnterior: 1, evidencia: "Correção depois da conferência", chaveIdempotencia: "correcao-bloqueada" })).toMatchObject({ ok: false, erro: expect.stringContaining("revisão") });
  expect(await consultarOcorrenciasParticular({ encontroId: e.id })).toMatchObject({ ok: true, dado: { conferidaFinanceiramente: true, podeInformarAula: false } });
  login(adminId); await prisma.usuario.update({ where: { id: adminId }, data: { ativo: false } });
  expect(await consultarOcorrenciasFinanceiras({ matriculaId })).toMatchObject({ ok: false });
  expect(await conferirOcorrenciaHoras(entrada)).toMatchObject({ ok: false });
});

it("fechamento lê conferências e inclui encontros pendentes, sem transformar informe em cobrança", async () => {
  const { d, e } = await prepararPreviaFinanceira();
  const { preverConferenciaOcorrenciaHoras } = await import("./ocorrencia-financeira-previa");
  const { conferirOcorrenciaHoras } = await import("./ocorrencia-financeira-conferir");
  const { carregarApuracaoHorasTx } = await import("./fechamento-horas-tx");
  const periodo = { referencia: "contrato-janeiro", inicio: "2026-01-01T00:00:00Z", fimExclusivo: "2026-02-01T00:00:00Z" };
  const apurar = (escolha: "AGUARDAR" | "PROPOR_PARCIAL" = "AGUARDAR") => prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola',0))`;
    await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id = ${matriculaId} FOR UPDATE`;
    return carregarApuracaoHorasTx(tx, { alunoId: d.alunoId, matriculaId, periodo, vencimento: "2026-02-10", escolha });
  });
  expect(await apurar()).toMatchObject({ estado: "AGUARDANDO_CONFERENCIA", totalApurado: "0.00", pendencias: [{ encontroId: e.id }], origens: [{ informeId: d.ocorrenciaId, conferenciaId: null }] });
  const previa = await preverConferenciaOcorrenciaHoras(d); if (!previa.ok || !previa.dado) throw new Error("Prévia ausente");
  const conf = await conferirOcorrenciaHoras({ ...d, estadoPrevia: previa.dado.estadoPrevia, motivo: "Conferência para fechamento", chaveIdempotencia: "fechamento-conferencia" });
  if (!conf.ok || !conf.dado) throw new Error("Conferência ausente");
  expect(await apurar()).toMatchObject({ estado: "APURACAO_COMPLETA", totalApurado: "156.25", origens: [{ conferenciaId: conf.dado.id }] });
  const novo = await prisma.encontroAgenda.create({ data: { matriculaId, professorId: e.professorId, preparadorId: adminId,
    inicio: new Date("2026-01-15T15:00:00Z"), fim: new Date("2026-01-15T16:00:00Z"), fusoOrigem: e.fusoOrigem, status: "PREVISTO", motivo: "Aula ainda não conferida", chaveIdempotencia: "fechamento-pendente", entradaHash: "fixture" } });
  expect(await apurar()).toMatchObject({ estado: "AGUARDANDO_CONFERENCIA", totalApurado: "156.25", pendencias: [{ encontroId: novo.id }] });
  expect(await apurar("PROPOR_PARCIAL")).toMatchObject({ estado: "PROPOSTA_PARCIAL", exigeAprovacaoIndependente: true, totalApurado: "156.25", emiteCobranca: false });
  await expect(prisma.$transaction(tx => carregarApuracaoHorasTx(tx, { alunoId: "outro", matriculaId, periodo, vencimento: "2026-02-10", escolha: "AGUARDAR" }))).rejects.toThrow(/este aluno/);
  expect(await prisma.cobranca.count()).toBe(0);
});

it("prepara versões do fechamento sob concorrência, preservando período e apuração sem emitir", async () => {
  const { d } = await prepararPreviaFinanceira();
  const { prepararFechamentoHoras } = await import("./fechamento-horas-rascunho");
  const entrada = { alunoId: d.alunoId, matriculaId, documentoId, versaoAnterior: 0,
    periodo: { referencia: { referencia: "MES_CIVIL" as const }, dataNoPeriodo: "2026-01-15", fuso: "America/Sao_Paulo", vencimento: "2026-02-10", clausula: "Apuração mensal conforme contrato" },
    escolha: "PROPOR_PARCIAL" as const, motivo: "Conferência do período contratado", chaveIdempotencia: "rascunho-fechamento" };
  const [a,b] = await Promise.all([prepararFechamentoHoras(entrada), prepararFechamentoHoras(entrada)]);
  expect(a.ok, a.ok ? undefined : a.erro).toBe(true); expect(b).toEqual(a);
  const salvo = await prisma.rascunhoFechamentoHoras.findFirstOrThrow();
  expect(salvo.periodoInicio.toISOString()).toBe("2026-01-01T03:00:00.000Z");
  expect(salvo.periodoFimExclusivo.toISOString()).toBe("2026-02-01T03:00:00.000Z");
  expect(salvo.snapshot).toMatchObject({ periodo: { vencimento: "2026-02-10", dias: 31 }, apuracao: { estado: "AGUARDANDO_CONFERENCIA", totalApurado: "0.00", emiteCobranca: false } });
  expect(await prepararFechamentoHoras({ ...entrada, motivo: "Outra justificativa" })).toMatchObject({ ok: false });
  expect(await prepararFechamentoHoras({ ...entrada, chaveIdempotencia: "versao-concorrente" })).toMatchObject({ ok: false });
  expect(await prepararFechamentoHoras({ ...entrada, versaoAnterior: 1, chaveIdempotencia: "versao-seguinte" })).toMatchObject({ ok: true, dado: { versao: 2 } });
  await expect(prisma.rascunhoFechamentoHoras.deleteMany()).rejects.toThrow(/preservadas/);
  await expect(prisma.rascunhoFechamentoHoras.updateMany({ data: { motivo: "Mudança indevida" } })).rejects.toThrow(/preservadas/);
  expect(await prisma.cobranca.count()).toBe(0);
});

it("consulta versões de fechamento por matrícula sem expor memória na lista nem ampliar acesso", async () => {
  const { d, professor } = await prepararPreviaFinanceira();
  const { prepararFechamentoHoras } = await import("./fechamento-horas-rascunho");
  const { consultarFechamentosHoras } = await import("./fechamento-horas-consulta");
  const entrada = { alunoId: d.alunoId, matriculaId, documentoId, versaoAnterior: 0,
    periodo: { referencia: { referencia: "MES_CIVIL" as const }, dataNoPeriodo: "2026-01-15", fuso: "America/Sao_Paulo", vencimento: "2026-02-10", clausula: "Apuração mensal conforme contrato" },
    escolha: "AGUARDAR" as const, motivo: "Conferência para revisão", chaveIdempotencia: "consulta-fechamento-v1" };
  const primeira = await prepararFechamentoHoras(entrada);
  const segunda = await prepararFechamentoHoras({ ...entrada, versaoAnterior: 1, chaveIdempotencia: "consulta-fechamento-v2" });
  if (!primeira.ok || !primeira.dado || !segunda.ok || !segunda.dado) throw new Error("Rascunhos ausentes");
  const filtro = { alunoId: d.alunoId, matriculaId };
  expect(await consultarFechamentosHoras({ ...filtro, periodo: entrada.periodo })).toMatchObject({ ok: true, dado: { preparacao: { versaoAnterior: 2, periodo: { inicio: "2026-01-01", fim: "2026-01-31" } } } });
  expect(await consultarFechamentosHoras({ ...filtro, periodo: { ...entrada.periodo, dataNoPeriodo: "2026-02-15" } })).toMatchObject({ ok: true, dado: { preparacao: { versaoAnterior: 0 } } });
  const lista = await consultarFechamentosHoras(filtro);
  expect(lista).toMatchObject({ ok: true, dado: { versoes: [
    { id: segunda.dado.id, memoria: null, natureza: "RASCUNHO", comprovaEmissao: false },
    { id: primeira.dado.id, memoria: null }], proximoCursor: null } });
  expect(JSON.stringify(lista)).not.toMatch(/entradaHash|chaveIdempotencia/);
  expect(await consultarFechamentosHoras({ ...filtro, cursor: segunda.dado.id })).toMatchObject({ ok: true, dado: { versoes: [{ id: primeira.dado.id }] } });
  expect(await consultarFechamentosHoras({ ...filtro, rascunhoId: primeira.dado.id })).toMatchObject({ ok: true, dado: { versoes: [{ versao: 1, memoria: { apuracao: { totalApurado: "0.00" } } }] } });
  expect(await consultarFechamentosHoras({ ...filtro, alunoId: "outro" })).toMatchObject({ ok: false });
  expect(await consultarFechamentosHoras({ ...filtro, rascunhoId: "outra-matricula" })).toMatchObject({ ok: false });
  expect(await consultarFechamentosHoras({ ...filtro, cursor: "outro-cursor" })).toMatchObject({ ok: false });
  login(professor.id); expect(await consultarFechamentosHoras(filtro)).toMatchObject({ ok: false });
  login(secretariaId); expect(await consultarFechamentosHoras(filtro)).toMatchObject({ ok: false });
  const financeiro = await criarUsuario(["FINANCEIRO"]); login(financeiro.id);
  expect(await consultarFechamentosHoras(filtro)).toMatchObject({ ok: true });
  await prisma.usuario.update({ where: { id: financeiro.id }, data: { ativo: false } });
  expect(await consultarFechamentosHoras(filtro)).toMatchObject({ ok: false });
  expect(await prisma.cobranca.count()).toBe(0);
});

it("revalida a versão atual e bloqueia origens alteradas, versão superada e documento indisponível", async () => {
  const { d } = await prepararPreviaFinanceira();
  const { prepararFechamentoHoras } = await import("./fechamento-horas-rascunho");
  const { revalidarFechamentoHorasTx } = await import("./fechamento-horas-revalidacao-tx");
  const entrada = { alunoId: d.alunoId, matriculaId, documentoId, versaoAnterior: 0,
    periodo: { referencia: { referencia: "MES_CIVIL" as const }, dataNoPeriodo: "2026-01-15", fuso: "America/Sao_Paulo", vencimento: "2026-02-10", clausula: "Apuração mensal conforme contrato" },
    escolha: "AGUARDAR" as const, motivo: "Conferência antes da decisão", chaveIdempotencia: "revalidacao-v1" };
  const primeira = await prepararFechamentoHoras(entrada);
  if (!primeira.ok || !primeira.dado) throw new Error("Rascunho ausente");
  const validar = (rascunhoId: string, alunoId = d.alunoId) => prisma.$transaction(tx => revalidarFechamentoHorasTx(tx, { alunoId, matriculaId, rascunhoId }));
  expect(await validar(primeira.dado.id)).toMatchObject({ apuracao: { estado: "AGUARDANDO_CONFERENCIA", totalApurado: "0.00" } });
  const idPrimeira = primeira.dado.id;
  await expect(prisma.$transaction(async tx => {
    const encontro = await tx.ocorrenciaParticular.findUniqueOrThrow({ where: { id: d.ocorrenciaId } });
    await tx.encontroAgenda.update({ where: { id: encontro.encontroId }, data: { inicio: new Date("2026-01-11T15:00:00Z"), fim: new Date("2026-01-11T16:15:00Z") } });
    return revalidarFechamentoHorasTx(tx, { alunoId: d.alunoId, matriculaId, rascunhoId: idPrimeira });
  })).rejects.toThrow(/origens.*mudaram/);
  await expect(validar(primeira.dado.id, "outro-aluno")).rejects.toThrow(/não encontrado/);
  const { preverConferenciaOcorrenciaHoras } = await import("./ocorrencia-financeira-previa");
  const { conferirOcorrenciaHoras } = await import("./ocorrencia-financeira-conferir");
  const previa = await preverConferenciaOcorrenciaHoras(d); if (!previa.ok || !previa.dado) throw new Error("Prévia ausente");
  const conf = await conferirOcorrenciaHoras({ ...d, estadoPrevia: previa.dado.estadoPrevia, motivo: "Conferência posterior ao rascunho", chaveIdempotencia: "revalidacao-conferencia" });
  expect(conf.ok).toBe(true);
  await expect(validar(primeira.dado.id)).rejects.toThrow(/origens.*mudaram/);
  const segunda = await prepararFechamentoHoras({ ...entrada, versaoAnterior: 1, chaveIdempotencia: "revalidacao-v2" });
  if (!segunda.ok || !segunda.dado) throw new Error("Segunda versão ausente");
  await expect(validar(primeira.dado.id)).rejects.toThrow(/mais recente/);
  expect(await validar(segunda.dado.id)).toMatchObject({ apuracao: { totalApurado: "156.25" } });
  await prisma.documento.update({ where: { id: documentoId }, data: { arquivado: true } });
  await expect(validar(segunda.dado.id)).rejects.toThrow(/indisponível/);
  expect(await prisma.cobranca.count()).toBe(0);
});

it("decisão do fechamento exige independência, referência confirmada e autorização financeira vigente", async () => {
  const { d } = await prepararPreviaFinanceira();
  const { prepararFechamentoHoras } = await import("./fechamento-horas-rascunho");
  const { decidirFechamentoHoras } = await import("./fechamento-horas-decisao");
  const r = await prepararFechamentoHoras({ alunoId: d.alunoId, matriculaId, documentoId, versaoAnterior: 0,
    periodo: { referencia: { referencia: "MES_CIVIL" }, dataNoPeriodo: "2026-01-15", fuso: "America/Sao_Paulo", vencimento: "2026-02-10", clausula: "Apuração mensal conforme contrato" },
    escolha: "AGUARDAR", motivo: "Aguardar conferência dos encontros", chaveIdempotencia: "decisao-fechamento-base" });
  if (!r.ok || !r.dado) throw new Error("Rascunho ausente");
  const entrada = { alunoId: d.alunoId, matriculaId, rascunhoId: r.dado.id, aprovar: true, confirmaReferenciaContratual: true, motivo: "Referência conferida, aguardar encontros" };
  expect(await decidirFechamentoHoras(entrada)).toMatchObject({ ok: false, erro: expect.stringContaining("Outra pessoa") });
  const financeiro = await criarUsuario(["FINANCEIRO"]); login(financeiro.id);
  expect(await decidirFechamentoHoras(entrada)).toMatchObject({ ok: false });
  await prisma.usuario.update({ where: { id: financeiro.id }, data: { permissoes: ["financeiro.aprovar_acertos"] } });
  expect(await decidirFechamentoHoras({ ...entrada, confirmaReferenciaContratual: false })).toMatchObject({ ok: false });
  const [a,b] = await Promise.all([decidirFechamentoHoras(entrada), decidirFechamentoHoras(entrada)]);
  expect(a.ok, a.ok ? undefined : a.erro).toBe(true); expect(b).toEqual(a);
  expect(await prisma.decisaoFechamentoHoras.count()).toBe(1);
  const { consultarFechamentosHoras } = await import("./fechamento-horas-consulta");
  expect(await consultarFechamentosHoras({ alunoId: d.alunoId, matriculaId, rascunhoId: r.dado.id })).toMatchObject({ ok: true, dado: { versoes: [{ decisao: { aprovada: true, motivo: entrada.motivo }, comprovaEmissao: false }] } });
  expect(await decidirFechamentoHoras({ ...entrada, aprovar: false })).toMatchObject({ ok: false });
  await expect(prisma.decisaoFechamentoHoras.updateMany({ data: { motivo: "Alteração indevida" } })).rejects.toThrow(/preservada/);
  await expect(prisma.decisaoFechamentoHoras.deleteMany()).rejects.toThrow(/preservada/);
  await prisma.usuario.update({ where: { id: financeiro.id }, data: { permissoes: [] } });
  expect(await decidirFechamentoHoras(entrada)).toMatchObject({ ok: false });
  expect(await prisma.cobranca.count()).toBe(0);
});

it("bloqueia aprovação de apuração alterada e permite rejeitar a versão preservada", async () => {
  const { d } = await prepararPreviaFinanceira();
  const { prepararFechamentoHoras } = await import("./fechamento-horas-rascunho");
  const { decidirFechamentoHoras } = await import("./fechamento-horas-decisao");
  const { consultarFechamentosHoras } = await import("./fechamento-horas-consulta");
  const entrada = { alunoId: d.alunoId, matriculaId, documentoId, versaoAnterior: 0,
    periodo: { referencia: { referencia: "MES_CIVIL" as const }, dataNoPeriodo: "2026-01-15", fuso: "America/Sao_Paulo", vencimento: "2026-02-10", clausula: "Cláusula para conferência independente" },
    escolha: "AGUARDAR" as const, motivo: "Revisão financeira do período", chaveIdempotencia: "decisao-origens-alteradas" };
  const r = await prepararFechamentoHoras(entrada); if (!r.ok || !r.dado) throw new Error("Rascunho ausente");
  const filtro = { alunoId: d.alunoId, matriculaId, rascunhoId: r.dado.id };
  expect(await consultarFechamentosHoras(filtro)).toMatchObject({ ok: true, dado: { versoes: [{ podeDecidir: false, referenciaProposta: { periodo: { clausula: entrada.periodo.clausula }, escolha: "AGUARDAR" } }] } });
  const aprovador = await criarUsuario(["ADMINISTRADOR"]); login(aprovador.id);
  expect(await consultarFechamentosHoras(filtro)).toMatchObject({ ok: true, dado: { versoes: [{ podeDecidir: true }] } });
  const { preverConferenciaOcorrenciaHoras } = await import("./ocorrencia-financeira-previa");
  const { conferirOcorrenciaHoras } = await import("./ocorrencia-financeira-conferir");
  const previa = await preverConferenciaOcorrenciaHoras(d); if (!previa.ok || !previa.dado) throw new Error("Prévia ausente");
  expect(await conferirOcorrenciaHoras({ ...d, estadoPrevia: previa.dado.estadoPrevia, motivo: "Conferência após a preparação", chaveIdempotencia: "decisao-origem-nova" })).toMatchObject({ ok: true });
  expect(await decidirFechamentoHoras({ ...filtro, aprovar: true, confirmaReferenciaContratual: true, motivo: "Proposta conferida" })).toMatchObject({ ok: false, erro: expect.stringContaining("origens") });
  await prisma.documento.update({ where: { id: documentoId }, data: { arquivado: true } });
  expect(await decidirFechamentoHoras({ ...filtro, aprovar: true, confirmaReferenciaContratual: true, motivo: "Proposta conferida" })).toMatchObject({ ok: false, erro: expect.stringContaining("indisponível") });
  expect(await prisma.decisaoFechamentoHoras.count()).toBe(0);
  expect(await decidirFechamentoHoras({ ...filtro, aprovar: false, confirmaReferenciaContratual: false, motivo: "Documento indisponível, refazer a proposta" })).toMatchObject({ ok: true, dado: { aprovada: false, emiteCobranca: false } });
  expect(await consultarFechamentosHoras(filtro)).toMatchObject({ ok: true, dado: { versoes: [{ podeDecidir: false, decisao: { aprovada: false } }] } });
  expect(await prisma.cobranca.count()).toBe(0);
});

it.each([["156.25", 0], ["100.00", 0], ["100.00", 156.25]] as const)("emite uma vez e encerra com valor aprovado %s e recebimento %s", async (valorFinal, valorRecebido) => {
 const { d } = await prepararPreviaFinanceira();
 const { preverConferenciaOcorrenciaHoras } = await import("./ocorrencia-financeira-previa");
 const { conferirOcorrenciaHoras } = await import("./ocorrencia-financeira-conferir");
 const { prepararFechamentoHoras } = await import("./fechamento-horas-rascunho");
 const { decidirFechamentoHoras } = await import("./fechamento-horas-decisao");
 const { emitirFechamentoHorasTx } = await import("./fechamento-horas-emissao-tx");
 const previa = await preverConferenciaOcorrenciaHoras(d); if (!previa.ok || !previa.dado) throw new Error("Prévia ausente");
 expect(await conferirOcorrenciaHoras({ ...d, estadoPrevia: previa.dado.estadoPrevia, motivo: "Conferência para faturamento", chaveIdempotencia: "emissao-conferencia" })).toMatchObject({ ok: true });
 const entrada = { alunoId: d.alunoId, matriculaId, documentoId, versaoAnterior: 0,
  periodo: { referencia: { referencia: "MES_CIVIL" as const }, dataNoPeriodo: "2026-01-15", fuso: "America/Sao_Paulo", vencimento: "2026-02-10", clausula: "Apuração mensal conforme contrato" },
  escolha: "AGUARDAR" as const, motivo: "Apuração completa para emissão", chaveIdempotencia: "emissao-rascunho" };
 const r = await prepararFechamentoHoras(entrada); if (!r.ok || !r.dado) throw new Error("Rascunho ausente");
 const aprovador = await criarUsuario(["ADMINISTRADOR"]); login(aprovador.id);
 const decisao = await decidirFechamentoHoras({ alunoId: d.alunoId, matriculaId, rascunhoId: r.dado.id, aprovar: true, confirmaReferenciaContratual: true, motivo: "Apuração e contrato conferidos" });
 if (!decisao.ok || !decisao.dado) throw new Error("Decisão ausente");
 const execucao = { alunoId: d.alunoId, matriculaId, decisaoId: decisao.dado.id, executorId: adminId };
 const memoria = (await prisma.rascunhoFechamentoHoras.findUniqueOrThrow({ where: { id: r.dado.id } })).snapshot;
 await expect(prisma.$transaction(async tx => {
   const incompleta = await tx.cobranca.create({ data: { matriculaId, tipo: "HORA_PARTICULAR", moeda: "CRC", valorOriginal: "156.25", valorNegociado: "156.25", saldo: "156.25", vencimento: new Date("2026-02-10T15:00:00Z") } });
   await tx.emissaoFechamentoHoras.create({ data: { decisaoId: execucao.decisaoId, executorId: adminId, cobrancaId: incompleta.id, memoria: memoria as import("@prisma/client").Prisma.InputJsonValue } });
   await tx.$executeRaw`SET CONSTRAINTS validar_conjunto_emissao_horas IMMEDIATE`;
 })).rejects.toThrow(/Conjunto de itens/);
 expect(await prisma.cobranca.count()).toBe(0);
 const emitir = () => prisma.$transaction(tx => emitirFechamentoHorasTx(tx, execucao));
 const { carregarImpactosAcademicosEncerramentoTx } = await import("./encerramento-impactos-academicos");
 const { conferirAgendaEncerramentoTx } = await import("./encerramento-agenda");
 const conferirEncerramento = () => prisma.$transaction(async tx => {
  const impactos = await carregarImpactosAcademicosEncerramentoTx(tx, d.alunoId, matriculaId);
  return conferirAgendaEncerramentoTx(tx, impactos, "2026-01-31", "America/Sao_Paulo", true);
 });
 expect(await conferirEncerramento()).toMatchObject({ pendencias: [expect.stringContaining("sem destinação financeira")] });
 const [a,b] = await Promise.all([emitir(),emitir()]); expect(b).toEqual(a);
 expect(await conferirEncerramento()).toMatchObject({ pendencias: [], destinacoesHoras: [{ tipo: "FATURADA", cobrancaId: a.cobrancaId }] });
 expect(await prisma.cobranca.count()).toBe(1); expect(await prisma.itemFechamentoHoras.count()).toBe(1);
 const conferenciaFaturada = await prisma.conferenciaOcorrenciaHoras.findFirstOrThrow({ include: { itemFaturado: true } });
 const dependenciasCorrecao = await prisma.$transaction(tx => carregarDependenciasFinanceirasAulaTx(tx, conferenciaFaturada.encontroId, [matriculaId]));
 expect(dependenciasCorrecao).toMatchObject({ exigeConferenciaFinanceira: true, ocorrencias: [{
   conferenciaId: conferenciaFaturada.id, itemFaturadoId: conferenciaFaturada.itemFaturado!.id, emissaoId: a.id,
 }] });
 expect(JSON.stringify(dependenciasCorrecao)).not.toMatch(/valor|moeda|snapshot/);
 const c = await prisma.cobranca.findUniqueOrThrow({ where: { id: a.cobrancaId } });
 expect(c.valorNegociado.toFixed(2)).toBe("156.25"); expect(c.tipo).toBe("HORA_PARTICULAR");
 const { carregarContextoEncerramentoTx } = await import("./encerramento-contexto-tx");
 const { conferirOutrasCobrancasEncerramento } = await import("./encerramento-outras-cobrancas");
 const contextoAcerto = await prisma.$transaction(tx => carregarContextoEncerramentoTx(tx, { alunoId: d.alunoId, matriculaId }));
 expect(contextoAcerto.cobrancas).toMatchObject([{ tipo: "HORA_PARTICULAR", coberturaInicio: null, coberturaFim: null,
  origemFaturamentoHoras: { emissaoId: a.id, decisaoId: execucao.decisaoId, itens: [{ valor: "156.25" }] } }]);
 const outras = conferirOutrasCobrancasEncerramento(contextoAcerto, [{ cobrancaId: c.id, versao: c.versao, valorDevidoProposto: "156.25", motivo: "Preservar serviços faturados", evidenciaContratual: "Encontros realizados e conferidos" }]);
 expect(outras).toMatchObject({ pendencias: [], parcelas: [{ saldoDevido: "156.25", creditoApurado: "0.00", alteracaoProposta: false,
  origemFaturamentoHoras: { emissaoId: a.id } }] });
 await expect(prisma.cobranca.update({ where: { id: c.id }, data: { valorOriginal: "999" } })).rejects.toThrow(/preservada/);
 await expect(prisma.cobranca.update({ where: { id: c.id }, data: { tipo: "MENSALIDADE" } })).rejects.toThrow(/preservada/);
 await expect(prisma.itemFechamentoHoras.deleteMany()).rejects.toThrow(/preservada/);
 const nova = await prepararFechamentoHoras({ ...entrada, versaoAnterior: 1, chaveIdempotencia: "emissao-nova-apuracao" });
 expect(nova.ok).toBe(true);
 const r2 = await prisma.rascunhoFechamentoHoras.findFirstOrThrow({ where: { versao: 2 } });
 expect(r2.snapshot).toMatchObject({ apuracao: { totalApurado: "0.00", estado: "SEM_ITENS_A_FATURAR", preservados: [{ destinacao: { tipo: "FATURADA", cobrancaId: a.cobrancaId } }] } });
 await prisma.configuracaoOperacional.upsert({ where: { id: "escola" }, create: { id: "escola", fusoInstitucional: "America/Sao_Paulo" }, update: { fusoInstitucional: "America/Sao_Paulo" } });
 await prisma.matricula.update({ where: { id: matriculaId }, data: { status: "ATIVA", ativadaEm: new Date("2026-01-01T00:00:00Z") } });
 const { prepararCondicoesEncerramento, decidirCondicoesEncerramento } = await import("./condicoes-encerramento");
 login(secretariaId);
 const cond = await prepararCondicoesEncerramento({ matriculaId, documentoId, motivo: "Condições de encerramento transcritas", regras: {
  diaEncerramento: "INCLUIR", metodoDesconto: "ANTES_DO_PROPORCIONAL", condicoesDescontos: "Condições previstas no contrato", multa: { tipo: "SEM_PREVISAO", motivo: "Contrato sem multa de encerramento" } } });
 if (!cond.ok || !cond.dado) throw new Error(cond.ok ? "Condições ausentes" : cond.erro);
 login(aprovador.id); expect(await decidirCondicoesEncerramento({ id: cond.dado.id, aprovar: true, motivo: "Conferência independente do contrato" })).toMatchObject({ ok: true });
 const { solicitarEncerramentoMatriculas } = await import("./encerramento-solicitacao");
 const contratoOrigem = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
 const outroContrato = await prisma.matricula.create({ data: { alunoId: d.alunoId, paisId: contratoOrigem.paisId, produtoId: contratoOrigem.produtoId, moeda: "CRC", status: "ATIVA" } });
 login(secretariaId);
 const pedido = await solicitarEncerramentoMatriculas({ alunoId: d.alunoId, matriculaIds: [matriculaId], dataSolicitada: "2099-09-30", motivo: "Aluno solicitou encerramento", evidenciaPedido: "Pedido institucional registrado", chaveIdempotencia: "encerrar-horas-faturadas" });
 if (!pedido.ok || !pedido.dado) throw new Error(pedido.ok ? "Pedido ausente" : pedido.erro);
 const { salvarRascunhoAcertoEncerramento } = await import("./encerramento-rascunho");
 const { receberTx } = await import("@/server/financeiro/recebimentos");
 const recebimento = valorRecebido ? await prisma.$transaction(tx => receberTx(tx, {
  cobrancaId: c.id, autorId: adminId, valorRecebido, forma: "DINHEIRO",
  dataPagamento: new Date("2026-02-10T15:00:00Z"), chaveIdempotencia: "pagamento-horas-antes-encerramento",
 })) : null;
 const cobrancaConferida = await prisma.cobranca.findUniqueOrThrow({ where: { id: c.id } });
 login(adminId);
 const acerto = await salvarRascunhoAcertoEncerramento({ alunoId: d.alunoId, solicitacaoId: pedido.dado.solicitacaoId, versaoAnterior: 0, motivo: "Conferência do saldo faturado por hora", chaveIdempotencia: "acerto-horas-faturadas",
  contratos: [{ matriculaId, condicoesId: cond.dado.id, parcelas: [], multa: { tipo: "SEM_PREVISAO" }, outrasCobrancas: [{ cobrancaId: c.id, versao: cobrancaConferida.versao, valorDevidoProposto: valorFinal, motivo: valorFinal === "156.25" ? "Preservar serviços já prestados" : "Acerto contratual com redução aprovada", evidenciaContratual: "Encontros faturados e acordo de encerramento conferidos" }] }] });
 if (!acerto.ok || !acerto.dado) throw new Error(acerto.ok ? "Acerto ausente" : acerto.erro);
 const { decidirAcertoEncerramento } = await import("./encerramento-decisao");
 login(aprovador.id);
 const decisaoAcerto = await decidirAcertoEncerramento({ alunoId: d.alunoId, rascunhoId: acerto.dado.id, aprovar: true, motivo: "Saldo e encerramento conferidos" });
 if (!decisaoAcerto.ok || !decisaoAcerto.dado) throw new Error(decisaoAcerto.ok ? "Decisão ausente" : decisaoAcerto.erro);
 const { efetivarAcertoEncerramentoTx } = await import("./encerramento-efetivar-tx");
 const efetivar = () => prisma.$transaction(tx => efetivarAcertoEncerramentoTx(tx, { alunoId: d.alunoId, decisaoId: decisaoAcerto.dado!.id, executorId: adminId }, new Date("2099-09-30T12:00:00Z")));
 const concluido = await efetivar(); expect(await efetivar()).toEqual(concluido);
 expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toMatchObject({ status: "ENCERRADA" });
 expect(await prisma.matricula.findUniqueOrThrow({ where: { id: outroContrato.id } })).toMatchObject({ status: "ATIVA", acessoVersao: outroContrato.acessoVersao });
 const preservada = await prisma.cobranca.findUniqueOrThrow({ where: { id: c.id } });
 expect(preservada.saldo?.toFixed(2)).toBe(Math.max(0, Number(valorFinal) - valorRecebido).toFixed(2)); expect(preservada.valorNegociado.toFixed(2)).toBe(valorFinal); expect(preservada.valorOriginal.toFixed(2)).toBe("156.25");
 const ajuste = await prisma.ajusteCobrancaAcerto.findUniqueOrThrow({ where: { cobrancaId: c.id } });
 expect(ajuste.decisaoId).toBe(decisaoAcerto.dado.id); expect(ajuste.valorAnterior.toFixed(2)).toBe("156.25"); expect(ajuste.valorNovo.toFixed(2)).toBe(valorFinal);
 expect((await prisma.itemFechamentoHoras.findFirstOrThrow()).valor.toFixed(2)).toBe("156.25");
 expect(await prisma.itemFechamentoHoras.count()).toBe(1);
 expect(await prisma.creditoMatricula.count()).toBe(recebimento ? 1 : 0);
 expect(await prisma.recebimento.count()).toBe(recebimento ? 1 : 0);
 if (recebimento) {
  expect(await prisma.recebimento.findUniqueOrThrow({ where: { id: recebimento.id } })).toEqual(recebimento);
  expect(preservada.valorRecebido?.toFixed(2)).toBe("156.25");
  const credito = await prisma.creditoMatricula.findFirstOrThrow();
  expect(credito.matriculaId).toBe(matriculaId); expect(credito.moeda).toBe("CRC");
  expect(credito.valorInicial.toFixed(2)).toBe("56.25"); expect(credito.origemAcertoId).not.toBeNull();
 }
});

it("CT09: particular sem gravação, ocorrência conferida e fechamento parcial/complementar não duplicam encontros", async () => {
 const { d, e, professor } = await prepararPreviaFinanceira();
 const { preverConferenciaOcorrenciaHoras } = await import("./ocorrencia-financeira-previa");
 const { conferirOcorrenciaHoras } = await import("./ocorrencia-financeira-conferir");
 const { prepararFechamentoHoras } = await import("./fechamento-horas-rascunho");
 const { decidirFechamentoHoras } = await import("./fechamento-horas-decisao");
 const { emitirFechamentoHorasTx } = await import("./fechamento-horas-emissao-tx");
 const { registrarOcorrenciaParticular } = await import("./ocorrencia-particular");
 expect(await prisma.aulaDiario.count()).toBe(0);
 const conferir = async (ocorrenciaId: string, chave: string) => {
  const p = await preverConferenciaOcorrenciaHoras({ ...d, ocorrenciaId }); if (!p.ok || !p.dado) throw new Error("Prévia ausente");
  expect(await conferirOcorrenciaHoras({ ...d, ocorrenciaId, estadoPrevia: p.dado.estadoPrevia, motivo: "Ocorrência conferida para fechamento", chaveIdempotencia: chave })).toMatchObject({ ok: true });
 };
 await conferir(d.ocorrenciaId, "parcial-primeiro");
 expect(await prisma.conferenciaOcorrenciaHoras.count({ where: { encontroId: e.id } })).toBe(1);
 const novo = await prisma.encontroAgenda.create({ data: { matriculaId, professorId: professor.id, preparadorId: adminId,
  inicio: new Date("2026-01-15T15:00:00Z"), fim: new Date("2026-01-15T16:00:00Z"), fusoOrigem: e.fusoOrigem, status: "PREVISTO", motivo: "Encontro aguardando conferência", chaveIdempotencia: "parcial-segundo", entradaHash: "fixture" } });
 const aprovador = await criarUsuario(["ADMINISTRADOR"]);
 const entrada = { alunoId: d.alunoId, matriculaId, documentoId,
  periodo: { referencia: { referencia: "MES_CIVIL" as const }, dataNoPeriodo: "2026-01-15", fuso: "America/Sao_Paulo", vencimento: "2026-02-10", clausula: "Período contratual para fechamento" }, motivo: "Decisão de fechamento do período" };
 const prepararDecidir = async (versaoAnterior: number, escolha: "AGUARDAR" | "PROPOR_PARCIAL") => {
  login(adminId);
  const r = await prepararFechamentoHoras({ ...entrada, versaoAnterior, escolha, chaveIdempotencia: `parcial-versao-${versaoAnterior}` });
  if (!r.ok || !r.dado) throw new Error("Rascunho ausente");
  login(aprovador.id);
  const dec = await decidirFechamentoHoras({ alunoId: d.alunoId, matriculaId, rascunhoId: r.dado.id, aprovar: true, confirmaReferenciaContratual: true, motivo: "Conferidos contrato e efeitos da escolha" });
  if (!dec.ok || !dec.dado) throw new Error("Decisão ausente");
  return dec.dado.id;
 };
 const emitir = (decisaoId: string) => prisma.$transaction(tx => emitirFechamentoHorasTx(tx, { alunoId: d.alunoId, matriculaId, decisaoId, executorId: adminId }));
 const aguardar = await prepararDecidir(0, "AGUARDAR");
 await expect(emitir(aguardar)).rejects.toThrow(/não autoriza/);
 expect(await prisma.cobranca.count()).toBe(0);
 const parcial = await prepararDecidir(1, "PROPOR_PARCIAL");
 const primeira = await emitir(parcial);
 const { emitirFechamentoHoras } = await import("./fechamento-horas-emissao");
 expect(await emitirFechamentoHoras({ alunoId: d.alunoId, matriculaId, decisaoId: parcial })).toMatchObject({ ok: true, dado: primeira });
 expect(await emitirFechamentoHoras({ alunoId: "outro-aluno", matriculaId, decisaoId: parcial })).toMatchObject({ ok: false });
 expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: primeira.cobrancaId } })).valorNegociado.toFixed(2)).toBe("156.25");
 login(professor.id);
 expect(await emitirFechamentoHoras({ alunoId: d.alunoId, matriculaId, decisaoId: parcial })).toMatchObject({ ok: false });
 const informe = await registrarOcorrenciaParticular({ encontroId: novo.id, tipo: "REALIZADA", versaoAnterior: 0, evidencia: "Aula realizada conforme agenda", chaveIdempotencia: "parcial-informe-segundo" });
 expect(informe.ok).toBe(true);
 expect(await prisma.aulaDiario.count()).toBe(0);
 const o = await prisma.ocorrenciaParticular.findFirstOrThrow({ where: { encontroId: novo.id } });
 login(adminId); await conferir(o.id, "parcial-conferencia-segundo");
 const complementar = await prepararDecidir(2, "AGUARDAR");
 const segunda = await emitir(complementar);
 expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: segunda.cobrancaId } })).valorNegociado.toFixed(2)).toBe("125.00");
 expect(await prisma.cobranca.count()).toBe(2); expect(await prisma.itemFechamentoHoras.count()).toBe(2);
 expect(await prisma.conferenciaOcorrenciaHoras.count()).toBe(2);
 const itensFaturados = await prisma.itemFechamentoHoras.findMany({ include: { conferencia: { select: { encontroId: true } } } });
 expect(itensFaturados.map(item => item.conferencia.encontroId).sort()).toEqual([e.id, novo.id].sort());
 expect(await emitir(parcial)).toEqual(primeira); expect(await emitir(complementar)).toEqual(segunda);
 const { consultarFechamentosHoras } = await import("./fechamento-horas-consulta");
 const historico = await consultarFechamentosHoras({ alunoId: d.alunoId, matriculaId });
 expect(historico).toMatchObject({ ok: true, dado: { versoes: [
  { comprovaEmissao: true, emissao: { cobranca: { id: segunda.cobrancaId, valorOriginal: "125.00", saldo: "125.00" } } },
  { comprovaEmissao: true, emissao: { cobranca: { id: primeira.cobrancaId, valorOriginal: "156.25", saldo: "156.25" } } },
  { comprovaEmissao: false, emissao: null }] } });
 expect(() => JSON.stringify(historico)).not.toThrow();
 const versaoComplementar = await prisma.decisaoFechamentoHoras.findUniqueOrThrow({ where: { id: complementar } });
 const versaoParcial = await prisma.decisaoFechamentoHoras.findUniqueOrThrow({ where: { id: parcial } });
 expect(await consultarFechamentosHoras({ alunoId: d.alunoId, matriculaId, rascunhoId: versaoComplementar.rascunhoId })).toMatchObject({ ok: true, dado: {
  cobrancasAnteriores: [{ cobrancaId: primeira.cobrancaId, rascunhoId: versaoParcial.rascunhoId }],
  versoes: [{ memoria: { apuracao: { origens: expect.arrayContaining([{ encontroId: novo.id, inicio: "2026-01-15T15:00:00.000Z", fim: "2026-01-15T16:00:00.000Z", status: "PREVISTO", conferenciaId: expect.any(String), informeId: o.id }]) } } }] } });
 expect(await prisma.recebimento.count()).toBe(0);
});

it("emissões concorrentes de períodos sobrepostos não faturam a mesma conferência duas vezes", async () => {
 const { d } = await prepararPreviaFinanceira();
 const { preverConferenciaOcorrenciaHoras } = await import("./ocorrencia-financeira-previa");
 const { conferirOcorrenciaHoras } = await import("./ocorrencia-financeira-conferir");
 const { prepararFechamentoHoras } = await import("./fechamento-horas-rascunho");
 const { decidirFechamentoHoras } = await import("./fechamento-horas-decisao");
 const { emitirFechamentoHoras } = await import("./fechamento-horas-emissao");
 const previa = await preverConferenciaOcorrenciaHoras(d); if (!previa.ok || !previa.dado) throw new Error("Prévia ausente");
 expect(await conferirOcorrenciaHoras({ ...d, estadoPrevia: previa.dado.estadoPrevia, motivo: "Conferência do encontro compartilhado", chaveIdempotencia: "sobreposicao-conferencia" })).toMatchObject({ ok: true });
 const base = { alunoId: d.alunoId, matriculaId, documentoId, versaoAnterior: 0,
  periodo: { referencia: { referencia: "MES_CIVIL" as const }, dataNoPeriodo: "2026-01-15", fuso: "America/Sao_Paulo", vencimento: "2026-02-10", clausula: "Período proposto para revisão contratual" },
  escolha: "AGUARDAR" as const, motivo: "Revisão da referência do fechamento", chaveIdempotencia: "sobreposicao-mes-civil" };
 const civil = await prepararFechamentoHoras(base);
 const ciclo = await prepararFechamentoHoras({ ...base, periodo: { ...base.periodo, referencia: { referencia: "CICLO_MATRICULA", dataReferencia: "2026-01-05" } }, chaveIdempotencia: "sobreposicao-ciclo" });
 if (!civil.ok || !civil.dado || !ciclo.ok || !ciclo.dado) throw new Error("Rascunhos ausentes");
 const aprovador = await criarUsuario(["ADMINISTRADOR"]); login(aprovador.id);
 const decisoes: string[] = [];
 for (const rascunhoId of [civil.dado.id, ciclo.dado.id]) {
  const dec = await decidirFechamentoHoras({ alunoId: d.alunoId, matriculaId, rascunhoId, aprovar: true, confirmaReferenciaContratual: true, motivo: "Conferência independente da proposta" });
  if (!dec.ok || !dec.dado) throw new Error("Decisão ausente"); decisoes.push(dec.dado.id);
 }
 const emitir = (decisaoId: string) => emitirFechamentoHoras({ alunoId: d.alunoId, matriculaId, decisaoId });
 const resultados = await Promise.all(decisoes.map(emitir));
 expect(resultados.filter(r => r.ok)).toHaveLength(1);
 expect(resultados.filter(r => !r.ok)).toEqual([{ ok: false, erro: expect.stringContaining("origens") }]);
 expect(await prisma.cobranca.count()).toBe(1); expect(await prisma.emissaoFechamentoHoras.count()).toBe(1); expect(await prisma.itemFechamentoHoras.count()).toBe(1);
 const vencedora = resultados.findIndex(r => r.ok), perdedora = 1 - vencedora;
 expect(await emitir(decisoes[vencedora])).toEqual(resultados[vencedora]);
 expect(await emitir(decisoes[perdedora])).toMatchObject({ ok: false, erro: expect.stringContaining("origens") });
 expect(await prisma.recebimento.count()).toBe(0);
});

it("Financeiro lê apenas contrato confirmado e vinculado, sem liberar outros documentos", async () => {
 const { podeLerArquivo } = await import("@/server/uploads/autorizacao");
 const financeiro = await criarUsuario(["FINANCEIRO"]);
 const usuario = { id: financeiro.id, papeis: financeiro.papeis };
 expect(await podeLerArquivo(usuario, ["contrato-horas.pdf"])).toBe(true);
 const professor = await criarUsuario(["PROFESSOR"]);
 expect(await podeLerArquivo({ id: professor.id, papeis: professor.papeis }, ["contrato-horas.pdf"])).toBe(false);
 await prisma.matricula.update({ where: { id: matriculaId }, data: { contratoOk: false } });
 expect(await podeLerArquivo(usuario, ["contrato-horas.pdf"])).toBe(false);
 await prisma.matricula.update({ where: { id: matriculaId }, data: { contratoOk: true } });
 await prisma.documento.update({ where: { id: documentoId }, data: { categoria: "OUTRO" } });
 expect(await podeLerArquivo(usuario, ["contrato-horas.pdf"])).toBe(false);
 await prisma.documento.update({ where: { id: documentoId }, data: { categoria: "CONTRATO", arquivado: true } });
 expect(await podeLerArquivo(usuario, ["contrato-horas.pdf"])).toBe(false);
});

it.each(["13:00", "14:00"])("encerramento confere cancelamento do aluno comunicado às %s", async horario => {
 const { d, e, professor } = await prepararPreviaFinanceira();
 const { proporCancelamentoParticular, decidirCancelamentoParticular } = await import("@/server/agenda/cancelamento-particular");
 const { registrarOcorrenciaParticular } = await import("./ocorrencia-particular");
 const { preverConferenciaOcorrenciaHoras } = await import("./ocorrencia-financeira-previa");
 const { conferirOcorrenciaHoras } = await import("./ocorrencia-financeira-conferir");
 const { carregarImpactosAcademicosEncerramentoTx } = await import("./encerramento-impactos-academicos");
 const { conferirAgendaEncerramentoTx } = await import("./encerramento-agenda");
 login(professor.id);
 const p = await proporCancelamentoParticular({ encontroId: e.id, origem: "ALUNO", motivo: "Cancelamento informado pelo aluno", chaveIdempotencia: "encerramento-cancelamento" });
 if (!p.ok || !p.dado) throw new Error("Proposta ausente");
 login(adminId); expect(await decidirCancelamentoParticular({ propostaId: p.dado.id, aprovar: true, motivo: "Cancelamento conferido" })).toMatchObject({ ok: true });
 const agenda = () => prisma.$transaction(async tx => conferirAgendaEncerramentoTx(tx, await carregarImpactosAcademicosEncerramentoTx(tx, d.alunoId, matriculaId), "2026-01-31", "America/Sao_Paulo", true));
 expect((await agenda()).pendencias).toHaveLength(1);
 login(professor.id);
 const o = await registrarOcorrenciaParticular({ encontroId: e.id, versaoAnterior: 1, tipo: "CANCELAMENTO_ALUNO", comunicadoEm: `2026-01-10T${horario}:00Z`, evidencia: "Comunicação para conferência", chaveIdempotencia: "encerramento-informe-cancelamento" });
 if (!o.ok || !o.dado) throw new Error("Informe ausente");
 login(adminId); const consulta = { ...d, ocorrenciaId: o.dado.id };
 const previa = await preverConferenciaOcorrenciaHoras(consulta); if (!previa.ok || !previa.dado) throw new Error("Prévia ausente");
 expect(await conferirOcorrenciaHoras({ ...consulta, estadoPrevia: previa.dado.estadoPrevia, motivo: "Conferência para encerramento", chaveIdempotencia: "encerramento-conferencia-cancelamento" })).toMatchObject({ ok: true });
 const resultado = await agenda();
 if (horario === "13:00") expect(resultado).toMatchObject({ pendencias: [], destinacoesHoras: [{ tipo: "SEM_COBRANCA" }] });
 else expect(resultado).toMatchObject({ pendencias: [expect.stringContaining("sem destinação financeira")], destinacoesHoras: [] });
});
