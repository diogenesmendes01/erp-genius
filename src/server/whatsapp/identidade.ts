import type { Prisma } from "@prisma/client";
import { nomeCompleto } from "@/lib/nome";

// IDENTIDADE (doc 26 §Camada 0): a costura telefone/wa_id → responsável/aluno/lead.
// ContatoWhatsApp.telefoneE164 é a primeira unicidade de telefone do sistema (doc 29) —
// FK sempre, nunca telefone copiado como string em intenção/mensagem.

export interface DestinoCobranca {
  telefoneE164: string;
  /** Quem atende: responsável financeiro (Kids nunca o aluno — doc 26) ou o próprio aluno. */
  responsavelId: string | null;
  alunoId: string;
  nome: string;
  /** Fuso do CONTATO para a janela de envio (S3): Aluno.fuso ?? Pais.fuso ?? SP. */
  fuso: string;
}

export type CobrancaComDestino = Prisma.CobrancaGetPayload<{
  include: {
    matricula: {
      include: {
        pais: true;
        aluno: {
          include: { pais: true; responsaveis: { include: { responsavel: true } } };
        };
      };
    };
  };
}>;

export const INCLUDE_DESTINO = {
  matricula: {
    include: {
      pais: true,
      aluno: {
        include: { pais: true, responsaveis: { include: { responsavel: true } } },
      },
    },
  },
} as const;

/**
 * Regra determinística S2 (doc 30, resolve o gap 9 do doc 28):
 * 1. vínculo FINANCEIRO existe → telefone do responsável (o vínculo mais antigo com
 *    telefone); se nenhum deles tem telefone → SEM DESTINO (Kids nunca cai pro aluno);
 * 2. sem vínculo FINANCEIRO → telefone do próprio aluno;
 * 3. nada → SEM DESTINO (`null`) — a intenção não nasce e o item vai à fila humana.
 */
export function resolverDestinoCobranca(cobranca: CobrancaComDestino): DestinoCobranca | null {
  const aluno = cobranca.matricula.aluno;
  const fuso = aluno.fuso ?? aluno.pais?.fuso ?? cobranca.matricula.pais?.fuso ?? "America/Sao_Paulo";

  const financeiros = aluno.responsaveis
    .filter((v) => v.papel === "FINANCEIRO")
    .sort((a, b) => a.id.localeCompare(b.id)); // cuid é ordenável no tempo — proxy de "mais antigo"

  if (financeiros.length > 0) {
    const comTelefone = financeiros.find((v) => v.responsavel.telefoneE164);
    if (!comTelefone) return null; // responsável cadastrado sem telefone → fila humana
    return {
      telefoneE164: comTelefone.responsavel.telefoneE164!,
      responsavelId: comTelefone.responsavelId,
      alunoId: aluno.id,
      nome: comTelefone.responsavel.nome,
      fuso,
    };
  }

  if (aluno.telefoneE164) {
    return { telefoneE164: aluno.telefoneE164, responsavelId: null, alunoId: aluno.id, nome: nomeCompleto(aluno), fuso };
  }
  return null;
}

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
