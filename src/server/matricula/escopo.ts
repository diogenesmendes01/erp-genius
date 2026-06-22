import { Papel } from "@prisma/client";
import { temPapel, type UsuarioSessao } from "@/server/_shared";

// Regra pura de ownership/escopo para conversão de lead em matrícula (doc 07).
// Mantida fora de acoes.ts ("use server") para ser importável e testável.

/**
 * O usuário pode converter este lead em matrícula? Espelha a visibilidade
 * row-level do comercial (doc 07): Gerente Comercial/Admin enxergam tudo;
 * Vendedor só os leads do próprio escopo (dono/designado).
 */
export function podeConverterLead(
  usuario: UsuarioSessao,
  vendedorDonoId: string | null,
): boolean {
  if (temPapel(usuario, Papel.GERENTE_COMERCIAL)) return true; // Admin passa em temPapel
  return vendedorDonoId === usuario.id;
}
