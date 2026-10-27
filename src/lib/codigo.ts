import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const PREFIXO = {
  lead: "L",
  aluno: "A",
  matricula: "M",
  cobranca: "C",
  turma: "T",
  empresa: "E",
  fatura: "F",
} as const;

export type EntidadeCodigo = keyof typeof PREFIXO;

export async function gerarCodigo(
  chave: EntidadeCodigo,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<string> {
  const contador = await client.contador.upsert({
    where: { chave },
    update: { valor: { increment: 1 } },
    create: { chave, valor: 1 },
  });
  const numero = String(contador.valor).padStart(6, "0");
  return `${PREFIXO[chave]}-${numero}`;
}
