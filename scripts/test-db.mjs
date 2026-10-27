import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const raiz = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(raiz, ".testdb");
const logDir = path.join(raiz, "node_modules", ".cache", "erp-genius-tests");
const logFile = path.join(logDir, "postgres.log");
const PORTA = "54329";

const binDir = (() => {
  const plataformas = ["windows-x64", "darwin-arm64", "darwin-x64", "linux-x64", "linux-arm64"];
  for (const p of plataformas) {
    const dir = path.join(raiz, "node_modules", "@embedded-postgres", p, "native", "bin");
    if (existsSync(dir)) return dir;
  }
  throw new Error("Binários do embedded-postgres não encontrados. Rode: npm install");
})();

const bin = (nome) => path.join(binDir, process.platform === "win32" ? `${nome}.exe` : nome);
const rodar = (nome, args) => {
  const resultado = execFileSync(bin(nome), args, {
    stdio: nome === "pg_ctl" && args[0] === "start" ? "ignore" : "pipe",
    windowsHide: true,
    timeout: 60000,
  });
  return resultado?.toString() ?? "";
};

const acao = process.argv[2] ?? "start";

if (acao === "stop") {
  if (existsSync(path.join(dataDir, "postmaster.pid"))) {
    rodar("pg_ctl", ["stop", "-D", dataDir, "-m", "fast"]);
    console.log("Postgres de teste parado.");
  } else {
    console.log("Postgres de teste já estava parado.");
  }
  process.exit(0);
}

if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
  console.log("Inicializando o cluster de teste em .testdb/ ...");
  rodar("initdb", ["-D", dataDir, "-U", "postgres", "-A", "trust", "-E", "UTF8"]);
}

try {
  rodar("pg_ctl", ["status", "-D", dataDir]);
  console.log(`Postgres de teste já está de pé na porta ${PORTA}.`);
} catch {
  mkdirSync(logDir, { recursive: true });
  writeFileSync(logFile, "", { flag: "a" });
  rodar("pg_ctl", ["start", "-D", dataDir, "-l", logFile, "-o", `-p ${PORTA}`, "-w"]);
  console.log(`Postgres de teste iniciado na porta ${PORTA} (log: ${path.relative(raiz, logFile)}).`);
}

const adminTeste = new PrismaClient({ datasources: { db: { url: `postgresql://postgres:teste@localhost:${PORTA}/postgres` } } });
try {
  const bancos = await adminTeste.$queryRaw`SELECT datname FROM pg_database WHERE datname = 'erp_genius_test'`;
  if (bancos.length === 0) {
    await adminTeste.$executeRawUnsafe('CREATE DATABASE "erp_genius_test"');
    console.log("Banco erp_genius_test criado.");
  } else console.log("Banco erp_genius_test já existia.");
} finally {
  await adminTeste.$disconnect();
}
