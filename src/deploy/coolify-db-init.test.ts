import * as fs from "fs";
import * as path from "path";
import { beforeAll, describe, expect, it } from "vitest";

// Trava o db-init do Coolify (review #124 B1): garante idempotência e production-safe.
// Mutações cobradas:
// - Remover \gexec → DEVE FALHAR
// - Remover WHERE NOT EXISTS → DEVE FALHAR
// - $$PGUSER → $PGUSER (no texto raw do YAML) → DEVE FALHAR
// - Reintroduzir DO $$ → DEVE FALHAR
// - Remover ON_ERROR_STOP=1 → DEVE FALHAR

const composePath = path.resolve(process.cwd(), "docker-compose.coolify.yml");

describe("docker-compose.coolify.yml: db-init", () => {
  let composeText: string;
  let dbInitSection: string;

  beforeAll(() => {
    composeText = fs.readFileSync(composePath, "utf8");

    // Extrair a seção db-init (entre "db-init:" e o próximo serviço de nível raiz)
    // Procurar de "db-init:" até o próximo "^\w+:" (serviço de nível raiz)
    const dbInitMatch = composeText.match(
      /^  db-init:\s*\n((?:^[ \t]+.*\n)*)/m
    );
    if (!dbInitMatch) {
      throw new Error("db-init service not found in compose file");
    }
    dbInitSection = dbInitMatch[0];
  });

  it("usa \\gexec na mesma linha do CREATE DATABASE evolution", () => {
    // \gexec deve estar presente
    expect(dbInitSection).toContain("\\gexec");
    expect(dbInitSection).toContain("CREATE DATABASE evolution");

    // Verificar que estão na mesma linha
    const lines = dbInitSection.split("\n");
    const createLine = lines.find((l) => l.includes("CREATE DATABASE evolution"));
    expect(createLine).toBeDefined();
    expect(createLine).toContain("\\gexec");
  });

  it("usa WHERE NOT EXISTS para idempotência", () => {
    expect(dbInitSection).toContain("WHERE NOT EXISTS");
    expect(dbInitSection).toContain("pg_database");
    expect(dbInitSection).toContain("datname = 'evolution'");
  });

  it("usa $$PGUSER (escape correto do Compose)", () => {
    // No texto raw do YAML, deve aparecer $$PGUSER (dois cifrões)
    expect(dbInitSection).toContain("$$PGUSER");

    // Verificar que NÃO tem $PGUSER (um cifrão) sem o duplo
    // Regex: $ seguido de PGUSER, mas não precedido por outro $
    // Buscar literalmente "$PGUSER" que não seja "$$PGUSER"
    const singleDollarPattern = /(?<!\$)\$PGUSER/;
    expect(dbInitSection).not.toMatch(singleDollarPattern);
  });

  it("usa ON_ERROR_STOP=1", () => {
    expect(dbInitSection).toContain("ON_ERROR_STOP=1");
  });

  it("usa heredoc <<'SQL' (sem expansão shell)", () => {
    expect(dbInitSection).toContain("<<'SQL'");
  });

  it("NÃO usa DO $$ (CREATE DATABASE não pode rodar em função)", () => {
    expect(dbInitSection).not.toContain("DO $$");
    expect(dbInitSection).not.toContain("DO $");
  });

  it("NÃO tem CREATE DATABASE dentro de BEGIN/END", () => {
    // Detectar padrão de DO/BEGIN ... CREATE DATABASE ... END
    const hasDoBlock = /DO\s+\$\$[\s\S]*BEGIN[\s\S]*CREATE DATABASE[\s\S]*END/i.test(
      dbInitSection
    );
    expect(hasDoBlock).toBe(false);
  });
});
