import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { DATABASE_URL_TESTE } from "../../vitest.integration.config";
import { conferirDependenciasInstaladas } from "./dependencias";

export default function setup() {
  conferirDependenciasInstaladas();
  if (!DATABASE_URL_TESTE.includes("localhost:54329")) {
    throw new Error("Guarda de segurança: a URL de teste deve apontar para localhost:54329.");
  }
  try {
    execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "migrate", "status"], {
      env: { ...process.env, DATABASE_URL: DATABASE_URL_TESTE },
      stdio: "pipe",
      timeout: 120_000,
    });
  } catch (e) {
    const detalhe = e instanceof Error && "stderr" in e
      ? ["stdout" in e ? String(e.stdout ?? "") : "", String(e.stderr ?? "")].filter(Boolean).join("\n") || e.message
      : String(e);
    throw new Error(
      `O banco de TESTE não está pronto para esta suíte. O integrador deve conferir o perfil, ` +
        `a disponibilidade do banco e aplicar explicitamente as migrações aprovadas. ` +
        `Nenhuma migração foi aplicada pelo teste.\n${detalhe}`,
    );
  }
}
