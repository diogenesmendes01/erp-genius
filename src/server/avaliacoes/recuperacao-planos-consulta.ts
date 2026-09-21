"use server";
import { isDeepStrictEqual } from "node:util";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { carregarConsolidadoAvaliacoesTx } from "./consolidado-tx";
import { identificarMatriculaAvaliacao } from "./identificacao";
import { ConteudoRegraAvaliacaoSchema } from "./regra-schema";
import { HABILIDADES } from "./calculo";
import { quantidadeExtraRecuperacaoTx } from "./extra-recuperacao-tx";
import { preparacaoRecuperacaoVigenteTx } from "./recuperacao-preparacao-vigencia-tx";

const fracao = z.object({ numerador: z.string(), denominador: z.string() }).nullable();
const resumo = z.object({ resultado: z.object({ geral: fracao, minimoGeral: z.string(), habilidades: z.array(z.object({ habilidade: z.enum(HABILIDADES), minimo: z.string(), resultado: fracao })) }) });
const atividades = z.array(z.object({ habilidade: z.enum(HABILIDADES), estrategia: z.string(), avaliacaoProposta: z.string() }));

export async function consultarPlanosRecuperacao(input: { alocacaoId: string; antesVersao?: number }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ alocacaoId: z.string().min(1).max(100), antesVersao: z.number().int().positive().optional() }).strict().parse(input);
    return prisma.$transaction(async tx => {
      // Autoriza o consolidado antes de projetar cadastro ou planos deste vínculo.
      const atual = await carregarConsolidadoAvaliacoesTx(tx, u.id, d.alocacaoId, "BASE_PLANO");
      const a = await tx.alocacaoTurma.findUniqueOrThrow({ where: { id: d.alocacaoId }, include: { matricula: true, turma: { include: { regraAvaliacao: true } } } });
      const usuario = await tx.usuario.findUniqueOrThrow({ where: { id: u.id }, select: { papeis: true } });
      const gestao = usuario.papeis.some(p => p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR);
      const regra = ConteudoRegraAvaliacaoSchema.parse(a.turma.regraAvaliacao!.conteudo);
      const limitesAutorizados = new Map(await Promise.all(regra.habilidades.map(async h => [h.habilidade, h.limiteRecuperacoes + await quantidadeExtraRecuperacaoTx(tx, a.matriculaId!, a.turma.nivelId, h.habilidade)] as const)));
      const ultima = await tx.propostaPlanoRecuperacao.findFirst({ where: { matriculaId: a.matriculaId!, nivelId: a.turma.nivelId }, orderBy: { versao: "desc" }, select: { versao: true } });
      const ps = await tx.propostaPlanoRecuperacao.findMany({ where: { alocacaoId: a.id, ...(d.antesVersao ? { versao: { lt: d.antesVersao } } : {}) }, orderBy: { versao: "desc" }, take: 21,
        select: { id: true, versao: true, regraId: true, motivo: true, atividades: true, snapshot: true, entradaHash: true, preparadorId: true, autorizacaoPreparacaoId: true, preparador: { select: { nome: true } }, criadaEm: true,
          decisao: { select: { aprovada: true, motivo: true, decisor: { select: { nome: true } } } } } });
      const vinculoValido = a.ativa && a.matricula?.status === "ATIVA";
      const situacaoEspecial = !!a.matricula && ["PAUSADA", "ENCERRADA"].includes(a.matricula.status);
      const agora = new Date();
      const autorizacao = situacaoEspecial ? await tx.autorizacaoEspecialPreparacaoRecuperacao.findFirst({
        where: { alocacaoId: a.id, criadaEm: { lte: agora }, prazoAte: { gt: agora },
          autorizador: { ativo: true, papeis: { hasSome: [Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR] } },
          snapshot: { equals: { matriculaId: a.matriculaId, alocacaoId: a.id, turmaId: a.turmaId, nivelId: a.turma.nivelId, regraId: a.turma.regraAvaliacaoId, statusMatricula: a.matricula!.status } } },
        orderBy: [{ criadaEm: "desc" }, { id: "desc" }], select: { id: true, prazoAte: true },
      }) : null;
      const propostasAutorizadas = new Set<string>();
      for (const proposta of ps.slice(0, 20)) {
        if (proposta.autorizacaoPreparacaoId && await preparacaoRecuperacaoVigenteTx(tx, proposta.id)) propostasAutorizadas.add(proposta.id);
      }
      const podePreparar = vinculoValido || !!autorizacao;
      return { identificacao: await identificarMatriculaAvaliacao(tx, a.matriculaId!, a.turmaId), atual: resumo.parse(atual).resultado,
        podeAutorizarPreparacao: gestao && situacaoEspecial && atual.resultado.atendeRequisitosNotas === false,
        podeConsultarHistoricoPreparacao: gestao,
        autorizacaoPreparacao: autorizacao ? { id: autorizacao.id, prazoAte: autorizacao.prazoAte.toISOString() } : null,
        podePropor: podePreparar && atual.resultado.atendeRequisitosNotas === false,
        impedimentoProposta: !podePreparar ? "O vínculo exige conferência; após pausa/encerramento, a gestão precisa autorizar a preparação." : atual.resultado.atendeRequisitosNotas === null ? "Há notas obrigatórias pendentes; segunda chamada é um fluxo separado." : atual.resultado.atendeRequisitosNotas ? "As notas já atingem os requisitos." : null,
        obrigatorias: atual.resultado.habilidades.filter(h => h.atendeMinimo === false).map(h => h.habilidade),
        selecionaveis: atual.resultado.habilidades.filter(h => !atual.resultado.atendeGeral || h.atendeMinimo === false).map(h => h.habilidade),
        versaoEsperada: ultima?.versao ?? 0, proximaAntesVersao: ps.length > 20 ? ps[19].versao : null,
        planos: ps.slice(0, 20).map(p => {
          const ats = atividades.parse(p.atividades), fontesMudaram = !isDeepStrictEqual(p.snapshot, atual);
          const podeDecidir = gestao && p.preparadorId !== u.id && !p.decisao;
          const podeAprovar = podeDecidir && (p.autorizacaoPreparacaoId ? propostasAutorizadas.has(p.id) : vinculoValido) && p.versao === ultima?.versao && p.regraId === a.turma.regraAvaliacaoId && !fontesMudaram && atual.resultado.atendeRequisitosNotas === false && ats.every(a => (limitesAutorizados.get(a.habilidade) ?? 0) > 0);
          return { id: p.id, versao: p.versao, motivo: p.motivo, atividades: ats, base: resumo.parse(p.snapshot).resultado, preparador: p.preparador.nome, criadaEm: p.criadaEm.toISOString(), decisao: p.decisao,
            fontesMudaram, podeDecidir, podeAprovar, propostaHash: podeDecidir ? p.entradaHash : null };
        }) };
    });
  });
}
