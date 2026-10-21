"use server";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { HABILIDADES } from "./calculo";
import { carregarConsolidadoAvaliacoesTx } from "./consolidado-tx";

const schema = z.object({
  alocacaoId: z.string().min(1).max(100), versaoEsperada: z.number().int().min(0).max(2147483646),
  motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100),
  autorizacaoPreparacaoId: z.string().min(1).max(100).optional(),
  atividades: z.array(z.object({ habilidade: z.enum(HABILIDADES), estrategia: z.string().trim().min(5).max(2000), avaliacaoProposta: z.string().trim().min(5).max(2000) }).strict()).min(1).max(4),
}).strict().superRefine((d, ctx) => {
  if (new Set(d.atividades.map(a => a.habilidade)).size !== d.atividades.length) ctx.addIssue({ code: "custom", message: "Habilidade repetida no plano." });
});

/** Proposta preservada para revisão: não autoriza execução nem reserva oportunidades. */
export async function proporPlanoRecuperacao(input: z.input<typeof schema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    const original = schema.parse(input), d = { ...original, atividades: [...original.atividades].sort((a, b) => a.habilidade.localeCompare(b.habilidade)) };
    const entradaHash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
    return prisma.$transaction(async tx => {
      const snapshot = await carregarConsolidadoAvaliacoesTx(tx, u.id, d.alocacaoId, "BASE_PLANO");
      const repetida = await tx.propostaPlanoRecuperacao.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: u.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (repetida) {
        if (repetida.entradaHash !== entradaHash) throw new ErroRegra("Chave já utilizada com outro plano.");
        return { id: repetida.id, versao: repetida.versao };
      }
      const a = await tx.alocacaoTurma.findUniqueOrThrow({ where: { id: d.alocacaoId }, include: { matricula: true, turma: true } });
      if (!a.matricula) throw new ErroRegra("Confira o vínculo da matrícula.");
      if (d.autorizacaoPreparacaoId) {
        const autorizacao = await tx.autorizacaoEspecialPreparacaoRecuperacao.findUnique({ where: { id: d.autorizacaoPreparacaoId }, include: { autorizador: { select: { ativo: true, papeis: true } } } });
        const agora = new Date();
        const fonte = { matriculaId: a.matricula.id, alocacaoId: a.id, turmaId: a.turmaId, nivelId: a.turma.nivelId, regraId: a.turma.regraAvaliacaoId, statusMatricula: a.matricula.status };
        if (!autorizacao || autorizacao.alocacaoId !== a.id || autorizacao.criadaEm > agora || autorizacao.prazoAte <= agora ||
          !autorizacao.autorizador.ativo || !autorizacao.autorizador.papeis.some(p => p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR) ||
          !["PAUSADA", "ENCERRADA"].includes(a.matricula.status) || !isDeepStrictEqual(autorizacao.snapshot, fonte)) throw new ErroRegra("A autorização de preparação não permite este plano. Confira vínculo, prazo e fonte.");
      } else if (!a.ativa || a.matricula.status !== "ATIVA") throw new ErroRegra("Confira o vínculo ativo. Plano após pausa ou encerramento exige autorização específica.");
      if (snapshot.resultado.atendeRequisitosNotas === null) throw new ErroRegra("Há notas obrigatórias pendentes. Segunda chamada e recuperação de nota têm fluxos separados.");
      if (snapshot.resultado.atendeRequisitosNotas) throw new ErroRegra("As notas já atingem os requisitos. Não há insuficiência para este plano.");
      const obrigatorias = snapshot.resultado.habilidades.filter(h => h.atendeMinimo === false).map(h => h.habilidade);
      if (obrigatorias.some(h => !d.atividades.some(a => a.habilidade === h))) throw new ErroRegra("O plano precisa contemplar todas as habilidades abaixo do mínimo.");
      if (snapshot.resultado.atendeGeral && d.atividades.some(a => !obrigatorias.includes(a.habilidade))) throw new ErroRegra("Direcione a recuperação às habilidades abaixo do mínimo.");
      const ultima = await tx.propostaPlanoRecuperacao.findFirst({ where: { matriculaId: a.matricula.id, nivelId: a.turma.nivelId }, orderBy: { versao: "desc" }, select: { versao: true } });
      if ((ultima?.versao ?? 0) !== d.versaoEsperada) throw new ErroRegra("Existe proposta mais recente. Atualize o plano.");
      if (!a.turma.regraAvaliacaoId) throw new ErroRegra("Regra de avaliação não identificada.");
      const p = await tx.propostaPlanoRecuperacao.create({ data: { matriculaId: a.matricula.id, alocacaoId: a.id, nivelId: a.turma.nivelId, regraId: a.turma.regraAvaliacaoId,
        preparadorId: u.id, versao: d.versaoEsperada + 1, atividades: d.atividades, motivo: d.motivo, snapshot, chaveIdempotencia: d.chaveIdempotencia, entradaHash, autorizacaoPreparacaoId: d.autorizacaoPreparacaoId } });
      await registrarEvento(tx, { tipo: "PlanoRecuperacaoProposto", agregadoTipo: "Matricula", agregadoId: a.matricula.id, autorId: u.id,
        payload: { propostaId: p.id, nivelId: p.nivelId, regraId: p.regraId, versao: p.versao, habilidades: d.atividades.map(a => a.habilidade) } });
      return { id: p.id, versao: p.versao };
    });
  });
}
