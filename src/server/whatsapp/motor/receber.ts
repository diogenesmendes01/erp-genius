import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { EnvelopeMotor } from "./eventos";

/** Grava o evento na tabela de entrada. Dedupe por idEvento: repetido → "duplicado". */
export async function registrarEventoMotor(env: EnvelopeMotor): Promise<"novo" | "duplicado"> {
  try {
    await prisma.eventoMotorRecebido.create({
      data: {
        idEvento: env.idEvento,
        tipo: env.tipo,
        numeroRef: env.numeroId,
        ocorridoEm: new Date(env.ocorridoEm),
        dados: (env.dados ?? {}) as Prisma.InputJsonValue,
      },
    });
    return "novo";
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "duplicado";
    throw e;
  }
}
