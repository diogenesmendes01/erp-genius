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
    // Checkout no Windows (autocrlf) traz \r\n; o regex da seção usa `.*\n` e `.` não casa com \r.
    composeText = fs.readFileSync(composePath, "utf8").replace(/\r\n/g, "\n");

    // Seção db-init: de "  db-init:" até a próxima chave de nível ≤ 2 (outro serviço ou bloco raiz).
    // Linha em branco faz parte do block scalar do YAML (o script continua depois dela): a seção
    // não pode parar nela, senão o resto do comando fica fora de toda asserção. Comentário de nível
    // ≤ 2 também não encerra a seção: para o YAML, o que vem depois dele continua no serviço.
    const dbInitMatch = composeText.match(
      /^  db-init:[^\n]*\n(?:(?:[ \t]+.*)?\n)*?(?=^  [^\s#]|^[^\s#])/m
    );
    if (!dbInitMatch) {
      throw new Error("db-init service not found in compose file");
    }
    // Sem as linhas de comentário do YAML: o comentário repete "\gexec" e "ON_ERROR_STOP=1", e o
    // toContain passaria mesmo com o comando sem eles.
    dbInitSection = dbInitMatch[0].split("\n").filter((linha) => !/^\s*#/.test(linha)).join("\n");
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
    // Também a forma com chaves: o Compose interpola "${PGUSER}" como "$PGUSER" (vazio no host).
    const singleDollarPattern = /(?<!\$)\$\{?PGUSER/;
    expect(dbInitSection).not.toMatch(singleDollarPattern);
  });

  it("usa ON_ERROR_STOP=1", () => {
    expect(dbInitSection).toContain("ON_ERROR_STOP=1");
  });

  // toContain aceita o texto em qualquer posição: comentário no fim da linha (shell "#", YAML "#",
  // SQL "--"), "-v" repetido (no psql o último vence), \gexec dentro das aspas, "OR true". As linhas
  // do comando são conferidas INTEIRAS (âncoras ^…$), e a opção e o \gexec aparecem uma vez só.
  it("linhas exatas do comando (sem comentário no fim, opção repetida, aspas ou condição extra)", () => {
    expect(dbInitSection).toMatch(/^[ \t]+psql -h db -U "\$\$PGUSER" -d postgres -v ON_ERROR_STOP=1 <<'SQL'$/m);
    expect(dbInitSection).toMatch(/^[ \t]+SELECT 'CREATE DATABASE evolution' WHERE NOT EXISTS \(SELECT FROM pg_database WHERE datname = 'evolution'\)\\gexec$/m);
    expect(dbInitSection.match(/ON_ERROR_STOP/g)).toHaveLength(1);
    expect(dbInitSection.match(/\\gexec/g)).toHaveLength(1);
  });

  // Linhas certas não bastam: uma linha a mais antes (`exit 0`, `: <<'X'`, `if false`) ou depois
  // (`true`, que devolveria 0 no lugar do erro do psql) e o db-init sai com 0 sem criar o banco ou
  // sem propagar a falha; um `entrypoint` no serviço faz o mesmo. O script é conferido INTEIRO e o
  // serviço só pode ter as chaves conhecidas (revisão R2 da #133, B5).
  it("script inteiro exato e só as chaves esperadas no serviço", () => {
    const script = dbInitSection.match(/^    command:\n      - sh\n      - -c\n      - \|\n((?:(?:        .*)?\n)*?)(?=^    \S)/m)?.[1];
    expect(script).toBe([
      'until pg_isready -h db -U "$$PGUSER"; do sleep 1; done',
      "psql -h db -U \"$$PGUSER\" -d postgres -v ON_ERROR_STOP=1 <<'SQL'",
      "SELECT 'CREATE DATABASE evolution' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'evolution')\\gexec",
      "SQL",
    ].map((l) => "        " + l + "\n").join(""));
    expect(dbInitSection.match(/^    [^\s#][^:]*:/gm)).toEqual(["    image:", "    restart:", "    environment:", "    command:", "    depends_on:"]);
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
