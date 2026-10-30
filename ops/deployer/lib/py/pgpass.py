#!/usr/bin/env python3
"""Gera um pgpass 0600 e imprime host, porta, usuário e banco — nunca a senha."""
import os
import stat
import sys
import urllib.parse


def esc(value: str) -> str:
    return value.replace("\\", "\\\\").replace(":", "\\:")


def main() -> int:
    if len(sys.argv) != 2:
        return 2
    raw = os.environ.get("DATABASE_URL", "")
    parsed = urllib.parse.urlparse(raw)
    if parsed.scheme not in ("postgresql", "postgres"):
        return 1
    if not parsed.hostname or parsed.username is None or parsed.password is None or not parsed.path:
        return 1
    user = urllib.parse.unquote(parsed.username)
    password = urllib.parse.unquote(parsed.password)
    database = urllib.parse.unquote(parsed.path.lstrip("/").split("?", 1)[0])
    if not database or any(ch in password for ch in "\n\r\x00"):
        return 1
    port = parsed.port or 5432
    path = sys.argv[1]
    line = f"{esc(parsed.hostname)}:{port}:{esc(database)}:{esc(user)}:{esc(password)}\n"
    fd = os.open(path, os.O_WRONLY | os.O_TRUNC | os.O_CREAT, 0o600)
    try:
        os.write(fd, line.encode("utf-8"))
    finally:
        os.close(fd)
    os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)
    sys.stdout.write(f"{parsed.hostname}\n{port}\n{user}\n{database}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
