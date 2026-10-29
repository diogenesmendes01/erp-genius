#!/usr/bin/env python3
"""Imprime somente o campo sha de /api/health, se for string."""
import json
import sys


def main() -> int:
    try:
        data = json.loads(sys.stdin.read())
    except json.JSONDecodeError:
        return 1
    if not isinstance(data, dict):
        return 1
    sha = data.get("sha")
    if not isinstance(sha, str):
        return 1
    sys.stdout.write(sha.strip().lower())
    return 0


if __name__ == "__main__":
    sys.exit(main())
