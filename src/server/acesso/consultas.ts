import { prisma } from "@/lib/prisma";
import { numeroOuNull } from "@/server/_shared/decimal";
import { exigirSessaoComPapel } from "@/server/_shared";
import { Papel } from "@prisma/client";

// Consultas (leitura) de Usuários — Server Components.
export async function listarUsuarios() {
  await exigirSessaoComPapel(Papel.ADMINISTRADOR);
  const usuarios = await prisma.usuario.findMany({
    orderBy: { nome: "asc" },
    select: {
      id: true,
      nome: true,
      email: true,
      papeis: true,
      ativo: true,
      limiteDescontoPct: true,
      limiteDescontoTaxaPct: true,
      limiteDescontoMensalidadePct: true,
      permissoes: true,
      gerenteComercialId: true,
      ultimoAcesso: true,
    },
  });
  // limiteDescontoPct: Decimal → number (borda Server → Client)
  return usuarios.map((u) => ({ ...u, limiteDescontoPct: numeroOuNull(u.limiteDescontoPct), limiteDescontoTaxaPct: numeroOuNull(u.limiteDescontoTaxaPct), limiteDescontoMensalidadePct: numeroOuNull(u.limiteDescontoMensalidadePct) }));
}

export type UsuarioListado = Awaited<ReturnType<typeof listarUsuarios>>[number];
