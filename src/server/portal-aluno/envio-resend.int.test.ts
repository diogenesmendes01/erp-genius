import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { consumirTokenPortalAluno, decidirTrocaEmailPortalAluno, despacharSolicitacaoPortalAlunoInterna, prepararConvitePortalAluno, prepararTrocaEmailPortalAluno } from "./identidade";
import { despacharAcessoPortalResend } from "./envio-resend";
import { decidirReemissaoEnvioIncerto, registrarEvidenciaEnvioIncerto } from "./conciliacao-envio";

const ambiente = {
  EMAIL_PORTAL_ENVIO_ENABLED: "true",
  RESEND_API_KEY: "chave-resend-de-teste",
  EMAIL_INSTITUCIONAL_REMETENTE: "portal@example.test",
  PORTAL_ALUNO_URL_PUBLICA: "https://escola.example.test",
};
let secretariaId: string;
let alunoId: string;
let administradorId: string;

async function prepararConvite() {
  mocks.auth.mockResolvedValue({ user: { id: secretariaId } });
  const preparado = await prepararConvitePortalAluno({ alunoId });
  if (!preparado.ok || !preparado.dado || typeof preparado.dado.solicitacaoEnvioId !== "string") throw new Error(JSON.stringify(preparado));
  return preparado.dado.solicitacaoEnvioId;
}

beforeEach(async () => {
  mocks.auth.mockReset();
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  secretariaId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  administradorId = (await criarUsuario(["ADMINISTRADOR"])).id;
  alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Aluna envio", email: "envio@example.test", paisId: catalogo.pais.id } })).id;
  await prisma.configuracaoOperacional.create({ data: {
    id: "escola", prazoSessaoPortalAlunoMinutos: 60, prazoConvitePortalAlunoMinutos: 120,
    prazoRecuperacaoPortalAlunoMinutos: 90, prazoValidacaoEmailPortalAlunoMinutos: 30,
  } });
});

it("aceite Resend confirma ENVIADO, audita recibo e só persiste digest do token", async () => {
  const solicitacaoId = await prepararConvite();
  const provedorId = "c4f884a4-96ce-4c22-bd42-806d93b1d1da";
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: provedorId }), { status: 200 }));

  await expect(despacharAcessoPortalResend(solicitacaoId, { ambiente, fetch })).resolves.toMatchObject({ situacao: "ENVIADO" });
  const envio = await prisma.solicitacaoEnvioPortalAluno.findUniqueOrThrow({ where: { id: solicitacaoId } });
  expect(envio.situacao).toBe("ENVIADO");
  const evento = await prisma.evento.findFirstOrThrow({ where: { tipo: "SolicitacaoEnvioPortalAlunoAceitaPeloProvedor", agregadoId: alunoId } });
  expect(evento.payload).toEqual({ solicitacaoEnvioId: solicitacaoId, provedor: "RESEND", provedorId });
  const tokenBruto = /#token=([^\n]+)/.exec(JSON.parse(fetch.mock.calls[0]![1].body).text)?.[1];
  expect(tokenBruto).toEqual(expect.any(String));
  if (!tokenBruto) throw new Error("O corpo de teste não trouxe o token do convite.");
  const token = await prisma.tokenPortalAluno.findFirstOrThrow({ where: { conta: { alunoId }, finalidade: "CONVITE" } });
  expect(token.digest).toHaveLength(64);
  expect(token.digest).not.toBe(tokenBruto);
  expect(JSON.stringify(evento.payload)).not.toContain(tokenBruto);

  await expect(despacharAcessoPortalResend(solicitacaoId, { ambiente, fetch })).rejects.toThrow();
  expect(fetch).toHaveBeenCalledOnce();
});

it("falha ou timeout do transporte conserva INCERTO e não faz novo envio", async () => {
  const solicitacaoId = await prepararConvite();
  const fetch = vi.fn().mockRejectedValue(new Error("timeout de transporte"));

  await expect(despacharAcessoPortalResend(solicitacaoId, { ambiente, fetch })).resolves.toMatchObject({ situacao: "INCERTO" });
  expect((await prisma.solicitacaoEnvioPortalAluno.findUniqueOrThrow({ where: { id: solicitacaoId } })).situacao).toBe("INCERTO");
  await expect(despacharAcessoPortalResend(solicitacaoId, { ambiente, fetch })).rejects.toThrow();
  expect(fetch).toHaveBeenCalledOnce();
});

it("conta revogada antes da claim não entrega ao destinatário preparado", async () => {
  const solicitacaoId = await prepararConvite();
  const conta = await prisma.contaPortalAluno.findUniqueOrThrow({ where: { alunoId } });
  await prisma.contaPortalAluno.update({ where: { id: conta.id }, data: { ativa: false } });
  const fetch = vi.fn();

  await expect(despacharAcessoPortalResend(solicitacaoId, { ambiente, fetch })).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
  expect((await prisma.solicitacaoEnvioPortalAluno.findUniqueOrThrow({ where: { id: solicitacaoId } })).situacao).toBe("PREPARADO");
});

it("alteração do e-mail antes da claim não emite token nem entrega ao endereço antigo", async () => {
  const solicitacaoId = await prepararConvite();
  await prisma.aluno.update({ where: { id: alunoId }, data: { email: "alterado@example.test" } });
  const fetch = vi.fn();

  await expect(despacharAcessoPortalResend(solicitacaoId, { ambiente, fetch })).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
  expect((await prisma.solicitacaoEnvioPortalAluno.findUniqueOrThrow({ where: { id: solicitacaoId } })).situacao).toBe("PREPARADO");
  const conta = await prisma.contaPortalAluno.findUniqueOrThrow({ where: { alunoId } });
  expect(await prisma.tokenPortalAluno.count({ where: { contaId: conta.id, finalidade: "CONVITE" } })).toBe(0);
});

it("mudança de e-mail depois do aceite invalida o token antes de ativar a conta", async () => {
  const solicitacaoId = await prepararConvite();
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "c4f884a4-96ce-4c22-bd42-806d93b1d1da" }), { status: 200 }));
  await expect(despacharAcessoPortalResend(solicitacaoId, { ambiente, fetch })).resolves.toMatchObject({ situacao: "ENVIADO" });
  const tokenBruto = /#token=([^\n]+)/.exec(JSON.parse(fetch.mock.calls[0]![1].body).text)?.[1];
  expect(tokenBruto).toEqual(expect.any(String));
  if (!tokenBruto) throw new Error("O corpo de teste não trouxe o token do convite.");

  await prisma.aluno.update({ where: { id: alunoId }, data: { email: "mudou-depois@example.test" } });
  await expect(consumirTokenPortalAluno({ token: tokenBruto, senha: "Senha inicial segura 2026" })).rejects.toThrow();

  const conta = await prisma.contaPortalAluno.findUniqueOrThrow({ where: { alunoId } });
  expect(conta).toMatchObject({ senhaHash: null, emailVerificado: null });
  const token = await prisma.tokenPortalAluno.findFirstOrThrow({ where: { contaId: conta.id, finalidade: "CONVITE" } });
  expect(token.consumidoEm).toBeNull();
  expect(await prisma.sessaoPortalAluno.count({ where: { contaId: conta.id } })).toBe(0);
});


it("concilia INCERTO e só uma Administração independente cria nova intenção e revoga o token anterior", async () => {
  const solicitacaoId = await prepararConvite();
  const fetch = vi.fn().mockRejectedValue(new Error("falha transitória"));
  await expect(despacharAcessoPortalResend(solicitacaoId, { ambiente, fetch })).resolves.toMatchObject({ situacao: "INCERTO" });
  const conta = await prisma.contaPortalAluno.findUniqueOrThrow({ where: { alunoId } });
  const tokenAntigo = await prisma.tokenPortalAluno.findFirstOrThrow({ where: { contaId: conta.id, finalidade: "CONVITE" } });

  mocks.auth.mockResolvedValue({ user: { id: secretariaId } });
  const evidencia = await registrarEvidenciaEnvioIncerto({ solicitacaoId, evidencia: "Provedor não retornou identificador; conferido no painel institucional." });
  if (!evidencia.ok || !evidencia.dado) throw new Error(JSON.stringify(evidencia));
  await expect(decidirReemissaoEnvioIncerto({ conciliacaoId: evidencia.dado.conciliacaoId, estadoHash: evidencia.dado.estadoHash, aprovar: true, motivo: "Autorizar nova tentativa após conferência." })).resolves.toMatchObject({ ok: false });

  mocks.auth.mockResolvedValue({ user: { id: administradorId } });
  const decisao = await decidirReemissaoEnvioIncerto({ conciliacaoId: evidencia.dado.conciliacaoId, estadoHash: evidencia.dado.estadoHash, aprovar: true, motivo: "Autorizar nova tentativa após conferência." });
  if (!decisao.ok || !decisao.dado?.solicitacaoEnvioId) throw new Error(JSON.stringify(decisao));
  expect((await prisma.solicitacaoEnvioPortalAluno.findUniqueOrThrow({ where: { id: solicitacaoId } })).situacao).toBe("INCERTO");
  expect((await prisma.tokenPortalAluno.findUniqueOrThrow({ where: { id: tokenAntigo.id } })).revogadoEm).not.toBeNull();
  expect((await prisma.solicitacaoEnvioPortalAluno.findUniqueOrThrow({ where: { id: decisao.dado.solicitacaoEnvioId } })).situacao).toBe("PREPARADO");
  const fetchAceito = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "e3919d58-b13e-46cb-9472-95cc5b7f1301" }), { status: 200 }));
  await despacharAcessoPortalResend(decisao.dado.solicitacaoEnvioId, { ambiente, fetch: fetchAceito });
  const tokenNovo = /#token=([^\n]+)/.exec(JSON.parse(fetchAceito.mock.calls[0]![1].body).text)?.[1];
  if (!tokenNovo) throw new Error("A reemissão não materializou token de teste.");
  await consumirTokenPortalAluno({ token: tokenNovo, senha: "Senha inicial segura 2026" });
  await expect(decidirReemissaoEnvioIncerto({ conciliacaoId: evidencia.dado.conciliacaoId, estadoHash: evidencia.dado.estadoHash, aprovar: true, motivo: "Autorizar nova tentativa após conferência." })).resolves.toMatchObject({ ok: true, dado: { idempotente: true } });
});

it("SQL direto não ativa convite quando o contato atual mudou e permite o contato vigente", async () => {
  const conta = await prisma.contaPortalAluno.create({ data: { alunoId, ativa: true } });
  const inserirToken = async (destinatario: string) => prisma.$executeRawUnsafe(`INSERT INTO "TokenPortalAluno" (id, "contaId", finalidade, digest, destinatario, "expiraEm", "consumidoEm") VALUES ('${crypto.randomUUID()}', '${conta.id}', 'CONVITE', '${crypto.randomUUID().replaceAll("-", "").padEnd(64, "0")}', '${destinatario}', NOW() + interval '1 hour', NOW())`);
  await inserirToken("envio@example.test");
  await prisma.aluno.update({ where: { id: alunoId }, data: { email: "novo@example.test" } });
  await expect(prisma.$executeRawUnsafe(`UPDATE "ContaPortalAluno" SET "emailVerificado" = 'envio@example.test' WHERE id = '${conta.id}'`)).rejects.toThrow();
  await inserirToken("novo@example.test");
  await expect(prisma.$executeRawUnsafe(`UPDATE "ContaPortalAluno" SET "emailVerificado" = 'novo@example.test', "senhaHash" = 'hash-de-teste', "emailVerificadoEm" = NOW() WHERE id = '${conta.id}'`)).resolves.toBe(1);
});


it("permite reemitir recuperação assistida sem senha somente após troca aprovada", async () => {
  await prisma.contaPortalAluno.create({ data: { alunoId, ativa: true, emailVerificado: "anterior@example.test", emailVerificadoEm: new Date(), senhaHash: "credencial-anterior" } });
  mocks.auth.mockResolvedValue({ user: { id: secretariaId } });
  const troca = await prepararTrocaEmailPortalAluno({ alunoId, novoEmail: "envio@example.test", motivo: "Troca de contato confirmada pela secretaria.", evidencia: "Registro institucional da alteração do contato." });
  if (!troca.ok || !troca.dado?.solicitacaoId || !troca.dado.solicitacaoEnvioId) throw new Error(JSON.stringify(troca));
  let tokenValidacao = "";
  await despacharSolicitacaoPortalAlunoInterna(troca.dado.solicitacaoEnvioId, async (mensagem) => { tokenValidacao = mensagem.token; });
  await consumirTokenPortalAluno({ token: tokenValidacao });
  mocks.auth.mockResolvedValue({ user: { id: administradorId } });
  const aplicada = await decidirTrocaEmailPortalAluno({ solicitacaoId: troca.dado.solicitacaoId, aprovar: true, motivo: "Aprovação administrativa da alteração." });
  if (!aplicada.ok || !aplicada.dado?.solicitacaoEnvioId) throw new Error(JSON.stringify(aplicada));
  await expect(despacharAcessoPortalResend(aplicada.dado.solicitacaoEnvioId, { ambiente, fetch: vi.fn().mockRejectedValue(new Error("timeout")) })).resolves.toMatchObject({ situacao: "INCERTO" });
  mocks.auth.mockResolvedValue({ user: { id: secretariaId } });
  const evidencia = await registrarEvidenciaEnvioIncerto({ solicitacaoId: aplicada.dado.solicitacaoEnvioId, evidencia: "Sem identificador de provedor após conferência da recuperação assistida." });
  if (!evidencia.ok || !evidencia.dado) throw new Error(JSON.stringify(evidencia));
  mocks.auth.mockResolvedValue({ user: { id: administradorId } });
  await expect(decidirReemissaoEnvioIncerto({ conciliacaoId: evidencia.dado.conciliacaoId, estadoHash: evidencia.dado.estadoHash, aprovar: true, motivo: "Autorizar nova recuperação assistida." })).resolves.toMatchObject({ ok: true, dado: { aprovada: true } });
});

it("SQL direto bloqueia decisão de reemissão com contato alterado ou conta inativa", async () => {
  const solicitacaoId = await prepararConvite();
  await despacharAcessoPortalResend(solicitacaoId, { ambiente, fetch: vi.fn().mockRejectedValue(new Error("timeout")) });
  mocks.auth.mockResolvedValue({ user: { id: secretariaId } });
  const evidencia = await registrarEvidenciaEnvioIncerto({ solicitacaoId, evidencia: "Não houve recibo do provedor para a tentativa original." });
  if (!evidencia.ok || !evidencia.dado) throw new Error(JSON.stringify(evidencia));
  const evidenciaDireta = evidencia.dado;
  const inserirDireto = () => prisma.$executeRawUnsafe(`INSERT INTO "DecisaoReemissaoEnvioPortalAluno" (id, "conciliacaoId", "decisorId", aprovada, motivo, "estadoHash") VALUES ('${crypto.randomUUID()}', '${evidenciaDireta.conciliacaoId}', '${administradorId}', true, 'Tentativa de bypass da autorização vigente.', '${evidenciaDireta.estadoHash}')`);
  await prisma.aluno.update({ where: { id: alunoId }, data: { email: "bypass@example.test" } });
  await expect(inserirDireto()).rejects.toThrow();
  const conta = await prisma.contaPortalAluno.findUniqueOrThrow({ where: { alunoId } });
  await prisma.contaPortalAluno.update({ where: { id: conta.id }, data: { ativa: false } });
  await expect(inserirDireto()).rejects.toThrow();
});
