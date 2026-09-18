"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra } from "@/server/_shared";
import { bloquearLancamento } from "./lancamento-tx";
import { identificarMatriculaAvaliacao } from "./identificacao";
import { designadoRecuperacao } from "./recuperacao-designacao-acesso";
import { prazoRecuperacaoVigente } from "./recuperacao-prazo";
import { nomeCompleto } from "@/lib/nome";
import { agendasRecuperacaoAutorizadasTx } from "./recuperacao-agenda-consulta-tx";
import { carregarSituacoesNaAula } from "@/server/diario/historico-contratual";
import { carregarAutorizacaoEspecialRecuperacaoTx } from "./recuperacao-autorizacao-tx";

export async function listarTentativasRecuperacaoDesignadas(input: { depoisId?: string; modo?: "pendentes" | "historico" } = {}) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR);
    const d = z.object({ depoisId: z.string().min(1).max(100).optional(), modo: z.enum(["pendentes", "historico"]).default("pendentes") }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${u.id} FOR SHARE`;
      const usuario = await tx.usuario.findUnique({ where: { id: u.id }, select: { ativo: true, papeis: true } });
      if (!usuario?.ativo || !usuario.papeis.includes(Papel.PROFESSOR)) throw new ErroPermissao();
      const escopo = d.modo === "historico"
        ? Prisma.sql`(realizada."professorId" = ${u.id} OR realizada."registradaPorId" = ${u.id} OR EXISTS (SELECT 1 FROM "NotaRecuperacao" nota WHERE nota."realizacaoId" = realizada.id AND nota."autorId" = ${u.id}))`
        : Prisma.sql`recuperacao_designada(i.id, ${u.id})`;
      const itens = await tx.$queryRaw<{ id: string; habilidade: string; primeiroNome: string; sobrenome: string | null; matriculaCodigo: string | null; matriculaId: string; turma: string | null; nivel: string; realizacaoId: string | null }[]>`
        SELECT i.id, i.habilidade, aluno."primeiroNome", aluno.sobrenome, m.codigo AS "matriculaCodigo", m.id AS "matriculaId", COALESCE(t.nome,t.codigo) AS turma, nivel.codigo AS nivel, realizada.id AS "realizacaoId"
        FROM "ItemReservaTentativaRecuperacao" i JOIN "ReservaTentativaRecuperacao" r ON r.id = i."reservaId"
        JOIN "PropostaPlanoRecuperacao" p ON p.id = r."propostaId" JOIN "Matricula" m ON m.id = p."matriculaId"
        JOIN "Aluno" aluno ON aluno.id = m."alunoId" JOIN "AlocacaoTurma" a ON a.id = p."alocacaoId"
        JOIN "Turma" t ON t.id = a."turmaId" JOIN "Nivel" nivel ON nivel.id = p."nivelId"
        LEFT JOIN "RealizacaoRecuperacao" realizada ON realizada."itemReservaId" = i.id
        WHERE ${escopo} AND i.id > ${d.depoisId ?? ''}
        ORDER BY i.id ASC LIMIT 21`;
      const agendas = await agendasRecuperacaoAutorizadasTx(tx, itens.slice(0,20).map(i => i.id), u.id);
      return { modo: d.modo, proximoId: itens.length > 20 ? itens[19].id : null, itens: itens.slice(0,20).map(i => ({ id: i.id, habilidade: i.habilidade, aluno: nomeCompleto(i), matriculaCodigo: i.matriculaCodigo, matriculaId: i.matriculaId, turma: i.turma, nivel: i.nivel, realizada: i.realizacaoId !== null, realizacaoId: i.realizacaoId, agenda: agendas.get(i.id) ?? null })) };
    });
  });
}

export async function consultarTentativaRecuperacaoDesignada(itemReservaId: string) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR), id = z.string().min(1).max(100).parse(itemReservaId);
    return prisma.$transaction(async tx => {
      const ref = await tx.itemReservaTentativaRecuperacao.findUnique({ where: { id }, select: { reserva: { select: { proposta: { select: { alocacaoId: true } } } } } });
      if (!ref) throw new ErroRegra("Tentativa não encontrada.");
      const a = await bloquearLancamento(tx, ref.reserva.proposta.alocacaoId);
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${u.id} FOR SHARE`;
      const usuario = await tx.usuario.findUnique({ where: { id: u.id }, select: { ativo: true, papeis: true } });
      if (!usuario?.ativo || !usuario.papeis.includes(Papel.PROFESSOR) || !await designadoRecuperacao(tx, id, u.id)) throw new ErroPermissao("A tentativa não está atribuída a você ou não possui pendência.");
      const item = await tx.itemReservaTentativaRecuperacao.findUniqueOrThrow({ where: { id }, include: { realizacao: { select: { id: true, realizadaEm: true, professor: { select: { nome: true } } } }, reserva: { include: { proposta: { include: { disponibilizacao: true } } } } } });
      const plano = item.reserva.proposta;
      const agenda = (await agendasRecuperacaoAutorizadasTx(tx, [id], u.id)).get(id) ?? null;
      const atividade = z.array(z.object({ habilidade: z.string(), estrategia: z.string(), avaliacaoProposta: z.string() })).parse(plano.atividades).find(h => h.habilidade === item.habilidade);
      if (!atividade || !plano.disponibilizacao) throw new ErroRegra("Confira as condições da tentativa com a gestão.");
      const historicos = item.realizacao ? [] : await tx.usuario.findMany({ where: { id: { not: u.id }, OR: [
        { id: { in: (await tx.vinculoDocente.findMany({ where: { turmaId: a.turmaId }, select: { professorId: true } })).map(v => v.professorId) } },
        { designacoesRecuperacaoRecebidas: { some: { itemReservaId: id } } },
      ] }, select: { id: true, nome: true }, orderBy: [{ nome: "asc" }, { id: "asc" }] });
      const agora = new Date();
      const situacaoContratual = (await carregarSituacoesNaAula(tx, [a.matriculaId], agora)).get(a.matriculaId) ?? "A_CONFERIR";
      const autorizacao = (situacaoContratual === "PAUSADA" || situacaoContratual === "ENCERRADA")
        ? await carregarAutorizacaoEspecialRecuperacaoTx(tx, item.id, agora)
        : null;
      const podeRegistrarHistorica = !item.realizacao && (!agenda || (agenda.status === "PREVISTO" && agenda.mesmoAvaliador && Date.parse(agenda.inicio) <= Date.now()));
      return { professoresHistoricos: historicos, itemReservaId: item.id, identificacao: await identificarMatriculaAvaliacao(tx, a.matriculaId, a.turmaId), atividade, agenda,
        situacaoContratual, autorizacaoEspecialAte: autorizacao?.prazoAte.toISOString() ?? null,
        podeRegistrarHistorica, podeRegistrarAgora: podeRegistrarHistorica && (situacaoContratual === "ATIVA" || !!autorizacao),
        podeRegistrarRealizacao: podeRegistrarHistorica,
        reservadaEm: item.reserva.criadaEm.toISOString(), disponibilizadaEm: plano.disponibilizacao.disponibilizadaEm.toISOString(), prazoVigente: (await prazoRecuperacaoVigente(tx, plano.disponibilizacao.id)).toISOString(),
        realizacao: item.realizacao ? { id: item.realizacao.id, realizadaEm: item.realizacao.realizadaEm.toISOString(), professor: item.realizacao.professor.nome } : null };
    });
  });
}
