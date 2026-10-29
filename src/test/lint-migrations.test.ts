import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ARGUMENTOS_DIFF,
  LABEL_CONTRATO,
  REF_BASE,
  classificarMigrationsDoDiff,
  encontrarViolacoes,
  lintarMigrations,
  main,
  selecionarMigrationsNovas,
  temLabelContrato,
} from "../../scripts/lint-migrations";

const RAIZ = resolve(".");
const FIXTURES = resolve("src/test/fixtures/lint-migrations");
const temporarios: string[] = [];

afterEach(() => {
  for (const raiz of temporarios.splice(0)) {
    const destino = resolve(raiz);
    if (dirname(destino) !== resolve(tmpdir()) || !basename(destino).startsWith("erp-lint-migrations-")) {
      throw new Error("Diretório temporário fora do escopo do teste.");
    }
    rmSync(destino, { recursive: true, force: true });
  }
});

function sql(nome: string): string {
  return readFileSync(join(FIXTURES, nome), "utf8");
}

function diretorios(pasta: string): string[] {
  return readdirSync(pasta).filter((nome) => !nome.startsWith("."));
}

describe("fixtures de SQL", () => {
  it("aceita as fixtures de expand", () => {
    for (const nome of diretorios(join(FIXTURES, "passa"))) {
      expect(encontrarViolacoes(sql(join("passa", nome))), nome).toEqual([]);
    }
  });

  it("recusa as fixtures destrutivas", () => {
    const esperado: Record<string, string[]> = {
      "drop-table.sql": ["DROP TABLE"],
      "drop-column.sql": ["DROP COLUMN"],
      "drop-coluna-sem-column.sql": ["DROP COLUMN"],
      "drop-coluna-if-exists.sql": ["DROP COLUMN"],
      "rename.sql": ["RENAME"],
      "alter-type.sql": ["ALTER COLUMN TYPE"],
      "alter-type-sem-column.sql": ["ALTER COLUMN TYPE"],
      "alter-set-data-type.sql": ["ALTER COLUMN TYPE"],
      "set-not-null.sql": ["SET NOT NULL"],
      "truncate.sql": ["TRUNCATE"],
      "drop-schema.sql": ["DROP SCHEMA"],
      "drop-type.sql": ["DROP TYPE"],
      "execute-drop.sql": ["DROP TABLE"],
      "execute-truncate.sql": ["TRUNCATE"],
      "execute-alter.sql": ["DROP COLUMN", "ALTER COLUMN TYPE"],
      "execute-drop-schema.sql": ["DROP SCHEMA"],
      "execute-drop-type.sql": ["DROP TYPE"],
    };
    expect(diretorios(join(FIXTURES, "falha")).sort()).toEqual(Object.keys(esperado).sort());
    for (const [nome, regras] of Object.entries(esperado)) {
      const violacoes = encontrarViolacoes(sql(join("falha", nome)));
      expect(violacoes.map((v) => v.regra), nome).toEqual(regras);
    }
  });
});

describe("regras do blueprint", () => {
  it("usa o diff git diff --name-only origin/main -- prisma/migrations", () => {
    expect(REF_BASE).toBe("origin/main");
    expect([...ARGUMENTOS_DIFF]).toEqual(["diff", "--name-only", "origin/main", "--", "prisma/migrations"]);
    expect(LABEL_CONTRATO).toBe("migration-contract");
  });

  it("aponta a linha do SQL executável", () => {
    const violacoes = encontrarViolacoes("-- cabeçalho\nDROP TABLE \"t\";\n");
    expect(violacoes).toEqual([
      expect.objectContaining({ regra: "DROP TABLE", linha: 2, trecho: "DROP TABLE \"t\";" }),
    ]);
  });

  it("é insensível a maiúsculas e ignora DROP NOT NULL", () => {
    expect(encontrarViolacoes("drop table \"t\";").map((v) => v.regra)).toEqual(["DROP TABLE"]);
    expect(encontrarViolacoes("ALTER TABLE \"t\" ALTER COLUMN \"a\" DROP NOT NULL;")).toEqual([]);
    expect(encontrarViolacoes("alter table \"t\" drop if exists \"c\";").map((v) => v.regra)).toEqual(["DROP COLUMN"]);
    expect(encontrarViolacoes("ALTER TABLE t ALTER col SET DATA TYPE int;").map((v) => v.regra)).toEqual([
      "ALTER COLUMN TYPE",
    ]);
  });

  it("recusa SQL destrutivo no literal de EXECUTE e ignora texto que não executa", () => {
    const corpo = "CREATE FUNCTION f() RETURNS void AS $$\nBEGIN\n  EXECUTE 'TRUNCATE t';\nEND $$;";
    expect(encontrarViolacoes(corpo).map((v) => v.regra)).toEqual(["TRUNCATE"]);
    expect(encontrarViolacoes("EXECUTE format('DROP SCHEMA s');").map((v) => v.regra)).toEqual(["DROP SCHEMA"]);
    expect(encontrarViolacoes("EXECUTE $$DROP TYPE \"e\"$$;").map((v) => v.regra)).toEqual(["DROP TYPE"]);
    expect(encontrarViolacoes("PERFORM 'DROP TABLE \"t\"';")).toEqual([]);
    expect(encontrarViolacoes("EXECUTE 'ALTER TABLE \"t\" ADD COLUMN \"a\" int';")).toEqual([]);
  });

  it("recusa SET NOT NULL quando o DEFAULT foi removido no mesmo comando", () => {
    const sqlComando = "ALTER TABLE \"t\" ALTER COLUMN \"a\" DROP DEFAULT, ALTER COLUMN \"a\" SET NOT NULL;";
    expect(encontrarViolacoes(sqlComando).map((v) => v.regra)).toContain("SET NOT NULL");
  });

  it("recusa DROP TABLE dentro do corpo de função", () => {
    const corpo = "CREATE FUNCTION f() RETURNS void AS $$\nBEGIN\n  DROP TABLE \"t\";\nEND $$;";
    expect(encontrarViolacoes(corpo).map((v) => v.regra)).toContain("DROP TABLE");
  });

  it("ignora o delimitador dollar citado dentro do corpo", () => {
    const corpo = "DO $body$\nBEGIN\n  PERFORM '$body$ DROP TABLE \"t\"';\nEND $body$;";
    expect(encontrarViolacoes(corpo)).toEqual([]);
  });

  it("não deixa o DEFAULT de outro comando anular o SET NOT NULL", () => {
    const sqlComando = "ALTER TABLE \"t\" ALTER COLUMN \"a\" SET DEFAULT 1;\nALTER TABLE \"t\" ALTER COLUMN \"a\" SET NOT NULL;";
    expect(encontrarViolacoes(sqlComando).map((v) => v.regra)).toEqual(["SET NOT NULL"]);
  });

  it("separa migration nova de migration já aplicada que entrou no diff", () => {
    const nomes = [
      "prisma/migrations/nova/migration.sql",
      "prisma/migrations/antiga/migration.sql",
      "prisma/migrations/migration_lock.toml",
      "prisma/schema.prisma",
      "src/app/page.tsx",
    ];
    const base = new Set(["prisma/migrations/antiga/migration.sql"]);
    const existe = (caminho: string) => base.has(caminho);
    expect(selecionarMigrationsNovas(nomes, existe)).toEqual(["prisma/migrations/nova/migration.sql"]);
    expect(classificarMigrationsDoDiff(nomes, existe)).toEqual({
      novas: ["prisma/migrations/nova/migration.sql"],
      editadas: ["prisma/migrations/antiga/migration.sql"],
    });
  });

  it("recusa edição de migration aplicada e só libera com o label", () => {
    const arquivos = [{ caminho: "prisma/migrations/nova/migration.sql", sql: "SELECT 1;" }];
    const editadas = ["prisma/migrations/antiga/migration.sql"];
    const semLabel = lintarMigrations({ arquivos, editadas, temLabelContrato: false });
    expect(semLabel.ok).toBe(false);
    expect(semLabel.editadas).toEqual(editadas);
    const comLabel = lintarMigrations({ arquivos, editadas, temLabelContrato: true });
    expect(comLabel.ok).toBe(true);
    expect(comLabel.editadas).toEqual(editadas);
  });

  it("falha sem o label e passa com migration-contract, sem esconder a violação", () => {
    const arquivos = [{ caminho: "prisma/migrations/nova/migration.sql", sql: "DROP TABLE \"t\";" }];
    const semLabel = lintarMigrations({ arquivos, temLabelContrato: false });
    expect(semLabel.ok).toBe(false);
    expect(semLabel.violacoes).toHaveLength(1);
    const comLabel = lintarMigrations({ arquivos, temLabelContrato: true });
    expect(comLabel.ok).toBe(true);
    expect(comLabel.violacoes).toHaveLength(1);
    expect(lintarMigrations({ arquivos: [], temLabelContrato: false }).ok).toBe(true);
  });

  it("reconhece o label no ambiente e no payload do pull_request", () => {
    expect(temLabelContrato({ labels: "bug, migration-contract" })).toBe(true);
    expect(temLabelContrato({ labels: "migration-contract-extra" })).toBe(false);
    expect(temLabelContrato({ evento: { pull_request: { labels: [{ name: "migration-contract" }] } } })).toBe(true);
    expect(temLabelContrato({})).toBe(false);
  });
});

describe("histórico em prisma/migrations", () => {
  function lerAllowlist(): string[] {
    return readFileSync(resolve("scripts/lint-migrations.allowlist.txt"), "utf8")
      .split("\n")
      .map((linha) => linha.trim())
      .filter((linha) => linha && !linha.startsWith("#"));
  }

  function violacoesAtuais(): Map<string, string[]> {
    const raiz = resolve("prisma/migrations");
    const mapa = new Map<string, string[]>();
    for (const entrada of readdirSync(raiz, { withFileTypes: true })) {
      if (!entrada.isDirectory()) continue;
      const texto = readFileSync(join(raiz, entrada.name, "migration.sql"), "utf8");
      const regras = encontrarViolacoes(texto).map((v) => v.regra);
      if (regras.length) mapa.set(entrada.name, regras);
    }
    return mapa;
  }

  it("só viola a regra nas migrations listadas na allowlist", () => {
    const encontradas = [...violacoesAtuais().keys()].sort();
    expect(encontradas).toEqual([...lerAllowlist()].sort());
  });

  it("não marca DROP NOT NULL histórico como destrutivo", () => {
    const texto = readFileSync(
      resolve("prisma/migrations/20261016110000_grupos_whatsapp/migration.sql"),
      "utf8",
    );
    expect(encontrarViolacoes(texto)).toEqual([]);
  });
});

describe("ci, docs e template", () => {
  it("liga o lint no job lint do ci.yml e não no image.yml", () => {
    const ci = readFileSync(resolve(".github/workflows/ci.yml"), "utf8");
    const lint = ci.split(/^ {2}test:/m)[0];
    expect(lint).toContain("name: lint");
    expect(lint).toContain("name: Lint de migrations (expand-only)");
    expect(lint).not.toContain("continue-on-error");
    expect(lint).toContain("git fetch --no-tags --depth=1 origin main");
    expect(lint).toContain("npx tsx scripts/lint-migrations.ts");
    expect(lint).not.toMatch(/tsx scripts\/lint-migrations\.ts[\s\S]*\|\|\s*true/);
    expect(ci).toContain("types: [opened, synchronize, reopened, labeled, unlabeled]");
    expect(readFileSync(resolve(".github/workflows/image.yml"), "utf8")).not.toContain("lint-migrations");
  });

  it("documenta a regra expand-only e o checklist da PR", () => {
    const doc = readFileSync(resolve("docs/migrations.md"), "utf8");
    expect(doc).toContain("migration-contract");
    expect(doc).toContain("origin/main");
    expect(doc).toContain("DROP TABLE");
    expect(doc).toContain("SET NOT NULL");
    expect(doc).toContain("TRUNCATE");
    expect(doc).toContain("DROP SCHEMA");
    expect(doc).toContain("DROP TYPE");
    expect(doc).toContain("EXECUTE");
    expect(doc).toContain("edição de migration aplicada é proibida");
    expect(doc).toContain("Lint de migrations (expand-only)");
    expect(doc).toContain("check obrigatório na branch protection");
    const template = readFileSync(resolve(".github/pull_request_template.md"), "utf8");
    expect(template).toContain("migration-contract");
    expect(template).toContain("docs/migrations.md");
  });
});

describe("CLI", () => {
  function git(cwd: string, args: string[]) {
    execFileSync("git", ["-c", "commit.gpgsign=false", "-c", "user.email=teste@example.com", "-c", "user.name=Teste", ...args], {
      cwd,
      stdio: "pipe",
    });
  }

  function repositorio(): string {
    const cwd = mkdtempSync(join(tmpdir(), "erp-lint-migrations-"));
    temporarios.push(cwd);
    git(cwd, ["init", "-b", "main"]);
    mkdirSync(join(cwd, "prisma/migrations/20260101000000_historica"), { recursive: true });
    writeFileSync(join(cwd, "prisma/migrations/20260101000000_historica/migration.sql"), "DROP TABLE \"Velha\";\n");
    git(cwd, ["add", "."]);
    git(cwd, ["commit", "-m", "base"]);
    git(cwd, ["branch", REF_BASE]);
    return cwd;
  }

  function escreverNova(cwd: string, sqlTexto: string) {
    const dir = join(cwd, "prisma/migrations/20260202000000_nova");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "migration.sql"), sqlTexto);
    git(cwd, ["add", "prisma/migrations/20260202000000_nova"]);
  }

  function ambiente(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
    return { ...process.env, PR_LABELS: "", GITHUB_EVENT_PATH: "", ...extra };
  }

  it("passa quando a migration nova é expand e a histórica fica na base", () => {
    const cwd = repositorio();
    escreverNova(cwd, "ALTER TABLE \"t\" ADD COLUMN \"a\" TEXT;\n");
    expect(main(cwd, ambiente())).toBe(0);
  });

  it("falha numa migration nova destrutiva e passa com o label", () => {
    const cwd = repositorio();
    escreverNova(cwd, "DROP TABLE \"Nova\";\n");
    expect(main(cwd, ambiente())).toBe(1);
    expect(main(cwd, ambiente({ PR_LABELS: LABEL_CONTRATO }))).toBe(0);
  });

  function capturarSaida(fn: () => number): { codigo: number; stdout: string; stderr: string } {
    const saidas: string[] = [];
    const erros: string[] = [];
    const logOriginal = console.log;
    const erroOriginal = console.error;
    console.log = (msg?: unknown) => {
      saidas.push(String(msg));
    };
    console.error = (msg?: unknown) => {
      erros.push(String(msg));
    };
    try {
      return { codigo: fn(), stdout: saidas.join("\n"), stderr: erros.join("\n") };
    } finally {
      console.log = logOriginal;
      console.error = erroOriginal;
    }
  }

  it("falha ao editar migration já aplicada e só segue com migration-contract", () => {
    const cwd = repositorio();
    const caminho = "prisma/migrations/20260101000000_historica/migration.sql";
    writeFileSync(join(cwd, caminho), "-- nota\nDROP TABLE \"Velha\";\n");
    const semLabel = capturarSaida(() => main(cwd, ambiente()));
    expect(semLabel.codigo).toBe(1);
    expect(semLabel.stderr).toContain(`${caminho}: edição de migration aplicada é proibida`);
    expect(semLabel.stderr).not.toContain("DROP TABLE");
    expect(semLabel.stderr).toContain(LABEL_CONTRATO);
    const comLabel = capturarSaida(() => main(cwd, ambiente({ PR_LABELS: LABEL_CONTRATO })));
    expect(comLabel.codigo).toBe(0);
    expect(comLabel.stdout).toContain("edição de migration aplicada é proibida");
  });

  it("falha ao remover migration já aplicada", () => {
    const cwd = repositorio();
    const caminho = "prisma/migrations/20260101000000_historica/migration.sql";
    rmSync(dirname(join(cwd, caminho)), { recursive: true });
    const saida = capturarSaida(() => main(cwd, ambiente()));
    expect(saida.codigo).toBe(1);
    expect(saida.stderr).toContain(`${caminho}: edição de migration aplicada é proibida`);
  });

  it("encerra com erro quando origin/main não existe", () => {
    const cwd = mkdtempSync(join(tmpdir(), "erp-lint-migrations-"));
    temporarios.push(cwd);
    git(cwd, ["init", "-b", "main"]);
    git(cwd, ["commit", "--allow-empty", "-m", "vazia"]);
    expect(main(cwd, ambiente())).toBe(2);
  });

  it("executa o arquivo como CLI", () => {
    const cwd = repositorio();
    escreverNova(cwd, "RENAME TABLE \"a\" TO \"b\";\n");
    const resultado = spawnSync(
      process.execPath,
      ["--import", "tsx", resolve(RAIZ, "scripts/lint-migrations.ts"), cwd],
      {
        cwd: RAIZ,
        encoding: "utf8",
        env: { ...process.env, PR_LABELS: "", GITHUB_EVENT_PATH: "", LINT_MIGRATIONS_CLI: "1" },
      },
    );
    expect(resultado.status).toBe(1);
    expect(resultado.stderr).toContain("RENAME");
    expect(resultado.stderr).toContain(LABEL_CONTRATO);
  });
});
