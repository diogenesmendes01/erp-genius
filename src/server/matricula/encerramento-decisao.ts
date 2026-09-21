"use server";
import { isDeepStrictEqual } from "node:util";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { carregarPreviaMensalEncerramentoTx } from "./encerramento-previa-tx";
import { PreviaMensalPedidoEncerramentoSchema } from "./encerramento-previa-schema";
const Entrada = z.object({ alunoId: z.string().min(1), rascunhoId: z.string().min(1), aprovar: z.boolean(), motivo: z.string().trim().min(5).max(2000), autorizaRetroatividade: z.boolean().default(false), autorizaExcecaoMulta: z.boolean().default(false) }).strict();

/** Decisão financeira preservada. A execução deve revalidar origens e decisão antes de aplicar. */
export async function decidirAcertoEncerramento(input: z.input<typeof Entrada>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO), d = Entrada.parse(input);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      const inicial = await tx.rascunhoAcertoEncerramento.findFirst({ where: { id: d.rascunhoId, solicitacao: { alunoId: d.alunoId } }, select: { solicitacaoId: true } });
      if (!inicial) throw new ErroRegra("Acerto não encontrado para este aluno.");
      await tx.$queryRaw`SELECT id FROM "SolicitacaoEncerramentoMatriculas" WHERE id=${inicial.solicitacaoId} FOR UPDATE`;
      const r = await tx.rascunhoAcertoEncerramento.findUniqueOrThrow({ where: { id: d.rascunhoId }, include: { decisao: true } });
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${autor.id} FOR SHARE`;
      const u = await tx.usuario.findUniqueOrThrow({ where: { id: autor.id } });
      if (!u.ativo || !(u.papeis.includes(Papel.ADMINISTRADOR) || (u.papeis.includes(Papel.FINANCEIRO) && u.permissoes.includes("financeiro.aprovar_acertos")))) throw new ErroPermissao();
      if (r.preparadorId === autor.id) throw new ErroRegra("Outra pessoa deve decidir o acerto.");
      if (r.decisao) {
        const anterior = r.decisao;
        if (anterior.decisorId !== autor.id || anterior.aprovada !== d.aprovar || anterior.motivo !== d.motivo || anterior.autorizaRetroatividade !== d.autorizaRetroatividade || anterior.autorizaExcecaoMulta !== d.autorizaExcecaoMulta) throw new ErroRegra("Esta versão já tem decisão.");
        return { id: anterior.id, aprovada: anterior.aprovada, efetivado: false as const };
      }
      if (d.aprovar) {
        if (await tx.rascunhoAcertoEncerramento.count({ where: { solicitacaoId: r.solicitacaoId, versao: { gt: r.versao } } })) throw new ErroRegra("Confira a versão mais recente.");
        const entrada = PreviaMensalPedidoEncerramentoSchema.parse(r.entrada);
        const ids = entrada.contratos.map(c => c.matriculaId).sort();
        await bloquearMatriculas(tx, ids);
        await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE "matriculaId" IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
        const atual = await carregarPreviaMensalEncerramentoTx(tx, entrada);
        if (!isDeepStrictEqual(r.snapshot, atual)) throw new ErroRegra("As origens mudaram. Prepare nova conferência.");
        if (atual.contratos.some(c => c.consolidacao.pendencias.length || !c.consolidacao.totais)) throw new ErroRegra("Resolva as pendências da consolidação.");
        if (atual.contratos.some(c => c.agendaEncerramento.pendencias.length)) throw new ErroRegra("Regularize os encontros que ultrapassam o limite contratual antes de aprovar o acerto.");
        if (atual.exigeAprovacaoRetroatividade && !d.autorizaRetroatividade) throw new ErroRegra("Autorize explicitamente a retroatividade.");
        if (atual.contratos.some(c => c.propostaExcecaoMulta) && !d.autorizaExcecaoMulta) throw new ErroRegra("Autorize explicitamente a exceção de multa.");
      }
      const decisao = await tx.decisaoAcertoEncerramento.create({ data: { rascunhoId: r.id, decisorId: autor.id, aprovada: d.aprovar, motivo: d.motivo, autorizaRetroatividade: d.autorizaRetroatividade, autorizaExcecaoMulta: d.autorizaExcecaoMulta } });
      await registrarEvento(tx, { tipo: "AcertoEncerramentoDecidido", agregadoTipo: "Aluno", agregadoId: d.alunoId, autorId: autor.id, payload: { solicitacaoId: r.solicitacaoId, rascunhoId: r.id, decisaoId: decisao.id, aprovada: d.aprovar } });
      return { id: decisao.id, aprovada: decisao.aprovada, efetivado: false as const };
    });
  });
}
