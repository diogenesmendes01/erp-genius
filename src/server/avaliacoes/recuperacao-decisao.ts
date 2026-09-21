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
import { HABILIDADES } from "./calculo";
import { quantidadeExtraRecuperacaoTx } from "./extra-recuperacao-tx";
import { preparacaoRecuperacaoVigenteTx } from "./recuperacao-preparacao-vigencia-tx";

const schema = z.object({ propostaId: z.string().min(1).max(100), propostaHash: z.string().regex(/^[a-f0-9]{64}$/), aprovada: z.boolean(), motivo: z.string().trim().min(5).max(2000) }).strict();

/** Aprovação pedagógica do plano; liberação de tentativas depende de reserva própria. */
export async function decidirPlanoRecuperacao(input: z.input<typeof schema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = schema.parse(input);
    return prisma.$transaction(async tx => {
      const ref = await tx.propostaPlanoRecuperacao.findUnique({ where: { id: d.propostaId }, select: { alocacaoId: true } });
      if (!ref) throw new ErroRegra("Proposta de recuperação não encontrada.");
      await bloquearLancamento(tx, ref.alocacaoId); await conferirGestorAvaliacao(tx, u.id);
      const p = await tx.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: d.propostaId }, include: { decisao: true, regra: true, alocacao: { include: { turma: true } }, matricula: true } });
      if (p.preparadorId === u.id) throw new ErroRegra("Outra pessoa da Gestão Pedagógica/Administração precisa decidir.");
      if (p.entradaHash !== d.propostaHash) throw new ErroRegra("Confira a versão exata do plano.");
      if (p.decisao) {
        if (p.decisao.decisorId === u.id && p.decisao.aprovada === d.aprovada && p.decisao.motivo === d.motivo) return { id: p.decisao.id };
        throw new ErroRegra("A proposta já possui decisão.");
      }
      if (d.aprovada) {
        const especial = await preparacaoRecuperacaoVigenteTx(tx, p.id);
        if ((p.autorizacaoPreparacaoId ? !especial : (!p.alocacao.ativa || p.matricula.status !== "ATIVA")) || p.alocacao.matriculaId !== p.matriculaId || p.alocacao.turma.nivelId !== p.nivelId || p.alocacao.turma.regraAvaliacaoId !== p.regraId) throw new ErroRegra("O vínculo ou a situação da matrícula exige nova conferência.");
        if (await tx.propostaPlanoRecuperacao.count({ where: { matriculaId: p.matriculaId, nivelId: p.nivelId, versao: { gt: p.versao } } })) throw new ErroRegra("Existe uma proposta mais recente.");
        const atual = await carregarConsolidadoAvaliacoesTx(tx, u.id, p.alocacaoId, "BASE_PLANO");
        if (!isDeepStrictEqual(p.snapshot, atual)) throw new ErroRegra("As notas ou suas fontes mudaram. Prepare uma nova proposta para revisão.");
        if (atual.resultado.atendeRequisitosNotas !== false) throw new ErroRegra("Confira a insuficiência de notas antes de aprovar.");
        const regra = ConteudoRegraAvaliacaoSchema.parse(p.regra.conteudo);
        const atividades = z.array(z.object({ habilidade: z.enum(HABILIDADES) })).min(1).max(4).parse(p.atividades);
        for (const atividade of atividades) {
          const base = regra.habilidades.find(h => h.habilidade === atividade.habilidade)?.limiteRecuperacoes ?? 0;
          if (base + await quantidadeExtraRecuperacaoTx(tx, p.matriculaId, p.nivelId, atividade.habilidade) <= 0) throw new ErroRegra("A regra não prevê tentativas para uma habilidade do plano. Uma oportunidade extra exige autorização específica.");
        }
      }
      const decisao = await tx.decisaoPlanoRecuperacao.create({ data: { propostaId: p.id, decisorId: u.id, aprovada: d.aprovada, motivo: d.motivo } });
      await registrarEvento(tx, { tipo: d.aprovada ? "PlanoRecuperacaoAprovado" : "PlanoRecuperacaoRejeitado", agregadoTipo: "Matricula", agregadoId: p.matriculaId, autorId: u.id,
        payload: { propostaId: p.id, decisaoId: decisao.id, versao: p.versao, motivo: d.motivo } });
      return { id: decisao.id };
    });
  });
}
