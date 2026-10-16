"use server";

import { revalidatePath } from "next/cache";
import { type EtapaLead } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessao, executarAcao, ErroPermissao, ErroRegra, type Resultado } from "@/server/_shared";
import { moverEtapaTx } from "./mover-etapa";

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
