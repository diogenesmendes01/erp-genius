#!/usr/bin/env python3
"""Extrai só APP_IMAGE e APP_MIGRATE_IMAGE. O resto da resposta é descartado."""
import json
import sys

WANTED = ("APP_IMAGE", "APP_MIGRATE_IMAGE")


def main() -> int:
    try:
        data = json.loads(sys.stdin.read())
    except json.JSONDecodeError:
        return 1
    if not isinstance(data, list):
        return 1
    found: dict[str, str] = {}
    for item in data:
        if not isinstance(item, dict):
            continue
        key = item.get("key")
        if key not in WANTED:
            continue
        value = item.get("value", "")
        if not isinstance(value, str) or "\n" in value or "\r" in value or "\x00" in value:
            return 2
        found[key] = value
    for key in WANTED:
        sys.stdout.write(f"{key}={found.get(key, '')}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
