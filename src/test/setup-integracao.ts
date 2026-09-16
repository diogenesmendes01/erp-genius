import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { DATABASE_URL_TESTE } from "../../vitest.integration.config";
import { conferirDependenciasInstaladas } from "./dependencias";

// globalSetup dos testes de integração: aplica as migrations no Postgres de TESTE
// (docker, porta 54329 — npm run test:db) antes de qualquer suite. A URL vem fixa do
// config (nunca do .env): rodar isto jamais toca o banco de produção.
export default function setup() {
  conferirDependenciasInstaladas();
  if (!DATABASE_URL_TESTE.includes("localhost:54329")) {
    throw new Error("Guarda de segurança: a URL de teste deve apontar para localhost:54329.");
  }
  try {
    execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"], {
      env: { ...process.env, DATABASE_URL: DATABASE_URL_TESTE },
      stdio: "pipe",
      timeout: 120_000,
    });
  } catch (e) {
    const detalhe = e instanceof Error && "stderr" in e ? String((e as { stderr: unknown }).stderr) : String(e);
    throw new Error(
      `Não consegui preparar o banco de TESTE (localhost:54329). O container está de pé? ` +
        `Suba com: npm run test:db\n${detalhe}`,
    );
  }
}
