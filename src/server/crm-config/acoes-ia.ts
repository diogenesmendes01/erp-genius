"use server";

import { revalidatePath } from "next/cache";
import type { Resultado } from "@/server/_shared";
import { salvarConfigIA } from "./ia";

export async function salvarConfigIADaTela(i: Parameters<typeof salvarConfigIA>[0]): Promise<Resultado> {
  const r = await salvarConfigIA(i);
  revalidatePath("/configuracao/crm/ia");
  return r;
}
