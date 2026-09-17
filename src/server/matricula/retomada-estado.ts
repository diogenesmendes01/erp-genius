import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { PAPEIS_PAUSA } from "./pausa-estado";
import { exigirUsuarioPausa } from "./pausa-integridade";
import { prepararCoberturasRetomada } from "./retomada-cobertura";
import { recebimentoPreservavel } from "./recebimento-preservavel";
import type { PreviaRetomadaMatriculasInput } from "./retomada-schema";
import { carregarFusoInstitucionalTx } from "@/server/operacao/relogio";

export async function carregarPreviaRetomadaTx(tx: Prisma.TransactionClient, alunoId: string, dados: PreviaRetomadaMatriculasInput, usuarioId: string) {
  const ids = dados.matriculas.map((m) => m.matriculaId).sort();
      if (await tx.matricula.count({ where: { id: { in: ids }, alunoId } }) !== ids.length) throw new ErroRegra("Seleção de matrículas inválida para este aluno.");
      await bloquearMatriculas(tx, ids);
      await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE "matriculaId" IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
      await exigirUsuarioPausa(tx, usuarioId, PAPEIS_PAUSA);
      const matriculas = await tx.matricula.findMany({ where: { id: { in: ids }, alunoId }, orderBy: { id: "asc" }, select: {
        id: true, codigo: true, status: true, referenciaCobertura: true, dataReferenciaCobertura: true,
        itensPropostaPausa: { where: { proposta: { status: "APLICADA" } }, select: { id: true, proposta: { select: { id: true, dataEfetiva: true, aplicadaEm: true } } } },
        cobrancas: { where: { tipo: "MENSALIDADE" }, orderBy: { id: "asc" }, select: {
          id: true, status: true, coberturaInicio: true, coberturaFim: true, vencimento: true, suspensaPorItemPausaId: true,
          valorRecebido: true, valorLiquidadoCredito: true, saldo: true, valorNegociado: true, destinacoesRecebimento: { select: { id: true } }, informes: { where: { status: "A_CONFERIR" }, select: { id: true } },
        } },
      } });
      if (matriculas.length !== ids.length) throw new ErroRegra("A titularidade mudou durante a conferência.");
      const fusoInstitucional = await carregarFusoInstitucionalTx(tx);
      return { alunoId, retorno: dados.retorno, fusoInstitucional, somentePrevia: true as const, matriculas: matriculas.map((m) => {
        const pendencias: string[] = [];
        if (!fusoInstitucional) pendencias.push("FUSO_INSTITUCIONAL_A_CONFERIR");
        const pausas = [...m.itensPropostaPausa].sort((a, b) => (b.proposta.aplicadaEm?.getTime() ?? 0) - (a.proposta.aplicadaEm?.getTime() ?? 0));
        const pausa = pausas[0];
        if (m.status !== "PAUSADA") pendencias.push("MATRICULA_NAO_PAUSADA");
        if (!pausa?.proposta.aplicadaEm) pendencias.push("PAUSA_CONTRATUAL_A_CONFERIR");
        if (pausa && dados.retorno < pausa.proposta.dataEfetiva.toISOString().slice(0, 10)) pendencias.push("RETORNO_ANTERIOR_A_PAUSA");
        if (!m.referenciaCobertura || (m.referenciaCobertura === "CICLO_MATRICULA" && !m.dataReferenciaCobertura)) pendencias.push("REFERENCIA_CONTRATUAL_A_CONFERIR");
        const suspensas = m.cobrancas.filter((c) => pausa && c.suspensaPorItemPausaId === pausa.id);
        const mantidas = m.cobrancas.filter((c) => c.status !== "CANCELADA" && c.suspensaPorItemPausaId !== pausa?.id);
        for (const c of [...suspensas, ...mantidas]) {
          if (!c.coberturaInicio || !c.coberturaFim) pendencias.push(`COBERTURA_A_CONFERIR:${c.id}`);
        }
        for (const c of suspensas) {
          const recebimentoConferido = ["PAGO", "CANCELADA"].includes(c.status) && recebimentoPreservavel(c);
          if (c.informes.length || (!recebimentoConferido && (c.status !== "CANCELADA" || c.valorRecebido?.greaterThan(0) || c.destinacoesRecebimento.length)))
            pendencias.push(`SUSPENSAO_A_CONFERIR:${c.id}`);
        }
        let periodos: ReturnType<typeof prepararCoberturasRetomada> = [];
        if (pendencias.length === 0) {
          try {
            periodos = prepararCoberturasRetomada({ retorno: dados.retorno,
              regra: m.referenciaCobertura === "MES_CIVIL" ? { referencia: "MES_CIVIL" } : { referencia: "CICLO_MATRICULA", dataReferencia: m.dataReferenciaCobertura!.toISOString().slice(0, 10) },
              suspensos: suspensas.map((c) => ({ cobrancaId: c.id, cobertura: { inicio: c.coberturaInicio!.toISOString().slice(0, 10), fim: c.coberturaFim!.toISOString().slice(0, 10) }, vencimento: c.vencimento.toISOString().slice(0, 10) })),
              mantidos: mantidas.map((c) => ({ inicio: c.coberturaInicio!.toISOString().slice(0, 10), fim: c.coberturaFim!.toISOString().slice(0, 10) })),
              vencimentos: dados.matriculas.find((i) => i.matriculaId === m.id)!.vencimentos,
            });
          } catch (erro) {
            pendencias.push(erro instanceof Error ? erro.message : "Cobertura exige conferência.");
          }
        }
        return { matriculaId: m.id, codigo: m.codigo, pausaId: pausa?.proposta.id ?? null, periodos, pendencias };
      }) };
}
