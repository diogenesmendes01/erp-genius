import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";

// Trava o db-init do Coolify (review #124 B1): garante idempotência e production-safe.
// Mutações cobradas:
// - Remover \gexec → DEVE FALHAR
// - Remover WHERE NOT EXISTS → DEVE FALHAR
// - $$PGUSER → $PGUSER → DEVE FALHAR
// - Reintroduzir DO $$ → DEVE FALHAR
// - Remover ON_ERROR_STOP=1 → DEVE FALHAR

const composePath = path.join(__dirname, "../../../docker-compose.coolify.yml");

describe("docker-compose.coolify.yml: db-init", () => {
  let config: any;
  let dbInitCommand: string;

  beforeAll(() => {
    const raw = fs.readFileSync(composePath, "utf8");
    config = yaml.parse(raw);

    const cmd = config.services["db-init"].command;
    // O comando é array: ['sh', '-c', '<script>']
    expect(cmd).toBeInstanceOf(Array);
    expect(cmd[0]).toBe("sh");
    expect(cmd[1]).toBe("-c");
    dbInitCommand = cmd[2];
  });

  it("usa \\gexec na mesma linha do CREATE DATABASE evolution", () => {
    // \gexec deve estar presente e próximo ao CREATE
    expect(dbInitCommand).toContain("CREATE DATABASE evolution");
    expect(dbInitCommand).toContain("\\gexec");

    // Verificar que estão na mesma linha (ou pelo menos conectados sem quebra significativa)
    const lines = dbInitCommand.split("\n");
    const createLine = lines.find((l) => l.includes("CREATE DATABASE evolution"));
    expect(createLine).toBeDefined();
    expect(createLine).toContain("\\gexec");
  });

  it("usa WHERE NOT EXISTS para idempotência", () => {
    expect(dbInitCommand).toContain("WHERE NOT EXISTS");
    expect(dbInitCommand).toContain("pg_database");
    expect(dbInitCommand).toContain("datname = 'evolution'");
  });

  it("usa $$PGUSER (escape correto do Compose)", () => {
    // Compose interpola $$ → $, então $$PGUSER vira $PGUSER no container
    expect(dbInitCommand).toContain("$$PGUSER");
    // Não deve usar $PGUSER (sem $$) porque o Compose interpolaria errado
    expect(dbInitCommand).not.toMatch(/[^$]\$PGUSER/); // não $PGUSER sem duplo $
  });

  it("usa ON_ERROR_STOP=1", () => {
    expect(dbInitCommand).toContain("ON_ERROR_STOP=1");
  });

  it("usa heredoc <<'SQL' (sem expansão shell)", () => {
    expect(dbInitCommand).toContain("<<'SQL'");
  });

  it("NÃO usa DO $$ (CREATE DATABASE não pode rodar em função)", () => {
    expect(dbInitCommand).not.toContain("DO $$");
    expect(dbInitCommand).not.toContain("DO $");
  });

  it("NÃO tem CREATE DATABASE dentro de BEGIN/END", () => {
    // Detectar padrão de DO/BEGIN ... CREATE DATABASE ... END
    const hasDoBlock = /DO\s+\$\$[\s\S]*BEGIN[\s\S]*CREATE DATABASE[\s\S]*END/i.test(
      dbInitCommand
    );
    expect(hasDoBlock).toBe(false);
  });
});
