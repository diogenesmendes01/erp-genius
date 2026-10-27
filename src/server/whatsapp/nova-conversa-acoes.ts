"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/server/_shared/sessao";
import { executarAcao, type Resultado } from "@/server/_shared/resultado";
import { EntradaNovaConversaSchema } from "./nova-conversa-entrada";
import { criarRamoNovoConversaTx } from "./nova-conversa-novo";
import { abrirRamoExistenteConversaTx } from "./nova-conversa-existente";

export async function iniciarConversaPorNumero(input: unknown): Promise<Resultado<{ atendimentoId: string; criado: boolean }>> {
 return executarAcao(async () => {
  const autor = await exigirSessao();
  const { modo, ...dados } = EntradaNovaConversaSchema.parse(input);
  const resultado = await prisma.$transaction(async tx => {
   const entrada = { ...dados, autorId: autor.id };
   if (modo === "NOVO" && "ownerId" in entrada) return criarRamoNovoConversaTx(tx, entrada);
   return abrirRamoExistenteConversaTx(tx, entrada);
  });
  revalidatePath("/inbox");
  return { atendimentoId: resultado.atendimentoId, criado: resultado.criado };
 });
}