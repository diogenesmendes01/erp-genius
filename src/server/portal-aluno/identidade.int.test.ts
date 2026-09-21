import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({ authMock: vi.fn(), portalCookie: "" }));
vi.mock("@/lib/auth", () => ({ auth: mocks.authMock }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nome: string) => nome === "portal_aluno_session" && mocks.portalCookie ? { value: mocks.portalCookie } : undefined,
    delete: vi.fn(),
  }),
}));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import {
  consumirTokenPortalAluno,
  decidirTrocaEmailPortalAluno,
  despacharSolicitacaoPortalAlunoInterna,
  entrarPortalAluno,
  prepararConvitePortalAluno,
  prepararTrocaEmailPortalAluno,
  solicitarRecuperacaoPortalAluno,
} from "./identidade";
import { exigirReposicaoDoPortalAluno } from "./reposicoes";
import { lerSessaoPortalAluno } from "./sessao";

let secretariaId: string, adminId: string, adminPreparadorId: string, alunoId: string, matriculaAlunoId: string, outroAlunoId: string, outroContratoId: string, aulaOutroId: string;
const entrarEquipe = (id: string) => mocks.authMock.mockResolvedValue({ user: { id } });

async function despachar(id: string) {
  let token = "";
  await despacharSolicitacaoPortalAlunoInterna(id, async (mensagem) => { token = mensagem.token; });
  if (!token) throw new Error("O despachante interno não forneceu token ao adaptador.");
  return token;
}

async function prepararContaAtiva() {
  entrarEquipe(secretariaId);
  const convite = await prepararConvitePortalAluno({ alunoId });
  if (!convite.ok || !convite.dado || !("solicitacaoEnvioId" in convite.dado)) throw new Error(JSON.stringify(convite));
  const solicitacaoEnvioId = convite.dado.solicitacaoEnvioId;
  if (typeof solicitacaoEnvioId !== "string") throw new Error("Convite não criou solicitação de envio.");
  const token = await despachar(solicitacaoEnvioId);
  const ativada = await consumirTokenPortalAluno({ token, senha: "Senha inicial segura 2026" });
  if (ativada.tipo !== "SESSAO") throw new Error("Convite não criou sessão.");
  return ativada;
}

beforeEach(async () => {
  mocks.portalCookie = "";
  mocks.authMock.mockReset();
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  secretariaId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  adminId = (await criarUsuario(["ADMINISTRADOR"])).id;
  adminPreparadorId = (await criarUsuario(["ADMINISTRADOR"])).id;
  alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Aluna portal", email: "aluna.portal@example.com", paisId: catalogo.pais.id } })).id;
  outroAlunoId = (await prisma.aluno.create({ data: { primeiroNome: "Outro aluno", email: "outro.portal@example.com", paisId: catalogo.pais.id } })).id;
  await prisma.configuracaoOperacional.create({ data: {
    id: "escola", prazoSessaoPortalAlunoMinutos: 60, prazoConvitePortalAlunoMinutos: 120,
    prazoRecuperacaoPortalAlunoMinutos: 90, prazoValidacaoEmailPortalAlunoMinutos: 30,
  } });
  matriculaAlunoId = (await prisma.matricula.create({ data: {
    alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA",
    ativadaEm: new Date("2026-01-01T00:00:00.000Z"),
  } })).id;

  outroContratoId = (await prisma.matricula.create({ data: {
    alunoId: outroAlunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id,
    moeda: "CRC", status: "ATIVA", ativadaEm: new Date("2026-01-01T00:00:00.000Z"),
  } })).id;
  const professor = await criarUsuario(["PROFESSOR"]);
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "PORTAL-A1", ordem: 99 } });
  const turma = await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: professor.id, dataInicio: new Date("2026-01-01T00:00:00.000Z") } });
  await prisma.alocacaoTurma.create({ data: { alunoId: outroAlunoId, matriculaId: outroContratoId, turmaId: turma.id, criadoEm: new Date("2026-01-01T00:00:00.000Z") } });
  aulaOutroId = (await prisma.encontroAgenda.create({ data: {
    turmaId: turma.id, professorId: professor.id, preparadorId: secretariaId,
    inicio: new Date("2026-01-10T10:00:00.000Z"), fim: new Date("2026-01-10T11:00:00.000Z"),
    fusoOrigem: "UTC", status: "PREVISTO", motivo: "Aula original da outra matrícula",
    chaveIdempotencia: "portal-outra-aula", entradaHash: "fixture",
    diario: { create: { turmaId: turma.id, professorId: professor.id, ocorridaEm: new Date("2026-01-10T10:00:00.000Z"), conteudo: "Aula com falta",
      registros: { create: { alunoId: outroAlunoId, matriculaId: outroContratoId, nomeAluno: "Outro aluno", presente: false, participacao: "FALTA" } } } },
  } })).id;
  await prisma.encontroAgenda.update({ where: { id: aulaOutroId }, data: { status: "MINISTRADO" } });
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "ReposicaoIndividual" (id,"aulaOriginalId","matriculaId",modalidade,"solicitanteId",motivo,evidencia,"chaveIdempotencia","entradaHash")
    VALUES ('reposicao-de-outro-aluno',${aulaOutroId},${outroContratoId},'GRAVACAO'::"ModalidadeReposicaoIndividual",${secretariaId},'Ausência comprovada da outra matrícula','Evidência acadêmica conferida','portal-escopo','fixture')
  `);
});

it("ativa por convite único, persiste somente digest da sessão e não aceita replay", async () => {
  const ativada = await prepararContaAtiva();
  const conta = await prisma.contaPortalAluno.findUniqueOrThrow({ where: { alunoId } });
  expect(conta.emailVerificado).toBe("aluna.portal@example.com");
  expect(conta.senhaHash).not.toContain("Senha inicial segura 2026");
  const sessao = await prisma.sessaoPortalAluno.findFirstOrThrow({ where: { contaId: conta.id } });
  expect(sessao.digest).not.toBe(ativada.sessaoCookie);
  expect(sessao.digest).toHaveLength(64);

  const conviteEnviado = await prisma.solicitacaoEnvioPortalAluno.findFirstOrThrow({ where: { contaId: conta.id, finalidade: "CONVITE" } });
  const token = await despachar(conviteEnviado.id).catch(() => "");
  expect(token).toBe(""); // convite já ativado não pode gerar outro segredo.
  expect(await entrarPortalAluno({ email: "aluna.portal@example.com", senha: "Senha inicial segura 2026" })).toMatchObject({ autenticado: true });
});

it("confirma token e estado incerto antes do adaptador e nunca repete envio incerto automaticamente", async () => {
  entrarEquipe(secretariaId);
  const convite = await prepararConvitePortalAluno({ alunoId });
  if (!convite.ok || !convite.dado || typeof convite.dado.solicitacaoEnvioId !== "string") throw new Error(JSON.stringify(convite));
  const solicitacaoEnvioId = convite.dado.solicitacaoEnvioId;
  let tokenEntregue = "", estadoAntesDoAdaptador = "";
  const resultado = await despacharSolicitacaoPortalAlunoInterna(solicitacaoEnvioId, async (mensagem) => {
    tokenEntregue = mensagem.token;
    estadoAntesDoAdaptador = (await prisma.solicitacaoEnvioPortalAluno.findUniqueOrThrow({ where: { id: solicitacaoEnvioId } })).situacao;
    throw new Error("Resultado do provedor desconhecido após possível aceitação");
  });
  expect(estadoAntesDoAdaptador).toBe("INCERTO");
  expect(resultado).toMatchObject({ situacao: "INCERTO" });
  const conta = await prisma.contaPortalAluno.findUniqueOrThrow({ where: { alunoId } });
  const token = await prisma.tokenPortalAluno.findFirstOrThrow({ where: { contaId: conta.id, finalidade: "CONVITE" } });
  expect(token.digest).not.toBe(tokenEntregue);
  await expect(despacharSolicitacaoPortalAlunoInterna(solicitacaoEnvioId, async () => undefined)).rejects.toThrow();
});

it("recuperação revoga a sessão anterior e não revela o token na solicitação pública", async () => {
  const anterior = await prepararContaAtiva();
  const solicitacao = await solicitarRecuperacaoPortalAluno({ email: "aluna.portal@example.com" });
  expect(solicitacao).toEqual({ situacao: "PENDENTE_ENVIO" });
  expect(JSON.stringify(solicitacao)).not.toMatch(/token|senha/i);
  const conta = await prisma.contaPortalAluno.findUniqueOrThrow({ where: { alunoId } });
  const envio = await prisma.solicitacaoEnvioPortalAluno.findFirstOrThrow({ where: { contaId: conta.id, finalidade: "RECUPERACAO", situacao: "PREPARADO" } });
  const token = await despachar(envio.id);
  const renovada = await consumirTokenPortalAluno({ token, senha: "Senha recuperada segura 2026" });
  expect(renovada.tipo).toBe("SESSAO");
  await expect(consumirTokenPortalAluno({ token, senha: "Outra senha segura 2026" })).rejects.toThrow();
  expect(await prisma.sessaoPortalAluno.count({ where: { contaId: conta.id, revogadaEm: null } })).toBe(1);
  expect((await prisma.sessaoPortalAluno.findMany({ where: { contaId: conta.id } })).some((s) => s.revogadaEm && s.digest !== anterior.sessaoCookie)).toBe(true);
  expect(await entrarPortalAluno({ email: "aluna.portal@example.com", senha: "Senha inicial segura 2026" })).toEqual({ autenticado: false });
  expect(await entrarPortalAluno({ email: "aluna.portal@example.com", senha: "Senha recuperada segura 2026" })).toMatchObject({ autenticado: true });
});

it("sessão opaca continua permitindo a leitura histórica depois de pausa e encerramento da matrícula", async () => {
  const ativada = await prepararContaAtiva();
  mocks.portalCookie = ativada.sessaoCookie;
  await prisma.matricula.update({ where: { id: matriculaAlunoId }, data: { status: "PAUSADA" } });
  expect(await lerSessaoPortalAluno()).toMatchObject({ alunoId });
  await prisma.matricula.update({ where: { id: matriculaAlunoId }, data: { status: "ENCERRADA" } });
  expect(await lerSessaoPortalAluno()).toMatchObject({ alunoId });
});

it("troca assistida exige validação e outro administrador, revoga acessos e isola reposição de outro aluno", async () => {
  await prepararContaAtiva();
  entrarEquipe(adminPreparadorId);
  const preparada = await prepararTrocaEmailPortalAluno({ alunoId, novoEmail: "novo.portal@example.com", motivo: "Aluna perdeu o endereço verificado", evidencia: "Identidade e vínculo conferidos presencialmente" });
  if (!preparada.ok || !preparada.dado) throw new Error(JSON.stringify(preparada));
  const tokenValidacao = await despachar(preparada.dado.solicitacaoEnvioId);
  expect(await consumirTokenPortalAluno({ token: tokenValidacao })).toEqual({ tipo: "EMAIL_VALIDADO" });
  await expect(prisma.$executeRaw(Prisma.sql`
    INSERT INTO "DecisaoTrocaEmailPortalAluno" (id,"solicitacaoId","decisorId",aprovada,motivo)
    VALUES ('decisao-troca-auto-sql',${preparada.dado.solicitacaoId},${adminPreparadorId},true,'Autoaprovação direta indevida')
  `)).rejects.toThrow();
  expect((await decidirTrocaEmailPortalAluno({ solicitacaoId: preparada.dado.solicitacaoId, aprovar: true, motivo: "Autoaprovação indevida" })).ok).toBe(false);

  entrarEquipe(adminId);
  const decidida = await decidirTrocaEmailPortalAluno({ solicitacaoId: preparada.dado.solicitacaoId, aprovar: true, motivo: "Nova identidade e endereço conferidos por outra pessoa" });
  expect(decidida).toMatchObject({ ok: true, dado: { aprovada: true } });
  const conta = await prisma.contaPortalAluno.findUniqueOrThrow({ where: { alunoId } });
  expect(conta).toMatchObject({ emailVerificado: "novo.portal@example.com", senhaHash: null });
  expect(await prisma.sessaoPortalAluno.count({ where: { contaId: conta.id, revogadaEm: null } })).toBe(0);
  const recuperar = await prisma.solicitacaoEnvioPortalAluno.findFirstOrThrow({ where: { contaId: conta.id, finalidade: "RECUPERACAO", destinatario: "novo.portal@example.com", situacao: "PREPARADO" } });
  const tokenRecuperacao = await despachar(recuperar.id);
  expect((await consumirTokenPortalAluno({ token: tokenRecuperacao, senha: "Senha do novo endereço 2026" })).tipo).toBe("SESSAO");

  await expect(exigirReposicaoDoPortalAluno("reposicao-de-outro-aluno", { sessaoId: "ignorada", contaId: conta.id, alunoId, email: "novo.portal@example.com" })).rejects.toThrow();
});
