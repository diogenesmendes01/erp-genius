import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { carregarContextoEncerramentoTx } from "./encerramento-contexto-tx";
import { conferirRecomposicaoCobertura } from "./recomposicao-cobertura";
import { EntradaRecomposicao } from "./recomposicao-schema";
export async function carregarRecomposicaoTx(tx: Prisma.TransactionClient, d: z.output<typeof EntradaRecomposicao>) {
      const contexto = await carregarContextoEncerramentoTx(tx, { alunoId: d.alunoId, matriculaId: d.matriculaId });
      const matricula = await tx.matricula.findUniqueOrThrow({ where: { id: d.matriculaId }, select: {
        id: true, leadId: true, status: true, moeda: true, contratoOk: true, contratoDocumentoId: true,
        confirmacaoContratoEm: true, confirmacaoContratoPorId: true, referenciaCobertura: true, dataReferenciaCobertura: true,
      } });
      const documento = matricula.contratoDocumentoId ? await tx.documento.findFirst({ where: {
        id: matricula.contratoDocumentoId,
        OR: [{ matriculaId: matricula.id }, ...(matricula.leadId ? [{ leadId: matricula.leadId }] : [])],
      }, select: { id: true, matriculaId: true, leadId: true, arquivado: true, categoria: true, url: true } }) : null;
      if (!matricula.contratoOk || !matricula.confirmacaoContratoEm || !matricula.confirmacaoContratoPorId || !documento || documento.arquivado || documento.categoria !== "CONTRATO") throw new ErroRegra("Confira o contrato vigente antes de recompor a cobertura.");
      if (!['ATIVA', 'PAUSADA'].includes(contexto.status)) throw new ErroRegra("Confira a situação do contrato antes de recompor cobertura.");
      const ids = new Set(d.direitosIds);
      const direitos = contexto.compensacoes.filter((c) => c.status === "APROVADA").flatMap((c) => c.dias.filter((dia) => ids.has(dia.id)).map((dia) => ({
        id: dia.id, matriculaId: contexto.matriculaId, compensacaoId: c.id, diaOrigem: dia.diaOrigem, estado: dia.estado, versao: dia.versao,
      })));
      if (ids.size !== d.direitosIds.length || direitos.length !== ids.size) throw new ErroRegra("Selecione direitos aprovados desta matrícula, sem repetição.");
      if (await tx.diaProgramadoRecomposicao.count({ where: { direitoId: { in: d.direitosIds } } })) throw new ErroRegra("Um direito já possui cobertura programada; confira a programação existente.");
      const mensais = contexto.cobrancas.filter((c) => c.tipo === "MENSALIDADE" && c.status !== "CANCELADA");
      if (mensais.some((c) => !c.coberturaInicio || !c.coberturaFim || c.conferencias.length)) throw new ErroRegra("Concilie as mensalidades e suas coberturas antes da proposta.");
      const proposta = conferirRecomposicaoCobertura({ matriculaId: d.matriculaId, retornoOferta: d.retornoOferta, inicioCompensacao: d.inicioCompensacao,
        motivo: d.motivo, evidenciaCondicoes: d.evidenciaCondicoes, periodosPropostos: d.periodosPropostos,
        moeda: contexto.moeda, direitos,
        periodosAtuais: mensais.map((c) => ({ cobrancaId: c.id, matriculaId: contexto.matriculaId, versao: c.versao,
          cobertura: { inicio: c.coberturaInicio!, fim: c.coberturaFim! }, valor: c.valorNegociado, moeda: c.moeda, vencimento: c.vencimento.slice(0, 10) })),
      });
      const programacoesExistentes = contexto.compensacoes.flatMap((c) => c.dias).flatMap((dia) => dia.programacao ? [dia.programacao] : []);
      const intervalosPropostos = [proposta.compensacao, ...proposta.periodos.map((p) => p.cobertura)];
      if (programacoesExistentes.some((programacao) => intervalosPropostos.some((p) => programacao.dataCobertura >= p.inicio && programacao.dataCobertura <= p.fim))) {
        throw new ErroRegra("A proposta ocupa um dia de compensação já programado. Revise as coberturas sem reutilizar esse dia.");
      }
      return { proposta, origem: { contrato: { ...matricula, confirmacaoContratoEm: matricula.confirmacaoContratoEm.toISOString(), dataReferenciaCobertura: matricula.dataReferenciaCobertura?.toISOString() ?? null, documento }, compensacoes: contexto.compensacoes, cobrancas: mensais }, efetivada: false as const };
}
