"use server";
import { isDeepStrictEqual } from "node:util";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { conferirGestorAvaliacao } from "./regras-tx";
import { carregarConsolidadoAvaliacoesTx } from "./consolidado-tx";
import { identificarMatriculaAvaliacao } from "./identificacao";
import { prazoRecuperacaoVigente } from "./recuperacao-prazo";
import { HABILIDADES } from "./calculo";
import { ConteudoRegraAvaliacaoSchema } from "./regra-schema";
import { quantidadeExtraRecuperacaoTx } from "./extra-recuperacao-tx";

export async function consultarAutorizacoesReservaRecuperacao(input: { propostaId: string; depoisId?: string }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ propostaId: z.string().min(1).max(100), depoisId: z.string().min(1).max(100).optional() }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await conferirGestorAvaliacao(tx, u.id);
      const ref = await tx.propostaPlanoRecuperacao.findUnique({ where: { id: d.propostaId }, select: { alocacaoId: true } });
      if (!ref) throw new ErroRegra("Plano não encontrado.");
      const atual = await carregarConsolidadoAvaliacoesTx(tx, u.id, ref.alocacaoId, "BASE_PLANO");
      const p = await tx.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: d.propostaId }, include: { decisao: true, disponibilizacao: true, matricula: true, regra: true, alocacao: { include: { turma: true } } } });
      const habilidades = z.array(z.object({ habilidade: z.enum(HABILIDADES) })).parse(p.atividades).map(a => a.habilidade);
      const podeAutorizar = !!p.decisao?.aprovada && !!p.disponibilizacao && ["PAUSADA", "ENCERRADA"].includes(p.matricula.status) &&
        p.alocacao.matriculaId === p.matriculaId && p.alocacao.turma.nivelId === p.nivelId && p.alocacao.turma.regraAvaliacaoId === p.regraId && isDeepStrictEqual(p.snapshot, atual);
      const agora = new Date();
      const prazoGeral = p.disponibilizacao ? await prazoRecuperacaoVigente(tx, p.disponibilizacao.id) : null;
      const regra = ConteudoRegraAvaliacaoSchema.parse(p.regra.conteudo);
      const saldos = new Map<string, number>();
      for (const habilidade of habilidades) {
        const ocupadas = await tx.itemReservaTentativaRecuperacao.count({ where: { habilidade, reserva: { proposta: { matriculaId: p.matriculaId, nivelId: p.nivelId } }, OR: [{ reserva: { cancelamento: null } }, { realizacao: { isNot: null } }] } });
        const limite = regra.habilidades.find(h => h.habilidade === habilidade)!.limiteRecuperacoes + await quantidadeExtraRecuperacaoTx(tx, p.matriculaId, p.nivelId, habilidade);
        saldos.set(habilidade, Math.max(0, limite - ocupadas));
      }
      const registros = await tx.autorizacaoEspecialReservaRecuperacao.findMany({ where: { propostaId: p.id, ...(d.depoisId ? { id: { gt: d.depoisId } } : {}) }, orderBy: { id: "asc" }, take: 21,
        include: { autorizador: { select: { nome: true, ativo: true, papeis: true } }, reserva: { select: { id: true } } } });
      return { propostaId: p.id, propostaHash: p.entradaHash, statusMatricula: p.matricula.status, podeAutorizar, habilidades,
        identificacao: await identificarMatriculaAvaliacao(tx, p.matriculaId, p.alocacao.turmaId), proximoId: registros.length > 20 ? registros[19].id : null,
        historico: registros.slice(0, 20).map(a => {
          const fonte = { matriculaId: p.matriculaId, alocacaoId: p.alocacaoId, regraId: p.regraId, propostaId: p.id, propostaHash: p.entradaHash,
            decisaoId: p.decisao?.id, disponibilizacaoId: p.disponibilizacao?.id, habilidade: a.habilidade, statusMatricula: p.matricula.status };
          return { id: a.id, habilidade: a.habilidade, motivo: a.motivo, prazoAte: a.prazoAte.toISOString(), criadaEm: a.criadaEm.toISOString(),
            autorizador: { nome: a.autorizador.nome }, reserva: a.reserva,
            podeReservar: podeAutorizar && !a.reserva && a.criadaEm <= agora && a.prazoAte > agora && !!prazoGeral && prazoGeral > agora && !!p.disponibilizacao && p.disponibilizacao.disponibilizadaEm <= agora &&
              a.autorizador.ativo && a.autorizador.papeis.some(papel => papel === Papel.GERENTE_PEDAGOGICO || papel === Papel.ADMINISTRADOR) &&
              (saldos.get(a.habilidade) ?? 0) > 0 && isDeepStrictEqual(a.snapshot, fonte) };
        }) };
    });
  });
}
