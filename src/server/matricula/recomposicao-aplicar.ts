"use server";
import { isDeepStrictEqual } from "node:util";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { EntradaRecomposicao } from "./recomposicao-schema";
import { carregarRecomposicaoTx } from "./recomposicao-tx";

export async function aplicarRecomposicaoCobertura(input: { alunoId: string; matriculaId: string; decisaoId: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = z.object({ alunoId: z.string().min(1), matriculaId: z.string().min(1), decisaoId: z.string().min(1) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      await bloquearMatriculas(tx, [d.matriculaId]);
      const usuario = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!usuario?.ativo || !usuario.papeis.some((p) => p === "ADMINISTRADOR" || p === "FINANCEIRO")) throw new ErroPermissao();
      const decisao = await tx.decisaoRecomposicaoCobertura.findFirst({ where: { id: d.decisaoId, rascunho: { matriculaId: d.matriculaId, matricula: { alunoId: d.alunoId } } }, include: { rascunho: true, aplicacao: true } });
      if (!decisao?.aprovada) throw new ErroRegra("É necessária uma decisão aprovada para esta matrícula.");
      if (decisao.aplicacao) return { id: decisao.aplicacao.id, aplicada: true as const };
      const r = decisao.rascunho;
      if (await tx.rascunhoRecomposicaoCobertura.count({ where: { matriculaId: d.matriculaId, versao: { gt: r.versao } } })) throw new ErroRegra("Existe revisão posterior; confira a decisão vigente.");
      await tx.$queryRaw`SELECT doc.id FROM "Documento" doc JOIN "Matricula" m ON m."contratoDocumentoId" = doc.id WHERE m.id = ${d.matriculaId} FOR SHARE OF doc`;
      await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE "matriculaId" = ${d.matriculaId} ORDER BY id FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "DiaCompensacaoCobertura" WHERE "matriculaId" = ${d.matriculaId} ORDER BY id FOR UPDATE`;
      const entrada = EntradaRecomposicao.parse(r.entrada);
      if (entrada.matriculaId !== d.matriculaId || entrada.alunoId !== d.alunoId) throw new ErroRegra("Entrada incompatível com a matrícula.");
      const atual = await carregarRecomposicaoTx(tx, entrada);
      if (!isDeepStrictEqual(atual, r.snapshot)) throw new ErroRegra("Origem alterada após a conferência; prepare e aprove nova versão.");
      if (await tx.diaProgramadoRecomposicao.count({ where: { direitoId: { in: entrada.direitosIds } } })) throw new ErroRegra("Um direito já possui cobertura programada.");
      const aplicacao = await tx.aplicacaoRecomposicaoCobertura.create({ data: { decisaoId: decisao.id, executorId: autor.id } });
      for (const periodo of atual.proposta.periodos.filter((p) => p.alterado)) {
        const alteradas = await tx.cobranca.updateMany({ where: { id: periodo.cobrancaId, matriculaId: d.matriculaId, versao: periodo.versao }, data: {
          coberturaInicio: new Date(`${periodo.cobertura.inicio}T00:00:00Z`), coberturaFim: new Date(`${periodo.cobertura.fim}T00:00:00Z`), versao: { increment: 1 },
        } });
        if (alteradas.count !== 1) throw new ErroRegra("Cobrança alterada durante a aplicação.");
      }
      await tx.diaProgramadoRecomposicao.createMany({ data: atual.proposta.destinos.map((dia) => ({ aplicacaoId: aplicacao.id, direitoId: dia.id, dataCobertura: new Date(`${dia.diaCompensadoProposto}T00:00:00Z`) })) });
      await registrarEvento(tx, { tipo: "RecomposicaoCoberturaProgramada", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId: autor.id, payload: { aplicacaoId: aplicacao.id, decisaoId: decisao.id, rascunhoId: r.id, dias: atual.proposta.destinos } });
      return { id: aplicacao.id, aplicada: true as const };
    });
  });
}
