"use server";

import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { bloquearLancamento } from "./lancamento-tx";
import { conferirGestorAvaliacao } from "./regras-tx";

const schema = z.object({
  alocacaoId: z.string().min(1).max(100),
  codigoAvaliacao: z.string().min(1).max(100),
  antesId: z.string().min(1).max(100).optional(),
}).strict();

/** Histórico administrativo de todas as tentativas, inclusive reservas anteriores da mesma proposta. */
export async function consultarHistoricoReservasSegundaChamada(input: z.input<typeof schema>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = schema.parse(input);
    return prisma.$transaction(async tx => {
      const alocacao = await bloquearLancamento(tx, d.alocacaoId);
      await conferirGestorAvaliacao(tx, usuario.id);
      const escopo = { proposta: { alocacaoId: alocacao.id, matriculaId: alocacao.matriculaId, turmaId: alocacao.turmaId, codigoAvaliacao: d.codigoAvaliacao } };
      const cursor = d.antesId ? await tx.reservaSegundaChamada.findFirst({
        where: { ...escopo, id: d.antesId }, select: { id: true, reservadaEm: true },
      }) : null;
      if (d.antesId && !cursor) throw new ErroRegra("O cursor não pertence ao histórico desta avaliação.");
      const reservas = await tx.reservaSegundaChamada.findMany({
        where: { ...escopo, ...(cursor ? { OR: [
          { reservadaEm: { lt: cursor.reservadaEm } },
          { reservadaEm: cursor.reservadaEm, id: { lt: cursor.id } },
        ] } : {}) },
        orderBy: [{ reservadaEm: "desc" }, { id: "desc" }], take: 21,
        select: {
          id: true, status: true, reservadaEm: true, reservadaPor: { select: { nome: true } },
          agenda: { select: { encontro: { select: { id: true, inicio: true, fim: true, status: true, professor: { select: { nome: true } } } } } },
          ocorrencias: { orderBy: [{ criadaEm: "desc" }, { id: "desc" }], take: 1, select: {
            status: true, ocorridaEm: true, criadaEm: true, motivo: true, evidencia: true, registradaPor: { select: { nome: true } },
          } },
          realizacao: { select: { realizadaEm: true, evidencia: true, professor: { select: { nome: true } }, registradaPor: { select: { nome: true } } } },
        },
      });
      const config = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } });
      return {
        fusoExibicao: config?.fusoInstitucional ?? "UTC",
        proximoId: reservas.length > 20 ? reservas[19].id : null,
        itens: reservas.slice(0, 20).map(r => {
          const e = r.agenda?.encontro, o = r.ocorrencias[0], fato = r.realizacao;
          return {
            id: r.id, status: r.status, reservadaEm: r.reservadaEm.toISOString(), reservadaPor: r.reservadaPor.nome,
            encontro: e ? { id: e.id, inicio: e.inicio.toISOString(), fim: e.fim.toISOString(), status: e.status, professor: e.professor?.nome ?? "Não informado" } : null,
            ocorrencia: o ? { status: o.status, ocorridaEm: o.ocorridaEm.toISOString(), criadaEm: o.criadaEm.toISOString(), motivo: o.motivo, evidencia: o.evidencia, registradaPor: o.registradaPor.nome } : null,
            realizacao: fato ? { realizadaEm: fato.realizadaEm.toISOString(), evidencia: fato.evidencia, professor: fato.professor.nome, registradaPor: fato.registradaPor.nome } : null,
          };
        }),
      };
    });
  });
}
