"use server";
import { isDeepStrictEqual } from "node:util";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearLancamento } from "./lancamento-tx";
import { conferirGestorAvaliacao } from "./regras-tx";
import { conferirAgendaRecuperacaoTx } from "./recuperacao-agenda-tx";
import { baseAgendaRecuperacao, hashAgendaRecuperacao } from "./recuperacao-agenda-estado";

const schema = z.object({ propostaId: z.string().min(1).max(100), aprovar: z.boolean(), estadoConferido: z.string().regex(/^[a-f0-9]{64}$/),
  autorizarDiaNaoLetivo: z.boolean(), motivo: z.string().trim().min(5).max(2000) }).strict();
export async function decidirAgendaRecuperacao(input: z.input<typeof schema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = schema.parse(input);
    return prisma.$transaction(async tx => {
      const ref = await tx.propostaAgendaRecuperacao.findUnique({ where: { id: d.propostaId }, select: { itemReserva: { select: { reserva: { select: { proposta: { select: { alocacaoId: true } } } } } } } });
      if (!ref) throw new ErroRegra("Proposta não encontrada.");
      const a = await bloquearLancamento(tx, ref.itemReserva.reserva.proposta.alocacaoId);
      await conferirGestorAvaliacao(tx, u.id);
      const p = await tx.propostaAgendaRecuperacao.findUniqueOrThrow({ where: { id: d.propostaId }, include: { decisao: true, encontro: { select: { id: true } } } });
      if (p.autorId === u.id) throw new ErroRegra("Outra pessoa da gestão deve decidir a proposta.");
      if (d.estadoConferido !== hashAgendaRecuperacao(p.snapshot)) throw new ErroRegra("Atualize a conferência da proposta.");
      if (p.decisao) {
        if (p.decisao.decisorId !== u.id || p.decisao.aprovada !== d.aprovar || p.decisao.motivo !== d.motivo || p.decisao.autorizarDiaNaoLetivo !== d.autorizarDiaNaoLetivo) throw new ErroRegra("A proposta já foi decidida.");
        return { id: p.decisao.id, encontroId: p.encontro?.id ?? null };
      }
      if (!d.aprovar && d.autorizarDiaNaoLetivo) throw new ErroRegra("Rejeição não autoriza exceção de calendário.");
      if (d.aprovar) {
        const ultima = await tx.propostaAgendaRecuperacao.findFirstOrThrow({ where: { itemReservaId: p.itemReservaId }, orderBy: { versao: "desc" } });
        if (ultima.id !== p.id) throw new ErroRegra("Proposta superada; confira a versão mais recente.");
        if (await tx.propostaAgendaRecuperacao.count({ where: { itemReservaId: p.itemReservaId, decisao: { aprovada: true } } })) throw new ErroRegra("Tentativa já possui agenda aprovada.");
        const c = await conferirAgendaRecuperacaoTx(tx, u.id, { itemReservaId: p.itemReservaId, inicio: p.inicio, fim: p.fim, fuso: p.fusoOrigem });
        if (!isDeepStrictEqual(p.snapshot, baseAgendaRecuperacao(c))) throw new ErroRegra("A conferência mudou. Prepare nova versão antes de aprovar.");
        const temExcecao = c.diasNaoLetivos.length > 0;
        if (d.autorizarDiaNaoLetivo !== temExcecao) throw new ErroRegra("Confira a autorização explícita para dia não letivo.");
        if (c.pendencias.length !== (temExcecao ? 1 : 0) || !c.professor || !c.calendarioId) throw new ErroRegra("Resolva as pendências de disponibilidade e calendário antes de aprovar.");
      }
      // O trigger publica o encontro na mesma transação: falha na publicação desfaz a decisão.
      const decisao = await tx.decisaoAgendaRecuperacao.create({ data: { propostaId: p.id, decisorId: u.id, aprovada: d.aprovar, autorizarDiaNaoLetivo: d.autorizarDiaNaoLetivo, motivo: d.motivo } });
      const encontro = await tx.encontroAgenda.findUnique({ where: { propostaAgendaRecuperacaoId: p.id }, select: { id: true } });
      await registrarEvento(tx, { tipo: d.aprovar ? "AgendaRecuperacaoAprovada" : "AgendaRecuperacaoRejeitada", agregadoTipo: "Matricula", agregadoId: a.matriculaId, autorId: u.id,
        payload: { propostaId: p.id, decisaoId: decisao.id, encontroId: encontro?.id ?? null, autorizarDiaNaoLetivo: d.autorizarDiaNaoLetivo, motivo: d.motivo } });
      return { id: decisao.id, encontroId: encontro?.id ?? null };
    });
  });
}
