"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearLancamento } from "./lancamento-tx";
import { conferirGestorAvaliacao } from "./regras-tx";

const schema = z.object({ reservaId: z.string().min(1).max(100), motivo: z.string().trim().min(5).max(2000), evidencia: z.string().trim().min(5).max(4000) }).strict();

/** Cancela a tentativa reservada por iniciativa da escola; não é cancelamento do aluno. */
export async function cancelarReservaRecuperacaoPelaEscola(input: z.input<typeof schema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = schema.parse(input);
    return prisma.$transaction(async tx => {
      const ref = await tx.reservaTentativaRecuperacao.findUnique({ where: { id: d.reservaId }, select: { proposta: { select: { alocacaoId: true } } } });
      if (!ref) throw new ErroRegra("Reserva não encontrada.");
      await bloquearLancamento(tx, ref.proposta.alocacaoId); await conferirGestorAvaliacao(tx, u.id);
      const r = await tx.reservaTentativaRecuperacao.findUniqueOrThrow({ where: { id: d.reservaId }, include: { cancelamento: true, itens: { include: { realizacao: true } }, proposta: true } });
      if (r.cancelamento) {
        if (r.cancelamento.autorId === u.id && r.cancelamento.motivo === d.motivo && r.cancelamento.evidencia === d.evidencia) return { id: r.cancelamento.id };
        throw new ErroRegra("A reserva já possui cancelamento registrado.");
      }
      const pendentes = r.itens.filter(i => !i.realizacao);
      if (await tx.propostaAgendaRecuperacao.count({ where: { itemReservaId: { in: pendentes.map(i => i.id) }, encontro: { status: "PREVISTO" } } })) throw new ErroRegra("Tentativa agendada exige revisão específica da agenda aprovada antes do cancelamento.");
      if (!pendentes.length) throw new ErroRegra("Não há habilidades pendentes para liberar; realizações permanecem consumidas.");
      const c = await tx.cancelamentoReservaRecuperacao.create({ data: { reservaId: r.id, autorId: u.id, motivo: d.motivo, evidencia: d.evidencia } });
      await registrarEvento(tx, { tipo: "TentativaRecuperacaoCanceladaPelaEscola", agregadoTipo: "Matricula", agregadoId: r.proposta.matriculaId, autorId: u.id,
        payload: { cancelamentoId: c.id, reservaId: r.id, propostaId: r.propostaId, habilidades: pendentes.map(i => i.habilidade), motivo: d.motivo } });
      return { id: c.id };
    });
  });
}
