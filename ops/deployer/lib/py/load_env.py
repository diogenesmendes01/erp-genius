#!/usr/bin/env python3
"""Lê o env file no formato KEY=VALUE e emite só chaves permitidas, separadas por NUL.

Não faz expansão de shell. PATH, LD_PRELOAD e qualquer outra chave ficam de fora.
"""
import sys

ALLOWED = {
    "COOLIFY_TOKEN",
    "GHCR_TOKEN",
    "COOLIFY_BASE_URL",
    "APP_BASE_URL",
    "DATABASE_URL",
    "MIGRATE_DATABASE_URL",
    "BACKUP_DIR",
    "BACKUP_RETENTION_DAYS",
    "DEPLOYER_STATE_FILE",
    "DEPLOYER_LOCK_FILE",
    "DEPLOYER_LOG_FILE",
    "DEPLOYER_FAILED_FILE",
    "DEPLOYER_PAUSE_FILE",
    "HEALTH_ATTEMPTS",
    "HEALTH_INTERVAL_SECONDS",
    "DOCKER_NETWORK",
    "DEPLOY_NOTIFY_URL",
    "DEPLOY_NOTIFY_TOKEN",
    "SMOKE_COOKIE",
    "SMOKE_PATH",
}


def main() -> int:
    if len(sys.argv) != 2:
        return 2
    path = sys.argv[1]
    try:
        with open(path, encoding="utf-8") as handle:
            lines = handle.read().splitlines()
    except OSError:
        return 1
    out: list[str] = []
    for raw in lines:
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].strip()
        if "=" not in line:
            return 3
        key, value = line.split("=", 1)
        key = key.strip()
        if key not in ALLOWED:
            continue
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        if "\x00" in value or "\n" in value or "\r" in value:
            return 4
        out.append(key)
        out.append(value)
    sys.stdout.buffer.write(b"\0".join(part.encode("utf-8") for part in out))
    if out:
        sys.stdout.buffer.write(b"\0")
    return 0


if __name__ == "__main__":
    sys.exit(main())
