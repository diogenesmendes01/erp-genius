"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { PAPEIS_PAUSA } from "./pausa-estado";
import { APROVADORES_PAUSA, exigirUsuarioPausa } from "./pausa-integridade";
import { projetarDetalhesMovimentacao } from "./movimentacoes-detalhes";

const schema = z.object({ alunoId: z.string().trim().min(1), tipo: z.enum(["PAUSA", "RETOMADA"]), cursor: z.string().min(1).optional() }).strict();
const detalheSchema = schema.omit({ cursor: true }).extend({ propostaId: z.string().trim().min(1) });

/** Retorna os impactos registrados na conferência, sem recalculá-los silenciosamente. */
export async function obterDetalhesMovimentacao(input: z.input<typeof detalheSchema>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS_PAUSA);
    const dados = detalheSchema.parse(input);
    return prisma.$transaction(async (tx) => {
      await exigirUsuarioPausa(tx, autor.id, PAPEIS_PAUSA);
      const consulta = { where: { id: dados.propostaId, alunoId: dados.alunoId }, select: { id: true, status: true, motivo: true, snapshot: true } };
      const p = dados.tipo === "PAUSA" ? await tx.propostaPausaMatriculas.findFirst(consulta) : await tx.propostaRetomadaMatriculas.findFirst(consulta);
      if (!p) return null;
      const detalhes = projetarDetalhesMovimentacao(dados.tipo, p.snapshot);
      return { id: p.id, status: p.status, motivo: p.motivo, detalhes, historicoIncompleto: detalhes === null };
    });
  });
}

/** Histórico operacional paginado. Não devolve hashes, entrada financeira ou snapshots brutos. */
export async function listarPropostasMovimentacao(input: z.input<typeof schema>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS_PAUSA);
    const dados = schema.parse(input);
    return prisma.$transaction(async (tx) => {
      await exigirUsuarioPausa(tx, autor.id, PAPEIS_PAUSA);
      const select = {
        id: true, motivo: true, status: true, criadoEm: true, decididoEm: true, aplicadaEm: true, motivoDecisao: true,
        solicitante: { select: { id: true, nome: true } }, decisor: { select: { id: true, nome: true } },
        itens: { orderBy: { matriculaId: "asc" as const }, select: { matricula: { select: { id: true, codigo: true } } } },
      } as const;
      const where = { alunoId: dados.alunoId };
      // Cursor precisa pertencer ao mesmo aluno e ao mesmo tipo de proposta.
      if (dados.cursor) {
        const existe = dados.tipo === "PAUSA"
          ? await tx.propostaPausaMatriculas.count({ where: { ...where, id: dados.cursor } })
          : await tx.propostaRetomadaMatriculas.count({ where: { ...where, id: dados.cursor } });
        if (!existe) return { propostas: [], proximo: null };
      }
      const consulta = { where, select, orderBy: [{ criadoEm: "desc" as const }, { id: "desc" as const }], take: 51,
        ...(dados.cursor ? { cursor: { id: dados.cursor }, skip: 1 } : {}),
      };
      const registros = dados.tipo === "PAUSA" ? await tx.propostaPausaMatriculas.findMany(consulta) : await tx.propostaRetomadaMatriculas.findMany(consulta);
      const propostas = registros.slice(0, 50).map((p) => ({
        id: p.id, tipo: dados.tipo, motivo: p.motivo, status: p.status, criadoEm: p.criadoEm.toISOString(),
        decididoEm: p.decididoEm?.toISOString() ?? null, aplicadaEm: p.aplicadaEm?.toISOString() ?? null,
        motivoDecisao: p.motivoDecisao, solicitante: p.solicitante, decisor: p.decisor,
        matriculas: p.itens.map((i) => i.matricula),
        podeDecidir: p.status === "PENDENTE" && p.solicitante.id !== autor.id && autor.papeis.some((papel) => APROVADORES_PAUSA.includes(papel)),
      }));
      return { propostas, proximo: registros.length > 50 ? propostas.at(-1)!.id : null };
    });
  });
}
