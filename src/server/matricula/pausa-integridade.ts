import { createHash } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { ErroPermissao } from "@/server/_shared";

export const APROVADORES_PAUSA: Papel[] = [Papel.FINANCEIRO, Papel.ADMINISTRADOR];
export const hashPausa = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");

export async function estadoHashPausa(tx: Prisma.TransactionClient, ids: string[]) {
  // O conteúdo financeiro participa da conferência, mas não da projeção da Secretaria.
  return hashPausa(await tx.matricula.findMany({ where: { id: { in: ids } }, orderBy: { id: "asc" }, include: {
    cobrancas: { orderBy: { id: "asc" }, include: { recebimentos: { orderBy: { id: "asc" } }, informes: { orderBy: { id: "asc" } } } },
    alocacoes: { orderBy: { id: "asc" } },
  } }));
}

export async function exigirUsuarioPausa(tx: Prisma.TransactionClient, id: string, papeis: Papel[]) {
  const u = await tx.usuario.findUnique({ where: { id }, select: { ativo: true, papeis: true } });
  if (!u?.ativo || !u.papeis.some((p) => papeis.includes(p))) throw new ErroPermissao("Participante sem autorização vigente para esta proposta.");
}
