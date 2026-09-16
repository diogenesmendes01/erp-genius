import { beforeEach, expect, it, vi } from "vitest";

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
import { prepararCondicoesContinuidadeMensal, decidirCondicoesContinuidadeMensal, consultarCondicoesContinuidadeMensal } from "./condicoes-continuidade-mensal";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { prepararContratacaoTx } from "./preparacao-comercial-tx";
let matriculaId: string, documentoId: string, secretariaId: string, adminId: string, turmaId: string;
const regras = { continuidadeContratada: { contratada: true as const, clausula: "Continuidade mensal contratada", evidenciaId: "" }, regraCobertura: { referencia: "MES_CIVIL" as const }, diaVencimento: 5, antecedenciaDias: 10, referenciaVencimento: "MES_COBERTURA" as const, valorOriginal: "125.00", valorNegociado: "125.00", moeda: "CRC", ajusteVencimento: "MANTER_DATA" as const, vigenteDesde: "2026-01-01" };
const input = () => ({ matriculaId, documentoId, regras, motivo: "Transcrição das condições aceitas" });
const login = (id: string) => authMock.mockResolvedValue({ user: { id } });
const ajusteFinanceiro = () => ({ regra: "PROXIMO_DIA_UTIL" as const, calendario: {
  id: "referencia-financeira", versao: 1, referencia: "Condições financeiras contratadas",
  inicioVigencia: "2026-01-01", fimVigencia: "2026-12-31", diasSemanaUteis: [1, 2, 3, 4, 5], feriados: ["2026-03-02"],
} });
beforeEach(async () => {
  await truncarBanco();
  await prisma.configuracaoOperacional.upsert({ where: { id: "escola" }, create: { prazoReservaMinutos: 60, fusoInstitucional: "UTC" }, update: { prazoReservaMinutos: 60, fusoInstitucional: "UTC" } });
  const c = await seedCatalogoMinimo();
  secretariaId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id; adminId = (await criarUsuario(["ADMINISTRADOR"])).id;
  const a = await prisma.aluno.create({ data: { primeiroNome: "Condições mensais", paisId: c.pais.id } });
  const produto = await prisma.produto.findUniqueOrThrow({ where: { id: c.produto.id } });
  const professor = await criarUsuario(["PROFESSOR"]);
  const nivel = await prisma.nivel.create({ data: { idiomaId: produto.idiomaId, codigo: "CONDICOES", ordem: 1 } });
  const turma = await prisma.turma.create({ data: { modalidadeId: produto.modalidadeId, nivelId: nivel.id, professorId: professor.id, capacidade: 4 } }); turmaId = turma.id;
  const janela = await prisma.janelaAdmissaoTurma.create({ data: { turmaId: turma.id, preparadorId: secretariaId, versao: 1, limiteEntrada: new Date("2099-12-31"), fusoAdmissao: "UTC", motivo: "Janela real da preparação mensal", chaveIdempotencia: "condicoes-janela", entradaHash: "fixture" } });
  await prisma.decisaoJanelaAdmissao.create({ data: { propostaId: janela.id, decisorId: adminId, aprovada: true, motivo: "Janela conferida para preparação" } });
  const calendario = await prisma.versaoCalendarioEscolar.create({ data: { versao: 1, preparadorId: secretariaId, fusoInstitucional: "UTC", periodos: [], motivo: "Calendário da preparação mensal", chaveIdempotencia: "condicoes-calendario", entradaHash: "fixture" } });
  await prisma.decisaoCalendarioEscolar.create({ data: { calendarioId: calendario.id, decisorId: adminId, aprovada: true, motivo: "Calendário conferido" } });
  const grade = await prisma.propostaGradeTurma.create({ data: { turmaId: turma.id, calendarioId: calendario.id, preparadorId: secretariaId, versao: 1, fusoOrigem: "UTC", motivo: "Grade da preparação mensal", chaveIdempotencia: "condicoes-grade", entradaHash: "fixture", snapshot: {} } });
  await prisma.decisaoGradeTurma.create({ data: { propostaId: grade.id, decisorId: adminId, aprovada: true, motivo: "Grade conferida" } });
  await prisma.encontroAgenda.create({ data: { turmaId: turma.id, propostaGradeId: grade.id, professorId: professor.id, preparadorId: secretariaId, inicio: new Date("2099-10-01T12:00:00Z"), fim: new Date("2099-10-01T13:00:00Z"), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Aula da preparação mensal", chaveIdempotencia: "condicoes-encontro", entradaHash: "fixture" } });
  const lead = await prisma.lead.create({ data: { nome: "Contratação mensal das condições", vendedorDonoId: secretariaId } });
  const preparacao = await prisma.$transaction((tx) => prepararContratacaoTx(tx, { autorId: secretariaId, leadId: lead.id, alunoId: a.id, produtoId: c.produto.id, paisId: c.pais.id, turmaId: turma.id, regime: "MENSALIDADE", taxaProposta: "100", valorServicoProposto: "200", motivo: "Preparação mensal real para condições", chaveIdempotencia: "condicoes-preparacao-mensal" }));
  matriculaId = preparacao.matriculaId;
  documentoId = (await prisma.documento.create({ data: { matriculaId, categoria: "CONTRATO", nome: "Contrato", url: "/api/files/contrato-mensal.pdf" } })).id;
  regras.continuidadeContratada.evidenciaId = documentoId;
  await prisma.matricula.update({ where: { id: matriculaId }, data: { contratoOk: true, contratoDocumentoId: documentoId, confirmacaoContratoPorId: secretariaId, confirmacaoContratoEm: new Date() } }); login(secretariaId);
});
it("preserva calendário financeiro aprovado e calcula a partir dessa versão sem modificar cobranças", async () => {
  const ajusteVencimento = ajusteFinanceiro();
  const p = await prepararCondicoesContinuidadeMensal({ ...input(), regras: { ...regras, diaVencimento: 31, ajusteVencimento } });
  if (!p.ok || !p.dado) throw new Error(JSON.stringify(p));
  login(adminId);
  expect(await decidirCondicoesContinuidadeMensal({ id: p.dado.id, aprovar: true, motivo: "Calendário contratual conferido" })).toMatchObject({ ok: true });
  const persistida = await prisma.condicoesContinuidadeMensalMatricula.findUniqueOrThrow({ where: { id: p.dado.id } });
  const { RegrasContinuidadeMensalSchema } = await import("./continuidade-mensal-schema");
  const { planejarContinuidadeMensal } = await import("./continuidade-mensal");
  expect(planejarContinuidadeMensal({ ...RegrasContinuidadeMensalSchema.parse(persistida.regras), ultimaCobertura: { inicio: "2026-01-01", fim: "2026-01-31" }, dataPlanejamento: "2026-02-20" })).toMatchObject({
    vencimento: "2026-03-03", emissaoEm: "2026-02-21", memoriaVencimento: { dataCalculada: "2026-02-28", referenciaCalendarioAplicada: { id: "referencia-financeira", versao: 1 } },
  });
  await expect(prisma.condicoesContinuidadeMensalMatricula.update({ where: { id: p.dado.id }, data: { regras: { ...regras, ajusteVencimento: { ...ajusteVencimento, calendario: { ...ajusteVencimento.calendario, feriados: [] } } } } })).rejects.toThrow();
  expect(await prisma.cobranca.count()).toBe(0);
});

it("banco recusa calendário financeiro incompleto, ambíguo ou fora da vigência", async () => {
  const a = ajusteFinanceiro();
  for (const ajusteVencimento of [
    { regra: "PROXIMO_DIA_UTIL" },
    { ...a, calendario: { ...a.calendario, diasSemanaUteis: [1, 1] } },
    { ...a, calendario: { ...a.calendario, diasSemanaUteis: [7] } },
    { ...a, calendario: { ...a.calendario, diasSemanaUteis: [] } },
    { ...a, calendario: { ...a.calendario, versao: 1.5 } },
    { ...a, calendario: { ...a.calendario, feriados: ["2026-03-02", "2026-03-02"] } },
    { ...a, calendario: { ...a.calendario, feriados: ["2027-01-01"] } },
    { ...a, calendario: { ...a.calendario, feriados: ["2026-02-30"] } },
    { ...a, calendario: { ...a.calendario, inicioVigencia: "0000-01-01" } },
    { regra: "MANTER_DATA", calendario: a.calendario },
  ]) {
    await expect(prisma.condicoesContinuidadeMensalMatricula.create({ data: { ...input(), preparadorId: secretariaId, versao: 1, regras: { ...regras, ajusteVencimento } } })).rejects.toThrow();
  }
  expect(await prisma.condicoesContinuidadeMensalMatricula.count()).toBe(0);
});
it("prepara versão pendente e exige outra pessoa para aprovar, preservando as condições", async () => {
  const p = await prepararCondicoesContinuidadeMensal(input()); expect(p.ok, p.ok ? undefined : p.erro).toBe(true);
  if (!p.ok || !p.dado) throw new Error("Proposta ausente");
  expect(await consultarCondicoesContinuidadeMensal(matriculaId)).toMatchObject({ ok: true, dado: { podePreparar: false, versoes: [{ regras, podeDecidir: false }] } });
  expect(await prepararCondicoesContinuidadeMensal(input())).toMatchObject({ ok: false });
  await prisma.usuario.update({ where: { id: secretariaId }, data: { papeis: ["ADMINISTRADOR"] } });
  const d = { id: p.dado.id, aprovar: true, motivo: "Contrato conferido" };
  expect(await decidirCondicoesContinuidadeMensal(d)).toMatchObject({ ok: false });
  await expect(prisma.condicoesContinuidadeMensalMatricula.update({ where: { id: d.id }, data: { status: "APROVADA", decisorId: secretariaId, decididaEm: new Date(), motivoDecisao: d.motivo } })).rejects.toThrow(/Outra pessoa/);
  login(adminId);
  expect(await consultarCondicoesContinuidadeMensal(matriculaId)).toMatchObject({ ok: true, dado: { versoes: [{ podeDecidir: true }] } });
  expect(await decidirCondicoesContinuidadeMensal(d)).toMatchObject({ ok: true });
  expect(await prisma.condicoesContinuidadeMensalMatricula.findUnique({ where: { id: d.id } })).toMatchObject({ status: "APROVADA", regras });
  await expect(prisma.condicoesContinuidadeMensalMatricula.update({ where: { id: d.id }, data: { regras: { ...regras, valorNegociado: "999" } } })).rejects.toThrow(/preservadas/);
  await expect(prisma.condicoesContinuidadeMensalMatricula.deleteMany()).rejects.toThrow(/preservadas/);
  expect(await prisma.cobranca.count()).toBe(0);
  expect(await consultarCondicoesContinuidadeMensal(matriculaId)).toMatchObject({ ok: true, dado: { versoes: [{ status: "APROVADA", podeDecidir: false }] } });
});

it("consulta financeira é somente leitura e professor não consulta preços contratuais", async () => {
  await prepararCondicoesContinuidadeMensal(input());
  login((await criarUsuario(["FINANCEIRO"])).id);
  expect(await consultarCondicoesContinuidadeMensal(matriculaId)).toMatchObject({ ok: true, dado: { podePreparar: false, versoes: [{ podeDecidir: false }] } });
  login((await criarUsuario(["PROFESSOR"])).id);
  expect(await consultarCondicoesContinuidadeMensal(matriculaId)).toMatchObject({ ok: false });
  login(secretariaId); await prisma.usuario.update({ where: { id: secretariaId }, data: { ativo: false } });
  expect(await consultarCondicoesContinuidadeMensal(matriculaId)).toMatchObject({ ok: false });
});
it("recusa ausência ou preparação por hora, sem tratar contrato confirmado como contratação mensal", async () => {
  const atual = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const semPreparacao = await prisma.matricula.create({ data: { alunoId: atual.alunoId, produtoId: atual.produtoId, paisId: atual.paisId, moeda: atual.moeda } });
  const documentoSemPreparacao = await prisma.documento.create({ data: { matriculaId: semPreparacao.id, categoria: "CONTRATO", nome: "Contrato sem preparação", url: "/api/files/contrato-sem-preparacao.pdf" } });
  await prisma.matricula.update({ where: { id: semPreparacao.id }, data: { contratoOk: true, contratoDocumentoId: documentoSemPreparacao.id, confirmacaoContratoPorId: secretariaId, confirmacaoContratoEm: new Date() } });
  await expect(prepararCondicoesContinuidadeMensal({ ...input(), matriculaId: semPreparacao.id, documentoId: documentoSemPreparacao.id, regras: { ...regras, continuidadeContratada: { ...regras.continuidadeContratada, evidenciaId: documentoSemPreparacao.id } } })).resolves.toMatchObject({ ok: false });

  const lead = await prisma.lead.create({ data: { nome: "Contratação por hora", vendedorDonoId: secretariaId } });
  const porHora = await prisma.$transaction((tx) => prepararContratacaoTx(tx, { autorId: secretariaId, leadId: lead.id, alunoId: atual.alunoId, produtoId: atual.produtoId, paisId: atual.paisId, turmaId, regime: "HORA_PARTICULAR", taxaProposta: "100", valorServicoProposto: "200", motivo: "Preparação por hora real para recusa", chaveIdempotencia: "condicoes-preparacao-hora" }));
  const documentoHora = await prisma.documento.create({ data: { matriculaId: porHora.matriculaId, categoria: "CONTRATO", nome: "Contrato por hora", url: "/api/files/contrato-hora.pdf" } });
  await prisma.matricula.update({ where: { id: porHora.matriculaId }, data: { contratoOk: true, contratoDocumentoId: documentoHora.id, confirmacaoContratoPorId: secretariaId, confirmacaoContratoEm: new Date() } });
  await expect(prepararCondicoesContinuidadeMensal({ ...input(), matriculaId: porHora.matriculaId, documentoId: documentoHora.id, regras: { ...regras, continuidadeContratada: { ...regras.continuidadeContratada, evidenciaId: documentoHora.id } } })).resolves.toMatchObject({ ok: false });
});

it("exige parâmetros completos e não usa outra moeda ou contrato não confirmado", async () => {
  expect(await prepararCondicoesContinuidadeMensal({ ...input(), regras: { ...regras, continuidadeContratada: { ...regras.continuidadeContratada, evidenciaId: "outro-documento" } } })).toMatchObject({ ok: false });
  expect(await prepararCondicoesContinuidadeMensal({ ...input(), regras: { ...regras, antecedenciaDias: undefined } } as never)).toMatchObject({ ok: false });
  expect(await prepararCondicoesContinuidadeMensal({ ...input(), regras: { ...regras, moeda: "BRL" } })).toMatchObject({ ok: false });
  await prisma.matricula.update({ where: { id: matriculaId }, data: { contratoOk: false } });
  expect(await prepararCondicoesContinuidadeMensal(input())).toMatchObject({ ok: false });
});
it("serializa preparações, recusa fonte alterada e permite rejeitar a transcrição pendente", async () => {
  const resultados = await Promise.all([prepararCondicoesContinuidadeMensal(input()), prepararCondicoesContinuidadeMensal(input())]);
  expect(resultados.filter(r => r.ok)).toHaveLength(1);
  const p = await prisma.condicoesContinuidadeMensalMatricula.findFirstOrThrow();
  await prisma.documento.update({ where: { id: documentoId }, data: { arquivado: true } });
  login(adminId); expect(await decidirCondicoesContinuidadeMensal({ id: p.id, aprovar: true, motivo: "Conferência atual" })).toMatchObject({ ok: false });
  expect(await decidirCondicoesContinuidadeMensal({ id: p.id, aprovar: false, motivo: "Fonte indisponível" })).toMatchObject({ ok: true });
});
it("banco exige preparação regular e moeda válida, sem aceitar aprovação direta", async () => {
  const data = { ...input(), preparadorId: secretariaId, versao: 1 };
  await expect(prisma.condicoesContinuidadeMensalMatricula.create({ data: { ...data, status: "APROVADA", decisorId: adminId, decididaEm: new Date(), motivoDecisao: "Direto indevido" } })).rejects.toThrow(/Prepare/);
  await expect(prisma.condicoesContinuidadeMensalMatricula.create({ data: { ...data, regras: { ...regras, moeda: "BRL" } } })).rejects.toThrow(/moeda compatível/);
  await prisma.usuario.update({ where: { id: secretariaId }, data: { ativo: false } });
  expect(await prepararCondicoesContinuidadeMensal(input())).toMatchObject({ ok: false });
});

it("banco recusa transcrição incompleta ou datas inválidas antes da aprovação", async () => {
  const data = { ...input(), preparadorId: secretariaId, versao: 1 };
  for (const invalidas of [
    { continuidadeContratada: regras.continuidadeContratada, regraCobertura: {}, moeda: "CRC" },
    { ...regras, continuidadeContratada: { ...regras.continuidadeContratada, contratada: "true" } },
    { ...regras, diaVencimento: 32 },
    { ...regras, antecedenciaDias: 0.5 },
    { ...regras, referenciaVencimento: undefined },
    { ...regras, referenciaVencimento: "MES_DA_ULTIMA_COBRANCA" },
    { ...regras, vigenteDesde: "2026-02-30" },
    { ...regras, regraCobertura: { referencia: "CICLO_MATRICULA" } },
    { ...regras, valorNegociado: 125 },
    { ...regras, autorizarRenovacaoSemContrato: true },
  ]) {
    await expect(prisma.condicoesContinuidadeMensalMatricula.create({ data: { ...data, regras: invalidas } })).rejects.toThrow();
  }
  expect(await prisma.condicoesContinuidadeMensalMatricula.count()).toBe(0);
  expect(await prepararCondicoesContinuidadeMensal(input())).toMatchObject({ ok: true });
});

it("prévia não autoriza consulta docente nem transforma configuração ausente em cobrança", async () => {
  const { consultarPreviaContinuidadeMensal } = await import("./continuidade-previa");
  expect(await consultarPreviaContinuidadeMensal(matriculaId)).toMatchObject({ ok: false });
  login((await criarUsuario(["PROFESSOR"])).id);
  expect(await consultarPreviaContinuidadeMensal(matriculaId)).toMatchObject({ ok: false });
  expect(await prisma.cobranca.count()).toBe(0);
});

it.each(["MES_ANTERIOR", "MES_COBERTURA", "MES_SEGUINTE"] as const)("preserva referência contratual %s após aprovação sem alterar cobranças emitidas", async (referenciaVencimento) => {
  const c = await prisma.cobranca.create({ data: { matriculaId, tipo: "MENSALIDADE", valorOriginal: 125, valorNegociado: 125, moeda: "CRC", vencimento: new Date("2026-09-05"), coberturaInicio: new Date("2026-11-01"), coberturaFim: new Date("2026-11-30") } });
  const p = await prepararCondicoesContinuidadeMensal({ ...input(), regras: { ...regras, referenciaVencimento, ajusteVencimento: { regra: "MANTER_DATA" } } });
  if (!p.ok || !p.dado) throw new Error(JSON.stringify(p));
  login(adminId);
  expect(await decidirCondicoesContinuidadeMensal({ id: p.dado.id, aprovar: true, motivo: "Referência de vencimento conferida no contrato" })).toMatchObject({ ok: true });
  expect(await consultarCondicoesContinuidadeMensal(matriculaId)).toMatchObject({ ok: true, dado: { versoes: [{ regras: { referenciaVencimento } }] } });
  expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: c.id } })).toEqual(c);
});
