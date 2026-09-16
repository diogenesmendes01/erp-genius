import type { Prisma } from "@prisma/client";
export { INCLUDE_DESTINO, INCLUDE_MATRICULA_DESTINO, resolverDestinoCobranca, resolverDestinoFinanceiroDaMatricula } from "./destinatario-financeiro";
export type { CobrancaComDestino, DestinoFinanceiro as DestinoCobranca, MatriculaComDestino, OrigemDestinoFinanceiro, TipoPagadorDestino } from "./destinatario-financeiro";

// IDENTIDADE (doc 26 §Camada 0): a costura telefone/wa_id → responsável/aluno/lead.
// ContatoWhatsApp.telefoneE164 é a primeira unicidade de telefone do sistema (doc 29) —
// FK sempre, nunca telefone copiado como string em intenção/mensagem.

/** wa_id da Meta/Baileys = E.164 sem o "+" — normaliza para o formato canônico do banco. */
export function telefoneDeWaId(waId: string): string {
  const digitos = waId.replace(/\D/g, "");
  return `+${digitos}`;
}

/** Garante o ContatoWhatsApp do telefone (upsert), preservando vínculos já existentes. */
export async function garantirContato(
  tx: Prisma.TransactionClient,
  dados: {
    telefoneE164: string;
    waId?: string | null;
    nomeExibicao?: string | null;
    alunoId?: string | null;
    responsavelId?: string | null;
    leadId?: string | null;
  },
) {
  const existente = await tx.contatoWhatsApp.findUnique({ where: { telefoneE164: dados.telefoneE164 } });
  if (existente) {
    return tx.contatoWhatsApp.update({
      where: { id: existente.id },
      data: {
        waId: existente.waId ?? dados.waId ?? undefined,
        nomeExibicao: existente.nomeExibicao ?? dados.nomeExibicao ?? undefined,
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
      alunoId: dados.alunoId ?? null,
      responsavelId: dados.responsavelId ?? null,
      leadId: dados.leadId ?? null,
    },
  });
}
