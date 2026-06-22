import { prisma } from "@/lib/prisma";

// Consultas (leitura) de Usuários — Server Components.
export async function listarUsuarios() {
  return prisma.usuario.findMany({
    orderBy: { nome: "asc" },
    select: {
      id: true,
      nome: true,
      email: true,
      papeis: true,
      ativo: true,
      limiteDescontoPct: true,
      ultimoAcesso: true,
    },
  });
}

export type UsuarioListado = Awaited<ReturnType<typeof listarUsuarios>>[number];
