import { afterEach, beforeEach, expect, it, vi } from "vitest";

const sessao = vi.hoisted(() => ({ id: "" }));
const { enviarEmail, enviarTemplate } = vi.hoisted(() => ({ enviarEmail: vi.fn(), enviarTemplate: vi.fn() }));
vi.mock("@/server/_shared", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/_shared")>();
  return { ...real, exigirSessaoComPapel: vi.fn(async () => ({ id: sessao.id, nome: "Secretaria", papeis: ["SECRETARIA_ACADEMICA"] })) };
});
vi.mock("@/server/email/resend", () => ({ enviarEmailResend: enviarEmail }));
vi.mock("@/server/whatsapp/drivers/meta-cloud", () => ({ driverMetaCloud: { enviarTexto: vi.fn(), enviarMidia: vi.fn(), enviarTemplate } }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { registrarPendenciaAvisoAgendaTx } from "./pendencias";
import { reconferirPendenciaAvisoAgenda } from "./reconferencia";

beforeEach(async () => {
  await truncarBanco();
  enviarEmail.mockReset(); enviarTemplate.mockReset();
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("I/O externo proibido no teste"); }));
});
afterEach(() => vi.unstubAllGlobals());

it("reconfere responsável pedagógico vigente sem incluir encontro da outra turma", async () => {
  const catalogo = await seedCatalogoMinimo();
  const secretaria = await criarUsuario(["SECRETARIA_ACADEMICA"]);
  const professor = await criarUsuario(["PROFESSOR"]);
  sessao.id = secretaria.id;
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "RECONF-MULTITURMA", ordem: 1 } });
  const turmaDaMatricula = await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: professor.id, status: "ABERTA" } });
  const outraTurma = await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: professor.id, status: "ABERTA" } });
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno", paisId: catalogo.pais.id, aceitaComunicacoes: true, whatsapp: false } });
  const matricula = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } });
  await prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, matriculaId: matricula.id, turmaId: turmaDaMatricula.id, criadoEm: new Date("2099-09-01T00:00:00.000Z") } });
  const responsavel = await prisma.responsavel.create({ data: { nome: "Responsável pedagógico", telefoneE164: "+50670000001" } });
  await prisma.alunoResponsavel.create({ data: { alunoId: aluno.id, responsavelId: responsavel.id, papel: "PEDAGOGICO" } });
  await prisma.autorizacaoComunicacaoAcademica.create({ data: { matriculaId: matricula.id, responsavelId: responsavel.id, autorizadaPorId: secretaria.id, evidencia: "Autorização acadêmica vigente", vigenteEm: new Date("2020-01-01T00:00:00.000Z") } });
  const comum = { professorId: professor.id, preparadorId: secretaria.id, inicio: new Date("2099-10-01T10:00:00.000Z"), fim: new Date("2099-10-01T11:00:00.000Z"), fusoOrigem: "UTC", status: "PREVISTO" as const, motivo: "Aula regular", entradaHash: "fixture-reconferencia" };
  const encontroElegivel = await prisma.encontroAgenda.create({ data: { ...comum, turmaId: turmaDaMatricula.id, chaveIdempotencia: "reconf-turma-da-matricula" } });
  const encontroAlheio = await prisma.encontroAgenda.create({ data: { ...comum, turmaId: outraTurma.id, chaveIdempotencia: "reconf-outra-turma" } });
  const evento = await prisma.evento.create({ data: { tipo: "SubstituicaoDocenteDecidida", agregadoTipo: "ConfiguracaoOperacional", agregadoId: "escola", autorId: secretaria.id, payload: { aprovada: true, encontrosIds: [encontroElegivel.id, encontroAlheio.id] } } });
  const pendencia = await prisma.$transaction((tx) => registrarPendenciaAvisoAgendaTx(tx, { eventoId: evento.id, matriculaId: matricula.id, motivo: "SEM_DESTINATARIO_AUTORIZADO" }));

  const resultado = await reconferirPendenciaAvisoAgenda({ pendenciaId: pendencia.id, motivo: "Responsável pedagógico e vínculo conferidos" });

  expect(resultado).toMatchObject({ ok: true, dado: { resolvida: true } });
  const avisos = await prisma.avisoAlteracaoAgenda.findMany({ where: { eventoId: evento.id, matriculaId: matricula.id }, include: { itens: true } });
  expect(avisos).toHaveLength(1);
  expect(avisos[0]).toMatchObject({ canal: "WHATSAPP", destinatarioResponsavelId: responsavel.id, situacao: "PREPARADO" });
  expect(avisos[0].itens.map((item) => item.encontroId)).toEqual([encontroElegivel.id]);
  expect(await prisma.pendenciaAvisoAgenda.findUniqueOrThrow({ where: { id: pendencia.id } })).toMatchObject({ situacao: "RESOLVIDA", resolvidaPorId: secretaria.id });
  expect(enviarEmail).not.toHaveBeenCalled(); expect(enviarTemplate).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});
