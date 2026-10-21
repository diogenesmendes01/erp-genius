// Sobe (ou derruba) o Postgres de TESTE dos testes de integração — porta 54329,
// banco erp_genius_test, dados em .testdb/ (gitignored). Sem docker/WSL/admin:
// usa os binários do pacote `embedded-postgres` (devDependency) via pg_ctl, que
// daemoniza de verdade (o banco segue vivo depois que este script termina).
// Uso: node scripts/test-db.mjs [start|stop]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const raiz = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(raiz, ".testdb");
// Fora de PGDATA: o Windows bloqueia o log aberto durante o fsync de recuperação.
const logDir = path.join(raiz, "node_modules", ".cache", "erp-genius-tests");
const logFile = path.join(logDir, "postgres.log");
const PORTA = "54329";

// Binários nativos instalados pelo embedded-postgres (plataforma-específicos).
// Caminho direto em node_modules: o package.json deles usa `exports` e bloqueia resolve.
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
  // O postgres daemonizado pode herdar o pipe no Windows e impedir o encerramento
  // do pai mesmo depois de pg_ctl sair. A partida já grava diagnóstico em -l.
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

// O pacote Windows não fornece createdb.exe. A conexão é fixa no cluster descartável,
// nunca na DATABASE_URL do ambiente ou da aplicação.
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
