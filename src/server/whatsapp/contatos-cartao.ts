import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared";
import { atendimentoVisivel } from "./atendimentos";
import { whereNumeroServeSetor } from "./numero-setor";

export interface ContatoCartao { id: string; rotulo: string; telefoneE164: string; contatoJid: string }

export async function contatosCompartilhaveis(u: UsuarioSessao, atendimentoId: string): Promise<ContatoCartao[]> {
  const a = await atendimentoVisivel(u, atendimentoId, true);
  if (!a || a.encerradoEm || !a.numero.ativo || a.numero.driver !== "MOTOR") return [];
  const numeros = await prisma.numeroWhatsApp.findMany({
    where: {
      AND: [
        { ativo: true, excluidoEm: null, donoId: null, finalidade: { not: "AGENDA" }, configuracaoAvisosAgenda: { is: null } },
        whereNumeroServeSetor(a.finalidade),
      ],
    },
    select: { id: true, rotulo: true, telefoneE164: true },
    orderBy: [{ rotulo: "asc" }, { id: "asc" }],
  });
  return numeros.flatMap((n) => {
    const digitos = n.telefoneE164.replace(/\D/g, "");
    return /^\d{8,20}$/.test(digitos) ? [{ id: n.id, rotulo: n.rotulo, telefoneE164: n.telefoneE164, contatoJid: `${digitos}@s.whatsapp.net` }] : [];
  });
}
