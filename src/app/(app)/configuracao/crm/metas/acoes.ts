"use server";

import type { MetricaMeta } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { copiarMetasMesAnterior, salvarMeta } from "@/server/metas/metas";

const ROTA = "/configuracao/crm/metas";
const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

function voltar(competencia: string, extra: Record<string, string>) {
  const q = new URLSearchParams();
  if (COMPETENCIA.test(competencia)) q.set("competencia", competencia);
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  return `${ROTA}?${q}`;
}

export async function definirMeta(formData: FormData): Promise<void> {
  const usuario = String(formData.get("usuarioId") ?? "");
  const competencia = String(formData.get("competencia") ?? "");
  const r = await salvarMeta({
    competencia,
    usuarioId: usuario === "" ? null : usuario,
    metrica: String(formData.get("metrica") ?? "") as MetricaMeta,
    valor: Number(String(formData.get("valor") ?? "").replace(",", ".")),
    moeda: String(formData.get("moeda") ?? "") || undefined,
  });
  if (!r.ok) redirect(voltar(competencia, { erro: r.erro }));
  revalidatePath(ROTA);
  redirect(voltar(competencia, { salvo: "1" }));
}

export async function copiarMetasAnteriores(formData: FormData): Promise<void> {
  const competencia = String(formData.get("competencia") ?? "");
  const r = await copiarMetasMesAnterior(competencia);
  if (!r.ok) redirect(voltar(competencia, { erro: r.erro }));
  revalidatePath(ROTA);
  redirect(voltar(competencia, { copiadas: String(r.dado?.copiadas ?? 0) }));
}
