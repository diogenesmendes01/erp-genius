"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra } from "@/server/_shared";
import { ReplanejamentoSnapshotSchema } from "./replanejamento-snapshot";

export async function consultarRevisaoReplanejamento(input: { calendarioId: string; revisaoId: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ calendarioId: z.string().min(1), revisaoId: z.string().min(1) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.some((p) => ["SECRETARIA_ACADEMICA", "GERENTE_PEDAGOGICO", "ADMINISTRADOR"].includes(p))) throw new ErroPermissao();
      const registro = await tx.rascunhoReplanejamento.findFirst({ where: { id: d.revisaoId, calendarioId: d.calendarioId },
        select: { id: true, versao: true, motivo: true, criadoEm: true, snapshot: true, preparador: { select: { nome: true } }, calendario: { select: { versao: true, fusoInstitucional: true } } } });
      if (!registro) throw new ErroRegra("Revisão não encontrada neste calendário.");
      const conteudo = ReplanejamentoSnapshotSchema.safeParse(registro.snapshot);
      if (!conteudo.success || conteudo.data.calendarioId !== d.calendarioId) throw new ErroRegra("O conteúdo histórico exige conferência antes de ser exibido.");
      return { ...registro, snapshot: conteudo.data };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}

export async function consultarHistoricoReplanejamento(input: { calendarioId: string; pagina?: number }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ calendarioId: z.string().min(1), pagina: z.number().int().min(1).max(100000).default(1) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.some((p) => ["SECRETARIA_ACADEMICA", "GERENTE_PEDAGOGICO", "ADMINISTRADOR"].includes(p))) throw new ErroPermissao();
      const calendario = await tx.versaoCalendarioEscolar.findUnique({ where: { id: d.calendarioId }, select: { versao: true, fusoInstitucional: true } });
      if (!calendario) throw new ErroRegra("Calendário não encontrado.");
      const registros = await tx.rascunhoReplanejamento.findMany({ where: { calendarioId: d.calendarioId }, orderBy: { versao: "desc" }, skip: (d.pagina - 1) * 30, take: 31,
        select: { id: true, versao: true, motivo: true, criadoEm: true, preparador: { select: { nome: true } } } });
      return { calendario, registros: registros.slice(0, 30), pagina: d.pagina, possuiMais: registros.length > 30 };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
