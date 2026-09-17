import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { RegrasEncerramentoSchema } from "./condicoes-encerramento-schema";

/** Consulta interna; o chamador autentica e delimita a transação. */
export async function carregarContextoEncerramentoTx(tx: Prisma.TransactionClient, d: { alunoId: string; matriculaId: string }) {
      const m = await tx.matricula.findFirst({ where: { id: d.matriculaId, alunoId: d.alunoId }, select: {
        id: true, alunoId: true, moeda: true, status: true, contratoOk: true, contratoDocumentoId: true,
        confirmacaoContratoEm: true, confirmacaoContratoPorId: true, leadId: true,
        condicoesEncerramento: { orderBy: { versao: "desc" } },
        compensacoesCobertura: { orderBy: { id: "asc" }, include: { dias: { orderBy: { diaOrigem: "asc" }, include: { programacao: true } } } },
        cobrancas: { orderBy: [{ vencimento: "asc" }, { id: "asc" }], include: {
          emissaoFechamentoHoras: { select: { id: true, decisaoId: true, memoria: true, itens: { orderBy: { id: "asc" }, select: { id: true, conferenciaId: true, valor: true } } } },
          utilizacoesCreditoPropostas: { where: { decisao: { aprovada: true } }, orderBy: { id: "asc" }, select: { id: true, creditoId: true, valor: true, decisao: { select: { id: true } }, credito: { select: { moeda: true, matriculaId: true } } } },
          destinacoesRecebimento: { orderBy: { id: "asc" }, select: { id: true, valor: true, recebimento: { select: { id: true, moeda: true, dataPagamento: true } } } },
          informes: { where: { status: "A_CONFERIR" }, select: { id: true } },
          aplicacoesPeriodoIntegral: {
            orderBy: { aplicadaEm: "asc" },
            select: {
              id: true,
              decisaoId: true,
              aplicadaEm: true,
              credito: { select: { id: true, valorInicial: true, moeda: true } },
              decisao: { select: { proposta: { select: { escolha: true } } } },
            },
          },
        } },
        ajustes: { orderBy: [{ criadoEm: "asc" }, { id: "asc" }] },
      } });
      if (!m) throw new ErroRegra("Matrícula não encontrada para este aluno.");
      const pendencias: string[] = [];
      if (!["ATIVA", "PAUSADA"].includes(m.status)) pendencias.push("A matrícula não está ativa ou pausada; conferir o fluxo aplicável.");
      const doc = m.contratoDocumentoId ? await tx.documento.findFirst({ where: {
        id: m.contratoDocumentoId, categoria: "CONTRATO", arquivado: false,
        OR: [{ matriculaId: m.id }, ...(m.leadId ? [{ leadId: m.leadId }] : [])],
      }, select: { id: true } }) : null;
      if (!m.contratoOk || !m.confirmacaoContratoEm || !m.confirmacaoContratoPorId || !doc) pendencias.push("Contrato confirmado e disponível é necessário.");
      const emRevisao = m.condicoesEncerramento.some((v) => v.status === "PENDENTE");
      if (emRevisao) pendencias.push("Há uma revisão das condições contratuais aguardando decisão.");
      const versao = m.condicoesEncerramento.find((v) => v.status === "APROVADA" && v.documentoId === doc?.id);
      const regras = RegrasEncerramentoSchema.safeParse(versao?.regras);
      if (!versao || !regras.success) pendencias.push("Condições de encerramento aprovadas do contrato vigente estão ausentes ou incompletas.");
      const regularizacoesPeriodoIntegral = m.cobrancas.flatMap((c) =>
        c.aplicacoesPeriodoIntegral
          .filter((aplicacao) => aplicacao.decisao.proposta.escolha === "CREDITO")
          .map((aplicacao) => ({
            aplicacaoId: aplicacao.id,
            decisaoId: aplicacao.decisaoId,
            cobrancaId: c.id,
            escolha: "CREDITO" as const,
            aplicadaEm: aplicacao.aplicadaEm.toISOString(),
            credito: aplicacao.credito
              ? {
                  id: aplicacao.credito.id,
                  valor: aplicacao.credito.valorInicial.toFixed(2),
                  moeda: aplicacao.credito.moeda,
                }
              : null,
          })),
      );
      const cobrancas = m.cobrancas
        .filter(
          (c) =>
            !c.aplicacoesPeriodoIntegral.some(
              (aplicacao) => aplicacao.decisao.proposta.escolha === "CREDITO",
            ),
        )
        .map((c) => {
        const conferencias: string[] = [];
        if (c.moeda !== m.moeda) conferencias.push("Moeda diferente do contrato.");
        if (c.tipo === "MENSALIDADE" && (!c.coberturaInicio || !c.coberturaFim || c.coberturaFim < c.coberturaInicio)) conferencias.push("Cobertura ausente ou inválida.");
        if (c.informes.length) conferencias.push("Comprovante aguardando confirmação financeira.");
        if (c.status === "CANCELADA" || c.suspensaPorItemPausaId || c.canceladaPorPausaId) conferencias.push("Conferir cancelamento/suspensão e cobertura antes de incluir no acerto.");
        if (c.valorOriginal.lt(c.valorNegociado)) conferencias.push("Valor negociado superior à referência; conferir base de cálculo.");
        const recebido = c.valorRecebido ?? new Prisma.Decimal(0);
        const somaRecebimentos = c.destinacoesRecebimento.reduce((total, d) => total.plus(d.valor), new Prisma.Decimal(0));
        if (!somaRecebimentos.equals(recebido) || c.destinacoesRecebimento.some((d) => d.recebimento.moeda !== c.moeda || d.valor.lt(0))) conferencias.push("Destinações detalhadas divergem do total da cobrança; concilie antes do acerto.");
        const credito = c.utilizacoesCreditoPropostas.reduce((total, u) => total.plus(u.valor), new Prisma.Decimal(0));
        if (!credito.equals(c.valorLiquidadoCredito) || c.utilizacoesCreditoPropostas.some(u => u.valor.lte(0) || u.credito.moeda !== c.moeda || u.credito.matriculaId !== m.id)) conferencias.push("Utilizações de crédito exigem conciliação.");
        const liquidado = recebido.plus(credito);
        if (recebido.lt(0) || (c.status === "PAGO" && liquidado.lt(c.valorNegociado)) || (c.saldo !== null && !c.saldo.equals(Prisma.Decimal.max(0, c.valorNegociado.minus(liquidado))))) conferencias.push("Recebimento ou saldo exige conciliação.");
        return { id: c.id, versao: c.versao, tipo: c.tipo, status: c.status, moeda: c.moeda,
          vencimento: c.vencimento.toISOString(), saldo: c.saldo?.toFixed(2) ?? null,
          coberturaInicio: c.coberturaInicio?.toISOString().slice(0, 10) ?? null, coberturaFim: c.coberturaFim?.toISOString().slice(0, 10) ?? null,
          valorOriginal: c.valorOriginal.toFixed(2), valorNegociado: c.valorNegociado.toFixed(2), valorRecebido: c.valorRecebido?.toFixed(2) ?? null,
          ...(c.emissaoFechamentoHoras ? { origemFaturamentoHoras: { emissaoId: c.emissaoFechamentoHoras.id, decisaoId: c.emissaoFechamentoHoras.decisaoId,
            memoria: c.emissaoFechamentoHoras.memoria, itens: c.emissaoFechamentoHoras.itens.map(i => ({ id: i.id, conferenciaId: i.conferenciaId, valor: i.valor.toFixed(2) })) } } : {}),
          ...(credito.gt(0) ? { valorLiquidadoCredito: credito.toFixed(2), utilizacoesCredito: c.utilizacoesCreditoPropostas.map(u => ({ propostaId: u.id, creditoId: u.creditoId, decisaoId: u.decisao!.id, valor: u.valor.toFixed(2) })) } : {}),
          recebimentos: c.destinacoesRecebimento.map((d) => ({ id: d.id, recebimentoId: d.recebimento.id, valor: d.valor.toFixed(2), moeda: d.recebimento.moeda, dataPagamento: d.recebimento.dataPagamento.toISOString() })),
          conferencias,
        };
      });
      return {
        matriculaId: m.id, alunoId: m.alunoId, moeda: m.moeda, status: m.status, pendencias,
        condicoes: versao && regras.success && !emRevisao && doc && m.contratoOk && m.confirmacaoContratoEm && m.confirmacaoContratoPorId
          ? { id: versao.id, versao: versao.versao, documentoId: versao.documentoId, regras: regras.data } : null,
        cobrancas,
        regularizacoesPeriodoIntegral,
        compensacoes: m.compensacoesCobertura.map((c) => ({
          id: c.id, status: c.status, cobrancaOrigemId: c.cobrancaOrigemId, documentoOrigemId: c.documentoOrigemId,
          coberturaOriginalInicio: c.coberturaOriginalInicio.toISOString().slice(0, 10), coberturaOriginalFim: c.coberturaOriginalFim.toISOString().slice(0, 10),
          valorCoberturaOriginal: c.valorCoberturaOriginal.toFixed(2), moeda: c.moeda, motivo: c.motivo, evidenciaCondicoes: c.evidenciaCondicoes,
          diasPropostos: c.diasPropostos, preparadorId: c.preparadorId, decisorId: c.decisorId, motivoDecisao: c.motivoDecisao, decididaEm: c.decididaEm?.toISOString() ?? null,
          dias: c.dias.map((dia) => ({ id: dia.id, diaOrigem: dia.diaOrigem.toISOString().slice(0, 10), estado: dia.estado, versao: dia.versao, destinacaoReferencia: dia.destinacaoReferencia, destinadoEm: dia.destinadoEm?.toISOString() ?? null,
            ...(dia.programacao ? { programacao: { id: dia.programacao.id, aplicacaoId: dia.programacao.aplicacaoId, dataCobertura: dia.programacao.dataCobertura.toISOString().slice(0, 10) } } : {}),
          })),
        })),
        ajustes: m.ajustes.map((a) => ({ id: a.id, cobrancaId: a.cobrancaId, tipo: a.tipo, valorDe: a.valorDe.toFixed(2), valorPara: a.valorPara.toFixed(2), motivo: a.motivo, moeda: a.moeda })),
      };
}

