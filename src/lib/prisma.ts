import { PrismaClient } from "@prisma/client";
import { protegerTransacoes } from "./transacao-confirmada";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  protegerTransacoes(globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  }));

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
