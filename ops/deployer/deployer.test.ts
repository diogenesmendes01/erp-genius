import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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
const MIGRATE_SECRET = "migrate-secret-test";
const OTHER_SECRET = "super-segredo-coolify";
const SMOKE_COOKIE = "smoke-cookie-test-value-0123456789";
const NOTIFY_TOKEN = "notify-token-test-value-0123456789";
const SMOKE_PATH = "/api/inbox/nao-lidas";
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
if os.environ.get("LEAK_PROBE"):
    sys.stderr.write("ambiente herdado vazou\\n")
    sys.exit(1)
gh_token = os.environ.get("GH_TOKEN", "")
forbidden = ("DATABASE_URL", "SMOKE_COOKIE", "COOLIFY_TOKEN", "MIGRATE_DATABASE_URL", "DEPLOY_NOTIFY_TOKEN", "GHCR_TOKEN")
if not gh_token or any(os.environ.get(name) for name in forbidden):
    sys.stderr.write("gh sem allowlist\\n")
    sys.exit(1)
if not (mock / "gh-export-logged").exists():
    (mock / "gh-export-logged").write_text("1", encoding="utf-8")
    with calls.open("a", encoding="utf-8") as fh:
        fh.write("gh-token-exportado\\n")
        fh.write("gh-allowlist\\n")
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
    if "per_page=20" in blob and "commits?" in blob:
        sys.stdout.write((mock / "commits").read_text(encoding="utf-8"))
        sys.exit(0)
    if "per_page=100" in blob and "commits?" in blob:
        if (mock / "history-fail").exists():
            sys.exit(1)
        import re
        found_page = re.search(r"[?&]page=(\\d+)", blob)
        page = int(found_page.group(1)) if found_page else 1
        history_page = mock / f"history-page-{page}"
        if history_page.exists():
            sys.stdout.write(history_page.read_text(encoding="utf-8"))
            sys.exit(0)
        if page == 1:
            sys.stdout.write((mock / "commits").read_text(encoding="utf-8"))
            sys.exit(0)
        sys.exit(0)
    if "/pulls" in blob:
        import re
        found = re.search(r"commits/([a-f0-9]{40})/pulls", blob)
        if not found:
            sys.exit(1)
        labels = mock / f"labels-{found.group(1)}"
        if labels.exists():
            sys.stdout.write(labels.read_text(encoding="utf-8"))
        sys.exit(0)
    if "/compare/" in blob:
        if (mock / "compare-fail").exists():
            sys.exit(1)
        import re
        found_page = re.search(r"[?&]page=(\\d+)", blob)
        page = int(found_page.group(1)) if found_page else 1
        compare_page = mock / f"compare-page-{page}"
        if compare_page.exists():
            sys.stdout.write(compare_page.read_text(encoding="utf-8"))
            sys.exit(0)
        if page == 1 and (mock / "compare-shas").exists():
            sys.stdout.write((mock / "compare-shas").read_text(encoding="utf-8"))
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
    fail_substr = mock / "attest-fail-substr"
    if fail_substr.exists() and fail_substr.read_text(encoding="utf-8").strip() in oci:
        sys.stderr.write("verify failed\\n")
        sys.exit(1)
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
import os, sys, time
from pathlib import Path
mock = Path(os.environ["MOCK_DIR"])
calls = mock / "calls.log"
if os.environ.get("LEAK_PROBE"):
    sys.stderr.write("ambiente herdado vazou\\n")
    sys.exit(1)
forbidden = ("DATABASE_URL", "SMOKE_COOKIE", "COOLIFY_TOKEN", "MIGRATE_DATABASE_URL", "DEPLOY_NOTIFY_TOKEN", "GHCR_TOKEN", "GH_TOKEN")
if any(os.environ.get(name) for name in forbidden):
    sys.stderr.write("curl com variavel fora da allowlist\\n")
    sys.exit(1)
if (mock / "curl-exit").exists():
    sys.exit(1)
args = sys.argv[1:]
for arg in args:
    if "Bearer " in arg or arg.startswith("Authorization:") or arg.startswith("Cookie:") or arg.startswith("DATABASE_URL="):
        sys.stderr.write("argv com segredo\\n")
        sys.exit(2)
idx = 0
while idx < len(args):
    if args[idx] == "-H" and idx + 1 < len(args) and args[idx + 1].startswith("@"):
        header_path = Path(args[idx + 1][1:])
        mode = header_path.stat().st_mode & 0o777
        if mode != 0o600:
            sys.stderr.write("header sem 0600\\n")
            sys.exit(3)
        with calls.open("a", encoding="utf-8") as fh:
            fh.write("curl-header-0600\\n")
    idx += 1
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
header_texts = []
idx = 0
while idx < len(args):
    if args[idx] == "-H" and idx + 1 < len(args) and args[idx + 1].startswith("@"):
        header_texts.append(Path(args[idx + 1][1:]).read_text(encoding="utf-8"))
    idx += 1
def header_ok(prefix):
    for text in header_texts:
        if text.startswith(prefix) and len(text.strip()) >= len(prefix) + 16:
            return True
    return False
sleep_url = (mock / "curl-sleep-url").read_text(encoding="utf-8").strip() if (mock / "curl-sleep-url").exists() else ""
if sleep_url and sleep_url in url and not (mock / "curl-slept").exists():
    paths = []
    idx = 0
    while idx < len(args):
        if args[idx] == "-H" and idx + 1 < len(args) and args[idx + 1].startswith("@"):
            paths.append(args[idx + 1][1:])
        idx += 1
    (mock / "curl-headers").write_text("\\n".join(paths), encoding="utf-8")
    (mock / "curl-sleeping").write_text(url, encoding="utf-8")
    (mock / "curl-slept").write_text("1", encoding="utf-8")
    time.sleep(30)
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
    code = (mock / "envs-get-code").read_text(encoding="utf-8").strip() if (mock / "envs-get-code").exists() else "200"
    resp = (mock / "envs.json").read_text(encoding="utf-8") if code == "200" else ""
elif url.endswith("/envs") and method == "PATCH":
    code = "201"
    if "APP_MIGRATE_IMAGE" in body and (mock / "patch-migrate-code").exists():
        code = (mock / "patch-migrate-code").read_text(encoding="utf-8").strip()
    elif "APP_IMAGE" in body and (mock / "patch-app-code").exists():
        code = (mock / "patch-app-code").read_text(encoding="utf-8").strip()
    resp = "{}"
elif "/api/v1/deploy?" in url and method == "POST":
    code = "500" if (mock / "deploy-fail").exists() else "200"
    resp = '{"deployments":[]}'
elif url.endswith("${SMOKE_PATH}"):
    if header_ok("Cookie: "):
        code = (mock / "smoke-code").read_text(encoding="utf-8").strip() if (mock / "smoke-code").exists() else "200"
        with calls.open("a", encoding="utf-8") as fh:
            fh.write("smoke-cookie-ok\\n")
    else:
        code = "401"
        with calls.open("a", encoding="utf-8") as fh:
            fh.write("smoke-sem-cookie\\n")
    resp = '{"total":0}'
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
    if header_ok("Authorization: Bearer "):
        code = "500" if (mock / "notify-fail").exists() else "204"
        with calls.open("a", encoding="utf-8") as fh:
            fh.write("notify-auth-ok\\n")
    else:
        code = "401"
        with calls.open("a", encoding="utf-8") as fh:
            fh.write("notify-sem-token\\n")
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
args = sys.argv[1:]
if os.environ.get("LEAK_PROBE"):
    sys.stderr.write("ambiente herdado vazou\\n")
    sys.exit(1)
forbidden = ("SMOKE_COOKIE", "COOLIFY_TOKEN", "MIGRATE_DATABASE_URL", "DEPLOY_NOTIFY_TOKEN", "GHCR_TOKEN", "GH_TOKEN")
if any(os.environ.get(name) for name in forbidden):
    sys.stderr.write("docker com variavel fora da allowlist\\n")
    sys.exit(1)
if "--env-file" in args and os.environ.get("DATABASE_URL"):
    sys.stderr.write("docker com DATABASE_URL no ambiente\\n")
    sys.exit(1)
for arg in args:
    if arg.startswith("DATABASE_URL=") or "Bearer " in arg or arg.startswith("Cookie:"):
        sys.stderr.write("argv com segredo\\n")
        sys.exit(2)
safe = []
idx = 0
while idx < len(args):
    if args[idx] == "--env-file" and idx + 1 < len(args):
        env_path = Path(args[idx + 1])
        mode = env_path.stat().st_mode & 0o777
        text = env_path.read_text(encoding="utf-8")
        if mode == 0o600 and text.startswith("DATABASE_URL=postgres") and "@db:" in text:
            with (mock / "calls.log").open("a", encoding="utf-8") as fh:
                fh.write("docker-env-file-ok\\n")
        safe.extend(["--env-file", args[idx + 1]])
        idx += 2
        continue
    safe.append(args[idx])
    idx += 1
with (mock / "calls.log").open("a", encoding="utf-8") as fh:
    fh.write("docker " + " ".join(safe) + "\\n")
if args[:1] == ["pull"]:
    sys.exit(0)
if args[:1] == ["run"]:
    if "--env-file" not in args and "DATABASE_URL" in args and not os.environ.get("DATABASE_URL", "").startswith("postgres"):
        sys.stderr.write("docker sem DATABASE_URL\\n")
        sys.exit(1)
    if "--env-file" not in args and "DATABASE_URL" in args:
        with (mock / "calls.log").open("a", encoding="utf-8") as fh:
            fh.write("docker-saw-database-url\\n")
    sys.exit(1 if (mock / "migrate-fail").exists() else 0)
sys.exit(1)
`);
  writeFileSync(join(dir, "pg_dump"), `#!/usr/bin/env python3
import os, sys
from pathlib import Path
mock = Path(os.environ["MOCK_DIR"])
if os.environ.get("LEAK_PROBE"):
    sys.stderr.write("ambiente herdado vazou\\n")
    sys.exit(1)
if os.environ.get("DATABASE_URL") or os.environ.get("SMOKE_COOKIE") or os.environ.get("COOLIFY_TOKEN") or os.environ.get("GH_TOKEN"):
    sys.stderr.write("pg_dump com variavel fora da allowlist\\n")
    sys.exit(1)
if not os.environ.get("PGPASSFILE"):
    sys.stderr.write("pg_dump sem PGPASSFILE\\n")
    sys.exit(1)
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
  writeFileSync(join(dir, "pg_restore"), `#!/usr/bin/env python3
import os, sys
from pathlib import Path
mock = Path(os.environ["MOCK_DIR"])
if os.environ.get("LEAK_PROBE"):
    sys.stderr.write("ambiente herdado vazou\\n")
    sys.exit(1)
if os.environ.get("DATABASE_URL") or os.environ.get("SMOKE_COOKIE") or os.environ.get("COOLIFY_TOKEN"):
    sys.stderr.write("pg_restore com variavel fora da allowlist\\n")
    sys.exit(1)
with (mock / "calls.log").open("a", encoding="utf-8") as fh:
    fh.write("pg_restore " + " ".join(sys.argv[1:]) + "\\n")
if (mock / "list-fail").exists():
    sys.exit(1)
if "--list" not in sys.argv:
    sys.exit(2)
sys.exit(0)
`);
  for (const name of ["gh", "curl", "docker", "pg_dump", "pg_restore"]) chmodSync(join(dir, name), 0o755);
}

type Scene = {
  commits?: string[];
  checks?: Record<string, Verdict>;
  digests?: Record<string, { app: string; migrate: string }>;
  attest?: string;
  attestSha?: string;
  attestFailSubstr?: string;
  healthSha?: string;
  ready?: string;
  previousApp?: string;
  previousMigrate?: string;
  migrateFail?: boolean;
  dumpFail?: boolean;
  curlExit?: boolean;
  notifyFail?: boolean;
  listFail?: boolean;
  deployFail?: boolean;
  smoke?: string;
  envsGetCode?: string;
  patchMigrateCode?: string;
  patchAppCode?: string;
  contract?: boolean;
  migrateUrl?: boolean;
  state?: { sha: string; app: string; migrate: string } | null;
};

type EnvMap = Record<string, string>;

function materializeEnv(file: string, values: EnvMap): void {
  writeFileSync(file, Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n") + "\n");
  chmodSync(file, 0o600);
}

function arrange(scene: Scene = {}): {
  mock: string;
  env: NodeJS.ProcessEnv;
  envFile: string;
  envValues: EnvMap;
  state: string;
  backup: string;
  log: string;
  pause: string;
  lock: string;
  failed: string;
} {
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
  if (scene.attestFailSubstr) writeFileSync(join(mock, "attest-fail-substr"), scene.attestFailSubstr);
  writeFileSync(join(mock, "health-sha"), scene.healthSha ?? (scene.attestSha ?? commits[0]));
  if (scene.ready) writeFileSync(join(mock, "ready-code"), scene.ready);
  if (scene.migrateFail) writeFileSync(join(mock, "migrate-fail"), "1");
  if (scene.dumpFail) writeFileSync(join(mock, "dump-fail"), "1");
  if (scene.curlExit) writeFileSync(join(mock, "curl-exit"), "1");
  if (scene.notifyFail) writeFileSync(join(mock, "notify-fail"), "1");
  if (scene.listFail) writeFileSync(join(mock, "list-fail"), "1");
  if (scene.deployFail) writeFileSync(join(mock, "deploy-fail"), "1");
  if (scene.smoke) writeFileSync(join(mock, "smoke-code"), scene.smoke);
  if (scene.envsGetCode) writeFileSync(join(mock, "envs-get-code"), scene.envsGetCode);
  if (scene.patchMigrateCode) writeFileSync(join(mock, "patch-migrate-code"), scene.patchMigrateCode);
  if (scene.patchAppCode) writeFileSync(join(mock, "patch-app-code"), scene.patchAppCode);
  if (scene.contract) writeFileSync(join(mock, `labels-${commits[0]}`), "migration-contract\n");
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
  const envFile = join(work, "env");
  const envValues: EnvMap = {
    COOLIFY_TOKEN,
    GHCR_TOKEN,
    COOLIFY_BASE_URL: "http://127.0.0.1:8000",
    APP_BASE_URL: "https://127.0.0.1:3000",
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
    SMOKE_COOKIE,
    SMOKE_PATH,
  };
  if (scene.migrateUrl) {
    envValues.MIGRATE_DATABASE_URL = `postgresql://erp:${MIGRATE_SECRET}@db:5432/erp`;
  }
  materializeEnv(envFile, envValues);
  const env: NodeJS.ProcessEnv = {
    PATH: `${bin}:/usr/bin:/bin`,
    HOME: work,
    NODE_ENV: "test",
    TMPDIR: work,
    LANG: "C.UTF-8",
    MOCK_DIR: mock,
    DEPLOYER_TOOL_ROOT: bin,
    DEPLOYER_ENV_FILE: envFile,
  };
  return { mock, env, envFile, envValues, state, backup, log, pause, lock, failed };
}

function run(env: NodeJS.ProcessEnv) {
  return spawnSync(DEPLOY, [], { env, encoding: "utf8" });
}

const AFTER_BACKUP = "  arm_pos_backup\n  coolify_ler_imagens\n";

function runAfterBackup(env: NodeJS.ProcessEnv, command: string) {
  const copy = join(ROOT, "bin", `.deploy-after-backup-${process.pid}.sh`);
  const source = readFileSync(DEPLOY, "utf8");
  if (!source.includes(AFTER_BACKUP)) {
    throw new Error("arm_pos_backup não é seguido de coolify_ler_imagens");
  }
  writeFileSync(copy, source.replace(AFTER_BACKUP, `  arm_pos_backup\n  ${command}\n  coolify_ler_imagens\n`));
  chmodSync(copy, 0o755);
  try {
    return spawnSync(copy, [], { env, encoding: "utf8" });
  } finally {
    rmSync(copy, { force: true });
  }
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
  for (const secret of [COOLIFY_TOKEN, GHCR_TOKEN, DB_SECRET, MIGRATE_SECRET, OTHER_SECRET, SMOKE_COOKIE, NOTIFY_TOKEN]) {
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
    const result = run({ ...ctx.env, DEPLOYER_ENV_FILE: envFile, DEPLOYER_TOOL_ROOT: "" });
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
      "APP_BASE_URL=https://127.0.0.1:3000",
      `DATABASE_URL=postgresql://erp:${DB_SECRET}@127.0.0.1:5432/erp`,
      `SMOKE_COOKIE=${SMOKE_COOKIE}`,
      `SMOKE_PATH=${SMOKE_PATH}`,
    ].join("\n") + "\n");
    chmodSync(envFile, 0o600);
    const result = run({
      ...ctx.env,
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
      { APP_BASE_URL: "http://127.0.0.1:3000" },
    ] as Array<Record<string, string>>) {
      const ctx = arrange();
      if (extra.COOLIFY_APP_UUID) ctx.env.COOLIFY_APP_UUID = extra.COOLIFY_APP_UUID;
      if (extra.COOLIFY_BASE_URL) ctx.envValues.COOLIFY_BASE_URL = extra.COOLIFY_BASE_URL;
      if (extra.COOLIFY_TOKEN) ctx.envValues.COOLIFY_TOKEN = extra.COOLIFY_TOKEN;
      if (extra.APP_BASE_URL) ctx.envValues.APP_BASE_URL = extra.APP_BASE_URL;
      materializeEnv(ctx.envFile, ctx.envValues);
      const result = run(ctx.env);
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
    expect(blob).not.toMatch(/migrate reset|db push|migrate down/);
    expect(blob).toContain("pg_restore --list");
    expect(blob).not.toContain("--dbname");
    expect(blob).not.toContain("--clean");
    expect(blob).not.toContain("pg_restore --clean");
    const runbook = readFileSync(join(process.cwd(), "docs/ops/deploy-auto.md"), "utf8");
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
    expect(lines.join("\n")).not.toContain("pg_restore --clean");
    expect(lines.join("\n")).not.toContain("--dbname");
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
    expect(lines.join("\n")).not.toContain("pg_restore --clean");
    expect(lines.join("\n")).not.toContain("--dbname");
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
    expect(lines.join("\n")).not.toContain("pg_restore --clean");
    expect(lines.join("\n")).not.toContain("--dbname");
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
    expect(readFileSync(join(process.cwd(), "docs/ops/deploy-auto.md"), "utf8")).toContain("/etc/erp-deployer/PAUSE");
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
    expect(statSync(join(work, "usr/local/sbin/erp-deployer")).mode & 0o777).toBe(0o755);
    expect(readFileSync(join(work, "etc/systemd/system/erp-deployer.service"), "utf8")).toContain("NoNewPrivileges=yes");
    expect(result.stdout).toMatch(/não foi habilitado/i);
  });
});

describe("fluxo · ordem, latest-wins, health e aviso", () => {
  it("dump, migrate, app, redeploy e health do commit esperado", () => {
    const ctx = arrange({ state: { sha: SHA_OLD, app: DIG_APP_PREV, migrate: DIG_MIG_PREV } });
    ctx.envValues.DEPLOY_NOTIFY_URL = "https://hooks.example.test/deploy";
    ctx.envValues.DEPLOY_NOTIFY_TOKEN = NOTIFY_TOKEN;
    ctx.envValues.COOLIFY_BASE_URL = "http://172.16.5.5:8000";
    materializeEnv(ctx.envFile, ctx.envValues);
    const result = run(ctx.env);
    expect(result.status).toBe(0);
    const lines = callsOf(ctx.mock);
    const at = (needle: string) => lines.findIndex((line) => line.includes(needle));
    const dumpAt = lines.findIndex((line) => line.startsWith("pg_dump"));
    const listAt = lines.findIndex((line) => line.startsWith("pg_restore --list"));
    const migPatch = lines.findIndex((line) => line.includes("PATCH") && line.includes("APP_MIGRATE_IMAGE") && line.includes(DIG_MIG));
    const dockerAt = lines.findIndex((line) => line.startsWith("docker run"));
    const appPatch = lines.findIndex((line) => line.includes("PATCH") && line.includes('"key": "APP_IMAGE"') && line.includes(DIG_APP));
    const deployAt = at(`/api/v1/deploy?uuid=${UUID}`);
    const healthAt = at("/api/health");
    const readyAt = at("/api/ready");
    const smokeAt = at(SMOKE_PATH);
    const notifyAt = at("https://hooks.example.test/deploy");
    for (const pos of [dumpAt, listAt, migPatch, dockerAt, appPatch, deployAt, healthAt, readyAt, smokeAt, notifyAt]) {
      expect(pos).toBeGreaterThanOrEqual(0);
    }
    expect(dumpAt).toBeLessThan(listAt);
    expect(listAt).toBeLessThan(migPatch);
    expect(migPatch).toBeLessThan(dockerAt);
    expect(dockerAt).toBeLessThan(appPatch);
    expect(appPatch).toBeLessThan(deployAt);
    expect(deployAt).toBeLessThan(healthAt);
    expect(healthAt).toBeLessThan(readyAt);
    expect(readyAt).toBeLessThan(smokeAt);
    expect(smokeAt).toBeLessThan(notifyAt);
    const compareAt = lines.findIndex((line) => line.includes("/compare/"));
    expect(compareAt).toBeGreaterThanOrEqual(0);
    expect(compareAt).toBeLessThan(dumpAt);
    expect(lines).toContain("smoke-cookie-ok");
    expect(lines).toContain("notify-auth-ok");
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
    ctx.envValues.DEPLOY_NOTIFY_URL = "https://hooks.example.test/deploy";
    ctx.envValues.DEPLOY_NOTIFY_TOKEN = NOTIFY_TOKEN;
    materializeEnv(ctx.envFile, ctx.envValues);
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

describe("BLOCK-DEPLOY · env, argv, restore, contrato, smoke e pause", () => {
  it("env file real chega em pgpass, docker e gh, e o argv não leva segredo", () => {
    const ctx = arrange({ migrateUrl: true });
    expect(ctx.env.COOLIFY_TOKEN).toBeUndefined();
    expect(ctx.env.GHCR_TOKEN).toBeUndefined();
    expect(ctx.env.DATABASE_URL).toBeUndefined();
    expect(ctx.env.MIGRATE_DATABASE_URL).toBeUndefined();
    expect(readFileSync(DEPLOY, "utf8")).not.toContain("DEPLOYER_SKIP_ENV_FILE");
    const result = run(ctx.env);
    expect(result.status).toBe(0);
    const lines = callsOf(ctx.mock);
    expect(lines).toContain("gh-token-exportado");
    expect(lines).toContain("docker-env-file-ok");
    expect(lines.some((line) => line.startsWith("pg_dump"))).toBe(true);
    expect(lines.some((line) => line === "curl-header-0600")).toBe(true);
    for (const line of lines) {
      expect(line).not.toContain("Authorization:");
      expect(line).not.toContain("Bearer ");
      expect(line).not.toContain("Cookie:");
      expect(line).not.toContain("DATABASE_URL=");
    }
    assertNoSecrets(combined(result, ctx.mock, ctx.log));
  });

  it("pg_restore --list que falha aborta antes do migrate", () => {
    const ctx = arrange({ listFail: true });
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("pg_restore --list falhou");
    const lines = callsOf(ctx.mock);
    expect(lines.some((line) => line.startsWith("pg_dump"))).toBe(true);
    expect(lines.some((line) => line.startsWith("pg_restore --list"))).toBe(true);
    expect(lines.some((line) => line.includes("PATCH") || line.startsWith("docker"))).toBe(false);
  });

  it("migration-contract no commit ou num ancestral exige deploy manual", () => {
    const direct = arrange({ contract: true });
    const blocked = run(direct.env);
    expect(blocked.status).not.toBe(0);
    expect(blocked.stderr).toContain("deploy manual");
    expect(callsOf(direct.mock).some((line) => line.includes("PATCH") || line.startsWith("docker run") || line.startsWith("pg_dump"))).toBe(false);
    expect(JSON.parse(readFileSync(direct.failed, "utf8")).sha).toBe(SHA_NEW);
    const ctx = arrange({
      commits: [SHA_NEW, SHA_OLD],
      state: { sha: SHA_OLD, app: DIG_APP_PREV, migrate: DIG_MIG_PREV },
    });
    writeFileSync(join(ctx.mock, "compare-shas"), `${SHA_OTHER}\n`);
    writeFileSync(join(ctx.mock, `labels-${SHA_OTHER}`), "migration-contract\n");
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("deploy manual");
    expect(callsOf(ctx.mock).some((line) => line.startsWith("docker run") || line.startsWith("pg_dump"))).toBe(false);
    expect(readFileSync(join(process.cwd(), "docs/ops/deploy-auto.md"), "utf8")).toContain("migration-contract");
  });

  it("smoke autenticado que falha aciona rollback", () => {
    const ctx = arrange({
      smoke: "401",
      state: { sha: SHA_OLD, app: DIG_APP_PREV, migrate: DIG_MIG_PREV },
    });
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    const lines = callsOf(ctx.mock);
    expect(lines.some((line) => line.includes(SMOKE_PATH))).toBe(true);
    expect(lines.some((line) => line.includes(DIG_APP_PREV) && line.includes("APP_IMAGE"))).toBe(true);
    expect(lines.join("\n")).not.toContain(SMOKE_COOKIE);
    expect(JSON.parse(readFileSync(ctx.state, "utf8")).sha).toBe(SHA_OLD);
    expect(JSON.parse(readFileSync(ctx.failed, "utf8")).sha).toBe(SHA_NEW);
  });

  it("primeiro deploy sem state restaura as imagens que o Coolify já tinha", () => {
    const ctx = arrange({ healthSha: SHA_OTHER });
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    const lines = callsOf(ctx.mock);
    expect(lines.filter((line) => line.includes("/api/v1/deploy?")).length).toBeGreaterThanOrEqual(2);
    expect(lines.some((line) => line.includes(DIG_APP_PREV) && line.includes('"key": "APP_IMAGE"'))).toBe(true);
    expect(result.stderr).toContain('"event":"rollback"');
  });

  it("Coolify que recusa o deploy restaura os digests anteriores", () => {
    const ctx = arrange({
      deployFail: true,
      state: { sha: SHA_OLD, app: DIG_APP_PREV, migrate: DIG_MIG_PREV },
    });
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    const lines = callsOf(ctx.mock);
    expect(lines.some((line) => line.includes(DIG_MIG_PREV) && line.includes("APP_MIGRATE_IMAGE"))).toBe(true);
    expect(lines.some((line) => line.includes(DIG_APP_PREV) && line.includes('"key": "APP_IMAGE"'))).toBe(true);
    expect(result.stderr).toContain("coolify_falhou");
  });

  it("nome de check repetido entre workflows fica fail-closed", () => {
    const ctx = arrange();
    writeFileSync(join(ctx.mock, `checks-${SHA_NEW}`), `${checksFile("success")}typecheck\tcompleted\tfailure\n`);
    const result = run(ctx.env);
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("nenhum_verde");
    expect(callsOf(ctx.mock).some((line) => line.includes("PATCH"))).toBe(false);
  });

  it("pause cria o arquivo e para o timer; resume só religa se o timer já estava habilitado", () => {
    work = mkdtempSync(join(tmpdir(), "erp-deployer-pause-"));
    const bin = join(work, "bin");
    const pause = join(work, "PAUSE");
    const log = join(work, "sys.log");
    const enabled = join(work, "enabled");
    mkdirSync(bin);
    writeFileSync(join(bin, "systemctl"), `#!/bin/sh
printf '%s\\n' "$*" >> ${log}
if [ "$1" = "is-enabled" ]; then
  if [ -f ${enabled} ]; then exit 0; fi
  exit 1
fi
exit 0
`);
    chmodSync(join(bin, "systemctl"), 0o755);
    const env = { PATH: `${bin}:/usr/bin:/bin`, HOME: work, NODE_ENV: "test" as const, DEPLOYER_PAUSE_FILE: pause };
    const script = join(ROOT, "bin/erp-deployer");
    expect(spawnSync(script, ["pause"], { env, encoding: "utf8" }).status).toBe(0);
    expect(existsSync(pause)).toBe(true);
    const stopped = readFileSync(log, "utf8");
    expect(stopped).toContain("stop erp-deployer.timer");
    expect(stopped).toContain("stop erp-deployer.service");
    writeFileSync(log, "");
    expect(spawnSync(script, ["resume"], { env, encoding: "utf8" }).status).toBe(0);
    expect(existsSync(pause)).toBe(false);
    expect(readFileSync(log, "utf8")).not.toContain("start erp-deployer.timer");
    writeFileSync(pause, "");
    writeFileSync(enabled, "");
    writeFileSync(log, "");
    expect(spawnSync(script, ["resume"], { env, encoding: "utf8" }).status).toBe(0);
    expect(existsSync(pause)).toBe(false);
    expect(readFileSync(log, "utf8")).toContain("start erp-deployer.timer");
    expect(readFileSync(script, "utf8")).not.toContain("systemctl enable");
  });
});

function hexSha(n: number): string {
  return n.toString(16).padStart(40, "0");
}

function expectNoRetryDump(ctx: ReturnType<typeof arrange>, dumpedOnce: boolean): void {
  const first = callsOf(ctx.mock).filter((line) => line.startsWith("pg_dump"));
  expect(first).toHaveLength(dumpedOnce ? 1 : 0);
  expect(JSON.parse(readFileSync(ctx.failed, "utf8")).sha).toBe(SHA_NEW);
  writeFileSync(join(ctx.mock, "calls.log"), "");
  const again = run(ctx.env);
  expect(again.status).toBe(0);
  expect(again.stderr).toContain("aguardar_correcao");
  expect(callsOf(ctx.mock).some((line) => line.startsWith("pg_dump"))).toBe(false);
}

describe("QA R2 · mutações, trap, marcador e histórico", () => {
  it("smoke sem o cookie falha e faz rollback", () => {
    const ctx = arrange({
      state: { sha: SHA_OLD, app: DIG_APP_PREV, migrate: DIG_MIG_PREV },
    });
    const bin = join(work, "bin");
    renameSync(join(bin, "curl"), join(bin, "curl.real"));
    writeFileSync(join(bin, "curl"), `#!/usr/bin/env python3
import os, sys
from pathlib import Path
args = []
raw = sys.argv[1:]
idx = 0
while idx < len(raw):
    if raw[idx] == "-H" and idx + 1 < len(raw) and raw[idx + 1].startswith("@"):
        text = Path(raw[idx + 1][1:]).read_text(encoding="utf-8")
        if text.startswith("Cookie:"):
            idx += 2
            continue
    args.append(raw[idx])
    idx += 1
os.execv("${join(bin, "curl.real")}", ["curl.real", *args])
`);
    chmodSync(join(bin, "curl"), 0o755);
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    const lines = callsOf(ctx.mock);
    expect(lines).toContain("smoke-sem-cookie");
    expect(lines.some((line) => line.includes(DIG_APP_PREV) && line.includes("APP_IMAGE"))).toBe(true);
    expect(JSON.parse(readFileSync(ctx.state, "utf8")).sha).toBe(SHA_OLD);
    expect(JSON.parse(readFileSync(ctx.failed, "utf8")).sha).toBe(SHA_NEW);
    expect(lines.join("\n")).not.toContain(SMOKE_COOKIE);
  });

  it("webhook sem token falha antes do backup", () => {
    const ctx = arrange();
    ctx.envValues.DEPLOY_NOTIFY_URL = "https://hooks.example.test/deploy";
    materializeEnv(ctx.envFile, ctx.envValues);
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("DEPLOY_NOTIFY_TOKEN");
    expect(callsOf(ctx.mock).some((line) => line.startsWith("pg_dump") || line.includes("PATCH"))).toBe(false);
    expect(callsOf(ctx.mock)).not.toContain("notify-auth-ok");
  });

  it("check duplicado não deixa o último sucesso vencer", () => {
    const ctx = arrange();
    const rows = checksFile("success").trim().split("\n").map((line) => (
      line.startsWith("typecheck\t") ? "typecheck\tcompleted\tfailure" : line
    ));
    rows.push("typecheck\tcompleted\tsuccess");
    writeFileSync(join(ctx.mock, `checks-${SHA_NEW}`), `${rows.join("\n")}\n`);
    const result = run(ctx.env);
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("nenhum_verde");
    expect(callsOf(ctx.mock).some((line) => line.includes("PATCH") || line.startsWith("pg_dump"))).toBe(false);
  });

  it("o job typecheck do ci.yml inclui tsc -p ops/deployer", () => {
    const ci = readFileSync(join(process.cwd(), ".github/workflows/ci.yml"), "utf8");
    expect(ci).toContain("name: typecheck");
    expect(ci).toContain("tsc -p ops/deployer");
  });

  it("trap EXIT INT TERM apaga o header do token se o processo morre no GHCR", async () => {
    const ctx = arrange();
    writeFileSync(join(ctx.mock, "curl-sleep-url"), "ghcr.io");
    await expectSecretGoneAfterTerm(ctx.env, ctx.mock);
  });

  it("trap EXIT INT TERM apaga o header do cookie se o processo morre no smoke", async () => {
    const ctx = arrange();
    writeFileSync(join(ctx.mock, "curl-sleep-url"), SMOKE_PATH);
    await expectSecretGoneAfterTerm(ctx.env, ctx.mock);
  });

  it("migration-contract grava o marcador antes do backup e não repete o pg_dump", () => {
    const ctx = arrange({ contract: true });
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("deploy manual");
    expectNoRetryDump(ctx, false);
  });

  it("dump corrompido grava o marcador e o retry não chama pg_dump", () => {
    const ctx = arrange({ listFail: true });
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("pg_restore --list falhou");
    expectNoRetryDump(ctx, true);
  });

  it("migrate que falha grava o marcador e o retry não chama pg_dump", () => {
    const ctx = arrange({ migrateFail: true });
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    expectNoRetryDump(ctx, true);
  });

  it("clear-failed e resume apagam o marcador do SHA", () => {
    work = mkdtempSync(join(tmpdir(), "erp-deployer-clear-"));
    const failed = join(work, "state.json.failed");
    const pause = join(work, "PAUSE");
    writeFileSync(failed, "{}\n");
    const script = join(ROOT, "bin/erp-deployer");
    const env = { PATH: "/usr/bin:/bin", HOME: work, NODE_ENV: "test" as const, DEPLOYER_FAILED_FILE: failed, DEPLOYER_PAUSE_FILE: pause };
    expect(spawnSync(script, ["clear-failed"], { env, encoding: "utf8" }).status).toBe(0);
    expect(existsSync(failed)).toBe(false);
    writeFileSync(failed, "{}\n");
    writeFileSync(pause, "");
    expect(spawnSync(script, ["resume"], { env, encoding: "utf8" }).status).toBe(0);
    expect(existsSync(failed)).toBe(false);
    expect(existsSync(pause)).toBe(false);
  });

  it("no primeiro deploy o guard lê o histórico e não só o commit candidato", () => {
    const ctx = arrange({ commits: [SHA_NEW, SHA_OLD] });
    writeFileSync(join(ctx.mock, `labels-${SHA_OLD}`), "migration-contract\n");
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("deploy manual");
    expect(callsOf(ctx.mock).some((line) => line.includes(`/commits/${SHA_OLD}/pulls`))).toBe(true);
    expect(callsOf(ctx.mock).some((line) => line.startsWith("pg_dump"))).toBe(false);
    expect(JSON.parse(readFileSync(ctx.failed, "utf8")).sha).toBe(SHA_NEW);
  });

  it("histórico indisponível no primeiro deploy falha fechado", () => {
    const ctx = arrange();
    writeFileSync(join(ctx.mock, "history-fail"), "1");
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("histórico de migrations indisponível");
    expect(callsOf(ctx.mock).some((line) => line.startsWith("pg_dump"))).toBe(false);
    expect(JSON.parse(readFileSync(ctx.failed, "utf8")).sha).toBe(SHA_NEW);
  });

  it("histórico acima de 250 commits falha fechado", () => {
    const ctx = arrange();
    const many = Array.from({ length: 251 }, (_, index) => hexSha(index + 1));
    writeFileSync(join(ctx.mock, "history-page-1"), `${many.join("\n")}\n`);
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("acima de 250");
    expect(callsOf(ctx.mock).some((line) => line.startsWith("pg_dump") || line.includes("/pulls"))).toBe(false);
  });

  it("o primeiro deploy pagina o histórico e vê o contrato na página seguinte", () => {
    const ctx = arrange();
    const page1 = Array.from({ length: 100 }, (_, index) => hexSha(index + 1));
    const hidden = "d".repeat(40);
    writeFileSync(join(ctx.mock, "history-page-1"), `${page1.join("\n")}\n`);
    writeFileSync(join(ctx.mock, "history-page-2"), `${hidden}\n`);
    writeFileSync(join(ctx.mock, `labels-${hidden}`), "migration-contract\n");
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("deploy manual");
    expect(callsOf(ctx.mock).some((line) => line.includes(`/commits/${hidden}/pulls`))).toBe(true);
    expect(callsOf(ctx.mock).some((line) => line.startsWith("pg_dump"))).toBe(false);
  });

  it("a comparação acima de 250 commits falha fechada", () => {
    const ctx = arrange({ state: { sha: SHA_OLD, app: DIG_APP_PREV, migrate: DIG_MIG_PREV } });
    const many = Array.from({ length: 251 }, (_, index) => hexSha(index + 1));
    writeFileSync(join(ctx.mock, "compare-page-1"), `${many.join("\n")}\n`);
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("acima de 250");
    expect(callsOf(ctx.mock).some((line) => line.startsWith("pg_dump"))).toBe(false);
  });

  it("a comparação pagina e não ignora o contrato da página seguinte", () => {
    const ctx = arrange({ state: { sha: SHA_OLD, app: DIG_APP_PREV, migrate: DIG_MIG_PREV } });
    const page1 = Array.from({ length: 100 }, (_, index) => hexSha(index + 1));
    const hidden = "e".repeat(40);
    writeFileSync(join(ctx.mock, "compare-page-1"), `${page1.join("\n")}\n`);
    writeFileSync(join(ctx.mock, "compare-page-2"), `${hidden}\n`);
    writeFileSync(join(ctx.mock, `labels-${hidden}`), "migration-contract\n");
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("deploy manual");
    expect(callsOf(ctx.mock).some((line) => line.includes(`/commits/${hidden}/pulls`))).toBe(true);
    expect(callsOf(ctx.mock).some((line) => line.startsWith("pg_dump"))).toBe(false);
  });

  it("falha notifica o webhook quando ele está configurado", () => {
    const ctx = arrange({ migrateFail: true });
    ctx.envValues.DEPLOY_NOTIFY_URL = "https://hooks.example.test/deploy";
    ctx.envValues.DEPLOY_NOTIFY_TOKEN = NOTIFY_TOKEN;
    materializeEnv(ctx.envFile, ctx.envValues);
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    expect(callsOf(ctx.mock)).toContain("notify-auth-ok");
    expect(callsOf(ctx.mock).some((line) => line.includes("hooks.example.test"))).toBe(true);
    expect(JSON.parse(readFileSync(ctx.failed, "utf8")).sha).toBe(SHA_NEW);
  });

  it("guard que falha notifica pelo mark_and_stop", () => {
    const ctx = arrange({ contract: true });
    ctx.envValues.DEPLOY_NOTIFY_URL = "https://hooks.example.test/deploy";
    ctx.envValues.DEPLOY_NOTIFY_TOKEN = NOTIFY_TOKEN;
    materializeEnv(ctx.envFile, ctx.envValues);
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("deploy manual");
    const lines = callsOf(ctx.mock);
    expect(lines).toContain("notify-auth-ok");
    expect(lines.some((line) => line.includes("hooks.example.test") && line.includes('"event":"contract"'))).toBe(true);
    expect(lines.some((line) => line.startsWith("pg_dump"))).toBe(false);
    const fn = readFileSync(DEPLOY, "utf8");
    const body = fn.slice(fn.indexOf("mark_and_stop()"), fn.indexOf("\nmain()"));
    expect(body).toContain('notify_line "$LAST_LOG"');
  });

  it("backup que falha notifica pelo mark_and_stop", () => {
    const ctx = arrange({ listFail: true });
    ctx.envValues.DEPLOY_NOTIFY_URL = "https://hooks.example.test/deploy";
    ctx.envValues.DEPLOY_NOTIFY_TOKEN = NOTIFY_TOKEN;
    materializeEnv(ctx.envFile, ctx.envValues);
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("pg_restore --list falhou");
    const lines = callsOf(ctx.mock);
    expect(lines).toContain("notify-auth-ok");
    expect(lines.some((line) => line.includes("hooks.example.test") && line.includes('"event":"backup"'))).toBe(true);
    expect(lines.some((line) => line.startsWith("pg_dump"))).toBe(true);
    expect(lines.some((line) => line.startsWith("docker run"))).toBe(false);
  });

  it("run_allow não entrega o ambiente herdado aos filhos", () => {
    const ctx = arrange();
    ctx.env.LEAK_PROBE = "vazamento-do-ambiente-herdado";
    const result = run(ctx.env);
    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain("ambiente herdado vazou");
    expect(result.stderr).not.toContain("vazamento-do-ambiente-herdado");
    const lines = callsOf(ctx.mock);
    expect(lines.some((line) => line.startsWith("gh "))).toBe(true);
    expect(lines.some((line) => line.startsWith("pg_dump"))).toBe(true);
    expect(lines.some((line) => line.startsWith("docker run"))).toBe(true);
    expect(lines.join("\n")).not.toContain("vazamento-do-ambiente-herdado");
    expect(readFileSync(join(ROOT, "lib/common.sh"), "utf8")).toContain("env -i PATH=");
  });

  it("leitura do Coolify recusada depois do backup grava o marcador e não repete o pg_dump", () => {
    const ctx = arrange({ envsGetCode: "401" });
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Coolify recusou a leitura");
    const lines = callsOf(ctx.mock);
    expect(lines.some((line) => line.startsWith("pg_dump"))).toBe(true);
    expect(lines.some((line) => line.includes("PATCH") || line.startsWith("docker run"))).toBe(false);
    expect(readFileSync(DEPLOY, "utf8")).toContain("falhar_pos_backup");
    expectNoRetryDump(ctx, true);
  });

  it("escrita recusada de APP_MIGRATE_IMAGE grava o marcador e não repete o pg_dump", () => {
    const ctx = arrange({ patchMigrateCode: "500" });
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Coolify recusou a escrita");
    const lines = callsOf(ctx.mock);
    expect(lines.some((line) => line.startsWith("pg_dump"))).toBe(true);
    expect(lines.some((line) => line.includes("APP_MIGRATE_IMAGE"))).toBe(true);
    expect(lines.some((line) => line.startsWith("docker run"))).toBe(false);
    expectNoRetryDump(ctx, true);
  });

  it("escrita recusada de APP_IMAGE grava o marcador e não repete o pg_dump", () => {
    const ctx = arrange({ patchAppCode: "401" });
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Coolify recusou a escrita");
    const lines = callsOf(ctx.mock);
    expect(lines.some((line) => line.startsWith("docker run"))).toBe(true);
    expect(lines.some((line) => line.includes("PATCH") && line.includes('"key": "APP_IMAGE"'))).toBe(true);
    expectNoRetryDump(ctx, true);
  });

  it("ponta sem imagem deploya o commit anterior publicado e atestado", () => {
    const ctx = arrange({
      commits: [SHA_NEW, SHA_OLD],
      checks: { [SHA_NEW]: "success", [SHA_OLD]: "success" },
      digests: { [SHA_OLD]: { app: DIG_APP, migrate: DIG_MIG } },
      attestSha: SHA_OLD,
      healthSha: SHA_OLD,
    });
    const result = run(ctx.env);
    expect(result.status).toBe(0);
    const state = JSON.parse(readFileSync(ctx.state, "utf8")) as { sha: string; app_digest: string; migrate_digest: string };
    expect(state).toMatchObject({ sha: SHA_OLD, app_digest: DIG_APP, migrate_digest: DIG_MIG });
    const text = callsOf(ctx.mock).join("\n");
    expect(text).toContain(`sha-${SHA_NEW.slice(0, 7)}`);
    expect(text).toContain(`sha-${SHA_OLD.slice(0, 7)}`);
    expect(text).toContain(DIG_APP);
    expect(existsSync(ctx.failed)).toBe(false);
    assertNoSecrets(combined(result, ctx.mock, ctx.log));
  });

  it("nenhuma imagem nos commits lidos grava o marcador e não sai 0", () => {
    const ctx = arrange({
      commits: [SHA_NEW, SHA_OLD],
      checks: { [SHA_NEW]: "success", [SHA_OLD]: "success" },
      digests: {},
    });
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    expect(callsOf(ctx.mock).some((line) => line.startsWith("pg_dump") || line.includes("PATCH"))).toBe(false);
    expect(JSON.parse(readFileSync(ctx.failed, "utf8")).result).toBe("sem_imagem");
    expect(readFileSync(join(process.cwd(), "docs/ops/deploy-auto.md"), "utf8")).not.toContain("Imagem ainda não publicada: sai 0");
    expectNoRetryDump(ctx, false);
  });

  it("comando que falha depois do backup, sem die, grava o marcador e não sai 0", () => {
    const ctx = arrange();
    ctx.envValues.DEPLOY_NOTIFY_URL = "https://hooks.example.test/deploy";
    ctx.envValues.DEPLOY_NOTIFY_TOKEN = NOTIFY_TOKEN;
    materializeEnv(ctx.envFile, ctx.envValues);
    const result = runAfterBackup(ctx.env, "false");
    expect(result.status).not.toBe(0);
    expect(existsSync(ctx.failed)).toBe(true);
    expect(JSON.parse(readFileSync(ctx.failed, "utf8")).result).toBe("trap");
    const lines = callsOf(ctx.mock);
    expect(lines).toContain("notify-auth-ok");
    expect(lines.some((line) => line.includes("hooks.example.test") && line.includes('"result":"trap"'))).toBe(true);
    expect(lines.some((line) => line.startsWith("pg_dump"))).toBe(true);
    expect(lines.some((line) => line.startsWith("docker run"))).toBe(false);
    expectNoRetryDump(ctx, true);
  });

  it("exit depois do backup grava o marcador pos_backup", () => {
    const ctx = arrange();
    const result = runAfterBackup(ctx.env, "exit 1");
    expect(result.status).not.toBe(0);
    expect(existsSync(ctx.failed)).toBe(true);
    expect(JSON.parse(readFileSync(ctx.failed, "utf8")).result).toBe("pos_backup");
    const lines = callsOf(ctx.mock);
    expect(lines.some((line) => line.startsWith("pg_dump"))).toBe(true);
    expect(lines.some((line) => line.startsWith("docker run"))).toBe(false);
    expect(lines).not.toContain("notify-auth-ok");
    expectNoRetryDump(ctx, true);
  });

  it("fallback sem attestation nenhuma não publica a imagem", () => {
    const ctx = arrange({
      commits: [SHA_NEW, SHA_OLD],
      checks: { [SHA_NEW]: "success", [SHA_OLD]: "success" },
      digests: { [SHA_OLD]: { app: DIG_APP, migrate: DIG_MIG } },
      attest: "fail",
      attestSha: SHA_OLD,
      healthSha: SHA_OLD,
    });
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    expect(callsOf(ctx.mock).some((line) => line.startsWith("pg_dump") || line.startsWith("docker run"))).toBe(false);
    expect(existsSync(ctx.failed)).toBe(true);
    expect(JSON.parse(readFileSync(ctx.failed, "utf8")).result).toBe("sem_imagem");
  });

  it("fallback que não confere a attestation do migrate não publica a imagem", () => {
    const ctx = arrange({
      commits: [SHA_NEW, SHA_OLD],
      checks: { [SHA_NEW]: "success", [SHA_OLD]: "success" },
      digests: { [SHA_OLD]: { app: DIG_APP, migrate: DIG_MIG } },
      attestSha: SHA_OLD,
      attestFailSubstr: "/migrate@",
      healthSha: SHA_OLD,
    });
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    const lines = callsOf(ctx.mock);
    expect(lines.some((line) => line.includes("gh attestation verify") && line.includes("/migrate@"))).toBe(true);
    expect(lines.some((line) => line.startsWith("pg_dump") || line.startsWith("docker run"))).toBe(false);
    expect(existsSync(ctx.failed)).toBe(true);
    expect(JSON.parse(readFileSync(ctx.failed, "utf8")).result).toBe("sem_imagem");
  });

  it("fallback não aceita sha sem os checks verdes", () => {
    const ctx = arrange({
      commits: [SHA_NEW, SHA_OLD],
      checks: { [SHA_NEW]: "success", [SHA_OLD]: "failure" },
      digests: { [SHA_OLD]: { app: DIG_APP, migrate: DIG_MIG } },
      attestSha: SHA_OLD,
      healthSha: SHA_OLD,
    });
    const result = run(ctx.env);
    expect(result.status).not.toBe(0);
    const lines = callsOf(ctx.mock);
    expect(lines.some((line) => line.includes(`/commits/${SHA_OLD}/check-runs`))).toBe(true);
    expect(lines.some((line) => line.startsWith("pg_dump") || line.startsWith("docker run") || line.includes("gh attestation"))).toBe(false);
    expect(existsSync(ctx.failed)).toBe(true);
    expect(JSON.parse(readFileSync(ctx.failed, "utf8")).result).toBe("sem_imagem");
  });

  it("o runbook é de produção, restaura por env-file e deixa o BLOCK-12 pendente", () => {
    const doc = readFileSync(join(process.cwd(), "docs/ops/deploy-auto.md"), "utf8");
    expect(doc.startsWith("# Runbook · deployer pull de produção\n")).toBe(true);
    expect(doc).toContain("--env-file");
    expect(doc).not.toContain('pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" /var/backups');
    expect(doc).toContain("BLOCK-12");
    expect(doc).toContain("depende do Mendes");
    expect(doc).toContain("clear-failed");
    expect(doc).toContain("cancel-in-progress");
    expect(doc).toContain("20 commits");
    expect(doc).toContain("sem_imagem");
    expect(doc).toMatch(/## Incidente[\s\S]*erp-deployer pause/);
    expect(doc).not.toContain("Imagem ainda não publicada: sai 0");
  });
});

function secretTextOutsideFixtures(root: string): string {
  const hits: string[] = [];
  const skip = new Set([join(root, "bin"), join(root, "mock"), join(root, "env")]);
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (skip.has(path)) continue;
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      const text = readFileSync(path, "utf8");
      for (const secret of [COOLIFY_TOKEN, GHCR_TOKEN, SMOKE_COOKIE, "Authorization: Bearer", "Cookie:"]) {
        if (text.includes(secret)) hits.push(path);
      }
    }
  };
  walk(root);
  return hits.join("\n");
}

async function expectSecretGoneAfterTerm(env: NodeJS.ProcessEnv, mock: string): Promise<void> {
  const child = spawn(DEPLOY, [], { env, detached: true, stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += String(chunk);
  });
  const sleeping = join(mock, "curl-sleeping");
  const started = Date.now();
  try {
    while (!existsSync(sleeping)) {
      if (child.exitCode !== null || Date.now() - started > 8000) {
        throw new Error(`curl não dormiu\n${stderr}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    const headers = readFileSync(join(mock, "curl-headers"), "utf8").split("\n").filter(Boolean);
    expect(headers.length).toBeGreaterThan(0);
    for (const header of headers) expect(existsSync(header)).toBe(true);
    if (child.pid) process.kill(-child.pid, "SIGTERM");
    const outcome = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
      const timer = setTimeout(() => resolve({ code: null, signal: null }), 5000);
      child.on("exit", (code, signal) => {
        clearTimeout(timer);
        resolve({ code, signal });
      });
    });
    expect(outcome.signal).toBeNull();
    expect(outcome.code).toBe(143);
    for (const header of headers) {
      expect(existsSync(header)).toBe(false);
      expect(existsSync(dirname(header))).toBe(false);
    }
    expect(stderr).not.toContain(COOLIFY_TOKEN);
    expect(stderr).not.toContain(GHCR_TOKEN);
    expect(stderr).not.toContain(SMOKE_COOKIE);
    expect(secretTextOutsideFixtures(work)).toBe("");
  } finally {
    if (child.pid && child.exitCode === null) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        /* o processo já encerrou */
      }
    }
  }
}

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

  it("compara commit, ref e digest por igualdade, não por substring", () => {
    const hex = "a".repeat(64);
    const bundle = (sha: string, digestHex: string, ref = "refs/heads/main", extra = "") => JSON.stringify([{
      verificationResult: {
        statement: {
          subject: [{ digest: { sha256: digestHex } }],
          predicate: {
            note: extra,
            buildDefinition: {
              externalParameters: { workflow: { ref } },
              resolvedDependencies: [{ digest: { gitCommit: sha } }],
            },
          },
        },
      },
    }]);
    const runCheck = (payload: string) => spawnSync("python3", [join(ROOT, "lib/py/attest_check.py")], {
      input: payload,
      encoding: "utf8",
      env: { ...process.env, EXPECTED_SHA: SHA_NEW, EXPECTED_DIGEST: DIG_APP },
    });
    expect(runCheck(bundle(SHA_NEW, hex)).status).toBe(0);
    expect(runCheck(bundle(SHA_OLD, hex, "refs/heads/main", SHA_NEW)).status).not.toBe(0);
    expect(runCheck(bundle(SHA_NEW, hex, "refs/heads/main-extra")).status).not.toBe(0);
    expect(runCheck(bundle(SHA_NEW, "b".repeat(64))).status).not.toBe(0);
  });
});
