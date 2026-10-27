import type { Prisma, TipoTemplate } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const ONDE_MODELO_REGUA = { tipo: "MODELO_AUTOMACAO" } as const satisfies Prisma.TemplateWhatsAppWhereInput;

export function ehModeloRegua<T extends { tipo: TipoTemplate }>(t: T | null | undefined): t is T {
  return t?.tipo === ONDE_MODELO_REGUA.tipo;
}

export function modelosDasReguas() {
  return prisma.templateWhatsApp.findMany({ where: ONDE_MODELO_REGUA, orderBy: { nome: "asc" } });
}
