import { PrismaClient } from "@prisma/client";
import { resolverBancoTeste } from "./test-profile.mjs";

const { banco, perfil } = resolverBancoTeste();
const admin = new PrismaClient({ datasources: { db: { url: "postgres://postgres:teste@localhost:54329/postgres" } } });
try {
  const existente = await admin.$queryRaw`SELECT datname FROM pg_database WHERE datname = ${banco}`;
  // O identificador vem exclusivamente da lista fechada do resolvedor.
  if (!existente.length) await admin.$executeRawUnsafe(`CREATE DATABASE "${banco}"`);
  console.log(`Banco descartável preparado: ${perfil} / ${banco}`);
} finally { await admin.$disconnect(); }
