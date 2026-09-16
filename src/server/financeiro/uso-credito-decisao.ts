"use server";
import { isDeepStrictEqual } from "node:util";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "./recebimentos";
import { estadoUsoCreditoTx } from "./uso-credito-estado";
export async function decidirUtilizacaoCredito(input: { propostaId: string; aprovar: boolean; motivo: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = z.object({ propostaId: z.string().min(1), aprovar: z.boolean(), motivo: z.string().trim().min(5).max(2000) }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const inicial = await tx.propostaUsoCredito.findUnique({ where: { id: d.propostaId }, select: { credito: { select: { matriculaId: true } } } });
      if (!inicial) throw new ErroRegra("Proposta não encontrada.");
      await bloquearMatriculas(tx, [inicial.credito.matriculaId]);
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autor.id} FOR SHARE`;
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true, permissoes: true } });
      if (!u?.ativo || !(u.papeis.includes(Papel.ADMINISTRADOR) || (u.papeis.includes(Papel.FINANCEIRO) && u.permissoes.includes("financeiro.aprovar_acertos")))) throw new ErroPermissao("Exige permissão de aprovação financeira.");
      const p = await tx.propostaUsoCredito.findUniqueOrThrow({ where: { id: d.propostaId }, include: { decisao: true } });
      if (p.preparadorId === autor.id) throw new ErroRegra("Outra pessoa deve decidir a utilização.");
      if (p.decisao) {
        if (p.decisao.decisorId !== autor.id || p.decisao.aprovada !== d.aprovar || p.decisao.motivo !== d.motivo) throw new ErroRegra("A proposta já possui decisão.");
        return { id: p.decisao.id, aprovada: p.decisao.aprovada };
      }
      if (d.aprovar) {
        await tx.$queryRaw`SELECT id FROM "CreditoMatricula" WHERE id = ${p.creditoId} FOR UPDATE`;
        if (await tx.propostaUsoCredito.count({ where: { creditoId: p.creditoId, versao: { gt: p.versao } } })) throw new ErroRegra("Confira a versão mais recente da proposta.");
        const atual = await estadoUsoCreditoTx(tx, p.creditoId, p.cobrancaId, p.valor);
        if (!isDeepStrictEqual(p.snapshot, atual.snapshot)) throw new ErroRegra("Crédito ou cobrança mudou. Prepare nova proposta para conferência.");
      }
      // O trigger aplica a liquidação por crédito, preservando valorRecebido e Recebimento.
      const decisao = await tx.decisaoUsoCredito.create({ data: { propostaId: p.id, decisorId: autor.id, aprovada: d.aprovar, motivo: d.motivo } });
      await registrarEvento(tx, { tipo: "UtilizacaoCreditoDecidida", agregadoTipo: "Matricula", agregadoId: inicial.credito.matriculaId, autorId: autor.id, payload: { propostaId: p.id, decisaoId: decisao.id, creditoId: p.creditoId, cobrancaId: p.cobrancaId, valor: p.valor.toFixed(2), aprovada: d.aprovar, motivo: d.motivo } });
      return { id: decisao.id, aprovada: d.aprovar };
    });
  });
}
