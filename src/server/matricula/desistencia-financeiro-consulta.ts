"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { camposNavegacaoFila, corteDoId, direcaoDeLeitura, lerPaginaDaFila, MENSAGEM_DOIS_SENTIDOS, umSentido, type NavegacaoFila } from "@/lib/cursor-fila";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { conferirCancelamentoFinanceiroDesistenciaTx } from "./desistencia-financeira-tx";

export async function consultarCancelamentoFinanceiroDesistencia(input: { matriculaId: string }) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const { matriculaId } = z.object({ matriculaId: z.string().trim().min(1).max(100) }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await bloquearMatriculas(tx, [matriculaId]);
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${sessao.id} FOR SHARE`;
      const usuario = await tx.usuario.findUnique({ where: { id: sessao.id }, select: { ativo: true, papeis: true, permissoes: true } });
      if (!usuario?.ativo || !usuario.papeis.some(p => p === Papel.ADMINISTRADOR || p === Papel.FINANCEIRO)) throw new ErroPermissao();
      const matricula = await tx.matricula.findUnique({ where: { id: matriculaId }, select: { id: true, codigo: true, status: true } });
      if (!matricula) throw new ErroRegra("Matrícula não encontrada.");
      const pedido = await tx.pedidoDesistenciaPreparacao.findFirst({ where: { matriculaId }, orderBy: { versao: "desc" }, select: { id: true, versao: true, estadoHash: true, motivo: true } });
      const efetivacao = await tx.efetivacaoPedidoDesistenciaPreparacao.findUnique({ where: { matriculaId }, select: { id: true } });
      let impedimento: string | null = pedido ? null : "A Secretaria deve registrar o pedido de desistência antes da proposta financeira.";
      if (efetivacao) impedimento = "A desistência já foi efetivada; consulte o histórico preservado.";
      if (pedido && !impedimento) {
        try { await conferirCancelamentoFinanceiroDesistenciaTx(tx, pedido.id, pedido.estadoHash); }
        catch (erro) { if (erro instanceof ErroRegra) impedimento = erro.message; else throw erro; }
      }
      const cobrancas = await tx.cobranca.findMany({ where: { matriculaId }, orderBy: [{ vencimento: "asc" }, { id: "asc" }],
        select: { id: true, tipo: true, status: true, moeda: true, valorOriginal: true, valorNegociado: true, saldo: true, vencimento: true } });
      const ultima = pedido ? await tx.propostaFinanceiraDesistencia.findFirst({ where: { pedidoId: pedido.id }, orderBy: { versao: "desc" }, select: { id: true } }) : null;
      const propostas = await tx.propostaFinanceiraDesistencia.findMany({ where: { pedido: { matriculaId } }, orderBy: [{ criadaEm: "desc" }, { id: "desc" }], take: 20,
        select: { id: true, pedidoId: true, versao: true, estadoHash: true, entradaHash: true, motivo: true, evidenciaCondicoes: true, criadaEm: true, preparadorId: true,
          preparador: { select: { nome: true } }, decisao: { select: { id: true, aprovada: true, motivo: true, decididaEm: true, decisor: { select: { nome: true } } } } } });
      const alcada = usuario.papeis.includes(Papel.ADMINISTRADOR) || usuario.permissoes.includes("financeiro.aprovar_acertos");
      return { matricula, pedido, podePropor: !!pedido && !impedimento, impedimento,
        cobrancas: cobrancas.map(c => ({ ...c, valorOriginal: c.valorOriginal.toFixed(2), valorNegociado: c.valorNegociado.toFixed(2), saldo: c.saldo?.toFixed(2) ?? null, vencimento: c.vencimento.toISOString() })),
        propostas: propostas.map(p => ({ id: p.id, versao: p.versao, motivo: p.motivo, evidenciaCondicoes: p.evidenciaCondicoes, propostaHash: p.entradaHash,
          preparadorNome: p.preparador.nome, criadaEmISO: p.criadaEm.toISOString(),
          podeDecidir: !efetivacao && !p.decisao && alcada && p.preparadorId !== sessao.id,
          podeAprovar: !impedimento && p.id === ultima?.id && p.pedidoId === pedido?.id && p.estadoHash === pedido?.estadoHash,
          decisao: p.decisao ? { aprovada: p.decisao.aprovada, motivo: p.decisao.motivo, decisorNome: p.decisao.decisor.nome, decididaEmISO: p.decisao.decididaEm.toISOString() } : null })) };
    });
  });
}

/** Fila de trabalho com cursor nos dois sentidos (E4, decisão de 10/10/2026): a ordem por `id` é estável e a
 * leitura continua do último pedido visto, então concluir um pedido da página não faz a próxima pular outro. */
export async function listarDesistenciasFinanceiras(input: NavegacaoFila = {}) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const nav = z.object(camposNavegacaoFila).strict().refine(umSentido, MENSAGEM_DOIS_SENTIDOS).parse(input);
    const usuario = await prisma.usuario.findUnique({ where: { id: sessao.id }, select: { ativo: true, papeis: true } });
    if (!usuario?.ativo || !usuario.papeis.some(p => p === Papel.FINANCEIRO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
    const { registros, ...navegacao } = await lerPaginaDaFila(nav, 20, (leitura, take) => prisma.matricula.findMany({ where: { status: { in: ["RASCUNHO", "AGUARDANDO"] },
      pedidosDesistenciaPreparacao: { some: {} }, cobrancas: { some: {} }, efetivacaoDesistenciaPreparacao: null, ...corteDoId(leitura, "asc") },
      orderBy: { id: direcaoDeLeitura(leitura)("asc") }, take,
      select: { id: true, codigo: true, pedidosDesistenciaPreparacao: { orderBy: { versao: "desc" }, take: 1, select: { versao: true, motivo: true } } } }), m => m.id);
    return { itens: registros.map(m => ({ id: m.id, codigo: m.codigo, pedido: m.pedidosDesistenciaPreparacao[0] })), ...navegacao };
  });
}
