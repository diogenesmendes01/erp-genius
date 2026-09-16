"use server";

import { randomUUID } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento } from "@/server/_shared";

const texto = z.string().trim().min(5).max(4_000);
const instanteUtc = (valor: Date) => Prisma.sql`${valor}::timestamptz AT TIME ZONE 'UTC'`;
const pedidoCorrecao = z.object({ reposicaoId: z.string().min(1), entregaId: z.string().min(1), comentario: texto }).strict();

/** Q13/Q35/Q52: o docente designado pede correção sem concluir a reposição,
 * preservando a entrega original. O prazo é próprio da resposta e não muda a
 * data de disponibilidade do material. */
export async function solicitarCorrecaoEntregaReposicao(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.PROFESSOR);
    const entrada = pedidoCorrecao.parse(input);
    return prisma.$transaction(async (tx) => {
      const agora = new Date();
      const [fresco] = await tx.$queryRaw<Array<{ ativo: boolean; papeis: Papel[] }>>(Prisma.sql`SELECT ativo, papeis FROM "Usuario" WHERE id = ${autor.id} FOR SHARE`);
      if (!fresco?.ativo || !fresco.papeis.includes(Papel.PROFESSOR)) throw new ErroPermissao();
      const [linha] = await tx.$queryRaw<Array<{ matriculaId: string; modalidade: string; entregaId: string; concluida: boolean }>>(Prisma.sql`
        SELECT r."matriculaId" AS "matriculaId", r.modalidade::text AS modalidade, e.id AS "entregaId",
          EXISTS (SELECT 1 FROM "ConclusaoReposicaoIndividual" c WHERE c."entregaId" = e.id) AS concluida
        FROM "ReposicaoIndividual" r
        JOIN "EntregaReposicaoGravacao" e ON e.id = ${entrada.entregaId} AND e."reposicaoId" = r.id
        WHERE r.id = ${entrada.reposicaoId} FOR UPDATE OF r, e
      `);
      const [designacao] = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT d.id FROM "DesignacaoAvaliadorReposicaoIndividual" d
        WHERE d."reposicaoId" = ${entrada.reposicaoId} AND d."professorId" = ${autor.id}
          AND d.inicio <= ${instanteUtc(agora)} AND (d.fim IS NULL OR d.fim > ${instanteUtc(agora)})
        FOR SHARE
      `);
      const [configuracao] = await tx.$queryRaw<Array<{ prazoRespostaCorrecaoReposicaoMinutos: number | null }>>(Prisma.sql`
        SELECT "prazoRespostaCorrecaoReposicaoMinutos" FROM "ConfiguracaoOperacional" WHERE id = 'escola' FOR SHARE
      `);
      const prazoMinutos = configuracao?.prazoRespostaCorrecaoReposicaoMinutos;
      if (!linha || linha.modalidade !== "GRAVACAO" || linha.concluida || !designacao) throw new ErroPermissao("A entrega não está disponível para correção por este professor.");
      if (!Number.isSafeInteger(prazoMinutos) || !prazoMinutos || prazoMinutos < 1) throw new ErroRegra("Configure o prazo de resposta à correção antes de solicitá-la.");
      const [pendente] = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM "SolicitacaoCorrecaoEntregaReposicao" WHERE "reposicaoId" = ${entrada.reposicaoId} AND situacao = 'PENDENTE' FOR UPDATE
      `);
      if (pendente) throw new ErroRegra("Já existe uma correção pendente para esta reposição.");
      const prazoAte = new Date(agora.getTime() + prazoMinutos * 60_000), id = randomUUID();
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "SolicitacaoCorrecaoEntregaReposicao"
          (id, "reposicaoId", "entregaId", "solicitadaPorId", comentario, "prazoBaseMinutos", "prazoAte")
        VALUES (${id}, ${entrada.reposicaoId}, ${entrada.entregaId}, ${autor.id}, ${entrada.comentario}, ${prazoMinutos}, ${instanteUtc(prazoAte)})
      `);
      await registrarEvento(tx, { tipo: "CorrecaoEntregaReposicaoSolicitada", agregadoTipo: "Matricula", agregadoId: linha.matriculaId, autorId: autor.id,
        payload: { reposicaoId: entrada.reposicaoId, entregaId: entrada.entregaId, solicitacaoCorrecaoId: id, prazoAte: prazoAte.toISOString() } });
      return { id, prazoAte: prazoAte.toISOString() };
    });
  });
}
