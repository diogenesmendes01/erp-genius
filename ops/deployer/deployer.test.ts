import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = join(process.cwd(), "ops/deployer");
const DEPLOY = join(ROOT, "bin/deploy.sh");
const SHA_NEW = "a".repeat(40);
const SHA_OLD = "b".repeat(40);
const SHA_OTHER = "c".repeat(40);
const DIG_APP = `sha256:${"a".repeat(64)}`;
const DIG_MIG = `sha256:${"b".repeat(64)}`;
const DIG_APP_PREV = `sha256:${"c".repeat(64)}`;
const DIG_MIG_PREV = `sha256:${"d".repeat(64)}`;
const COOLIFY_TOKEN = "coolify-token-test-value-0123456789";
const GHCR_TOKEN = "ghcr-token-test-value-0123456789abcdef";
const DB_SECRET = "db-secret-test";
const OTHER_SECRET = "super-segredo-coolify";
const APP_REPO = "ghcr.io/diogenesmendes01/erp-genius";
const MIG_REPO = "ghcr.io/diogenesmendes01/erp-genius/migrate";
const UUID = "thpvwxk6figfp347ajznvzhl";

const CHECKS = ["typecheck", "lint", "test (UTC)", "test (America/Sao_Paulo)", "build Next.js"];

type Verdict = "success" | "pending" | "failure";

let work: string;

afterEach(() => {
  if (work) rmSync(work, { recursive: true, force: true });
});

function checksFile(verdict: Verdict): string {
  return CHECKS.map((name) => {
    if (verdict === "pending" && name === "typecheck") return `${name}\tin_progress\t`;
    if (verdict === "failure" && name === "lint") return `${name}\tcompleted\tfailure`;
    return `${name}\tcompleted\tsuccess`;
  }).join("\n") + "\n";
}

function writeMocks(dir: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "gh"), `#!/usr/bin/env python3
import os, sys, json
from pathlib import Path
mock = Path(os.environ["MOCK_DIR"])
calls = mock / "calls.log"
args = sys.argv[1:]
with calls.open("a", encoding="utf-8") as fh:
    fh.write("gh " + " ".join(args) + "\\n")
if not args:
    sys.exit(1)
blob = " ".join(args)
if args[0] == "api":
    if "check-runs" in blob:
        import re
        found = re.search(r"commits/([a-f0-9]{40})/check-runs", blob)
        if not found:
            sys.exit(1)
        text = (mock / f"checks-{found.group(1)}").read_text(encoding="utf-8")
        sys.stdout.write(text if text.endswith("\\n") else text + "\\n")
        sys.exit(0)
    if "commits?per_page" in blob:
        sys.stdout.write((mock / "commits").read_text(encoding="utf-8"))
        sys.exit(0)
    sys.exit(1)
if args[0] == "attestation":
    mode = (mock / "attest-mode").read_text(encoding="utf-8").strip() if (mock / "attest-mode").exists() else "ok"
    if mode == "fail":
        sys.stderr.write("verify failed\\n")
        sys.exit(1)
    if mode == "empty":
        sys.exit(0)
    oci = next(a[len("oci://"):] for a in args if a.startswith("oci://"))
    digest = oci.split("@", 1)[1]
    hexd = digest.split(":", 1)[1]
    sha = (mock / "attest-sha").read_text(encoding="utf-8").strip()
    ref = "refs/heads/main"
    if mode == "bad-commit":
        sha = "${"f".repeat(40)}"
    if mode == "no-main":
        ref = "refs/tags/v9"
    if mode == "no-digest":
        hexd = "0" * 64
    payload = [{"verificationResult": {"statement": {
        "subject": [{"digest": {"sha256": hexd}}],
        "predicate": {"buildDefinition": {
            "externalParameters": {"workflow": {"ref": ref, "path": ".github/workflows/image.yml"}},
            "resolvedDependencies": [{"digest": {"gitCommit": sha}}],
        }},
    }}}]
    sys.stdout.write(json.dumps(payload))
    sys.exit(0)
sys.exit(1)
`);
  writeFileSync(join(dir, "curl"), `#!/usr/bin/env python3
import os, sys
from pathlib import Path
mock = Path(os.environ["MOCK_DIR"])
calls = mock / "calls.log"
if (mock / "curl-exit").exists():
    sys.exit(1)
args = sys.argv[1:]
def take(flag):
    if flag in args:
        return args[args.index(flag) + 1]
    return ""
url = take("--url")
method = take("-X") or "GET"
out = take("-o")
header = take("-D")
data = take("--data-binary")
body = ""
if data.startswith("@"):
    body = Path(data[1:]).read_text(encoding="utf-8")
line = f"curl {method} {url}"
if body and method in {"PATCH", "POST", "PUT"}:
    line += " " + body
with calls.open("a", encoding="utf-8") as fh:
    fh.write(line + "\\n")
code = "500"
resp = ""
headers = "HTTP/1.1 200 OK\\r\\n"
if "ghcr.io" in url:
    tag = url.rstrip("/").split("/")[-1]
    role = "migrate" if "/erp-genius/migrate/" in url else "app"
    digest_file = mock / f"{role}-{tag}"
    if not digest_file.exists():
        code = "404"
    else:
        headers += "docker-content-digest: " + digest_file.read_text(encoding="utf-8").strip() + "\\r\\n"
        code = "200"
elif url.endswith("/envs") and method == "GET":
    resp = (mock / "envs.json").read_text(encoding="utf-8")
    code = "200"
elif url.endswith("/envs") and method == "PATCH":
    code = "201"
    resp = "{}"
elif "/api/v1/deploy?" in url and method == "POST":
    code = "200"
    resp = '{"deployments":[]}'
elif url.endswith("/api/health"):
    sha = (mock / "health-sha").read_text(encoding="utf-8").strip()
    state = os.environ.get("DEPLOYER_STATE_FILE", "")
    marker = "state-not-yet-new"
    if state and Path(state).exists() and sha in Path(state).read_text(encoding="utf-8"):
        marker = "state-already-new"
    with calls.open("a", encoding="utf-8") as fh:
        fh.write(marker + "\\n")
    resp = '{"ok":true,"sha":"%s","timestamp":"2026-01-01T00:00:00.000Z"}' % sha
    code = "200"
elif url.endswith("/api/ready"):
    code = (mock / "ready-code").read_text(encoding="utf-8").strip() if (mock / "ready-code").exists() else "200"
    resp = '{"ready":true}'
elif "hooks.example.test" in url:
    code = "500" if (mock / "notify-fail").exists() else "204"
else:
    code = "404"
if out:
    Path(out).write_text(resp, encoding="utf-8")
if header:
    Path(header).write_text(headers, encoding="utf-8")
sys.stdout.write(code)
`);
  writeFileSync(join(dir, "docker"), `#!/usr/bin/env python3
import os, sys
from pathlib import Path
mock = Path(os.environ["MOCK_DIR"])
with (mock / "calls.log").open("a", encoding="utf-8") as fh:
    fh.write("docker " + " ".join(sys.argv[1:]) + "\\n")
if sys.argv[1:2] == ["pull"]:
    sys.exit(0)
if sys.argv[1:2] == ["run"]:
    sys.exit(1 if (mock / "migrate-fail").exists() else 0)
sys.exit(1)
`);
  writeFileSync(join(dir, "pg_dump"), `#!/usr/bin/env python3
import os, sys
from pathlib import Path
mock = Path(os.environ["MOCK_DIR"])
with (mock / "calls.log").open("a", encoding="utf-8") as fh:
    fh.write("pg_dump " + " ".join(sys.argv[1:]) + "\\n")
if (mock / "dump-fail").exists():
    sys.exit(1)
target = ""
for i, arg in enumerate(sys.argv):
    if arg == "--file" and i + 1 < len(sys.argv):
        target = sys.argv[i + 1]
    elif arg.startswith("--file="):
        target = arg.split("=", 1)[1]
if not target:
    sys.exit(1)
Path(target).write_text("PGDMP", encoding="utf-8")
`);
  for (const name of ["gh", "curl", "docker", "pg_dump"]) chmodSync(join(dir, name), 0o755);
}

type Scene = {
  commits?: string[];
  checks?: Record<string, Verdict>;
  digests?: Record<string, { app: string; migrate: string }>;
  attest?: string;
  attestSha?: string;
  healthSha?: string;
  ready?: string;
  previousApp?: string;
  previousMigrate?: string;
  migrateFail?: boolean;
  dumpFail?: boolean;
  curlExit?: boolean;
  notifyFail?: boolean;
  state?: { sha: string; app: string; migrate: string } | null;
};

function arrange(scene: Scene = {}): { mock: string; env: NodeJS.ProcessEnv; state: string; backup: string; log: string; pause: string; lock: string; failed: string } {
  work = mkdtempSync(join(tmpdir(), "erp-deployer-"));
  const bin = join(work, "bin");
  const mock = join(work, "mock");
  const backup = join(work, "backups");
  const stateDir = join(work, "state");
  mkdirSync(mock, { recursive: true });
  mkdirSync(backup, { recursive: true });
  mkdirSync(stateDir, { recursive: true });
  writeMocks(bin);
  const commits = scene.commits ?? [SHA_NEW];
  writeFileSync(join(mock, "commits"), commits.join("\n") + "\n");
  const checks = scene.checks ?? { [SHA_NEW]: "success" };
  for (const [sha, verdict] of Object.entries(checks)) writeFileSync(join(mock, `checks-${sha}`), checksFile(verdict));
  const digests = scene.digests ?? { [SHA_NEW]: { app: DIG_APP, migrate: DIG_MIG } };
  for (const [sha, pair] of Object.entries(digests)) {
    const tag = `sha-${sha.slice(0, 7)}`;
    writeFileSync(join(mock, `app-${tag}`), pair.app + "\n");
    writeFileSync(join(mock, `migrate-${tag}`), pair.migrate + "\n");
  }
  writeFileSync(join(mock, "attest-mode"), scene.attest ?? "ok");
  writeFileSync(join(mock, "attest-sha"), scene.attestSha ?? commits[0]);
  writeFileSync(join(mock, "health-sha"), scene.healthSha ?? (scene.attestSha ?? commits[0]));
  if (scene.ready) writeFileSync(join(mock, "ready-code"), scene.ready);
  if (scene.migrateFail) writeFileSync(join(mock, "migrate-fail"), "1");
  if (scene.dumpFail) writeFileSync(join(mock, "dump-fail"), "1");
  if (scene.curlExit) writeFileSync(join(mock, "curl-exit"), "1");
  if (scene.notifyFail) writeFileSync(join(mock, "notify-fail"), "1");
  const prevApp = scene.previousApp ?? `${APP_REPO}@${DIG_APP_PREV}`;
  const prevMig = scene.previousMigrate ?? `${MIG_REPO}@${DIG_MIG_PREV}`;
  writeFileSync(join(mock, "envs.json"), JSON.stringify([
    { key: "APP_IMAGE", value: prevApp },
    { key: "APP_MIGRATE_IMAGE", value: prevMig },
    { key: "AUTH_SECRET", value: OTHER_SECRET },
  ]));
  const state = join(stateDir, "state.json");
  const failed = join(stateDir, "state.json.failed");
  if (scene.state) {
    writeFileSync(state, JSON.stringify({
      sha: scene.state.sha,
      app_digest: scene.state.app,
      migrate_digest: scene.state.migrate,
      result: "success",
      deployed_at: "2026-01-01T00:00:00Z",
    }, null, 2));
  }
  const log = join(stateDir, "deploy.log");
  const pause = join(work, "PAUSE");
  const lock = join(stateDir, "deploy.lock");
  const env: NodeJS.ProcessEnv = {
    PATH: `${bin}:/usr/bin:/bin`,
    HOME: work,
    NODE_ENV: "test",
    TMPDIR: work,
    LANG: "C.UTF-8",
    MOCK_DIR: mock,
    DEPLOYER_TOOL_ROOT: bin,
    DEPLOYER_SKIP_ENV_FILE: "1",
    COOLIFY_TOKEN,
    GHCR_TOKEN,
    COOLIFY_BASE_URL: "http://127.0.0.1:8000",
    APP_BASE_URL: "http://127.0.0.1:3000",
    DATABASE_URL: `postgresql://erp:${DB_SECRET}@127.0.0.1:5432/erp`,
    BACKUP_DIR: backup,
    BACKUP_RETENTION_DAYS: "14",
    DEPLOYER_STATE_FILE: state,
    DEPLOYER_LOCK_FILE: lock,
    DEPLOYER_LOG_FILE: log,
    DEPLOYER_FAILED_FILE: failed,
    DEPLOYER_PAUSE_FILE: pause,
    HEALTH_ATTEMPTS: "2",
    HEALTH_INTERVAL_SECONDS: "0",
    DOCKER_NETWORK: "coolify",
  };
  return { mock, env, state, backup, log, pause, lock, failed };
}

function run(env: NodeJS.ProcessEnv) {
  return spawnSync(DEPLOY, [], { env, encoding: "utf8" });
}

function callsOf(mock: string): string[] {
  const path = join(mock, "calls.log");
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter(Boolean);
}

function combined(result: ReturnType<typeof run>, mock: string, log: string): string {
  const logText = existsSync(log) ? readFileSync(log, "utf8") : "";
  return `${result.stdout}\n${result.stderr}\n${logText}\n${callsOf(mock).join("\n")}`;
}

function assertNoSecrets(text: string): void {
  for (const secret of [COOLIFY_TOKEN, GHCR_TOKEN, DB_SECRET, OTHER_SECRET]) {
    expect(text).not.toContain(secret);
  }
}

function codeFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(sh|py|service|timer|sysusers)$/.test(name) || name === "env.example") out.push(path);
    }
  };
  walk(ROOT);
  return out;
}

describe("checklist 1 · token fora do repo, do log e de outro app", () => {
  it("não versiona segredo e fixa o app thpvwxk6figfp347ajznvzhl", () => {
    const blob = codeFiles().map((path) => readFileSync(path, "utf8")).join("\n");
    expect(blob).not.toMatch(/ghp_|github_pat_|BEGIN (?:OPENSSH|RSA|PRIVATE)/);
    expect(readFileSync(join(ROOT, "env.example"), "utf8")).toMatch(/^COOLIFY_TOKEN=$/m);
    expect(readFileSync(join(ROOT, "lib/common.sh"), "utf8")).toContain(UUID);
    expect(readFileSync(join(ROOT, "lib/py/load_env.py"), "utf8")).not.toContain('"PATH"');
  });

  it("recusa env que não está em 0600", () => {
    const ctx = arrange();
    const envFile = join(work, "env");
    writeFileSync(envFile, `COOLIFY_TOKEN=${COOLIFY_TOKEN}\nGHCR_TOKEN=${GHCR_TOKEN}\n`);
    chmodSync(envFile, 0o644);
    const result = run({ ...ctx.env, DEPLOYER_SKIP_ENV_FILE: "0", DEPLOYER_ENV_FILE: envFile, DEPLOYER_TOOL_ROOT: "" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("0600");
    assertNoSecrets(combined(result, ctx.mock, ctx.log));
  });

  it("ignora PATH plantado no env file", () => {
    const ctx = arrange();
    const evil = join(work, "evil");
    mkdirSync(evil);
    const marker = join(work, "pwned");
    writeFileSync(join(evil, "gh"), `#!/bin/sh\ntouch ${marker}\nexit 0\n`);
    chmodSync(join(evil, "gh"), 0o755);
    const envFile = join(work, "env");
    writeFileSync(envFile, [
      `PATH=${evil}`,
      `DEPLOYER_TOOL_ROOT=${evil}`,
      `COOLIFY_TOKEN=${COOLIFY_TOKEN}`,
      `GHCR_TOKEN=${GHCR_TOKEN}`,
      "COOLIFY_BASE_URL=http://127.0.0.1:8000",
      "APP_BASE_URL=http://127.0.0.1:3000",
      `DATABASE_URL=postgresql://erp:${DB_SECRET}@127.0.0.1:5432/erp`,
    ].join("\n") + "\n");
    chmodSync(envFile, 0o600);
    const result = run({
      ...ctx.env,
      DEPLOYER_SKIP_ENV_FILE: "0",
      DEPLOYER_ENV_FILE: envFile,
      DEPLOYER_TOOL_ROOT: "",
    });
    expect(existsSync(marker)).toBe(false);
    expect(result.status).not.toBe(0);
    assertNoSecrets(combined(result, ctx.mock, ctx.log));
  });

  it("rejeita outro UUID e Coolify fora da rede interna", () => {
    for (const extra of [
      { COOLIFY_APP_UUID: "outroapp123" },
      { COOLIFY_BASE_URL: "https://app.coolify.io" },
      { COOLIFY_BASE_URL: "http://8.8.8.8:8000" },
      { COOLIFY_BASE_URL: "http://172.32.0.1:8000" },
      { COOLIFY_BASE_URL: "http://token@127.0.0.1:8000" },
      { COOLIFY_BASE_URL: "http://127.0.0.1:8000/api" },
      { COOLIFY_TOKEN: "curto" },
    ]) {
      const ctx = arrange();
      const result = run({ ...ctx.env, ...extra });
      expect(result.status, JSON.stringify(extra)).not.toBe(0);
      expect(callsOf(ctx.mock).some((line) => line.startsWith("curl"))).toBe(false);
      assertNoSecrets(combined(result, ctx.mock, ctx.log));
    }
  });
});

describe("checklist 2 · attestation fail-closed nos dois digests", () => {
  it("chama gh attestation verify para app e migrate e exige o commit da main", () => {
    const ctx = arrange();
    const result = run(ctx.env);
    expect(result.status).toBe(0);
    const gh = callsOf(ctx.mock).filter((line) => line.startsWith("gh attestation verify"));
    expect(gh).toHaveLength(2);
    expect(gh.some((line) => line.includes(`oci://${APP_REPO}@${DIG_APP}`))).toBe(true);
    expect(gh.some((line) => line.includes(`oci://${MIG_REPO}@${DIG_MIG}`))).toBe(true);
    for (const line of gh) {
      expect(line).toContain("--repo diogenesmendes01/erp-genius");
      expect(line).toContain("--signer-workflow .github/workflows/image.yml");
      expect(line).toContain("--format json");
    }
    expect(readFileSync(join(ROOT, "lib/steps.sh"), "utf8")).toContain("timeout 60 gh attestation verify");
    expect(readFileSync(DEPLOY, "utf8")).toContain("set -euo pipefail");
  });

  it.each(["fail", "empty", "bad-commit", "no-main", "no-digest"])("digest não atestado (%s) aborta antes do backup e do Coolify", (mode) => {
    const ctx = arrange({ attest: mode });
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    const lines = callsOf(ctx.mock);
    expect(lines.some((line) => line.startsWith("pg_dump"))).toBe(false);
    expect(lines.some((line) => line.includes("PATCH"))).toBe(false);
    assertNoSecrets(combined(result, ctx.mock, ctx.log));
  });

  it("gh que falha ao abrir aborta antes do Coolify", () => {
    const ctx = arrange();
    writeFileSync(join(work, "bin/gh"), "#!/bin/sh\nexit 127\n");
    chmodSync(join(work, "bin/gh"), 0o755);
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    expect(callsOf(ctx.mock).some((line) => line.includes("PATCH"))).toBe(false);
    expect(result.stderr).toMatch(/falha ao ler a main|attestation falhou|ferramenta ausente/);
  });
});

describe("checklist 3 · digests e shas só entram se passarem na regex", () => {
  it("sha que não é 40 hex aborta", () => {
    const ctx = arrange({ commits: ["não-é-sha"] });
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("sha inválido");
    expect(callsOf(ctx.mock).some((line) => line.startsWith("curl"))).toBe(false);
  });

  it("digest fora do padrão aborta antes do PATCH", () => {
    const ctx = arrange({ digests: { [SHA_NEW]: { app: "sha256:zzzz", migrate: DIG_MIG } } });
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("digest inválido");
    expect(callsOf(ctx.mock).some((line) => line.includes("PATCH"))).toBe(false);
    assertNoSecrets(combined(result, ctx.mock, ctx.log));
  });

  it("valor anterior malformado não vira argumento de shell", () => {
    const ctx = arrange({
      migrateFail: true,
      previousMigrate: "$(touch pwned)",
      state: { sha: SHA_OLD, app: DIG_APP_PREV, migrate: DIG_MIG_PREV },
    });
    const marker = join(work, "pwned");
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    expect(existsSync(marker)).toBe(false);
    const text = callsOf(ctx.mock).join("\n");
    expect(text).not.toContain("touch");
    expect(text).not.toContain("pwned");
    expect(text).not.toContain(`"key": "APP_IMAGE"`);
    assertNoSecrets(combined(result, ctx.mock, ctx.log));
  });
});

describe("checklist 4 · rollback não mexe no banco", () => {
  it("o código não tem restore, reset, db push nem down-migration", () => {
    const blob = codeFiles().map((path) => readFileSync(path, "utf8")).join("\n");
    expect(blob).not.toMatch(/pg_restore|migrate reset|db push|migrate down/);
    const runbook = readFileSync(join(ROOT, "RUNBOOK.md"), "utf8");
    expect(runbook).toContain("pg_restore");
    expect(runbook).toMatch(/manual/i);
  });

  it("migrate que falha não troca APP_IMAGE e não faz redeploy", () => {
    const ctx = arrange({ migrateFail: true, state: { sha: SHA_OLD, app: DIG_APP_PREV, migrate: DIG_MIG_PREV } });
    const before = readFileSync(ctx.state, "utf8");
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    const lines = callsOf(ctx.mock);
    const patches = lines.filter((line) => line.includes("PATCH") && line.includes("/envs"));
    expect(patches.some((line) => line.includes("APP_MIGRATE_IMAGE") && line.includes(DIG_MIG))).toBe(true);
    expect(patches.some((line) => line.includes("APP_MIGRATE_IMAGE") && line.includes(DIG_MIG_PREV))).toBe(true);
    expect(patches.some((line) => line.includes("APP_IMAGE"))).toBe(false);
    expect(lines.some((line) => line.includes("/api/v1/deploy?"))).toBe(false);
    expect(lines.some((line) => line.includes("pg_restore"))).toBe(false);
    expect(readFileSync(ctx.state, "utf8")).toBe(before);
    assertNoSecrets(combined(result, ctx.mock, ctx.log));
  });

  it("health diferente do commit restaura os digests do state e não o banco", () => {
    const ctx = arrange({
      healthSha: SHA_OTHER,
      state: { sha: SHA_OLD, app: DIG_APP_PREV, migrate: DIG_MIG_PREV },
    });
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    const lines = callsOf(ctx.mock);
    const deploys = lines.filter((line) => line.includes("/api/v1/deploy?"));
    expect(deploys.length).toBeGreaterThanOrEqual(2);
    const patches = lines.filter((line) => line.includes("PATCH"));
    const lastMig = patches.filter((line) => line.includes("APP_MIGRATE_IMAGE")).at(-1) ?? "";
    const lastApp = patches.filter((line) => line.includes("APP_IMAGE") && !line.includes("APP_MIGRATE_IMAGE")).at(-1) ?? "";
    expect(lastMig).toContain(DIG_MIG_PREV);
    expect(lastApp).toContain(DIG_APP_PREV);
    expect(lines.join("\n")).not.toContain("pg_restore");
    const state = JSON.parse(readFileSync(ctx.state, "utf8")) as { sha: string };
    expect(state.sha).toBe(SHA_OLD);
    expect(JSON.parse(readFileSync(ctx.failed, "utf8")).sha).toBe(SHA_NEW);
    assertNoSecrets(combined(result, ctx.mock, ctx.log));
  });

  it("ready 503 também volta só os digests", () => {
    const ctx = arrange({
      ready: "503",
      state: { sha: SHA_OLD, app: DIG_APP_PREV, migrate: DIG_MIG_PREV },
    });
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    const lines = callsOf(ctx.mock);
    expect(lines.some((line) => line.includes(DIG_APP_PREV) && line.includes("APP_IMAGE"))).toBe(true);
    expect(lines.join("\n")).not.toContain("pg_restore");
    expect(JSON.parse(readFileSync(ctx.state, "utf8")).sha).toBe(SHA_OLD);
  });
});

describe("checklist 5 · flock e state atômico depois do health", () => {
  it("sem o lock sai 0 e não chama a API", async () => {
    const ctx = arrange();
    writeFileSync(ctx.lock, "");
    const holder = spawn("flock", [ctx.lock, "sleep", "30"], { detached: true, stdio: "ignore" });
    try {
      let held = false;
      for (let i = 0; i < 50; i += 1) {
        const probe = spawnSync("flock", ["-n", ctx.lock, "true"]);
        if (probe.status === 1) {
          held = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(held).toBe(true);
      const result = run(ctx.env);
      expect(result.status).toBe(0);
      expect(result.stderr).toContain('"event":"lock"');
      expect(callsOf(ctx.mock)).toEqual([]);
    } finally {
      if (holder.pid) {
        try {
          process.kill(-holder.pid, "SIGTERM");
        } catch {
          /* o holder já encerrou */
        }
      }
    }
  });

  it("grava o state com mktemp e mv só depois do health OK", () => {
    const ctx = arrange({ state: { sha: SHA_OLD, app: DIG_APP_PREV, migrate: DIG_MIG_PREV } });
    const result = run(ctx.env);
    expect(result.status).toBe(0);
    const lines = callsOf(ctx.mock);
    expect(lines).toContain("state-not-yet-new");
    expect(lines).not.toContain("state-already-new");
    const state = JSON.parse(readFileSync(ctx.state, "utf8")) as { sha: string; app_digest: string; migrate_digest: string };
    expect(state).toMatchObject({ sha: SHA_NEW, app_digest: DIG_APP, migrate_digest: DIG_MIG });
    expect(statSync(ctx.state).mode & 0o777).toBe(0o600);
    expect(readdirSync(join(work, "state")).some((name) => name.startsWith(".state."))).toBe(false);
    const steps = readFileSync(join(ROOT, "lib/steps.sh"), "utf8");
    expect(steps).toContain('mktemp "${dir}/.state.XXXXXX"');
    expect(steps).toContain('mv -f "$tmp" "$dest"');
    expect(readFileSync(DEPLOY, "utf8")).toContain("flock -n 9");
  });

  it("o mesmo SHA não é deployado de novo", () => {
    const ctx = arrange({ state: { sha: SHA_OLD, app: DIG_APP_PREV, migrate: DIG_MIG_PREV } });
    expect(run(ctx.env).status).toBe(0);
    writeFileSync(join(ctx.mock, "calls.log"), "");
    const again = run(ctx.env);
    expect(again.status).toBe(0);
    expect(again.stderr).toContain("ja_deployado");
    expect(callsOf(ctx.mock).some((line) => line.includes("PATCH") || line.startsWith("docker"))).toBe(false);
  });

  it("não repete um SHA que já falhou o health", () => {
    const ctx = arrange({
      healthSha: SHA_OTHER,
      state: { sha: SHA_OLD, app: DIG_APP_PREV, migrate: DIG_MIG_PREV },
    });
    expect(run(ctx.env).status).not.toBe(0);
    writeFileSync(join(ctx.mock, "calls.log"), "");
    const again = run(ctx.env);
    expect(again.status).toBe(0);
    expect(again.stderr).toContain("aguardar_correcao");
    expect(callsOf(ctx.mock).some((line) => line.includes("PATCH"))).toBe(false);
  });
});

describe("checklist 6 · backup com checksum, 0600 e retenção antes do migrate", () => {
  it("pg_dump falho aborta antes do migrate", () => {
    const ctx = arrange({ dumpFail: true });
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    const lines = callsOf(ctx.mock);
    expect(lines.some((line) => line.startsWith("pg_dump"))).toBe(true);
    expect(lines.some((line) => line.includes("PATCH") || line.startsWith("docker"))).toBe(false);
    expect(result.stderr).toContain("pg_dump falhou");
    assertNoSecrets(combined(result, ctx.mock, ctx.log));
  });

  it("grava dump 0600, confere checksum e apaga backup velho", () => {
    const ctx = arrange();
    const oldDump = join(ctx.backup, "velho.dump");
    const oldSum = join(ctx.backup, "velho.sha256");
    writeFileSync(oldDump, "velho");
    writeFileSync(oldSum, "x");
    spawnSync("touch", ["-d", "20 days ago", oldDump, oldSum]);
    const result = run(ctx.env);
    expect(result.status).toBe(0);
    expect(existsSync(oldDump)).toBe(false);
    expect(existsSync(oldSum)).toBe(false);
    const dumps = readdirSync(ctx.backup).filter((name) => name.endsWith(".dump"));
    expect(dumps).toHaveLength(1);
    const dump = join(ctx.backup, dumps[0]);
    expect(statSync(dump).mode & 0o777).toBe(0o600);
    expect(statSync(`${dump}.sha256`).mode & 0o777).toBe(0o600);
    expect(statSync(ctx.backup).mode & 0o777).toBe(0o700);
    const check = spawnSync("sha256sum", ["-c", `${dumps[0]}.sha256`], { cwd: ctx.backup, encoding: "utf8" });
    expect(check.status).toBe(0);
    expect(readdirSync(ctx.backup).some((name) => name.startsWith(".pgpass"))).toBe(false);
    const lines = callsOf(ctx.mock);
    const dumpAt = lines.findIndex((line) => line.startsWith("pg_dump"));
    const patchAt = lines.findIndex((line) => line.includes("PATCH"));
    expect(dumpAt).toBeGreaterThanOrEqual(0);
    expect(patchAt).toBeGreaterThan(dumpAt);
    assertNoSecrets(combined(result, ctx.mock, ctx.log));
  });
});

describe("checklist 7 · kill switch PAUSE", () => {
  it("não deploya quando /etc/erp-deployer/PAUSE está ativo no caminho configurado", () => {
    const ctx = arrange();
    writeFileSync(ctx.pause, "");
    const result = run(ctx.env);
    expect(result.status).toBe(0);
    expect(result.stderr).toContain('"event":"pause"');
    expect(callsOf(ctx.mock)).toEqual([]);
    expect(readFileSync(DEPLOY, "utf8")).toContain("/etc/erp-deployer/PAUSE");
    expect(readFileSync(join(ROOT, "RUNBOOK.md"), "utf8")).toContain("/etc/erp-deployer/PAUSE");
  });
});

describe("checklist 8 · systemd sem login e com sandbox", () => {
  it("unit, timer, sysusers e install.sh fecham o usuário", () => {
    const service = readFileSync(join(ROOT, "systemd/erp-deployer.service"), "utf8");
    expect(service).toContain("User=deployer");
    expect(service).toContain("Group=deployer");
    expect(service).toContain("NoNewPrivileges=yes");
    expect(service).toContain("ProtectSystem=strict");
    expect(service).toMatch(/^ReadWritePaths=\/var\/lib\/erp-deployer \/var\/backups\/erp-deployer$/m);
    expect(service).not.toContain("docker.sock");
    expect(service).toContain("Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin");
    const timer = readFileSync(join(ROOT, "systemd/erp-deployer.timer"), "utf8");
    expect(timer).toContain("OnUnitInactiveSec=90s");
    expect(readFileSync(join(ROOT, "systemd/erp-deployer.sysusers"), "utf8")).toContain("/usr/sbin/nologin");
    const install = readFileSync(join(ROOT, "install.sh"), "utf8");
    expect(install).toContain("useradd --system --shell /usr/sbin/nologin");
    expect(install).toContain("chmod 0600");
    expect(install).toContain("chown deployer:deployer");
    expect(install).not.toContain("systemctl enable");
  });

  it("install em DESTDIR deixa env 0600 e diretórios 0700", () => {
    work = mkdtempSync(join(tmpdir(), "erp-deployer-install-"));
    const result = spawnSync(join(ROOT, "install.sh"), [], {
      env: { ...process.env, DESTDIR: work, PATH: "/usr/bin:/bin" },
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(statSync(join(work, "etc/erp-deployer/env")).mode & 0o777).toBe(0o600);
    expect(statSync(join(work, "var/lib/erp-deployer")).mode & 0o777).toBe(0o700);
    expect(statSync(join(work, "var/backups/erp-deployer")).mode & 0o777).toBe(0o700);
    expect(statSync(join(work, "opt/erp-deployer/bin/deploy.sh")).mode & 0o777).toBe(0o755);
    expect(readFileSync(join(work, "etc/systemd/system/erp-deployer.service"), "utf8")).toContain("NoNewPrivileges=yes");
    expect(result.stdout).toMatch(/não foi habilitado/i);
  });
});

describe("fluxo · ordem, latest-wins, health e aviso", () => {
  it("dump, migrate, app, redeploy e health do commit esperado", () => {
    const ctx = arrange({ state: { sha: SHA_OLD, app: DIG_APP_PREV, migrate: DIG_MIG_PREV } });
    ctx.env.DEPLOY_NOTIFY_URL = "https://hooks.example.test/deploy";
    ctx.env.COOLIFY_BASE_URL = "http://172.16.5.5:8000";
    const result = run(ctx.env);
    expect(result.status).toBe(0);
    const lines = callsOf(ctx.mock);
    const at = (needle: string) => lines.findIndex((line) => line.includes(needle));
    const dumpAt = lines.findIndex((line) => line.startsWith("pg_dump"));
    const migPatch = lines.findIndex((line) => line.includes("PATCH") && line.includes("APP_MIGRATE_IMAGE") && line.includes(DIG_MIG));
    const dockerAt = lines.findIndex((line) => line.startsWith("docker run"));
    const appPatch = lines.findIndex((line) => line.includes("PATCH") && line.includes('"key": "APP_IMAGE"') && line.includes(DIG_APP));
    const deployAt = at(`/api/v1/deploy?uuid=${UUID}`);
    const healthAt = at("/api/health");
    const readyAt = at("/api/ready");
    const notifyAt = at("https://hooks.example.test/deploy");
    for (const pos of [dumpAt, migPatch, dockerAt, appPatch, deployAt, healthAt, readyAt, notifyAt]) {
      expect(pos).toBeGreaterThanOrEqual(0);
    }
    expect(dumpAt).toBeLessThan(migPatch);
    expect(migPatch).toBeLessThan(dockerAt);
    expect(dockerAt).toBeLessThan(appPatch);
    expect(appPatch).toBeLessThan(deployAt);
    expect(deployAt).toBeLessThan(healthAt);
    expect(healthAt).toBeLessThan(readyAt);
    expect(readyAt).toBeLessThan(notifyAt);
    expect(lines[dockerAt]).toContain("--network coolify");
    expect(lines[dockerAt]).toContain("prisma migrate deploy");
    expect(lines[dockerAt]).not.toContain("reset");
    expect(lines.some((line) => line.includes("http://172.16.5.5:8000/api/v1/services/"))).toBe(true);
    const logged = readFileSync(ctx.log, "utf8");
    expect(logged).toContain('"result":"success"');
    expect(logged).toContain(SHA_NEW);
    expect(logged).toContain(DIG_APP);
    expect(logged).toContain(DIG_MIG);
    expect(logged).toContain('"duration_ms":');
    assertNoSecrets(combined(result, ctx.mock, ctx.log));
  });

  it("ponta pendente não deploya o ancestral já verde", () => {
    const ctx = arrange({
      commits: [SHA_NEW, SHA_OLD],
      checks: { [SHA_NEW]: "pending", [SHA_OLD]: "success" },
    });
    const result = run(ctx.env);
    expect(result.status).toBe(0);
    const lines = callsOf(ctx.mock);
    expect(lines.some((line) => line.startsWith("gh attestation"))).toBe(false);
    expect(lines.some((line) => line.includes("PATCH"))).toBe(false);
    expect(result.stderr).toContain("pendente");
  });

  it("dois commits verdes deployam só o mais novo", () => {
    const oldApp = `sha256:${"e".repeat(64)}`;
    const oldMig = `sha256:${"f".repeat(64)}`;
    const ctx = arrange({
      commits: [SHA_NEW, SHA_OLD],
      checks: { [SHA_NEW]: "success", [SHA_OLD]: "success" },
      digests: {
        [SHA_NEW]: { app: DIG_APP, migrate: DIG_MIG },
        [SHA_OLD]: { app: oldApp, migrate: oldMig },
      },
      attestSha: SHA_NEW,
    });
    const result = run(ctx.env);
    expect(result.status).toBe(0);
    const text = callsOf(ctx.mock).join("\n");
    expect(text).toContain(DIG_APP);
    expect(text).toContain(DIG_MIG);
    expect(text).not.toContain(oldApp);
    expect(text).not.toContain(oldMig);
    expect(text).not.toContain(`/commits/${SHA_OLD}/check-runs`);
    assertNoSecrets(combined(result, ctx.mock, ctx.log));
  });

  it("falha de rede no GHCR aborta", () => {
    const ctx = arrange({ curlExit: true });
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    expect(callsOf(ctx.mock).some((line) => line.includes("PATCH"))).toBe(false);
  });

  it("aviso que falha não desfaz o deploy", () => {
    const ctx = arrange({ notifyFail: true });
    ctx.env.DEPLOY_NOTIFY_URL = "https://hooks.example.test/deploy";
    const result = run(ctx.env);
    expect(result.status).toBe(0);
    expect(JSON.parse(readFileSync(ctx.state, "utf8")).sha).toBe(SHA_NEW);
    expect(result.stderr).toContain('"event":"notify"');
  });

  it("os 5 checks batem com os jobs do image.yml", () => {
    const image = readFileSync(join(process.cwd(), ".github/workflows/image.yml"), "utf8");
    expect(image).toContain("name: typecheck");
    expect(image).toContain("name: lint");
    expect(image).toContain("name: test (${{ matrix.tz }})");
    expect(image).toContain("name: build Next.js");
    expect(image).toContain("tz: [UTC, America/Sao_Paulo]");
    const common = readFileSync(join(ROOT, "lib/common.sh"), "utf8");
    for (const name of CHECKS) expect(common).toContain(`"${name}"`);
  });

  it("nenhum script usa || true", () => {
    for (const path of codeFiles()) {
      const text = readFileSync(path, "utf8");
      expect(text, path).not.toMatch(/\|\|\s*true/);
      if (path.endsWith(".sh")) expect(text, path).toContain("set -euo pipefail");
    }
  });
});

describe("attest_check.py", () => {
  it("rejeita saída vazia", () => {
    const result = spawnSync("python3", [join(ROOT, "lib/py/attest_check.py")], {
      input: "   \n",
      encoding: "utf8",
      env: { ...process.env, EXPECTED_SHA: SHA_NEW, EXPECTED_DIGEST: DIG_APP },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("vazia");
  });
});
