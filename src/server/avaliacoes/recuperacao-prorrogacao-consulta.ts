"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { carregarConsolidadoAvaliacoesTx } from "./consolidado-tx";
import { identificarMatriculaAvaliacao } from "./identificacao";
import { prazoRecuperacaoVigente } from "./recuperacao-prazo";

export async function consultarProrrogacoesRecuperacao(input: { propostaId: string; antesVersao?: number }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ propostaId: z.string().min(1).max(100), antesVersao: z.number().int().positive().optional() }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const ref = await tx.propostaPlanoRecuperacao.findUnique({ where: { id: d.propostaId }, select: { alocacaoId: true } });
      if (!ref) throw new ErroRegra("Plano não encontrado.");
      await carregarConsolidadoAvaliacoesTx(tx, u.id, ref.alocacaoId, "BASE_PLANO");
      const p = await tx.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: d.propostaId }, include: { disponibilizacao: true, matricula: true, alocacao: true } });
      if (!p.disponibilizacao) throw new ErroRegra("Registre a disponibilização antes de propor prorrogação.");
      const usuario = await tx.usuario.findUniqueOrThrow({ where: { id: u.id }, select: { papeis: true } });
      const gestao = usuario.papeis.some(p => p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR);
      const prazo = await prazoRecuperacaoVigente(tx, p.disponibilizacao.id);
      const ultima = await tx.propostaProrrogacaoRecuperacao.findFirst({ where: { disponibilizacaoId: p.disponibilizacao.id }, orderBy: { versao: "desc" }, select: { versao: true } });
      const ps = await tx.propostaProrrogacaoRecuperacao.findMany({ where: { disponibilizacaoId: p.disponibilizacao.id, ...(d.antesVersao ? { versao: { lt: d.antesVersao } } : {}) }, orderBy: { versao: "desc" }, take: 21,
        select: { id: true, versao: true, prazoAnterior: true, novoPrazo: true, motivo: true, entradaHash: true, preparadorId: true, preparador: { select: { nome: true } }, criadaEm: true, decisao: { select: { aprovada: true, motivo: true, criadaEm: true, decisor: { select: { nome: true } } } } } });
      const ativa = p.matricula.status === "ATIVA";
      return { propostaId: p.id, disponibilizacaoId: p.disponibilizacao.id, identificacao: await identificarMatriculaAvaliacao(tx, p.matriculaId, p.alocacao.turmaId),
        prazoOriginal: p.disponibilizacao.prazoAte.toISOString(), prazoVigente: prazo.toISOString(), podePropor: ativa, versaoEsperada: ultima?.versao ?? 0,
        proximaAntesVersao: ps.length > 20 ? ps[19].versao : null,
        propostas: ps.slice(0, 20).map(v => {
          const podeDecidir = gestao && v.preparadorId !== u.id && !v.decisao;
          return { id: v.id, versao: v.versao, prazoAnterior: v.prazoAnterior.toISOString(), novoPrazo: v.novoPrazo.toISOString(), motivo: v.motivo, preparador: v.preparador.nome, criadaEm: v.criadaEm.toISOString(),
            decisao: v.decisao ? { ...v.decisao, criadaEm: v.decisao.criadaEm.toISOString() } : null,
            podeDecidir, podeAprovar: podeDecidir && ativa && v.versao === ultima?.versao && v.prazoAnterior.getTime() === prazo.getTime() && v.novoPrazo > prazo && v.novoPrazo > new Date(), propostaHash: podeDecidir ? v.entradaHash : null };
        }) };
    });
  });
}
