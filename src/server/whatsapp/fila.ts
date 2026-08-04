import type { OrigemEnvio, Prisma } from "@prisma/client";
import type { PassoRegua } from "@/server/cobrancas/regua";

// FILA DE ENVIO ÚNICA / outbox (doc 26 §Camada 0): nenhuma automação envia direto — toda
// origem (cron, lote aprovado, clique humano) grava uma INTENÇÃO aqui; só o despachante
// drena. A idempotência por degrau mora no banco (@@unique [cobrancaId, passo]) e no ciclo
// de vida: PENDENTE/ENVIANDO (em voo) e DESPACHADA (enviada de fato) não renascem;
// CANCELADA/FALHOU/ADIADA/SIMULADA reabrem (reset). SIMULADA reabrível é deliberado
// (review PR #49): ensaio não cumpre degrau — ao sair do shadow, o envio real acontece.

export interface EnfileirarCobranca {
  cobrancaId: string;
  passo: PassoRegua;
  numeroId: string;
  contatoId: string;
  origem: OrigemEnvio;
  corpoRenderizado: string;
  variaveis: string[];
  templateId: string | null;
  politicaId: string | null;
  /** null = cron/sistema. */
  autorId: string | null;
}

export type ResultadoEnfileirar = "criada" | "reaberta" | "ja_existente";

export async function enfileirarIntencaoCobranca(
  tx: Prisma.TransactionClient,
  e: EnfileirarCobranca,
): Promise<ResultadoEnfileirar> {
  const existente = await tx.intencaoMensagem.findUnique({
    where: { cobrancaId_passo: { cobrancaId: e.cobrancaId, passo: e.passo } },
  });

  if (existente) {
    // PENDENTE/ENVIANDO estão em voo; DESPACHADA = degrau cumprido (idempotência real).
    if (["PENDENTE", "ENVIANDO", "DESPACHADA"].includes(existente.status)) return "ja_existente";
    await tx.intencaoMensagem.update({
      where: { id: existente.id },
      data: {
        status: "PENDENTE",
        numeroId: e.numeroId,
        contatoId: e.contatoId,
        origem: e.origem,
        corpoRenderizado: e.corpoRenderizado,
        variaveis: e.variaveis,
        templateId: e.templateId,
        politicaId: e.politicaId,
        autorId: e.autorId,
        criadaEm: new Date(), // reabertura conta como intenção nova p/ a lei do despachante
        despacharAposEm: null,
        motivoFalha: null,
      },
    });
    return "reaberta";
  }

  await tx.intencaoMensagem.create({
    data: {
      cobrancaId: e.cobrancaId,
      passo: e.passo,
      numeroId: e.numeroId,
      contatoId: e.contatoId,
      origem: e.origem,
      corpoRenderizado: e.corpoRenderizado,
      variaveis: e.variaveis,
      templateId: e.templateId,
      politicaId: e.politicaId,
      autorId: e.autorId,
    },
  });
  return "criada";
}

// Idem para a cadência COMERCIAL (doc 27): idempotência por
// @@unique([politicaComercialId, leadId, passoComercial]). A POLÍTICA faz parte da chave
// (review PR #55) — cadências distintas compartilham nomes de passo (+30min/+3d/+7d em
// lead-novo e no-show) e não podem se bloquear no mesmo lead. Por isso `politicaComercialId`
// é OBRIGATÓRIO aqui: sem ele não há identidade de degrau (e o NULL do Postgres não é único).
// Mesmo ciclo de vida da cobrança — só troca o vínculo de domínio (Lead + passo da cadência).
export interface EnfileirarComercial {
  leadId: string;
  passoComercial: string;
  numeroId: string;
  contatoId: string;
  corpoRenderizado: string;
  variaveis: string[];
  templateId: string | null;
  politicaComercialId: string;
}

export async function enfileirarIntencaoComercial(
  tx: Prisma.TransactionClient,
  e: EnfileirarComercial,
): Promise<ResultadoEnfileirar> {
  // Lookup por findFirst: a unicidade é um índice UNIQUE PARCIAL (na migration), não um
  // @@unique — então o client não expõe um `findUnique` composto. O índice parcial cobre
  // esta busca (as três colunas presentes) e é o backstop de idempotência no INSERT.
  const existente = await tx.intencaoMensagem.findFirst({
    where: {
      politicaComercialId: e.politicaComercialId,
      leadId: e.leadId,
      passoComercial: e.passoComercial,
    },
  });

  if (existente) {
    if (["PENDENTE", "ENVIANDO", "DESPACHADA"].includes(existente.status)) return "ja_existente";
    await tx.intencaoMensagem.update({
      where: { id: existente.id },
      data: {
        status: "PENDENTE",
        numeroId: e.numeroId,
        contatoId: e.contatoId,
        origem: "CRON",
        corpoRenderizado: e.corpoRenderizado,
        variaveis: e.variaveis,
        templateId: e.templateId,
        politicaComercialId: e.politicaComercialId,
        criadaEm: new Date(),
        despacharAposEm: null,
        motivoFalha: null,
      },
    });
    return "reaberta";
  }

  await tx.intencaoMensagem.create({
    data: {
      leadId: e.leadId,
      passoComercial: e.passoComercial,
      numeroId: e.numeroId,
      contatoId: e.contatoId,
      origem: "CRON",
      corpoRenderizado: e.corpoRenderizado,
      variaveis: e.variaveis,
      templateId: e.templateId,
      politicaComercialId: e.politicaComercialId,
      autorId: null,
    },
  });
  return "criada";
}
