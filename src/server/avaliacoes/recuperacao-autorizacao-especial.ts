"use server";

import { createHash } from "node:crypto";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearLancamento } from "./lancamento-tx";
import { conferirGestorAvaliacao } from "./regras-tx";
import { AutorizarRecuperacaoEspecialSchema } from "./recuperacao-autorizacao-schema";

/** Registra a autorização pontual. Não realiza avaliação nem amplia oportunidades. */
export async function autorizarRealizacaoEspecialRecuperacao(input: z.input<typeof AutorizarRecuperacaoEspecialSchema>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = AutorizarRecuperacaoEspecialSchema.parse(input);
    const entradaHash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
    return prisma.$transaction(async tx => {
      const ref = await tx.itemReservaTentativaRecuperacao.findUnique({ where: { id: d.itemReservaId }, select: { reserva: { select: { proposta: { select: { alocacaoId: true } } } } } });
      if (!ref) throw new ErroRegra("Pendência de recuperação não encontrada.");
      const alocacao = await bloquearLancamento(tx, ref.reserva.proposta.alocacaoId);
      await conferirGestorAvaliacao(tx, usuario.id);
      const anterior = await tx.autorizacaoEspecialRecuperacao.findUnique({ where: { autorizadorId_chaveIdempotencia: { autorizadorId: usuario.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (anterior) {
        if (anterior.entradaHash !== entradaHash) throw new ErroRegra("Chave usada para outra autorização de recuperação.");
        return { id: anterior.id, prazoAte: anterior.prazoAte.toISOString() };
      }
      const item = await tx.itemReservaTentativaRecuperacao.findUniqueOrThrow({ where: { id: d.itemReservaId }, include: { realizacao: true, reserva: { include: { cancelamento: true, proposta: { include: { decisao: true, disponibilizacao: true, matricula: true } } } } } });
      const plano = item.reserva.proposta;
      if (item.realizacao || item.reserva.cancelamento || !plano.decisao?.aprovada || !plano.disponibilizacao) throw new ErroRegra("A autorização exige tentativa pendente de um plano aprovado e disponibilizado.");
      if (!["PAUSADA", "ENCERRADA"].includes(plano.matricula.status)) throw new ErroRegra("A autorização específica exige matrícula pausada ou encerrada.");
      if (alocacao.matriculaId !== plano.matriculaId) throw new ErroRegra("O vínculo da pendência diverge da matrícula.");
      const prazoAte = new Date(d.prazoAte);
      if (prazoAte <= new Date()) throw new ErroRegra("Informe prazo futuro para a autorização específica.");
      const snapshot = { matriculaId: plano.matriculaId, alocacaoId: plano.alocacaoId, regraId: plano.regraId,
        propostaId: plano.id, propostaHash: plano.entradaHash, decisaoId: plano.decisao.id,
        disponibilizacaoId: plano.disponibilizacao.id, reservaId: item.reservaId, itemReservaId: item.id,
        habilidade: item.habilidade, statusMatricula: plano.matricula.status };
      const autorizacao = await tx.autorizacaoEspecialRecuperacao.create({ data: {
        itemReservaId: item.id, autorizadorId: usuario.id, prazoAte, motivo: d.motivo,
        chaveIdempotencia: d.chaveIdempotencia, entradaHash, snapshot,
      } });
      await registrarEvento(tx, { tipo: "RecuperacaoAutorizacaoEspecial", agregadoTipo: "Matricula", agregadoId: plano.matriculaId,
        autorId: usuario.id, payload: { autorizacaoId: autorizacao.id, itemReservaId: item.id, prazoAte: prazoAte.toISOString() } });
      return { id: autorizacao.id, prazoAte: autorizacao.prazoAte.toISOString() };
    });
  });
}
