"use server";

import { Papel } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, registrarEvento } from "@/server/_shared";
import { exigirPrazosPortalAluno } from "./politica";

const prazo = z.number().int().positive().max(525600);
const schema = z.object({ prazoSessaoPortalAlunoMinutos: prazo, prazoConvitePortalAlunoMinutos: prazo,
  prazoRecuperacaoPortalAlunoMinutos: prazo, prazoValidacaoEmailPortalAlunoMinutos: prazo }).strict();
const schemaEntrega = z.object({ prazoPrimeiraEntregaReposicaoMinutos: prazo, prazoRespostaCorrecaoReposicaoMinutos: prazo }).strict();

export async function salvarPrazosPortalAluno(input: z.input<typeof schema>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = schema.parse(input);
    exigirPrazosPortalAluno(dados);
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(739204)`;
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${autor.id} FOR SHARE`;
      const atual = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!atual?.ativo || !atual.papeis.includes(Papel.ADMINISTRADOR)) throw new ErroPermissao();
      const anterior = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: {
        prazoSessaoPortalAlunoMinutos: true, prazoConvitePortalAlunoMinutos: true,
        prazoRecuperacaoPortalAlunoMinutos: true, prazoValidacaoEmailPortalAlunoMinutos: true,
      } });
      await tx.configuracaoOperacional.upsert({ where: { id: "escola" }, create: { id: "escola", ...dados, alteradaPorId: autor.id }, update: { ...dados, alteradaPorId: autor.id } });
      await registrarEvento(tx, { tipo: "PrazosPortalAlunoConfigurados", agregadoTipo: "ConfiguracaoOperacional", agregadoId: "escola", autorId: autor.id,
        payload: { de: anterior, para: dados } });
    });
    revalidatePath("/configuracao/operacao");
  });
}

/** Q35: os dois prazos são configurados juntos, sem número implícito. Cada
 * disponibilização/correção copia o valor então vigente para o seu histórico. */
export async function salvarPrazosEntregaReposicao(input: z.input<typeof schemaEntrega>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = schemaEntrega.parse(input);
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(739204)`;
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${autor.id} FOR SHARE`;
      const atual = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!atual?.ativo || !atual.papeis.includes(Papel.ADMINISTRADOR)) throw new ErroPermissao();
      const anterior = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: {
        prazoPrimeiraEntregaReposicaoMinutos: true, prazoRespostaCorrecaoReposicaoMinutos: true,
      } });
      await tx.configuracaoOperacional.upsert({ where: { id: "escola" }, create: { id: "escola", ...dados, alteradaPorId: autor.id }, update: { ...dados, alteradaPorId: autor.id } });
      await registrarEvento(tx, { tipo: "PrazosEntregaReposicaoConfigurados", agregadoTipo: "ConfiguracaoOperacional", agregadoId: "escola", autorId: autor.id,
        payload: { de: anterior, para: dados } });
    });
    revalidatePath("/configuracao/operacao");
  });
}
