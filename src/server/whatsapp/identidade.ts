import type { Prisma } from "@prisma/client";
export { INCLUDE_DESTINO, INCLUDE_MATRICULA_DESTINO, resolverDestinoCobranca, resolverDestinoFinanceiroDaMatricula } from "./destinatario-financeiro";
export type { CobrancaComDestino, DestinoFinanceiro as DestinoCobranca, MatriculaComDestino, OrigemDestinoFinanceiro, TipoPagadorDestino } from "./destinatario-financeiro";

export function telefoneDeWaId(waId: string): string {
  const digitos = waId.replace(/\D/g, "");
  return `+${digitos}`;
}

export async function garantirContato(
  tx: Prisma.TransactionClient,
  dados: {
    telefoneE164: string;
    waId?: string | null;
    nomeExibicao?: string | null;
    nomePerfil?: string | null;
    alunoId?: string | null;
    responsavelId?: string | null;
    leadId?: string | null;
  },
) {
  const nomePerfil = dados.nomePerfil?.trim() || null;
  const existente = await tx.contatoWhatsApp.findUnique({ where: { telefoneE164: dados.telefoneE164 } });
  if (existente) {
    return tx.contatoWhatsApp.update({
      where: { id: existente.id },
      data: {
        waId: existente.waId ?? dados.waId ?? undefined,
        nomeExibicao: existente.nomeExibicao ?? (existente.nomeEditadoEm ? undefined : dados.nomeExibicao) ?? undefined,
        nomePerfil: nomePerfil ?? undefined,
        alunoId: existente.alunoId ?? dados.alunoId ?? undefined,
        responsavelId: existente.responsavelId ?? dados.responsavelId ?? undefined,
        leadId: existente.leadId ?? dados.leadId ?? undefined,
      },
    });
  }
  return tx.contatoWhatsApp.create({
    data: {
      telefoneE164: dados.telefoneE164,
      waId: dados.waId ?? null,
      nomeExibicao: dados.nomeExibicao ?? null,
      nomePerfil,
      alunoId: dados.alunoId ?? null,
      responsavelId: dados.responsavelId ?? null,
      leadId: dados.leadId ?? null,
    },
  });
}
