import { beforeEach, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { limparFalhasLoginPortal, loginPortalBloqueadoTx, registrarFalhaLoginPortal } from "./rate-limit";

beforeEach(async () => { await truncarBanco(); });

it("serializa primeiras falhas concorrentes sem perder tentativas ou expor o email", async () => {
  const email = "aluno.concorrencia@example.test";
  const agora = new Date("2026-09-14T18:00:00Z");
  const resultados = await Promise.all(Array.from({ length: 7 }, () => prisma.$transaction(async tx => {
    if (await loginPortalBloqueadoTx(tx, email, agora)) return "BLOQUEADO";
    await registrarFalhaLoginPortal(tx, email, agora);
    return "FALHA";
  })));
  expect(resultados.filter(r => r === "FALHA")).toHaveLength(5);
  expect(resultados.filter(r => r === "BLOQUEADO")).toHaveLength(2);
  const linhas = await prisma.tentativaAutenticacaoPortalAluno.findMany();
  expect(linhas).toHaveLength(1);
  expect(linhas[0].falhas).toBe(5);
  expect(linhas[0].janelaIniciadaEm).toEqual(agora);
  expect(linhas[0].bloqueadaAte).toEqual(new Date("2026-09-14T18:15:00Z"));
  expect(JSON.stringify(linhas)).not.toContain(email);
});

it("reinicia janela expirada e isola namespaces de login e recuperação", async () => {
  const email = "aluno@example.test";
  const agora = new Date("2026-09-14T18:00:00Z");
  for (let i = 0; i < 5; i++) await prisma.$transaction(tx => registrarFalhaLoginPortal(tx, email, agora));
  expect(await prisma.$transaction(tx => loginPortalBloqueadoTx(tx, email, agora))).toBe(true);
  expect(await prisma.$transaction(tx => loginPortalBloqueadoTx(tx, `recuperacao:${email}`, agora))).toBe(false);
  expect(await prisma.$transaction(tx => loginPortalBloqueadoTx(tx, email, new Date("2026-09-14T18:15:00Z")))).toBe(false);
  expect((await prisma.tentativaAutenticacaoPortalAluno.findFirstOrThrow()).falhas).toBe(0);
  await prisma.$transaction(tx => limparFalhasLoginPortal(tx, email));
  expect(await prisma.tentativaAutenticacaoPortalAluno.count()).toBe(0);
});
