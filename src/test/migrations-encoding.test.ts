import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("todas as migrações possuem SQL legível em UTF-8 pelo Prisma", () => {
  const raiz = resolve("prisma/migrations");
  const falhas: string[] = [];
  for (const entrada of readdirSync(raiz, { withFileTypes: true })) {
    if (!entrada.isDirectory()) continue;
    try {
      const sql = new TextDecoder("utf-8", { fatal: true }).decode(
        readFileSync(resolve(raiz, entrada.name, "migration.sql")),
      );
      if (!sql.trim() || sql.includes("\0")) falhas.push(entrada.name);
    } catch {
      falhas.push(entrada.name);
    }
  }
  expect(falhas, "Arquivo ausente, vazio ou codificação inválida pode causar P3015 no deploy").toEqual([]);
});
