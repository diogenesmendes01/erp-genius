import type { OrigemEnvio, Prisma } from "@prisma/client";
import type { PassoRegua } from "@/server/cobrancas/regua";
import { ErroRegra } from "@/server/_shared/sessao";
import { garantirAtendimento } from "./atendimentos";
import { podeReabrirIntencao, snapshotCobranca, referenciaDestinoCobranca } from "./elegibilidade";

export interface EnfileirarCobranca {
  cobrancaId: string;
  referenciaCalendario: { versao: number; vencimento: string; cicloRegua: number };
  referenciaDestino: string;
  passo: PassoRegua;
  numeroId: string;
  contatoId: string;
  origem: OrigemEnvio;
  corpoRenderizado: string;
  variaveis: string[];
  templateId: string | null;
  politicaId: string | null;
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
    if (!podeReabrirIntencao(existente.status, existente.motivoFalha)) return "ja_existente";
    const reaberta = await tx.intencaoMensagem.updateMany({
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
        criadaEm: new Date(),
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
