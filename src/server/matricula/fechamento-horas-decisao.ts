"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { revalidarFechamentoHorasTx } from "./fechamento-horas-revalidacao-tx";

const Entrada = z.object({ alunoId: z.string().min(1), matriculaId: z.string().min(1), rascunhoId: z.string().min(1),
  aprovar: z.boolean(), confirmaReferenciaContratual: z.boolean(), motivo: z.string().trim().min(5).max(2000) }).strict();

export async function decidirFechamentoHoras(input: z.input<typeof Entrada>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO), d = Entrada.parse(input);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola',0))`;
      await bloquearMatriculas(tx, [d.matriculaId]);
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${autor.id} FOR SHARE`;
      const u = await tx.usuario.findUnique({ where: { id: autor.id } });
      if (!u?.ativo || !(u.papeis.includes(Papel.ADMINISTRADOR) || (u.papeis.includes(Papel.FINANCEIRO) && u.permissoes.includes("financeiro.aprovar_acertos")))) throw new ErroPermissao();
      const r = await tx.rascunhoFechamentoHoras.findFirst({ where: { id: d.rascunhoId, matriculaId: d.matriculaId, matricula: { alunoId: d.alunoId } }, include: { decisao: true } });
      if (!r) throw new ErroRegra("Fechamento não encontrado para este aluno.");
      if (r.preparadorId === autor.id) throw new ErroRegra("Outra pessoa deve decidir o fechamento.");
      if (r.decisao) {
        const anterior = r.decisao;
        if (anterior.decisorId !== autor.id || anterior.aprovada !== d.aprovar || anterior.confirmaReferenciaContratual !== d.confirmaReferenciaContratual || anterior.motivo !== d.motivo) throw new ErroRegra("Esta versão já tem decisão.");
        return { id: anterior.id, aprovada: anterior.aprovada, emiteCobranca: false as const };
      }
      if (d.aprovar) {
        if (!d.confirmaReferenciaContratual) throw new ErroRegra("Confira explicitamente a referência, o período e o vencimento no contrato.");
        await revalidarFechamentoHorasTx(tx, d);
      }
      const decisao = await tx.decisaoFechamentoHoras.create({ data: { rascunhoId: r.id, decisorId: autor.id,
        aprovada: d.aprovar, confirmaReferenciaContratual: d.confirmaReferenciaContratual, motivo: d.motivo } });
      await registrarEvento(tx, { tipo: "FechamentoHorasDecidido", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId: autor.id,
        payload: { rascunhoId: r.id, decisaoId: decisao.id, aprovada: d.aprovar } });
      return { id: decisao.id, aprovada: decisao.aprovada, emiteCobranca: false as const };
    });
  });
}
