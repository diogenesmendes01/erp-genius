import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Trava (C1 da revisão do #240): a busca de `repeticaoIdempotente` usa um índice de expressão parcial do
// `Evento`, criado em SQL manual porque o Prisma 5 não representa índice de expressão nem parcial (e o
// `prisma migrate diff` não o enxerga, então não propõe removê-lo). Este teste impede que alguém apague a
// migration, mude a expressão sem mudar a consulta ou tire o aviso do schema.
const raiz = process.cwd();
const migracao = readFileSync(path.join(raiz, "prisma/migrations/20261019010000_evento_idempotencia_idx/migration.sql"), "utf8");
const schema = readFileSync(path.join(raiz, "prisma/schema.prisma"), "utf8");
const helper = readFileSync(path.join(raiz, "src/server/_shared/idempotencia.ts"), "utf8");
const modelo = schema.match(/model Evento \{[\s\S]*?\n\}/)?.[0] ?? "";

describe("índice da busca de idempotência no Evento", () => {
  it("migration_cria_indice_de_expressao_parcial", () => {
    expect(migracao).toMatch(
      /CREATE INDEX "Evento_idempotencia_idx" ON "Evento" \("tipo", "autorId", \(\("payload" ->> 'chaveIdempotencia'\)\)\) WHERE "payload" \? 'chaveIdempotencia';/,
    );
  });

  it("consulta_usa_a_mesma_expressao_e_o_mesmo_predicado", () => {
    expect(helper).toContain(`"payload" ? 'chaveIdempotencia'`);
    expect(helper).toContain(`("payload" ->> 'chaveIdempotencia') = `);
  });

  it("schema_documenta_o_indice_manual", () => {
    expect(modelo).toContain("Evento_idempotencia_idx");
  });
});
