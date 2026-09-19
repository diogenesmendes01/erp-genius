"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroAutenticacao } from "@/server/_shared";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";
import { exigirSessaoPortalAluno, revalidarSessaoPortalAlunoTx } from "./sessao";

const Entrada = z.object({ fusoExibicao: z.union([FusoInstitucionalSchema, z.literal(""), z.null()]) }).strict().transform((d) => ({ fusoExibicao: d.fusoExibicao || null }));

/** A escrita bloqueia primeiro a conta e depois a sessão; a validação acontece depois
 * dos locks para que revogação ou troca de versão concorrente vença a preferência. */
async function travarSessaoAtualTx(tx: Prisma.TransactionClient, sessao: Awaited<ReturnType<typeof exigirSessaoPortalAluno>>) {
  const [conta] = await tx.$queryRaw<Array<{ id: string; alunoId: string; ativa: boolean; versaoSessao: number; emailVerificado: string | null; senhaHash: string | null }>>(Prisma.sql`
    SELECT id, "alunoId", ativa, "versaoSessao", "emailVerificado", "senhaHash"
    FROM "ContaPortalAluno" WHERE id = ${sessao.contaId} FOR UPDATE
  `);
  const [sessaoAtual] = await tx.$queryRaw<Array<{ id: string; contaId: string; versaoConta: number; revogadaEm: Date | null; expiraEm: Date }>>(Prisma.sql`
    SELECT id, "contaId", "versaoConta", "revogadaEm", "expiraEm"
    FROM "SessaoPortalAluno" WHERE id = ${sessao.sessaoId} FOR UPDATE
  `);
  if (!conta || !sessaoAtual || conta.alunoId !== sessao.alunoId || sessaoAtual.contaId !== conta.id
    || !conta.ativa || !conta.emailVerificado || !conta.senhaHash || sessaoAtual.revogadaEm
    || sessaoAtual.expiraEm <= new Date() || sessaoAtual.versaoConta !== conta.versaoSessao) {
    throw new ErroAutenticacao("Sessão do aluno inválida ou expirada.");
  }
  return conta;
}

export async function consultarPreferenciaFusoPortalAluno() {
  const sessao = await exigirSessaoPortalAluno();
  return prisma.$transaction(async (tx) => {
    await revalidarSessaoPortalAlunoTx(tx, sessao);
    const conta = await tx.contaPortalAluno.findUnique({ where: { id: sessao.contaId }, select: { alunoId: true, ativa: true, fusoExibicao: true } });
    if (!conta?.ativa || conta.alunoId !== sessao.alunoId) throw new Error("Sessão do aluno inválida ou expirada.");
    return { fusoExibicao: conta.fusoExibicao };
  });
}

export async function salvarPreferenciaFusoPortalAluno(input: unknown) {
  const dados = Entrada.parse(input), sessao = await exigirSessaoPortalAluno();
  return prisma.$transaction(async (tx) => {
    const conta = await travarSessaoAtualTx(tx, sessao);
    await tx.contaPortalAluno.update({ where: { id: sessao.contaId }, data: { fusoExibicao: dados.fusoExibicao } });
    return { fusoExibicao: dados.fusoExibicao };
  });
}
