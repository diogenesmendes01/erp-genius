import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { temPapel, type UsuarioSessao } from "@/server/_shared";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import type { Db } from "./escopo";


export async function podeVerLeadNaThread(usuario: UsuarioSessao, atendimentoId: string, leadId: string, agora: number, db: Db = prisma): Promise<boolean> {
  if (temPapel(usuario, Papel.ADMINISTRADOR)) return true;
  if (temPapel(usuario, Papel.VENDEDOR, Papel.GERENTE_COMERCIAL)
    && await db.oportunidade.count({ where: { AND: [{ id: leadId }, await escopoComercialAtual(usuario, db)] } })) return true;
  const instante = new Date(agora);
  return !!await db.participanteAtendimentoWhatsApp.count({ where: {
    atendimentoId, usuarioId: usuario.id, inicio: { lte: instante }, fim: { gt: instante }, revogadoEm: null,
  } });
}
