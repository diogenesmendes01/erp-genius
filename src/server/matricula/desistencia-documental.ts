"use server";

import { EstadoEnvioAssinatura, Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, type Resultado } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";

const entradaSchema = z.object({ matriculaId: z.string().trim().min(1).max(100) }).strict();

type CancelamentoSubstituicaoDocumental =
  | { situacao: "NAO_INICIADO" }
  | { situacao: "PENDENTE_SEM_RESULTADO" }
  | { situacao: "RESULTADO_INCERTO" }
  | { situacao: "RESULTADO_CONFIRMADO" };

export type ConsultaDocumentosDesistenciaPreparacao = {
  matricula: { id: string; codigo: string | null };
  pedido: { id: string; versao: number } | null;
  documentos: Array<{ id: string; categoria: string; nome: string }>;
  processos: Array<{
    id: string;
    estado: EstadoEnvioAssinatura;
    fornecedor: string;
    ambiente: string;
    referenciaExternaPresente: boolean;
    conclusaoRegistrada: boolean;
    cancelamentoSubstituicao: CancelamentoSubstituicaoDocumental;
  }>;
  pendencias: string[];
  possuiPendenciaDocumental: boolean;
};

async function exigirAutorAtualTx(tx: Prisma.TransactionClient, usuarioId: string) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuarioId} FOR SHARE`;
  const usuario = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { ativo: true, papeis: true } });
  if (!usuario?.ativo || !usuario.papeis.some(papel => papel === Papel.SECRETARIA_ACADEMICA || papel === Papel.ADMINISTRADOR)) throw new ErroPermissao();
}

function resumirCancelamento(observacoes: Array<{ resultado: string }>): CancelamentoSubstituicaoDocumental {
  if (!observacoes.length) return { situacao: "PENDENTE_SEM_RESULTADO" };
  if (observacoes.some(observacao => observacao.resultado === "CONFIRMADO")) return { situacao: "RESULTADO_CONFIRMADO" };
  return { situacao: "RESULTADO_INCERTO" };
}

function descricaoEstado(estado: EstadoEnvioAssinatura) {
  return ({ PREPARADO: "preparado", ENVIANDO: "em envio", ENVIO_INCERTO: "com envio incerto", ENVIADO: "enviado", CANCELADO: "cancelado" } as const)[estado];
}

/** Consulta operacional somente leitura para conferir documentos e processos
 * contratuais antes de qualquer fluxo futuro de desistência. Resultado de
 * substituição é evidência operacional, nunca autorização do pedido de desistência. */
export async function consultarDocumentosDesistenciaPreparacao(input: { matriculaId: string }): Promise<Resultado<ConsultaDocumentosDesistenciaPreparacao>> {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
    const dados = entradaSchema.parse(input);
    return prisma.$transaction(async tx => {
      // Ordem comum para a visão consistente: calendário, matrícula e usuário.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await bloquearMatriculas(tx, [dados.matriculaId]);
      await exigirAutorAtualTx(tx, sessao.id);

      const matricula = await tx.matricula.findUnique({ where: { id: dados.matriculaId }, select: { id: true, codigo: true } });
      if (!matricula) throw new ErroRegra("Matrícula não encontrada.");

      const [pedido, documentos, processos] = await Promise.all([
        tx.pedidoDesistenciaPreparacao.findFirst({ where: { matriculaId: matricula.id }, orderBy: [{ versao: "desc" }, { id: "desc" }], select: { id: true, versao: true } }),
        tx.documento.findMany({ where: { matriculaId: matricula.id }, orderBy: [{ criadoEm: "asc" }, { id: "asc" }], select: { id: true, categoria: true, nome: true } }),
        tx.processoAssinaturaContratual.findMany({ where: { matriculaId: matricula.id }, orderBy: [{ criadoEm: "asc" }, { id: "asc" }], select: {
          id: true, estado: true, fornecedor: true, ambiente: true, referenciaExterna: true,
          conclusao: { select: { id: true } },
          intencaoCancelamento: { select: { observacoes: { orderBy: [{ registradaEm: "asc" }, { id: "asc" }], select: { resultado: true } } } },
        } }),
      ]);

      const processosResumo = processos.map(processo => ({
        id: processo.id,
        estado: processo.estado,
        fornecedor: processo.fornecedor,
        ambiente: processo.ambiente,
        referenciaExternaPresente: !!processo.referenciaExterna,
        conclusaoRegistrada: !!processo.conclusao,
        cancelamentoSubstituicao: processo.intencaoCancelamento
          ? resumirCancelamento(processo.intencaoCancelamento.observacoes)
          : { situacao: "NAO_INICIADO" } as const,
      }));

      const pendencias = [
        ...(!pedido ? ["Não há pedido de desistência registrado para esta matrícula."] : []),
        ...(processos.length ? [] : documentos.map(documento => `Documento “${documento.nome}” exige conferência documental antes de qualquer desistência.`)),
        ...processos.flatMap((processo, indice) => [
          `Processo de assinatura ${indice + 1}, ${descricaoEstado(processo.estado)}, exige conferência documental antes de qualquer desistência.`,
          ...(processo.estado === "PREPARADO" ? [`O processo de assinatura ${indice + 1} ainda está preparado e não possui confirmação externa para a conferência documental.`] : []),
          ...(processo.estado === "ENVIO_INCERTO" ? [`O processo de assinatura ${indice + 1} tem envio incerto e exige conciliação documental.`] : []),
          ...(processo.conclusao ? [`O processo de assinatura ${indice + 1} possui conclusão registrada e exige conferência documental específica.`] : []),
          ...(processo.intencaoCancelamento ? ["A fonte de substituição contratual permanece distinta: nenhuma observação de cancelamento autoriza o pedido de desistência."] : []),
        ]),
      ];
      return { matricula, pedido, documentos, processos: processosResumo, pendencias, possuiPendenciaDocumental: pendencias.length > 0 };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  });
}
