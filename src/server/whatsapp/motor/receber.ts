import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { EnvelopeMotor } from "./eventos";

/** Grava o evento na tabela de entrada. Dedupe por idEvento: repetido → "duplicado". */
export async function registrarEventoMotor(env: EnvelopeMotor): Promise<"novo" | "duplicado"> {
  try {
    await prisma.eventoMotorRecebido.create({
      data: {
        idEvento: env.idEvento,
        tipo: env.tipo,
        numeroRef: env.numeroId,
        ocorridoEm: new Date(env.ocorridoEm),
        dados: (env.dados ?? {}) as Prisma.InputJsonValue,
      },
    });
    return "novo";
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "duplicado";
    throw e;
  }
}

export type ResultadoProcessamento = "ok" | { ignorado: string } | { adiar: string };
export type ProcessadorEvento = (env: EnvelopeMotor) => Promise<ResultadoProcessamento>;

/** Preenchido pelas tasks 12–17. Tipo sem processador → `{ ignorado: "tipo_desconhecido" }`. */
export const PROCESSADORES: Record<string, ProcessadorEvento> = {};

export const MAX_TENTATIVAS_EVENTO = 12;
export const RETENCAO_EVENTO_MS = 7 * 86_400_000;

/**
 * Prazo do dreno: depois dele não pega evento novo; o resto fica para o próximo dreno.
 * Um evento sozinho pode levar até 60 s (download de mídia), então o timeout da transação
 * que segura o lock precisa cobrir prazo + 1 evento lento + folga. Se a transação expirasse,
 * o lock seria liberado com o laço ainda rodando e um segundo dreno processaria os mesmos eventos.
 */
export const PRAZO_DRENO_MS = 60_000;
const TIMEOUT_TX_DRENO_MS = 180_000;

const BACKOFF_BASE_MS = 5_000;
const BACKOFF_MAX_MS = 10 * 60_000;

async function executar(ev: {
  idEvento: string;
  tipo: string;
  numeroRef: string;
  ocorridoEm: Date;
  dados: unknown;
}): Promise<ResultadoProcessamento> {
  const proc = Object.hasOwn(PROCESSADORES, ev.tipo) ? PROCESSADORES[ev.tipo] : undefined;
  if (!proc) return { ignorado: "tipo_desconhecido" };
  try {
    return await proc({
      idEvento: ev.idEvento,
      tipo: ev.tipo,
      numeroId: ev.numeroRef,
      ocorridoEm: ev.ocorridoEm.getTime(),
      dados: ev.dados,
    });
  } catch (e) {
    return { adiar: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Drena a tabela de entrada em ordem de `seq`, um dreno por vez (advisory lock de transação).
 * O processamento usa o `prisma` normal (outras conexões); a transação só segura o lock.
 */
export async function drenarEventosMotor(
  agora: Date = new Date(),
  opcoes: { prazoMs?: number; relogio?: () => number } = {},
): Promise<{ processados: number; adiados: number; descartados: number; interrompido: boolean }> {
  const r = { processados: 0, adiados: 0, descartados: 0, interrompido: false };
  const relogio = opcoes.relogio ?? Date.now;
  const limite = relogio() + (opcoes.prazoMs ?? PRAZO_DRENO_MS);
  await prisma.$transaction(
    async (tx) => {
      const [{ ok }] = await tx.$queryRaw<{ ok: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtext('eventos_motor')) AS ok`;
      if (!ok) return;
      drenar: for (;;) {
        const lote = await prisma.eventoMotorRecebido.findMany({
          where: {
            processadoEm: null,
            OR: [{ proximaTentativaEm: null }, { proximaTentativaEm: { lte: agora } }],
          },
          orderBy: { seq: "asc" },
          take: 100,
        });
        if (!lote.length) break;
        for (const ev of lote) {
          if (relogio() >= limite) {
            r.interrompido = true;
            break drenar;
          }
          const res = await executar(ev);
          if (res === "ok") {
            await prisma.eventoMotorRecebido.update({
              where: { id: ev.id },
              data: { processadoEm: agora, resultado: "ok" },
            });
            r.processados += 1;
          } else if ("ignorado" in res) {
            await prisma.eventoMotorRecebido.update({
              where: { id: ev.id },
              data: { processadoEm: agora, resultado: `ignorado:${res.ignorado}` },
            });
            r.descartados += 1;
          } else if (ev.tentativas + 1 >= MAX_TENTATIVAS_EVENTO) {
            await prisma.eventoMotorRecebido.update({
              where: { id: ev.id },
              data: {
                processadoEm: agora,
                tentativas: ev.tentativas + 1,
                resultado: `desistiu:${res.adiar}`.slice(0, 500),
              },
            });
            r.descartados += 1;
          } else {
            const espera = Math.min(BACKOFF_BASE_MS * 2 ** ev.tentativas, BACKOFF_MAX_MS);
            await prisma.eventoMotorRecebido.update({
              where: { id: ev.id },
              data: {
                tentativas: ev.tentativas + 1,
                proximaTentativaEm: new Date(agora.getTime() + espera),
                resultado: `adiado:${res.adiar}`.slice(0, 500),
              },
            });
            r.adiados += 1;
          }
        }
      }
      // Retenção: dados operacionais, não de negócio.
      await prisma.eventoMotorRecebido.deleteMany({
        where: { processadoEm: { not: null }, recebidoEm: { lt: new Date(agora.getTime() - RETENCAO_EVENTO_MS) } },
      });
    },
    { timeout: TIMEOUT_TX_DRENO_MS },
  );
  return r;
}
