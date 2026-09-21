import { isDeepStrictEqual } from "node:util";
import { Papel } from "@prisma/client";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { bloquearLancamento } from "./lancamento-tx";
import { conferirGestorAvaliacao } from "./regras-tx";
import { carregarConsolidadoAvaliacoesTx } from "./consolidado-tx";
import { prazoRecuperacaoVigente } from "./recuperacao-prazo";
import { disponibilidadeRecuperacaoTx } from "./disponibilidade-recuperacao-tx";

export async function conferirSubstituicaoRecuperacaoTx(tx: Prisma.TransactionClient, usuarioId: string, d: { itemReservaId: string; substitutoId: string }) {
      const ref = await tx.itemReservaTentativaRecuperacao.findUnique({ where: { id: d.itemReservaId }, select: { reserva: { select: { proposta: { select: { alocacaoId: true } } } } } });
      if (!ref) throw new ErroRegra("Tentativa não encontrada.");
      await bloquearLancamento(tx, ref.reserva.proposta.alocacaoId); await conferirGestorAvaliacao(tx, usuarioId);
      const i = await tx.itemReservaTentativaRecuperacao.findUniqueOrThrow({ where: { id: d.itemReservaId }, include: { realizacao: true, reserva: { include: { cancelamento: true, proposta: { include: { disponibilizacao: true, matricula: true, alocacao: { include: { turma: true } } } } } } } });
      const p = i.reserva.proposta, a = p.alocacao;
      const e = await tx.encontroAgenda.findFirst({ where: { finalidade: "RECUPERACAO", propostaAgendaRecuperacao: { itemReservaId: i.id, decisao: { aprovada: true } } }, include: { professor: { select: { nome: true } }, propostaAgendaRecuperacao: { select: { snapshot: true, decisao: { select: { autorizarDiaNaoLetivo: true } } } } } });
      if (!e || e.status !== "PREVISTO" || e.inicio <= new Date() || i.realizacao || i.reserva.cancelamento) throw new ErroRegra("Substituição da agenda exige encontro futuro previsto e tentativa pendente.");
      if (!a.ativa || p.matricula.status !== "ATIVA" || a.matriculaId !== p.matriculaId || a.turma.nivelId !== p.nivelId || a.turma.regraAvaliacaoId !== p.regraId) throw new ErroRegra("Confira o vínculo e a situação contratual antes de substituir.");
      if (!isDeepStrictEqual(p.snapshot, await carregarConsolidadoAvaliacoesTx(tx, usuarioId, a.id, "BASE_PLANO"))) throw new ErroRegra("As fontes do plano mudaram. Confira o plano antes de substituir.");
      const [fontes] = await tx.$queryRaw<{ estado: Prisma.JsonValue }[]>`SELECT estado_fontes_substituicao_recuperacao(${a.id}) AS estado`;
      if (!fontes) throw new ErroRegra("Não foi possível conferir as fontes da recuperação.");
      const prazo = p.disponibilizacao ? await prazoRecuperacaoVigente(tx, p.disponibilizacao.id) : null;
      if (!prazo || e.fim > prazo) throw new ErroRegra("Confira o prazo vigente da recuperação.");
      if (e.professorId === d.substitutoId) throw new ErroRegra("O professor selecionado já é o avaliador do encontro.");
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${d.substitutoId} FOR SHARE`;
      const professor = await tx.usuario.findUnique({ where: { id: d.substitutoId }, select: { nome: true, ativo: true, papeis: true } });
      if (!professor?.ativo || !professor.papeis.includes(Papel.PROFESSOR)) throw new ErroRegra("Selecione um professor ativo.");
      const recursos = await disponibilidadeRecuperacaoTx(tx, { alunoId: p.matricula.alunoId, professorId: d.substitutoId, inicio: e.inicio, fim: e.fim, ignorarEncontroId: e.id });
      const pendencias: string[] = [];
      if (recursos.encontros.length) pendencias.push("Há encontro conflitante do substituto ou do aluno.");
      if (recursos.indisponibilidades) pendencias.push("O substituto possui indisponibilidade aprovada no intervalo.");
      if (recursos.reservas) pendencias.push("Há reserva comercial conflitante com o substituto ou o aluno.");
      const calendario = await tx.versaoCalendarioEscolar.findFirst({ where: { decisao: { aprovada: true } }, orderBy: { versao: "desc" } });
      const config = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } });
      const origem = z.object({ calendarioId: z.string().nullable() }).parse(e.propostaAgendaRecuperacao!.snapshot);
      if (!calendario || calendario.id !== origem.calendarioId || calendario.fusoInstitucional !== config?.fusoInstitucional) pendencias.push("O calendário ou fuso institucional mudou desde a aprovação do encontro; exige nova revisão.");
      const designacao = await tx.designacaoRecuperacao.findFirst({ where: { itemReservaId: i.id }, orderBy: { versao: "desc" }, select: { versao: true } });
      return { itemReservaId: i.id, encontroId: e.id, matriculaId: p.matriculaId, planoId: p.id, planoHash: p.entradaHash, avaliadorAtualId: e.professorId, substitutoId: d.substitutoId,
        calendarioId: calendario?.id ?? null, prazoVigente: prazo.toISOString(), inicio: e.inicio.toISOString(), fim: e.fim.toISOString(), fusoOrigem: e.fusoOrigem,
        avaliadorAtual: e.professor?.nome ?? "Não identificado", substituto: professor.nome, versaoDesignacao: designacao?.versao ?? 0,
        excecaoDiaNaoLetivo: e.propostaAgendaRecuperacao!.decisao!.autorizarDiaNaoLetivo, fontesEstado: fontes.estado,
        conflitos: recursos.encontros.map(r => ({ inicio: r.inicio.toISOString(), fim: r.fim.toISOString(), envolveSubstituto: r.professorId === d.substitutoId })),
        indisponibilidades: recursos.indisponibilidades, reservas: recursos.reservas, pendencias, aplicada: false as const };
}
