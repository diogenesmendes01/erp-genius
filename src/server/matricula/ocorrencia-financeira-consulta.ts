"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra } from "@/server/_shared";
import { RegrasHorasSchema } from "./condicoes-horas-schema";

export async function consultarOcorrenciasFinanceiras(input: { matriculaId: string; cursor?: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = z.object({ matriculaId: z.string().min(1), cursor: z.string().min(1).optional() }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.some(p => p === Papel.FINANCEIRO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
      const m = await tx.matricula.findUnique({ where: { id: d.matriculaId }, select: { id: true, alunoId: true, codigo: true } });
      if (!m) throw new ErroRegra("Matrícula não encontrada.");
      if (d.cursor && !await tx.encontroAgenda.count({ where: { finalidade: "AULA", id: d.cursor, matriculaId: m.id, turmaId: null } })) throw new ErroRegra("Cursor não corresponde à matrícula.");
      const encontrados = await tx.encontroAgenda.findMany({ where: { finalidade: "AULA", matriculaId: m.id, turmaId: null, ...(d.cursor ? { id: { gt: d.cursor } } : {}) }, orderBy: { id: "asc" }, take: 31,
        select: { id: true, inicio: true, fim: true, status: true, fusoOrigem: true,
          ocorrenciasParticulares: { orderBy: { versao: "desc" }, take: 1, select: { id: true, versao: true, tipo: true, evidencia: true, comunicadoEm: true, autor: { select: { nome: true } } } },
          conferenciaOcorrenciaHoras: { select: { id: true, valor: true, moeda: true, minutos: true, desfecho: true, motivo: true, conferidaEm: true,
            conferente: { select: { nome: true } }, ocorrenciaId: true, condicoesId: true, snapshot: true,
            consumoAntecipacao: { select: { id: true, reservaId: true, motivo: true, reserva: { select: { compraId: true, minutos: true } } } } } } } });
      const condicoes = await tx.condicoesHorasMatricula.findMany({ where: { matriculaId: m.id, status: "APROVADA" }, orderBy: { versao: "desc" }, select: { id: true, versao: true, regras: true, documentoId: true } });
      const pagina = encontrados.slice(0, 30);
      return { matricula: m, proximoCursor: encontrados.length > 30 ? pagina[29].id : null,
        condicoes: condicoes.map(c => ({ ...c, regras: RegrasHorasSchema.safeParse(c.regras).success ? RegrasHorasSchema.parse(c.regras) : null })),
        encontros: pagina.map(({ ocorrenciasParticulares, conferenciaOcorrenciaHoras: c, ...e }) => ({ ...e, inicio: e.inicio.toISOString(), fim: e.fim.toISOString(),
          ocorrencia: ocorrenciasParticulares[0] ? { ...ocorrenciasParticulares[0], comunicadoEm: ocorrenciasParticulares[0].comunicadoEm?.toISOString() ?? null } : null,
          conferencia: c ? { ...c, valor: c.valor.toFixed(2), conferidaEm: c.conferidaEm.toISOString() } : null })) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
