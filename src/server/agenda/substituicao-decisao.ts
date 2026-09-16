"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { criarAvisosAlteracaoAgendaTx } from "@/server/comunicacoes-agenda/avisos";
import { conferirSubstituicaoTx } from "./substituicao-conferencia";
import { alocacaoCobreAula } from "@/server/diario/alocacoes";

export async function decidirSubstituicaoDocente(input: { propostaId: string; aprovar: boolean; motivo: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ propostaId: z.string().min(1), aprovar: z.boolean(), motivo: z.string().trim().min(5).max(2000) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.some((p) => ["GERENTE_PEDAGOGICO", "ADMINISTRADOR"].includes(p))) throw new ErroPermissao();
      const p = await tx.propostaSubstituicaoDocente.findUnique({ where: { id: d.propostaId }, include: { decisao: true, itens: true } });
      if (!p) throw new ErroRegra("Proposta não encontrada.");
      if (p.preparadorId === autor.id) throw new ErroRegra("Outra pessoa deve decidir a substituição.");
      if (p.decisao) {
        if (p.decisao.decisorId === autor.id && p.decisao.aprovada === d.aprovar && p.decisao.motivo === d.motivo) return { id: p.decisao.id, aplicada: p.decisao.aprovada };
        throw new ErroRegra("A proposta já possui uma decisão.");
      }
      if (d.aprovar) {
        if (!p.itens.length) throw new ErroRegra("A proposta não identifica encontros.");
        await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${p.substitutoId} FOR SHARE`;
        await tx.$queryRaw`SELECT id FROM "EncontroAgenda" WHERE id IN (${Prisma.join(p.itens.map((i) => i.encontroId))}) ORDER BY id FOR UPDATE`;
        const conferencia = await conferirSubstituicaoTx(tx, p.id);
        if (conferencia.pendencias.length) throw new ErroRegra(conferencia.pendencias.join(" "));
        const atualizados = await tx.encontroAgenda.updateMany({ where: { id: { in: p.itens.map((i) => i.encontroId) }, status: "PREVISTO", inicio: { gt: new Date() } }, data: { professorId: p.substitutoId } });
        if (atualizados.count !== p.itens.length) throw new ErroRegra("A agenda mudou durante a conferência. Revise a proposta.");
      }
      const decisao = await tx.decisaoSubstituicaoDocente.create({ data: { propostaId: p.id, decisorId: autor.id, aprovada: d.aprovar, motivo: d.motivo } });
      const evento = await registrarEvento(tx, { tipo: "SubstituicaoDocenteDecidida", agregadoTipo: "ConfiguracaoOperacional", agregadoId: "escola", autorId: autor.id,
        payload: { propostaId: p.id, aprovada: d.aprovar, substitutoId: p.substitutoId, encontrosIds: p.itens.map((i) => i.encontroId), motivo: d.motivo } });
      if (d.aprovar) {
        const encontros = await tx.encontroAgenda.findMany({ where: { id: { in: p.itens.map(i => i.encontroId) } }, select: { id: true, matriculaId: true, turmaId: true, inicio: true } });
        const grupos = new Map<string, string[]>();
        for (const encontro of encontros) {
          const matriculas = encontro.matriculaId ? [encontro.matriculaId] : encontro.turmaId ? (await tx.alocacaoTurma.findMany({ where: { turmaId: encontro.turmaId, matriculaId: { not: null } }, select: { matriculaId: true, criadoEm: true, encerradaEm: true, ativa: true, provenienciaVinculo: true, inicioVigencia: true, fimVigencia: true } })).flatMap((a) => a.matriculaId && alocacaoCobreAula(a, encontro.inicio) ? [a.matriculaId] : []) : [];
          for (const matriculaId of matriculas) grupos.set(matriculaId, [...(grupos.get(matriculaId) ?? []), encontro.id]);
        }
        for (const [matriculaId, encontrosIds] of grupos) await criarAvisosAlteracaoAgendaTx(tx, { eventoId: evento.id, matriculaId, encontrosIds });
      }
      return { id: decisao.id, aplicada: decisao.aprovada };
    });
  });
}
