import { createHash } from "node:crypto";
import { Prisma, type Evento } from "@prisma/client";
import { ErroRegra } from "./sessao";

export function hashEntrada(entrada: unknown): string {
  return createHash("sha256").update(JSON.stringify(entrada)).digest("hex");
}

export type MarcaIdempotencia = { chaveIdempotencia: string; entradaHash: string };

export function marcaIdempotencia(chaveIdempotencia: string | undefined, entrada: unknown): MarcaIdempotencia | null {
  return chaveIdempotencia ? { chaveIdempotencia, entradaHash: hashEntrada(entrada) } : null;
}

export function sqlBuscaIdempotente(alvo: { tipo: string; agregadoTipo: string; autorId: string; chaveIdempotencia: string }): Prisma.Sql {
  return Prisma.sql`SELECT * FROM "Evento"
    WHERE "tipo" = ${alvo.tipo} AND "autorId" = ${alvo.autorId}
      AND "payload" ? 'chaveIdempotencia' AND ("payload" ->> 'chaveIdempotencia') = ${alvo.chaveIdempotencia}
      AND "agregadoTipo" = ${alvo.agregadoTipo}
    ORDER BY "criadoEm" ASC LIMIT 1`;
}

export async function repeticaoIdempotente(
  tx: Prisma.TransactionClient,
  alvo: { tipo: string; agregadoTipo: string; autorId: string; marca: MarcaIdempotencia; mensagemConflito: string },
): Promise<Evento | null> {
  const { tipo, agregadoTipo, autorId, marca } = alvo;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`idem:${tipo}:${autorId}:${marca.chaveIdempotencia}`}, 0))`;
  const [evento] = await tx.$queryRaw<Evento[]>(sqlBuscaIdempotente({ tipo, agregadoTipo, autorId, chaveIdempotencia: marca.chaveIdempotencia }));
  if (!evento) return null;
  const payload = (evento.payload ?? {}) as Record<string, unknown>;
  if (payload.entradaHash !== marca.entradaHash) throw new ErroRegra(alvo.mensagemConflito);
  return evento;
}

export async function ultimoEventoDoAutor(
  tx: Prisma.TransactionClient,
  alvo: { tipo: string; agregadoTipo: string; agregadoId: string; autorId: string },
): Promise<Record<string, unknown> | null> {
  const ultimo = await tx.evento.findFirst({
    where: { tipo: alvo.tipo, agregadoTipo: alvo.agregadoTipo, agregadoId: alvo.agregadoId },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    select: { autorId: true, payload: true },
  });
  if (!ultimo || ultimo.autorId !== alvo.autorId) return null;
  return (ultimo.payload ?? {}) as Record<string, unknown>;
}
