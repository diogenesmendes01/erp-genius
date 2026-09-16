import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { authMock, enviarEmailMock, enviarTemplateMock } = vi.hoisted(() => ({ authMock: vi.fn(), enviarEmailMock: vi.fn(), enviarTemplateMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/server/email/resend", () => ({ enviarEmailResend: enviarEmailMock }));
vi.mock("@/server/whatsapp/drivers/meta-cloud", () => ({ driverMetaCloud: { enviarTexto: vi.fn(), enviarMidia: vi.fn(), enviarTemplate: enviarTemplateMock } }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { criarAvisosAlteracaoAgendaTx, despacharAvisoAlteracaoAgendaInterna, entregarAvisoAlteracaoAgenda } from "@/server/comunicacoes-agenda/avisos";
import { prepararSubstituicaoDocente } from "./substituicao";
import { decidirSubstituicaoDocente } from "./substituicao-decisao";
import { processarAvisosAlteracaoAgenda } from "@/server/comunicacoes-agenda/avisos";
import { enfileirarAvisosAgendaWhatsApp } from "@/server/comunicacoes-agenda/whatsapp";
import { despacharFila } from "@/server/whatsapp/despachante";
import { ErroDriver } from "@/server/whatsapp/canal";

let secretariaId: string;
let gestorId: string;
let titularId: string;
let substitutoId: string;
let turmaId: string;
let encontroId: string;
let matriculasElegiveis: string[];
let catalogo: Awaited<ReturnType<typeof seedCatalogoMinimo>>;

async function prepararTroca() {
  authMock.mockResolvedValue({ user: { id: secretariaId } });
  const proposta = await prepararSubstituicaoDocente({
    encontrosIds: [encontroId], substitutoId, motivo: "Cobertura do docente da turma regular", chaveIdempotencia: "substituicao-aviso-turma",
  });
  if (!proposta.ok || !proposta.dado) throw new Error("Proposta de substituição ausente.");
  return proposta.dado.id;
}

async function decidir(aprovar: boolean) {
  const propostaId = await prepararTroca();
  authMock.mockResolvedValue({ user: { id: gestorId } });
  return decidirSubstituicaoDocente({ propostaId, aprovar, motivo: aprovar ? "Troca conferida por outra pessoa" : "Troca recusada pela gestão" });
}

async function avisosPreparados() {
  return prisma.avisoAlteracaoAgenda.findMany({
    where: { matriculaId: { in: matriculasElegiveis } },
    include: { itens: true, aluno: { select: { email: true } } },
    orderBy: { matriculaId: "asc" },
  });
}

beforeEach(async () => {
  await truncarBanco();
  catalogo = await seedCatalogoMinimo();
  secretariaId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  gestorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  titularId = (await criarUsuario(["PROFESSOR"])).id;
  substitutoId = (await criarUsuario(["PROFESSOR"])).id;
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "AVISO-REGULAR", ordem: 1 } });
  turmaId = (await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: titularId, status: "ABERTA" } })).id;
  matriculasElegiveis = [];
  for (const nome of ["Primeira", "Segunda", "Fora do vínculo"]) {
    const aluno = await prisma.aluno.create({ data: { primeiroNome: nome, paisId: catalogo.pais.id, email: `${nome.replaceAll(" ", ".").toLowerCase()}@example.test`, aceitaComunicacoes: true } });
    const matricula = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } });
    await prisma.alocacaoTurma.create({ data: {
      alunoId: aluno.id, matriculaId: matricula.id, turmaId, criadoEm: new Date("2099-09-01T00:00:00.000Z"),
      ...(nome === "Fora do vínculo" ? { encerradaEm: new Date("2099-10-01T10:00:00.000Z") } : {}),
    } });
    if (nome !== "Fora do vínculo") {
      matriculasElegiveis.push(matricula.id);
    }
  }
  encontroId = (await prisma.encontroAgenda.create({ data: {
    turmaId, professorId: titularId, preparadorId: secretariaId, inicio: new Date("2099-10-01T10:00:00.000Z"), fim: new Date("2099-10-01T11:00:00.000Z"),
    fusoOrigem: "UTC", status: "PREVISTO", motivo: "Aula regular com substituição", chaveIdempotencia: "aula-regular-substituicao", entradaHash: "fixture",
  } })).id;
  enviarEmailMock.mockReset();
  enviarTemplateMock.mockReset();
});

afterEach(() => vi.unstubAllEnvs());

async function configurarCanalAgenda() {
  const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+50675555555", rotulo: "Agenda", driver: "META_CLOUD", finalidade: "AGENDA", providerRef: "phone-agenda" } });
  const template = await prisma.templateWhatsApp.create({ data: { nome: "agenda_docente", corpo: "Olá {nome}. Horários: {horarios}", idioma: "es", categoria: "utility", statusMeta: "APROVADO", metaTemplateId: "waba-template-agenda" } });
  await prisma.configuracaoOperacional.create({ data: { id: "escola", numeroAvisosAgendaId: numero.id, templateAvisosAgendaId: template.id } });
  return { numero, template };
}

async function ativarWhatsappDaPrimeira() {
  const matricula = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculasElegiveis[0] } });
  await prisma.aluno.update({ where: { id: matricula.alunoId }, data: { whatsapp: true, telefoneE164: "+50670000001" } });
}

it("avisa somente as duas matrículas vinculadas à turma e renderiza a troca docente", async () => {
  expect(await decidir(true)).toMatchObject({ ok: true, dado: { aplicada: true } });
  const avisos = await avisosPreparados();
  expect(avisos).toHaveLength(2);
  expect(avisos.map((aviso) => aviso.matriculaId).sort()).toEqual([...matriculasElegiveis].sort());
  expect(avisos.every((aviso) => aviso.canal === "EMAIL" && aviso.itens.map((item) => item.encontroId).includes(encontroId))).toBe(true);
  expect(await prisma.avisoAlteracaoAgenda.count()).toBe(2);

  const transporte = vi.fn(async (_entrada: { canal: "EMAIL" | "WHATSAPP"; destinatario: string; avisoId: string; encontrosIds: string[] }) => ({ situacao: "ACEITO" as const, provedorId: "aceite-no-provedor" }));
  await Promise.all(avisos.map((aviso) => despacharAvisoAlteracaoAgendaInterna(aviso.id, transporte)));
  expect(transporte).toHaveBeenCalledTimes(2);
  expect(transporte.mock.calls.map(([entrada]) => entrada).every((entrada) => entrada.canal === "EMAIL" && entrada.encontrosIds.includes(encontroId))).toBe(true);
  expect(await prisma.avisoAlteracaoAgenda.count({ where: { situacao: "ENVIADO" } })).toBe(2);

  enviarEmailMock.mockResolvedValue({ situacao: "ACEITO", provedorId: "renderer-aceito" });
  const avisoPrimeira = avisos.find((aviso) => aviso.aluno.email === "primeira@example.test");
  if (!avisoPrimeira) throw new Error("Aviso da primeira matrícula ausente.");
  const renderizado = await entregarAvisoAlteracaoAgenda({ canal: "EMAIL", destinatario: "primeira@example.test", avisoId: avisoPrimeira.id, encontrosIds: [encontroId] });
  expect(renderizado).toEqual({ situacao: "ACEITO", provedorId: "renderer-aceito" });
  expect(enviarEmailMock).toHaveBeenCalledWith(expect.objectContaining({
    destinatario: "primeira@example.test", assunto: "Alteração de docente", texto: expect.stringContaining("O docente da sua aula foi alterado."),
  }));
});

it("renderiza somente os itens persistidos do aviso quando a decisão abrange turmas distintas", async () => {
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "AVISO-SEGUNDA-TURMA", ordem: 2 } });
  const segundaTurma = await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: titularId, status: "ABERTA" } });
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Terceira turma", paisId: catalogo.pais.id, email: "terceira.turma@example.test", aceitaComunicacoes: true } });
  const matricula = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } });
  await prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, matriculaId: matricula.id, turmaId: segundaTurma.id, criadoEm: new Date("2099-09-01T00:00:00.000Z") } });
  const encontroDaOutraTurma = await prisma.encontroAgenda.create({ data: {
    turmaId: segundaTurma.id, professorId: titularId, preparadorId: secretariaId, inicio: new Date("2099-10-02T14:00:00.000Z"), fim: new Date("2099-10-02T15:00:00.000Z"),
    fusoOrigem: "UTC", status: "PREVISTO", motivo: "Aula de outra turma", chaveIdempotencia: "aula-outra-turma-substituicao", entradaHash: "fixture",
  } });
  authMock.mockResolvedValue({ user: { id: secretariaId } });
  const proposta = await prepararSubstituicaoDocente({
    encontrosIds: [encontroId, encontroDaOutraTurma.id], substitutoId, motivo: "Cobertura de turmas distintas", chaveIdempotencia: "substituicao-aviso-duas-turmas",
  });
  if (!proposta.ok || !proposta.dado) throw new Error("Proposta de duas turmas ausente.");
  authMock.mockResolvedValue({ user: { id: gestorId } });
  expect(await decidirSubstituicaoDocente({ propostaId: proposta.dado.id, aprovar: true, motivo: "Troca conferida por outra pessoa" })).toMatchObject({ ok: true });
  const avisoPrimeira = await prisma.avisoAlteracaoAgenda.findFirstOrThrow({ where: { matriculaId: matriculasElegiveis[0] } });
  const avisoTerceira = await prisma.avisoAlteracaoAgenda.findFirstOrThrow({ where: { matriculaId: matricula.id } });
  enviarEmailMock.mockResolvedValue({ situacao: "ACEITO", provedorId: "renderer-aceito" });
  await expect(entregarAvisoAlteracaoAgenda({ canal: "EMAIL", destinatario: "primeira@example.test", avisoId: avisoPrimeira.id, encontrosIds: [encontroId, encontroDaOutraTurma.id] })).resolves.toEqual({ situacao: "RECUSADO" });
  await entregarAvisoAlteracaoAgenda({ canal: "EMAIL", destinatario: "primeira@example.test", avisoId: avisoPrimeira.id, encontrosIds: [encontroId] });
  await entregarAvisoAlteracaoAgenda({ canal: "EMAIL", destinatario: "terceira.turma@example.test", avisoId: avisoTerceira.id, encontrosIds: [encontroDaOutraTurma.id] });
  expect(enviarEmailMock).toHaveBeenCalledTimes(2);
  const [primeira, terceira] = enviarEmailMock.mock.calls.map(([entrada]) => entrada as { texto: string });
  expect(primeira.texto).toContain("01/10/2099");
  expect(primeira.texto).not.toContain("02/10/2099");
  expect(terceira.texto).toContain("02/10/2099");
  expect(terceira.texto).not.toContain("01/10/2099");
});

it("recusa o renderer quando o email muda entre o claim e o transporte", async () => {
  expect(await decidir(true)).toMatchObject({ ok: true });
  const aviso = await prisma.avisoAlteracaoAgenda.findFirstOrThrow({ where: { matriculaId: matriculasElegiveis[0] } });
  enviarEmailMock.mockResolvedValue({ situacao: "ACEITO", provedorId: "nao-deve-enviar" });
  await expect(despacharAvisoAlteracaoAgendaInterna(aviso.id, async (entrada) => {
    await prisma.aluno.update({ where: { id: aviso.alunoId }, data: { email: "email-atualizado@example.test" } });
    return entregarAvisoAlteracaoAgenda(entrada);
  })).resolves.toMatchObject({ enviado: false, recusado: true });
  expect(enviarEmailMock).not.toHaveBeenCalled();
  expect(await prisma.avisoAlteracaoAgenda.findUniqueOrThrow({ where: { id: aviso.id } })).toMatchObject({ situacao: "FALHOU" });
});

it("não cria avisos para uma decisão recusada e desfaz a fila quando a transação falha", async () => {
  expect(await decidir(false)).toMatchObject({ ok: true, dado: { aplicada: false } });
  expect(await prisma.avisoAlteracaoAgenda.count()).toBe(0);
  const evento = await prisma.evento.create({ data: {
    tipo: "SubstituicaoDocenteDecidida", agregadoTipo: "ConfiguracaoOperacional", agregadoId: "escola", payload: { aprovada: true, encontrosIds: [encontroId] },
  } });
  await expect(prisma.$transaction(async (tx) => {
    await criarAvisosAlteracaoAgendaTx(tx, { eventoId: evento.id, matriculaId: matriculasElegiveis[0], encontrosIds: [encontroId] });
    throw new Error("rollback deliberado");
  })).rejects.toThrow("rollback deliberado");
  expect(await prisma.avisoAlteracaoAgenda.count()).toBe(0);
});

it("preserva as guardas de origem e da matrícula antes de aceitar itens da turma", async () => {
  const matriculaReferencia = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculasElegiveis[0] } });
  const eventoIncompativel = await prisma.evento.create({ data: {
    tipo: "SubstituicaoDocenteDecidida", agregadoTipo: "Matricula", agregadoId: matriculasElegiveis[0], payload: { aprovada: true, encontrosIds: [encontroId] },
  } });
  await expect(prisma.avisoAlteracaoAgenda.create({ data: {
    id: "aviso-origem-incompativel", mudancaId: eventoIncompativel.id, eventoId: eventoIncompativel.id, matriculaId: matriculasElegiveis[0],
    alunoId: matriculaReferencia.alunoId, canal: "EMAIL", contatoHash: "hash", chave: "origem-incompativel",
  } })).rejects.toThrow("Origem do aviso inválida");
  const eventoSubstituicaoNaoCanonico = await prisma.evento.create({ data: {
    tipo: "SubstituicaoDocenteDecidida", agregadoTipo: "ConfiguracaoOperacional", agregadoId: "outra-configuracao", payload: { aprovada: true, encontrosIds: [encontroId] },
  } });
  await expect(prisma.avisoAlteracaoAgenda.create({ data: {
    id: "aviso-origem-nao-canonica", mudancaId: eventoSubstituicaoNaoCanonico.id, eventoId: eventoSubstituicaoNaoCanonico.id, matriculaId: matriculasElegiveis[0],
    alunoId: matriculaReferencia.alunoId, canal: "EMAIL", contatoHash: "hash", chave: "origem-nao-canonica",
  } })).rejects.toThrow("Origem do aviso inválida");
  const alunoDeOutraMatricula = await prisma.aluno.create({ data: { primeiroNome: "Outro aluno", paisId: matriculaReferencia.paisId } });
  const outraMatricula = await prisma.matricula.create({ data: { alunoId: alunoDeOutraMatricula.id, produtoId: matriculaReferencia.produtoId, paisId: matriculaReferencia.paisId, moeda: "CRC", status: "ATIVA" } });
  const eventoValido = await prisma.evento.create({ data: {
    tipo: "SubstituicaoDocenteDecidida", agregadoTipo: "ConfiguracaoOperacional", agregadoId: "escola", payload: { aprovada: true, encontrosIds: [encontroId] },
  } });
  await expect(prisma.avisoAlteracaoAgenda.create({ data: {
    id: "aviso-matricula-incompativel", mudancaId: eventoValido.id, eventoId: eventoValido.id, matriculaId: outraMatricula.id,
    alunoId: matriculaReferencia.alunoId, canal: "EMAIL", contatoHash: "hash", chave: "matricula-incompativel",
  } })).rejects.toThrow("Matrícula do aviso incompatível");
});

it("registra recusa como falha e conserva a incerteza sem reenvio automático", async () => {
  expect(await decidir(true)).toMatchObject({ ok: true });
  const [primeiro, segundo] = await avisosPreparados();
  await expect(despacharAvisoAlteracaoAgendaInterna(primeiro.id, async () => ({ situacao: "RECUSADO" as const }))).resolves.toMatchObject({ enviado: false, recusado: true });
  await expect(despacharAvisoAlteracaoAgendaInterna(segundo.id, async () => ({ situacao: "INCERTO" as const }))).resolves.toMatchObject({ enviado: false, incerto: true });
  expect(await prisma.avisoAlteracaoAgenda.findUniqueOrThrow({ where: { id: primeiro.id } })).toMatchObject({ situacao: "FALHOU" });
  expect(await prisma.avisoAlteracaoAgenda.findUniqueOrThrow({ where: { id: segundo.id } })).toMatchObject({ situacao: "INCERTO" });
  const transporte = vi.fn(async (_entrada: { canal: "EMAIL" | "WHATSAPP"; destinatario: string; avisoId: string; encontrosIds: string[] }) => ({ situacao: "ACEITO" as const, provedorId: "nao-deve-chamar" }));
  await despacharAvisoAlteracaoAgendaInterna(segundo.id, transporte);
  expect(transporte).not.toHaveBeenCalled();
});

it("trata aceite do provedor como ENVIADO sem inferir entrega ao aluno", async () => {
  expect(await decidir(true)).toMatchObject({ ok: true });
  const [aviso] = await avisosPreparados();
  await expect(despacharAvisoAlteracaoAgendaInterna(aviso.id, async () => ({ situacao: "ACEITO" as const, provedorId: "aceite-externo" }))).resolves.toEqual({ enviado: true });
  expect(await prisma.avisoAlteracaoAgenda.findUniqueOrThrow({ where: { id: aviso.id } })).toMatchObject({ situacao: "ENVIADO" });
  expect(await prisma.tentativaAvisoAlteracaoAgenda.findFirstOrThrow({ where: { avisoId: aviso.id, situacao: "ENVIADO" } })).toMatchObject({ provedorId: "aceite-externo" });
});

it("enfileira somente contatos acadêmicos no número AGENDA e confirma apenas o aceite Meta", async () => {
  for (const [indice, matriculaId] of matriculasElegiveis.entries()) {
    const matricula = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
    await prisma.aluno.update({ where: { id: matricula.alunoId }, data: { whatsapp: true, telefoneE164: `+5067000000${indice}` } });
  }
  const responsavel = await prisma.responsavel.create({ data: { nome: "Responsável pedagógico", telefoneE164: "+50679999999" } });
  const primeira = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculasElegiveis[0] } });
  await prisma.alunoResponsavel.create({ data: { alunoId: primeira.alunoId, responsavelId: responsavel.id, papel: "PEDAGOGICO" } });
  await prisma.autorizacaoComunicacaoAcademica.create({ data: { matriculaId: primeira.id, responsavelId: responsavel.id, autorizadaPorId: secretariaId, evidencia: "Autorização acadêmica registrada no atendimento" } });
  const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+50675555555", rotulo: "Agenda", driver: "META_CLOUD", finalidade: "AGENDA", providerRef: "phone-agenda" } });
  const template = await prisma.templateWhatsApp.create({ data: { nome: "agenda_docente", corpo: "Olá {nome}. Horários: {horarios}", idioma: "es", categoria: "utility", statusMeta: "APROVADO", metaTemplateId: "waba-template-agenda" } });
  expect(await decidir(true)).toMatchObject({ ok: true });
  const avisos = await prisma.avisoAlteracaoAgenda.findMany({ where: { canal: "WHATSAPP" }, include: { aluno: true } });
  expect(avisos).toHaveLength(3);
  expect(avisos.filter((a) => a.alunoId === primeira.alunoId)).toHaveLength(2);
  vi.stubEnv("COMUNICACOES_AGENDA_ENVIO_ENABLED", "true");
  vi.stubEnv("WHATSAPP_LIVE", "1");
  enviarTemplateMock.mockImplementation(async () => ({ providerMessageId: `wamid-agenda-${enviarTemplateMock.mock.calls.length}` }));
  // Sem configuração não há claim, tentativa ou envio; a pendência pode ser
  // resolvida pelo admin sem deixar o worker preso em reprocessamento.
  await processarAvisosAlteracaoAgenda(async () => ({ situacao: "RECUSADO" }));
  expect(enviarTemplateMock).not.toHaveBeenCalled();
  expect(await prisma.avisoAlteracaoAgenda.count({ where: { canal: "WHATSAPP", situacao: "PREPARADO" } })).toBe(3);
  await prisma.configuracaoOperacional.create({ data: { id: "escola", numeroAvisosAgendaId: numero.id, templateAvisosAgendaId: template.id } });
  await processarAvisosAlteracaoAgenda(async () => ({ situacao: "RECUSADO" }));
  expect(enviarTemplateMock).toHaveBeenCalledTimes(3);
  expect(await prisma.avisoAlteracaoAgenda.count({ where: { canal: "WHATSAPP", situacao: "ENVIADO" } })).toBe(3);
  const intencoes = await prisma.intencaoMensagem.findMany({ where: { avisoAlteracaoAgendaId: { not: null } }, include: { atendimento: true } });
  expect(intencoes).toHaveLength(3);
  expect(intencoes.every((i) => i.atendimento?.finalidade === "PEDAGOGICO" && i.numeroId === numero.id && i.templateId === template.id)).toBe(true);
});

it("resultado incerto do driver preserva INCERTO e não reenvia automaticamente", async () => {
  await ativarWhatsappDaPrimeira(); await configurarCanalAgenda();
  expect(await decidir(true)).toMatchObject({ ok: true });
  vi.stubEnv("COMUNICACOES_AGENDA_ENVIO_ENABLED", "true"); vi.stubEnv("WHATSAPP_LIVE", "1");
  enviarTemplateMock.mockRejectedValue(new ErroDriver("recusado_meta"));
  await processarAvisosAlteracaoAgenda(async () => ({ situacao: "RECUSADO" }));
  const aviso = await prisma.avisoAlteracaoAgenda.findFirstOrThrow({ where: { canal: "WHATSAPP" } });
  expect(aviso.situacao).toBe("INCERTO");
  const intencao = await prisma.intencaoMensagem.findFirstOrThrow({ where: { avisoAlteracaoAgendaId: aviso.id } });
  expect(intencao).toMatchObject({ status: "FALHOU", motivoFalha: "recusado_meta" });
  await processarAvisosAlteracaoAgenda(async () => ({ situacao: "RECUSADO" }));
  expect(enviarTemplateMock).toHaveBeenCalledTimes(1);
});

it("opt-out depois da preparação cancela antes do driver", async () => {
  await ativarWhatsappDaPrimeira(); await configurarCanalAgenda();
  expect(await decidir(true)).toMatchObject({ ok: true });
  expect(await enfileirarAvisosAgendaWhatsApp()).toBe(1);
  const intencao = await prisma.intencaoMensagem.findFirstOrThrow({ where: { avisoAlteracaoAgendaId: { not: null } } });
  await prisma.contatoWhatsApp.update({ where: { id: intencao.contatoId }, data: { optOutEm: new Date() } });
  vi.stubEnv("WHATSAPP_LIVE", "1");
  await despacharFila();
  expect(enviarTemplateMock).not.toHaveBeenCalled();
  expect(await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: intencao.id } })).toMatchObject({ status: "CANCELADA", motivoFalha: "opt_out" });
});

it("template revogado antes da preparação deixa o aviso pendente sem chamar o driver", async () => {
  await ativarWhatsappDaPrimeira(); const { template } = await configurarCanalAgenda();
  await prisma.templateWhatsApp.update({ where: { id: template.id }, data: { statusMeta: "RASCUNHO" } });
  expect(await decidir(true)).toMatchObject({ ok: true });
  vi.stubEnv("COMUNICACOES_AGENDA_ENVIO_ENABLED", "true"); vi.stubEnv("WHATSAPP_LIVE", "1");
  await processarAvisosAlteracaoAgenda(async () => ({ situacao: "RECUSADO" }));
  expect(enviarTemplateMock).not.toHaveBeenCalled();
  expect(await prisma.avisoAlteracaoAgenda.findFirstOrThrow({ where: { canal: "WHATSAPP" } })).toMatchObject({ situacao: "PREPARADO" });
});

it("SQL direto não aceita autorização de responsável pertencente a outra matrícula", async () => {
  expect(await decidir(true)).toMatchObject({ ok: true });
  const avisoBase = await prisma.avisoAlteracaoAgenda.findFirstOrThrow({ where: { matriculaId: matriculasElegiveis[0], canal: "EMAIL" } });
  const responsavel = await prisma.responsavel.create({ data: { nome: "Responsável cruzado", telefoneE164: "+50678888888" } });
  const alvo = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculasElegiveis[0] } });
  await prisma.alunoResponsavel.create({ data: { alunoId: alvo.alunoId, responsavelId: responsavel.id, papel: "PEDAGOGICO" } });
  const alunoOutro = await prisma.aluno.create({ data: { primeiroNome: "Outro contrato", paisId: catalogo.pais.id } });
  const matriculaOutra = await prisma.matricula.create({ data: { alunoId: alunoOutro.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } });
  await prisma.alunoResponsavel.create({ data: { alunoId: alunoOutro.id, responsavelId: responsavel.id, papel: "PEDAGOGICO" } });
  const autorizacaoOutra = await prisma.autorizacaoComunicacaoAcademica.create({ data: { matriculaId: matriculaOutra.id, responsavelId: responsavel.id, autorizadaPorId: secretariaId, evidencia: "Autorização de outro contrato" } });
  await expect(prisma.avisoAlteracaoAgenda.create({ data: { id: "aviso-autorizacao-cruzada", mudancaId: avisoBase.mudancaId, eventoId: avisoBase.eventoId, matriculaId: alvo.id, alunoId: alvo.alunoId, canal: "WHATSAPP", contatoHash: "hash-cruzado", chave: "cruzado", destinatarioResponsavelId: responsavel.id, autorizacaoComunicacaoAcademicaId: autorizacaoOutra.id } })).rejects.toThrow();
});

it("SQL direto protege autoria, deleção e identidade imutável da autorização", async () => {
  const matricula = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculasElegiveis[0] } });
  const responsavel = await prisma.responsavel.create({ data: { nome: "Responsável imutável", telefoneE164: "+50679999996" } });
  await prisma.alunoResponsavel.create({ data: { alunoId: matricula.alunoId, responsavelId: responsavel.id, papel: "PEDAGOGICO" } });
  const professor = await criarUsuario(["PROFESSOR"]);
  await expect(prisma.autorizacaoComunicacaoAcademica.create({ data: {
    matriculaId: matricula.id, responsavelId: responsavel.id, autorizadaPorId: professor.id, evidencia: "Inserção direta por professor",
  } })).rejects.toThrow("papel ativo");
  const autorizacao = await prisma.autorizacaoComunicacaoAcademica.create({ data: {
    matriculaId: matricula.id, responsavelId: responsavel.id, autorizadaPorId: secretariaId, evidencia: "Autorização acadêmica válida",
  } });
  await expect(prisma.autorizacaoComunicacaoAcademica.delete({ where: { id: autorizacao.id } })).rejects.toThrow("não pode ser apagada");
  await expect(prisma.$executeRaw`UPDATE "AutorizacaoComunicacaoAcademica" SET "matriculaId" = ${matriculasElegiveis[1]} WHERE id = ${autorizacao.id}`).rejects.toThrow("imutável");
});

it("bloqueia autorização futura ou revogada no aviso, mas preserva resultado histórico", async () => {
  expect(await decidir(true)).toMatchObject({ ok: true });
  const email = await prisma.avisoAlteracaoAgenda.findFirstOrThrow({ where: { canal: "EMAIL", matriculaId: matriculasElegiveis[0] } });
  const matricula = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculasElegiveis[0] } });
  const responsavel = await prisma.responsavel.create({ data: { nome: "Responsável temporal", telefoneE164: "+50679999995" } });
  await prisma.alunoResponsavel.create({ data: { alunoId: matricula.alunoId, responsavelId: responsavel.id, papel: "PEDAGOGICO" } });
  const futura = await prisma.autorizacaoComunicacaoAcademica.create({ data: {
    matriculaId: matricula.id, responsavelId: responsavel.id, autorizadaPorId: secretariaId, evidencia: "Autorização futura registrada", vigenteEm: new Date("2100-01-01T00:00:00.000Z"),
  } });
  await expect(prisma.avisoAlteracaoAgenda.create({ data: {
    id: "aviso-autorizacao-futura", mudancaId: email.mudancaId, eventoId: email.eventoId, matriculaId: matricula.id, alunoId: matricula.alunoId,
    canal: "WHATSAPP", contatoHash: "hash-futura", chave: "autorizacao-futura", destinatarioResponsavelId: responsavel.id, autorizacaoComunicacaoAcademicaId: futura.id,
  } })).rejects.toThrow("Autorização não corresponde");
  const vigente = await prisma.autorizacaoComunicacaoAcademica.create({ data: {
    matriculaId: matricula.id, responsavelId: responsavel.id, autorizadaPorId: secretariaId, evidencia: "Autorização vigente registrada",
  } });
  const aviso = await prisma.avisoAlteracaoAgenda.create({ data: {
    id: "aviso-autorizacao-vigente", mudancaId: email.mudancaId, eventoId: email.eventoId, matriculaId: matricula.id, alunoId: matricula.alunoId,
    canal: "WHATSAPP", contatoHash: "hash-vigente", chave: "autorizacao-vigente", destinatarioResponsavelId: responsavel.id, autorizacaoComunicacaoAcademicaId: vigente.id,
  } });
  await prisma.autorizacaoComunicacaoAcademica.update({ where: { id: vigente.id }, data: { revogadaEm: new Date(), revogadaPorId: secretariaId, motivoRevogacao: "Revogação solicitada pelo responsável" } });
  await expect(prisma.avisoAlteracaoAgenda.create({ data: {
    id: "aviso-autorizacao-revogada", mudancaId: email.mudancaId, eventoId: email.eventoId, matriculaId: matricula.id, alunoId: matricula.alunoId,
    canal: "WHATSAPP", contatoHash: "hash-revogada", chave: "autorizacao-revogada", destinatarioResponsavelId: responsavel.id, autorizacaoComunicacaoAcademicaId: vigente.id,
  } })).rejects.toThrow("Autorização não corresponde");
  await expect(prisma.avisoAlteracaoAgenda.update({ where: { id: aviso.id }, data: { situacao: "FALHOU" } })).resolves.toMatchObject({ situacao: "FALHOU" });
});

it("não troca responsável autorizado por outra pessoa com o mesmo telefone antes do driver", async () => {
  for (const [indice, matriculaId] of matriculasElegiveis.entries()) {
    const matricula = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
    await prisma.aluno.update({ where: { id: matricula.alunoId }, data: { whatsapp: true, telefoneE164: `+5067333333${indice}` } });
  }
  const matricula = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculasElegiveis[0] } });
  const original = await prisma.responsavel.create({ data: { nome: "Responsável original", telefoneE164: "+50679999994" } });
  await prisma.alunoResponsavel.create({ data: { alunoId: matricula.alunoId, responsavelId: original.id, papel: "PEDAGOGICO" } });
  await prisma.autorizacaoComunicacaoAcademica.create({ data: { matriculaId: matricula.id, responsavelId: original.id, autorizadaPorId: secretariaId, evidencia: "Autorização da pessoa original" } });
  await configurarCanalAgenda();
  expect(await decidir(true)).toMatchObject({ ok: true });
  expect(await enfileirarAvisosAgendaWhatsApp()).toBe(3);
  await prisma.alunoResponsavel.deleteMany({ where: { alunoId: matricula.alunoId, responsavelId: original.id } });
  const substitutoMesmoTelefone = await prisma.responsavel.create({ data: { nome: "Outra pessoa mesmo telefone", telefoneE164: "+50679999994" } });
  await prisma.alunoResponsavel.create({ data: { alunoId: matricula.alunoId, responsavelId: substitutoMesmoTelefone.id, papel: "PEDAGOGICO" } });
  vi.stubEnv("WHATSAPP_LIVE", "1");
  enviarTemplateMock.mockResolvedValue({ providerMessageId: "wamid-identidade" });
  await despacharFila(new Date(), { somenteAvisosAgenda: true });
  expect(enviarTemplateMock).toHaveBeenCalledTimes(2);
  const avisoOriginal = await prisma.avisoAlteracaoAgenda.findFirstOrThrow({ where: { destinatarioResponsavelId: original.id } });
  const intencaoOriginal = await prisma.intencaoMensagem.findFirstOrThrow({ where: { avisoAlteracaoAgendaId: avisoOriginal.id } });
  expect(intencaoOriginal.status).toBe("CANCELADA");
});
