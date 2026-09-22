"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, type Resultado } from "@/server/_shared";
import {
  iniciarCancelamentoAssinaturaDesistenciaTx,
  registrarObservacaoCancelamentoDesistenciaTx,
} from "@/server/contratos/cancelamento-assinatura-tx";
import { cancelarEnvelopeSemPresumir, hashEvidenciaAssinatura, provedorAssinaturaAtivo } from "@/server/contratos/provedor-assinatura";

const iniciarSchema = z.object({
  pedidoId: z.string().trim().min(1).max(100),
  processoId: z.string().trim().min(1).max(100),
  estadoHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

type Inicio = { id: string; nova: boolean; referenciaExterna: string; fornecedor: string; ambiente: string };

/** Registra a intenção Q121 de cancelar um envio já aberto. Esta ação não
 * chama nem aceita uma resposta do fornecedor. O resultado pertence ao
 * adaptador autenticado/conciliador server-side. */
export async function iniciarCancelamentoAssinaturaDesistencia(input: z.input<typeof iniciarSchema>): Promise<Resultado<Inicio>> {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const dados = iniciarSchema.parse(input);
    return prisma.$transaction(
      (tx) => iniciarCancelamentoAssinaturaDesistenciaTx(tx, sessao.id, dados),
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  });
}

type Execucao = { intencaoId: string; cancelamentoConfirmado: boolean };

/**
 * Cancelamento integrado (Q165): a intenção é confirmada no banco antes da chamada ao
 * fornecedor e o resultado entra em outra transação. Só a confirmação do fornecedor
 * encerra o processo; recusa, erro ou dúvida ficam como observação incerta, e a mesma
 * ação pode ser repetida para conciliar a intenção já registrada.
 */
export async function executarCancelamentoAssinaturaDesistencia(input: z.input<typeof iniciarSchema>): Promise<Resultado<Execucao>> {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const dados = iniciarSchema.parse(input), provedor = provedorAssinaturaAtivo();
    if (!provedor) throw new ErroRegra("A integração de assinatura eletrônica não está configurada. Cancele o envio diretamente no serviço e registre a conferência documental.");
    const intencao = await prisma.$transaction(async (tx) => {
      const inicio = await iniciarCancelamentoAssinaturaDesistenciaTx(tx, sessao.id, dados);
      if (inicio.fornecedor !== provedor.fornecedor || inicio.ambiente !== provedor.ambiente) throw new ErroRegra("O processo pertence a outro fornecedor ou ambiente. Cancele pela integração correspondente.");
      const sequencia = await tx.observacaoCancelamentoAssinatura.count({ where: { intencaoId: inicio.id } }) + 1;
      return { ...inicio, sequencia };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    const cancelado = await cancelarEnvelopeSemPresumir(provedor, intencao.referenciaExterna);
    const observacao = await prisma.$transaction((tx) => registrarObservacaoCancelamentoDesistenciaTx(tx, {
      intencaoId: intencao.id, processoId: dados.processoId, pedidoId: dados.pedidoId, chave: `cancelamento:${intencao.id}:${intencao.sequencia}`,
      resultado: cancelado.resultado === "CANCELADO" ? "CONFIRMADO" : "INCERTO", referenciaExterna: intencao.referenciaExterna,
      evidenciaHash: hashEvidenciaAssinatura({ resultado: cancelado.resultado, evidencia: cancelado.evidencia }),
    }), { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    return { intencaoId: intencao.id, cancelamentoConfirmado: observacao.cancelamentoConfirmado };
  });
}
