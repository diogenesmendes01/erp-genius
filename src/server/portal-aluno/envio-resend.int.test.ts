import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { consumirTokenPortalAluno, prepararConvitePortalAluno } from "./identidade";
import { despacharAcessoPortalResend } from "./envio-resend";

const ambiente = {
  EMAIL_PORTAL_ENVIO_ENABLED: "true",
  RESEND_API_KEY: "chave-resend-de-teste",
  EMAIL_INSTITUCIONAL_REMETENTE: "portal@example.test",
  PORTAL_ALUNO_URL_PUBLICA: "https://escola.example.test",
};
let secretariaId: string;
let alunoId: string;

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
