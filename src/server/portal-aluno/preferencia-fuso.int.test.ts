import { beforeEach, expect, it, vi } from "vitest";

const sessaoAtual = vi.hoisted(() => ({ valor: { sessaoId: "", contaId: "", alunoId: "", email: "" } }));
vi.mock("./sessao", async (importOriginal) => ({ ...(await importOriginal<typeof import("./sessao")>()), exigirSessaoPortalAluno: async () => sessaoAtual.valor }));

import { prisma } from "@/lib/prisma";
import { seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { criarSessaoPortalAlunoTx } from "./sessao";
import { consultarPreferenciaFusoPortalAluno, salvarPreferenciaFusoPortalAluno } from "./preferencia-fuso";

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluna de fuso", paisId: catalogo.pais.id } });
  const conta = await prisma.contaPortalAluno.create({ data: { alunoId: aluno.id, ativa: true, emailVerificado: "fuso@portal.test", emailVerificadoEm: new Date(), senhaHash: "hash" } });
  const criada = await prisma.$transaction((tx) => criarSessaoPortalAlunoTx(tx, { contaId: conta.id, versaoConta: conta.versaoSessao, prazos: { sessaoMinutos: 60, conviteMinutos: 60, recuperacaoMinutos: 60, validacaoEmailMinutos: 60 } }));
  sessaoAtual.valor = { sessaoId: criada.id, contaId: conta.id, alunoId: aluno.id, email: "fuso@portal.test" };
});

it("grava a preferência da conta da sessão e revalida versão antes de alterar", async () => {
  expect(await salvarPreferenciaFusoPortalAluno({ fusoExibicao: "America/Costa_Rica" })).toEqual({ fusoExibicao: "America/Costa_Rica" });
  expect(await consultarPreferenciaFusoPortalAluno()).toEqual({ fusoExibicao: "America/Costa_Rica" });
  await prisma.contaPortalAluno.update({ where: { id: sessaoAtual.valor.contaId }, data: { versaoSessao: { increment: 1 } } });
  await expect(salvarPreferenciaFusoPortalAluno({ fusoExibicao: "UTC" })).rejects.toThrow("Sessão do aluno inválida ou expirada");
});

it("mantém a conta ativa exigida e o SQL recusa Factory", async () => {
  await expect(prisma.contaPortalAluno.update({ where: { id: sessaoAtual.valor.contaId }, data: { fusoExibicao: "Factory" } })).rejects.toThrow("Fuso de exibição inválido");
  await prisma.contaPortalAluno.update({ where: { id: sessaoAtual.valor.contaId }, data: { ativa: false } });
  await expect(consultarPreferenciaFusoPortalAluno()).rejects.toThrow("Sessão do aluno inválida ou expirada");
});

it("não grava depois de revogação da sessão capturada", async () => {
  await prisma.sessaoPortalAluno.update({ where: { id: sessaoAtual.valor.sessaoId }, data: { revogadaEm: new Date() } });
  await expect(salvarPreferenciaFusoPortalAluno({ fusoExibicao: "UTC" })).rejects.toThrow("Sessão do aluno inválida ou expirada");
  expect((await prisma.contaPortalAluno.findUniqueOrThrow({ where: { id: sessaoAtual.valor.contaId } })).fusoExibicao).toBeNull();
});

it("relê revogação ocorrida enquanto a preferência aguarda o lock da conta", async () => {
  let liberar!: () => void, avisar!: () => void;
  const bloqueio = new Promise<void>((resolve) => { liberar = resolve; });
  const travada = new Promise<void>((resolve) => { avisar = resolve; });
  const revogar = prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ContaPortalAluno" WHERE id = ${sessaoAtual.valor.contaId} FOR UPDATE`;
    avisar(); await bloqueio;
    await tx.contaPortalAluno.update({ where: { id: sessaoAtual.valor.contaId }, data: { versaoSessao: { increment: 1 } } });
    await tx.sessaoPortalAluno.update({ where: { id: sessaoAtual.valor.sessaoId }, data: { revogadaEm: new Date() } });
  });
  await travada;
  const salvar = salvarPreferenciaFusoPortalAluno({ fusoExibicao: "UTC" });
  let aguardando = false;
  const limite = Date.now() + 2_000;
  while (!aguardando && Date.now() < limite) {
    const linhas = await prisma.$queryRaw<Array<{ esperando: boolean }>>`SELECT EXISTS(
      SELECT 1 FROM pg_stat_activity a WHERE a.wait_event_type = 'Lock' AND a.query LIKE '%ContaPortalAluno%'
    ) AS esperando`;
    aguardando = linhas[0]?.esperando === true;
    if (!aguardando) await new Promise((resolve) => setTimeout(resolve, 15));
  }
  expect(aguardando).toBe(true);
  liberar(); await revogar;
  await expect(salvar).rejects.toThrow("Sessão do aluno inválida ou expirada");
  expect((await prisma.contaPortalAluno.findUniqueOrThrow({ where: { id: sessaoAtual.valor.contaId } })).fusoExibicao).toBeNull();
});
