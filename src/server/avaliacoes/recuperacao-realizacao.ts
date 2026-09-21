"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { bloquearLancamento } from "./lancamento-tx";
import { prazoRecuperacaoVigente } from "./recuperacao-prazo";
import { docenteAtual, vinculoCobre } from "@/server/diario/permissoes";
import { alocacaoCobreAula } from "@/server/diario/alocacoes";
import { carregarSituacoesNaAula } from "@/server/diario/historico-contratual";
import { designadoRecuperacao } from "./recuperacao-designacao-acesso";
import { carregarAutorizacaoEspecialRecuperacaoTx } from "./recuperacao-autorizacao-tx";

const schema = z.object({ itemReservaId: z.string().min(1).max(100), realizadaEm: z.string().datetime({ offset: true }), evidencia: z.string().trim().min(5).max(4000), realizadaPorId: z.string().min(1).max(100).optional(), motivoRegularizacao: z.string().trim().min(5).max(2000).optional() }).strict();

/** Realização consome a habilidade reservada; nota e conferência são registros distintos. */
export async function registrarRealizacaoRecuperacao(input: z.input<typeof schema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR), d = schema.parse(input);
    return prisma.$transaction(async tx => {
      const ref = await tx.itemReservaTentativaRecuperacao.findUnique({ where: { id: d.itemReservaId }, select: { reserva: { select: { proposta: { select: { alocacaoId: true } } } } } });
      if (!ref) throw new ErroRegra("Tentativa não encontrada.");
      const a = await bloquearLancamento(tx, ref.reserva.proposta.alocacaoId);
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${u.id} FOR SHARE`;
      const professor = await tx.usuario.findUnique({ where: { id: u.id }, select: { ativo: true, papeis: true } });
      const turma = await tx.turma.findUniqueOrThrow({ where: { id: a.turmaId }, include: { vinculosDocentes: true } });
      const designado = await designadoRecuperacao(tx, d.itemReservaId, u.id);
      if (!professor?.ativo || !professor.papeis.includes(Papel.PROFESSOR) || (!docenteAtual(u.id, turma) && !designado)) throw new ErroPermissao("Professor sem atribuição vigente para esta recuperação.");
      const i = await tx.itemReservaTentativaRecuperacao.findUniqueOrThrow({ where: { id: d.itemReservaId }, include: { realizacao: true, reserva: { include: { cancelamento: true, proposta: { include: { disponibilizacao: true } } } } } });
      const quando = new Date(d.realizadaEm), realizadaPorId = d.realizadaPorId ?? u.id;
      const regularizacao = realizadaPorId !== u.id;
      if (regularizacao && (!designado || !d.motivoRegularizacao)) throw new ErroPermissao("Regularizar avaliação de outro professor exige designação específica e justificativa.");
      if (!regularizacao && d.motivoRegularizacao) throw new ErroRegra("A justificativa de regularização se aplica à realização de outro professor.");
      if (i.realizacao) {
        if (i.realizacao.professorId === realizadaPorId && (i.realizacao.registradaPorId ?? i.realizacao.professorId) === u.id && i.realizacao.motivoRegularizacao === (d.motivoRegularizacao ?? null) && i.realizacao.realizadaEm.getTime() === quando.getTime() && i.realizacao.evidencia === d.evidencia) return { id: i.realizacao.id };
        throw new ErroRegra("Realização já registrada; correção exige fluxo próprio.");
      }
      if (i.reserva.cancelamento) throw new ErroRegra("A tentativa foi cancelada pela escola.");
      const agenda = await tx.encontroAgenda.findFirst({ where: { propostaAgendaRecuperacao: { itemReservaId: i.id } }, select: { inicio: true, fim: true, professorId: true, status: true } });
      if (agenda && (agenda.status !== "PREVISTO" || agenda.professorId !== realizadaPorId || quando < agenda.inicio || quando >= agenda.fim)) throw new ErroRegra("A realização precisa corresponder ao avaliador e ao intervalo da agenda aprovada.");
      const disp = i.reserva.proposta.disponibilizacao;
      if (!disp || quando < i.reserva.criadaEm || quando < disp.disponibilizadaEm || quando >= await prazoRecuperacaoVigente(tx, disp.id, quando) || quando > new Date()) throw new ErroRegra("Confira a realização após a reserva e dentro do prazo autorizado; data futura não é aceita.");
      const atribuicaoHistorica = await tx.designacaoRecuperacao.findFirst({ where: { itemReservaId: d.itemReservaId, criadaEm: { lte: quando } }, orderBy: { versao: "desc" }, select: { professorId: true } });
      const autorizadoNaData = turma.vinculosDocentes.some(v => v.professorId === realizadaPorId && vinculoCobre(v, quando)) || atribuicaoHistorica?.professorId === realizadaPorId;
      const situacao = (await carregarSituacoesNaAula(tx, [a.matriculaId], quando)).get(a.matriculaId);
      const autorizacao = situacao === "PAUSADA" || situacao === "ENCERRADA"
        ? await carregarAutorizacaoEspecialRecuperacaoTx(tx, i.id, quando) : null;
      const inicioVinculo = a.provenienciaVinculo === "MIGRACAO" ? a.inicioVigencia : a.criadoEm;
      if (!inicioVinculo || quando < inicioVinculo || (!autorizacao && !alocacaoCobreAula(a, quando)) || !autorizadoNaData) throw new ErroRegra("A realização precisa corresponder ao vínculo histórico do aluno e professor.");
      if (situacao !== "ATIVA" && !autorizacao) throw new ErroRegra("Confira a autorização contratual na data da realização.");
      const r = await tx.realizacaoRecuperacao.create({ data: { itemReservaId: i.id, professorId: realizadaPorId, registradaPorId: u.id, motivoRegularizacao: d.motivoRegularizacao ?? null, realizadaEm: quando, evidencia: d.evidencia, autorizacaoEspecialId: autorizacao?.id ?? null } });
      await registrarEvento(tx, { tipo: "RecuperacaoRealizada", agregadoTipo: "Matricula", agregadoId: a.matriculaId, autorId: u.id, payload: { realizacaoId: r.id, itemReservaId: i.id, reservaId: i.reservaId, habilidade: i.habilidade, realizadaPorId, registradaPorId: u.id, motivoRegularizacao: d.motivoRegularizacao ?? null, realizadaEm: quando.toISOString() } });
      return { id: r.id };
    });
  });
}
