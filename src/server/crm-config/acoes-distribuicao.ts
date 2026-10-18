"use server";

import { revalidatePath } from "next/cache";
import type { Resultado } from "@/server/_shared";
import { salvarDistribuicaoSetor } from "./distribuicao";
import { salvarSlaSetor } from "./sla";

// Fronteira de Server Action para a tela (distribuicao.ts não é "use server" porque exporta função pura).
export async function salvarDistribuicaoDaTela(i: Parameters<typeof salvarDistribuicaoSetor>[0]): Promise<Resultado> {
  const r = await salvarDistribuicaoSetor(i);
  revalidatePath("/configuracao/crm/distribuicao");
  return r;
}

export async function salvarSlaDaTela(i: Parameters<typeof salvarSlaSetor>[0]): Promise<Resultado> {
  const r = await salvarSlaSetor(i);
  revalidatePath("/configuracao/crm/distribuicao");
  return r;
}
