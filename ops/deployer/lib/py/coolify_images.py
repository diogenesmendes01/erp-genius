#!/usr/bin/env python3
"""Extrai a única linha de produção de APP_IMAGE e APP_MIGRATE_IMAGE.

Só vale is_preview false. A linha de preview é ignorada e não sai no stdout.
Zero ou mais de uma linha não-preview da mesma chave sai com código 3.
"""
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
    found: dict[str, list[str]] = {key: [] for key in WANTED}
    for item in data:
        if not isinstance(item, dict):
            continue
        key = item.get("key")
        if key not in WANTED:
            continue
        flag = item.get("is_preview")
        if flag is True:
            continue
        if flag is not False:
            return 3
        value = item.get("value", "")
        if not isinstance(value, str) or "\n" in value or "\r" in value or "\x00" in value:
            return 2
        found[key].append(value)
    for key in WANTED:
        values = found[key]
        if len(values) != 1:
            return 3
        sys.stdout.write(f"{key}={values[0]}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
