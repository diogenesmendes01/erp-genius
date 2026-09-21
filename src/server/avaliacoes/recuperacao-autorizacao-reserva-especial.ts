"use server";

import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearLancamento } from "./lancamento-tx";
import { conferirGestorAvaliacao } from "./regras-tx";
import { carregarConsolidadoAvaliacoesTx } from "./consolidado-tx";
import { AutorizarReservaEspecialRecuperacaoSchema } from "./recuperacao-autorizacao-reserva-schema";

/** Autoriza uma reserva delimitada. Não cria oportunidade extra nem realiza avaliação. */
export async function autorizarReservaEspecialRecuperacao(input: z.input<typeof AutorizarReservaEspecialRecuperacaoSchema>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = AutorizarReservaEspecialRecuperacaoSchema.parse(input);
    const entradaHash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
    return prisma.$transaction(async tx => {
      const ref = await tx.propostaPlanoRecuperacao.findUnique({ where: { id: d.propostaId }, select: { alocacaoId: true } });
      if (!ref) throw new ErroRegra("Plano de recuperação não encontrado.");
      const alocacao = await bloquearLancamento(tx, ref.alocacaoId);
      await conferirGestorAvaliacao(tx, usuario.id);
      const anterior = await tx.autorizacaoEspecialReservaRecuperacao.findUnique({ where: { autorizadorId_chaveIdempotencia: { autorizadorId: usuario.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (anterior) {
        if (anterior.entradaHash !== entradaHash) throw new ErroRegra("Chave usada para outra autorização de reserva.");
        return { id: anterior.id, prazoAte: anterior.prazoAte.toISOString() };
      }
      const plano = await tx.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: d.propostaId }, include: { decisao: true, disponibilizacao: true, matricula: true, alocacao: { include: { turma: true } } } });
      if (!plano.decisao?.aprovada || !plano.disponibilizacao) throw new ErroRegra("Confira a aprovação e disponibilização do plano.");
      if (!["PAUSADA", "ENCERRADA"].includes(plano.matricula.status)) throw new ErroRegra("A autorização específica exige matrícula pausada ou encerrada.");
      if (alocacao.matriculaId !== plano.matriculaId) throw new ErroRegra("O vínculo diverge da matrícula.");
      if (plano.alocacao.turma.nivelId !== plano.nivelId || plano.alocacao.turma.regraAvaliacaoId !== plano.regraId) throw new ErroRegra("O nível ou a regra da turma mudou. Confira o plano antes de autorizar.");
      const atividades = z.array(z.object({ habilidade: z.string() })).parse(plano.atividades);
      if (!atividades.some(a => a.habilidade === d.habilidade)) throw new ErroRegra("Habilidade não incluída no plano aprovado.");
      const atual = await carregarConsolidadoAvaliacoesTx(tx, usuario.id, plano.alocacaoId, "BASE_PLANO");
      if (!isDeepStrictEqual(plano.snapshot, atual)) throw new ErroRegra("As fontes mudaram desde a aprovação. Confira o plano antes de autorizar.");
      const prazoAte = new Date(d.prazoAte);
      if (prazoAte <= new Date()) throw new ErroRegra("Informe prazo futuro para a autorização.");
      const snapshot = { matriculaId: plano.matriculaId, alocacaoId: plano.alocacaoId, regraId: plano.regraId,
        propostaId: plano.id, propostaHash: plano.entradaHash, decisaoId: plano.decisao.id,
        disponibilizacaoId: plano.disponibilizacao.id, habilidade: d.habilidade, statusMatricula: plano.matricula.status };
      const autorizacao = await tx.autorizacaoEspecialReservaRecuperacao.create({ data: {
        propostaId: plano.id, habilidade: d.habilidade, autorizadorId: usuario.id, prazoAte, motivo: d.motivo,
        chaveIdempotencia: d.chaveIdempotencia, entradaHash, snapshot,
      } });
      await registrarEvento(tx, { tipo: "RecuperacaoReservaAutorizacaoEspecial", agregadoTipo: "Matricula", agregadoId: plano.matriculaId,
        autorId: usuario.id, payload: { autorizacaoId: autorizacao.id, propostaId: plano.id, habilidade: d.habilidade, prazoAte: prazoAte.toISOString() } });
      return { id: autorizacao.id, prazoAte: autorizacao.prazoAte.toISOString() };
    });
  });
}
