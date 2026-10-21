"use server";

import { randomUUID } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, ErroRegra, executarAcao, exigirSessao, exigirSessaoComPapel, registrarEvento } from "@/server/_shared";

const id = z.string().trim().min(1).max(100);
const texto = z.string().trim().min(5).max(4_000);
const instanteUtc = (valor: Date) => Prisma.sql`${valor}::timestamptz AT TIME ZONE 'UTC'`;

const relatar = z.object({ reposicaoId: id, descricao: texto }).strict();
const descartar = z.object({ reposicaoId: id, relatoId: id, motivo: texto }).strict();

const papeisEquipe: Papel[] = [Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR];
const papeisGestao: Papel[] = [Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR];

type MaterialDaReposicao = { materialId: string; matriculaId: string };

async function usuarioFrescoTx(tx: Prisma.TransactionClient, usuarioId: string) {
  const [usuario] = await tx.$queryRaw<Array<{ ativo: boolean; papeis: Papel[] }>>(Prisma.sql`
    SELECT ativo,papeis FROM "Usuario" WHERE id=${usuarioId} FOR SHARE
  `);
  if (!usuario?.ativo) throw new ErroPermissao();
  return usuario;
}

async function materialDisponivelTx(tx: Prisma.TransactionClient, reposicaoId: string): Promise<MaterialDaReposicao> {
  const [material] = await tx.$queryRaw<MaterialDaReposicao[]>(Prisma.sql`
    SELECT material.id AS "materialId",r."matriculaId" AS "matriculaId"
    FROM "MaterialReposicaoGravacao" material
    JOIN "ReposicaoIndividual" r ON r.id=material."reposicaoId"
    JOIN "DecisaoReposicaoIndividual" decisao ON decisao."reposicaoId"=r.id AND decisao.aprovada=true
    WHERE r.id=${reposicaoId} AND r.modalidade='GRAVACAO'::"ModalidadeReposicaoIndividual" AND material.disponivel=true
    FOR UPDATE OF material,r,decisao
  `);
  if (!material) throw new ErroRegra("O material gravado autorizado não está disponível para relato.");
  return material;
}

/** Q57: equipe autorizada ou professor atualmente designado registra apenas o
 * relato. A pausa só existe depois de uma confirmação explícita da gestão. */
export async function registrarRelatoIndisponibilidadeEquipe(input: unknown) {
  return executarAcao(async () => {
    const entrada = relatar.parse(input);
    const autor = await exigirSessao();
    return prisma.$transaction(async (tx) => {
      const fresco = await usuarioFrescoTx(tx, autor.id);
      const material = await materialDisponivelTx(tx, entrada.reposicaoId);
      const equipe = fresco.papeis.some((papel) => papeisEquipe.includes(papel));
      if (!equipe) {
        if (!fresco.papeis.includes(Papel.PROFESSOR)) throw new ErroPermissao();
        const agora = new Date();
        const [designacao] = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT ${entrada.reposicaoId} AS id
          WHERE avaliador_reposicao_vigente(${entrada.reposicaoId}, ${autor.id}, ${instanteUtc(agora)})
        `);
        if (!designacao) throw new ErroPermissao("O professor não possui designação vigente para este material.");
      }
      const agora = new Date(), relatoId = randomUUID();
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "RelatoIndisponibilidadeMaterialReposicao" (id,"materialId","relatadoPorId",descricao,"criadaEm")
        VALUES (${relatoId},${material.materialId},${autor.id},${entrada.descricao},${instanteUtc(agora)})
      `);
      await registrarEvento(tx, {
        tipo: "RelatoIndisponibilidadeMaterialReposicaoRegistradoPelaEquipe",
        agregadoTipo: "Matricula",
        agregadoId: material.matriculaId,
        autorId: autor.id,
        payload: { reposicaoId: entrada.reposicaoId, relatoId, origem: equipe ? "EQUIPE" : "PROFESSOR" },
      });
      return { id: relatoId, criadaEm: agora.toISOString() };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  });
}

/** Q57: descartar conserva o relato e a razão no Evento. Não cria
 * indisponibilidade, não pausa prazo e só aceita a transição ABERTO→DESCARTADO. */
export async function descartarRelatoIndisponibilidadeEquipe(input: unknown) {
  return executarAcao(async () => {
    const entrada = descartar.parse(input);
    const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    return prisma.$transaction(async (tx) => {
      const fresco = await usuarioFrescoTx(tx, autor.id);
      if (!fresco.papeis.some((papel) => papeisGestao.includes(papel))) throw new ErroPermissao();
      const [relato] = await tx.$queryRaw<Array<{ matriculaId: string }>>(Prisma.sql`
        SELECT r."matriculaId" AS "matriculaId"
        FROM "RelatoIndisponibilidadeMaterialReposicao" relato
        JOIN "MaterialReposicaoGravacao" material ON material.id=relato."materialId"
        JOIN "ReposicaoIndividual" r ON r.id=material."reposicaoId"
        WHERE relato.id=${entrada.relatoId} AND r.id=${entrada.reposicaoId} AND relato.situacao='ABERTO'
        FOR UPDATE OF relato,material,r
      `);
      if (!relato) throw new ErroRegra("O relato não está aberto nesta reposição.");
      const alterados = await tx.$executeRaw(Prisma.sql`
        UPDATE "RelatoIndisponibilidadeMaterialReposicao" SET situacao='DESCARTADO'
        WHERE id=${entrada.relatoId} AND situacao='ABERTO'
      `);
      if (alterados !== 1) throw new ErroRegra("O relato mudou; atualize antes de decidir.");
      await registrarEvento(tx, {
        tipo: "RelatoIndisponibilidadeMaterialReposicaoDescartado",
        agregadoTipo: "Matricula",
        agregadoId: relato.matriculaId,
        autorId: autor.id,
        payload: { reposicaoId: entrada.reposicaoId, relatoId: entrada.relatoId, situacao: "DESCARTADO", motivo: entrada.motivo },
      });
      return { id: entrada.relatoId, situacao: "DESCARTADO" as const };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  });
}
