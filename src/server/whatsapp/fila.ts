import type { OrigemEnvio, Prisma } from "@prisma/client";
import type { PassoRegua } from "@/server/cobrancas/regua";
import { ErroRegra } from "@/server/_shared/sessao";
import { garantirAtendimento } from "./atendimentos";
import { podeReabrirIntencao, snapshotCobranca, referenciaDestinoCobranca } from "./elegibilidade";

// FILA DE ENVIO ÚNICA / outbox (doc 26 §Camada 0): nenhuma automação envia direto — toda
// origem (cron, lote aprovado, clique humano) grava uma INTENÇÃO aqui; só o despachante
// drena. A idempotência por degrau/ciclo mora no banco e no ciclo
// de vida: PENDENTE/ENVIANDO (em voo) e DESPACHADA (enviada de fato) não renascem;
// CANCELADA/FALHOU/ADIADA/SIMULADA reabrem (reset). SIMULADA reabrível é deliberado
// (review PR #49): ensaio não cumpre degrau — ao sair do shadow, o envio real acontece.

export interface EnfileirarCobranca {
  cobrancaId: string;
  /** Estado lido para calcular o degrau e renderizar o corpo, antes de abrir a transação. */
  referenciaCalendario: { versao: number; vencimento: string; cicloRegua: number };
  /** Pagador/contato usado para renderizar o texto, conferido novamente na transação. */
  referenciaDestino: string;
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

export class ErroCobrancaAlterada extends ErroRegra {
  constructor() {
    super("A cobrança mudou durante a preparação da mensagem. Atualize e tente novamente.");
  }
}

export async function enfileirarIntencaoCobranca(
  tx: Prisma.TransactionClient,
  e: EnfileirarCobranca,
): Promise<ResultadoEnfileirar> {
  const snapshot = await snapshotCobranca(e.cobrancaId, tx);
  if (!snapshot) throw new Error("Cobrança não encontrada para enfileirar.");
  // Nunca associar o texto de um calendário antigo à assinatura do calendário novo.
  // A data também é comparada para cobrir alterações legadas sem incremento de versão.
  if (!e.referenciaCalendario || !Number.isInteger(e.referenciaCalendario.versao) ||
      e.referenciaCalendario.versao !== snapshot.c.versao ||
      e.referenciaCalendario.cicloRegua !== snapshot.c.cicloRegua ||
      e.referenciaCalendario.vencimento !== snapshot.c.vencimento.toISOString()) {
    throw new ErroCobrancaAlterada();
  }
  if (!snapshot.destino || e.referenciaDestino !== referenciaDestinoCobranca(snapshot.destino)) throw new ErroCobrancaAlterada();
  const atendimento = await garantirAtendimento(tx, {
    numeroId: e.numeroId, contatoId: e.contatoId, finalidade: "FINANCEIRO", alunoId: snapshot.c.matricula.alunoId,
    matriculaId: snapshot.c.matriculaId,
  });
  const existente = await tx.intencaoMensagem.findUnique({
    where: { cobrancaId_passo_cicloCobranca: { cobrancaId: e.cobrancaId, passo: e.passo, cicloCobranca: snapshot.c.cicloRegua } },
  });

  if (existente) {
    // PENDENTE/ENVIANDO estão em voo; DESPACHADA = degrau cumprido (idempotência real).
    if (!podeReabrirIntencao(existente.status, existente.motivoFalha)) return "ja_existente";
    const reaberta = await tx.intencaoMensagem.updateMany({
      // Um cron concorrente pode ter reaberto e feito o claim enquanto líamos.
      // Só o estado observado pode ser reaberto, sem devolver ENVIANDO à fila.
      where: { id: existente.id, status: existente.status, motivoFalha: existente.motivoFalha },
      data: {
        status: "PENDENTE",
        atendimentoId: atendimento.id,
        referenciaCobranca: snapshot.assinatura,
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
    return reaberta.count === 1 ? "reaberta" : "ja_existente";
  }

  await tx.intencaoMensagem.create({
    data: {
      cobrancaId: e.cobrancaId,
      cicloCobranca: snapshot.c.cicloRegua,
      atendimentoId: atendimento.id,
      referenciaCobranca: snapshot.assinatura,
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
// A chave carrega também a OCORRÊNCIA (review PR #56) — a âncora em ISO. Sem ela a
// idempotência seria eterna por lead: uma experimental REAGENDADA herdaria os passos já
// cumpridos do ciclo anterior e nunca dispararia.
export interface EnfileirarComercial {
  leadId: string;
  passoComercial: string;
  /** Identidade do ciclo: âncora em ISO (horário da aula, 1º inbound do lead...). */
  ocorrenciaComercial: string;
  numeroId: string;
  contatoId: string;
  corpoRenderizado: string;
  variaveis: string[];
  templateId: string | null;
  politicaComercialId: string;
  /** B3 (doc 32): validade do disparo — o despachante CANCELA depois dela. null = sem limite. */
  validaAte: Date | null;
}

export async function enfileirarIntencaoComercial(
  tx: Prisma.TransactionClient,
  e: EnfileirarComercial,
): Promise<ResultadoEnfileirar> {
  const atendimento = await garantirAtendimento(tx, {
    numeroId: e.numeroId, contatoId: e.contatoId, finalidade: "COMERCIAL", leadId: e.leadId,
  });
  // Lookup por findFirst: a unicidade é um índice UNIQUE PARCIAL (na migration), não um
  // @@unique — então o client não expõe um `findUnique` composto. O índice parcial cobre
  // esta busca (política + lead + ocorrência + passo, todas presentes) e é o backstop de
  // idempotência no INSERT.
  const existente = await tx.intencaoMensagem.findFirst({
    where: {
      politicaComercialId: e.politicaComercialId,
      leadId: e.leadId,
      ocorrenciaComercial: e.ocorrenciaComercial,
      passoComercial: e.passoComercial,
    },
  });

  if (existente) {
    if (!podeReabrirIntencao(existente.status, existente.motivoFalha)) return "ja_existente";
    await tx.intencaoMensagem.update({
      where: { id: existente.id },
      data: {
        status: "PENDENTE",
        atendimentoId: atendimento.id,
        numeroId: e.numeroId,
        contatoId: e.contatoId,
        origem: "CRON",
        corpoRenderizado: e.corpoRenderizado,
        variaveis: e.variaveis,
        templateId: e.templateId,
        politicaComercialId: e.politicaComercialId,
        validaAte: e.validaAte,
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
      atendimentoId: atendimento.id,
      passoComercial: e.passoComercial,
      ocorrenciaComercial: e.ocorrenciaComercial,
      numeroId: e.numeroId,
      contatoId: e.contatoId,
      origem: "CRON",
      corpoRenderizado: e.corpoRenderizado,
      variaveis: e.variaveis,
      templateId: e.templateId,
      politicaComercialId: e.politicaComercialId,
      validaAte: e.validaAte,
      autorId: null,
    },
  });
  return "criada";
}
