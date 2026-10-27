import { Papel } from "@prisma/client";
import { temPapel, type UsuarioSessao } from "@/server/_shared";

export function podeConverterLead(
  usuario: UsuarioSessao,
  vendedorDonoId: string | null,
): boolean {
  if (temPapel(usuario, Papel.GERENTE_COMERCIAL)) return true;
  return vendedorDonoId === usuario.id;
}
