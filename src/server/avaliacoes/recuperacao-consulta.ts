"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra } from "@/server/_shared";
import { bloquearLancamento } from "./lancamento-tx";
import { docenteAtual } from "@/server/diario/permissoes";
import { identificarMatriculaAvaliacao } from "./identificacao";
import { ConteudoRegraAvaliacaoSchema } from "./regra-schema";
import { designadoRecuperacao } from "./recuperacao-designacao-acesso";

export async function listarRecuperacoesRealizadas(input: { alocacaoId: string; depoisId?: string }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ alocacaoId: z.string().min(1).max(100), depoisId: z.string().min(1).max(100).optional() }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const a = await bloquearLancamento(tx, d.alocacaoId);
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${u.id} FOR SHARE`;
      const fresco = await tx.usuario.findUnique({ where: { id: u.id }, select: { ativo: true, papeis: true } });
      if (!fresco?.ativo) throw new ErroPermissao();
      const t = await tx.turma.findUniqueOrThrow({ where: { id: a.turmaId }, include: { vinculosDocentes: true } });
      const gestao = fresco.papeis.some(p => p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR);
      const professor = fresco.papeis.includes(Papel.PROFESSOR), atual = professor && docenteAtual(u.id, t);
      if (!gestao && !professor) throw new ErroPermissao();
      const designadas = !gestao && !atual ? await tx.$queryRaw<{ id: string }[]>`SELECT r.id FROM "RealizacaoRecuperacao" r JOIN "ItemReservaTentativaRecuperacao" i ON i.id = r."itemReservaId" JOIN "ReservaTentativaRecuperacao" reserva ON reserva.id = i."reservaId" JOIN "PropostaPlanoRecuperacao" p ON p.id = reserva."propostaId" WHERE p."alocacaoId" = ${a.id} AND recuperacao_designada(i.id, ${u.id})` : [];
      const escopoHistorico = { OR: [{ professorId: u.id }, { registradaPorId: u.id }, { notas: { some: { autorId: u.id } } }, { id: { in: designadas.map(r => r.id) } }] };
      const filtro = { itemReserva: { reserva: { proposta: { alocacaoId: a.id, matriculaId: a.matriculaId } } }, ...(!gestao && !atual ? escopoHistorico : {}) };
      if (!gestao && !atual && !await tx.realizacaoRecuperacao.count({ where: filtro })) throw new ErroPermissao();
      const rs = await tx.realizacaoRecuperacao.findMany({ where: { ...filtro, ...(d.depoisId ? { id: { gt: d.depoisId } } : {}) }, orderBy: { id: "asc" }, take: 51,
        select: { id: true, realizadaEm: true, itemReserva: { select: { habilidade: true } }, notas: { where: !gestao && !atual ? { OR: [{ autorId: u.id }, { realizacao: { professorId: u.id } }, { realizacaoId: { in: designadas.map(r => r.id) } }] } : {}, orderBy: { versao: "desc" }, take: 1, select: { submetida: true, decisao: { select: { aprovada: true } } } } } });
      return { identificacao: await identificarMatriculaAvaliacao(tx, a.matriculaId, a.turmaId), proximoId: rs.length > 50 ? rs[49].id : null,
        realizacoes: rs.slice(0, 50).map(r => ({ id: r.id, realizadaEm: r.realizadaEm.toISOString(), habilidade: r.itemReserva.habilidade,
          estado: !r.notas.length ? "Sem nota" : r.notas[0].decisao?.aprovada ? "Oficializada" : r.notas[0].decisao ? "Rejeitada" : r.notas[0].submetida ? "Aguardando conferência" : "Rascunho" })) };
    });
  });

}

export async function consultarNotaRecuperacao(input: { realizacaoId: string; antesVersao?: number }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ realizacaoId: z.string().min(1).max(100), antesVersao: z.number().int().positive().optional() }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const ref = await tx.realizacaoRecuperacao.findUnique({ where: { id: d.realizacaoId }, select: { itemReserva: { select: { reserva: { select: { proposta: { select: { alocacaoId: true } } } } } } } });
      if (!ref) throw new ErroRegra("Realização não encontrada.");
      const a = await bloquearLancamento(tx, ref.itemReserva.reserva.proposta.alocacaoId);
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${u.id} FOR SHARE`;
      const fresco = await tx.usuario.findUnique({ where: { id: u.id }, select: { ativo: true, papeis: true } });
      if (!fresco?.ativo) throw new ErroPermissao();
      const r = await tx.realizacaoRecuperacao.findUniqueOrThrow({ where: { id: d.realizacaoId }, include: { registradaPor: { select: { nome: true } }, professor: { select: { nome: true } }, itemReserva: { include: { reserva: { include: { proposta: { include: { regra: true } } } } } } } });
      const t = await tx.turma.findUniqueOrThrow({ where: { id: a.turmaId }, include: { vinculosDocentes: true } });
      const gestao = fresco.papeis.some(p => p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR);
      const professor = fresco.papeis.includes(Papel.PROFESSOR), atual = professor && docenteAtual(u.id, t);
      const designado = professor && await designadoRecuperacao(tx, r.itemReservaId, u.id);
      const autorHistorico = professor && await tx.notaRecuperacao.count({ where: { realizacaoId: r.id, autorId: u.id } }) > 0;
      if (!gestao && !atual && !designado && !(professor && (r.professorId === u.id || r.registradaPorId === u.id)) && !autorHistorico) throw new ErroPermissao();
      const ultima = await tx.notaRecuperacao.findFirst({ where: { realizacaoId: r.id }, orderBy: { versao: "desc" }, select: { versao: true } });
      const oficial = await tx.notaRecuperacao.count({ where: { realizacaoId: r.id, decisao: { aprovada: true } } }) > 0;
      const notas = await tx.notaRecuperacao.findMany({ where: { realizacaoId: r.id, ...(d.antesVersao ? { versao: { lt: d.antesVersao } } : {}), ...(!gestao && !atual && !designado && r.professorId !== u.id ? { autorId: u.id } : {}) }, orderBy: { versao: "desc" }, take: 21,
        select: { id: true, versao: true, nota: true, comentarioAluno: true, submetida: true, entradaHash: true, criadaEm: true, autorId: true, correcoes: { where: { decisao: { aprovada: true } }, orderBy: { versao: "desc" }, take: 1, select: { id: true, nota: true, comentarioAluno: true, motivo: true } }, autor: { select: { nome: true } }, decisao: { select: { aprovada: true, motivo: true, criadaEm: true, decisor: { select: { nome: true } } } } } });
      return { alocacaoId: a.id, realizacaoId: r.id, realizadaEm: r.realizadaEm.toISOString(), realizadaPor: r.professor.nome, registradaPor: r.registradaPor?.nome ?? r.professor.nome, motivoRegularizacao: r.motivoRegularizacao, evidencia: r.evidencia, habilidade: r.itemReserva.habilidade,
        identificacao: await identificarMatriculaAvaliacao(tx, a.matriculaId, a.turmaId), escala: ConteudoRegraAvaliacaoSchema.parse(r.itemReserva.reserva.proposta.regra.conteudo).escala,
        versaoEsperada: ultima?.versao ?? 0, podeLancar: ((atual && r.professorId === u.id) || designado) && !oficial, oficial,
        proximaAntesVersao: notas.length > 20 ? notas[19].versao : null,
        notas: notas.slice(0, 20).map(n => {
          const podeDecidir = gestao && n.autorId !== u.id && r.professorId !== u.id && n.submetida && n.nota !== null && !n.decisao;
          return { id: n.id, versao: n.versao, correcaoVigente: n.correcoes[0] ?? null, nota: n.nota, comentarioAluno: n.comentarioAluno, submetida: n.submetida, criadaEm: n.criadaEm.toISOString(), autor: n.autor.nome,
            decisao: n.decisao ? { ...n.decisao, criadaEm: n.decisao.criadaEm.toISOString() } : null,
            podeCorrigir: (gestao || atual) && n.decisao?.aprovada === true,
            podeDecidir, podeAprovar: podeDecidir && n.versao === ultima?.versao && !oficial, entradaHash: podeDecidir ? n.entradaHash : null };
        }) };
    });
  });
}
