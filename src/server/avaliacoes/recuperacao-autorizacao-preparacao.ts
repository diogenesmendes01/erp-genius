"use server";
import { createHash } from "node:crypto";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearLancamento } from "./lancamento-tx";
import { conferirGestorAvaliacao } from "./regras-tx";
import { carregarConsolidadoAvaliacoesTx } from "./consolidado-tx";
import { AutorizarPreparacaoRecuperacaoSchema } from "./recuperacao-autorizacao-preparacao-schema";

/** Liberação da preparação de uma pendência acadêmica. Não aprova nem executa seu plano. */
export async function autorizarPreparacaoEspecialRecuperacao(input: z.input<typeof AutorizarPreparacaoRecuperacaoSchema>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = AutorizarPreparacaoRecuperacaoSchema.parse(input);
    const entradaHash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
    return prisma.$transaction(async tx => {
      const alocacao = await bloquearLancamento(tx, d.alocacaoId);
      await conferirGestorAvaliacao(tx, usuario.id);
      const repetida = await tx.autorizacaoEspecialPreparacaoRecuperacao.findUnique({ where: { autorizadorId_chaveIdempotencia: { autorizadorId: usuario.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (repetida) {
        if (repetida.entradaHash !== entradaHash) throw new ErroRegra("Chave usada com outra autorização de preparação.");
        return { id: repetida.id, prazoAte: repetida.prazoAte.toISOString() };
      }
      const matricula = await tx.matricula.findUniqueOrThrow({ where: { id: alocacao.matriculaId }, select: { status: true } });
      if (!["PAUSADA", "ENCERRADA"].includes(matricula.status)) throw new ErroRegra("A autorização específica exige matrícula pausada ou encerrada.");
      const consolidado = await carregarConsolidadoAvaliacoesTx(tx, usuario.id, alocacao.id, "BASE_PLANO");
      if (consolidado.resultado.atendeRequisitosNotas !== false) throw new ErroRegra("A preparação exige insuficiência de notas comprovada. Notas ausentes seguem segunda chamada.");
      const turma = await tx.turma.findUniqueOrThrow({ where: { id: alocacao.turmaId }, select: { nivelId: true, regraAvaliacaoId: true } });
      if (!turma.regraAvaliacaoId) throw new ErroRegra("Confira a regra de avaliação do vínculo.");
      const prazoAte = new Date(d.prazoAte);
      if (prazoAte <= new Date()) throw new ErroRegra("Informe prazo futuro para preparar a pendência.");
      const autorizacao = await tx.autorizacaoEspecialPreparacaoRecuperacao.create({ data: {
        alocacaoId: alocacao.id, autorizadorId: usuario.id, motivo: d.motivo, prazoAte, chaveIdempotencia: d.chaveIdempotencia, entradaHash,
        snapshot: { matriculaId: alocacao.matriculaId, alocacaoId: alocacao.id, turmaId: alocacao.turmaId,
          nivelId: turma.nivelId, regraId: turma.regraAvaliacaoId, statusMatricula: matricula.status },
      } });
      await registrarEvento(tx, { tipo: "RecuperacaoPreparacaoAutorizada", agregadoTipo: "Matricula", agregadoId: alocacao.matriculaId, autorId: usuario.id,
        payload: { autorizacaoId: autorizacao.id, alocacaoId: alocacao.id, prazoAte: autorizacao.prazoAte.toISOString() } });
      return { id: autorizacao.id, prazoAte: autorizacao.prazoAte.toISOString() };
    });
  });
}
