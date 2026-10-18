import { prisma } from "@/lib/prisma";

/** Modelos de automação (réguas, avisos). Respostas rápidas do Inbox (`tipo = RESPOSTA_RAPIDA`) ficam de fora. */
export function modelosDasReguas() {
  return prisma.templateWhatsApp.findMany({ where: { tipo: "MODELO_AUTOMACAO" }, orderBy: { nome: "asc" } });
}
