"use server";

import { z } from "zod";
import { Papel } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";

const CoberturaSchema = z.object({ titularId: z.string().min(1), substitutoId: z.string().min(1), inicio: z.coerce.date(), fim: z.coerce.date(), motivo: z.string().trim().min(5).max(1000) })
  .refine((d) => d.fim > d.inicio && d.fim > new Date(), "Informe um período válido que termine no futuro.")
  .refine((d) => d.titularId !== d.substitutoId, "Escolha duas pessoas diferentes.");

export async function concederCobertura(input: { titularId: string; substitutoId: string; inicio: string; fim: string; motivo: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_COMERCIAL);
    const dados = CoberturaSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      const usuarios = await tx.usuario.findMany({ where: { id: { in: [dados.titularId, dados.substitutoId] }, ativo: true, papeis: { has: Papel.VENDEDOR } }, select: { id: true, gerenteComercialId: true } });
      if (usuarios.length !== 2) throw new ErroRegra("Titular e substituto precisam ser vendedores ativos.");
      if (!autor.papeis.includes(Papel.ADMINISTRADOR) && usuarios.some((u) => u.gerenteComercialId !== autor.id)) throw new ErroPermissao("A cobertura deve envolver vendedores da sua equipe.");
      const cobertura = await tx.coberturaCarteira.create({ data: { ...dados, concedenteId: autor.id } });
      await registrarEvento(tx, { tipo: "CoberturaConcedida", agregadoTipo: "CoberturaCarteira", agregadoId: cobertura.id, autorId: autor.id, payload: { ...dados, inicio: dados.inicio.toISOString(), fim: dados.fim.toISOString() } });
    });
    revalidatePath("/carteiras");
  });
}

export async function revogarCobertura(id: string) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_COMERCIAL);
    await prisma.$transaction(async (tx) => {
      const atual = await tx.coberturaCarteira.findUnique({ where: { id }, include: { titular: { select: { gerenteComercialId: true } }, substituto: { select: { gerenteComercialId: true } } } });
      if (!atual) throw new ErroRegra("Cobertura não encontrada.");
      if (!autor.papeis.includes(Papel.ADMINISTRADOR) && (atual.titular.gerenteComercialId !== autor.id || atual.substituto.gerenteComercialId !== autor.id)) throw new ErroPermissao();
      if (atual.revogadaEm) return;
      await tx.coberturaCarteira.update({ where: { id }, data: { revogadaEm: new Date() } });
      await registrarEvento(tx, { tipo: "CoberturaRevogada", agregadoTipo: "CoberturaCarteira", agregadoId: id, autorId: autor.id });
    });
    revalidatePath("/carteiras");
  });
}
