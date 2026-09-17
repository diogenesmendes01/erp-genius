"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel } from "@/server/_shared";
const Entrada = z.object({ pagina: z.number().int().min(1).max(100000).default(1), matriculaId: z.string().min(1).max(100).optional() }).strict();
const Prova = z.object({ recebimentoId: z.string(), titularMatriculaId: z.string(), hashDados: z.string(), comprovanteUrl: z.string().regex(/^\/api\/files\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/).nullable(), comprovanteNome: z.string().nullable(), comentario: z.string().nullable() });
export async function consultarHistoricoRecebimentos(input: unknown) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = Entrada.parse(input);
    return prisma.$transaction(async tx => {
      const registros = await tx.recebimento.findMany({
        where: d.matriculaId ? { titularMatriculaId: d.matriculaId } : {},
        orderBy: [{ dataPagamento: "desc" }, { id: "desc" }], skip: (d.pagina - 1) * 30, take: 31,
        include: { destinacoes: { orderBy: { id: "asc" }, select: { id: true, cobrancaId: true, tipo: true, valor: true, evidencia: true } } },
      });
      const itens = registros.slice(0, 30);
      const eventos = await tx.evento.findMany({ where: { tipo: "RecebimentoRegistrado", agregadoTipo: "Recebimento", agregadoId: { in: itens.map(r => r.id) } }, select: { agregadoId: true, payload: true } });
      return { temProxima: registros.length > 30, itens: itens.map(r => {
        const provas = eventos.filter(e => e.agregadoId === r.id);
        const prova = provas.length === 1 ? Prova.safeParse(provas[0].payload) : null;
        const confirmada = prova?.success && prova.data.recebimentoId === r.id && prova.data.titularMatriculaId === r.titularMatriculaId && prova.data.hashDados === r.hashDados ? prova.data : null;
        return { id: r.id, matriculaId: r.titularMatriculaId, moeda: r.moeda, valor: r.valor.toFixed(2), dataPagamento: r.dataPagamento.toISOString(), forma: r.forma,
          comprovante: confirmada?.comprovanteUrl ? { url: confirmada.comprovanteUrl, nome: confirmada.comprovanteNome ?? "Abrir comprovante" } : null,
          comentario: confirmada?.comentario ?? null,
          evidenciaCaixaRegistrada: Boolean(confirmada),
          destinos: r.destinacoes.map(v => ({ ...v, valor: v.valor.toFixed(2) })),
        };
      }) };
    }, { isolationLevel: "RepeatableRead" });
  });
}
