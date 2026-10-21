import { Prisma } from "@prisma/client";
import { digestSegredoPortalAluno } from "./politica";

const JANELA_MS = 15 * 60 * 1000;
const MAX_FALHAS = 5;
const instanteUtc = (valor: Date) => Prisma.sql`${valor}::timestamptz AT TIME ZONE 'UTC'`;
const chave = (email: string) => digestSegredoPortalAluno(`login-portal:${email}`);

type LinhaTentativa = { chaveDigest: string; falhas: number; janelaIniciadaEm: Date; bloqueadaAte: Date | null };

// Uma linha ainda inexistente não pode ser protegida com FOR UPDATE.
// Serializar pela chave também protege o primeiro registro e a limpeza.
async function bloquearChaveTx(tx: Prisma.TransactionClient, email: string) {
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${chave(email)}, 0))`);
}

export async function loginPortalBloqueadoTx(tx: Prisma.TransactionClient, email: string, agora = new Date()) {
  await bloquearChaveTx(tx, email);
  const [tentativa] = await tx.$queryRaw<LinhaTentativa[]>(Prisma.sql`
    SELECT "chaveDigest" AS "chaveDigest", falhas, "janelaIniciadaEm" AS "janelaIniciadaEm", "bloqueadaAte" AS "bloqueadaAte"
    FROM "TentativaAutenticacaoPortalAluno" WHERE "chaveDigest" = ${chave(email)} FOR UPDATE
  `);
  if (!tentativa) return false;
  if (tentativa.bloqueadaAte && tentativa.bloqueadaAte > agora) return true;
  if (agora.getTime() - tentativa.janelaIniciadaEm.getTime() >= JANELA_MS) {
    await tx.$executeRaw(Prisma.sql`
      UPDATE "TentativaAutenticacaoPortalAluno"
      SET falhas = 0, "janelaIniciadaEm" = ${instanteUtc(agora)}, "bloqueadaAte" = NULL, "atualizadaEm" = ${instanteUtc(agora)}
      WHERE "chaveDigest" = ${chave(email)}
    `);
  }
  return false;
}

export async function registrarFalhaLoginPortal(tx: Prisma.TransactionClient, email: string, agora = new Date()) {
  await bloquearChaveTx(tx, email);
  const chaveDigest = chave(email);
  const [existente] = await tx.$queryRaw<LinhaTentativa[]>(Prisma.sql`
    SELECT "chaveDigest" AS "chaveDigest", falhas, "janelaIniciadaEm" AS "janelaIniciadaEm", "bloqueadaAte" AS "bloqueadaAte"
    FROM "TentativaAutenticacaoPortalAluno" WHERE "chaveDigest" = ${chaveDigest} FOR UPDATE
  `);
  if (!existente) {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "TentativaAutenticacaoPortalAluno" ("chaveDigest", falhas, "janelaIniciadaEm", "atualizadaEm")
      VALUES (${chaveDigest}, 1, ${instanteUtc(agora)}, ${instanteUtc(agora)})
    `);
    return;
  }
  const reiniciar = agora.getTime() - existente.janelaIniciadaEm.getTime() >= JANELA_MS;
  const falhas = reiniciar ? 1 : existente.falhas + 1;
  const bloqueadaAte = falhas >= MAX_FALHAS ? new Date(agora.getTime() + JANELA_MS) : null;
  await tx.$executeRaw(Prisma.sql`
    UPDATE "TentativaAutenticacaoPortalAluno"
    SET falhas = ${falhas}, "janelaIniciadaEm" = ${instanteUtc(reiniciar ? agora : existente.janelaIniciadaEm)},
      "bloqueadaAte" = ${bloqueadaAte ? instanteUtc(bloqueadaAte) : null}, "atualizadaEm" = ${instanteUtc(agora)}
    WHERE "chaveDigest" = ${chaveDigest}
  `);
}

export async function limparFalhasLoginPortal(tx: Prisma.TransactionClient, email: string) {
  await bloquearChaveTx(tx, email);
  await tx.$executeRaw(Prisma.sql`DELETE FROM "TentativaAutenticacaoPortalAluno" WHERE "chaveDigest" = ${chave(email)}`);
}
