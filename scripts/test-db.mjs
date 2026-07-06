// Sobe (ou derruba) o Postgres de TESTE dos testes de integração — porta 54329,
// banco erp_genius_test, dados em .testdb/ (gitignored). Sem docker/WSL/admin:
// usa os binários do pacote `embedded-postgres` (devDependency) via pg_ctl, que
// daemoniza de verdade (o banco segue vivo depois que este script termina).
// Uso: node scripts/test-db.mjs [start|stop]
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(raiz, ".testdb");
const logFile = path.join(dataDir, "postgres.log");
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
const rodar = (nome, args) => execFileSync(bin(nome), args, { stdio: "pipe" }).toString();

const acao = process.argv[2] ?? "start";

if (acao === "stop") {
  try {
    rodar("pg_ctl", ["stop", "-D", dataDir, "-m", "fast"]);
    console.log("Postgres de teste parado.");
  } catch {
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
  writeFileSync(logFile, "", { flag: "a" });
  rodar("pg_ctl", ["start", "-D", dataDir, "-l", logFile, "-o", `-p ${PORTA}`, "-w"]);
  console.log(`Postgres de teste iniciado na porta ${PORTA} (log: .testdb/postgres.log).`);
}

// Garante o banco (idempotente — erro "already exists" é ignorado).
try {
  rodar("createdb", ["-p", PORTA, "-U", "postgres", "-h", "localhost", "erp_genius_test"]);
  console.log("Banco erp_genius_test criado.");
} catch (e) {
  const msg = String(e.stderr ?? e);
  if (!msg.includes("already exists") && !msg.includes("já existe")) throw e;
  console.log("Banco erp_genius_test já existia.");
}
