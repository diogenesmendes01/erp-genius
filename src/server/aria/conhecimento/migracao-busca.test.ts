import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Trava (C5): a coluna gerada `busca` e o índice GIN de TrechoConhecimento nasceram em SQL manual.
// O schema os declara (Unsupported + dbgenerated + @@index Gin) para o `prisma migrate diff` não
// propor removê-los; este teste impede que alguém apague a declaração ou o SQL por engano.
const raiz = process.cwd();
const migracao = readFileSync(path.join(raiz, "prisma/migrations/20261018020000_aria_conhecimento/migration.sql"), "utf8");
const schema = readFileSync(path.join(raiz, "prisma/schema.prisma"), "utf8");
const modelo = schema.match(/model TrechoConhecimento \{[\s\S]*?\n\}/)?.[0] ?? "";

describe("busca textual da base de conhecimento", () => {
  it("migration_cria_coluna_gerada_e_indice_gin", () => {
    expect(migracao).toMatch(
      /"busca" tsvector GENERATED ALWAYS AS \(to_tsvector\('portuguese', "texto"\)\) STORED/,
    );
    expect(migracao).toMatch(/CREATE INDEX "TrechoConhecimento_busca_idx" ON "TrechoConhecimento" USING GIN \("busca"\)/);
  });

  it("schema_declara_coluna_e_indice", () => {
    expect(modelo).toMatch(/busca\s+Unsupported\("tsvector"\)\?\s+@default\(dbgenerated\("to_tsvector\('portuguese'::regconfig, texto\)"\)\)/);
    expect(modelo).toMatch(/@@index\(\[busca\], type: Gin\)/);
  });
});
