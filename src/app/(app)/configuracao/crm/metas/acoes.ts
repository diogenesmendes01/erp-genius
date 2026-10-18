"use server";

import type { MetricaMeta } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { salvarMeta } from "@/server/metas/metas";

const ROTA = "/configuracao/crm/metas";

/** Salva a meta do formulário e volta para a tela com o retorno na URL (`?erro=` ou `?salvo=1`). */
export async function definirMeta(formData: FormData): Promise<void> {
  const usuario = String(formData.get("usuarioId") ?? "");
  const r = await salvarMeta({
    competencia: String(formData.get("competencia") ?? ""),
    usuarioId: usuario === "" ? null : usuario,
    metrica: String(formData.get("metrica") ?? "") as MetricaMeta,
    valor: Number(String(formData.get("valor") ?? "").replace(",", ".")),
    moeda: String(formData.get("moeda") ?? "") || undefined,
  });
  if (!r.ok) redirect(`${ROTA}?${new URLSearchParams({ erro: r.erro })}`);
  revalidatePath(ROTA);
  redirect(`${ROTA}?salvo=1`);
}
