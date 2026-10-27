import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { EscopoRelatorio } from "@/server/relatorios/escopo";

export function listarResponsaveis(escopo: EscopoRelatorio) {
  return prisma.usuario.findMany({
    where: { ativo: true, papeis: { hasSome: [Papel.VENDEDOR, Papel.GERENTE_COMERCIAL] }, ...(escopo.tipo === "USUARIOS" ? { id: { in: escopo.ids } } : {}) },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
}
