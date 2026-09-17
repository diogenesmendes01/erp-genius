import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { DATABASE_URL_TESTE } from "../../vitest.integration.config";
import { conferirDependenciasInstaladas } from "./dependencias";

// O integrador aplica migrações explicitamente antes de liberar a suíte.
// Testes apenas conferem o estado: um arquivo ainda em revisão não pode ser
// aplicado implicitamente ao iniciar Vitest em um worktree de desenvolvimento.
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
    const detalhe = e instanceof Error && "stderr" in e ? String((e as { stderr: unknown }).stderr) : String(e);
    throw new Error(
      `O banco de TESTE não está pronto para esta suíte. O integrador deve conferir o perfil, ` +
        `a disponibilidade do banco e aplicar explicitamente as migrações aprovadas. ` +
        `Nenhuma migração foi aplicada pelo teste.\n${detalhe}`,
    );
  }
}
