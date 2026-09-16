import { execFileSync } from "node:child_process";
import path from "node:path";
import { resolverBancoTeste } from "./test-profile.mjs";

const comando = process.argv.slice(2).join(" ");
const permitidos = new Set(["generate", "migrate deploy", "migrate status"]);
if (!permitidos.has(comando)) throw new Error("Use generate, migrate deploy ou migrate status. Reset não é permitido por este comando.");
const raiz = path.resolve(import.meta.dirname, "..");
if (path.resolve(process.cwd()) !== raiz) throw new Error("Execute na raiz do worktree correspondente.");
const perfil = resolverBancoTeste(raiz);
console.log(`Prisma de teste: ${perfil.perfil} / ${perfil.banco}`);
execFileSync(process.execPath, [path.join(raiz, "node_modules/prisma/build/index.js"), ...process.argv.slice(2)], {
  cwd: raiz,
  env: { ...process.env, DATABASE_URL: perfil.url },
  stdio: "inherit",
  windowsHide: true,
  timeout: 120_000,
});
