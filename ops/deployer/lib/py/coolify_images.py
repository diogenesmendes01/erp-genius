#!/usr/bin/env python3
"""Extrai a única linha de produção de APP_IMAGE e APP_MIGRATE_IMAGE.

Só vale is_preview false. A linha de preview é ignorada.
Códigos: 1 JSON inválido, 2 valor vazio ou com quebra de linha,
3 linha não-preview ambígua ou is_preview não booleano,
4 value ausente, 5 is_preview ausente.
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
        if "is_preview" not in item:
            return 5
        flag = item.get("is_preview")
        if flag is True:
            continue
        if flag is not False:
            return 3
        if "value" not in item:
            return 4
        value = item.get("value")
        if not isinstance(value, str) or value == "" or "\n" in value or "\r" in value or "\x00" in value:
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
