"use server";

import { revalidatePath } from "next/cache";
import { Papel, type EtapaLead } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessao, exigirPapel, executarAcao, normalizarTelefoneE164, ErroPermissao, ErroRegra, type Resultado } from "@/server/_shared";
import { moverEtapaTx } from "./mover-etapa";
import { possiveisDuplicados, type PossivelDuplicado } from "./pessoas";

const MAX_LOTE = 50;

export async function moverEtapaEmLote(
  ids: string[],
  etapa: EtapaLead,
): Promise<Resultado<{ movidas: string[]; recusadas: { id: string; motivo: string }[] }>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    const unicos = [...new Set(ids)];
    if (unicos.length === 0) throw new ErroRegra("Selecione ao menos uma oportunidade.");
    if (unicos.length > MAX_LOTE) throw new ErroRegra("Selecione no máximo 50 oportunidades.");
    const movidas: string[] = [];
    const recusadas: { id: string; motivo: string }[] = [];
    for (const id of unicos) {
      try {
        await prisma.$transaction((tx) => moverEtapaTx(tx, autor, id, etapa));
        movidas.push(id);
      } catch (e) {
        if (e instanceof ErroRegra || e instanceof ErroPermissao) recusadas.push({ id, motivo: e.message });
        else throw e;
      }
    }
    if (movidas.length > 0) {
      revalidatePath("/funil");
      revalidatePath("/leads");
      revalidatePath("/inbox");
    }
    return { movidas, recusadas };
  });
}

/** Aviso de cadastro existente ao criar oportunidade: roda no escopo de quem digita e não grava nada. */
export async function buscarPossiveisDuplicados(entrada: {
  nome?: string;
  telefone?: string;
  email?: string;
  paisId?: string;
}): Promise<Resultado<PossivelDuplicado[]>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, Papel.VENDEDOR, Papel.GERENTE_COMERCIAL);
    const ddi = entrada.paisId ? ((await prisma.pais.findUnique({ where: { id: entrada.paisId }, select: { ddi: true } }))?.ddi ?? "") : "";
    return possiveisDuplicados(
      { nome: entrada.nome?.trim() || undefined, telefoneE164: normalizarTelefoneE164(entrada.telefone, ddi), email: entrada.email?.trim() || null },
      autor,
    );
  });
}
