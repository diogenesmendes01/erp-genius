"use server";

import { revalidatePath } from "next/cache";
import { exigirSessao, type Resultado } from "@/server/_shared";
import { arquivarRespostaRapida, listarRespostasRapidas, salvarRespostaRapida } from "./respostas-rapidas";

const ROTA = "/configuracao/crm/respostas";

export async function salvarRespostaRapidaDaTela(i: Parameters<typeof salvarRespostaRapida>[0]): Promise<Resultado<{ id: string }>> {
  const r = await salvarRespostaRapida(i);
  revalidatePath(ROTA);
  return r;
}
export async function arquivarRespostaRapidaDaTela(id: string): Promise<Resultado> {
  const r = await arquivarRespostaRapida(id);
  revalidatePath(ROTA);
  return r;
}
export async function respostasRapidasDoCompositor() {
  const u = await exigirSessao();
  return (await listarRespostasRapidas(u)).map(({ id, atalho, titulo, corpo }) => ({ id, atalho, titulo, corpo }));
}
