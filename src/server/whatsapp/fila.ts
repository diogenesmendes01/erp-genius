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
