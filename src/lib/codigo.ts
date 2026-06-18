import { prisma } from "@/lib/prisma";

// Prefixos dos códigos legíveis (ver docs/10 §7).
const PREFIXO = {
  lead: "L",
  aluno: "A",
  matricula: "M",
  cobranca: "C",
  turma: "T",
} as const;

export type EntidadeCodigo = keyof typeof PREFIXO;

/**
 * Gera o próximo código legível (ex.: "L-000001") de forma transacional,
 * sem risco de duplicar sob concorrência — o incremento do contador é atômico.
 */
export async function gerarCodigo(chave: EntidadeCodigo): Promise<string> {
  const contador = await prisma.contador.upsert({
    where: { chave },
    update: { valor: { increment: 1 } },
    create: { chave, valor: 1 },
  });
  const numero = String(contador.valor).padStart(6, "0");
  return `${PREFIXO[chave]}-${numero}`;
}
