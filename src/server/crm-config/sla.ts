"use server";

import { z } from "zod";
import type { FinalidadeAtendimentoWhatsApp } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { executarAcao, registrarEvento, type Resultado } from "@/server/_shared";
import { SETORES } from "@/server/whatsapp/setor";
import { exigirEdicaoDoSetor } from "./distribuicao";

const SlaSchema = z.object({
  finalidade: z.enum(SETORES as unknown as [FinalidadeAtendimentoWhatsApp, ...FinalidadeAtendimentoWhatsApp[]]),
  prazoPrimeiraRespostaMin: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(120), z.literal(240)]),
  alertarResponsavel: z.boolean(),
  alertarGerente: z.boolean(),
  contarSoNoHorario: z.boolean(),
});

export async function salvarSlaSetor(i: { finalidade: FinalidadeAtendimentoWhatsApp; prazoPrimeiraRespostaMin: 15 | 30 | 60 | 120 | 240; alertarResponsavel: boolean; alertarGerente: boolean; contarSoNoHorario: boolean }): Promise<Resultado> {
  return executarAcao(async () => {
    const dados = SlaSchema.parse(i);
    const autor = await exigirEdicaoDoSetor(dados.finalidade);
    await prisma.$transaction(async (tx) => {
      const antes = await tx.prazoRespostaSetor.findUnique({ where: { finalidade: dados.finalidade }, select: { minutos: true, alertarResponsavel: true, alertarGerente: true, contarSoNoHorario: true } });
      const campos = { minutos: dados.prazoPrimeiraRespostaMin, alertarResponsavel: dados.alertarResponsavel, alertarGerente: dados.alertarGerente, contarSoNoHorario: dados.contarSoNoHorario };
      await tx.prazoRespostaSetor.upsert({ where: { finalidade: dados.finalidade }, create: { finalidade: dados.finalidade, ...campos }, update: campos });
      await registrarEvento(tx, { tipo: "SlaAlterado", agregadoTipo: "ConfigSetorAtendimento", agregadoId: dados.finalidade, autorId: autor.id, payload: { finalidade: dados.finalidade, de: antes ?? null, para: campos } });
    });
    return undefined;
  });
}
