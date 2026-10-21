"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, type Resultado } from "@/server/_shared";
import { marcaIdempotencia, repeticaoIdempotente } from "@/server/_shared/idempotencia";
import {
  iniciarCancelamentoAssinaturaDesistenciaTx,
  registrarObservacaoCancelamentoDesistenciaTx,
} from "@/server/contratos/cancelamento-assinatura-tx";
import { cancelarEnvelopeSemPresumir, hashEvidenciaAssinatura } from "@/server/contratos/provedor-assinatura";
import { provedorAssinaturaAtivo } from "@/server/contratos/provedor-assinatura-ativo";

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

const executarSchema = iniciarSchema.extend({ chaveIdempotencia: z.string().trim().min(8).max(200).optional() }).strict();
type Execucao = { intencaoId: string; cancelamentoConfirmado: boolean; repetido: boolean };

/**
 * Cancelamento integrado (Q165): a intenção é confirmada no banco antes da chamada ao serviço de
 * assinatura e o resultado entra em outra transação. Só a confirmação do serviço encerra o processo
 * (CANCELADO); recusa, erro ou dúvida ficam como observação INCERTO, e a mesma ação, com nova chave,
 * concilia a intenção já registrada (nunca abre outra). Cancelar o envio não efetiva a desistência.
 */
export async function executarCancelamentoAssinaturaDesistencia(input: z.input<typeof executarSchema>): Promise<Resultado<Execucao>> {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const { chaveIdempotencia, ...dados } = executarSchema.parse(input);
    const provedor = provedorAssinaturaAtivo();
    if (!provedor) throw new ErroRegra("A integração de assinatura eletrônica não está configurada. Cancele o envio diretamente no serviço de assinatura e registre a conferência documental.");
    const marca = marcaIdempotencia(chaveIdempotencia, dados);
    const intencao = await prisma.$transaction(async (tx) => {
      if (marca) {
        const anterior = await repeticaoIdempotente(tx, { tipo: "ResultadoCancelamentoAssinaturaDesistenciaPreservado", agregadoTipo: "Matricula", autorId: sessao.id, marca,
          mensagemConflito: "Esta solicitação já foi usada com outros dados. Atualize a página antes de repetir." });
        if (anterior) return { repetido: true as const, ...(anterior.payload as { intencaoId: string; cancelamentoConfirmado: boolean }) };
      }
      const inicio = await iniciarCancelamentoAssinaturaDesistenciaTx(tx, sessao.id, dados);
      if (inicio.fornecedor !== provedor.fornecedor || inicio.ambiente !== provedor.ambiente) throw new ErroRegra("O processo pertence a outro serviço ou ambiente de assinatura. Cancele pela integração correspondente.");
      // Já confirmado: nada a pedir de novo ao serviço.
      if (!inicio.nova && await tx.observacaoCancelamentoAssinatura.count({ where: { intencaoId: inicio.id, resultado: "CONFIRMADO" } })) {
        return { repetido: true as const, intencaoId: inicio.id, cancelamentoConfirmado: true };
      }
      const sequencia = await tx.observacaoCancelamentoAssinatura.count({ where: { intencaoId: inicio.id } }) + 1;
      return { repetido: false as const, ...inicio, sequencia };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    if (intencao.repetido) return { intencaoId: intencao.intencaoId, cancelamentoConfirmado: intencao.cancelamentoConfirmado, repetido: true };
    const cancelado = await cancelarEnvelopeSemPresumir(provedor, intencao.referenciaExterna);
    const observacao = await prisma.$transaction((tx) => registrarObservacaoCancelamentoDesistenciaTx(tx, {
      intencaoId: intencao.id, processoId: dados.processoId, pedidoId: dados.pedidoId, chave: `cancelamento:${intencao.id}:${intencao.sequencia}`,
      resultado: cancelado.resultado === "CANCELADO" ? "CONFIRMADO" : "INCERTO", referenciaExterna: intencao.referenciaExterna,
      evidenciaHash: hashEvidenciaAssinatura({ resultado: cancelado.resultado, evidencia: cancelado.evidencia }),
      autorId: sessao.id, ...(marca ? { marca } : {}),
    }), { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    return { intencaoId: intencao.id, cancelamentoConfirmado: observacao.cancelamentoConfirmado, repetido: false };
  });
}
