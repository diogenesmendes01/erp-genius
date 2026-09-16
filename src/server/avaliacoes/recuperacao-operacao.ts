"use server";
import { isDeepStrictEqual } from "node:util";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { carregarConsolidadoAvaliacoesTx } from "./consolidado-tx";
import { identificarMatriculaAvaliacao } from "./identificacao";
import { ConteudoRegraAvaliacaoSchema } from "./regra-schema";
import { prazoRecuperacaoVigente } from "./recuperacao-prazo";
import { HABILIDADES } from "./calculo";
import { docenteAtual } from "@/server/diario/permissoes";
import { quantidadeExtraRecuperacaoTx } from "./extra-recuperacao-tx";
import { agendasRecuperacaoAutorizadasTx } from "./recuperacao-agenda-consulta-tx";
import { carregarAutorizacaoEspecialRecuperacaoTx } from "./recuperacao-autorizacao-tx";
import { carregarSituacoesNaAula } from "@/server/diario/historico-contratual";
import { preparacaoRecuperacaoVigenteTx } from "./recuperacao-preparacao-vigencia-tx";

export async function consultarOperacaoRecuperacao(input: { propostaId: string; depoisId?: string }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ propostaId: z.string().min(1).max(100), depoisId: z.string().min(1).max(100).optional() }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const ref = await tx.propostaPlanoRecuperacao.findUnique({ where: { id: d.propostaId }, select: { alocacaoId: true } });
      if (!ref) throw new ErroRegra("Plano não encontrado.");
      const atual = await carregarConsolidadoAvaliacoesTx(tx, u.id, ref.alocacaoId, "BASE_PLANO");
      const p = await tx.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: d.propostaId }, include: { decisao: true, regra: true, disponibilizacao: true, matricula: true, alocacao: { include: { turma: { include: { vinculosDocentes: true } } } } } });
      if (!p.decisao?.aprovada) throw new ErroRegra("O plano precisa de aprovação antes desta etapa.");
      const usuario = await tx.usuario.findUniqueOrThrow({ where: { id: u.id }, select: { papeis: true } });
      const gestao = usuario.papeis.some(p => p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR);
      const docente = usuario.papeis.includes(Papel.PROFESSOR) && docenteAtual(u.id, p.alocacao.turma);
      const regra = ConteudoRegraAvaliacaoSchema.parse(p.regra.conteudo), ats = z.array(z.object({ habilidade: z.enum(HABILIDADES) })).parse(p.atividades);
      const saldo = await Promise.all(ats.map(async h => {
        const filtro = { habilidade: h.habilidade, reserva: { proposta: { matriculaId: p.matriculaId, nivelId: p.nivelId } } };
        const [consumidas, reservadas] = await Promise.all([
          tx.itemReservaTentativaRecuperacao.count({ where: { ...filtro, realizacao: { isNot: null } } }),
          tx.itemReservaTentativaRecuperacao.count({ where: { ...filtro, reserva: { ...filtro.reserva, cancelamento: null }, realizacao: null } }),
        ]);
        const limiteBase = regra.habilidades.find(a => a.habilidade === h.habilidade)!.limiteRecuperacoes;
        const extrasAprovadas = await quantidadeExtraRecuperacaoTx(tx, p.matriculaId, p.nivelId, h.habilidade);
        const limite = limiteBase + extrasAprovadas;
        return { habilidade: h.habilidade, limite, limiteBase, extrasAprovadas, consumidas, reservadas, disponiveis: Math.max(0, limite - consumidas - reservadas) };
      }));
      const prazoAte = p.disponibilizacao ? await prazoRecuperacaoVigente(tx, p.disponibilizacao.id) : null;
      const fontesMudaram = !isDeepStrictEqual(p.snapshot, atual);
      const vinculoValido = p.alocacao.ativa && p.matricula.status === "ATIVA" && p.alocacao.turma.regraAvaliacaoId === p.regraId && p.alocacao.turma.nivelId === p.nivelId && p.alocacao.matriculaId === p.matriculaId;
      const agoraPreparacao = new Date();
      const candidataDisponibilizacao = p.autorizacaoPreparacaoId
        ? await tx.autorizacaoEspecialPreparacaoRecuperacao.findUnique({ where: { id: p.autorizacaoPreparacaoId }, select: { id: true, prazoAte: true } })
        : !vinculoValido && !p.disponibilizacao ? await tx.autorizacaoEspecialPreparacaoRecuperacao.findFirst({
          where: { alocacaoId: p.alocacaoId, criadaEm: { lte: agoraPreparacao }, prazoAte: { gt: agoraPreparacao },
            autorizador: { ativo: true, papeis: { hasSome: [Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR] } },
            snapshot: { equals: { matriculaId: p.matriculaId, alocacaoId: p.alocacaoId, turmaId: p.alocacao.turmaId, nivelId: p.nivelId, regraId: p.regraId, statusMatricula: p.matricula.status } } },
          orderBy: [{ criadaEm: "desc" }, { id: "desc" }], select: { id: true, prazoAte: true },
        }) : null;
      const preparacaoEspecialVigente = !!candidataDisponibilizacao && await preparacaoRecuperacaoVigenteTx(tx, p.id, agoraPreparacao, candidataDisponibilizacao.id);
      const agendas = await tx.propostaAgendaRecuperacao.findMany({ where: { itemReserva: { reserva: { propostaId: p.id } }, encontro: { status: "PREVISTO" } }, select: { itemReserva: { select: { reservaId: true } } } });
      const reservasAgendadas = new Set(agendas.map(a => a.itemReserva.reservaId));
      const reservas = await tx.reservaTentativaRecuperacao.findMany({ where: { propostaId: p.id, ...(d.depoisId ? { id: { gt: d.depoisId } } : {}) }, orderBy: { id: "asc" }, take: 21,
        select: { id: true, motivo: true, criadaEm: true, cancelamento: { select: { motivo: true, evidencia: true } }, itens: { select: { id: true, habilidade: true, realizacao: { select: { id: true, realizadaEm: true } } } } } });
      const agendasDaPagina = await agendasRecuperacaoAutorizadasTx(tx, reservas.slice(0,20).flatMap(r => r.itens.map(i => i.id)), u.id);
      const consultadaEm = new Date();
      const situacaoContratual = (await carregarSituacoesNaAula(tx, [p.matriculaId], consultadaEm)).get(p.matriculaId) ?? "A_CONFERIR";
      const autorizacoes = new Map<string, string>();
      if (situacaoContratual === "PAUSADA" || situacaoContratual === "ENCERRADA") {
        for (const reserva of reservas.slice(0, 20)) {
          if (reserva.cancelamento) continue;
          for (const item of reserva.itens) {
            if (item.realizacao) continue;
            const autorizacao = await carregarAutorizacaoEspecialRecuperacaoTx(tx, item.id, consultadaEm);
            if (autorizacao) autorizacoes.set(item.id, autorizacao.prazoAte.toISOString());
          }
        }
      }
      return { propostaId: p.id, versao: p.versao, aprovadaEm: p.decisao.criadaEm.toISOString(), alocacaoId: p.alocacaoId, propostaHash: gestao ? p.entradaHash : null,
        situacaoContratual, consultadaEm: consultadaEm.toISOString(),
        identificacao: await identificarMatriculaAvaliacao(tx, p.matriculaId, p.alocacao.turmaId), fontesMudaram, vinculoValido, saldo,
        prazoMinutos: regra.recuperacao.prazoRealizacaoMinutos, podeGerirDesignacoes: gestao,
        autorizacaoDisponibilizacao: gestao && preparacaoEspecialVigente && candidataDisponibilizacao ? { id: candidataDisponibilizacao.id, prazoAte: candidataDisponibilizacao.prazoAte.toISOString() } : null,
        podeDisponibilizar: gestao && (p.autorizacaoPreparacaoId ? preparacaoEspecialVigente : vinculoValido || preparacaoEspecialVigente) && !fontesMudaram && !p.disponibilizacao,
        podeReservar: gestao && vinculoValido && !fontesMudaram && prazoAte !== null && prazoAte > new Date(),
        disponibilizacao: p.disponibilizacao ? { inicio: p.disponibilizacao.disponibilizadaEm.toISOString(), prazoOriginal: p.disponibilizacao.prazoAte.toISOString(), prazoVigente: prazoAte!.toISOString(), condicoes: p.disponibilizacao.condicoes, evidenciaComunicacao: p.disponibilizacao.evidenciaComunicacao } : null,
        proximoId: reservas.length > 20 ? reservas[19].id : null,
        reservas: reservas.slice(0, 20).map(r => ({ ...r, criadaEm: r.criadaEm.toISOString(), podeCancelarPelaEscola: gestao && !r.cancelamento && !reservasAgendadas.has(r.id) && r.itens.some(i => !i.realizacao),
          itens: r.itens.map(i => { const agenda = agendasDaPagina.get(i.id) ?? null; return { ...i, agenda, autorizacaoEspecialAte: autorizacoes.get(i.id) ?? null, realizacao: i.realizacao ? { ...i.realizacao, realizadaEm: i.realizacao.realizadaEm.toISOString() } : null,
            podeRegistrarRealizacao: docente && !r.cancelamento && !i.realizacao && (!agenda || (agenda.status === "PREVISTO" && agenda.mesmoAvaliador && Date.parse(agenda.inicio) <= Date.now())) }; }) })) };
    });
  });
}
