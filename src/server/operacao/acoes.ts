"use server";

import { z } from "zod";
import { Papel } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, registrarEvento, ErroRegra, ErroPermissao } from "@/server/_shared";
import { FusoInstitucionalSchema } from "./fuso";

const Schema = z.object({ prazoReservaMinutos: z.number().int().positive().max(2147483647).nullable().optional(), exigirPrimeiraMensalidade: z.boolean(), prazoConferenciaHoras: z.coerce.number().int().min(1).max(720), fusoInstitucional: FusoInstitucionalSchema.optional() });

export async function salvarConfiguracaoOperacional(input: z.input<typeof Schema>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = Schema.parse(input);
    await prisma.$transaction(async (tx) => {
      // Serializa a criação inicial e alterações concorrentes do singleton.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(739204)::text`;
      const usuarioAtual = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!usuarioAtual?.ativo || !usuarioAtual.papeis.includes(Papel.ADMINISTRADOR)) throw new ErroPermissao();
      const anterior = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" } });
      if (dados.fusoInstitucional && anterior?.fusoInstitucional && dados.fusoInstitucional !== anterior.fusoInstitucional && (
        await tx.propostaPausaMatriculas.count({ where: { status: "APLICADA" } }) || await tx.propostaRetomadaMatriculas.count({ where: { status: "APLICADA" } })
      )) throw new ErroRegra("Alterar o fuso com movimentações aplicadas exige revisão dos impactos temporais; o histórico não pode ser reinterpretado por esta configuração.");
      await tx.configuracaoOperacional.upsert({ where: { id: "escola" }, create: { id: "escola", ...dados, alteradaPorId: autor.id }, update: { ...dados, alteradaPorId: autor.id } });
      await registrarEvento(tx, { tipo: "ConfiguracaoOperacionalAlterada", agregadoTipo: "ConfiguracaoOperacional", agregadoId: "escola", autorId: autor.id,
        payload: { de: { prazoReservaMinutos: anterior?.prazoReservaMinutos ?? null, exigirPrimeiraMensalidade: anterior?.exigirPrimeiraMensalidade ?? false, prazoConferenciaHoras: anterior?.prazoConferenciaHoras ?? 48, fusoInstitucional: anterior?.fusoInstitucional ?? null }, para: { ...dados, prazoReservaMinutos: dados.prazoReservaMinutos !== undefined ? dados.prazoReservaMinutos : anterior?.prazoReservaMinutos ?? null, fusoInstitucional: dados.fusoInstitucional ?? anterior?.fusoInstitucional ?? null } } });
    });
    revalidatePath("/configuracao/operacao");
    revalidatePath("/secretaria");
  });
}

