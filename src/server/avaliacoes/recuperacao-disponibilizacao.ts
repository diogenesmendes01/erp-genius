"use server";
import { isDeepStrictEqual } from "node:util";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearLancamento } from "./lancamento-tx";
import { conferirGestorAvaliacao } from "./regras-tx";
import { carregarConsolidadoAvaliacoesTx } from "./consolidado-tx";
import { ConteudoRegraAvaliacaoSchema } from "./regra-schema";
import { preparacaoRecuperacaoVigenteTx } from "./recuperacao-preparacao-vigencia-tx";

const schema = z.object({ propostaId: z.string().min(1).max(100), propostaHash: z.string().regex(/^[a-f0-9]{64}$/), disponibilizadaEm: z.string().datetime({ offset: true }),
  autorizacaoPreparacaoId: z.string().min(1).max(100).optional(),
  condicoes: z.string().trim().min(5).max(4000), evidenciaComunicacao: z.string().trim().min(5).max(4000) }).strict();

export async function registrarDisponibilizacaoRecuperacao(input: z.input<typeof schema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = schema.parse(input);
    return prisma.$transaction(async tx => {
      const ref = await tx.propostaPlanoRecuperacao.findUnique({ where: { id: d.propostaId }, select: { alocacaoId: true } });
      if (!ref) throw new ErroRegra("Plano não encontrado.");
      await bloquearLancamento(tx, ref.alocacaoId); await conferirGestorAvaliacao(tx, u.id);
      const p = await tx.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: d.propostaId }, include: { disponibilizacao: true, decisao: true, regra: true, matricula: true, alocacao: { include: { turma: true } } } });
      if (p.entradaHash !== d.propostaHash || !p.decisao?.aprovada) throw new ErroRegra("Confira o plano aprovado e sua versão.");
      const inicio = new Date(d.disponibilizadaEm);
      if (d.autorizacaoPreparacaoId && p.autorizacaoPreparacaoId && d.autorizacaoPreparacaoId !== p.autorizacaoPreparacaoId) throw new ErroRegra("A autorização informada diverge da preparação do plano.");
      const autorizacaoPreparacaoId = d.autorizacaoPreparacaoId ?? p.autorizacaoPreparacaoId;
      if (p.disponibilizacao) {
        const v = p.disponibilizacao;
        if (v.autorId === u.id && v.disponibilizadaEm.getTime() === inicio.getTime() && v.condicoes === d.condicoes && v.evidenciaComunicacao === d.evidenciaComunicacao && (v.autorizacaoPreparacaoId ?? p.autorizacaoPreparacaoId) === autorizacaoPreparacaoId) return { id: v.id, prazoAte: v.prazoAte.toISOString() };
        throw new ErroRegra("A disponibilização já foi registrada. Prorrogação exige fluxo próprio.");
      }
      if (inicio < p.decisao.criadaEm || inicio > new Date()) throw new ErroRegra("A disponibilização deve ocorrer após a aprovação e não pode ser futura.");
      const especial = await preparacaoRecuperacaoVigenteTx(tx, p.id, inicio, autorizacaoPreparacaoId ?? undefined);
      if ((autorizacaoPreparacaoId ? !especial : (!p.alocacao.ativa || p.matricula.status !== "ATIVA")) || p.alocacao.matriculaId !== p.matriculaId || p.alocacao.turma.nivelId !== p.nivelId || p.alocacao.turma.regraAvaliacaoId !== p.regraId) throw new ErroRegra("Confira o vínculo e a autorização aplicável à matrícula.");
      const atual = await carregarConsolidadoAvaliacoesTx(tx, u.id, p.alocacaoId, "BASE_PLANO");
      if (!isDeepStrictEqual(p.snapshot, atual)) throw new ErroRegra("As notas mudaram. Prepare nova conferência do plano.");
      const prazoMinutos = ConteudoRegraAvaliacaoSchema.parse(p.regra.conteudo).recuperacao.prazoRealizacaoMinutos;
      const prazoAte = new Date(inicio.getTime() + prazoMinutos * 60000);
      const v = await tx.disponibilizacaoPlanoRecuperacao.create({ data: { propostaId: p.id, autorId: u.id, disponibilizadaEm: inicio, prazoMinutos, prazoAte, condicoes: d.condicoes, evidenciaComunicacao: d.evidenciaComunicacao, autorizacaoPreparacaoId } });
      await registrarEvento(tx, { tipo: "PlanoRecuperacaoDisponibilizado", agregadoTipo: "Matricula", agregadoId: p.matriculaId, autorId: u.id,
        payload: { disponibilizacaoId: v.id, propostaId: p.id, disponibilizadaEm: inicio.toISOString(), prazoAte: prazoAte.toISOString(), prazoMinutos } });
      return { id: v.id, prazoAte: prazoAte.toISOString() };
    });
  });
}
