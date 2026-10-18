"use server";

import { revalidatePath } from "next/cache";
import type { Resultado } from "@/server/_shared";
import { arquivarCampo, arquivarTag, salvarCampo, salvarTag } from "./tags-campos";

// Fronteira de Server Action para a tela (tags-campos.ts exporta função pura).
const ROTA = "/configuracao/crm/tags-campos";

export async function salvarTagDaTela(i: Parameters<typeof salvarTag>[0]): Promise<Resultado<{ id: string }>> {
  const r = await salvarTag(i);
  revalidatePath(ROTA);
  return r;
}
export async function arquivarTagDaTela(id: string): Promise<Resultado> {
  const r = await arquivarTag(id);
  revalidatePath(ROTA);
  return r;
}
export async function salvarCampoDaTela(i: Parameters<typeof salvarCampo>[0]): Promise<Resultado<{ id: string }>> {
  const r = await salvarCampo(i);
  revalidatePath(ROTA);
  return r;
}
export async function arquivarCampoDaTela(id: string, confirmacao: string): Promise<Resultado> {
  const r = await arquivarCampo(id, confirmacao);
  revalidatePath(ROTA);
  return r;
}
