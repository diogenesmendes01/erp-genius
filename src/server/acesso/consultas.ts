import { prisma } from "@/lib/prisma";
import { numeroOuNull } from "@/server/_shared/decimal";

// Consultas (leitura) de Usuários — Server Components.
export async function listarUsuarios() {
  const usuarios = await prisma.usuario.findMany({
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
  // limiteDescontoPct: Decimal → number (borda Server → Client)
  return usuarios.map((u) => ({ ...u, limiteDescontoPct: numeroOuNull(u.limiteDescontoPct) }));
}

export type UsuarioListado = Awaited<ReturnType<typeof listarUsuarios>>[number];
