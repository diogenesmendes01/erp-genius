import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import type { Prisma as PrismaTypes } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroAutenticacao } from "@/server/_shared";
import {
  COOKIE_SESSAO_PORTAL_ALUNO,
  cookieSessaoPortalAluno,
  digestSegredoPortalAluno,
  gerarSegredoPortalAluno,
  type PrazosPortalAluno,
} from "./politica";

const instanteUtc = (valor: Date) => Prisma.sql`${valor}::timestamptz AT TIME ZONE 'UTC'`;

export type SessaoPortalAluno = {
  sessaoId: string;
  contaId: string;
  alunoId: string;
  email: string;
};

type LinhaSessao = SessaoPortalAluno & { expiraEm: Date };

export async function criarSessaoPortalAlunoTx(
  tx: PrismaTypes.TransactionClient,
  entrada: { contaId: string; versaoConta: number; prazos: PrazosPortalAluno; agora?: Date },
) {
  const agora = entrada.agora ?? new Date();
  const expiraEm = new Date(agora.getTime() + entrada.prazos.sessaoMinutos * 60_000);
  const id = randomUUID(), segredo = gerarSegredoPortalAluno();
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "SessaoPortalAluno" (id, digest, "contaId", "versaoConta", "expiraEm")
    VALUES (${id}, ${digestSegredoPortalAluno(segredo)}, ${entrada.contaId}, ${entrada.versaoConta}, ${instanteUtc(expiraEm)})
  `);
  return { id, segredo, expiraEm };
}

export async function lerSessaoPortalAluno(): Promise<SessaoPortalAluno | null> {
  const loja = await cookies();
  const segredo = loja.get(COOKIE_SESSAO_PORTAL_ALUNO)?.value;
  if (!segredo || segredo.length > 200) return null;
  const agora = new Date();
  const linhas = await prisma.$queryRaw<LinhaSessao[]>(Prisma.sql`
    SELECT s.id AS "sessaoId", c.id AS "contaId", c."alunoId" AS "alunoId",
      c."emailVerificado" AS email, s."expiraEm" AS "expiraEm"
    FROM "SessaoPortalAluno" s
    JOIN "ContaPortalAluno" c ON c.id = s."contaId"
    JOIN "Aluno" a ON a.id = c."alunoId"
    WHERE s.digest = ${digestSegredoPortalAluno(segredo)}
      AND s."revogadaEm" IS NULL
      AND s."expiraEm" > ${instanteUtc(agora)}
      AND s."versaoConta" = c."versaoSessao"
      AND c.ativa = true
      AND c."emailVerificado" IS NOT NULL
      AND c."senhaHash" IS NOT NULL
  `);
  const sessao = linhas[0];
  if (!sessao) return null;
  return { sessaoId: sessao.sessaoId, contaId: sessao.contaId, alunoId: sessao.alunoId, email: sessao.email };
}

/**
 * Revalida, dentro da transação consumidora, uma identidade do portal já
 * capturada. É próprio para operações longas (por exemplo, um pull de
 * stream): não relê cookie nem considera o snapshot suficiente.
 */
export async function revalidarSessaoPortalAlunoTx(
  tx: PrismaTypes.TransactionClient,
  sessao: SessaoPortalAluno,
  agora = new Date(),
): Promise<void> {
  const linhas = await tx.$queryRaw<LinhaSessao[]>(Prisma.sql`
    SELECT s.id AS "sessaoId", c.id AS "contaId", c."alunoId" AS "alunoId",
      c."emailVerificado" AS email, s."expiraEm" AS "expiraEm"
    FROM "SessaoPortalAluno" s
    JOIN "ContaPortalAluno" c ON c.id = s."contaId"
    JOIN "Aluno" a ON a.id = c."alunoId"
    WHERE s.id = ${sessao.sessaoId}
      AND s."contaId" = ${sessao.contaId}
      AND c."alunoId" = ${sessao.alunoId}
      AND s."revogadaEm" IS NULL
      AND s."expiraEm" > ${instanteUtc(agora)}
      AND s."versaoConta" = c."versaoSessao"
      AND c.ativa = true
      AND c."emailVerificado" IS NOT NULL
      AND c."senhaHash" IS NOT NULL
  `);
  const atual = linhas[0];
  if (!atual) throw new ErroAutenticacao("Sessão do aluno inválida ou expirada.");
}

/** Guard exclusivo do portal. Não chama auth() nem lê cookie de funcionário. */
export async function exigirSessaoPortalAluno(): Promise<SessaoPortalAluno> {
  const sessao = await lerSessaoPortalAluno();
  if (!sessao) throw new ErroAutenticacao("Sessão do aluno inválida ou expirada.");
  return sessao;
}

export async function revogarSessaoPortalAlunoAtual(): Promise<void> {
  const loja = await cookies();
  const segredo = loja.get(COOKIE_SESSAO_PORTAL_ALUNO)?.value;
  if (segredo) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "SessaoPortalAluno" SET "revogadaEm" = ${instanteUtc(new Date())}
      WHERE digest = ${digestSegredoPortalAluno(segredo)} AND "revogadaEm" IS NULL
    `);
  }
  loja.delete(COOKIE_SESSAO_PORTAL_ALUNO);
}

export { cookieSessaoPortalAluno };
