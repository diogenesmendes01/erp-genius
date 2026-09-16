"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { PeriodosCalendarioSchema } from "./calendario-schema";

export async function decidirCalendarioEscolar(input: { calendarioId: string; aprovar: boolean; motivo: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ calendarioId: z.string().min(1), aprovar: z.boolean(), motivo: z.string().trim().min(5).max(2000) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.some((p) => p === "GERENTE_PEDAGOGICO" || p === "ADMINISTRADOR")) throw new ErroPermissao();
      const c = await tx.versaoCalendarioEscolar.findUnique({ where: { id: d.calendarioId }, include: { decisao: true } });
      if (!c) throw new ErroRegra("Proposta de calendário não encontrada.");
      if (c.preparadorId === autor.id) throw new ErroRegra("Outra pessoa deve decidir o calendário.");
      if (c.decisao) {
        if (c.decisao.decisorId === autor.id && c.decisao.aprovada === d.aprovar && c.decisao.motivo === d.motivo) return { id: c.decisao.id, aprovada: c.decisao.aprovada };
        throw new ErroRegra("Esta versão já possui decisão.");
      }
      if (d.aprovar) {
        if (await tx.versaoCalendarioEscolar.count({ where: { versao: { gt: c.versao } } })) throw new ErroRegra("Revise a versão mais recente antes de aprovar.");
        await tx.$queryRaw`SELECT id FROM "ConfiguracaoOperacional" WHERE id = 'escola' FOR SHARE`;
        const config = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" } });
        if (config?.fusoInstitucional !== c.fusoInstitucional) throw new ErroRegra("O fuso da escola mudou. Prepare uma nova versão.");
        PeriodosCalendarioSchema.parse(c.periodos);
        // O fluxo de revisão conjunta aplicará calendário e remarcações atomicamente.
        if (await tx.encontroAgenda.count({ where: { status: "PREVISTO" } })) throw new ErroRegra("Há encontros publicados. Revise os impactos e as remarcações conjuntamente antes de aplicar o calendário.");
      }
      const decisao = await tx.decisaoCalendarioEscolar.create({ data: { calendarioId: c.id, decisorId: autor.id, aprovada: d.aprovar, motivo: d.motivo } });
      await registrarEvento(tx, { tipo: "CalendarioEscolarDecidido", agregadoTipo: "ConfiguracaoOperacional", agregadoId: "escola", autorId: autor.id, payload: { calendarioId: c.id, versao: c.versao, aprovada: d.aprovar, motivo: d.motivo } });
      return { id: decisao.id, aprovada: decisao.aprovada };
    });
  });
}

export async function consultarCalendarioEscolarVigente() {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
    const c = await prisma.versaoCalendarioEscolar.findFirst({ where: { decisao: { aprovada: true } }, orderBy: { versao: "desc" }, include: { decisao: true } });
    return c ? { id: c.id, versao: c.versao, fusoInstitucional: c.fusoInstitucional, periodos: PeriodosCalendarioSchema.parse(c.periodos), publicadaEm: c.decisao!.decididaEm.toISOString() } : null;
  });
}
