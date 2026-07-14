import { Papel, type Prisma } from "@prisma/client";
import type { UsuarioSessao } from "@/server/_shared";

// ESCOPO ROW-LEVEL DA CONVERSA (gap D22 do doc 28, decidido na E3 — doc 30 §S11):
// a conversa é do NÚMERO, não do lead. Admin vê tudo; Financeiro/Secretaria veem os
// números de COBRANCA; Gerente Comercial supervisiona os números de VENDAS; Vendedor vê
// só os números dos quais é DONO (dono da conversa = dono do número, doc 26 §Camada 3).
// Sem papel que dê acesso → fail-closed (mesmo padrão de escopoAlunos).

export const PAPEIS_INBOX: Papel[] = [
  Papel.ADMINISTRADOR,
  Papel.GERENTE_COMERCIAL,
  Papel.VENDEDOR,
  Papel.FINANCEIRO,
  Papel.SECRETARIA_ACADEMICA,
];

export function escopoNumeros(usuario: UsuarioSessao): Prisma.NumeroWhatsAppWhereInput {
  if (usuario.papeis.includes(Papel.ADMINISTRADOR)) return {};
  const ors: Prisma.NumeroWhatsAppWhereInput[] = [];
  if (
    usuario.papeis.includes(Papel.FINANCEIRO) ||
    usuario.papeis.includes(Papel.SECRETARIA_ACADEMICA)
  ) {
    ors.push({ finalidade: "COBRANCA" });
  }
  if (usuario.papeis.includes(Papel.GERENTE_COMERCIAL)) ors.push({ finalidade: "VENDAS" });
  if (usuario.papeis.includes(Papel.VENDEDOR)) ors.push({ donoId: usuario.id });
  if (ors.length === 0) return { id: "__sem_acesso__" }; // fail-closed: não casa com nada
  return { OR: ors };
}

export function escopoConversas(usuario: UsuarioSessao): Prisma.ConversaWhatsAppWhereInput {
  return { numero: escopoNumeros(usuario) };
}

/** Versão booleana do escopo (autorização por objeto de mídia — podeLerArquivo). */
export function usuarioVeNumero(
  usuario: { id: string; papeis: Papel[] },
  numero: { donoId: string | null; finalidade: string },
): boolean {
  if (usuario.papeis.includes(Papel.ADMINISTRADOR)) return true;
  if (
    numero.finalidade === "COBRANCA" &&
    (usuario.papeis.includes(Papel.FINANCEIRO) || usuario.papeis.includes(Papel.SECRETARIA_ACADEMICA))
  ) {
    return true;
  }
  if (numero.finalidade === "VENDAS" && usuario.papeis.includes(Papel.GERENTE_COMERCIAL)) return true;
  if (usuario.papeis.includes(Papel.VENDEDOR) && numero.donoId === usuario.id) return true;
  return false;
}
