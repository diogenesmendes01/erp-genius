"use server";
import { isDeepStrictEqual } from "node:util";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { EntradaRecomposicao } from "./recomposicao-schema";
import { carregarRecomposicaoTx } from "./recomposicao-tx";

export async function decidirRecomposicaoCobertura(input: { alunoId: string; matriculaId: string; rascunhoId: string; aprovar: boolean; motivo: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = z.object({ alunoId: z.string().min(1), matriculaId: z.string().min(1), rascunhoId: z.string().min(1), aprovar: z.boolean(), motivo: z.string().trim().min(5).max(2000) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      await bloquearMatriculas(tx, [d.matriculaId]);
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true, permissoes: true } });
      if (!u?.ativo || (!u.papeis.includes("ADMINISTRADOR") && !(u.papeis.includes("FINANCEIRO") && u.permissoes.includes("financeiro.aprovar_acertos")))) throw new ErroPermissao("A decisão exige permissão de aprovação financeira.");
      const r = await tx.rascunhoRecomposicaoCobertura.findFirst({ where: { id: d.rascunhoId, matriculaId: d.matriculaId, matricula: { alunoId: d.alunoId } }, include: { decisao: true } });
      if (!r) throw new ErroRegra("Rascunho não encontrado para este aluno e matrícula.");
      if (r.preparadorId === autor.id) throw new ErroRegra("Outra pessoa deve decidir a recomposição.");
      if (r.decisao) {
        if (r.decisao.decisorId === autor.id && r.decisao.aprovada === d.aprovar && r.decisao.motivo === d.motivo) return { id: r.decisao.id, aprovada: r.decisao.aprovada };
        throw new ErroRegra("Esta versão já possui decisão registrada.");
      }
      if (d.aprovar) {
        if (await tx.rascunhoRecomposicaoCobertura.count({ where: { matriculaId: d.matriculaId, versao: { gt: r.versao } } })) throw new ErroRegra("Aprove somente a versão mais recente.");
        await tx.$queryRaw`SELECT doc.id FROM "Documento" doc JOIN "Matricula" m ON m."contratoDocumentoId" = doc.id WHERE m.id = ${d.matriculaId} FOR SHARE OF doc`;
        await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE "matriculaId" = ${d.matriculaId} ORDER BY id FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "DiaCompensacaoCobertura" WHERE "matriculaId" = ${d.matriculaId} ORDER BY id FOR UPDATE`;
        const entrada = EntradaRecomposicao.parse(r.entrada);
        if (entrada.matriculaId !== d.matriculaId || entrada.alunoId !== d.alunoId) throw new ErroRegra("Entrada incompatível com a matrícula.");
        const atual = await carregarRecomposicaoTx(tx, entrada);
        if (!isDeepStrictEqual(r.snapshot, atual)) throw new ErroRegra("A origem mudou. Prepare nova versão antes de aprovar.");
      }
      const decisao = await tx.decisaoRecomposicaoCobertura.create({ data: { rascunhoId: r.id, decisorId: autor.id, aprovada: d.aprovar, motivo: d.motivo } });
      await registrarEvento(tx, { tipo: "RecomposicaoDecidida", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId: autor.id, payload: { rascunhoId: r.id, decisaoId: decisao.id, aprovada: d.aprovar, motivo: d.motivo } });
      return { id: decisao.id, aprovada: decisao.aprovada };
    });
  });
}
