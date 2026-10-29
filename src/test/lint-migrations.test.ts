import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  LABEL_CONTRATO,
  argumentosDiff,
  baseFixaDoEvento,
  classificarMigrationsDoDiff,
  encontrarViolacoes,
  lintarMigrations,
  main,
  resolverBaseFixa,
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
      "set-not-null-default-outra-coluna.sql": ["SET NOT NULL"],
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
  it("resolve a base fixa do evento e difere contra o merge-base", () => {
    const sha = "a".repeat(40);
    const antes = "b".repeat(40);
    expect(LABEL_CONTRATO).toBe("migration-contract");
    expect(baseFixaDoEvento("pull_request", { pull_request: { base: { sha } } })).toBeNull();
    expect(baseFixaDoEvento("push", { before: antes })).toBe(antes);
    expect(baseFixaDoEvento("push", { before: "0".repeat(40) })).toBeNull();
    expect(baseFixaDoEvento("push", { pull_request: { base: { sha } } })).toBeNull();
    expect(baseFixaDoEvento(undefined, { pull_request: { base: { sha } } })).toBeNull();
    expect(resolverBaseFixa({ MIGRATION_BASE_SHA: "nao-e-sha" }, { pull_request: { base: { sha } } })).toBeNull();
    expect(resolverBaseFixa({ GITHUB_EVENT_NAME: "pull_request" }, { pull_request: { base: { sha } } })).toEqual({
      origem: "head-primeiro-pai",
    });
    expect(resolverBaseFixa({ GITHUB_EVENT_NAME: "pull_request" }, {})).toEqual({ origem: "head-primeiro-pai" });
    expect(resolverBaseFixa({ GITHUB_EVENT_NAME: "push" }, { before: antes })).toEqual({ origem: "merge-base", sha: antes });
    expect([...argumentosDiff(sha)]).toEqual(["diff", "--name-only", sha, "--", "prisma/migrations"]);
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

  it("recusa SET NOT NULL quando o DEFAULT é de outra coluna no mesmo comando", () => {
    const sqlComando = "ALTER TABLE \"t\" ALTER COLUMN \"a\" SET NOT NULL, ALTER COLUMN \"b\" SET DEFAULT 0;";
    expect(encontrarViolacoes(sqlComando).map((v) => v.regra)).toEqual(["SET NOT NULL"]);
  });

  it("não trata identificador citado nem a coluna type como palavra-chave", () => {
    expect(encontrarViolacoes("ALTER TABLE \"t\" ADD COLUMN \"rename\" text;")).toEqual([]);
    expect(encontrarViolacoes("ALTER TABLE \"t\" ADD COLUMN \"truncate\" text;")).toEqual([]);
    expect(encontrarViolacoes("ALTER TABLE t ALTER COLUMN type SET DEFAULT 0;")).toEqual([]);
    expect(encontrarViolacoes("ALTER TABLE t ALTER COLUMN type TYPE int;").map((v) => v.regra)).toEqual([
      "ALTER COLUMN TYPE",
    ]);
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
    expect(lint).toContain("fetch-depth: 0");
    expect(lint).toContain("refs/pull/{0}/merge");
    expect(lint).not.toContain("git fetch");
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
    expect(doc).toContain("pull_request.base.sha");
    expect(doc).toContain("HEAD^1");
    expect(doc).toContain("refs/pull/");
    expect(doc).toContain("github.event.before");
    expect(doc).toContain("No push o lint não relê o SQL de migration nova");
    expect(doc).toContain("merge-base");
    expect(doc).toContain("fetch-depth: 0");
    expect(doc).toContain("precisa entrar em `scripts/lint-migrations.allowlist.txt`");
    expect(doc).toContain("DROP INDEX");
    expect(doc).toContain("DROP VIEW");
    expect(doc).toContain("DROP FUNCTION");
    expect(doc).toContain("ficam com a review");
    expect(doc).toContain("mesma coluna");
    expect(doc).toContain("job pulado no run mais novo substitui o check");
    const template = readFileSync(resolve(".github/pull_request_template.md"), "utf8");
    expect(template).toContain("migration-contract");
    expect(template).toContain("docs/migrations.md");
    expect(template).toContain("scripts/lint-migrations.allowlist.txt");
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
    git(cwd, ["branch", "origin/main"]);
    return cwd;
  }

  function escreverNova(cwd: string, sqlTexto: string) {
    const dir = join(cwd, "prisma/migrations/20260202000000_nova");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "migration.sql"), sqlTexto);
    git(cwd, ["add", "prisma/migrations/20260202000000_nova"]);
  }

  const CHAVE_CAMINHO_EVENTO = "GITHUB_EVENT_PATH";
  const CHAVE_NOME_EVENTO = "GITHUB_EVENT_NAME";
  const CHAVE_BASE = "MIGRATION_BASE_SHA";

  function ambiente(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env, PR_LABELS: "", ...extra };
    env[CHAVE_CAMINHO_EVENTO] = Object.prototype.hasOwnProperty.call(extra, CHAVE_CAMINHO_EVENTO)
      ? extra[CHAVE_CAMINHO_EVENTO]
      : "";
    if (!Object.prototype.hasOwnProperty.call(extra, CHAVE_NOME_EVENTO)) delete env[CHAVE_NOME_EVENTO];
    if (!Object.prototype.hasOwnProperty.call(extra, CHAVE_BASE)) delete env[CHAVE_BASE];
    return env;
  }

  function ambienteNaBase(cwd: string, extra: Record<string, string> = {}): NodeJS.ProcessEnv {
    return ambiente({ [CHAVE_BASE]: shaHead(cwd), ...extra });
  }

  it("passa quando a migration nova é expand e a histórica fica na base", () => {
    const cwd = repositorio();
    escreverNova(cwd, "ALTER TABLE \"t\" ADD COLUMN \"a\" TEXT;\n");
    expect(main(cwd, ambienteNaBase(cwd))).toBe(0);
  });

  it("falha numa migration nova destrutiva e passa com o label", () => {
    const cwd = repositorio();
    escreverNova(cwd, "DROP TABLE \"Nova\";\n");
    expect(main(cwd, ambienteNaBase(cwd))).toBe(1);
    expect(main(cwd, ambienteNaBase(cwd, { PR_LABELS: LABEL_CONTRATO }))).toBe(0);
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
    const semLabel = capturarSaida(() => main(cwd, ambienteNaBase(cwd)));
    expect(semLabel.codigo).toBe(1);
    expect(semLabel.stderr).toContain(`${caminho}: edição de migration aplicada é proibida`);
    expect(semLabel.stderr).not.toContain("DROP TABLE");
    expect(semLabel.stderr).toContain(LABEL_CONTRATO);
    const comLabel = capturarSaida(() => main(cwd, ambienteNaBase(cwd, { PR_LABELS: LABEL_CONTRATO })));
    expect(comLabel.codigo).toBe(0);
    expect(comLabel.stdout).toContain("edição de migration aplicada é proibida");
  });

  it("falha ao remover migration já aplicada", () => {
    const cwd = repositorio();
    const caminho = "prisma/migrations/20260101000000_historica/migration.sql";
    rmSync(dirname(join(cwd, caminho)), { recursive: true });
    const saida = capturarSaida(() => main(cwd, ambienteNaBase(cwd)));
    expect(saida.codigo).toBe(1);
    expect(saida.stderr).toContain(`${caminho}: edição de migration aplicada é proibida`);
  });

  it("falha fechado sem evento mesmo quando o repositório não tem origin/main", () => {
    const cwd = mkdtempSync(join(tmpdir(), "erp-lint-migrations-"));
    temporarios.push(cwd);
    git(cwd, ["init", "-b", "main"]);
    git(cwd, ["commit", "--allow-empty", "-m", "vazia"]);
    expect(main(cwd, ambiente())).toBe(2);
  });

  function shaHead(cwd: string): string {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" }).trim();
  }

  function escreverEvento(corpo: unknown): string {
    const caminho = join(tmpdir(), `erp-lint-migrations-evento-${process.hrtime.bigint()}.json`);
    writeFileSync(caminho, JSON.stringify(corpo));
    return caminho;
  }

  function ambienteEvento(nome: "pull_request" | "push", sha: string | null): NodeJS.ProcessEnv {
    const corpo =
      nome === "pull_request"
        ? { pull_request: { base: sha ? { sha } : {} } }
        : { before: sha };
    return ambiente({
      [CHAVE_NOME_EVENTO]: nome,
      [CHAVE_CAMINHO_EVENTO]: escreverEvento(corpo),
    });
  }

  it("compara com a base fixa do pull_request e ignora migration nova que só existe em origin/main", () => {
    const cwd = repositorio();
    const c0 = shaHead(cwd);
    git(cwd, ["checkout", "-b", "pr"]);
    git(cwd, ["commit", "--allow-empty", "-m", "pr"]);
    git(cwd, ["checkout", "main"]);
    git(cwd, ["checkout", "-b", "ponta"]);
    const dir = join(cwd, "prisma/migrations/20260303000000_so_na_main");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "migration.sql"), "CREATE TABLE \"so_main\" (\"id\" TEXT);\n");
    git(cwd, ["add", "prisma/migrations/20260303000000_so_na_main"]);
    git(cwd, ["commit", "-m", "main anda"]);
    git(cwd, ["checkout", "main"]);
    git(cwd, ["merge", "pr", "--no-ff", "-m", "merge"]);
    git(cwd, ["branch", "-f", "origin/main", "ponta"]);

    const saida = capturarSaida(() => main(cwd, ambienteEvento("pull_request", c0)));
    expect(saida.codigo).toBe(0);
    expect(saida.stderr).not.toContain("edição de migration aplicada é proibida");
    expect(`${saida.stdout}\n${saida.stderr}`).not.toContain("20260303000000_so_na_main");
  });

  it("no push uma migration de contract nova sai 0 porque o SQL já foi validado na PR", () => {
    const cwd = repositorio();
    const antes = shaHead(cwd);
    escreverNova(cwd, "ALTER TABLE \"A\" DROP COLUMN \"y\";\n");
    git(cwd, ["commit", "-m", "contract"]);
    git(cwd, ["branch", "-f", "origin/main", "HEAD"]);

    const saida = capturarSaida(() => main(cwd, ambienteEvento("push", antes)));
    expect(saida.codigo).toBe(0);
    expect(`${saida.stdout}\n${saida.stderr}`).not.toContain("DROP COLUMN");
    expect(`${saida.stdout}\n${saida.stderr}`).not.toContain("migration-contract");
    expect(saida.stdout).toContain("nenhuma violação");
  });

  it("no push editar migration antiga continua falhando", () => {
    const cwd = repositorio();
    const antes = shaHead(cwd);
    const caminho = "prisma/migrations/20260101000000_historica/migration.sql";
    writeFileSync(join(cwd, caminho), "-- nota\nDROP TABLE \"Velha\";\n");
    git(cwd, ["add", caminho]);
    git(cwd, ["commit", "-m", "edita aplicada"]);
    git(cwd, ["branch", "-f", "origin/main", "HEAD"]);

    const saida = capturarSaida(() => main(cwd, ambienteEvento("push", antes)));
    expect(saida.codigo).toBe(1);
    expect(saida.stderr).toContain(`${caminho}: edição de migration aplicada é proibida`);
    expect(saida.stderr).not.toContain("DROP TABLE");
  });

  it("no pull_request compara com HEAD^1 e ignora base.sha velho de labeled ou reopened", () => {
    const cwd = repositorio();
    const c0 = shaHead(cwd);
    git(cwd, ["checkout", "-b", "pr"]);
    escreverNova(cwd, "ALTER TABLE \"t\" ADD COLUMN \"a\" TEXT;\n");
    git(cwd, ["commit", "-m", "expand da pr"]);
    git(cwd, ["checkout", "main"]);
    const dir = join(cwd, "prisma/migrations/20260303000000_contract");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "migration.sql"), "ALTER TABLE \"A\" DROP COLUMN \"y\";\n");
    git(cwd, ["add", "prisma/migrations/20260303000000_contract"]);
    git(cwd, ["commit", "-m", "contract na main"]);
    git(cwd, ["merge", "pr", "--no-ff", "-m", "merge"]);

    const saida = capturarSaida(() => main(cwd, ambienteEvento("pull_request", c0)));
    expect(saida.codigo).toBe(0);
    expect(`${saida.stdout}\n${saida.stderr}`).not.toContain("DROP COLUMN");
    expect(`${saida.stdout}\n${saida.stderr}`).not.toContain("20260303000000_contract");
    expect(saida.stdout).toContain("nenhuma violação");
  });

  it("não muda o resultado quando origin/main avança durante o run", () => {
    const cwd = repositorio();
    const base = shaHead(cwd);
    escreverNova(cwd, "ALTER TABLE \"t\" ADD COLUMN \"a\" TEXT;\n");
    git(cwd, ["commit", "-m", "expand"]);
    const env = ambienteEvento("pull_request", base);
    const primeiro = capturarSaida(() => main(cwd, env));
    expect(primeiro.codigo).toBe(0);

    git(cwd, ["checkout", "origin/main"]);
    const dir = join(cwd, "prisma/migrations/20260303000000_so_na_main");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "migration.sql"), "CREATE TABLE \"so_main\" (\"id\" TEXT);\n");
    git(cwd, ["add", "."]);
    git(cwd, ["commit", "-m", "main anda durante o run"]);
    git(cwd, ["checkout", "main"]);

    const segundo = capturarSaida(() => main(cwd, env));
    expect(segundo.codigo).toBe(primeiro.codigo);
    expect(segundo.stdout).toBe(primeiro.stdout);
    expect(segundo.stderr).toBe(primeiro.stderr);
    expect(`${segundo.stdout}\n${segundo.stderr}`).not.toContain("20260303000000_so_na_main");
    expect(`${segundo.stdout}\n${segundo.stderr}`).not.toContain("edição de migration aplicada é proibida");
  });

  it("falha fechado quando a base do evento não resolve e não passa em silêncio", () => {
    const cwd = repositorio();
    escreverNova(cwd, "ALTER TABLE \"t\" ADD COLUMN \"a\" TEXT;\n");

    const semEvento = capturarSaida(() => main(cwd, ambiente()));
    expect(semEvento.codigo).toBe(2);
    expect(semEvento.stdout).not.toContain("nenhuma violação");

    const prSemSha = capturarSaida(() => main(cwd, ambienteEvento("pull_request", null)));
    expect(prSemSha.codigo).toBe(2);
    expect(prSemSha.stdout).not.toContain("nenhuma violação");

    const pushZero = capturarSaida(() => main(cwd, ambienteEvento("push", "0".repeat(40))));
    expect(pushZero.codigo).toBe(2);
    expect(pushZero.stdout).not.toContain("nenhuma violação");

    const objetoAusente = capturarSaida(() => main(cwd, ambienteEvento("pull_request", "c".repeat(40))));
    expect(objetoAusente.codigo).toBe(2);
    expect(objetoAusente.stdout).not.toContain("nenhuma violação");

    const env = ambienteEvento("pull_request", shaHead(cwd));
    env[CHAVE_BASE] = "nao-e-sha";
    const explicitaInvalida = capturarSaida(() => main(cwd, env));
    expect(explicitaInvalida.codigo).toBe(2);
    expect(explicitaInvalida.stdout).not.toContain("nenhuma violação");
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
        env: { ...ambienteNaBase(cwd), LINT_MIGRATIONS_CLI: "1" },
      },
    );
    expect(resultado.status).toBe(1);
    expect(resultado.stderr).toContain("RENAME");
    expect(resultado.stderr).toContain(LABEL_CONTRATO);
  });
});
