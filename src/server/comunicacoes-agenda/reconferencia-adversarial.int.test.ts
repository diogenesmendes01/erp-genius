import { afterEach, beforeEach, expect, it, vi } from "vitest";

const estadoSessao = vi.hoisted(() => ({ id: "" }));
const { enviarEmail, enviarTemplate } = vi.hoisted(() => ({ enviarEmail: vi.fn(), enviarTemplate: vi.fn() }));
vi.mock("@/server/_shared", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/_shared")>();
  return { ...real, exigirSessaoComPapel: vi.fn(async () => ({ id: estadoSessao.id, nome: "Secretaria de teste", papeis: ["SECRETARIA_ACADEMICA"] })) };
});
vi.mock("@/server/email/resend", () => ({ enviarEmailResend: enviarEmail }));
vi.mock("@/server/whatsapp/drivers/meta-cloud", () => ({ driverMetaCloud: { enviarTexto: vi.fn(), enviarMidia: vi.fn(), enviarTemplate } }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { registrarPendenciaAvisoAgendaTx } from "./pendencias";
import { reconferirPendenciaAvisoAgenda } from "./reconferencia";
import { prepararSubstituicaoDocente } from "@/server/agenda/substituicao";
import { decidirSubstituicaoDocente } from "@/server/agenda/substituicao-decisao";

let secretariaId: string;
let gestorId: string;
let matriculaId: string;
let alunoId: string;
let eventoId: string;
let pendenciaId: string;

async function criarAvisosEpendencia() {
  const catalogo = await seedCatalogoMinimo();
  secretariaId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  gestorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  const titularId = (await criarUsuario(["PROFESSOR"])).id;
  const substitutoId = (await criarUsuario(["PROFESSOR"])).id;
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "RECONF-AVISO", ordem: 1 } });
  const turma = await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: titularId, status: "ABERTA" } });
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Destinatário", paisId: catalogo.pais.id, email: "destinatario@example.test", telefoneE164: "+50670000001", whatsapp: true, aceitaComunicacoes: true } });
  alunoId = aluno.id;
  const matricula = await prisma.matricula.create({ data: { alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } });
  matriculaId = matricula.id;
  await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId, turmaId: turma.id, criadoEm: new Date("2099-09-01T00:00:00.000Z") } });
  const encontro = await prisma.encontroAgenda.create({ data: { turmaId: turma.id, professorId: titularId, preparadorId: secretariaId, inicio: new Date("2099-10-01T10:00:00.000Z"), fim: new Date("2099-10-01T11:00:00.000Z"), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Aula regular", chaveIdempotencia: "reconf-encontro", entradaHash: "fixture" } });
  const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+50675555555", rotulo: "Agenda", driver: "META_CLOUD", finalidade: "AGENDA", providerRef: "phone-agenda" } });
  const template = await prisma.templateWhatsApp.create({ data: { nome: "agenda_reconf", corpo: "Olá {nome}. Horários: {horarios}", idioma: "es", categoria: "utility", statusMeta: "APROVADO", metaTemplateId: "agenda-reconf" } });
  await prisma.configuracaoOperacional.create({ data: { id: "escola", numeroAvisosAgendaId: numero.id, templateAvisosAgendaId: template.id } });
  estadoSessao.id = secretariaId;
  const proposta = await prepararSubstituicaoDocente({ encontrosIds: [encontro.id], substitutoId, motivo: "Cobertura conferida", chaveIdempotencia: "reconf-proposta" });
  if (!proposta.ok || !proposta.dado) throw new Error("Proposta de substituição ausente.");
  estadoSessao.id = gestorId;
  const decisao = await decidirSubstituicaoDocente({ propostaId: proposta.dado.id, aprovar: true, motivo: "Aprovação independente" });
  if (!decisao.ok) throw new Error(decisao.erro ?? "Decisão ausente.");
  const evento = await prisma.evento.findFirstOrThrow({ where: { tipo: "SubstituicaoDocenteDecidida" }, orderBy: { criadoEm: "desc" } });
  eventoId = evento.id;
  const pendencia = await prisma.$transaction((tx) => registrarPendenciaAvisoAgendaTx(tx, { eventoId, matriculaId, motivo: "CONTATO_INDISPONIVEL" }));
  pendenciaId = pendencia.id;
  expect(await prisma.avisoAlteracaoAgenda.count({ where: { eventoId, matriculaId } })).toBe(2);
}

beforeEach(async () => {
  await truncarBanco();
  await criarAvisosEpendencia();
  enviarEmail.mockReset(); enviarTemplate.mockReset();
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("I/O externo proibido no teste"); }));
});
afterEach(() => vi.unstubAllGlobals());

it("não encerra nem recria avisos quando um dos dois destinatários congelados muda", async () => {
  estadoSessao.id = secretariaId;
  const antes = {
    avisos: await prisma.avisoAlteracaoAgenda.count({ where: { eventoId, matriculaId } }),
    itens: await prisma.itemAvisoAlteracaoAgenda.count(),
    tentativas: await prisma.tentativaAvisoAlteracaoAgenda.count(),
  };
  await prisma.aluno.update({ where: { id: alunoId }, data: { email: "alterado@example.test" } });
  const entrada = { pendenciaId, motivo: "Contato conferido após alteração" };
  expect(await reconferirPendenciaAvisoAgenda(entrada)).toMatchObject({ ok: true, dado: { resolvida: false } });
  expect(await reconferirPendenciaAvisoAgenda(entrada)).toMatchObject({ ok: true, dado: { resolvida: false } });
  expect(await prisma.pendenciaAvisoAgenda.findUniqueOrThrow({ where: { id: pendenciaId } })).toMatchObject({ situacao: "PENDENTE" });
  expect({ avisos: await prisma.avisoAlteracaoAgenda.count({ where: { eventoId, matriculaId } }), itens: await prisma.itemAvisoAlteracaoAgenda.count(), tentativas: await prisma.tentativaAvisoAlteracaoAgenda.count() }).toEqual(antes);
  expect(enviarEmail).not.toHaveBeenCalled(); expect(enviarTemplate).not.toHaveBeenCalled();
});

it("não encerra a pendência se a matrícula perdeu elegibilidade", async () => {
  estadoSessao.id = secretariaId;
  await prisma.matricula.update({ where: { id: matriculaId }, data: { status: "PAUSADA" } });
  expect(await reconferirPendenciaAvisoAgenda({ pendenciaId, motivo: "Matrícula conferida como pausada" })).toMatchObject({ ok: true, dado: { resolvida: false } });
  expect(await prisma.pendenciaAvisoAgenda.findUniqueOrThrow({ where: { id: pendenciaId } })).toMatchObject({ situacao: "PENDENTE" });
  expect(await prisma.tentativaAvisoAlteracaoAgenda.count()).toBe(0);
});

it("serializa concorrência e conserva a primeira autoria e evidência", async () => {
  estadoSessao.id = secretariaId;
  const entrada = { pendenciaId, motivo: "Destinatários e origem reconferidos" };
  const [primeira, segunda] = await Promise.all([reconferirPendenciaAvisoAgenda(entrada), reconferirPendenciaAvisoAgenda(entrada)]);
  expect(primeira).toMatchObject({ ok: true, dado: { resolvida: true } });
  expect(segunda).toMatchObject({ ok: true, dado: { resolvida: true } });
  expect(await reconferirPendenciaAvisoAgenda(entrada)).toMatchObject({ ok: true, dado: { resolvida: true } });
  expect(await prisma.pendenciaAvisoAgenda.findUniqueOrThrow({ where: { id: pendenciaId } })).toMatchObject({ situacao: "RESOLVIDA", resolvidaPorId: secretariaId, observacaoResolucao: entrada.motivo });
  expect(await prisma.tentativaAvisoAlteracaoAgenda.count()).toBe(0);
});
