#!/usr/bin/env python3
"""Monta o JSON de escrita de env. A chave só pode ser uma das duas imagens."""
import json
import os
import sys

ALLOWED = {"APP_IMAGE", "APP_MIGRATE_IMAGE"}


def main() -> int:
    key = os.environ.get("ENV_KEY", "")
    value = os.environ.get("ENV_VALUE", "")
    if key not in ALLOWED:
        return 1
    if "\n" in value or "\r" in value or "\x00" in value:
        return 1
    json.dump(
        {"key": key, "value": value, "is_literal": True, "is_preview": False},
        sys.stdout,
        ensure_ascii=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
