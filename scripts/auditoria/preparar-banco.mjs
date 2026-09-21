// Apenas cria o banco local DESCARTAVEL da auditoria. Nao le DATABASE_URL do ambiente.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ datasources: { db: { url: 'postgresql://postgres:teste@localhost:54329/postgres' } } });
async function main() {
  const bancos = await prisma.$queryRawUnsafe("SELECT datname FROM pg_database WHERE datname = 'erp_genius_test'");
  if (bancos.length === 0) await prisma.$executeRawUnsafe('CREATE DATABASE "erp_genius_test"');
  console.log('Banco descartavel erp_genius_test preparado em localhost:54329.');
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
