import { createHash } from "node:crypto";
import { Prisma, type Evento } from "@prisma/client";
import { ErroRegra } from "./sessao";

// Idempotência de ações de CRIAÇÃO que não têm coluna própria de chave (#166). Mesmo contrato das ações
// que já a têm (`modelos-tx.ts`, `reposicao-entrega-operacional.ts`): a chave é do autor, a entrada vira
// `entradaHash`, a repetição idêntica devolve o resultado original e a chave reaproveitada com outra entrada
// é recusada. Aqui a chave mora no payload do Evento de criação, gravado na MESMA transação do registro
// (docs/13), o que dispensa coluna nova; a busca usa o índice `Evento_idempotencia_idx`. A trava consultiva serializa reenvios simultâneos da mesma chave:
// o segundo espera o primeiro confirmar e então o encontra.

/** Hash da entrada já validada, sem a própria chave. */
export function hashEntrada(entrada: unknown): string {
  return createHash("sha256").update(JSON.stringify(entrada)).digest("hex");
}

/** Marca gravada no payload do Evento de criação. */
export type MarcaIdempotencia = { chaveIdempotencia: string; entradaHash: string };

/** Marca da tentativa, ou `null` quando a tela não mandou chave (o comportamento de antes). */
export function marcaIdempotencia(chaveIdempotencia: string | undefined, entrada: unknown): MarcaIdempotencia | null {
  return chaveIdempotencia ? { chaveIdempotencia, entradaHash: hashEntrada(entrada) } : null;
}

/**
 * Busca do Evento de criação pela chave. Repete a expressão e o predicado do índice parcial
 * `Evento_idempotencia_idx` (migration 20261019010000), para o Postgres usá-lo em vez de percorrer
 * todos os Eventos do tipo (C1 da revisão do #240).
 */
export function sqlBuscaIdempotente(alvo: { tipo: string; agregadoTipo: string; autorId: string; chaveIdempotencia: string }): Prisma.Sql {
  return Prisma.sql`SELECT * FROM "Evento"
    WHERE "tipo" = ${alvo.tipo} AND "autorId" = ${alvo.autorId}
      AND "payload" ? 'chaveIdempotencia' AND ("payload" ->> 'chaveIdempotencia') = ${alvo.chaveIdempotencia}
      AND "agregadoTipo" = ${alvo.agregadoTipo}
    ORDER BY "criadoEm" ASC LIMIT 1`;
}

/**
 * Trava a chave do autor até o fim da transação e procura o Evento de criação que já a usou.
 * Devolve `null` (primeira vez: crie e grave a marca no Evento) ou o Evento original (repetição idêntica).
 * Lança `ErroRegra` quando a chave já foi usada com outra entrada.
 */
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
