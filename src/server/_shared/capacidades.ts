import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CAPACIDADES_LABEL } from "@/lib/capacidades";
import { ErroPermissao, type UsuarioSessao } from "./sessao";

export const CAPACIDADES_ADICIONAIS = CAPACIDADES_LABEL;
export type CapacidadeAdicional = keyof typeof CAPACIDADES_ADICIONAIS;

export async function exigirCapacidade(usuario: UsuarioSessao, capacidade: CapacidadeAdicional) {
  const atual = await prisma.usuario.findUnique({
    where: { id: usuario.id }, select: { ativo: true, papeis: true, permissoes: true },
  });
  if (!atual?.ativo || (!atual.papeis.includes(Papel.ADMINISTRADOR) && !atual.permissoes.includes(capacidade))) {
    throw new ErroPermissao("Você não tem a permissão específica para esta operação.");
  }
}
