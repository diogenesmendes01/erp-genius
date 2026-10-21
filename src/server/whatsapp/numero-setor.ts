import type { FinalidadeNumero, Prisma, PrismaClient } from "@prisma/client";
import { SETORES, type Setor } from "./setor";

/**
 * Compatibilidade de número legado (sem setor cadastrado) pela finalidade antiga.
 * Remover na Fase 4, quando os números forem recriados no motor.
 */
const LEGADO: Record<Setor, FinalidadeNumero[]> = {
  FINANCEIRO: ["COBRANCA"],
  COMERCIAL: ["VENDAS"],
  SECRETARIA: [],
  PEDAGOGICO: [],
};

/** Números que servem o setor: cadastro explícito ou, sem cadastro, a finalidade legada. */
export function whereNumeroServeSetor(setor: Setor): Prisma.NumeroWhatsAppWhereInput {
  return {
    OR: [
      { setores: { some: { finalidade: setor } } },
      { setores: { none: {} }, finalidade: { in: LEGADO[setor] } },
    ],
  };
}

/** Setores do número em ordem fixa de SETORES; sem cadastro, deriva do legado. */
export async function setoresDoNumero(
  db: Prisma.TransactionClient | PrismaClient,
  numeroId: string,
): Promise<Setor[]> {
  const numero = await db.numeroWhatsApp.findUnique({
    where: { id: numeroId },
    select: { finalidade: true, setores: { select: { finalidade: true } } },
  });
  return numero ? setoresDeNumero(numero) : [];
}

/** Mesma regra de `setoresDoNumero` sobre um número já carregado (com `setores`). */
export function setoresDeNumero(numero: { finalidade: FinalidadeNumero; setores: { finalidade: Setor }[] }): Setor[] {
  const cadastrados = new Set<Setor>(numero.setores.map((s) => s.finalidade));
  if (cadastrados.size > 0) return SETORES.filter((s) => cadastrados.has(s));
  return SETORES.filter((s) => LEGADO[s].includes(numero.finalidade));
}
